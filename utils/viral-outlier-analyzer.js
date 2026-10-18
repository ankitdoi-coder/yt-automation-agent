const { classifyHook } = require('./hook-scorer');

function calculateMedian(numbers) {
  if (!numbers.length) return 0;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Identify viral breakout outliers across channel medians.
 * Raw view count measures channel size; median multiplier measures idea strength!
 * @param {Array} videos - Array of { channel, title, views, url, ... }
 * @param {number} [minMultiplier=1.5] - Minimum multiple of channel median
 */
function analyzeViralOutliers(videos, minMultiplier = 1.5) {
  if (!Array.isArray(videos)) return { outliers: [], skippedChannels: [] };

  const byChannel = {};
  for (const v of videos) {
    const ch = v.channel || 'Unknown';
    if (!byChannel[ch]) byChannel[ch] = [];
    byChannel[ch].push(v);
  }

  const outliers = [];
  const skippedChannels = [];

  for (const [ch, channelVideos] of Object.entries(byChannel)) {
    const views = channelVideos.map(v => Number(v.views) || 0);
    const median = calculateMedian(views);

    if (channelVideos.length < 4) {
      skippedChannels.push({ channel: ch, count: channelVideos.length });
      continue;
    }

    for (const v of channelVideos) {
      const vViews = Number(v.views) || 0;
      const multiple = median > 0 ? vViews / median : 0;
      const classification = classifyHook(v.title || '');

      if (multiple >= minMultiplier) {
        outliers.push({
          channel: ch,
          title: v.title || '',
          views: vViews,
          channelMedian: Math.round(median),
          multiple: Math.round(multiple * 100) / 100,
          formula: classification.formula,
          url: v.url || ''
        });
      }
    }
  }

  outliers.sort((a, b) => b.multiple - a.multiple);

  // Group top formula occurrences
  const formulaCounts = {};
  for (const o of outliers) {
    formulaCounts[o.formula] = (formulaCounts[o.formula] || 0) + 1;
  }

  return {
    totalVideosAnalyzed: videos.length,
    channelCount: Object.keys(byChannel).length,
    thresholdMultiplier: minMultiplier,
    outliers,
    skippedChannels,
    formulaBreakdown: formulaCounts
  };
}

module.exports = {
  analyzeViralOutliers,
  calculateMedian
};
