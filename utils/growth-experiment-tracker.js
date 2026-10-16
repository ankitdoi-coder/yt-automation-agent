const fs = require('fs');
const path = require('path');
const { Logger } = require('./logger');

const logger = new Logger('GrowthExperimentTracker');
const EXPERIMENTS_FILE = path.resolve(__dirname, '..', 'analytics', 'experiments.csv');
const CONFIG_FILE = path.resolve(__dirname, '..', 'config', 'growth.json');

function getGrowthConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (_) {}
  return {};
}

function ensureCsvHeader() {
  const dir = path.dirname(EXPERIMENTS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(EXPERIMENTS_FILE) || fs.statSync(EXPERIMENTS_FILE).size === 0) {
    const headers = [
      'timestamp',
      'video_id',
      'content_type',
      'variant_id',
      'question_count',
      'title_style',
      'title',
      'status',
      'notes'
    ].join(',');
    fs.writeFileSync(EXPERIMENTS_FILE, headers + '\n', 'utf8');
  }
}

function escapeCsvField(val) {
  const str = String(val ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function logExperimentVideo(entry = {}) {
  try {
    const growth = getGrowthConfig();
    if (growth.seo?.trackExperiments === false) return;

    ensureCsvHeader();

    const timestamp = entry.timestamp || new Date().toISOString();
    const videoId = entry.videoId || entry.id || '';
    const contentType = entry.contentType || (entry.isShort ? 'short' : 'long_form');
    const titleStyle = entry.titleStyle || (contentType === 'short' ? growth.shorts?.titleStyle : 'standard');
    const questionCount = entry.questionCount || (contentType === 'short' ? (growth.shorts?.targetQuestionCount || 10) : (growth.longVideos?.targetQuestionCount || 20));
    
    // Variant tag determined from titleStyle and length
    const variantId = entry.variantId || (contentType === 'short'
      ? `${titleStyle}_${questionCount}q`
      : `dedup_${questionCount}q`);

    const title = entry.title || '';
    const status = entry.status || 'published';
    const notes = entry.notes || '14-day growth algorithm recovery trial';

    const row = [
      escapeCsvField(timestamp),
      escapeCsvField(videoId),
      escapeCsvField(contentType),
      escapeCsvField(variantId),
      escapeCsvField(questionCount),
      escapeCsvField(titleStyle),
      escapeCsvField(title),
      escapeCsvField(status),
      escapeCsvField(notes)
    ].join(',');

    fs.appendFileSync(EXPERIMENTS_FILE, row + '\n', 'utf8');
    logger.info(`Logged experiment entry for video ${videoId} (Variant: ${variantId})`);
  } catch (err) {
    logger.warn(`Failed to log experiment video: ${err.message}`);
  }
}

module.exports = {
  logExperimentVideo,
  ensureCsvHeader,
  getGrowthConfig
};
