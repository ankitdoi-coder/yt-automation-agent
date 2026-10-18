const DESKTOP_LIMIT = 60;
const MOBILE_LIMIT = 40;
const HARD_LIMIT = 100;

const VAGUE_WORDS = new Set([
  'amazing', 'incredible', 'insane', 'crazy', 'huge', 'massive', 'ultimate', 'best', 'powerful',
  'secret', 'revolutionary', 'mindblowing', 'epic', 'perfect', 'complete', 'everything'
]);

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'of', 'for', 'to', 'in', 'on', 'and', 'or', 'is', 'are', 'with', 'your', 'you',
  'my', 'i', 'this', 'that', 'it', 'how', 'what', 'why'
]);

function getWords(text) {
  if (!text) return [];
  const matches = text.toLowerCase().match(/[a-z0-9']+/g);
  return matches || [];
}

/**
 * Lint a YouTube title and optional thumbnail text pairing.
 * @param {string} title - The proposed YouTube video title
 * @param {string} [thumb] - The text placed on the thumbnail image
 * @returns {object} Analysis result with score, issues, and passed checks
 */
function lintTitleAndThumbnail(title, thumb = null) {
  if (!title || typeof title !== 'string') {
    return {
      title: '',
      thumb: thumb || '',
      chars: 0,
      score: 0,
      isPassing: false,
      issues: [['empty', 'Title cannot be empty']],
      good: []
    };
  }

  const t = title.trim();
  const n = t.length;
  const issues = [];
  const good = [];

  // Length checks
  if (n > HARD_LIMIT) {
    issues.push(['length', `${n} characters - YouTube's hard limit is ${HARD_LIMIT}`]);
  } else if (n > DESKTOP_LIMIT) {
    issues.push(['length', `${n} characters - desktop search cuts near ${DESKTOP_LIMIT}`]);
  } else {
    good.push(`${n} characters, inside the ${DESKTOP_LIMIT}-character desktop cut`);
  }

  // Mobile cut check
  if (n > MOBILE_LIMIT) {
    const head = t.slice(0, MOBILE_LIMIT).replace(/\s+\S*$/, '');
    issues.push(['mobile', `a mobile feed shows about "${head}..." - check the key subject survives`]);
  } else {
    good.push(`mobile friendly (${n} <= ${MOBILE_LIMIT} characters)`);
  }

  // Shouting / All caps
  const caps = t.split(/\s+/).filter(w => w.length > 2 && w === w.toUpperCase() && /[A-Z]/.test(w));
  if (caps.length > 2) {
    issues.push(['shouting', `${caps.length} all-caps words - two is the ceiling before it reads as spam`]);
  } else if (caps.length > 0) {
    good.push(`${caps.length} all-caps word for emphasis`);
  }

  // Vague buzzwords
  const words = getWords(t);
  const foundVague = [...new Set(words.filter(w => VAGUE_WORDS.has(w)))];
  if (foundVague.length > 0) {
    issues.push(['vague', `${foundVague.join(', ')} - swap for a concrete number, name, or date`]);
  }

  // Numbers / Concrete figures
  const nums = t.match(/\d[\d,.]*%?/g);
  if (nums && nums.length > 0) {
    good.push(`carries a concrete figure (${nums.slice(0, 3).join(', ')})`);
  } else {
    issues.push(['no-number', 'no number, date or name - adding one is the most reliable single fix']);
  }

  // Open question / curiosity
  if (t.endsWith('?')) {
    good.push('open question in the title');
  }

  // Front-loading
  const frontWords = words.slice(0, 3).filter(w => !STOP_WORDS.has(w));
  if (frontWords.length === 0 && words.length >= 3) {
    issues.push(['front-load', 'the first three words are all filler - move the subject forward']);
  }

  // Thumbnail pairing checks
  if (thumb && typeof thumb === 'string' && thumb.trim()) {
    const thumbWords = getWords(thumb);
    const titleMeaningWords = new Set(words.filter(w => !STOP_WORDS.has(w)));
    const thumbMeaningWords = new Set(thumbWords.filter(w => !STOP_WORDS.has(w)));

    const shared = [...thumbMeaningWords].filter(w => titleMeaningWords.has(w));
    if (shared.length > 0) {
      issues.push([
        'duplicate',
        `thumbnail repeats the title on [${shared.sort().join(', ')}] - thumbnail should say what the title does not`
      ]);
    } else {
      good.push('thumbnail and title carry different words (no wasted click surface)');
    }

    if (thumbWords.length > 4) {
      issues.push(['thumb-length', `${thumbWords.length} words on the thumbnail - 3 to 4 is the ceiling at mobile feed size`]);
    } else {
      good.push(`thumbnail text length is punchy (${thumbWords.length} words)`);
    }
  }

  const score = Math.max(0, Math.min(100, Math.round(100 - 14 * issues.length + 4 * good.length)));
  const isPassing = score >= 65;

  return {
    title: t,
    thumb: thumb ? thumb.trim() : null,
    chars: n,
    score,
    isPassing,
    issues,
    good
  };
}

// CLI execution support
if (require.main === module) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const filteredArgs = args.filter(a => a !== '--json');

  let title = "How to Build an AI Agent in 10 Minutes";
  let thumb = "DON'T CODE";

  const titleIdx = filteredArgs.indexOf('--title');
  if (titleIdx !== -1 && filteredArgs[titleIdx + 1]) {
    title = filteredArgs[titleIdx + 1];
  }
  const thumbIdx = filteredArgs.indexOf('--thumb');
  if (thumbIdx !== -1 && filteredArgs[thumbIdx + 1]) {
    thumb = filteredArgs[thumbIdx + 1];
  }

  const result = lintTitleAndThumbnail(title, thumb);

  if (asJson) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n  Title: "${result.title}"`);
    if (result.thumb) console.log(`  Thumb: "${result.thumb}"`);
    console.log(`  Length: ${result.chars} chars | Score: ${result.score}/100 [${result.isPassing ? 'PASS' : 'WARN'}]`);
    console.log(`  -------------------------------------------------------------`);
    for (const [k, m] of result.issues) {
      console.log(`    [x] ${k.padEnd(12)} ${m}`);
    }
    for (const m of result.good) {
      console.log(`    [ok]              ${m}`);
    }
    console.log();
  }
}

module.exports = {
  lintTitleAndThumbnail,
  DESKTOP_LIMIT,
  MOBILE_LIMIT,
  HARD_LIMIT,
  VAGUE_WORDS,
  STOP_WORDS
};
