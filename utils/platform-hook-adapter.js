// utils/platform-hook-adapter.js
// Adapts the same quiz content's hook for different platform distribution strategies

'use strict';

const PLATFORM_STRATEGIES = {
  youtube: {
    // YouTube: keyword-first, SEO-friendly, 60-70 chars max for title
    // Pattern: "[Topic] Quiz | [Exam] | [Year if relevant]"
    // Example: "India Geography GK Quiz | SSC CGL 2024"
    maxChars: 70,
    preferKeywordFirst: true,
    preferHindi: false,
    preferEmoji: false,
  },
  instagram: {
    // Instagram: scroll-stop curiosity/challenge, 50-65 chars for first-frame overlay
    // Pattern: "[Challenge/Shock] + [Topic]"
    // Example: "97% fail this! 🔥" or "SSC topper bhi galat karte!"
    maxChars: 65,
    preferKeywordFirst: false,
    preferHindi: true,
    preferEmoji: true,
  },
  facebook: {
    // Facebook: benefit-led, slightly longer
    maxChars: 60,
    preferKeywordFirst: false,
    preferHindi: false,
    preferEmoji: true,
  },
};

// Map item.category → human-readable label per platform
const CATEGORY_LABELS = {
  geography:   'Geography',
  geopolitics: 'Geography',
  geo:         'Geography',
  history:     'History',
  hist:        'History',
  polity:      'Polity/Constitution',
  pol:         'Polity/Constitution',
  science:     'Science',
  sci:         'Science',
  math:        'Math IQ',
  math_quiz:   'Math IQ',
  static:      'GK',
  current:     'Current Affairs',
  default:     'GK',
};

// Best exam match per category for YouTube
const CATEGORY_EXAM = {
  geography:   'SSC CGL',
  geopolitics: 'UPSC',
  geo:         'SSC CGL',
  history:     'UPSC',
  hist:        'UPSC',
  polity:      'UPSC',
  pol:         'UPSC',
  science:     'SSC CGL',
  sci:         'SSC CGL',
  math:        'SSC CGL',
  math_quiz:   'SSC CGL',
  static:      'SSC/Railway',
  current:     'UPSC',
  default:     'SSC/Railway',
};

// Hindi exam labels for Instagram
const CATEGORY_EXAM_HINDI = {
  geography:   'SSC',
  geopolitics: 'UPSC',
  geo:         'SSC',
  history:     'UPSC',
  hist:        'UPSC',
  polity:      'UPSC',
  pol:         'UPSC',
  science:     'SSC',
  sci:         'SSC',
  math:        'SSC',
  math_quiz:   'SSC',
  static:      'SSC/Railway',
  current:     'UPSC',
  default:     'SSC',
};

/**
 * Resolve a category key to its label, trying multiple fallback forms.
 */
function resolveCategory(category, map) {
  if (!category) return map.default;
  const key = String(category).toLowerCase().replace(/[_-]/g, '');
  // Try exact, then prefix match
  for (const [k, v] of Object.entries(map)) {
    if (key === k.replace(/[_-]/g, '')) return v;
  }
  for (const [k, v] of Object.entries(map)) {
    if (key.startsWith(k.replace(/[_-]/g, ''))) return v;
  }
  return map.default;
}

/**
 * Extract a short English topic keyword from item.topic (strip Hindi in parens / after dash).
 * Falls back to item.title then 'GK'.
 */
function extractTopicKeyword(item) {
  const raw = item.topic || item.title || '';
  // If topic contains English after a parenthesis: "अभाज्य संख्या (Prime Numbers)" → "Prime Numbers"
  const parenMatch = raw.match(/\(([A-Za-z][^)]+)\)/);
  if (parenMatch) return parenMatch[1].trim();
  // If topic has English words, use those
  const englishWords = raw.match(/[A-Za-z][\w\s]*/g);
  if (englishWords && englishWords.length > 0) return englishWords.join(' ').trim();
  // Fall back to category label
  return resolveCategory(item.category, CATEGORY_LABELS);
}

/**
 * Trim a string to maxChars, cutting at last space if possible.
 */
function trimTo(str, maxChars) {
  if (!maxChars || str.length <= maxChars) return str;
  const cut = str.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return lastSpace > 0 ? cut.slice(0, lastSpace) : cut;
}

// ─── Platform adapters ────────────────────────────────────────────────────────

function adaptForYouTube(item) {
  const strategy = PLATFORM_STRATEGIES.youtube;
  const topicKw  = extractTopicKeyword(item);
  const catLabel = resolveCategory(item.category, CATEGORY_LABELS);
  const exam     = resolveCategory(item.category, CATEGORY_EXAM);

  // "India [Topic] GK Quiz | [Exam]"
  // If topic keyword IS the category label, avoid repetition
  let hook;
  if (topicKw.toLowerCase() === catLabel.toLowerCase()) {
    hook = `India ${catLabel} GK Quiz | ${exam}`;
  } else {
    hook = `India ${topicKw} GK Quiz | ${exam}`;
  }

  return trimTo(hook, strategy.maxChars);
}

function adaptForInstagram(item) {
  const strategy = PLATFORM_STRATEGIES.instagram;
  const catLabel = resolveCategory(item.category, CATEGORY_LABELS);
  const exam     = resolveCategory(item.category, CATEGORY_EXAM_HINDI);

  // "97% [exam] students fail karte hain yeh [category] sawaal! 🔥"
  const hook = `97% ${exam} students fail karte hain yeh ${catLabel} sawaal! 🔥`;

  return trimTo(hook, strategy.maxChars);
}

function adaptForFacebook(item) {
  const strategy = PLATFORM_STRATEGIES.facebook;
  const topicKw  = extractTopicKeyword(item);
  const catLabel = resolveCategory(item.category, CATEGORY_LABELS);

  // "Can you answer this? [Topic] Quiz | Comment your answer! 💡"
  const label = topicKw.toLowerCase() === catLabel.toLowerCase() ? catLabel : topicKw;
  const hook  = `Can you answer this? ${label} Quiz | Comment your answer! 💡`;

  return trimTo(hook, strategy.maxChars);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * adaptHookForPlatform(hookText, item, platform)
 * Takes an existing hook + quiz item, returns a platform-optimized hook.
 *
 * @param {string} hookText   - The original hook/title text (may be ignored or used as fallback)
 * @param {object} item       - Quiz item: { title, topic, category, question, answer }
 * @param {string} platform   - 'youtube' | 'instagram' | 'facebook'
 * @returns {{ platform, originalHook, adaptedHook, strategy }}
 */
function adaptHookForPlatform(hookText = '', item = {}, platform = 'instagram') {
  const strategy = PLATFORM_STRATEGIES[platform] || PLATFORM_STRATEGIES.instagram;

  let adaptedHook;
  switch (platform) {
    case 'youtube':
      adaptedHook = adaptForYouTube(item);
      break;
    case 'facebook':
      adaptedHook = adaptForFacebook(item);
      break;
    case 'instagram':
    default:
      adaptedHook = adaptForInstagram(item);
  }

  return {
    platform,
    originalHook: hookText,
    adaptedHook,
    strategy,
  };
}

/**
 * generatePlatformHooks(item)
 * Generates optimised hooks for all 3 platforms at once.
 *
 * @param {object} item - Quiz item: { title, topic, category, question, answer }
 * @returns {{ youtube, instagram, facebook }} — each with adaptedHook + strategy
 */
function generatePlatformHooks(item = {}) {
  const originalHook = item.title || item.topic || '';

  const youtube   = adaptHookForPlatform(originalHook, item, 'youtube');
  const instagram = adaptHookForPlatform(originalHook, item, 'instagram');
  const facebook  = adaptHookForPlatform(originalHook, item, 'facebook');

  return { youtube, instagram, facebook };
}

module.exports = { adaptHookForPlatform, generatePlatformHooks, PLATFORM_STRATEGIES };
