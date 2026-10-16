const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { Logger } = require('../../utils/logger');
const {
  calculateMedian,
  calculatePercentile,
  bootstrapMedianCI,
  compareVariants
} = require('./stats-helper');

const logger = new Logger('AutopilotAnalyze');

function inferTitleStyle(title = '') {
  const t = title.toLowerCase();
  if (t.includes('lucent gk') || t.includes('top 10 gk mcq') || t.includes('gk quiz in hindi')) {
    return 'curiosity_lucent';
  }
  if (t.includes('police exam') || t.includes('ssc gd') || t.includes('railway ntpc') || t.includes('set 1') || t.includes('set 2')) {
    return 'exam_targeted';
  }
  return 'standard';
}

function inferDurationBucket(durationSec) {
  if (durationSec < 45) return '<45s';
  if (durationSec <= 60) return '45-60s';
  if (durationSec <= 180) return '1-3m';
  if (durationSec <= 600) return '3-10m';
  return '>10m';
}

function inferTopicCluster(title = '', tags = []) {
  const combined = `${title} ${(tags || []).join(' ')}`.toLowerCase();
  if (/संविधान|polity|article|अनुच्छेद/i.test(combined)) return 'Constitution';
  if (/इतिहास|history|मौर्य|मुगल|गांधी/i.test(combined)) return 'History';
  if (/भूगोल|geography|नदी|पर्वत|झील/i.test(combined)) return 'Geography';
  if (/विज्ञान|science|जीव विज्ञान|भौतिक/i.test(combined)) return 'General Science';
  if (/रामायण|महाभारत|धार्मिक|हनुमान/i.test(combined)) return 'Devotional';
  return 'Static GK';
}

function getRecentGitCommits(sinceDays = 14) {
  try {
    const stdout = execSync(`git log --since="${sinceDays} days ago" --oneline -n 20`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return stdout.trim().split('\n').filter(Boolean).map(line => {
      const [hash, ...rest] = line.split(' ');
      return { hash, message: rest.join(' ') };
    });
  } catch (err) {
    return [];
  }
}

async function analyzeDataset(rawDataset = null) {
  logger.info('Starting analytics data evaluation...');

  let dataset = rawDataset;
  if (!dataset) {
    const rawDir = path.resolve(__dirname, '..', '..', 'analytics', 'raw');
    if (!fs.existsSync(rawDir)) {
      throw new Error(`Raw analytics directory not found: ${rawDir}`);
    }
    const files = fs.readdirSync(rawDir).filter(f => f.startsWith('analytics-raw-') && f.endsWith('.json')).sort();
    if (files.length === 0) {
      throw new Error('No raw analytics JSON files found to analyze.');
    }
    const latestFile = path.join(rawDir, files[files.length - 1]);
    logger.info(`Loading latest raw dataset from ${latestFile}`);
    dataset = JSON.parse(fs.readFileSync(latestFile, 'utf8'));
  }

  const { videos = [], dailyTrends = [], ageDemographics = [], trafficSources = [], channel = {} } = dataset;
  const now = new Date();

  // 1. Enrich videos with inferred features
  const enrichedVideos = videos.map(v => {
    const pubDate = new Date(v.publishedAt);
    const pubHourUtc = pubDate.getUTCHours();
    const pubHourIst = (pubHourUtc + 5.5) % 24;
    const titleStyle = inferTitleStyle(v.title);
    const durationBucket = inferDurationBucket(v.durationSec);
    const topicCluster = inferTopicCluster(v.title, v.tags);

    return {
      ...v,
      titleStyle,
      durationBucket,
      topicCluster,
      pubHourIst: Math.floor(pubHourIst)
    };
  });

  // 2. Separate Formats (Shorts vs Long Form)
  const shorts = enrichedVideos.filter(v => v.isShort);
  const longs = enrichedVideos.filter(v => !v.isShort);

  const matureShorts = shorts.filter(v => v.isMature);
  const matureLongs = longs.filter(v => v.isMature);

  // Helper to summarize metrics
  function summarizeGroup(group) {
    const views = group.map(v => v.views);
    const avd = group.map(v => v.avdSec).filter(x => x > 0);
    const apv = group.map(v => v.apvPct).filter(x => x > 0);
    return {
      count: group.length,
      medianViews: calculateMedian(views),
      p75Views: calculatePercentile(views, 75),
      medianAVD: calculateMedian(avd),
      medianAPV: calculateMedian(apv),
      totalViews: views.reduce((a, b) => a + b, 0)
    };
  }

  const formatSummary = {
    shorts: {
      all: summarizeGroup(shorts),
      mature: summarizeGroup(matureShorts)
    },
    longs: {
      all: summarizeGroup(longs),
      mature: summarizeGroup(matureLongs)
    }
  };

  // 3. Title Style Comparison on Shorts
  const curiosityShorts = shorts.filter(v => v.titleStyle === 'curiosity_lucent').map(v => v.views);
  const examShorts = shorts.filter(v => v.titleStyle === 'exam_targeted').map(v => v.views);

  const titleStyleComparison = compareVariants(
    { name: 'curiosity_lucent', data: curiosityShorts },
    { name: 'exam_targeted', data: examShorts },
    { minSampleSize: 5, confidence: 0.90 }
  );

  // 4. Duration Bucket Comparison on Shorts (<45s vs 45-60s)
  const under45Shorts = shorts.filter(v => v.durationSec < 45).map(v => v.views);
  const standard45To60Shorts = shorts.filter(v => v.durationSec >= 45 && v.durationSec <= 60).map(v => v.views);

  const durationComparison = compareVariants(
    { name: '45-60s', data: standard45To60Shorts },
    { name: '<45s', data: under45Shorts },
    { minSampleSize: 5, confidence: 0.90 }
  );

  // 5. Topic Breakdown
  const topicMap = {};
  for (const v of enrichedVideos) {
    if (!topicMap[v.topicCluster]) {
      topicMap[v.topicCluster] = { views: [], count: 0, shorts: 0, longs: 0 };
    }
    topicMap[v.topicCluster].views.push(v.views);
    topicMap[v.topicCluster].count++;
    if (v.isShort) topicMap[v.topicCluster].shorts++;
    else topicMap[v.topicCluster].longs++;
  }

  const topicPerformance = Object.keys(topicMap).map(top => ({
    topic: top,
    count: topicMap[top].count,
    shortsCount: topicMap[top].shorts,
    longsCount: topicMap[top].longs,
    medianViews: calculateMedian(topicMap[top].views),
    totalViews: topicMap[top].views.reduce((a, b) => a + b, 0)
  })).sort((a, b) => b.totalViews - a.totalViews);

  // 6. Regression Detection (Last 3 days vs prior 14 days baseline)
  let regressionAlert = null;
  if (dailyTrends.length >= 7) {
    const recent3Days = dailyTrends.slice(-3);
    const prior14Days = dailyTrends.slice(-17, -3);

    const recent3AvgViews = recent3Days.reduce((sum, d) => sum + d.views, 0) / Math.max(1, recent3Days.length);
    const prior14AvgViews = prior14Days.reduce((sum, d) => sum + d.views, 0) / Math.max(1, prior14Days.length);

    if (prior14AvgViews > 50) {
      const dropPct = Math.round(((prior14AvgViews - recent3AvgViews) / prior14AvgViews) * 100);
      if (dropPct >= 40) {
        const recentCommits = getRecentGitCommits(14);
        regressionAlert = {
          isDetected: true,
          dropPercent: dropPct,
          recent3AvgViews: Math.round(recent3AvgViews),
          prior14AvgViews: Math.round(prior14AvgViews),
          correlatedCommits: recentCommits.slice(0, 5),
          recommendedAction: 'Propose revert to last known-good configuration'
        };
      }
    }
  }

  // 7. Audience Check
  const age65Share = (ageDemographics.find(a => a.ageGroup === 'age65-')?.viewerPercentage) || 0;
  const age18To34Share = ((ageDemographics.find(a => a.ageGroup === 'age18-24')?.viewerPercentage) || 0) +
                         ((ageDemographics.find(a => a.ageGroup === 'age25-34')?.viewerPercentage) || 0);

  const audienceHealth = {
    age65Share,
    age18To34Share,
    isTargetAspirantDominant: age18To34Share > age65Share,
    diagnosis: age65Share > 20
      ? 'Alert: Senior audience (65+) remains high (>20%). Devotional / non-exam topics should remain retired to let YouTube lookalike graph re-center on aspirants.'
      : 'Healthy: Core aspirant age groups (18-34) dominate the demographic distribution.'
  };

  // 8. Quality & Policy Audit on recent 10 uploads
  const qualityIssues = [];
  const recent10 = enrichedVideos.slice(0, 10);
  for (const v of recent10) {
    if (v.title.length > 95) {
      qualityIssues.push({ videoId: v.id, issue: 'Title too long (>95 chars)', title: v.title });
    }
    if (v.title.endsWith('...')) {
      qualityIssues.push({ videoId: v.id, issue: 'Truncated title ending in ellipsis', title: v.title });
    }
    if (v.description.includes('mysterious story') || v.description.includes('br gk study')) {
      qualityIssues.push({ videoId: v.id, issue: 'Description contains off-niche spam keyword', title: v.title });
    }
  }

  const analysis = {
    analyzedAt: now.toISOString(),
    channel,
    formatSummary,
    hypotheses: {
      titleStyle: titleStyleComparison,
      shortsDuration: durationComparison
    },
    topicPerformance,
    regressionAlert,
    audienceHealth,
    qualityAudit: {
      inspectedCount: recent10.length,
      issueCount: qualityIssues.length,
      issues: qualityIssues
    },
    top5Videos: [...enrichedVideos].sort((a, b) => b.views - a.views).slice(0, 5),
    bottom5Videos: [...enrichedVideos].sort((a, b) => a.views - b.views).slice(0, 5)
  };

  // Save to analytics/analysis/
  const analysisDir = path.resolve(__dirname, '..', '..', 'analytics', 'analysis');
  if (!fs.existsSync(analysisDir)) {
    fs.mkdirSync(analysisDir, { recursive: true });
  }
  const dateStr = now.toISOString().slice(0, 10);
  const outPath = path.join(analysisDir, `analysis-${dateStr}.json`);
  fs.writeFileSync(outPath, JSON.stringify(analysis, null, 2), 'utf8');
  logger.info(`Saved analysis report to ${outPath}`);

  return analysis;
}

if (require.main === module) {
  analyzeDataset().then(res => {
    logger.info('Analysis completed successfully');
    process.exit(0);
  }).catch(err => {
    logger.error(`Analysis failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  analyzeDataset,
  inferTitleStyle,
  inferDurationBucket,
  inferTopicCluster
};
