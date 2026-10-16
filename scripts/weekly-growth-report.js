const fs = require('fs');
const path = require('path');
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

function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-US');
}

function loadExperiments() {
  const expFile = path.resolve(__dirname, '..', 'analytics', 'experiments.csv');
  if (!fs.existsSync(expFile)) return [];
  const content = fs.readFileSync(expFile, 'utf8').trim().split('\n');
  if (content.length <= 1) return [];
  const rows = [];
  for (let i = 1; i < content.length; i++) {
    const parts = content[i].split(',');
    if (parts.length >= 4) {
      rows.push({
        timestamp: parts[0],
        videoId: parts[1],
        contentType: parts[2],
        variantId: parts[3],
        questionCount: parts[4],
        titleStyle: parts[5]
      });
    }
  }
  return rows;
}

async function generateWeeklyGrowthReport() {
  console.log('================================================================');
  console.log('  EXAMIQ BHARAT (@examiqbharat) - WEEKLY GROWTH & ANALYTICS REPORT ');
  console.log('================================================================\n');

  const cm = new CredentialManager();
  await cm.initialize();
  const auth = cm.getYouTubeAuth();
  const yt = google.youtube({ version: 'v3', auth });
  const ytAnalytics = google.youtubeAnalytics({ version: 'v2', auth });

  // 1. Fetch channel overview
  const channelRes = await yt.channels.list({ part: 'snippet,statistics,contentDetails', mine: true });
  if (!channelRes.data.items?.length) {
    throw new Error('No channel found for current credentials');
  }
  const channel = channelRes.data.items[0];
  const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;

  // 2. Fetch upload playlist items (up to 50 recent videos)
  const playlistRes = await yt.playlistItems.list({
    part: 'snippet,contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: 50
  });

  const videoIds = playlistRes.data.items.map(item => item.contentDetails.videoId);
  if (!videoIds.length) {
    console.log('No videos found.');
    return;
  }

  // 3. Batch fetch video details
  const videoDetailsRes = await yt.videos.list({
    part: 'snippet,statistics,contentDetails',
    id: videoIds.join(',')
  });

  // 4. Query YouTube Analytics API v2 for accurate per-video retention and traffic
  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const videoAnalyticsMap = new Map();
  let trafficSources = [];
  let ageDemographics = [];

  try {
    const videoStatsRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: thirtyDaysAgo,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
      dimensions: 'video',
      maxResults: 100,
      sort: '-views'
    });

    if (videoStatsRes.data.rows) {
      for (const row of videoStatsRes.data.rows) {
        videoAnalyticsMap.set(row[0], {
          views: row[1],
          watchMinutes: Number(row[2]).toFixed(1),
          avgViewDurationSec: Number(row[3]).toFixed(1),
          avgPercentageViewed: Number(row[4]).toFixed(1),
          subsGained: row[5]
        });
      }
    }

    const trafficRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: thirtyDaysAgo,
      endDate,
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'insightTrafficSourceType',
      sort: '-views'
    });
    trafficSources = trafficRes.data.rows || [];

    const ageRes = await ytAnalytics.reports.query({
      ids: 'channel==MINE',
      startDate: thirtyDaysAgo,
      endDate,
      metrics: 'viewerPercentage',
      dimensions: 'ageGroup',
      sort: '-viewerPercentage'
    });
    ageDemographics = ageRes.data.rows || [];
  } catch (err) {
    console.warn(`YouTube Analytics API query note: ${err.message}`);
  }

  const videos = videoDetailsRes.data.items.map(v => {
    const durationSec = parseIsoDuration(v.contentDetails.duration);
    const pubDate = new Date(v.snippet.publishedAt);
    const analyticsData = videoAnalyticsMap.get(v.id) || {};
    return {
      id: v.id,
      title: v.snippet.title,
      publishedAt: pubDate,
      durationSec,
      isShort: durationSec <= 60,
      views: parseInt(v.statistics.viewCount || '0', 10),
      likes: parseInt(v.statistics.likeCount || '0', 10),
      comments: parseInt(v.statistics.commentCount || '0', 10),
      avdSec: analyticsData.avgViewDurationSec || 'N/A',
      apvPct: analyticsData.avgPercentageViewed ? `${analyticsData.avgPercentageViewed}%` : 'N/A'
    };
  });

  const past7DaysVideos = videos.filter(v => v.publishedAt >= sevenDaysAgo);
  const prior7DaysVideos = videos.filter(v => v.publishedAt >= fourteenDaysAgo && v.publishedAt < sevenDaysAgo);

  const past7Views = past7DaysVideos.reduce((sum, v) => sum + v.views, 0);
  const prior7Views = prior7DaysVideos.reduce((sum, v) => sum + v.views, 0);
  const viewsDelta = prior7Views === 0 ? 100 : Math.round(((past7Views - prior7Views) / prior7Views) * 100);

  const shortsPast7 = past7DaysVideos.filter(v => v.isShort);
  const longPast7 = past7DaysVideos.filter(v => !v.isShort);
  const shortsViews = shortsPast7.reduce((sum, v) => sum + v.views, 0);
  const longViews = longPast7.reduce((sum, v) => sum + v.views, 0);

  const sortedPast7 = [...past7DaysVideos].sort((a, b) => b.views - a.views);
  const top3 = sortedPast7.slice(0, 3);
  const bottom3 = sortedPast7.slice(-3).reverse();
  const allTimeTop5 = [...videos].sort((a, b) => b.views - a.views).slice(0, 5);

  const experiments = loadExperiments();

  // Console output
  console.log(`Channel: ${channel.snippet.title} (@examiqbharat)`);
  console.log(`Subscribers: ${formatNumber(channel.statistics.subscriberCount)} | Total Views: ${formatNumber(channel.statistics.viewCount)} | Videos: ${channel.statistics.videoCount}\n`);

  console.log('--- 7-DAY PERFORMANCE RECAP ---');
  console.log(`Videos Uploaded (Past 7d): ${past7DaysVideos.length} (${shortsPast7.length} Shorts, ${longPast7.length} Long)`);
  console.log(`Views in Past 7 Days:      ${formatNumber(past7Views)} (Shorts: ${formatNumber(shortsViews)}, Long: ${formatNumber(longViews)})`);
  console.log(`Views Prior 7 Days:        ${formatNumber(prior7Views)}`);
  console.log(`7-Day Velocity Delta:      ${viewsDelta >= 0 ? '+' : ''}${viewsDelta}%\n`);

  console.log('--- TOP 3 PERFORMERS (Past 7d with Analytics APV) ---');
  top3.forEach((v, idx) => {
    console.log(` ${idx + 1}. [${v.isShort ? 'SHORT' : 'LONG'}] ${v.views} views | APV: ${v.apvPct} | AVD: ${v.avdSec}s | "${v.title}"`);
  });

  console.log('\n--- BOTTOM 3 PERFORMERS (Past 7d) ---');
  bottom3.forEach((v, idx) => {
    console.log(` ${idx + 1}. [${v.isShort ? 'SHORT' : 'LONG'}] ${v.views} views | APV: ${v.apvPct} | AVD: ${v.avdSec}s | "${v.title}"`);
  });

  if (trafficSources.length > 0) {
    console.log('\n--- TOP TRAFFIC SOURCES (Live Analytics API) ---');
    trafficSources.slice(0, 4).forEach(row => {
      console.log(` • ${row[0].padEnd(20)}: ${String(row[1]).padStart(5)} views (${Number(row[2]).toFixed(1)} watch min)`);
    });
  }

  if (ageDemographics.length > 0) {
    console.log('\n--- AUDIENCE DEMOGRAPHICS (Live Analytics API) ---');
    ageDemographics.forEach(row => {
      console.log(` • Age ${row[0]}: ${row[1]}%`);
    });
  }

  // Save detailed Markdown report
  const dateStr = now.toISOString().slice(0, 10);
  const reportPath = path.resolve(__dirname, '..', 'analytics', `weekly-growth-report-${dateStr}.md`);

  const mdReport = `# Weekly Growth & Performance Report: ExamIQ Bharat
**Generated:** ${new Date().toISOString()}  
**Channel:** ${channel.snippet.title} (\`@examiqbharat\`)  
**Channel ID:** \`${channel.id}\`  

---

## 1. Executive Summary & Core KPIs

| Metric | Last 7 Days | Prior 7 Days | 7-Day Change | Channel All-Time |
| :--- | :--- | :--- | :--- | :--- |
| **Total Views** | **${formatNumber(past7Views)}** | **${formatNumber(prior7Views)}** | **${viewsDelta >= 0 ? '+' : ''}${viewsDelta}%** | ${formatNumber(channel.statistics.viewCount)} |
| **Shorts Views** | ${formatNumber(shortsViews)} | - | - | - |
| **Long-Form Views** | ${formatNumber(longViews)} | - | - | - |
| **Videos Uploaded** | ${past7DaysVideos.length} | ${prior7DaysVideos.length} | ${past7DaysVideos.length - prior7DaysVideos.length} | ${channel.statistics.videoCount} |
| **Total Subscribers** | - | - | - | **${formatNumber(channel.statistics.subscriberCount)}** |

---

## 2. Live Audience Demographics & Traffic Breakdown (YouTube Analytics API v2)

### Traffic Distribution
${trafficSources.map(r => `- **${r[0]}:** ${formatNumber(r[1])} views (${Number(r[2]).toFixed(1)} watch minutes)`).join('\n')}

### Age Demographics
${ageDemographics.map(r => `- **${r[0]}:** ${r[1]}% of audience`).join('\n')}

---

## 3. Top Performing Videos (Past 7 Days)

${top3.map((v, i) => `${i + 1}. **[${v.isShort ? 'Short' : 'Long Video'}]** [${v.title}](https://youtu.be/${v.id})  
   - **Views:** ${v.views} | **APV:** ${v.apvPct} | **AVD:** ${v.avdSec}s | **Likes:** ${v.likes}  
   - **Published:** ${v.publishedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`).join('\n\n')}

---

## 4. Underperforming Videos (Past 7 Days)

${bottom3.map((v, i) => `${i + 1}. **[${v.isShort ? 'Short' : 'Long Video'}]** [${v.title}](https://youtu.be/${v.id})  
   - **Views:** ${v.views} | **APV:** ${v.apvPct} | **AVD:** ${v.avdSec}s | **Duration:** ${v.durationSec}s`).join('\n\n')}

---

## 5. Active Experiments
Total tracked experiment variants: **${experiments.length}**  
Reference: \`analytics/experiments.csv\`
`;

  fs.writeFileSync(reportPath, mdReport, 'utf8');
  console.log(`\nMarkdown report saved to: ${reportPath}`);
}

generateWeeklyGrowthReport().catch(err => {
  console.error('Error generating report:', err.message);
  process.exit(1);
});
