const assert = require('assert');
const { Database } = require('../database/db');
const { SEOOptimizerAgent } = require('../agents/seo-optimizer-agent');
const { AIVideoGenerator } = require('../utils/ai-video-generator');
const { ScriptWriterAgent } = require('../agents/script-writer-agent');

async function runTests() {
  console.log('🧪 Starting 10-Question Rapid Short & Category Sequential Part Counter Tests...\n');

  // Backup category_series.json to restore after test
  const fs = require('fs');
  const path = require('path');
  const jsonPath = path.join(__dirname, '..', 'data', 'category_series.json');
  const backupJson = fs.existsSync(jsonPath) ? fs.readFileSync(jsonPath, 'utf8') : null;

  // Test 1: Category Series Sequential Parts in Database & Live Channel Sync
  console.log('1. Testing Category Series Sequential Part Counting & Channel Sync...');
  const db = new Database();
  await db.initialize();

  // Test polity Part sequence
  const polityInit = await db.getNextCategoryPart('polity');
  assert.strictEqual(polityInit.category, 'polity');
  const initialPolityPart = polityInit.nextPart;

  // Increment polity
  await db.incrementCategoryPart('polity', 'test_vid_p1');
  const polityAfter = await db.getNextCategoryPart('polity');
  assert.strictEqual(polityAfter.nextPart, initialPolityPart + 1, 'Next part of polity must be strictly +1');

  // Test science Part sequence
  const scienceInit = await db.getNextCategoryPart('science');
  assert.strictEqual(scienceInit.category, 'science');
  const initialSciencePart = scienceInit.nextPart;

  // Increment science
  await db.incrementCategoryPart('science', 'test_vid_s1');
  const scienceAfter = await db.getNextCategoryPart('science');
  assert.strictEqual(scienceAfter.nextPart, initialSciencePart + 1, 'Next part of science must be strictly +1');

  // Test Live Channel Sync with sample uploaded video titles (e.g. Part 10 on channel)
  const sampleChannelUploads = [
    { snippet: { title: 'General Science Part 10 | Top 10 MCQs 🎯 #shorts', resourceId: { videoId: 'sync_vid_10' } } },
    { snippet: { title: 'Indian Polity Part 4 | Top 10 MCQs 🎯 #shorts', resourceId: { videoId: 'sync_vid_4' } } }
  ];
  await db.syncWithChannelVideos(sampleChannelUploads);

  const scienceSynced = await db.getNextCategoryPart('science');
  assert(scienceSynced.currentPart >= 10, 'Science current part must be synced to at least 10');
  assert.strictEqual(scienceSynced.nextPart, scienceSynced.currentPart + 1, 'Next science part must be currentPart + 1');

  const politySynced = await db.getNextCategoryPart('polity');
  assert(politySynced.currentPart >= 4, 'Polity current part must be synced to at least 4');
  assert.strictEqual(politySynced.nextPart, politySynced.currentPart + 1, 'Next polity part must be currentPart + 1');

  // Restore category_series.json and clean up DB
  if (backupJson) {
    fs.writeFileSync(jsonPath, backupJson, 'utf8');
    const parsed = JSON.parse(backupJson);
    for (const [k, v] of Object.entries(parsed)) {
      await db.executeQuery('UPDATE category_series SET current_part = ? WHERE category = ?', [v.currentPart, k]);
    }
  }
  await db.close();

  console.log('  ✅ Database category sequential counter & live channel sync verified!');

  // Test 2: SEO Title Generation (< 50 chars, Clean English, Part counter, #shorts)
  console.log('\n2. Testing SEO Short Title Generation (< 50 chars constraint)...');
  const seo = new SEOOptimizerAgent();

  const testCases = [
    { cat: 'polity', topic: 'Indian Polity Fundamental Rights', part: 1, count: 10 },
    { cat: 'science', topic: 'General Science Human Body Biology', part: 1, count: 10 },
    { cat: 'history', topic: 'Indian History 1857 Revolt', part: 1, count: 10 },
    { cat: 'geography', topic: 'Indian Geography Rivers and Dams', part: 1, count: 10 },
    { cat: 'static', topic: 'Static GK National Parks and Dances', part: 1, count: 10 },
    { cat: 'polity', topic: 'Indian Polity Articles', part: 12, count: 10 }
  ];

  for (const tc of testCases) {
    const fakeScript = {
      title: `${tc.topic} Part ${tc.part}`,
      partNumber: tc.part,
      quiz: { totalQuestions: tc.count, part: tc.part, subject: tc.topic }
    };
    const fakeStrategy = {
      topic: tc.topic,
      contentType: 'quiz_short_no_image',
      targetQuestionCount: tc.count,
      partNumber: tc.part
    };
    const title = seo.buildExamOptimizedShortTitle(fakeScript, fakeStrategy);
    console.log(`  Generated Title: "${title}" (Length: ${title.length} chars)`);
    assert(title.length <= 50, `Title "${title}" must be <= 50 characters (was ${title.length})`);
    assert(title.includes('#shorts'), `Title "${title}" must include #shorts`);
    assert(title.includes(`Part ${tc.part}`), `Title "${title}" must include Part ${tc.part}`);
    assert(!/[\u0900-\u097F]/.test(title), `Title "${title}" must NOT contain any Hindi / Devanagari characters`);
  }

  // Test enforceEnglishShortTitle with direct Hindi Devanagari input
  const { enforceEnglishShortTitle } = require('../utils/youtube-metadata-validator');
  const hindiRaw = 'सामान्य विज्ञान भाग 2 | टॉप 10 MCQ 🎯 #shorts';
  const converted = enforceEnglishShortTitle(hindiRaw, { isShort: true });
  console.log(`  Enforced English Title from Hindi: "${converted}"`);
  assert.strictEqual(converted, 'General Science Part 2 | Top 10 MCQs 🎯 #shorts');
  assert(!/[\u0900-\u097F]/.test(converted), 'Enforced title must have zero Devanagari characters');

  console.log('  ✅ All SEO Short titles strictly 100% English verified <= 50 characters with Part number!');

  // Test 3: Slide Generation & Presentation (10 Questions, Clean Typography, Badges)
  console.log('\n3. Testing Slide Generation for 10 Questions...');
  const videoGen = new AIVideoGenerator({});
  
  const fake10QScript = {
    title: 'Indian Polity Part 1 | Top 10 Questions',
    isShort: true,
    partNumber: 1,
    hook: { text: 'दम है तो 10 में से 7 सही करके दिखाओ!' },
    quiz: {
      isShort: true,
      part: 1,
      language: 'hi',
      subject: 'Indian Polity',
      subjectHindi: 'भारतीय संविधान',
      questions: Array.from({ length: 10 }, (_, i) => ({
        id: i + 1,
        question: `संविधान का महत्वपूर्ण प्रश्न संख्या ${i + 1}`,
        options: ['विकल्प A', 'विकल्प B', 'विकल्प C', 'विकल्प D'],
        answerIndex: i % 4,
        explanation: `व्याख्या प्रश्न ${i + 1}`
      }))
    }
  };

  const slides = videoGen.buildQuizSlideData(fake10QScript);
  assert.strictEqual(slides.length, 21, '10 questions should yield 21 slides (1 hook + 10 questions + 10 answers)');
  
  // Verify Slide 1 (Hook slide)
  const hookSlide = slides[0];
  assert.strictEqual(hookSlide.partNumber, 1);
  const hookHtml = videoGen.renderSlideHtml(hookSlide);
  assert(hookHtml.includes('भारतीय संविधान • भाग 1'), 'Hook slide badge must include category and part number');
  assert(hookHtml.includes('PART 1 • GK CHALLENGE'), 'Hook slide sub-strip must include PART 1');
  assert(hookHtml.includes('दम है तो 10 में से 7 सही करके दिखाओ!'), 'Hook slide must challenge 7 out of 10');

  // Verify Slide 2 (Q1 Question)
  const q1Slide = slides[1];
  assert.strictEqual(q1Slide.partNumber, 1);
  const q1Html = videoGen.renderSlideHtml(q1Slide);
  assert(q1Html.includes('भारतीय संविधान • भाग 1'), 'Q1 slide badge must include category and part number');

  // Verify Slide 21 (Q10 Answer - Comment Challenge)
  const q10AnswerSlide = slides[20];
  assert.strictEqual(q10AnswerSlide.isCommentChallenge, true, 'Q10 answer slide must be Comment Challenge');
  const q10Html = videoGen.renderSlideHtml(q10AnswerSlide);
  assert(q10Html.includes('सवाल नंबर 10 का जवाब कमेंट में दें!'), 'Q10 challenge must prompt comment answer');

  console.log('  ✅ 10-Question slide deck verified: 21 slides, category & part badge rendered, Q10 comment challenge active!');

  // Test 4: Pacing & Question Count in Script Writer
  console.log('\n4. Testing Script Writer question count & hook for Shorts...');
  const writer = new ScriptWriterAgent();
  const count = writer.parseRequestedQuestionCount({ contentType: 'quiz_short_no_image' });
  assert.strictEqual(count, 10, 'Default question count for Shorts must be 10');
  console.log(`  ✅ Script writer requested question count: ${count}`);

  console.log('\n🎉 ALL 10-QUESTION & PART COUNTER TESTS PASSED!');
}

runTests().catch(err => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
