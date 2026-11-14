// utils/caption-linter.js
// Instagram caption fold optimization & quality linting

const FOLD_CHAR_LIMIT = 125;      // chars visible before "...more" on mobile
const MAX_HASHTAGS = 30;          // Instagram hard limit
const OPTIMAL_HASHTAGS = 10;      // sweet spot for reach
const MAX_CAPTION_LENGTH = 2200;  // Instagram hard limit

// Emoji sets per category for auto-fix
const CATEGORY_EMOJIS = {
  geography:  '🗺️',
  history:    '📜',
  polity:     '⚖️',
  science:    '🔬',
  math:       '🔢',
  static:     '📚',
  default:    '🎯',
};

// Standard GK hashtag sets per category
const HASHTAG_SETS = {
  geography: '#IndiaGK #Geography #SSCExam #RailwayExam #UPSC #IndianGeography #GKQuiz #ExamIQBharat #CurrentAffairs #GKHindi',
  history:   '#IndianHistory #SSCHistory #UPSC #GKQuiz #ExamIQBharat #HistoryGK #IndiaGK #RailwayGK',
  polity:    '#IndianPolity #Constitution #UPSC #SSCExam #Polity #GKQuiz #ExamIQBharat #IndiaGK',
  science:   '#GeneralScience #ScienceGK #SSCExam #RailwayGK #GKQuiz #ExamIQBharat #Science',
  math:      '#MathIQ #MathTricks #SSCMath #RailwayMath #GKQuiz #ExamIQBharat #MathQuiz',
  static:    '#StaticGK #IndiaGK #SSCExam #UPSC #GKQuiz #ExamIQBharat #CurrentAffairs',
};

// CTA keywords that signal a call-to-action line
const CTA_PATTERNS = [
  /comment\s+(mein|me|kar|karo|kijiye)/i,
  /comment\s+below/i,
  /batao/i,
  /share\s+(karo|kar|karein)/i,
  /like\s+(karo|kar|karein|this)/i,
  /follow\s+(karo|kar|karein|us)/i,
  /save\s+(karo|kar|karein|this)/i,
  /tag\s+(your|apne|karo)/i,
  /answer\s+in\s+comment/i,
  /jawab\s+do/i,
  /reply\s+(karo|kar|karein|below)/i,
  /subscribe\s+(karo|kar|karein)?/i,
  /click\s+(link|here)/i,
  /swipe\s+up/i,
];

/**
 * Checks if a string starts with an emoji character.
 */
function startsWithEmoji(str) {
  // Unicode ranges: Emoji, Dingbats, Misc Symbols, etc.
  return /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})/u.test(str.trim());
}

/**
 * Counts hashtags in a caption string.
 */
function countHashtags(caption) {
  const matches = caption.match(/#\w+/g);
  return matches ? matches.length : 0;
}

/**
 * Checks if the caption has a call-to-action before the hashtag block.
 */
function hasCTA(captionWithoutHashtags) {
  return CTA_PATTERNS.some(p => p.test(captionWithoutHashtags));
}

/**
 * Returns the caption text before the first hashtag.
 */
function getBodyText(caption) {
  const firstHashPos = caption.indexOf('#');
  return firstHashPos === -1 ? caption : caption.slice(0, firstHashPos);
}

/**
 * Checks if there is a blank line or newline immediately before the hashtag block.
 */
function hasLineBreakBeforeHashtags(caption) {
  const firstHashPos = caption.indexOf('#');
  if (firstHashPos === -1) return true; // no hashtags → not an issue
  const before = caption.slice(0, firstHashPos);
  return /\n\s*$/.test(before);
}

/**
 * Lints an Instagram caption and returns quality issues, warnings and a score.
 *
 * @param {string} caption
 * @param {object} options
 * @returns {{
 *   passed: boolean,
 *   issues: string[],
 *   warnings: string[],
 *   foldPreview: string,
 *   score: number,
 *   fixes: object
 * }}
 */
function lintCaption(caption, options = {}) {
  const cap = String(caption || '');
  const issues = [];
  const warnings = [];
  const fixes = {};

  const foldPreview = cap.slice(0, FOLD_CHAR_LIMIT);
  const firstLine = cap.split('\n')[0];
  const hashtagCount = countHashtags(cap);
  const bodyText = getBodyText(cap);

  // --- Check 1: Hook within fold limit ---
  if (firstLine.length > FOLD_CHAR_LIMIT) {
    issues.push(`hook_too_long: first line is ${firstLine.length} chars (limit ${FOLD_CHAR_LIMIT})`);
    fixes.hook_too_long = `Shorten first line to ≤${FOLD_CHAR_LIMIT} chars. Current: "${firstLine.slice(0, 80)}..."`;
  }

  // --- Check 2: Starts with emoji ---
  if (!startsWithEmoji(cap)) {
    warnings.push('no_leading_emoji: caption does not start with an emoji (emojis boost tap-through)');
    fixes.no_leading_emoji = `Add a relevant emoji at the very start of the caption.`;
  }

  // --- Check 3: Hashtag count ---
  if (hashtagCount > MAX_HASHTAGS) {
    issues.push(`too_many_hashtags: ${hashtagCount} hashtags (Instagram hard limit is ${MAX_HASHTAGS})`);
    fixes.too_many_hashtags = `Remove ${hashtagCount - 25} hashtags (trim to 25 for safety margin).`;
  } else if (hashtagCount === 0) {
    warnings.push('no_hashtags: no hashtags found — reach will be severely limited');
    fixes.no_hashtags = `Add 8-${OPTIMAL_HASHTAGS} relevant hashtags.`;
  } else if (hashtagCount < 5) {
    warnings.push(`low_hashtags: only ${hashtagCount} hashtags — aim for at least 8-${OPTIMAL_HASHTAGS}`);
    fixes.low_hashtags = `Add more niche + broad hashtags (aim for ${OPTIMAL_HASHTAGS}).`;
  }

  // --- Check 4: Total length ---
  if (cap.length > MAX_CAPTION_LENGTH) {
    issues.push(`caption_too_long: ${cap.length} chars (Instagram max is ${MAX_CAPTION_LENGTH})`);
    fixes.caption_too_long = `Trim caption body to fit within ${MAX_CAPTION_LENGTH} chars.`;
  }

  // --- Check 5: Call to action before hashtags ---
  if (!hasCTA(bodyText)) {
    warnings.push('no_cta: no call-to-action detected before hashtags (e.g., "Comment mein batao!")');
    fixes.no_cta = `Add a CTA line like "Comment mein jawab do! 👇" before the hashtags.`;
  }

  // --- Check 6: Line break before hashtags ---
  if (hashtagCount > 0 && !hasLineBreakBeforeHashtags(cap)) {
    warnings.push('no_linebreak_before_hashtags: hashtags should be separated from body by a newline');
    fixes.no_linebreak_before_hashtags = `Insert a blank line or newline before the first hashtag.`;
  }

  // --- Score calculation (100 points) ---
  let score = 100;
  score -= issues.length * 20;      // each blocking issue: -20
  score -= warnings.length * 8;     // each warning: -8
  // Bonus: has emoji (+5), good hashtag count (+5)
  if (startsWithEmoji(cap)) score += 5;
  if (hashtagCount >= 8 && hashtagCount <= MAX_HASHTAGS) score += 5;
  // Clamp
  score = Math.max(0, Math.min(100, score));

  return {
    passed: issues.length === 0,
    issues,
    warnings,
    foldPreview,
    score,
    fixes,
  };
}

/**
 * Attempts to auto-fix common caption issues.
 *
 * @param {string} caption
 * @param {object} item - Quiz item (may have .category for emoji selection)
 * @returns {{ fixed: boolean, caption: string, changes: string[] }}
 */
function autoFixCaption(caption, item = {}) {
  let cap = String(caption || '').trim();
  const changes = [];

  // Separate body from hashtag block
  const firstHashIdx = cap.search(/#\w/);
  let body = firstHashIdx !== -1 ? cap.slice(0, firstHashIdx).trim() : cap;
  let hashtags = firstHashIdx !== -1 ? cap.slice(firstHashIdx).trim() : '';

  // Fix 1: Hook too long — truncate first line to 120 + "…"
  const lines = body.split('\n');
  if (lines[0].length > FOLD_CHAR_LIMIT) {
    lines[0] = lines[0].slice(0, 120) + '…';
    body = lines.join('\n');
    changes.push('hook truncated to 120 chars');
  }

  // Fix 2: No emoji at start — prepend category emoji
  if (!startsWithEmoji(body)) {
    const category = String(item.category || item.topic || '').toLowerCase();
    const emoji = CATEGORY_EMOJIS[category] || CATEGORY_EMOJIS.default;
    body = `${emoji} ${body}`;
    changes.push(`added ${emoji} emoji prefix`);
  }

  // Fix 3: Too many hashtags — trim to 25
  if (hashtags) {
    const tags = hashtags.match(/#\w+/g) || [];
    if (tags.length > MAX_HASHTAGS) {
      hashtags = tags.slice(0, 25).join(' ');
      changes.push('trimmed hashtags to 25');
    }
  }

  // Reassemble with clean line break before hashtags
  if (hashtags) {
    cap = `${body}\n\n${hashtags}`;
    changes.push('added newline before hashtags');
  } else {
    cap = body;
  }

  return {
    fixed: changes.length > 0,
    caption: cap,
    changes,
  };
}

/**
 * Returns the standard hashtag string for a given quiz category.
 * @param {string} category
 * @returns {string}
 */
function getHashtagsForCategory(category) {
  const key = String(category || '').toLowerCase().trim();
  return HASHTAG_SETS[key] || HASHTAG_SETS.static;
}

module.exports = {
  lintCaption,
  autoFixCaption,
  getHashtagsForCategory,
  FOLD_CHAR_LIMIT,
  MAX_HASHTAGS,
  OPTIMAL_HASHTAGS,
  MAX_CAPTION_LENGTH,
  HASHTAG_SETS,
};
