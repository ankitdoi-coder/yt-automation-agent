const fs = require('fs');
const path = require('path');
const { Logger } = require('./logger');

const logger = new Logger('QuizDeduplicator');
const STORAGE_FILE = path.resolve(__dirname, '..', 'data', 'used_quiz_questions.json');
const CONFIG_FILE = path.resolve(__dirname, '..', 'config', 'growth.json');
const MAX_STORED_QUESTIONS = 2000;

function getGrowthConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
    }
  } catch (err) {
    // fallback to defaults
  }
  return {};
}

// Stopwords in Hindi and English commonly appearing in MCQs that don't indicate semantic uniqueness
const HINDI_STOPWORDS = new Set([
  'का', 'के', 'की', 'में', 'से', 'को', 'है', 'हैं', 'था', 'थी', 'थे', 'होता', 'होती', 'होते',
  'कौन', 'सा', 'सी', 'किस', 'क्या', 'किसे', 'कहाँ', 'कहा', 'कहाँ', 'कब', 'क्यों', 'कैसे',
  'द्वारा', 'पर', 'और', 'तथा', 'एवं', 'या', 'नहीं', 'यह', 'वह', 'इस', 'उस', 'इन्हें', 'उन्हें',
  'निम्नलिखित', 'निम्न', 'में', 'से', 'एक', 'दो', 'गया', 'गई', 'गए', 'किया', 'हुए', 'हुआ', 'हुई',
  'वाले', 'वाली', 'वाला', 'कहा', 'जाता', 'जाती', 'जाते', 'दिए', 'दौरान', 'प्रसिद्ध', 'प्रमुख',
  'बताइए', 'बताएं', 'कहते', 'नाम', 'वर्ष', 'स्थान', 'रूप', 'समय', 'कुल', 'अनुसार', 'केन्द्र', 'राज्य'
]);

const ENGLISH_STOPWORDS = new Set([
  'the', 'is', 'at', 'which', 'on', 'in', 'of', 'for', 'and', 'or', 'to', 'a', 'an', 'by',
  'what', 'who', 'when', 'where', 'why', 'how', 'which', 'following', 'called', 'known', 'as'
]);

function normalizeQuestionKey(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[\u0900-\u0903\u093C\u094D]/g, '') // remove nuktas, viramas for phonetic stability
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 100);
}

/**
 * Extracts substantive entity/content tokens from a question text by removing stopwords and short particles.
 */
function extractContentTokens(text = '') {
  const normalized = String(text || '')
    .toLowerCase()
    .replace(/[\u093C\u094D]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ')
    .trim();

  const words = normalized.split(/\s+/).filter(Boolean);
  const content = [];

  for (const word of words) {
    if (word.length <= 1) continue;
    if (HINDI_STOPWORDS.has(word) || ENGLISH_STOPWORDS.has(word)) continue;
    content.push(word);
  }

  return new Set(content);
}

/**
 * Calculates Jaccard token similarity: |A ∩ B| / |A ∪ B|
 */
function calculateJaccardSimilarity(tokensA, tokensB) {
  if (!tokensA || !tokensB || tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokensA) {
    if (tokensB.has(token)) intersection++;
  }
  const union = tokensA.size + tokensB.size - intersection;
  return union > 0 ? (intersection / union) : 0;
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
 * Returns a list of recently used question texts to inject into the LLM prompt.
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
 * Robust check if a question is duplicate or semantically overlapping.
 * Checks:
 * 1. Exact or prefix match.
 * 2. Token Jaccard similarity > threshold (e.g. 0.40).
 * 3. Answer collision: if both questions share the exact correct answer and >= 1 core subject keywords.
 */
function isDuplicateQuestion(candidate, existingCollection, options = {}) {
  if (!candidate || !existingCollection) return false;

  const candidateText = typeof candidate === 'string' ? candidate : (candidate.question || candidate.q || '');
  if (!candidateText) return false;

  const candidateKey = normalizeQuestionKey(candidateText);
  if (!candidateKey) return false;

  const growth = getGrowthConfig();
  const threshold = options.threshold || growth.longVideos?.dedupSimilarityThreshold || 0.45;
  const candidateTokens = extractContentTokens(candidateText);

  // Candidate answer if object
  const candidateAnswer = typeof candidate === 'object' && candidate.options && candidate.answerIndex !== undefined
    ? String(candidate.options[candidate.answerIndex] || '').trim().toLowerCase()
    : null;

  // Handle Set of strings vs Array of objects/strings
  if (existingCollection instanceof Set) {
    if (existingCollection.has(candidateKey)) return true;

    for (const existing of existingCollection) {
      if (typeof existing === 'string') {
        if (existing.length > 20 && candidateKey.length > 20) {
          if (existing.startsWith(candidateKey) || candidateKey.startsWith(existing)) return true;
        }
        const existingTokens = extractContentTokens(existing);
        const sim = calculateJaccardSimilarity(candidateTokens, existingTokens);
        if (sim >= threshold) return true;
      }
    }
    return false;
  }

  if (Array.isArray(existingCollection)) {
    for (const item of existingCollection) {
      const existingText = typeof item === 'string' ? item : (item.question || item.q || '');
      if (!existingText) continue;

      const existingKey = normalizeQuestionKey(existingText);
      if (existingKey === candidateKey) return true;

      if (existingKey.length > 20 && candidateKey.length > 20) {
        if (existingKey.startsWith(candidateKey) || candidateKey.startsWith(existingKey)) return true;
      }

      const existingTokens = extractContentTokens(existingText);
      const sim = calculateJaccardSimilarity(candidateTokens, existingTokens);
      if (sim >= threshold) {
        logger.info(`Semantic duplicate rejected (similarity ${(sim * 100).toFixed(1)}% >= ${threshold * 100}%): "${candidateText.slice(0, 40)}" vs "${existingText.slice(0, 40)}"`);
        return true;
      }

      // Check answer collision if both provide options & answerIndex
      if (candidateAnswer && typeof item === 'object' && item.options && item.answerIndex !== undefined) {
        const itemAnswer = String(item.options[item.answerIndex] || '').trim().toLowerCase();
        if (candidateAnswer.length > 2 && candidateAnswer === itemAnswer) {
          // If answers are identical, check if they share any substantive token
          let sharedTokens = 0;
          for (const tok of candidateTokens) {
            if (existingTokens.has(tok)) sharedTokens++;
          }
          if (sharedTokens >= 1) {
            logger.info(`Answer-entity collision rejected (identical answer "${candidateAnswer}" with shared token): "${candidateText.slice(0, 40)}"`);
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Records newly generated questions into persistent history.
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
  extractContentTokens,
  calculateJaccardSimilarity,
  getRecentUsedQuestionTexts,
  getUsedQuestionKeysSet,
  isDuplicateQuestion,
  recordGeneratedQuestions
};
