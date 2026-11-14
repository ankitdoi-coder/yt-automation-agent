'use strict';
// facebook/content-calendar.js
// Generates a 7-day GK content plan balancing SSC/Railway/UPSC/Police categories.

const fs   = require('fs');
const path = require('path');

const HISTORY_FILE       = path.resolve(__dirname, '../facebook/data/history.json');
const OUTLIER_REPORT_FILE = path.resolve(__dirname, '../facebook/data/outlier-report.json');

const CATEGORIES  = ['geography', 'history', 'polity', 'science', 'static', 'math'];
const EXAM_BALANCE = { SSC: 0.35, Railway: 0.30, UPSC: 0.20, Police: 0.15 };

// ─── day template definitions ────────────────────────────────────────────────

const DAY_TEMPLATES = [
  {
    day: 1, dayName: 'Monday',
    category: 'geography', examFocus: 'SSC',
    morningTopics: ['भारत की प्रमुख नदियाँ (Indian Rivers)', 'भारत के पर्वत श्रृंखला (Mountain Ranges)'],
    eveningTopics: ['भारत के बंदरगाह (Major Ports of India)', 'भारत की झीलें (Lakes of India)']
  },
  {
    day: 2, dayName: 'Tuesday',
    category: 'history', examFocus: 'Railway',
    morningTopics: ['दाण्डी मार्च (Dandi March 1930)', 'मुगल साम्राज्य (Mughal Empire Key Facts)'],
    eveningTopics: ['भारत का प्रथम स्वतंत्रता संग्राम 1857', 'गाँधी जी के प्रमुख आंदोलन (Gandhi Movements)']
  },
  {
    day: 3, dayName: 'Wednesday',
    category: 'polity', examFocus: 'UPSC',
    morningTopics: ['मौलिक अधिकार (Fundamental Rights — All 6)', 'संविधान के अनुच्छेद (Key Articles of Constitution)'],
    eveningTopics: ['राज्यपाल की शक्तियाँ (Powers of Governor)', 'भारतीय संसद (Indian Parliament — Lok Sabha vs Rajya Sabha)']
  },
  {
    day: 4, dayName: 'Thursday',
    category: 'science', examFocus: 'SSC',
    morningTopics: ['मानव शरीर के तथ्य (Human Body Science Facts)', 'रासायनिक सूत्र (Common Chemical Formulas)'],
    eveningTopics: ['भौतिकी के नियम (Laws of Physics — Newton)', 'विज्ञान के आविष्कार (Indian Science Inventions)']
  },
  {
    day: 5, dayName: 'Friday',
    category: 'static', examFocus: 'Police',
    morningTopics: ['भारत के राष्ट्रीय प्रतीक (National Symbols of India)', 'भारत के पुरस्कार (Bharat Ratna + Padma Awards)'],
    eveningTopics: ['महत्वपूर्ण तारीखें (Important Days & Dates)', 'भारत के प्रसिद्ध स्थल (Famous Tourist Places)']
  },
  {
    day: 6, dayName: 'Saturday',
    category: 'math', examFocus: 'Railway',
    morningTopics: ['प्रतिशत ट्रिक (Percentage Tricks for Exam)', 'औसत और अनुपात (Average & Ratio Problems)'],
    eveningTopics: ['अभाज्य संख्याएँ (Prime Numbers Tricks)', 'सरल ब्याज vs चक्रवृद्धि (SI vs CI)']
  },
  {
    day: 7, dayName: 'Sunday',
    category: 'mixed', examFocus: 'UPSC',
    morningTopics: ['साप्ताहिक GK रिवीजन — Geography + History', 'महत्वपूर्ण करंट अफेयर्स (This Week Current Affairs)'],
    eveningTopics: ['UPSC प्रीलिम्स के 10 महत्वपूर्ण प्रश्न', 'SSC/Railway मिश्रित प्रश्नोत्तर (Mixed Quiz Revision)']
  }
];

// ─── topic pools per category for variety ────────────────────────────────────

const TOPIC_POOL = {
  geography: [
    'भारत की प्रमुख नदियाँ', 'हिमालय पर्वत श्रृंखला', 'भारत के बंदरगाह', 'भारत की झीलें',
    'भारत के राष्ट्रीय उद्यान', 'प्रमुख दर्रे (Mountain Passes)', 'भारत की मिट्टी के प्रकार',
    'भारत के प्रमुख बाँध (Major Dams)', 'विश्व के महाद्वीप', 'भारत के पड़ोसी देश'
  ],
  history: [
    'मुगल साम्राज्य', 'दाण्डी मार्च 1930', '1857 का विद्रोह', 'गाँधी जी के आंदोलन',
    'मौर्य साम्राज्य (Maurya Empire)', 'भारतीय राष्ट्रीय कांग्रेस', 'हड़प्पा सभ्यता',
    'ब्रिटिश भारत के अधिनियम', 'आज़ादी के बाद भारत', 'प्रसिद्ध भारतीय राजा'
  ],
  polity: [
    'मौलिक अधिकार', 'संविधान के प्रमुख अनुच्छेद', 'राज्यपाल की शक्तियाँ',
    'भारतीय संसद', 'सर्वोच्च न्यायालय', 'पंचायती राज', 'मूल कर्तव्य (Fundamental Duties)',
    'राज्य नीति के निर्देशक सिद्धांत', 'संविधान संशोधन', 'चुनाव आयोग'
  ],
  science: [
    'मानव शरीर के तथ्य', 'रासायनिक सूत्र', 'न्यूटन के नियम', 'ऊर्जा के प्रकार',
    'पोषक तत्व (Vitamins & Minerals)', 'रोग और उनके कारण', 'भौतिकी यूनिट',
    'अंतरिक्ष विज्ञान (ISRO Missions)', 'जीव विज्ञान तथ्य', 'पर्यावरण विज्ञान'
  ],
  static: [
    'भारत के राष्ट्रीय प्रतीक', 'भारत के पुरस्कार', 'महत्वपूर्ण तारीखें',
    'प्रसिद्ध पर्यटन स्थल', 'भारत के प्रथम (Firsts of India)', 'खेल पुरस्कार',
    'भारत के प्रमुख संगठन', 'अंतर्राष्ट्रीय संगठन', 'भारत के रिकॉर्ड', 'सरकारी योजनाएँ'
  ],
  math: [
    'प्रतिशत ट्रिक', 'औसत और अनुपात', 'अभाज्य संख्याएँ', 'सरल ब्याज vs चक्रवृद्धि',
    'समय और कार्य', 'ट्रेन और गति', 'नल और टंकी', 'क्षेत्रफल और परिमाप',
    'संख्या पद्धति (Number System)', 'लाभ और हानि (Profit & Loss)'
  ],
  mixed: [
    'GK साप्ताहिक रिवीजन', 'करंट अफेयर्स', 'SSC/Railway मिश्रित प्रश्न',
    'UPSC प्रीलिम्स महत्वपूर्ण प्रश्न', 'टॉप 10 GK प्रश्न'
  ]
};

// ─── hook formula templates ───────────────────────────────────────────────────

const DEFAULT_HOOK_FORMULAS = [
  'percent-fail',
  '30-second-test',
  'shocking-fact-hindi',
  'ias-favorite',
  'only-toppers-know',
  'question-challenge',
  'exam-countdown'
];

function pickHookFormula(topFormulas, dayIndex) {
  if (topFormulas && topFormulas.length) {
    return topFormulas[dayIndex % topFormulas.length].formula;
  }
  return DEFAULT_HOOK_FORMULAS[dayIndex % DEFAULT_HOOK_FORMULAS.length];
}

// ─── load recent topics (last 30 days) ───────────────────────────────────────

function loadRecentTopics() {
  const used = new Set();
  if (!fs.existsSync(HISTORY_FILE)) return used;
  try {
    const data = JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
    const uploads = Array.isArray(data) ? data : (data.uploads || []);
    const cutoff  = Date.now() - 30 * 86400000;
    for (const u of uploads) {
      if (u.topic && new Date(u.uploadedAt || 0).getTime() > cutoff) {
        used.add((u.topic || '').toLowerCase().trim());
      }
    }
  } catch {}
  return used;
}

// ─── load outlier report for winning formulas ─────────────────────────────────

function loadTopFormulas() {
  if (!fs.existsSync(OUTLIER_REPORT_FILE)) return null;
  try {
    const r = JSON.parse(fs.readFileSync(OUTLIER_REPORT_FILE, 'utf8'));
    return (r.topFormulas && r.topFormulas.length) ? r.topFormulas : null;
  } catch {
    return null;
  }
}

// ─── pick a topic avoiding recent repeats ─────────────────────────────────────

function pickTopic(category, recentTopics, exclude = []) {
  const pool = TOPIC_POOL[category] || TOPIC_POOL.static;
  const fresh = pool.filter(t =>
    !recentTopics.has(t.toLowerCase().trim()) &&
    !exclude.includes(t)
  );
  const source = fresh.length ? fresh : pool;  // fall back to full pool if all used
  return source[Math.floor(Math.random() * source.length)];
}

// ─── main generator ───────────────────────────────────────────────────────────

function generateWeeklyCalendar(options = {}) {
  const recentTopics = loadRecentTopics();
  const topFormulas  = loadTopFormulas();
  const startDate    = options.startDate ? new Date(options.startDate) : new Date();

  // Normalize to Monday of the current week
  const monday = new Date(startDate);
  const dow    = monday.getDay(); // 0=Sun
  monday.setDate(monday.getDate() - ((dow === 0 ? 7 : dow) - 1));
  monday.setHours(0, 0, 0, 0);

  const calendar = [];

  for (let i = 0; i < 7; i++) {
    const tmpl      = DAY_TEMPLATES[i];
    const dayDate   = new Date(monday);
    dayDate.setDate(monday.getDate() + i);

    const dateStr   = dayDate.toISOString().slice(0, 10);
    const hookFormula = pickHookFormula(topFormulas, i);
    const category  = tmpl.category;

    // Pick morning topic (prefer template, avoid recent)
    const morningPool = tmpl.morningTopics.filter(
      t => !recentTopics.has(t.toLowerCase().trim())
    );
    const morningTopic = morningPool.length
      ? morningPool[0]
      : pickTopic(category, recentTopics);

    // Pick evening topic (different from morning)
    const eveningPool = tmpl.eveningTopics.filter(
      t => !recentTopics.has(t.toLowerCase().trim()) && t !== morningTopic
    );
    const eveningTopic = eveningPool.length
      ? eveningPool[0]
      : pickTopic(category, recentTopics, [morningTopic]);

    calendar.push({
      day:            tmpl.day,
      dayName:        tmpl.dayName,
      date:           dateStr,
      platform:       'YouTube Shorts / Instagram Reels',
      category:       tmpl.category,
      examFocus:      tmpl.examFocus,
      suggestedTopic: morningTopic,       // primary / morning post
      hookFormula,
      posts: {
        morning: {
          time:        '09:00 IST',
          topic:       morningTopic,
          examFocus:   tmpl.examFocus,
          hookFormula
        },
        evening: {
          time:        '20:00 IST',
          topic:       eveningTopic,
          examFocus:   tmpl.examFocus,
          hookFormula: pickHookFormula(topFormulas, i + 3)  // rotate formula for variety
        }
      }
    });
  }

  return calendar;
}

module.exports = { generateWeeklyCalendar, CATEGORIES, EXAM_BALANCE };
