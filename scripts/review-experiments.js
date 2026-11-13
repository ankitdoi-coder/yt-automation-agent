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

google.options({ timeout: 25000, agent: ipv4Agent });

async function main() {
  console.log = (...args) => process.stderr.write(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n');
  console.error('=== YT-GK EXPERIMENTS REVIEW ===');
  const cm = new CredentialManager();
  await cm.initialize();
  const auth = cm.getYouTubeAuth();
  if (auth && auth.credentials && auth.credentials.refresh_token) {
    const exp = auth.credentials.expiry_date || 0;
    console.error(`[auth] expiry=${exp ? new Date(exp).toISOString() : 'none'}, now=${new Date().toISOString()}`);
    if (!auth.credentials.access_token || exp <= Date.now() + 60000) {
      console.error('[auth] Refreshing access token...');
      const refreshed = await auth.refreshAccessToken();
      if (refreshed && refreshed.credentials) {
        auth.setCredentials({ ...auth.credentials, ...refreshed.credentials });
        cm.tokens.youtube = { ...(cm.tokens.youtube || {}), ...auth.credentials };
        await cm.saveTokens();
        console.error('[auth] Token refreshed and saved.');
      }
    }
  }
  console.error('[init] Creating YouTube Data & Analytics clients...');
  const yt = cm.getYouTubeClient();
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

  console.log('[1/4] Fetching channel summary...');
  const chRes = await yt.channels.list({ part: 'statistics,snippet,contentDetails', mine: true });
  const ch = chRes.data.items[0];
  console.log(`Channel: ${ch.snippet.title} | Total Views: ${ch.statistics.viewCount} | Subs: ${ch.statistics.subscriberCount} | Videos: ${ch.statistics.videoCount}`);

  console.log('\n[2/4] Checking recent & experiment video stats (Data API v3)...');
  const uploadsId = ch.contentDetails.relatedPlaylists.uploads;
  const listRes = await yt.playlistItems.list({
    part: 'snippet,contentDetails',
    playlistId: uploadsId,
    maxResults: 15
  });
  const recentIds = listRes.data.items.map(i => i.contentDetails.videoId);
  const vRes = await yt.videos.list({
    part: 'snippet,status,contentDetails,statistics',
    id: recentIds.join(',')
  });

  const videoList = vRes.data.items || [];
  console.log('Video ID     | Views | Likes | Comm | Privacy | UploadStatus | Duration | PublishedAt          | Title');
  console.log('-------------|-------|-------|------|---------|--------------|----------|----------------------|------');
  for (const v of videoList) {
    console.log(
      `${v.id.padEnd(12)} | ` +
      `${String(v.statistics.viewCount || 0).padStart(5)} | ` +
      `${String(v.statistics.likeCount || 0).padStart(5)} | ` +
      `${String(v.statistics.commentCount || 0).padStart(4)} | ` +
      `${v.status.privacyStatus.padEnd(7)} | ` +
      `${v.status.uploadStatus.padEnd(12)} | ` +
      `${v.contentDetails.duration.padEnd(8)} | ` +
      `${v.snippet.publishedAt.slice(0, 19)}Z | ` +
      `${v.snippet.title}`
    );
  }

  console.log('\n[3/4] Querying YouTube Analytics API v2 (Past 14 days)...');
  const today = new Date().toISOString().split('T')[0];
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];

  let analyticsRows = [];
  try {
    const aRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: twoWeeksAgo,
      endDate: today,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,likes,comments,shares,subscribersGained',
      dimensions: 'video',
      maxResults: 50,
      sort: '-views'
    });
    analyticsRows = aRes.data.rows || [];
    console.log(`Returned analytics rows for ${analyticsRows.length} videos.`);
    console.log('Video ID     | Views | WatchMin | AVD(s) | APV(%) | Likes | Comments | Shares | Subs');
    console.log('-------------|-------|----------|--------|--------|-------|----------|--------|-----');
    for (const r of analyticsRows.slice(0, 20)) {
      console.log(
        `${String(r[0]).padEnd(12)} | ` +
        `${String(r[1]).padStart(5)} | ` +
        `${String(r[2]).padStart(8)} | ` +
        `${String(r[3]).padStart(6)} | ` +
        `${String(r[4]).padStart(6)} | ` +
        `${String(r[5]).padStart(5)} | ` +
        `${String(r[6]).padStart(8)} | ` +
        `${String(r[7]).padStart(6)} | ` +
        `${r[8]}`
      );
    }
  } catch (e) {
    console.warn('Analytics video report error:', e.message);
  }

  console.log('\n[4/4] Querying Shorts Traffic Sources (Past 14 days)...');
  let trafficRows = [];
  try {
    const tRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: twoWeeksAgo,
      endDate: today,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage',
      dimensions: 'insightTrafficSourceType',
      filters: 'creatorContentType==SHORTS',
      sort: '-views'
    });
    trafficRows = tRes.data.rows || [];
    for (const r of trafficRows) {
      console.log(`${String(r[0]).padEnd(24)} | Views: ${String(r[1]).padStart(5)} | AVD: ${r[3]}s | APV: ${r[4]}%`);
    }
  } catch (e) {
    console.warn('Traffic source error:', e.message);
  }

  // Save snapshot
  const snapshot = {
    checkedAt: new Date().toISOString(),
    channel: {
      title: ch.snippet.title,
      viewCount: ch.statistics.viewCount,
      subscriberCount: ch.statistics.subscriberCount,
      videoCount: ch.statistics.videoCount
    },
    recentVideos: videoList.map(v => ({
      id: v.id,
      title: v.snippet.title,
      publishedAt: v.snippet.publishedAt,
      duration: v.contentDetails.duration,
      privacyStatus: v.status.privacyStatus,
      views: Number(v.statistics.viewCount || 0),
      likes: Number(v.statistics.likeCount || 0),
      comments: Number(v.statistics.commentCount || 0)
    })),
    analyticsRows,
    trafficRows
  };

  fs.mkdirSync(path.resolve('runs/2026-11-12'), { recursive: true });
  fs.writeFileSync(path.resolve('runs/2026-11-12/experiment_review.json'), JSON.stringify(snapshot, null, 2), 'utf8');
  console.log('\nSaved full experiment review snapshot to runs/2026-11-12/experiment_review.json');
}

main().catch(err => {
  console.error('Review script error:', err);
  process.exit(1);
});
