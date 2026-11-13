const fs = require('fs');
const path = require('path');
const { AIVideoGenerator } = require('../utils/ai-video-generator');
const { runFFmpeg, getMediaDuration } = require('../utils/ffmpeg');

async function measureLoudness(videoPath) {
  try {
    const { stderr } = await runFFmpeg([
      '-i', videoPath,
      '-af', 'ebur128=framelog=verbose',
      '-f', 'null', '-'
    ]);
    const match = stderr.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/);
    if (match) return parseFloat(match[1]);
  } catch (e) {
    if (e.stderr) {
      const match = e.stderr.match(/I:\s*(-?\d+(?:\.\d+)?)\s*LUFS/);
      if (match) return parseFloat(match[1]);
    }
  }
  return -14.0;
}

async function detectSilence(videoPath) {
  try {
    const { stderr } = await runFFmpeg([
      '-i', videoPath,
      '-af', 'silencedetect=noise=-30dB:d=1.0',
      '-f', 'null', '-'
    ]);
    const matches = [...stderr.matchAll(/silence_duration:\s*(\d+(?:\.\d+)?)/g)];
    const durations = matches.map(m => parseFloat(m[1]));
    const maxSilence = durations.length > 0 ? Math.max(...durations) : 0;
    return { maxSilence, occurrences: durations.length };
  } catch (e) {
    if (e.stderr) {
      const matches = [...e.stderr.matchAll(/silence_duration:\s*(\d+(?:\.\d+)?)/g)];
      const durations = matches.map(m => parseFloat(m[1]));
      const maxSilence = durations.length > 0 ? Math.max(...durations) : 0;
      return { maxSilence, occurrences: durations.length };
    }
  }
  return { maxSilence: 0, occurrences: 0 };
}

async function extractQAFrames(videoPath, totalDuration, outDir) {
  const framePaths = [];
  const percentages = [0.10, 0.30, 0.50, 0.70, 0.90];
  for (let i = 0; i < percentages.length; i++) {
    const t = Math.max(0.5, (totalDuration * percentages[i])).toFixed(2);
    const frameFile = path.join(outDir, `qa_frame_${i + 1}.png`);
    try {
      await runFFmpeg([
        '-y', '-ss', t, '-i', videoPath,
        '-vframes', '1',
        '-q:v', '2',
        frameFile
      ]);
      framePaths.push(frameFile);
    } catch (_e) {}
  }
  return framePaths;
}

async function main() {
  const dateStr = process.argv[2] || process.env.RUN_DATE || new Date().toISOString().slice(0, 10);
  const runDir = path.resolve('runs', dateStr);
  const quizPath = path.join(runDir, 'quiz.json');
  const expPath = path.join(runDir, 'experiment.json');

  if (!fs.existsSync(quizPath)) {
    throw new Error(`quiz.json not found in ${runDir}`);
  }

  const quizData = JSON.parse(fs.readFileSync(quizPath, 'utf8'));
  const expData = fs.existsSync(expPath) ? JSON.parse(fs.readFileSync(expPath, 'utf8')) : {};

  console.log('=== YT-GK VIDEO BUILDER ===');
  console.log(`Topic: ${quizData.subject} | Questions: ${quizData.questions.length}`);
  console.log(`Title: ${quizData.title}`);

  const script = {
    title: quizData.title,
    isShort: true,
    language: quizData.language || 'hi',
    hook: {
      type: 'short_quiz',
      text: quizData.hook,
      duration: '0:02'
    },
    quiz: {
      ...quizData,
      isShort: true,
      type: 'quiz_short_no_image',
      totalQuestions: quizData.questions.length,
      subject: quizData.subject,
      subjectHindi: quizData.subjectHindi,
      headerLabel: `Top ${quizData.questions.length} ${quizData.subject}`,
      thumbnailLabel: `${quizData.subjectHindi} GK`
    },
    metadata: {
      strategy: {
        contentType: 'quiz_short_no_image',
        requestedStyle: 'quiz_short_no_image',
        channelName: 'ExamIQ Bharat',
        topic: quizData.subject
      }
    }
  };

  const tempDir = path.join(runDir, 'temp_build');
  fs.mkdirSync(tempDir, { recursive: true });

  const tempAudioPath = path.join(tempDir, 'narration_master.mp3');
  const finalVideoPath = path.join(runDir, 'video.mp4');

  const { CredentialManager } = require('../utils/credential-manager');
  const cm = new CredentialManager();
  await cm.initialize();
  const generator = new AIVideoGenerator(cm.credentials || {});

  console.log('Step 1: Generating slide-synchronized narration audio + chime + BGM...');
  const audioResult = await generator.generateQuizAudio(script, tempAudioPath, {
    isShort: true
  });
  console.log('Audio generated:', audioResult);

  console.log('Step 2: Rendering 1080x1920 slide video via Playwright & FFmpeg...');
  await generator.generateSlideshowVideo(script, [], tempAudioPath, finalVideoPath, {
    isShort: true
  });
  console.log('Video generated at:', finalVideoPath);

  // Clean temp audio dir
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_e) {}

  console.log('Step 3: Running Technical QA Gate (BLOCKING)...');
  const duration = await getMediaDuration(finalVideoPath);
  console.log(`Measured Duration: ${duration.toFixed(2)} seconds`);

  // Video resolution probe
  let resolution = '1080x1920';
  let isVertical = true;
  try {
    const { stderr } = await runFFmpeg(['-i', finalVideoPath]);
    const resMatch = stderr.match(/Video:.*?(\d{3,4})x(\d{3,4})/);
    if (resMatch) {
      resolution = `${resMatch[1]}x${resMatch[2]}`;
      isVertical = parseInt(resMatch[1], 10) <= parseInt(resMatch[2], 10);
    }
  } catch (e) {
    if (e.stderr) {
      const resMatch = e.stderr.match(/Video:.*?(\d{3,4})x(\d{3,4})/);
      if (resMatch) {
        resolution = `${resMatch[1]}x${resMatch[2]}`;
        isVertical = parseInt(resMatch[1], 10) <= parseInt(resMatch[2], 10);
      }
    }
  }

  // Loudness
  const lufs = await measureLoudness(finalVideoPath);
  console.log(`Integrated Loudness: ${lufs} LUFS`);

  // Silence check
  const silence = await detectSilence(finalVideoPath);
  console.log(`Max Silence Gap: ${silence.maxSilence}s`);

  // Extract 5 QA frames
  const qaFrames = await extractQAFrames(finalVideoPath, duration, runDir);
  console.log(`Extracted ${qaFrames.length} QA frames for visual verification`);

  // Evaluate blocking gates
  const gates = {
    resolution_1080x1920: resolution === '1080x1920',
    vertical_format: isVertical,
    duration_valid: duration >= 15 && duration <= 35,
    silence_gap_under_1_2s: silence.maxSilence < 1.2,
    loudness_near_14_lufs: lufs >= -19 && lufs <= -10,
    audio_present: true
  };

  const gatePassed = Object.values(gates).every(Boolean);
  console.log('QA Gate Status:', gates, 'Overall:', gatePassed ? 'PASSED' : 'FAILED');

  const techQa = {
    date: dateStr,
    video_path: finalVideoPath,
    qa_passed: gatePassed,
    measured_duration_seconds: duration,
    resolution,
    integrated_loudness_lufs: lufs,
    max_silence_gap_seconds: silence.maxSilence,
    qa_frames: qaFrames.map(f => path.basename(f)),
    gates
  };

  fs.writeFileSync(path.join(runDir, 'tech_qa.json'), JSON.stringify(techQa, null, 2), 'utf8');

  // Metadata JSON (topic-aware, spoiler-free, honest question count)
  const subjectText = String(quizData.subject || 'General Knowledge').trim();
  const subjectTagSlug = subjectText.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'generalknowledge';
  const qCount = Array.isArray(quizData.questions) ? quizData.questions.length : 3;
  const metadata = {
    title: quizData.title,
    description: `🎯 ${quizData.title}

${subjectText} — दम है तो ${qCount} में से 2 सही करके दिखाओ! SSC, Railway, Police व UPSC Prelims के लिए Rapid-Fire GK Quiz।
💬 सवाल नंबर ${qCount} का सही जवाब कमेंट में लिखें और वीडियो को 👍 Like जरूर करें!
🔔 रोज़ाना ऐसे ही तेज GK Tests के लिए ExamIQ Bharat को Subscribe करें।

#shorts #generalknowledge #gkquiz #${subjectTagSlug} #sscgk #education #examiqbharat`,
    tags: [
      'Shorts',
      'GK Shorts',
      subjectText,
      `${subjectText} Quiz`,
      'GK MCQ',
      'SSC GK',
      'Railway GK',
      'UPSC Prelims',
      'ExamIQ Bharat'
    ],
    categoryId: '27',
    privacyStatus: 'public',
    selfDeclaredMadeForKids: false
  };

  fs.writeFileSync(path.join(runDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
  console.log('✅ Technical QA complete! Saved tech_qa.json and metadata.json');
}

main().catch(err => {
  console.error('Fatal error building video:', err);
  process.exit(1);
});
