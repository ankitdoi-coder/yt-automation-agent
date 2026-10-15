const fs = require('fs');
const path = require('path');
const { Logger } = require('./logger');

const logger = new Logger('QuizDeduplicator');
const STORAGE_FILE = path.resolve(__dirname, '..', 'data', 'used_quiz_questions.json');
const MAX_STORED_QUESTIONS = 1200;

function normalizeQuestionKey(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u0900-\u0903\u093C\u094D]/g, '') // remove nuktas, viramas for phonetic stability
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function loadUsedQuestionsData() {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const raw = fs.readFileSync(STORAGE_FILE, 'utf8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    }
  } catch (err) {
    logger.warn(`Failed to read ${STORAGE_FILE}: ${err.message}; starting fresh`);
  }
  return [];
}

function saveUsedQuestionsData(entries) {
  try {
    const dir = path.dirname(STORAGE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const trimmed = entries.slice(-MAX_STORED_QUESTIONS);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(trimmed, null, 2), 'utf8');
  } catch (err) {
    logger.warn(`Failed to persist used questions: ${err.message}`);
  }
}

/**
 * Returns a list of recently used question texts to inject into the LLM prompt
 * so the model is strictly instructed not to repeat them.
 */
function getRecentUsedQuestionTexts(limit = 100) {
  const data = loadUsedQuestionsData();
  const recent = data.slice(-limit).map(item => typeof item === 'string' ? item : item.question);
  return [...new Set(recent)].filter(Boolean);
}

/**
 * Returns a Set of normalized keys of all historically used questions.
 */
function getUsedQuestionKeysSet() {
  const data = loadUsedQuestionsData();
  const keys = new Set();
  for (const item of data) {
    const qText = typeof item === 'string' ? item : item.question;
    const key = normalizeQuestionKey(qText);
    if (key) keys.add(key);
  }
  return keys;
}

/**
 * Checks if a question text is duplicate or excessively similar to any previously recorded question.
 */
function isDuplicateQuestion(questionText, existingKeysSet) {
  if (!questionText || !existingKeysSet) return false;
  const key = normalizeQuestionKey(questionText);
  if (!key) return false;
  if (existingKeysSet.has(key)) return true;

  // Check prefix or high overlap
  for (const existing of existingKeysSet) {
    if (existing.length > 25 && key.length > 25) {
      if (existing.startsWith(key) || key.startsWith(existing)) return true;
    }
  }
  return false;
}

/**
 * Records newly generated questions into persistent history so subsequent slots
 * and future daily runs will never duplicate them.
 */
function recordGeneratedQuestions(questions = [], topic = '') {
  if (!Array.isArray(questions) || questions.length === 0) return;
  const current = loadUsedQuestionsData();
  const existingKeys = new Set(current.map(item => normalizeQuestionKey(typeof item === 'string' ? item : item.question)));

  let added = 0;
  for (const q of questions) {
    const qText = String(q.question || q.q || '').trim();
    if (!qText) continue;
    const key = normalizeQuestionKey(qText);
    if (existingKeys.has(key)) continue;

    existingKeys.add(key);
    current.push({
      question: qText,
      topic: topic || '',
      timestamp: new Date().toISOString()
    });
    added++;
  }

  if (added > 0) {
    saveUsedQuestionsData(current);
    logger.info(`Recorded ${added} new question(s) to persistent deduplication history (total: ${current.length})`);
  }
}

module.exports = {
  normalizeQuestionKey,
  getRecentUsedQuestionTexts,
  getUsedQuestionKeysSet,
  isDuplicateQuestion,
  recordGeneratedQuestions
};
