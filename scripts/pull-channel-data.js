const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const { google } = require('googleapis');
const { CredentialManager } = require('../utils/credential-manager');

function parseIsoDuration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function escapeCsv(str) {
  if (str === null || str === undefined) return '""';
  const val = String(str).replace(/"/g, '""').replace(/\r?\n/g, ' ');
  return `"${val}"`;
}

async function main() {
  console.log('=== PULLING DATA FOR EXAMIQ BHARAT ===');
  const cm = new CredentialManager();
  await cm.initialize();
  const auth = cm.getYouTubeAuth();
  const yt = google.youtube({ version: 'v3', auth });

  // 1. Fetch all uploads
  const channelRes = await yt.channels.list({ part: 'contentDetails,snippet,statistics', mine: true });
  const channel = channelRes.data.items[0];
  console.log(`Channel: ${channel.snippet.title} (${channel.id})`);
  console.log(`Total Channel Views: ${channel.statistics.viewCount}, Subs: ${channel.statistics.subscriberCount}, Videos: ${channel.statistics.videoCount}`);

  const uploadsId = channel.contentDetails.relatedPlaylists.uploads;
  let rawVideos = [];
  let nextPageToken = null;

  do {
    const listRes = await yt.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: uploadsId,
      maxResults: 50,
      pageToken: nextPageToken
    });
    for (const item of listRes.data.items) {
      rawVideos.push({
        id: item.contentDetails.videoId,
        title: item.snippet.title,
        publishedAt: item.snippet.publishedAt,
        description: item.snippet.description
      });
    }
    nextPageToken = listRes.data.nextPageToken;
  } while (nextPageToken);

  console.log(`Retrieved ${rawVideos.length} video records from playlist`);

  // Batch get video details & stats (up to 50 per batch)
  const videoDetails = new Map();
  for (let i = 0; i < rawVideos.length; i += 50) {
    const batch = rawVideos.slice(i, i + 50);
    const ids = batch.map(v => v.id).join(',');
    const detailsRes = await yt.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: ids
    });
    for (const item of detailsRes.data.items) {
      videoDetails.set(item.id, item);
    }
  }

  // 2. Fetch local generation metadata from SQLite DB
  const dbPath = path.resolve('data/youtube_automation.db');
  const localDbData = new Map();
  
  if (fs.existsSync(dbPath)) {
    const db = new sqlite3.Database(dbPath);
    await new Promise((resolve) => {
      db.all(`
        SELECT 
          ps.youtube_id, ps.title, ps.publish_time, ps.metadata,
          p.strategy, p.script, p.seo, p.assets
        FROM publish_schedule ps
        LEFT JOIN productions p ON ps.production_id = p.id
      `, (err, rows) => {
        if (!err && rows) {
          for (const row of rows) {
            if (row.youtube_id) {
              localDbData.set(row.youtube_id, row);
            }
          }
        }
        resolve();
      });
    });
    db.close();
  }

  // Also read any script json files in data/
  const dataScripts = new Map();
  const dataDir = path.resolve('data');
  const files = fs.readdirSync(dataDir);
  for (const f of files) {
    if (f.endsWith('_script.json')) {
      try {
        const content = JSON.parse(fs.readFileSync(path.join(dataDir, f), 'utf8'));
        if (content.title) {
          dataScripts.set(content.title.trim().toLowerCase(), content);
        }
      } catch (e) {}
    }
  }

  // 3. Try YouTube Analytics API if possible
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth });
  const analyticsByVideo = new Map();
  let analyticsApiAvailable = false;
  let analyticsApiError = null;

  try {
    const today = new Date().toISOString().split('T')[0];
    const reportRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: '2026-09-01',
      endDate: today,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
      dimensions: 'video',
      maxResults: 200,
      sort: '-views'
    });
    if (reportRes.data.rows) {
      analyticsApiAvailable = true;
      for (const row of reportRes.data.rows) {
        analyticsByVideo.set(row[0], {
          views: row[1],
          watchTimeMinutes: row[2],
          avgViewDuration: row[3],
          apv: row[4],
          subscribersGained: row[5]
        });
      }
      console.log(`YouTube Analytics API returned metrics for ${analyticsByVideo.size} videos`);
    }
  } catch (err) {
    analyticsApiError = err.message;
    console.log(`YouTube Analytics API not available: ${err.message}`);
  }

  // 4. Construct complete joined video records
  const joinedRows = [];
  for (const raw of rawVideos) {
    const detail = videoDetails.get(raw.id);
    if (!detail) continue;

    const stats = detail.statistics || {};
    const snippet = detail.snippet || {};
    const content = detail.contentDetails || {};
    const durSec = parseIsoDuration(content.duration);
    const isShort = durSec > 0 && durSec <= 65; // YouTube considers <= 60s vertical as Short, allow minor padding buffer

    // Local DB metadata
    const local = localDbData.get(raw.id);
    let strategy = null, script = null, seo = null;
    try { if (local?.strategy) strategy = JSON.parse(local.strategy); } catch(e){}
    try { if (local?.script) script = JSON.parse(local.script); } catch(e){}
    try { if (local?.seo) seo = JSON.parse(local.seo); } catch(e){}

    // Fallback match by title in dataScripts
    const matchedScript = dataScripts.get(snippet.title?.trim().toLowerCase());
    const finalScript = script || matchedScript;

    const questionCount = finalScript?.quiz?.totalQuestions ||
      finalScript?.quiz?.questions?.length ||
      (snippet.title?.match(/top\s*(\d+)/i) ? Number(snippet.title.match(/top\s*(\d+)/i)[1]) : (isShort ? 5 : 50));

    const topic = strategy?.topic || finalScript?.topic || finalScript?.quiz?.subject || snippet.title;
    const hookText = finalScript?.hook?.text || finalScript?.hook || '';
    const voiceSpeed = '1.0x';
    const thumbnailTemplate = isShort ? 'clean_typography_short' : 'split_or_widescreen_card';

    // Analytics API data (if enabled)
    const analytics = analyticsByVideo.get(raw.id);
    const views = Number(stats.viewCount || 0);
    const likes = Number(stats.likeCount || 0);
    const comments = Number(stats.commentCount || 0);
    const avgViewDuration = analytics ? analytics.avgViewDuration : '';
    const apv = analytics ? analytics.apv : '';
    const subsGained = analytics ? analytics.subscribersGained : '';

    joinedRows.push({
      video_id: raw.id,
      title: snippet.title,
      publish_datetime: snippet.publishedAt,
      video_type: isShort ? 'SHORT' : 'LONG',
      iso_duration: content.duration,
      duration_seconds: durSec,
      views,
      likes,
      comments,
      impressions: '', // Available via Studio CSV or Analytics API with impressions metric
      ctr_percent: '', // Available via Studio CSV
      avg_view_duration_seconds: avgViewDuration,
      apv_percent: apv,
      viewed_vs_swiped_percent: '', // Studio Shorts Tab only
      subscribers_gained: subsGained,
      question_count: questionCount,
      topic,
      hook_text: hookText,
      thumbnail_template: thumbnailTemplate,
      voice_speed: voiceSpeed,
      category_id: snippet.categoryId || '27',
      tags_count: (snippet.tags || []).length,
      tags: (snippet.tags || []).join(' | ')
    });
  }

  // Sort by publish datetime descending
  joinedRows.sort((a, b) => new Date(b.publish_datetime) - new Date(a.publish_datetime));

  // Write CSV
  const headers = [
    'video_id', 'title', 'publish_datetime', 'video_type', 'iso_duration', 'duration_seconds',
    'views', 'likes', 'comments', 'impressions', 'ctr_percent', 'avg_view_duration_seconds',
    'apv_percent', 'viewed_vs_swiped_percent', 'subscribers_gained', 'question_count',
    'topic', 'hook_text', 'thumbnail_template', 'voice_speed', 'category_id', 'tags_count', 'tags'
  ];

  const csvLines = [headers.join(',')];
  for (const r of joinedRows) {
    const line = [
      escapeCsv(r.video_id),
      escapeCsv(r.title),
      escapeCsv(r.publish_datetime),
      escapeCsv(r.video_type),
      escapeCsv(r.iso_duration),
      r.duration_seconds,
      r.views,
      r.likes,
      r.comments,
      escapeCsv(r.impressions),
      escapeCsv(r.ctr_percent),
      escapeCsv(r.avg_view_duration_seconds),
      escapeCsv(r.apv_percent),
      escapeCsv(r.viewed_vs_swiped_percent),
      escapeCsv(r.subscribers_gained),
      r.question_count,
      escapeCsv(r.topic),
      escapeCsv(r.hook_text),
      escapeCsv(r.thumbnail_template),
      escapeCsv(r.voice_speed),
      escapeCsv(r.category_id),
      r.tags_count,
      escapeCsv(r.tags)
    ];
    csvLines.push(line.join(','));
  }

  const outPath = path.resolve('analytics/videos.csv');
  fs.writeFileSync(outPath, csvLines.join('\n'), 'utf8');
  console.log(`\n✅ Saved ${joinedRows.length} videos to ${outPath}`);

  // Summary stats
  const shorts = joinedRows.filter(r => r.video_type === 'SHORT');
  const longs = joinedRows.filter(r => r.video_type === 'LONG');
  console.log(`Shorts count: ${shorts.length}, Long videos count: ${longs.length}`);
  console.log('Shorts views sum:', shorts.reduce((acc, r) => acc + r.views, 0));
  console.log('Long views sum:', longs.reduce((acc, r) => acc + r.views, 0));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
