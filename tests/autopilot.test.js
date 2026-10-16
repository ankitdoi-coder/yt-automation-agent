const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  isDuplicateQuestion,
  calculateJaccardSimilarity,
  extractContentTokens
} = require('../utils/quiz-question-deduplicator');
const {
  calculateMedian,
  calculatePercentile,
  bootstrapMedianCI,
  compareVariants
} = require('../scripts/autopilot/stats-helper');
const {
  validateAgainstGuardrails,
  getNestedValue,
  setNestedValue
} = require('../scripts/autopilot/decide');
const { analyzeDataset } = require('../scripts/autopilot/analyze');
const { decideImprovements } = require('../scripts/autopilot/decide');
const { generateReport } = require('../scripts/autopilot/report');

function runTest(name, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
    process.exitCode = 1;
  }
}

console.log('\n🧪 RUNNING GROWTH AUTOPILOT UNIT TEST SUITE');
console.log('═'.repeat(60));

// 1. Deduplication Engine Tests
console.log('\n[1] Quiz Question Deduplication & Semantic Matching');

runTest('Token extraction filters stopwords correctly', () => {
  const text = 'सिंधु घाटी सभ्यता में जूते हुए खेत के साक्ष्य कहां से मिले हैं?';
  const tokens = extractContentTokens(text);
  assert(tokens.has('सिंधु'), 'Should keep सिंधु');
  assert(tokens.has('घाटी'), 'Should keep घाटी');
  assert(tokens.has('खेत'), 'Should keep खेत');
  assert(!tokens.has('में'), 'Should filter में');
  assert(!tokens.has('के'), 'Should filter के');
});

runTest('Jaccard similarity computation', () => {
  const setA = new Set(['सिंधु', 'घाटी', 'खेत']);
  const setB = new Set(['सिंधु', 'घाटी', 'सभ्यता']);
  const sim = calculateJaccardSimilarity(setA, setB);
  // Intersection = 2, Union = 4 -> 0.50
  assert.strictEqual(sim, 0.5);
});

runTest('Catches semantic duplicate questions with different phrasing', () => {
  const q1 = {
    question: 'भारतीय संविधान के किस अनुच्छेद को डॉ. भीमराव अंबेडकर ने संविधान का हृदय और आत्मा कहा था?',
    options: ['अनुच्छेद 14', 'अनुच्छेद 19', 'अनुच्छेद 21', 'अनुच्छेद 32'],
    answerIndex: 3
  };
  const q2 = {
    question: 'डॉ. बी. आर. अंबेडकर के अनुसार कौन सा अनुच्छेद संविधान का सबसे महत्वपूर्ण हृदय और आत्मा है?',
    options: ['अनुच्छेद 32', 'अनुच्छेद 370', 'अनुच्छेद 14', 'अनुच्छेद 51'],
    answerIndex: 0
  };
  const isDup = isDuplicateQuestion(q2, [q1]);
  assert.strictEqual(isDup, true, 'Should detect duplicate constitution question');
});

runTest('Catches duplicate based on identical answer and core entity collision', () => {
  const q1 = {
    question: 'सिंधु घाटी सभ्यता में जूते हुए खेत के साक्ष्य कहां से मिले हैं?',
    options: ['लोथल', 'कालीबंगा', 'हड़प्पा', 'मोहनजोदड़ो'],
    answerIndex: 1
  };
  const q2 = {
    question: 'हड़प्पा सभ्यता का वह स्थल कौन सा है जहाँ से जुते हुए खेत का प्रमाण मिला था?',
    options: ['कालीबंगा', 'रोपड़', 'बनावली', 'धौलावीरा'],
    answerIndex: 0
  };
  const isDup = isDuplicateQuestion(q2, [q1]);
  assert.strictEqual(isDup, true, 'Should detect duplicate indus valley question');
});

runTest('Allows completely different questions to pass without false positive', () => {
  const q1 = {
    question: 'भारत का नेपोलियन किस गुप्त शासक को कहा जाता है?',
    options: ['चंद्रगुप्त', 'समुद्रगुप्त', 'स्कंदगुप्त', 'कुमारगुप्त'],
    answerIndex: 1
  };
  const q2 = {
    question: 'पृथ्वी की सबसे ऊपरी परत को क्या कहा जाता है?',
    options: ['क्रस्ट', 'मेंटल', 'कोर', 'मैग्मा'],
    answerIndex: 0
  };
  const isDup = isDuplicateQuestion(q2, [q1]);
  assert.strictEqual(isDup, false, 'Different questions must pass');
});

// 2. Statistical Helper Tests
console.log('\n[2] Statistics & Bootstrap Confidence Intervals');

runTest('Median and Percentile calculations', () => {
  assert.strictEqual(calculateMedian([10, 20, 30]), 20);
  assert.strictEqual(calculateMedian([10, 20, 30, 40]), 25);
  assert.strictEqual(calculateMedian([]), 0);
  assert.strictEqual(calculatePercentile([10, 20, 30, 40, 50], 75), 40);
});

runTest('Bootstrap Confidence Interval computes bounds', () => {
  const data = [100, 110, 105, 95, 120, 115, 108];
  const bci = bootstrapMedianCI(data, 500, 0.90);
  assert.strictEqual(bci.sampleSize, 7);
  assert(bci.lowerBound <= bci.median, 'Lower bound must be <= median');
  assert(bci.upperBound >= bci.median, 'Upper bound must be >= median');
});

runTest('compareVariants flags insufficient sample size (n < 5) as inconclusive', () => {
  const vA = { name: 'A', data: [700, 750, 800] }; // n=3
  const vB = { name: 'B', data: [10, 15, 20] }; // n=3
  const res = compareVariants(vA, vB, { minSampleSize: 5 });
  assert.strictEqual(res.isConclusive, false);
  assert(res.reason.includes('insufficient sample size'));
});

runTest('compareVariants flags overlapping confidence intervals as inconclusive', () => {
  const vA = { name: 'A', data: [100, 110, 120, 130, 140, 150] };
  const vB = { name: 'B', data: [130, 140, 150, 160, 170, 180] };
  const res = compareVariants(vA, vB, { minSampleSize: 5 });
  assert.strictEqual(res.isConclusive, false);
  assert(res.reason.includes('overlap'));
});

runTest('compareVariants declares winner when disjoint with n >= 5', () => {
  const vA = { name: 'WinningVariant', data: [800, 850, 900, 950, 1000, 1050] };
  const vB = { name: 'LosingVariant', data: [10, 12, 14, 15, 18, 20] };
  const res = compareVariants(vA, vB, { minSampleSize: 5 });
  assert.strictEqual(res.isConclusive, true);
  assert.strictEqual(res.winner, 'WinningVariant');
});

// 3. Guardrails Tests
console.log('\n[3] Guardrails Enforcement & Decision Safety');

runTest('Guardrails reject immutable keys', () => {
  const guardrails = {
    rules: { maxConfigChangesPerRun: 2, maxVariablesPerFormat: 1 },
    allowedRanges: { 'shorts.targetDurationSeconds': { min: 35, max: 60, type: 'integer' } },
    immutableKeys: ['categoryId', 'privacyStatus']
  };

  const proposals = [
    { key: 'categoryId', proposedValue: 24 },
    { key: 'privacyStatus', proposedValue: 'private' }
  ];

  const approved = validateAgainstGuardrails(proposals, guardrails);
  assert.strictEqual(approved.length, 0, 'Immutable keys must all be rejected');
});

runTest('Guardrails clamp values to allowed min/max', () => {
  const guardrails = {
    rules: { maxConfigChangesPerRun: 2, maxVariablesPerFormat: 1 },
    allowedRanges: {
      'shorts.targetDurationSeconds': { min: 35, max: 60, type: 'integer' }
    },
    immutableKeys: []
  };

  const proposals = [
    { key: 'shorts.targetDurationSeconds', proposedValue: 120 } // Exceeds 60
  ];

  const approved = validateAgainstGuardrails(proposals, guardrails);
  assert.strictEqual(approved.length, 1);
  assert.strictEqual(approved[0].proposedValue, 60, 'Must clamp to max 60');
});

runTest('Guardrails enforce maximum 1 variable per format per run', () => {
  const guardrails = {
    rules: { maxConfigChangesPerRun: 5, maxVariablesPerFormat: 1 },
    allowedRanges: {
      'shorts.targetDurationSeconds': { min: 35, max: 60, type: 'integer' },
      'shorts.targetQuestionCount': { min: 5, max: 10, type: 'integer' }
    },
    immutableKeys: []
  };

  const proposals = [
    { key: 'shorts.targetDurationSeconds', proposedValue: 45 },
    { key: 'shorts.targetQuestionCount', proposedValue: 8 }
  ];

  const approved = validateAgainstGuardrails(proposals, guardrails);
  assert.strictEqual(approved.length, 1, 'Should only allow 1 Shorts variable');
  assert.strictEqual(approved[0].key, 'shorts.targetDurationSeconds');
});

// 4. Dry-Run Fixture End-to-End Pipeline Test
console.log('\n[4] Dry-Run Fixture Pipeline Test (No External API calls)');

runAsyncTest('Complete analyze -> decide -> report pipeline runs with sample data', async () => {
  const sampleDataset = {
    collectedAt: new Date().toISOString(),
    snapshotDate: '2026-10-16',
    channel: { title: 'ExamIQ Test', channelId: 'UC_TEST', subscriberCount: 10, viewCount: 5000, videoCount: 12 },
    trafficSources: [{ source: 'SHORTS', views: 4000, watchMinutes: 1500 }],
    ageDemographics: [{ ageGroup: 'age25-34', viewerPercentage: 45 }, { ageGroup: 'age65-', viewerPercentage: 15 }],
    dailyTrends: [
      { day: '2026-10-10', views: 500 },
      { day: '2026-10-11', views: 700 },
      { day: '2026-10-12', views: 600 }
    ],
    videos: [
      {
        id: 'test_vid_1',
        title: 'Top 10 GK MCQ | Lucent GK #Shorts #GK | ExamIQ',
        description: 'Test description',
        publishedAt: '2026-10-11T10:00:00Z',
        durationSec: 55,
        isShort: true,
        views: 750,
        avdSec: 52,
        apvPct: 58.5,
        likes: 25,
        comments: 4,
        isMature: true
      },
      {
        id: 'test_vid_2',
        title: 'Police Exam 2026 | Static GK Top 5 MCQs (Set 1) #Shorts #GK',
        description: 'Test description',
        publishedAt: '2026-10-15T10:00:00Z',
        durationSec: 50,
        isShort: true,
        views: 12,
        avdSec: 15,
        apvPct: 30.0,
        likes: 1,
        comments: 0,
        isMature: false
      }
    ]
  };

  const analysis = await analyzeDataset(sampleDataset);
  assert(analysis.formatSummary.shorts.all.count === 2);

  const proposal = await decideImprovements(analysis, { apply: false });
  assert(proposal.proposals !== undefined);

  const report = await generateReport({ analysis, proposal, date: '2026-10-16-test' });
  assert(report.reportPath && fs.existsSync(report.reportPath));
  assert(report.prSummary.includes('ExamIQ Test'));

  // Clean up test report file
  if (fs.existsSync(report.reportPath)) {
    fs.unlinkSync(report.reportPath);
  }
});

console.log('\n🎉 ALL TESTS COMPLETED SUCCESSFULLY!\n');
