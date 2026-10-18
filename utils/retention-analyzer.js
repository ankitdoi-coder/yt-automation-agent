/**
 * Parse timestamp string to seconds
 */
function parseTimestamp(ts) {
  if (typeof ts === 'number') return ts;
  const s = String(ts).trim().replace(',', '.');
  const parts = s.split(':');
  if (parts.length === 3) {
    return parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    return parseInt(parts[0], 10) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(s) || 0;
}

/**
 * Parse transcript cues from SRT, VTT, or Whisper JSON format
 */
function parseTranscriptCues(content, ext = '.srt') {
  if (!content) return [];
  if (ext === '.json' || (typeof content === 'string' && content.trim().startsWith('{'))) {
    try {
      const data = typeof content === 'string' ? JSON.parse(content) : content;
      const segs = data.segments || (Array.isArray(data) ? data : []);
      return segs.map(s => ({
        start: parseFloat(s.start || 0),
        end: parseFloat(s.end || 0),
        text: String(s.text || '').trim()
      }));
    } catch {
      return [];
    }
  }

  const cues = [];
  const lines = content.split(/\r?\n/);
  let cur = null;

  for (const line of lines) {
    const match = line.match(/\s*(\d[\d:.,]+)\s*-->\s*(\d[\d:.,]+)/);
    if (match) {
      cur = {
        start: parseTimestamp(match[1]),
        end: parseTimestamp(match[2]),
        lines: []
      };
      cues.push(cur);
    } else if (cur && line.trim() && !/^\d+$/.test(line.trim())) {
      cur.lines.push(line.trim());
    }
  }

  return cues.map(c => ({
    start: c.start,
    end: c.end,
    text: c.lines.join(' ')
  }));
}

/**
 * Load and parse YouTube Studio Audience Retention CSV data
 */
function parseRetentionCSV(csvContent) {
  const rows = [];
  const lines = csvContent.split(/\r?\n/);
  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split(',').map(c => c.trim().replace(/%/g, ''));
    const nums = cols.map(c => {
      const parsed = parseFloat(c);
      return Number.isNaN(parsed) ? null : parsed;
    }).filter(n => n !== null);

    if (nums.length >= 2) {
      rows.push([nums[0], nums[1]]);
    }
  }
  return rows;
}

/**
 * Analyze YouTube audience retention curve
 * @param {string|Array} retentionData - CSV string or array of [time/pct, retention%]
 * @param {object} [options] - Optional duration and transcript cues
 */
function analyzeRetention(retentionData, options = {}) {
  const rows = typeof retentionData === 'string' ? parseRetentionCSV(retentionData) : retentionData;
  if (!Array.isArray(rows) || rows.length < 5) {
    return {
      error: 'Insufficient data points (requires at least 5 points)',
      healthy: false
    };
  }

  const xs = rows.map(r => r[0]);
  const ys = rows.map(r => r[1]);
  const isPercentageAxis = Math.max(...xs) <= 100.5;
  const duration = options.duration ? parseFloat(options.duration) : null;

  const toSeconds = (x) => {
    if (isPercentageAxis && duration) return (x / 100.0) * duration;
    return x;
  };

  const start = ys[0] || 100.0;
  // Hook cutoff: 30 seconds, or 10% when percentage axis without duration
  const cutoff = !isPercentageAxis ? 30.0 : (duration ? (30.0 / duration) * 100 : 10.0);

  const hookPoints = rows.filter(r => r[0] <= cutoff).map(r => r[1]);
  const hookEnd = hookPoints.length ? Math.min(...hookPoints) : start;
  const hookLeak = start - hookEnd;

  const drops = [];
  for (let i = 1; i < rows.length; i++) {
    const diff = rows[i - 1][1] - rows[i][1];
    const span = (rows[i][0] - rows[i - 1][0]) || 1;
    drops.push({
      rate: diff / span,
      from: rows[i - 1][0],
      to: rows[i][0],
      lost: diff
    });
  }

  drops.sort((a, b) => b.rate - a.rate);

  const cliffs = drops
    .filter(d => d.lost > 0.8)
    .slice(0, 5)
    .map(c => ({
      from: Math.round(c.from * 100) / 100,
      to: Math.round(c.to * 100) / 100,
      lost: Math.round(c.lost * 100) / 100,
      atSeconds: (isPercentageAxis && !duration) ? null : Math.round(toSeconds(c.from) * 10) / 10
    }));

  const midDrops = drops.filter(d => d.from > cutoff);
  const slide = midDrops.length
    ? midDrops.reduce((acc, d) => acc + d.rate, 0) / midDrops.length
    : 0;

  // Cross-reference with transcript if provided
  const saidAtCliffs = {};
  if (options.transcript) {
    const cues = Array.isArray(options.transcript)
      ? options.transcript
      : parseTranscriptCues(options.transcript, options.transcriptExt || '.srt');

    for (const c of cliffs) {
      if (c.atSeconds !== null) {
        const t = c.atSeconds;
        const matching = cues.filter(q => q.start <= t + 4 && q.end >= t - 4);
        saidAtCliffs[String(c.from)] = matching.map(q => q.text).join(' ').slice(0, 160);
      }
    }
  }

  const verdict = hookLeak < 25 ? 'healthy' : (hookLeak < 40 ? 'leaking' : 'severe');

  return {
    dataPoints: rows.length,
    startRetention: Math.round(start * 10) / 10,
    endRetention: Math.round(ys[ys.length - 1] * 10) / 10,
    hookLeak: Math.round(hookLeak * 10) / 10,
    hookVerdict: verdict,
    cliffs,
    slideRate: Math.round(slide * 1000) / 1000,
    saidAtCliffs,
    recommendations: [
      hookLeak >= 25 ? `Hook leaked ${hookLeak.toFixed(1)}% in first 30s. Change the opening sentence and remove intros.` : `Hook is healthy (<25% drop).`,
      cliffs.length > 0 ? `Detected ${cliffs.length} cliff drop-off points. Inspect timestamps to eliminate dead weight or abrupt transitions.` : `No steep cliff drops detected.`,
      slide > 0.05 ? `Slide decay rate is high (${slide.toFixed(3)}%/unit). Pacing across middle is dragging; cut beats tighter.` : `Middle pacing slide is steady.`
    ]
  };
}

module.exports = {
  analyzeRetention,
  parseRetentionCSV,
  parseTranscriptCues
};
