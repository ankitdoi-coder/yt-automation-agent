const dns = require('dns');
const net = require('net');
const https = require('https');
try {
  if (typeof dns.setDefaultResultOrder === 'function') dns.setDefaultResultOrder('ipv4first');
  if (typeof net.setDefaultAutoSelectFamily === 'function') net.setDefaultAutoSelectFamily(false);
} catch (_) {}

const ipv4Agent = new https.Agent({ family: 4, keepAlive: false });
https.globalAgent = ipv4Agent;

const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { CredentialManager } = require('../utils/credential-manager');
const { Database } = require('../database/db');

google.options({ timeout: 180000, agent: ipv4Agent });

function getIstDateString() {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

function toIstHour(isoDate) {
  if (!isoDate) return null;
  const ist = new Date(new Date(isoDate).getTime() + 5.5 * 3600 * 1000);
  return ist.getUTCHours();
}

function classifyTitleStyle(title) {
  const hasDevanagari = /[\u0900-\u097F]/.test(title || '');
  if (hasDevanagari) return title.length > 50 ? 'hindi_long' : 'hindi_short';
  const len = (title || '').length;
  if (len > 95) return 'english_over_length';
  if (len >= 60) return 'english_search_keyword_rich';
  return 'english_short';
}

function buildCompactQHint(questionText) {
  const cleaned = String(questionText || '').replace(/[?।!]+$/g, '').trim();
  if (!cleaned) return 'आखिरी सवाल';
  return cleaned.length > 36 ? `${cleaned.slice(0, 33).trim()}...` : cleaned;
}

function buildRotatingChallengeComment(videoId, qCount, lastQuestionText) {
  const qHint = buildCompactQHint(lastQuestionText);
  const templates = [
    `🎯 Daily Challenge: Question ${qCount} (${qHint}) का सही उत्तर किस-किस को पहले से पता था? अपना स्कोर कमेंट करें! 🏆👇\n🔔 रोज़ाना ऐसे ही तेज GK Tests के लिए ExamIQ Bharat को Subscribe करें!`,
    `🔥 दम है तो बताओ — Q${qCount} (${qHint}) का सही जवाब + आपका स्कोर (${qCount} में से) कितना रहा? कमेंट करो! 💬\n🔔 ExamIQ Bharat को Subscribe जरूर करें!`,
    `🏆 Test Score Check: Question ${qCount} (${qHint}) कितनों का सही गया? कमेंट में A, B, C या D लिखो! 👇\n🔔 Daily Rapid GK Quiz के लिए Subscribe करें!`,
    `📚 SSC / Railway / Police Aspirants: सवाल ${qCount} (${qHint}) का जवाब आपने क्या सोचा? अपना स्कोर कमेंट में बताएं! 💪\n🔔 Subscribe ExamIQ Bharat!`,
    `⚡ ${qCount} में से कितने सही हुए? खासकर Q${qCount} (${qHint}) किसने सही किया? कमेंट में स्कोर ड्रॉप करो! 🎯👇\n🔔 Join ExamIQ Bharat for Daily GK Shorts!`
  ];
  const idx = String(videoId).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % templates.length;
  return templates[idx];
}

async function ensureValidAuth(cm) {
  const auth = cm.getYouTubeAuth();
  if (auth && auth.credentials && auth.credentials.refresh_token) {
    const exp = auth.credentials.expiry_date || 0;
    if (!auth.credentials.access_token || exp <= Date.now() + 60000) {
      const refreshed = await auth.refreshAccessToken();
      if (refreshed && refreshed.credentials) {
        auth.setCredentials({ ...auth.credentials, ...refreshed.credentials });
        cm.tokens.youtube = { ...(cm.tokens.youtube || {}), ...auth.credentials };
        await cm.saveTokens();
      }
    }
  }
  return auth;
}

async function main() {
  const args = process.argv.slice(2);
  const forceUpload = args.includes('--force') || process.env.FORCE_UPLOAD === 'true';
  const positionalDate = args.find(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
  const dateStr = positionalDate || process.env.RUN_DATE || getIstDateString();

  const runDir = path.resolve('runs', dateStr);
  const videoPath = path.join(runDir, 'video.mp4');
  const metadataPath = path.join(runDir, 'metadata.json');
  const quizPath = path.join(runDir, 'quiz.json');
  const techQaPath = path.join(runDir, 'tech_qa.json');
  const factQaPath = path.join(runDir, 'fact_qa.json');
  const experimentPath = path.join(runDir, 'experiment.json');
  const receiptPath = path.join(runDir, 'upload_receipt.json');

  if (!fs.existsSync(videoPath)) {
    throw new Error(`video.mp4 not found in ${runDir}`);
  }
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`metadata.json not found in ${runDir}`);
  }
  if (fs.existsSync(receiptPath) && !forceUpload) {
    const existing = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
    throw new Error(`Upload receipt already exists for ${dateStr} (${existing.videoId}). Pass --force only if intentional.`);
  }

  // Blocking pre-upload Technical QA check
  const techQa = fs.existsSync(techQaPath) ? JSON.parse(fs.readFileSync(techQaPath, 'utf8')) : null;
  if (!techQa || techQa.qa_passed !== true) {
    throw new Error('Technical QA gate failed or missing (tech_qa.json). Upload blocked.');
  }

  // Blocking pre-upload Fact-Check gate
  if (fs.existsSync(factQaPath)) {
    const factQa = JSON.parse(fs.readFileSync(factQaPath, 'utf8'));
    if (factQa.qa_gate_passed !== true) {
      throw new Error('Fact-check QA gate failed (fact_qa.json). Upload blocked.');
    }
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
  const quizData = fs.existsSync(quizPath) ? JSON.parse(fs.readFileSync(quizPath, 'utf8')) : {};
  const expData = fs.existsSync(experimentPath) ? JSON.parse(fs.readFileSync(experimentPath, 'utf8')) : {};

  if (!metadata.title || metadata.title.length > 95) {
    throw new Error(`Title exceeds 95-char Shorts limit (${(metadata.title || '').length}): "${metadata.title}"`);
  }

  console.log('=== YT-GK UPLOADER ===');
  console.log(`Run Date:   ${dateStr}`);
  console.log(`Video File: ${videoPath} (${(fs.statSync(videoPath).size / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`Title:      ${metadata.title} (${metadata.title.length} chars)`);
  console.log(`Privacy:    ${metadata.privacyStatus || 'public'}`);

  const cm = new CredentialManager();
  await cm.initialize();
  await ensureValidAuth(cm);
  const yt = cm.getYouTubeClient();

  let quotaUsed = 0;

  // STEP 1: Upload video via official YouTube Resumable Upload API (avoids Node 24 PassThrough multipart hang)
  console.log('\n[1/4] Uploading video to YouTube Data API v3 (resumable Buffer upload)...');
  const requestStatus = {
    privacyStatus: metadata.privacyStatus || 'public',
    selfDeclaredMadeForKids: false,
    embeddable: true
  };
  if (metadata.publishAt && requestStatus.privacyStatus === 'private') {
    requestStatus.publishAt = metadata.publishAt;
  }

  const videoBuffer = fs.readFileSync(videoPath);
  const accessToken = cm.getYouTubeAuth().credentials.access_token;
  const initBody = JSON.stringify({
    snippet: {
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags || ['Shorts', 'GK Shorts', 'GK Quiz', 'ExamIQ Bharat'],
      categoryId: String(metadata.categoryId || '27'),
      defaultLanguage: 'hi',
      defaultAudioLanguage: 'hi'
    },
    status: requestStatus
  });

  const initRes = await fetch(
    'https://youtube.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status&notifySubscribers=true',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Length': String(videoBuffer.length),
        'X-Upload-Content-Type': 'video/mp4'
      },
      body: initBody
    }
  );
  if (!initRes.ok) {
    throw new Error(`Resumable upload init failed (${initRes.status}): ${await initRes.text()}`);
  }
  const uploadUrl = initRes.headers.get('location');
  if (!uploadUrl) {
    throw new Error('Resumable upload init returned no Location header');
  }

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Length': String(videoBuffer.length),
      'Content-Type': 'video/mp4'
    },
    body: videoBuffer
  });
  if (!putRes.ok) {
    throw new Error(`Resumable video PUT failed (${putRes.status}): ${await putRes.text()}`);
  }
  const uploadData = await putRes.json();
  quotaUsed += 1600;

  const videoId = uploadData.id;
  if (!videoId) {
    throw new Error('Upload failed: No video ID returned by YouTube API');
  }

  const videoUrl = `https://youtube.com/shorts/${videoId}`;
  console.log(`✅ Upload successful! Video ID: ${videoId}`);
  console.log(`   Shorts Link: ${videoUrl}`);

  // STEP 2: Blocking Verification Gate via videos.list (poll briefly until processed)
  console.log('\n[2/4] Verifying public/scheduled status and processing state (BLOCKING GATE)...');
  let verifiedItem = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
    await new Promise(r => setTimeout(r, attempt === 1 ? 3000 : 5000));
    const verifyRes = await yt.videos.list({
      part: 'snippet,status,contentDetails',
      id: videoId
    });
    quotaUsed += 1;
    verifiedItem = verifyRes.data.items?.[0];
    if (verifiedItem && verifiedItem.status?.uploadStatus === 'processed') {
      break;
    }
  }

  if (!verifiedItem) {
    throw new Error(`BLOCKING FAILURE: Video ${videoId} not found via videos.list`);
  }

  const livePrivacy = verifiedItem.status.privacyStatus;
  const uploadStatus = verifiedItem.status.uploadStatus;
  const rejectionReason = verifiedItem.status.rejectionReason || null;
  const madeForKids = Boolean(verifiedItem.status.madeForKids);
  const regionRestriction = verifiedItem.contentDetails?.regionRestriction || null;
  const publishedAt = verifiedItem.snippet?.publishedAt || new Date().toISOString();

  console.log(`   Live Privacy Status: ${livePrivacy}`);
  console.log(`   Live Upload Status:  ${uploadStatus}`);
  console.log(`   Made For Kids:       ${madeForKids}`);

  const isValidPrivacy = livePrivacy === 'public' || (livePrivacy === 'private' && Boolean(verifiedItem.status.publishAt));
  if (!isValidPrivacy) {
    throw new Error(`BLOCKING FAILURE: Unexpected privacy status '${livePrivacy}' (expected public or scheduled)!`);
  }
  if (rejectionReason) {
    throw new Error(`BLOCKING FAILURE: YouTube rejected video. Reason: ${rejectionReason}`);
  }
  if (uploadStatus !== 'processed') {
    console.warn(`⚠️ Upload status is '${uploadStatus}' after polling; monitor Studio for completion.`);
  } else {
    console.log('✅ Video is confirmed LIVE, PUBLIC, and PROCESSED on YouTube!');
  }

  // STEP 3: Post ONE Rotating Engagement Comment via commentThreads.insert (50 quota units)
  const qCount = Number(quizData.totalQuestions || quizData.questions?.length || 3);
  const lastQuestion = Array.isArray(quizData.questions) && quizData.questions.length > 0
    ? quizData.questions[quizData.questions.length - 1]?.question
    : '';
  const challengeComment = buildRotatingChallengeComment(videoId, qCount, lastQuestion);

  let commentId = null;
  if (livePrivacy === 'public') {
    console.log('\n[3/4] Posting rotating engagement challenge comment...');
    try {
      const commentRes = await yt.commentThreads.insert({
        part: 'snippet',
        requestBody: {
          snippet: {
            videoId,
            topLevelComment: {
              snippet: {
                textOriginal: challengeComment
              }
            }
          }
        }
      });
      quotaUsed += 50;
      commentId = commentRes.data.id;
      console.log(`✅ Engagement comment posted! (Comment ID: ${commentId})`);
      console.log('   ℹ️ Note: YouTube API does not support comment pinning — pin manually in Studio if desired.');
    } catch (commentErr) {
      console.warn(`⚠️ Could not post comment automatically: ${commentErr.message}`);
    }
  } else {
    console.log('\n[3/4] Skipping immediate comment because video is not yet public.');
  }

  // STEP 4: Log video_features, initial video_metrics, & topic_backlog in SQLite
  console.log('\n[4/4] Logging video_features and topic_backlog into SQLite...');
  const subtopic = expData.today_topic?.subtopic || quizData.subject || metadata.title;
  const topicCluster = expData.today_topic?.topic_english || quizData.subject || 'General Knowledge';
  const durationS = Math.round(Number(techQa.measured_duration_seconds || 30));
  const uploadHourIst = toIstHour(publishedAt);

  const db = new Database();
  await db.initialize();
  await db.executeQuery(
    `INSERT INTO video_features (video_id, title, topic, subtopic, q_count, duration_s, title_style, title_len, hook_type, voice_speed, bgm, upload_hour_ist, cohort, published_at, privacy_status, made_for_kids, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(video_id) DO UPDATE SET
       title = excluded.title,
       topic = excluded.topic,
       subtopic = excluded.subtopic,
       q_count = excluded.q_count,
       duration_s = excluded.duration_s,
       title_style = excluded.title_style,
       title_len = excluded.title_len,
       hook_type = excluded.hook_type,
       voice_speed = excluded.voice_speed,
       bgm = excluded.bgm,
       upload_hour_ist = excluded.upload_hour_ist,
       cohort = excluded.cohort,
       published_at = excluded.published_at,
       privacy_status = excluded.privacy_status,
       made_for_kids = excluded.made_for_kids,
       updated_at = CURRENT_TIMESTAMP`,
    [
      videoId,
      metadata.title,
      topicCluster,
      subtopic,
      qCount,
      durationS,
      classifyTitleStyle(metadata.title),
      metadata.title.length,
      'challenge_3_of_2',
      1.0,
      quizData.audioDesign?.bgm || 'intense_suspense_beat',
      uploadHourIst,
      'variant_ytgk_rapid',
      publishedAt,
      livePrivacy,
      madeForKids ? 1 : 0
    ]
  );

  await db.executeQuery(
    `UPDATE topic_backlog
     SET status = 'used', last_used_date = ?, last_video_id = ?, updated_at = CURRENT_TIMESTAMP
     WHERE subtopic = ? OR ? LIKE '%' || subtopic || '%'`,
    [dateStr, videoId, subtopic, subtopic]
  );

  await db.executeQuery(
    `INSERT INTO video_metrics (id, video_id, date, measurement_window, views, likes, comments, source)
     VALUES (?, ?, ?, 'T+0h', 0, 0, ?, ?)
     ON CONFLICT(video_id, date, measurement_window) DO NOTHING`,
    [`${videoId}_${dateStr}_T+0h`, videoId, dateStr, commentId ? 1 : 0, `yt-gk-uploader_quota_${quotaUsed}`]
  );

  const categoryKey = quizData.category || 'polity';
  const targetPart = Number(quizData.partNumber || 2);
  try {
    await db.executeQuery(
      `UPDATE category_series
       SET current_part = MAX(current_part, ?),
           last_video_id = ?,
           last_published_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE category = ?`,
      [targetPart, videoId, categoryKey]
    );
    await db.persistCategorySeriesToJson();
    console.log(`Updated category series for ${categoryKey} to Part ${targetPart} and persisted to data/category_series.json`);
  } catch (seriesErr) {
    console.warn(`Could not update category_series: ${seriesErr.message}`);
  }

  await db.close();

  // Append to analytics/experiments.csv
  try {
    const csvPath = path.resolve('analytics', 'experiments.csv');
    if (fs.existsSync(csvPath)) {
      const expLine = `\n${new Date().toISOString()},${videoId},short,${expData.experiment_id || 'exp_pacing_compression'},${qCount},${classifyTitleStyle(metadata.title)},"${metadata.title.replace(/"/g, '""')}",published,"10Q pacing compression, duration: ${durationS}s, quota used: ${quotaUsed}"`;
      fs.appendFileSync(csvPath, expLine, 'utf8');
      console.log('Appended experiment record to analytics/experiments.csv');
    }
  } catch (csvErr) {
    console.warn(`Could not append to experiments.csv: ${csvErr.message}`);
  }

  // Save upload receipt
  const receipt = {
    date: dateStr,
    videoId,
    videoUrl,
    title: metadata.title,
    topic: topicCluster,
    subtopic,
    durationSeconds: durationS,
    questionCount: qCount,
    privacyStatus: livePrivacy,
    uploadStatus,
    madeForKids,
    rejectionReason,
    regionRestriction,
    publishedAt,
    uploadHourIst,
    commentId,
    commentText: commentId ? challengeComment : null,
    quotaUsed,
    uploadedAt: new Date().toISOString()
  };

  fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2), 'utf8');

  console.log('\n======================================================');
  console.log('🎉 YT-GK UPLOAD COMPLETE & VERIFIED');
  console.log(`Video ID:    ${videoId}`);
  console.log(`Title:       ${metadata.title}`);
  console.log(`Shorts URL:  ${videoUrl}`);
  console.log(`Status:      ${livePrivacy} / ${uploadStatus}`);
  console.log(`Comment:     "${challengeComment.split('\n')[0]}"`);
  console.log(`Quota Used:  ~${quotaUsed} units (Budget: 10,000 units/day)`);
  console.log('======================================================');
}

main().catch(err => {
  console.error('Fatal upload error:', err);
  process.exit(1);
});
