/**
 * Facebook Reels & Posts Exam GK Content Vault
 * High-Demand Geopolitics, Indian Static GK, History, Constitution, General Science & Math IQ
 * 120 Fact-Checked, High-Yield Educational Questions
 * Features Strict 30-Day Anti-Duplicate Guard (No question repeats within 30 days)
 */

const fs = require('fs');
const path = require('path');
const { scoreHook } = require('../utils/hook-scorer');

// Modular question categories (120 Total)
const geo = require('./data/geo_batch');
const stat = require('./data/stat_batch');
const hist = require('./data/hist_batch');
const pol = require('./data/pol_batch');
const sci = require('./data/sci_batch');
const math = require('./data/math_batch');

const EXAM_GK_QUESTIONS = [
  ...geo,
  ...stat,
  ...hist,
  ...pol,
  ...sci,
  ...math
];

class ContentVault {
  constructor() {
    this.historyFile = path.resolve(__dirname, 'data/history.json');
  }

  /**
   * Returns Set of IDs uploaded within the last N days (default 30)
   */
  getRecentlyUploadedIds(days = 30) {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const uploads = data.uploads || [];
        const recent = new Set();
        for (const u of uploads) {
          if (u.uploadedAt && new Date(u.uploadedAt).getTime() > cutoff) {
            recent.add(u.id);
          }
        }
        return recent;
      }
    } catch (_) {}
    return new Set();
  }

  /**
   * Returns Map of questionId -> latest uploaded timestamp
   */
  getLastUploadedMap() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
        const map = new Map();
        for (const u of data.uploads || []) {
          if (u.uploadedAt && u.id) {
            const time = new Date(u.uploadedAt).getTime();
            if (!map.has(u.id) || time > map.get(u.id)) {
              map.set(u.id, time);
            }
          }
        }
        return map;
      }
    } catch (_) {}
    return new Map();
  }

  /**
   * Returns Set of all uploaded IDs historically
   */
  getUploadedIds() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
        return new Set(data.uploadedIds || []);
      }
    } catch (_) {}
    return new Set();
  }

  /**
   * Records uploaded or exported Reel entry in history.json
   */
  recordUpload(item, uploadRes) {
    try {
      let data = { uploadedIds: [], uploads: [] };
      if (fs.existsSync(this.historyFile)) {
        data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
      if (!Array.isArray(data.uploadedIds)) data.uploadedIds = [];
      if (!Array.isArray(data.uploads)) data.uploads = [];

      const resolvedFbVideoId = uploadRes?.deliveryMode === 'ZERNIO_API'
        ? (uploadRes?.fbVideoId || null)
        : (uploadRes?.fbVideoId || uploadRes?.id || uploadRes?.videoId || null);

      data.uploadedIds.push(item.id);
      data.uploads.push({
        id: item.id,
        category: item.category,
        topic: item.topic,
        title: item.title,
        fbVideoId: resolvedFbVideoId,
        zernioPostId: uploadRes?.zernioPostId || null,
        deliveryMode: uploadRes?.deliveryMode || 'FACEBOOK_API',
        uploadedAt: new Date().toISOString(),
        answer: item.answerText,
      });
      fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2), 'utf8');
      console.log(`[ContentVault] ✅ Recorded history for question: ${item.id} ("${item.title}")`);
    } catch (err) {
      console.warn('Failed recording upload history:', err.message);
    }
  }

  /**
   * Retrieves a balanced batch of high-demand GK questions with strict 30-Day Anti-Duplicate Guard
   */
  async getBatchQuestions(count = 1) {
    const recentIds = this.getRecentlyUploadedIds(30);
    const lastUploadedMap = this.getLastUploadedMap();

    // 1. Available pool = questions NOT uploaded in the last 30 days
    const available = EXAM_GK_QUESTIONS.filter(q => !recentIds.has(q.id));

    console.log(`[ContentVault] 🛡️ 30-Day Anti-Duplicate Guard Active: ${available.length} questions available out of ${EXAM_GK_QUESTIONS.length} total (Recent in 30d: ${recentIds.size})`);

    let selected;
    if (available.length >= count) {
      const shuffled = [...available].sort(() => 0.5 - Math.random());
      selected = shuffled.slice(0, count);
    } else {
      // If pool is tight, sort ALL questions by least recently uploaded (oldest first)
      console.warn(`[ContentVault] ⚠️ Available pool (${available.length}) < requested (${count}). Selecting least recently used questions.`);
      const sortedByAge = [...EXAM_GK_QUESTIONS].sort((a, b) => {
        const timeA = lastUploadedMap.get(a.id) || 0;
        const timeB = lastUploadedMap.get(b.id) || 0;
        return timeA - timeB;
      });
      selected = sortedByAge.slice(0, count);
    }

    return selected.map(item => {
      const textToScore = `${item.title} ${item.questionLines.join(' ')}`;
      const virality = scoreHook(textToScore);
      return {
        ...item,
        virality: {
          score: virality.verdict,
          band: virality.band,
          formula: virality.formula,
          weakest: virality.weakest,
          fix: virality.fix
        }
      };
    });
  }

  // Alias for backward compatibility with existing runners/schedulers
  async getBatchRiddles(count = 1) {
    return this.getBatchQuestions(count);
  }
}

module.exports = {
  ContentVault,
  EXAM_GK_QUESTIONS,
  // Keep aliases so any legacy imports do not break
  DOUBLE_MEANING_RIDDLES: EXAM_GK_QUESTIONS,
  NORMAL_TRICKY_RIDDLES: EXAM_GK_QUESTIONS,
};
