'use strict';
// utils/channel-outlier-tracker.js
// Reads our upload history (facebook/data/history.json) and YouTube Analytics
// to identify which of our videos overperformed.
// Falls back gracefully if YouTube API is not available.

const fs   = require('fs');
const path = require('path');
const https = require('https');
const { analyzeViralOutliers, calculateMedian } = require('./viral-outlier-analyzer');

const HISTORY_FILE       = path.resolve(__dirname, '../facebook/data/history.json');
const OUTLIER_REPORT_FILE = path.resolve(__dirname, '../facebook/data/outlier-report.json');

// ─── helpers ────────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse error: ' + e.message)); }
      });
    }).on('error', reject);
  });
}

/** Days between uploadedAt timestamp and now */
function daysSince(isoDate) {
  if (!isoDate) return 1;
  const ms = Date.now() - new Date(isoDate).getTime();
  return Math.max(1, Math.floor(ms / 86400000));
}

/** Rough view estimate when API is unavailable: newer = fewer views */
function estimateViews(upload) {
  const days = daysSince(upload.uploadedAt);
  const categoryBoost = {
    static_gk: 1.4, history: 1.3, polity: 1.2, math_quiz: 1.1,
    science: 1.15, geopolitics: 1.05
  }[upload.category] || 1.0;
  const hookBoost = (upload.hookScore || 50) / 50;   // hookScore 50 = baseline
  return Math.round(80 * days * categoryBoost * hookBoost);
}

// ─── class ───────────────────────────────────────────────────────────────────

class ChannelOutlierTracker {
  constructor(options = {}) {
    this.minMultiplier  = options.minMultiplier || 2.5;
    this.youtubeApiKey  = options.youtubeApiKey
      || process.env.YOUTUBE_API_KEY
      || process.env.GEMINI_API_KEY;
  }

  // ── Load our upload history ──────────────────────────────────────────────
  loadHistory() {
    if (!fs.existsSync(HISTORY_FILE)) return { uploads: [] };
    try {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
      const data = JSON.parse(raw);
      // Support both { uploads: [...] } and legacy array formats
      if (Array.isArray(data)) return { uploads: data };
      return data;
    } catch (err) {
      console.error('[OutlierTracker] Failed to parse history.json:', err.message);
      return { uploads: [] };
    }
  }

  // ── Fetch real view counts from YouTube Data API ─────────────────────────
  // Falls back to placeholder if API not available
  async fetchYouTubeViewCounts(videoIds) {
    const viewMap = {};

    if (!this.youtubeApiKey || !videoIds.length) {
      return viewMap;  // empty → caller uses estimates
    }

    // YouTube v3 accepts up to 50 IDs per call
    const chunks = [];
    for (let i = 0; i < videoIds.length; i += 50) {
      chunks.push(videoIds.slice(i, i + 50));
    }

    for (const chunk of chunks) {
      const idsParam = chunk.map(encodeURIComponent).join(',');
      const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${idsParam}&key=${this.youtubeApiKey}`;
      try {
        const json = await httpsGet(url);
        if (json.error) {
          console.warn('[OutlierTracker] YouTube API error:', json.error.message);
          break;
        }
        for (const item of (json.items || [])) {
          const stats = item.statistics || {};
          viewMap[item.id] = parseInt(stats.viewCount || '0', 10);
        }
      } catch (err) {
        console.warn('[OutlierTracker] YouTube API fetch failed:', err.message);
        break;
      }
    }
    return viewMap;
  }

  // ── Analyze which of our videos are outliers (≥ minMultiplier × median) ──
  async analyzeOurOutliers() {
    const history = this.loadHistory();
    const uploads = history.uploads || [];

    if (!uploads.length) {
      return { topFormulas: [], outliers: [], median: 0, report: {} };
    }

    // Collect YouTube video IDs (fbVideoId entries that look like YT IDs)
    const ytIdPattern = /^[A-Za-z0-9_-]{11}$/;
    const videoIds = uploads
      .map(u => u.youtubeVideoId || u.ytVideoId || '')
      .filter(id => ytIdPattern.test(id));

    const ytViewMap = await this.fetchYouTubeViewCounts(videoIds);

    // Build a view count for each upload
    const withViews = uploads.map(upload => {
      let views;
      const ytId = upload.youtubeVideoId || upload.ytVideoId;
      if (ytId && ytViewMap[ytId] !== undefined) {
        views = ytViewMap[ytId];
      } else {
        views = upload.viewEstimate || estimateViews(upload);
      }
      return { ...upload, views };
    });

    // Use analyzeViralOutliers treating our entire channel as one "channel"
    const videosForAnalyzer = withViews.map(u => ({
      channel: 'ExamIQBharat',
      title:   u.title || '',
      views:   u.views,
      url:     u.youtubeUrl || u.fbVideoId || '',
      hookFormula: u.hookFormula || null,
      category:    u.category || 'unknown',
      uploadedAt:  u.uploadedAt || null,
      id:          u.id || null
    }));

    const result = analyzeViralOutliers(videosForAnalyzer, this.minMultiplier);

    // Augment each outlier with our extra fields
    const outliers = result.outliers.map(o => {
      const original = withViews.find(u => (u.title || '') === o.title) || {};
      return {
        ...o,
        id:          original.id,
        category:    original.category,
        topic:       original.topic,
        hookFormula: original.hookFormula || o.formula,
        hookScore:   original.hookScore,
        uploadedAt:  original.uploadedAt,
        views:       o.views
      };
    });

    // Build topFormulas from outliers
    const formulaStats = {};
    for (const o of outliers) {
      const f = o.hookFormula || o.formula || 'unknown';
      if (!formulaStats[f]) formulaStats[f] = { formula: f, count: 0, totalMultiple: 0 };
      formulaStats[f].count++;
      formulaStats[f].totalMultiple += o.multiple || 1;
    }
    const topFormulas = Object.values(formulaStats)
      .map(s => ({ formula: s.formula, count: s.count, avgMultiple: Math.round((s.totalMultiple / s.count) * 100) / 100 }))
      .sort((a, b) => b.avgMultiple - a.avgMultiple || b.count - a.count);

    const allViews  = withViews.map(u => u.views);
    const median    = Math.round(calculateMedian(allViews));

    const report = {
      generatedAt:   new Date().toISOString(),
      totalVideos:   uploads.length,
      median,
      minMultiplier: this.minMultiplier,
      outlierCount:  outliers.length,
      topFormulas,
      outliers
    };

    this.saveOutlierReport(report);
    return { topFormulas, outliers, median, report };
  }

  // ── Load existing outlier report ─────────────────────────────────────────
  loadOutlierReport() {
    if (!fs.existsSync(OUTLIER_REPORT_FILE)) return null;
    try {
      return JSON.parse(fs.readFileSync(OUTLIER_REPORT_FILE, 'utf8'));
    } catch {
      return null;
    }
  }

  // ── Save updated outlier report ──────────────────────────────────────────
  saveOutlierReport(report) {
    try {
      const dir = path.dirname(OUTLIER_REPORT_FILE);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(OUTLIER_REPORT_FILE, JSON.stringify(report, null, 2), 'utf8');
      console.log(`[OutlierTracker] Report saved → ${OUTLIER_REPORT_FILE}`);
    } catch (err) {
      console.error('[OutlierTracker] Failed to save report:', err.message);
    }
  }

  // ── Get best-performing hook formulas from our outlier history ───────────
  getBestFormulas() {
    const report = this.loadOutlierReport();
    if (!report || !report.topFormulas || !report.topFormulas.length) {
      // Sensible defaults when no report exists
      return [
        { formula: 'percent-fail',        count: 0, avgMultiple: 0 },
        { formula: 'shocking-fact-hindi', count: 0, avgMultiple: 0 },
        { formula: '30-second-test',      count: 0, avgMultiple: 0 }
      ];
    }
    return report.topFormulas;
  }

  // ── CLI runner ───────────────────────────────────────────────────────────
  async run() {
    console.log('[OutlierTracker] Analyzing our channel outliers…');
    const { topFormulas, outliers, median, report } = await this.analyzeOurOutliers();
    console.log(`[OutlierTracker] Median views: ${median}`);
    console.log(`[OutlierTracker] Outliers found: ${outliers.length}`);
    console.log('[OutlierTracker] Top formulas:');
    for (const f of topFormulas.slice(0, 5)) {
      console.log(`  • ${f.formula}: ${f.count} videos, avg ${f.avgMultiple}× median`);
    }
    return report;
  }
}

// ── Run directly ─────────────────────────────────────────────────────────────
if (require.main === module) {
  const tracker = new ChannelOutlierTracker();
  tracker.run().catch(err => {
    console.error('[OutlierTracker] Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { ChannelOutlierTracker };
