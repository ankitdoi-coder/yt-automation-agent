const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { CredentialManager } = require('../../utils/credential-manager');
const { Logger } = require('../../utils/logger');

const logger = new Logger('AutopilotCollect');

function parseIsoDuration(duration) {
  if (!duration) return 0;
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return (hours * 3600) + (minutes * 60) + seconds;
}

function escapeCsvField(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function ensureHistoryCsvHeader(historyFilePath) {
  if (!fs.existsSync(historyFilePath) || fs.statSync(historyFilePath).size === 0) {
    const headers = [
      'snapshot_date',
      'video_id',
      'published_at',
      'is_short',
      'duration_sec',
      'views',
      'watch_minutes',
      'avd_sec',
      'apv_pct',
      'likes',
      'comments',
      'subs_gained',
      'is_mature'
    ].join(',');
    fs.writeFileSync(historyFilePath, headers + '\n', 'utf8');
  }
}

async function collectAnalytics(options = {}) {
  const lookbackDays = parseInt(options.lookbackDays || process.env.LOOKBACK_DAYS || '28', 10);
  const dryRun = options.dryRun === true || process.argv.includes('--dry-run');
  const now = new Date();
  const snapshotDate = now.toISOString().slice(0, 10);
  const startDate = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const endDate = snapshotDate;

  logger.info(`Starting analytics collection (Lookback: ${lookbackDays} days, Range: ${startDate} to ${endDate})`);

  let auth;
  try {
    const cm = new CredentialManager();
    await cm.initialize();
    auth = cm.getYouTubeAuth();
  } catch (err) {
    logger.error(`Failed to initialize credentials for YouTube: ${err.message}`);
    throw err;
  }

  const yt = google.youtube({ version: 'v3', auth });
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

  // 1. Channel profile and uploads playlist
  const channelRes = await yt.channels.list({ part: 'snippet,statistics,contentDetails', mine: true });
  if (!channelRes.data.items?.length) {
    throw new Error('No channel found for authenticated credentials');
  }
  const channelItem = channelRes.data.items[0];
  const uploadsPlaylistId = channelItem.contentDetails.relatedPlaylists.uploads;

  const channelStats = {
    channelId: channelItem.id,
    title: channelItem.snippet.title,
    subscriberCount: parseInt(channelItem.statistics.subscriberCount || '0', 10),
    viewCount: parseInt(channelItem.statistics.viewCount || '0', 10),
    videoCount: parseInt(channelItem.statistics.videoCount || '0', 10)
  };

  // 2. Fetch all uploads up to 50
  const playlistRes = await yt.playlistItems.list({
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: 50
  });

  const playlistItems = playlistRes.data.items || [];
  const videoIds = playlistItems.map(item => item.contentDetails.videoId);

  // 3. Batch fetch video snippet & stats
  let videoItems = [];
  if (videoIds.length > 0) {
    const videoDetailsRes = await yt.videos.list({
      part: 'snippet,statistics,contentDetails',
      id: videoIds.join(',')
    });
    videoItems = videoDetailsRes.data.items || [];
  }

  // 4. Query YouTube Analytics API v2
  const analyticsByVideo = new Map();
  let trafficSources = [];
  let ageDemographics = [];
  let dailyTrends = [];

  try {
    const videoStatsRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
      dimensions: 'video',
      maxResults: 100,
      sort: '-views'
    });

    if (videoStatsRes.data.rows) {
      for (const row of videoStatsRes.data.rows) {
        analyticsByVideo.set(row[0], {
          views: parseInt(row[1] || '0', 10),
          watchMinutes: parseFloat(Number(row[2] || 0).toFixed(1)),
          avdSec: parseFloat(Number(row[3] || 0).toFixed(1)),
          apvPct: parseFloat(Number(row[4] || 0).toFixed(1)),
          subsGained: parseInt(row[5] || '0', 10)
        });
      }
    }

    // Traffic sources
    const trafficRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'insightTrafficSourceType',
      sort: '-views'
    });
    trafficSources = (trafficRes.data.rows || []).map(r => ({
      source: r[0],
      views: parseInt(r[1] || '0', 10),
      watchMinutes: parseFloat(Number(r[2] || 0).toFixed(1))
    }));

    // Demographics
    const ageRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'viewerPercentage',
      dimensions: 'ageGroup',
      sort: '-viewerPercentage'
    });
    ageDemographics = (ageRes.data.rows || []).map(r => ({
      ageGroup: r[0],
      viewerPercentage: parseFloat(Number(r[1] || 0).toFixed(1))
    }));

    // Daily trends
    const dailyRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
      dimensions: 'day',
      sort: 'day'
    });
    dailyTrends = (dailyRes.data.rows || []).map(r => ({
      day: r[0],
      views: parseInt(r[1] || '0', 10),
      watchMinutes: parseFloat(Number(r[2] || 0).toFixed(1)),
      avdSec: parseFloat(Number(r[3] || 0).toFixed(1)),
      apvPct: parseFloat(Number(r[4] || 0).toFixed(1)),
      subsGained: parseInt(r[5] || '0', 10)
    }));
  } catch (analyticsErr) {
    logger.warn(`YouTube Analytics API call encountered issue: ${analyticsErr.message}`);
  }

  // 5. Structure per-video combined dataset
  const matureThresholdHours = 72; // YouTube data lag is ~48-72h
  const videos = videoItems.map(v => {
    const pubDate = new Date(v.snippet.publishedAt);
    const ageHours = Math.max(0, (now.getTime() - pubDate.getTime()) / (1000 * 60 * 60));
    const isMature = ageHours >= matureThresholdHours;
    const durationSec = parseIsoDuration(v.contentDetails?.duration);
    const isShort = durationSec <= 60;
    const statsFromApi = analyticsByVideo.get(v.id) || {};

    const publicViews = parseInt(v.statistics?.viewCount || '0', 10);
    const apiViews = statsFromApi.views ?? publicViews;

    return {
      id: v.id,
      title: v.snippet.title,
      description: v.snippet.description || '',
      publishedAt: pubDate.toISOString(),
      ageHours: parseFloat(ageHours.toFixed(1)),
      isMature,
      durationSec,
      isShort,
      views: apiViews,
      publicViews,
      watchMinutes: statsFromApi.watchMinutes ?? 0,
      avdSec: statsFromApi.avdSec ?? 0,
      apvPct: statsFromApi.apvPct ?? 0,
      likes: parseInt(v.statistics?.likeCount || '0', 10),
      comments: parseInt(v.statistics?.commentCount || '0', 10),
      subsGained: statsFromApi.subsGained ?? 0,
      tags: v.snippet.tags || []
    };
  });

  const dataset = {
    collectedAt: now.toISOString(),
    snapshotDate,
    lookbackDays,
    channel: channelStats,
    trafficSources,
    ageDemographics,
    dailyTrends,
    videos
  };

  // 6. Cache raw JSON in analytics/raw/
  const rawDir = path.resolve(__dirname, '..', '..', 'analytics', 'raw');
  if (!fs.existsSync(rawDir)) {
    fs.mkdirSync(rawDir, { recursive: true });
  }
  const rawFilePath = path.join(rawDir, `analytics-raw-${snapshotDate}.json`);
  fs.writeFileSync(rawFilePath, JSON.stringify(dataset, null, 2), 'utf8');
  logger.info(`Cached raw analytics data to ${rawFilePath}`);

  // 7. Append to analytics/history.csv (Never overwrite)
  const historyFilePath = path.resolve(__dirname, '..', '..', 'analytics', 'history.csv');
  ensureHistoryCsvHeader(historyFilePath);

  let existingHistoryKeys = new Set();
  if (fs.existsSync(historyFilePath)) {
    const lines = fs.readFileSync(historyFilePath, 'utf8').trim().split('\n');
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 2) {
        existingHistoryKeys.add(`${parts[0]}_${parts[1]}`); // snapshotDate_videoId
      }
    }
  }

  let appendedCount = 0;
  for (const v of videos) {
    const key = `${snapshotDate}_${v.id}`;
    if (!existingHistoryKeys.has(key)) {
      const row = [
        escapeCsvField(snapshotDate),
        escapeCsvField(v.id),
        escapeCsvField(v.publishedAt),
        escapeCsvField(v.isShort ? '1' : '0'),
        escapeCsvField(v.durationSec),
        escapeCsvField(v.views),
        escapeCsvField(v.watchMinutes),
        escapeCsvField(v.avdSec),
        escapeCsvField(v.apvPct),
        escapeCsvField(v.likes),
        escapeCsvField(v.comments),
        escapeCsvField(v.subsGained),
        escapeCsvField(v.isMature ? '1' : '0')
      ].join(',');
      fs.appendFileSync(historyFilePath, row + '\n', 'utf8');
      existingHistoryKeys.add(key);
      appendedCount++;
    }
  }
  logger.info(`Appended ${appendedCount} new records to ${historyFilePath}`);

  return dataset;
}

if (require.main === module) {
  collectAnalytics().then(() => {
    logger.info('Collection complete');
    process.exit(0);
  }).catch(err => {
    logger.error(`Collection failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  collectAnalytics,
  parseIsoDuration
};
