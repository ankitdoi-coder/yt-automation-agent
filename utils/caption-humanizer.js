// utils/caption-humanizer.js
// Removes ChatGPT/AI tells from Instagram captions (pure regex/rules — no API, zero cost)

// English AI tells to remove/replace
const EN_REPLACEMENTS = [
  // Em dash variants → hyphen
  { pattern: / — /g,                   replacement: ' - ',         label: 'em-dash (spaced)' },
  { pattern: /—/g,                     replacement: '-',           label: 'em-dash' },
  // AI verbiage
  { pattern: /\bdelve into\b/gi,       replacement: 'explore',     label: 'delve into' },
  { pattern: /\bdive deep\b/gi,        replacement: 'go deep',     label: 'dive deep' },
  { pattern: /\bcomprehensive\b/gi,    replacement: 'complete',    label: 'comprehensive' },
  { pattern: /\bFurthermore,?\b/gi,    replacement: 'Also,',       label: 'Furthermore' },
  { pattern: /\bMoreover,?\b/gi,       replacement: 'Plus,',       label: 'Moreover' },
  { pattern: /\bIn conclusion,?\b/gi,  replacement: 'So,',         label: 'In conclusion' },
  { pattern: /\bIt is worth noting that\b/gi, replacement: 'Note:', label: 'It is worth noting that' },
  { pattern: /\bIt'?s important to note\b/gi, replacement: 'Remember:', label: "It's important to note" },
  { pattern: /\bcertainly\b/gi,        replacement: '',            label: 'certainly' },
  { pattern: /\babsolutely\b/gi,       replacement: '',            label: 'absolutely' },
  { pattern: /\bRevolutionize\b/g,     replacement: 'Change',      label: 'Revolutionize (cap)' },
  { pattern: /\bRevolutionizes\b/g,    replacement: 'Changes',     label: 'Revolutionizes (cap)' },
  { pattern: /\bRevolutionized\b/g,    replacement: 'Changed',     label: 'Revolutionized (cap)' },
  { pattern: /\bRevolutionizing\b/g,   replacement: 'Changing',    label: 'Revolutionizing (cap)' },
  { pattern: /\brevolutionize\b/gi,    replacement: 'change',      label: 'revolutionize' },
  { pattern: /\bgame-changer\b/gi,     replacement: 'big deal',    label: 'game-changer' },
  { pattern: /\bleverage\b/gi,         replacement: 'use',         label: 'leverage' },
  { pattern: /\butilize\b/gi,          replacement: 'use',         label: 'utilize' },
  { pattern: /\bfacilitate\b/gi,       replacement: 'help',        label: 'facilitate' },
  { pattern: /\bimplement\b/gi,        replacement: 'use',         label: 'implement' },
  { pattern: /\bcutting-edge\b/gi,     replacement: 'latest',      label: 'cutting-edge' },
  { pattern: /\bstate-of-the-art\b/gi, replacement: 'advanced',    label: 'state-of-the-art' },
  { pattern: /\bseamlessly\b/gi,       replacement: '',            label: 'seamlessly' },
  { pattern: /\bintricate\b/gi,        replacement: 'complex',     label: 'intricate' },
  { pattern: /\bmeticulously\b/gi,     replacement: 'carefully',   label: 'meticulously' },
  { pattern: /\bunpack\b/gi,           replacement: 'explain',     label: 'unpack' },
  { pattern: /\bnavigate\b/gi,         replacement: 'go through',  label: 'navigate' },
  { pattern: /\btailored\b/gi,         replacement: 'made',        label: 'tailored' },
  { pattern: /\bempowering\b/gi,       replacement: 'helping',     label: 'empowering' },
  { pattern: /\bembark on\b/gi,        replacement: 'start',       label: 'embark on' },
  { pattern: /\bin today's (world|era|age|time)\b/gi, replacement: 'now', label: "in today's world" },
  { pattern: /\bit is essential to\b/gi, replacement: 'you should', label: 'it is essential to' },
  { pattern: /\bit is crucial to\b/gi,   replacement: 'you must',  label: 'it is crucial to' },
];

// Hindi AI tells to remove/replace
const HI_REPLACEMENTS = [
  { pattern: /निश्चित रूप से/g,        replacement: '',               label: 'निश्चित रूप से' },
  { pattern: /बिल्कुल/g,              replacement: '',               label: 'बिल्कुल' },
  { pattern: /अवश्य/g,               replacement: '',               label: 'अवश्य' },
  { pattern: /सुनिश्चित करें/g,        replacement: 'ध्यान दें',      label: 'सुनिश्चित करें' },
  { pattern: /महत्वपूर्ण बात यह है कि/g, replacement: 'ध्यान दें —', label: 'महत्वपूर्ण बात यह है कि' },
  { pattern: /वास्तव में/g,            replacement: '',               label: 'वास्तव में' },
  { pattern: /इसके अलावा,?/g,          replacement: 'साथ ही,',       label: 'इसके अलावा' },
  { pattern: /निस्संदेह/g,            replacement: '',               label: 'निस्संदेह' },
  { pattern: /यह ध्यान देने योग्य है कि/g, replacement: 'ध्यान दें:', label: 'यह ध्यान देने योग्य है कि' },
];

/**
 * Humanizes a single caption string.
 * @param {string} text - The raw caption (Hindi/English/Hinglish).
 * @param {object} options - Reserved for future use.
 * @returns {{ original: string, humanized: string, changesCount: number, aiTellsFound: string[] }}
 */
function humanizeCaption(text, options = {}) {
  const original = String(text || '');
  let humanized = original;
  const aiTellsFound = [];

  // Apply English replacements
  for (const rule of EN_REPLACEMENTS) {
    const before = humanized;
    humanized = humanized.replace(rule.pattern, rule.replacement);
    if (humanized !== before) {
      aiTellsFound.push(rule.label);
    }
  }

  // Apply Hindi replacements
  for (const rule of HI_REPLACEMENTS) {
    const before = humanized;
    humanized = humanized.replace(rule.pattern, rule.replacement);
    if (humanized !== before) {
      aiTellsFound.push(rule.label);
    }
  }

  // Fix double spaces introduced by empty-string removals
  humanized = humanized.replace(/  +/g, ' ');
  // Fix "Also,," double comma after replacement collisions
  humanized = humanized.replace(/,{2,}/g, ',');
  // Fix orphaned leading comma at start of a word or sentence
  humanized = humanized.replace(/ ,/g, ',');
  // Trim
  humanized = humanized.trim();

  return {
    original,
    humanized,
    changesCount: aiTellsFound.length,
    aiTellsFound,
  };
}

/**
 * Humanizes an array of captions.
 * @param {string[]} captions
 * @returns {Array<ReturnType<humanizeCaption>>}
 */
function humanizeCaptionBatch(captions) {
  return captions.map(c => humanizeCaption(c));
}

module.exports = { humanizeCaption, humanizeCaptionBatch };
