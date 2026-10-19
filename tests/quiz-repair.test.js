const assert = require('assert');
const { ScriptWriterAgent } = require('../agents/script-writer-agent');

console.log('Testing ScriptWriterAgent quiz resilience...');

const writer = new ScriptWriterAgent(null, {});

// 1. Test auto-expansion of brief noun phrases
const rawQuestions = [
  {
    question: 'रक्त का pH मान', // 14 chars
    options: ['7.4', '6.0', '8.0', '5.5'],
    answerIndex: 0
  },
  {
    question: 'मास्टर ग्रंथि', // 12 chars
    options: ['पिट्यूटरी', 'थायरॉयड', 'यकृत', 'अग्न्याशय'],
    answerIndex: 0
  },
  {
    question: 'डीएनए की खोज', // 12 chars
    options: ['वाटसन व क्रिक', 'डार्विन', 'मेंडल', 'न्यूटन'],
    answerIndex: 0
  },
  {
    question: 'too short', // < 10 chars
    options: ['A', 'B', 'C', 'D'],
    answerIndex: 0
  }
];

const normalized = writer.normalizeQuizQuestions(rawQuestions, 1);

console.log('Normalized count:', normalized.length);
assert.strictEqual(normalized.length, 3, 'Should discard < 10 chars question');
assert(normalized[0].question.length >= 15, 'Should auto-expand short question 1');
assert(normalized[1].question.length >= 15, 'Should auto-expand short question 2');
assert(normalized[2].question.length >= 15, 'Should auto-expand short question 3');
console.log('Q1 expanded to:', normalized[0].question);
console.log('Q2 expanded to:', normalized[1].question);
console.log('Q3 expanded to:', normalized[2].question);

// 2. Test auto-pruning in validateQuizQuality
const mock50Questions = [];
for (let i = 1; i <= 50; i++) {
  mock50Questions.push({
    number: i,
    question: i === 24 ? 'छोटा' : `यह प्रतियोगी परीक्षा का अति महत्वपूर्ण प्रश्न संख्या ${i} है?`,
    options: ['विकल्प 1', 'विकल्प 2', 'विकल्प 3', 'विकल्प 4'],
    answerIndex: 0
  });
}

const mockScript = {
  title: 'Top 50 जीव विज्ञान Question and answer',
  isShort: false,
  quiz: {
    language: 'hi',
    requestedQuestions: 50,
    totalQuestions: 50,
    subjectHindi: 'जीव विज्ञान',
    headerLabel: 'Top 50 Science Question and answer',
    thumbnailLabel: 'जीव विज्ञान GK TOP 50',
    questions: mock50Questions
  }
};

const gate = writer.validateQuizQuality(mockScript, { topic: 'Science' });
console.log('Gate passed:', gate.passed);
assert.strictEqual(gate.passed, true, 'Quality gate should pass by auto-pruning Q24');
assert.strictEqual(mockScript.quiz.questions.length, 49, 'Questions should now have 49 items');
assert.strictEqual(mockScript.quiz.totalQuestions, 49, 'totalQuestions should be 49');
assert.strictEqual(mockScript.title, 'Top 49 जीव विज्ञान Question and answer', 'Title should be updated to Top 49');
console.log('Auto-pruning test passed successfully! Script title is now:', mockScript.title);

console.log('All Quiz Repair & Resilience tests passed! 🎉');
