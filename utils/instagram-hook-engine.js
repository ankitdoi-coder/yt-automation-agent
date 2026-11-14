/**
 * Instagram Hook Engine — ExamIQ Bharat
 *
 * Sits BETWEEN content-vault.js (quiz item picker) and fb-runner.js (renderer/uploader).
 * Generates 3 hook candidates per quiz item, scores all with hook-scorer,
 * and returns the winner plus full scoring data for logging.
 *
 * Exports:
 *   selectBestHook(item)          → { winningHook, hookText, score, allCandidates }
 *   generateGKHookCandidates(item)→ string[]  (3 hook strings)
 */

'use strict';

const path = require('path');
const { scoreHook } = require('./hook-scorer');

// ---------------------------------------------------------------------------
// Candidate 1: English viral hook (mirrors generateViralEnglishHook in export-deliverer.js)
// ---------------------------------------------------------------------------
function generateEnglishHook(item = {}) {
  const cat   = String(item.category || '').toLowerCase();
  const title = String(item.title    || '');
  const topic = String(item.topic    || '');
  const q     = String(item.question || '');

  // Math IQ
  if (cat.includes('math') || title.includes('संख्या') || title.includes('गणित') || topic.toLowerCase().includes('math')) {
    if (title.includes('अभाज्य') || title.includes('Prime'))    return '99% Fail This! Only Even Prime Number? 🧠';
    if (title.includes('प्रतिशत') || title.includes('Percent')) return 'Can You Solve This Math Trap In 3s? ⚡';
    return '99% People Fail This Quick Math Test! 🧠';
  }

  // Polity & Constitution
  if (cat.includes('pol') || topic.toLowerCase().includes('polity') || topic.includes('संविधान') || title.includes('अनुच्छेद') || title.includes('संशोधन')) {
    if (title.includes('अनुच्छेद') || q.includes('अनुच्छेद'))     return 'Can You Answer? Which Article Deals With This? 📜';
    if (title.includes('संशोधन') || q.includes('संशोधन'))          return '99% Fail This Historic Amendment Quiz! ⚖️';
    if (title.includes('राष्ट्रपति') || title.includes('राज्यपाल')) return 'IAS Favorite: Minimum Age Requirement? 🏛️';
    return '99% Fail This UPSC Polity Question! ⚖️';
  }

  // Geography & Static GK
  if (cat.includes('geo') || cat.includes('stat') || topic.toLowerCase().includes('geography') || topic.includes('भूगोल') || title.includes('बंदरगाह') || title.includes('नदी')) {
    if (title.includes('बंदरगाह') || topic.toLowerCase().includes('port'))  return "India's 1st Free Port? (99% Guess Mumbai!) ⚓";
    if (title.includes('नदी')     || topic.toLowerCase().includes('river'))  return "UPSC Trap: Name India's Longest River? 🌊";
    if (title.includes('पठार')    || title.includes('झील') || title.includes('पहाड़')) return 'Only 1% Know This Geography Fact! 🗺️';
    return '99% People Fail This Geography Question! 🌍';
  }

  // History
  if (cat.includes('hist') || topic.toLowerCase().includes('history') || topic.includes('इतिहास') || title.includes('गांधी') || title.includes('युद्ध')) {
    if (title.includes('दांडी') || title.includes('गांधी'))         return 'UPSC Trap: Where Did Dandi March Start? 🚶';
    if (title.includes('युद्ध') || title.toLowerCase().includes('battle')) return '90% Get This Wrong! Famous Battle Quiz ⚔️';
    return 'History Trap: Can You Answer in 3 Seconds? 📜';
  }

  // Science
  if (cat.includes('sci') || topic.toLowerCase().includes('science') || topic.includes('विज्ञान') || title.includes('कोशिका') || title.includes('रक्त')) {
    if (title.includes('कोशिका') || q.toLowerCase().includes('powerhouse')) return 'Quick Science IQ: Powerhouse Of The Cell? ⚡';
    if (title.includes('रक्त')   || title.includes('विटामिन'))               return 'Only 1% Can Answer This Biology Quiz! 🔬';
    return '99% Students Confused: Quick Science Test! 🧪';
  }

  // Default
  return '99% People Fail This UPSC Question! 🎯';
}

// ---------------------------------------------------------------------------
// Candidate 2: Hindi hook from hooks.json formulas (percent-fail-hindi / 30-second-test)
// ---------------------------------------------------------------------------
function generateHindiHook(item = {}) {
  const topic = String(item.topic || 'GK');
  const cat   = String(item.category || '').toLowerCase();

  // Prefer time-pressure for math/science, percent-fail for everything else
  if (cat.includes('math') || cat.includes('sci')) {
    return `30 second mein jawab do — ${topic} ka yeh sawaal — agar sahi, tum exam crack karoge!`;
  }

  // percent-fail-hindi template
  return `97% log ${topic} ka yeh sawaal galat karte hain — kya aap sahi karenge? 🎯`;
}

// ---------------------------------------------------------------------------
// Candidate 3: Hybrid Hinglish (category label + Hindi challenge)
// ---------------------------------------------------------------------------
function generateHinglishHook(item = {}) {
  const topic = String(item.topic || 'GK');
  const cat   = String(item.category || '').toLowerCase();

  // Pick exam label based on category
  let exam = 'SSC';
  if (cat.includes('upsc') || cat.includes('ias')) exam = 'UPSC';
  else if (cat.includes('rail'))                   exam = 'Railway';
  else if (cat.includes('pol'))                    exam = 'UPSC';
  else if (cat.includes('hist'))                   exam = 'SSC';

  return `${exam} ke 97% students fail karte hain yeh ${topic} question! Aap try karo 🔥`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generates exactly 3 hook candidate strings for a quiz item.
 * @param {object} item  Quiz item (title, topic, category, question, answer, options)
 * @returns {string[]}   [englishHook, hindiHook, hinglishHook]
 */
function generateGKHookCandidates(item = {}) {
  return [
    generateEnglishHook(item),
    generateHindiHook(item),
    generateHinglishHook(item),
  ];
}

/**
 * Picks the best hook for a quiz item using scoreHook().
 * @param {object} item  Quiz item
 * @returns {{ winningHook: object, hookText: string, score: number, allCandidates: object[] }}
 */
function selectBestHook(item = {}) {
  const labels     = ['english', 'hindi', 'hinglish'];
  const candidates = generateGKHookCandidates(item);

  const scored = candidates.map((text, idx) => {
    const result = scoreHook(text);
    return {
      label   : labels[idx],
      hookText: text,
      score   : result.verdict,
      band    : result.band,
      formula : result.formula,
      properties: result.properties,
      weakest : result.weakest,
      fix     : result.fix,
    };
  });

  // Pick highest verdict; on tie keep first (english preferred)
  const winner = scored.reduce((best, c) => (c.score > best.score ? c : best), scored[0]);

  return {
    winningHook  : winner,
    hookText     : winner.hookText,
    score        : winner.score,
    band         : winner.band,
    allCandidates: scored,
  };
}

module.exports = {
  generateGKHookCandidates,
  generateEnglishHook,
  generateHindiHook,
  generateHinglishHook,
  selectBestHook,
};
