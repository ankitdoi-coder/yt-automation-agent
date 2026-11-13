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

google.options({ timeout: 25000, agent: ipv4Agent });

function parseIsoDuration(iso) {
  if (!iso) return 0;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);
  return h * 3600 + m * 60 + s;
}

function classifyTitleStyle(title) {
  const hasDevanagari = /[\u0900-\u097F]/.test(title || '');
  if (hasDevanagari) return title.length > 50 ? 'hindi_long' : 'hindi_short';
  return (title || '').length <= 50 ? 'english_under_50_chars' : 'english_over_50_chars';
}

function toIstHour(isoDate) {
  if (!isoDate) return null;
  const utc = new Date(isoDate);
  const ist = new Date(utc.getTime() + 5.5 * 3600 * 1000);
  return ist.getUTCHours();
}

function classifyCohort(video) {
  const desc = video.description || '';
  if (video.id === 'c-cxf09GBCs') return 'variant_ytgk_rapid';
  if (video.durationSeconds <= 35 && (desc.includes('Comment your score below to get pinned!') || desc.includes('दम है तो 3 में से 2 सही करके दिखाओ'))) return 'variant_ytgk_rapid';
  if (/use this audio/i.test(video.title) || /humen blood/i.test(video.title)) return 'sound_trend_micro';
  if (video.publishedAt && /T(03|14):00:\d{2}Z$/.test(video.publishedAt)) return 'scheduled_autopilot';
  if (video.id === 'PronohAKFDk' || video.id === '4wunaAHed0M') return 'unprivated_backlog';
  return 'historical_short';
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

async function safeAnalyticsQuery(ytAnalytics, params) {
  try {
    const res = await ytAnalytics.reports.query(params);
    return {
      ok: true,
      headers: (res.data.columnHeaders || []).map(h => h.name),
      rows: res.data.rows || []
    };
  } catch (err) {
    return { ok: false, error: err.message, headers: [], rows: [] };
  }
}

async function ensureYtGkTables(db) {
  const statements = [
    `CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      variable TEXT NOT NULL,
      control TEXT NOT NULL,
      variant TEXT NOT NULL,
      metric TEXT NOT NULL,
      min_sample INTEGER NOT NULL DEFAULT 5,
      start TEXT NOT NULL,
      decision_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      result TEXT DEFAULT 'needs more data',
      notes TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS video_metrics (
      id TEXT PRIMARY KEY,
      video_id TEXT NOT NULL,
      date TEXT NOT NULL,
      measurement_window TEXT NOT NULL DEFAULT 'latest',
      views INTEGER DEFAULT 0,
      estimated_minutes_watched REAL DEFAULT 0,
      average_view_duration REAL DEFAULT 0,
      average_view_percentage REAL DEFAULT 0,
      likes INTEGER DEFAULT 0,
      comments INTEGER DEFAULT 0,
      shares INTEGER DEFAULT 0,
      subscribers_gained INTEGER DEFAULT 0,
      traffic_sources TEXT DEFAULT '{}',
      source TEXT DEFAULT 'youtube_api',
      captured_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(video_id, date, measurement_window)
    )`,
    `CREATE TABLE IF NOT EXISTS video_features (
      video_id TEXT PRIMARY KEY,
      title TEXT,
      topic TEXT,
      subtopic TEXT,
      q_count INTEGER,
      duration_s INTEGER,
      title_style TEXT,
      title_len INTEGER,
      hook_type TEXT,
      voice_speed REAL,
      bgm TEXT,
      upload_hour_ist INTEGER,
      cohort TEXT,
      published_at TEXT,
      privacy_status TEXT,
      made_for_kids INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS topic_backlog (
      id TEXT PRIMARY KEY,
      cluster TEXT NOT NULL,
      subtopic TEXT NOT NULL UNIQUE,
      title_idea TEXT,
      cluster_type TEXT DEFAULT 'core',
      priority INTEGER DEFAULT 50,
      status TEXT NOT NULL DEFAULT 'ready',
      last_used_date TEXT,
      last_video_id TEXT,
      notes TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`
  ];
  for (const sql of statements) {
    await db.executeQuery(sql);
  }
}

async function main() {
  const startDate = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);

  const cm = new CredentialManager();
  await cm.initialize();
  const auth = await ensureValidAuth(cm);
  const yt = cm.getYouTubeClient();
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

  console.error('[1/5] Fetching channel & recent 20 uploads metadata...');
  const chanRes = await yt.channels.list({ part: 'snippet,statistics,contentDetails', mine: true });
  const channel = chanRes.data.items[0];
  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

  const plRes = await yt.playlistItems.list({
    part: 'contentDetails,snippet',
    playlistId: uploadsPlaylistId,
    maxResults: 20
  });
  const videoIds = plRes.data.items.map(i => i.contentDetails.videoId);
  const vidRes = await yt.videos.list({
    part: 'snippet,statistics,contentDetails,status',
    id: videoIds.join(',')
  });

  const recentVideos = vidRes.data.items.map(v => {
    const durationSeconds = parseIsoDuration(v.contentDetails.duration);
    const base = {
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description || '',
      publishedAt: v.snippet.publishedAt,
      durationIso: v.contentDetails.duration,
      durationSeconds,
      privacyStatus: v.status.privacyStatus,
      uploadStatus: v.status.uploadStatus,
      madeForKids: Boolean(v.status.madeForKids),
      views: Number(v.statistics.viewCount || 0),
      likes: Number(v.statistics.likeCount || 0),
      comments: Number(v.statistics.commentCount || 0),
      titleStyle: classifyTitleStyle(v.snippet.title),
      titleLength: (v.snippet.title || '').length,
      uploadHourIst: toIstHour(v.snippet.publishedAt)
    };
    base.cohort = classifyCohort(base);
    return base;
  });

  console.error('[2/5] Querying Analytics API v2 (videos, daily lag, traffic sources)...');
  const [videoAnalytics, dailyAnalytics, overallTraffic, cCxfAnalytics, cCxfTraffic] = await Promise.all([
    safeAnalyticsQuery(ytAnalytics, {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
      dimensions: 'video',
      maxResults: 100,
      sort: '-views'
    }),
    safeAnalyticsQuery(ytAnalytics, {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
      dimensions: 'day',
      sort: 'day'
    }),
    safeAnalyticsQuery(ytAnalytics, {
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'insightTrafficSourceType',
      sort: '-views'
    }),
    safeAnalyticsQuery(ytAnalytics, {
      ids: 'channel==MINE',
      startDate: '2026-11-10',
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
      dimensions: 'video',
      filters: 'video==c-cxf09GBCs'
    }),
    safeAnalyticsQuery(ytAnalytics, {
      ids: 'channel==MINE',
      startDate: '2026-11-10',
      endDate,
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'insightTrafficSourceType',
      filters: 'video==c-cxf09GBCs'
    })
  ]);

  const analyticsByVideo = new Map();
  for (const row of videoAnalytics.rows) {
    analyticsByVideo.set(row[0], {
      views: Number(row[1] || 0),
      estimatedMinutesWatched: Number(row[2] || 0),
      averageViewDuration: Number(row[3] || 0),
      averageViewPercentage: Number(row[4] || 0),
      likes: Number(row[5] || 0),
      comments: Number(row[6] || 0),
      shares: Number(row[7] || 0),
      subscribersGained: Number(row[8] || 0)
    });
  }

  console.error('[3/5] Checking comments on c-cxf09GBCs...');
  let cCxfComments = [];
  try {
    const cRes = await yt.commentThreads.list({
      part: 'snippet',
      videoId: 'c-cxf09GBCs',
      maxResults: 20
    });
    cCxfComments = (cRes.data.items || []).map(item => ({
      id: item.id,
      author: item.snippet.topLevelComment.snippet.authorDisplayName,
      text: item.snippet.topLevelComment.snippet.textDisplay,
      publishedAt: item.snippet.topLevelComment.snippet.publishedAt,
      likeCount: item.snippet.topLevelComment.snippet.likeCount
    }));
  } catch (err) {
    cCxfComments = [{ error: err.message }];
  }

  console.error('[4/5] Syncing experiments, video_metrics, video_features, topic_backlog into SQLite...');
  const db = new Database();
  await db.initialize();
  await ensureYtGkTables(db);

  // Inspect existing growth_experiments count for completeness
  const existingGrowthExp = await db.getAllRows('SELECT id, title, status FROM growth_experiments LIMIT 10').catch(() => []);

  // Upsert active experiment exp_20261109_rapid_pacing
  const expSpec = JSON.parse(fs.readFileSync(path.resolve('runs/2026-11-09/experiment.json'), 'utf8'));
  const variantVideos = recentVideos.filter(v => v.cohort === 'variant_ytgk_rapid');
  const variantCount = variantVideos.length;
  const variantSummaryText = variantVideos.map(v => `${v.id}=${v.views}v`).join(', ') || 'none';
  const experimentResult = variantCount < (expSpec.sample_size_target || 5) ? 'needs more data' : 'ready_for_review';
  const experimentNotes = [
    `Variant n=${variantCount}/${expSpec.sample_size_target || 5} true yt-gk rapid builds (${variantSummaryText}) synced at ${new Date().toISOString()}.`,
    'Analytics API v2 retention/APV rows currently lag behind 2026-11-11 uploads; awaiting T+48h Analytics sync and 4 more variant uploads before any keep/drop call.',
    'Detected automated GitHub Actions / scheduled uploads at 03:00Z & 14:00Z alongside experiment.'
  ].join(' ');

  await db.executeQuery(
    `INSERT INTO experiments (id, variable, control, variant, metric, min_sample, start, decision_date, status, result, notes, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       variable = excluded.variable,
       control = excluded.control,
       variant = excluded.variant,
       metric = excluded.metric,
       min_sample = excluded.min_sample,
       start = excluded.start,
       decision_date = excluded.decision_date,
       status = excluded.status,
       result = excluded.result,
       notes = excluded.notes,
       updated_at = CURRENT_TIMESTAMP`,
    [
      expSpec.experiment_id,
      expSpec.variable,
      JSON.stringify(expSpec.control),
      JSON.stringify(expSpec.variant),
      `${expSpec.primary_metric} (>=80%) & ${expSpec.secondary_metric} (>=1000)`,
      expSpec.sample_size_target || 5,
      expSpec.start_date,
      expSpec.decision_date,
      'active',
      experimentResult,
      experimentNotes
    ]
  );

  // Store video_features & video_metrics for recent 20 videos
  const today = new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
  for (const v of recentVideos) {
    const a = analyticsByVideo.get(v.id);
    const hoursOld = Math.max(0.1, (Date.now() - new Date(v.publishedAt).getTime()) / 3600000);
    let windowLabel = `T+${Math.round(hoursOld)}h`;
    if (hoursOld >= 68 && hoursOld <= 78) windowLabel = 'T+72h';
    else if (hoursOld >= 20 && hoursOld <= 30) windowLabel = 'T+24h';
    else if (hoursOld < 6) windowLabel = 'T+2h';

    const topicGuess = /polity/i.test(v.title)
      ? 'Indian Polity'
      : /history|गुप्त/i.test(v.title)
        ? 'Indian History'
        : /science|विज्ञान|blood/i.test(v.title)
          ? 'General Science'
          : /audio/i.test(v.title)
            ? 'Sound Trend'
            : 'Static GK';

    const qCountGuess = v.id === 'c-cxf09GBCs'
      ? 3
      : (/Top 3/i.test(v.title) ? 3 : (/Top 5/i.test(v.title) ? 5 : null));

    await db.executeQuery(
      `INSERT INTO video_features (video_id, title, topic, subtopic, q_count, duration_s, title_style, title_len, hook_type, voice_speed, bgm, upload_hour_ist, cohort, published_at, privacy_status, made_for_kids, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(video_id) DO UPDATE SET
         title = excluded.title,
         duration_s = excluded.duration_s,
         title_style = excluded.title_style,
         title_len = excluded.title_len,
         upload_hour_ist = excluded.upload_hour_ist,
         cohort = excluded.cohort,
         privacy_status = excluded.privacy_status,
         updated_at = CURRENT_TIMESTAMP`,
      [
        v.id,
        v.title,
        topicGuess,
        v.id === 'c-cxf09GBCs' ? 'Human Body & Biology Essentials' : null,
        qCountGuess,
        v.durationSeconds,
        v.titleStyle,
        v.titleLength,
        v.id === 'c-cxf09GBCs' ? 'challenge_3_of_2' : null,
        v.id === 'c-cxf09GBCs' ? 1.0 : null,
        v.id === 'c-cxf09GBCs' ? 'intense_suspense_beat' : null,
        v.uploadHourIst,
        v.cohort,
        v.publishedAt,
        v.privacyStatus,
        v.madeForKids ? 1 : 0
      ]
    );

    await db.executeQuery(
      `INSERT INTO video_metrics (id, video_id, date, measurement_window, views, estimated_minutes_watched, average_view_duration, average_view_percentage, likes, comments, shares, subscribers_gained, traffic_sources, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(video_id, date, measurement_window) DO UPDATE SET
         views = excluded.views,
         estimated_minutes_watched = excluded.estimated_minutes_watched,
         average_view_duration = excluded.average_view_duration,
         average_view_percentage = excluded.average_view_percentage,
         likes = excluded.likes,
         comments = excluded.comments,
         shares = excluded.shares,
         subscribers_gained = excluded.subscribers_gained,
         traffic_sources = excluded.traffic_sources,
         captured_at = CURRENT_TIMESTAMP`,
      [
        `${v.id}_${today}_${windowLabel}`,
        v.id,
        today,
        windowLabel,
        Math.max(v.views, a ? a.views : 0),
        a ? a.estimatedMinutesWatched : 0,
        a ? a.averageViewDuration : 0,
        a ? a.averageViewPercentage : 0,
        Math.max(v.likes, a ? a.likes : 0),
        Math.max(v.comments, a ? a.comments : 0),
        a ? a.shares : 0,
        a ? a.subscribersGained : 0,
        JSON.stringify(overallTraffic.rows || []),
        a ? 'data_api_plus_analytics_v2' : 'data_api_v3_only_analytics_pending'
      ]
    );
  }

  // Seed & update topic_backlog (10-day non-repeat enforced)
  const backlogItems = [
    ['tb_sci_human_body', 'General Science', 'Human Body & Biology Essentials', 'General Science Quiz | Human Body Top 3 #shorts', 'core', 95, 'used', '2026-11-11', 'c-cxf09GBCs', 'Day 1 exp_20261109_rapid_pacing variant (1,005 views in 16h)'],
    ['tb_pol_articles', 'Indian Polity', 'Fundamental Rights & Key Constitutional Articles', 'Indian Polity Quiz | Important Articles #shorts', 'core', 92, 'ready', null, null, '70% core cluster - Day 2 rapid pacing variant'],
    ['tb_hist_battles', 'Indian History', 'Important Battles & Treaties of India', 'Indian History Quiz | Major Battles #shorts', 'core', 90, 'ready', null, null, '70% core cluster - Day 3 rapid pacing variant'],
    ['tb_sci_vitamins', 'General Science', 'Vitamins, Deficiency Diseases & SI Units', 'General Science Quiz | Vitamins & Diseases #shorts', 'core', 88, 'ready', null, null, '10d separation from Human Body subtopic'],
    ['tb_geo_rivers', 'Indian Geography', 'Major Rivers, Dams & Tributaries', 'Geography GK Quiz | Rivers & Dams #shorts', 'explore', 84, 'ready', null, null, '30% explore cluster - H1 single-topic test'],
    ['tb_static_parks', 'Static GK', 'National Parks & Tiger Reserves of India', 'Static GK Quiz | National Parks #shorts', 'explore', 85, 'ready', null, null, 'H1 single-topic test candidate'],
    ['tb_static_dances', 'Static GK', 'Classical & Folk Dances of Indian States', 'Static GK Quiz | Folk Dances #shorts', 'explore', 83, 'ready', null, null, 'H1/H3 Static GK candidate'],
    ['tb_sci_physics', 'General Science', 'Light, Sound & Chemical Formulas', 'General Science Quiz | Physics Formulas #shorts', 'core', 82, 'ready', null, null, 'SSC/Railway high-search topic'],
    ['tb_pol_amendments', 'Indian Polity', 'Major Constitutional Amendments (42nd, 44th, 73rd, 86th)', 'Indian Polity Quiz | Amendments MCQ #shorts', 'core', 80, 'ready', null, null, 'Core exam staple'],
    ['tb_hist_modern', 'Indian History', '1857 Revolt & Gandhian Era Movements', 'Modern History Quiz | Freedom Struggle #shorts', 'core', 79, 'ready', null, null, 'High SSC/Police repeat topic']
  ];

  for (const item of backlogItems) {
    await db.executeQuery(
      `INSERT INTO topic_backlog (id, cluster, subtopic, title_idea, cluster_type, priority, status, last_used_date, last_video_id, notes, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(subtopic) DO UPDATE SET
         status = CASE WHEN topic_backlog.status = 'used' THEN 'used' ELSE excluded.status END,
         last_used_date = COALESCE(excluded.last_used_date, topic_backlog.last_used_date),
         last_video_id = COALESCE(excluded.last_video_id, topic_backlog.last_video_id),
         notes = excluded.notes,
         updated_at = CURRENT_TIMESTAMP`,
      item
    );
  }

  const dbSummary = {
    experimentsCount: (await db.getRow('SELECT COUNT(*) as c FROM experiments')).c,
    videoMetricsCount: (await db.getRow('SELECT COUNT(*) as c FROM video_metrics')).c,
    videoFeaturesCount: (await db.getRow('SELECT COUNT(*) as c FROM video_features')).c,
    topicBacklogCount: (await db.getRow('SELECT COUNT(*) as c FROM topic_backlog')).c,
    legacyGrowthExperimentsCount: existingGrowthExp.length
  };

  await db.close();

  console.error('[5/5] Writing updated runs/2026-11-12/experiment_review.json...');
  fs.mkdirSync(path.resolve('runs/2026-11-12'), { recursive: true });
  const reviewPayload = {
    checkedAt: new Date().toISOString(),
    dateRange: { startDate, endDate },
    channel: {
      id: channel.id,
      title: channel.snippet.title,
      viewCount: Number(channel.statistics.viewCount || 0),
      subscriberCount: Number(channel.statistics.subscriberCount || 0),
      videoCount: Number(channel.statistics.videoCount || 0)
    },
    recentVideos: recentVideos.map(v => ({
      ...v,
      analytics: analyticsByVideo.get(v.id) || null
    })),
    dailyAnalytics,
    overallTraffic,
    cCxf09GBCsCheck: {
      analytics: cCxfAnalytics,
      traffic: cCxfTraffic,
      comments: cCxfComments
    },
    experimentStatus: {
      experimentId: expSpec.experiment_id,
      decision: experimentResult,
      reason: 'variant_sample_lt_5',
      variantCount,
      minSampleRequired: expSpec.sample_size_target || 5,
      decisionDate: expSpec.decision_date
    },
    dbSummary
  };

  fs.writeFileSync(
    path.resolve('runs/2026-11-12/experiment_review.json'),
    JSON.stringify(reviewPayload, null, 2)
  );

  console.error('DONE! DB Summary:', JSON.stringify(dbSummary));
  console.error('Daily Analytics latest date:', dailyAnalytics.rows.length ? dailyAnalytics.rows[dailyAnalytics.rows.length - 1] : 'none');
  console.error('Traffic Sources (14d):', JSON.stringify(overallTraffic));
  console.error('c-cxf09GBCs Analytics check:', JSON.stringify(cCxfAnalytics));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
