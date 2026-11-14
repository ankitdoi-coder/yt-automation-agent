const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 5000;
const MAX_TAGS_LENGTH = 450;

function removeControlCharacters(value, replacement = '') {
  return Array.from(String(value ?? '')).map(character => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? replacement : character;
  }).join('');
}

function cleanText(value) {
  return removeControlCharacters(value, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeTags(input) {
  const values = Array.isArray(input) ? input : String(input || '').split(',');
  const unique = [];
  const seen = new Set();
  let totalLength = 0;

  for (const value of values) {
    const tag = cleanText(value).replace(/^#+/, '').replaceAll('"', '').slice(0, 100).trim();
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    const nextLength = totalLength + tag.length + (unique.length ? 1 : 0);
    if (nextLength > MAX_TAGS_LENGTH || unique.length >= 30) break;
    unique.push(tag);
    seen.add(key);
    totalLength = nextLength;
  }

  return unique;
}

function enforceEnglishShortTitle(title, metadata = {}) {
  let cleaned = cleanText(title);
  const isShort = /#shorts?\b/i.test(cleaned) ||
    metadata?.isShort === true ||
    String(metadata?.contentType || '').includes('short') ||
    String(metadata?.style || '').includes('short');

  if (!isShort) {
    return cleaned;
  }

  // Strictly enforce 100% English title: Zero Hindi / Devanagari words allowed
  if (/[\u0900-\u097F]/.test(cleaned)) {
    const partMatch = cleaned.match(/(?:part|भाग)\s*[-:]?\s*(\d+)/i);
    const partNum = partMatch ? partMatch[1] : '1';
    const qMatch = cleaned.match(/(?:top|टॉप)\s*(\d+)/i) || cleaned.match(/(\d+)\s*(?:mcq|questions|प्रश्न)/i);
    const qCount = qMatch ? qMatch[1] : '10';

    let catName = 'Static GK';
    if (/(?:science|विज्ञान|biology|physics|chemistry|जीव\s*विज्ञान|भौतिक|रसायन)/i.test(cleaned)) {
      catName = 'General Science';
    } else if (/(?:polity|संविधान|constitution|article|अनुच्छेद|संसद|राष्ट्रपति)/i.test(cleaned)) {
      catName = 'Indian Polity';
    } else if (/(?:history|इतिहास|मौर्य|गुप्त|मुगल|1857|हड़प्पा|सिंधु)/i.test(cleaned)) {
      catName = 'Indian History';
    } else if (/(?:geography|भूगोल|river|dam|नदी|बांध|पर्वत|दर्रा|झील)/i.test(cleaned)) {
      catName = 'Indian Geography';
    }

    cleaned = `${catName} Part ${partNum} | Top ${qCount} MCQs 🎯 #shorts`;
  }

  // Strip any accidental Devanagari characters
  cleaned = cleaned.replace(/[\u0900-\u097F]/g, '').replace(/\s+/g, ' ').trim();
  if (!/#shorts?\b/i.test(cleaned)) {
    cleaned = (cleaned.slice(0, 41).trim() + ' #shorts').trim();
  }

  return cleaned.slice(0, MAX_TITLE_LENGTH);
}

function normalizeYouTubeMetadata(metadata = {}) {
  const snippet = metadata.snippet || metadata.seo || metadata;
  let rawTitle = cleanText(snippet.title);
  const isShort = /#shorts?\b/i.test(rawTitle) ||
    metadata?.isShort === true ||
    snippet?.isShort === true ||
    String(metadata?.contentType || snippet?.contentType || '').includes('short');

  if (isShort) {
    rawTitle = enforceEnglishShortTitle(rawTitle, metadata);
  }

  return {
    title: rawTitle.slice(0, MAX_TITLE_LENGTH),
    description: removeControlCharacters(snippet.description).slice(0, MAX_DESCRIPTION_LENGTH).trim(),
    tags: normalizeTags(snippet.tags),
    categoryId: String(snippet.categoryId ?? snippet.metadata?.category ?? process.env.YOUTUBE_CATEGORY_ID ?? '27').trim(),
    defaultLanguage: String(snippet.defaultLanguage ?? snippet.metadata?.language ?? process.env.YOUTUBE_DEFAULT_LANGUAGE ?? 'hi').trim(),
    defaultAudioLanguage: String(snippet.defaultAudioLanguage ?? snippet.metadata?.language ?? process.env.YOUTUBE_DEFAULT_AUDIO_LANGUAGE ?? 'hi').trim()
  };
}

function validateYouTubeMetadata(metadata = {}) {
  const value = normalizeYouTubeMetadata(metadata);
  const errors = [];
  const warnings = [];

  if (!value.title) errors.push('A video title is required.');
  if (value.title.length > MAX_TITLE_LENGTH) errors.push(`Title exceeds ${MAX_TITLE_LENGTH} characters.`);
  if (!value.description) warnings.push('The video description is empty.');
  if (value.description.length > MAX_DESCRIPTION_LENGTH) errors.push(`Description exceeds ${MAX_DESCRIPTION_LENGTH} characters.`);
  if (!/^\d{1,3}$/.test(value.categoryId)) errors.push('YouTube category must be a numeric category ID.');
  if (!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(value.defaultLanguage)) errors.push('Default language must be a valid language code.');
  if (value.tags.length < 3) warnings.push('Fewer than three usable tags remain after validation.');

  return { valid: errors.length === 0, errors, warnings, value };
}

function assertValidYouTubeMetadata(metadata = {}) {
  const result = validateYouTubeMetadata(metadata);
  if (!result.valid) {
    const error = new Error(`YouTube metadata is invalid: ${result.errors.join(' ')}`);
    error.code = 'INVALID_YOUTUBE_METADATA';
    error.validation = result;
    throw error;
  }
  return result;
}

module.exports = {
  MAX_TITLE_LENGTH,
  MAX_DESCRIPTION_LENGTH,
  MAX_TAGS_LENGTH,
  normalizeTags,
  enforceEnglishShortTitle,
  normalizeYouTubeMetadata,
  validateYouTubeMetadata,
  assertValidYouTubeMetadata
};
