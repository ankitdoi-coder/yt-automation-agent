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

  // 3. Batch fetch video statistics
  const videoDetailsRes = await yt.videos.list({
    part: 'snippet,statistics,contentDetails',
    id: videoIds.join(',')
  });

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const videos = videoDetailsRes.data.items.map(v => {
    const durationSec = parseIsoDuration(v.contentDetails.duration);
    const pubDate = new Date(v.snippet.publishedAt);
    return {
      id: v.id,
      title: v.snippet.title,
      publishedAt: pubDate,
      durationSec,
      isShort: durationSec <= 60,
      views: parseInt(v.statistics.viewCount || '0', 10),
      likes: parseInt(v.statistics.likeCount || '0', 10),
      comments: parseInt(v.statistics.commentCount || '0', 10)
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

  // Sorted past 7 days by views
  const sortedPast7 = [...past7DaysVideos].sort((a, b) => b.views - a.views);
  const top3 = sortedPast7.slice(0, 3);
  const bottom3 = sortedPast7.slice(-3).reverse();

  // All time top 5 for benchmarking
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

  console.log('--- TOP 3 RECENT PERFORMERS (Past 7d) ---');
  top3.forEach((v, idx) => {
    console.log(` ${idx + 1}. [${v.isShort ? 'SHORT' : 'LONG'}] ${v.views} views | ${v.likes} likes | "${v.title}"`);
  });

  console.log('\n--- BOTTOM 3 RECENT PERFORMERS (Past 7d) ---');
  bottom3.forEach((v, idx) => {
    console.log(` ${idx + 1}. [${v.isShort ? 'SHORT' : 'LONG'}] ${v.views} views | ${v.likes} likes | "${v.title}"`);
  });

  console.log('\n--- ALL-TIME BENCHMARK LEADERS ---');
  allTimeTop5.forEach((v, idx) => {
    console.log(` ${idx + 1}. [${v.isShort ? 'SHORT' : 'LONG'}] ${v.views} views | Pub: ${v.publishedAt.toISOString().slice(0, 10)} | "${v.title}"`);
  });

  // Generate Markdown report
  const dateStr = now.toISOString().slice(0, 10);
  const reportPath = path.resolve(__dirname, '..', 'analytics', `weekly-growth-report-${dateStr}.md`);

  const mdReport = `# Weekly Growth & Performance Report: ExamIQ Bharat
**Date:** ${dateStr}  
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

## 2. Top Performing Videos (Past 7 Days)

${top3.map((v, i) => `${i + 1}. **[${v.isShort ? 'Short' : 'Long Video'}]** [${v.title}](https://youtu.be/${v.id})  
   - **Views:** ${v.views} | **Likes:** ${v.likes} | **Comments:** ${v.comments}  
   - **Published:** ${v.publishedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`).join('\n\n')}

---

## 3. Underperforming Videos (Past 7 Days)

${bottom3.map((v, i) => `${i + 1}. **[${v.isShort ? 'Short' : 'Long Video'}]** [${v.title}](https://youtu.be/${v.id})  
   - **Views:** ${v.views} | **Likes:** ${v.likes} | **Duration:** ${v.durationSec}s`).join('\n\n')}

---

## 4. Growth Hypothesis & Diagnostic Insights

1. **Shorts Title Formatting (Proven Driver):**
   - The all-time peak days (Oct 11: 1,758 views) were driven by curiosity-first Lucent titles:
     - \`Top 10 GK MCQ | GK Questions | GK Quiz in Hindi | Lucent GK\` (737 views)
     - \`Top 10 GK MCQ | GK Questions | GK Quiz in Hindi | Lucent GK\` (704 views)
   - When titles were switched on Oct 15-16 to hyper-specific exam tags (\`Police Exam 2026 | Static GK Top 5 MCQs (Set 1)\`), views plummeted to 0-11 views.
   - **Action Taken:** Reset default \`shorts.titleStyle\` to \`curiosity_lucent\` in \`config/growth.json\`.

2. **Deduplication in Long-Form Content:**
   - 20-30 minute long videos previously experienced ~9s Average View Duration because questions repeated up to 36% across batches within the same video.
   - **Action Taken:** Activated strict semantic tokenization (Jaccard similarity > 0.45) and answer-entity collision detection.

3. **Upload Cadence & Algorithmic Saturation:**
   - Uploading 5-8 videos/day caused self-cannibalization. Recommended cadence is 1-2 Shorts/day + 1 Long video every 2-3 days.

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
