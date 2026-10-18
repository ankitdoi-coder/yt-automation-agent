const fs = require('fs');
const path = require('path');

const FORMULAS_PATH = path.join(__dirname, '..', 'skills', 'yt-script', 'hooks.json');
let cachedFormulas = null;

function loadFormulas() {
  if (cachedFormulas) return cachedFormulas;
  try {
    if (fs.existsSync(FORMULAS_PATH)) {
      const data = JSON.parse(fs.readFileSync(FORMULAS_PATH, 'utf-8'));
      cachedFormulas = data.hooks || [];
      return cachedFormulas;
    }
  } catch (err) {
    console.error('Failed to load hooks.json:', err.message);
  }
  return [];
}

const FILLER = new Set([
  'basically', 'actually', 'literally', 'just', 'really', 'very', 'so', 'kind', 'sort', 'like',
  'guys', 'hey', 'welcome', 'today', 'video', 'subscribe', 'channel'
]);

const VAGUE = new Set([
  'amazing', 'incredible', 'insane', 'crazy', 'huge', 'massive', 'game', 'changer', 'secret',
  'powerful', 'ultimate', 'best', 'revolutionary', 'mind', 'blowing', 'unbelievable'
]);

const CONCRETE_PATTERN = /\b(\d[\d,.]*\s?(%|k|m|x|s|m|h)?|\$\d|\d+\s?(second|minute|hour|day|week|month|year)s?)\b|[०-९]+|(?:^|\s|[.,!?])(एक|दो|तीन|चार|पाँच|दस|सौ|हज़ार|लाख)(?:\s|$|[.,!?])/gi;
const YOU_PATTERN = /\b(you|your|you're|youre|yourself)\b|(?:^|\s|[.,!?])(आप|आपका|आपकी|आपको|तुम|तुम्हारा|तुम्हारी|तुम्हें)(?:\s|$|[.,!?])/gi;
const STAKE_PATTERN = /\b(lose|lost|wasting|waste|quit|fail|broke|cost|risk|before|stop|never|die|dying|dead)\b|(?:^|\s|[.,!?])(हार|गलत|फेल|दम|नुकसान|खतरा|रोक|रुक|मौत|दर्द|खून)(?:\s|$|[.,!?])/gi;
const CURIOSITY_PATTERN = /\b(why|how|what|which|until|before|but|nobody|almost|except|reason|actually)\b|(?:^|\s|[.,!?])(क्यों|कैसे|क्या|कौन|कहाँ|किस|किसका|कारण)(?:\s|$|[.,!?])/gi;
const CLOSED_GAP_PATTERN = /\b(because|so that|which means)\b|(?:^|\s|[.,!?])(क्योंकि|ताकि|जिसका मतलब)(?:\s|$|[.,!?])/i;

const FIX = {
  SPECIFICITY: "swap one adjective for a number, a name or a date",
  ADDRESS: "say 'you' in the first six words",
  STAKES: "name what it costs them to keep doing it the current way",
  CURIOSITY: "cut the half of the sentence that answers itself",
  BREVITY: "9 to 24 words. Read it out loud and stop where you run out of breath"
};

function getWords(text) {
  if (!text) return [];
  const matches = text.toLowerCase().match(/[a-zA-Z0-9\u0900-\u097F'%$.]+/g);
  return matches || [];
}

function testPattern(text, pattern) {
  const nonGlobal = new RegExp(pattern.source, pattern.flags.replace('g', ''));
  return nonGlobal.test(text);
}

function countMatches(text, pattern) {
  const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
  const matches = text.match(global);
  return matches ? matches.length : 0;
}

function calculateSpecificity(text) {
  const words = getWords(text);
  if (!words.length) return 0;
  const nums = countMatches(text, CONCRETE_PATTERN);
  const vague = words.filter(w => VAGUE.has(w)).length;
  const filler = words.filter(w => FILLER.has(w)).length;

  let s = 34 + nums * 22 - vague * 16 - filler * 5;
  const tokens = text.split(/\s+/);
  if (tokens.length > 1) {
    const properNouns = tokens.slice(1).filter(x => x.length > 0 && x[0] === x[0].toUpperCase() && /[A-Z]/.test(x[0])).length;
    s += Math.min(18, 6 * properNouns);
  }
  return Math.max(0, Math.min(100, Math.round(s)));
}

function calculateAddress(text) {
  const n = countMatches(text, YOU_PATTERN);
  const firstSixWords = text.split(/\s+/).slice(0, 6).join(' ');
  const first = testPattern(firstSixWords, YOU_PATTERN) ? 30 : 0;
  return Math.max(0, Math.min(100, Math.round(26 + n * 20 + first)));
}

function calculateStakes(text) {
  const n = countMatches(text, STAKE_PATTERN);
  const hasConcrete = testPattern(text, CONCRETE_PATTERN);
  return Math.max(0, Math.min(100, Math.round(22 + n * 26 + (hasConcrete ? 14 : 0))));
}

function calculateCuriosity(text) {
  const n = countMatches(text, CURIOSITY_PATTERN);
  const hasQuestionMark = text.trim().endsWith('?') ? 18 : 0;
  const isClosed = testPattern(text, CLOSED_GAP_PATTERN) ? -18 : 0;
  return Math.max(0, Math.min(100, Math.round(24 + n * 17 + hasQuestionMark + isClosed)));
}

function calculateBrevity(text) {
  const words = getWords(text);
  const n = words.length;
  if (n === 0) return 0;
  if (n >= 9 && n <= 24) return 100;
  if (n < 9) return Math.max(30, Math.round(100 - (9 - n) * 11));
  return Math.max(10, Math.round(100 - (n - 24) * 7));
}

function classifyHook(text) {
  const formulas = loadFormulas();
  let best = null;
  let highestHits = 0;

  for (const formula of formulas) {
    let hits = 0;
    for (const pattern of formula.match || []) {
      const reg = new RegExp(pattern, 'i');
      if (reg.test(text)) {
        hits++;
      }
    }
    if (hits > highestHits) {
      best = formula;
      highestHits = hits;
    }
  }

  return {
    formula: best ? best.name : 'Unclassified',
    formulaId: best ? best.id : null,
    hits: highestHits
  };
}

function scoreHook(text) {
  if (!text || typeof text !== 'string') {
    return {
      hook: '',
      properties: { SPECIFICITY: 0, ADDRESS: 0, STAKES: 0, CURIOSITY: 0, BREVITY: 0 },
      verdict: 0,
      band: 'WEAK',
      formula: 'Unclassified',
      matched: 0,
      weakest: 'SPECIFICITY',
      fix: FIX.SPECIFICITY
    };
  }

  const cleanText = text.trim();
  const properties = {
    SPECIFICITY: calculateSpecificity(cleanText),
    ADDRESS: calculateAddress(cleanText),
    STAKES: calculateStakes(cleanText),
    CURIOSITY: calculateCuriosity(cleanText),
    BREVITY: calculateBrevity(cleanText)
  };

  const values = Object.values(properties);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const verdict = Math.round(0.6 * mean + 0.4 * min);

  let band = 'WEAK';
  if (verdict >= 72) band = 'STRONG';
  else if (verdict >= 55) band = 'WORKABLE';

  const classification = classifyHook(cleanText);

  let weakest = 'SPECIFICITY';
  let lowestVal = 999;
  for (const [key, val] of Object.entries(properties)) {
    if (val < lowestVal) {
      lowestVal = val;
      weakest = key;
    }
  }

  return {
    hook: cleanText,
    properties,
    verdict,
    band,
    formula: classification.formula,
    formulaId: classification.formulaId,
    matched: classification.hits,
    weakest,
    fix: FIX[weakest]
  };
}

function scoreHooks(hooksList) {
  if (!Array.isArray(hooksList)) return [];
  const results = hooksList.map(h => scoreHook(h));
  results.sort((a, b) => b.verdict - a.verdict);
  return results;
}

function getFormulaList() {
  return loadFormulas();
}

// CLI execution support
if (require.main === module) {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const filteredArgs = args.filter(a => a !== '--json');

  let inputs = [];
  const hookIdx = filteredArgs.indexOf('--hook');
  if (hookIdx !== -1 && filteredArgs[hookIdx + 1]) {
    inputs = [filteredArgs[hookIdx + 1]];
  } else if (filteredArgs[0] && fs.existsSync(filteredArgs[0])) {
    inputs = fs.readFileSync(filteredArgs[0], 'utf-8').split('\n').filter(l => l.trim().length > 0);
  } else {
    inputs = [
      "97% of the people who start a channel quit before video 30. Here is what the other 3% do differently.",
      "Welcome to my channel, today we are going to talk about YouTube hooks.",
      "Your first 30 seconds are why nobody finishes your videos. It is not the topic."
    ];
  }

  const results = scoreHooks(inputs);

  if (asJson) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    for (const r of results) {
      console.log(`\n  "${r.hook}"`);
      console.log(`  -------------------------------------------------------------`);
      for (const [prop, val] of Object.entries(r.properties)) {
        console.log(`    ${prop.padEnd(12)} ${String(val).padStart(3)}  ${'#'.repeat(Math.floor(val / 5))}`);
      }
      console.log(`    VERDICT      ${String(r.verdict).padStart(3)}  ${r.band}`);
      console.log(`    Formula:     ${r.formula} (${r.matched} pattern hits)`);
      console.log(`    Weakest:     ${r.weakest} -> ${r.fix}`);
    }
  }
}

module.exports = {
  scoreHook,
  scoreHooks,
  classifyHook,
  getFormulaList,
  calculateSpecificity,
  calculateAddress,
  calculateStakes,
  calculateCuriosity,
  calculateBrevity
};
