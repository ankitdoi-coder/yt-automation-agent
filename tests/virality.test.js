const { scoreHook } = require('../utils/hook-scorer');
const { lintTitleAndThumbnail } = require('../utils/title-thumbnail-linter');
const { analyzeRetention } = require('../utils/retention-analyzer');
const { analyzeViralOutliers } = require('../utils/viral-outlier-analyzer');
const { detectDeadAir } = require('../utils/dead-air-detector');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runViralityTests() {
  console.log('--- Running Virality & Deep Script Analysis Test Suite ---');

  // Test 1: Hook Scorer - Specificity and Formulas
  console.log('Test 1: Hook Scorer functionality...');
  const statHook = "97% of the people who start a channel quit before video 30. Here is what the other 3% do differently.";
  const statResult = scoreHook(statHook);
  assert(statResult.properties.SPECIFICITY > 70, `Expected high specificity for stat hook, got ${statResult.properties.SPECIFICITY}`);
  assert(statResult.properties.BREVITY === 100, `Expected 100 brevity for 19 words, got ${statResult.properties.BREVITY}`);
  assert(statResult.formula === 'The Statistic', `Expected formula 'The Statistic', got ${statResult.formula}`);
  assert(statResult.verdict >= 50, `Expected verdict >= 50, got ${statResult.verdict}`);

  // Test 2: Hook Scorer - Weak Generic Hook
  console.log('Test 2: Detecting weak generic hooks...');
  const weakHook = "Welcome to my channel, today we are going to look at YouTube tips.";
  const weakResult = scoreHook(weakHook);
  assert(weakResult.verdict < 45, `Expected weak verdict < 45, got ${weakResult.verdict}`);
  assert(weakResult.band === 'WEAK', `Expected band WEAK, got ${weakResult.band}`);

  // Test 3: Title & Thumbnail Linter - High CTR Pairing
  console.log('Test 3: Title & Thumbnail Linter with good pairing...');
  const goodPairing = lintTitleAndThumbnail("How to Build an AI Agent in 10 Minutes", "DON'T CODE");
  assert(goodPairing.isPassing === true, `Expected passing score for good pairing, got ${goodPairing.score}`);
  assert(goodPairing.issues.length === 0, `Expected 0 issues for optimal pairing, got ${goodPairing.issues.length}`);

  // Test 4: Title & Thumbnail Linter - Duplicate Text & Truncation
  console.log('Test 4: Title & Thumbnail Linter detecting duplicate text & length issues...');
  const badPairing = lintTitleAndThumbnail(
    "The Most Insane Mindblowing Incredible Secret AI Tool Ever Created for YouTube",
    "The Most Insane Tool"
  );
  assert(badPairing.isPassing === false, `Expected failure for bad pairing, got ${badPairing.score}`);
  const issueKeys = badPairing.issues.map(i => i[0]);
  assert(issueKeys.includes('duplicate'), 'Expected duplicate text warning between title and thumbnail');
  assert(issueKeys.includes('length'), 'Expected length warning for >60 chars');
  assert(issueKeys.includes('vague'), 'Expected vague words warning');

  // Test 5: Retention Analyzer - Hook Leak and Cliff Detection
  console.log('Test 5: Retention Analyzer...');
  const mockRetentionData = [
    [0, 100.0],
    [5, 92.0],
    [10, 84.0],
    [20, 78.0],
    [30, 72.0], // hook leak = 100 - 72 = 28%
    [45, 68.0],
    [60, 52.0], // steep drop cliff: 68 - 52 = 16% lost
    [90, 50.0],
    [120, 48.0]
  ];
  const mockTranscript = [
    { start: 0, end: 15, text: "Welcome back guys today we will talk about everything" },
    { start: 55, end: 65, text: "Before we get into that make sure to hit the subscribe button" }
  ];
  const retentionResult = analyzeRetention(mockRetentionData, {
    duration: 120,
    transcript: mockTranscript
  });
  assert(retentionResult.hookLeak === 28.0, `Expected 28% hook leak, got ${retentionResult.hookLeak}`);
  assert(retentionResult.cliffs.length > 0, 'Expected at least 1 cliff detected');
  assert(retentionResult.hookVerdict === 'leaking', `Expected verdict 'leaking', got ${retentionResult.hookVerdict}`);

  // Test 6: Viral Outlier Analyzer
  console.log('Test 6: Viral Outlier Analyzer with channel medians...');
  const mockVideos = [
    { channel: 'TechChannel', title: 'Normal Video 1', views: 10000 },
    { channel: 'TechChannel', title: 'Normal Video 2', views: 12000 },
    { channel: 'TechChannel', title: 'Normal Video 3', views: 9000 },
    { channel: 'TechChannel', title: 'Normal Video 4', views: 11000 },
    { channel: 'TechChannel', title: '97% of people fail this exam in 2026', views: 120000 } // ~11x outlier!
  ];
  const outlierResult = analyzeViralOutliers(mockVideos, 2.0);
  assert(outlierResult.outliers.length === 1, `Expected 1 outlier >= 2.0x, got ${outlierResult.outliers.length}`);
  assert(outlierResult.outliers[0].multiple > 10, `Expected multiple > 10x, got ${outlierResult.outliers[0].multiple}`);
  assert(outlierResult.outliers[0].formula === 'The Statistic', `Expected formula 'The Statistic', got ${outlierResult.outliers[0].formula}`);

  // Test 7: Dead Air & Filler Detector
  console.log('Test 7: Dead Air & Filler Detector...');
  const sampleCues = [
    { start: 0, end: 3.5, text: "Here is what happens when you build an agent." },
    { start: 5.0, end: 5.6, text: "Um basically like" }, // filler only + 1.5s dead gap before
    { start: 6.0, end: 9.0, text: "It runs completely in the background without human intervention." }
  ];
  const deadAirResult = detectDeadAir(sampleCues, { floor: 0.45 });
  assert(deadAirResult.cuts.some(c => c.kind === 'FILLER'), 'Expected filler cut detected');
  assert(deadAirResult.cuts.some(c => c.kind === 'DEAD_AIR'), 'Expected dead air cut detected');
  assert(deadAirResult.totalCutDuration > 1.0, `Expected > 1s cuts, got ${deadAirResult.totalCutDuration}`);

  console.log('All 7 Virality & Deep Script Analysis tests passed successfully!');
  return true;
}

if (require.main === module) {
  runViralityTests().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
  });
}

module.exports = { runViralityTests };
