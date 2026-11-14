'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

// 1. Hook Formulas (26 total, BOM-free)
test('Feature 1: hooks.json contains at least 26 valid formulas without UTF-8 BOM', () => {
  const filePath = path.resolve(__dirname, '../skills/yt-script/hooks.json');
  assert.ok(fs.existsSync(filePath), 'hooks.json must exist');
  
  const raw = fs.readFileSync(filePath, 'utf8');
  assert.notEqual(raw.charCodeAt(0), 0xFEFF, 'File must not have UTF-8 BOM');
  
  const parsed = JSON.parse(raw);
  assert.ok(Array.isArray(parsed.hooks), 'hooks must be an array');
  assert.ok(parsed.hooks.length >= 26, `Expected at least 26 hooks, found ${parsed.hooks.length}`);
  
  const ids = parsed.hooks.map(h => h.id);
  assert.ok(ids.includes('percent-fail-hindi'), 'Must have percent-fail-hindi formula');
  assert.ok(ids.includes('ias-favorite'), 'Must have ias-favorite formula');
  assert.ok(ids.includes('30-second-test'), 'Must have 30-second-test formula');
  assert.ok(ids.includes('shocking-fact-hindi'), 'Must have shocking-fact-hindi formula');
  assert.ok(ids.includes('only-toppers-know'), 'Must have only-toppers-know formula');
});

// 2. Instagram Hook Engine
test('Feature 1b: instagram-hook-engine evaluates 3 candidates and selects top-scoring hook', () => {
  const { selectBestHook, generateGKHookCandidates } = require('../utils/instagram-hook-engine');
  
  const item = {
    title: 'भारत का सबसे बड़ा बांध कौन सा है?',
    topic: 'Geography',
    category: 'geography',
    question: 'Which is the highest dam in India?',
    answer: 'Tehri Dam'
  };

  const candidates = generateGKHookCandidates(item);
  assert.equal(candidates.length, 3, 'Must generate exactly 3 candidates (English, Hindi, Hinglish)');

  const result = selectBestHook(item);
  assert.ok(result.hookText, 'Must have winning hookText');
  assert.ok(typeof result.score === 'number' && result.score >= 0, 'Score must be a non-negative number');
  assert.equal(result.allCandidates.length, 3, 'allCandidates must contain 3 scored entries');
  assert.ok(result.winningHook, 'Must contain winningHook details');
});

// 3. Caption Humanizer
test('Feature 4: caption-humanizer removes English and Hindi AI tells cleanly', () => {
  const { humanizeCaption } = require('../utils/caption-humanizer');
  
  const aiCaption = 'यह comprehensive गाइड आपको certainly मदद करेगी — delve into Indian Polity. Furthermore, यह बिल्कुल महत्वपूर्ण है।';
  const result = humanizeCaption(aiCaption);

  assert.ok(result.changesCount > 0, 'Must detect and fix AI tells');
  assert.ok(!result.humanized.includes('comprehensive'), 'Should remove comprehensive');
  assert.ok(!result.humanized.includes('certainly'), 'Should remove certainly');
  assert.ok(!result.humanized.includes('delve into'), 'Should remove delve into');
  assert.ok(!result.humanized.includes('—'), 'Should convert em-dash to hyphen');
  assert.ok(!result.humanized.includes('Furthermore,'), 'Should replace Furthermore');
  assert.ok(!result.humanized.includes('बिल्कुल'), 'Should strip बिल्कुल');
});

// 4. Caption Linter & Auto-Fix
test('Feature 6: caption-linter identifies fold overflows and autoFixCaption adds emoji & newline', () => {
  const { lintCaption, autoFixCaption } = require('../utils/caption-linter');
  
  // A caption exceeding the 125 char fold limit on line 1 without emoji or linebreaks
  const longCaption = 'This is an extremely long single-line caption designed specifically to test whether the linter catches mobile fold overflow before hashtags #IndiaGK #UPSC';
  
  const lint = lintCaption(longCaption);
  assert.ok(!lint.passed, 'Caption exceeding 125 chars on line 1 should not pass');
  assert.ok(lint.issues.some(i => i.includes('hook_too_long')), 'Must flag hook_too_long');

  const fixed = autoFixCaption(longCaption, { category: 'geography' });
  assert.ok(fixed.fixed, 'autoFixCaption must apply fixes');
  assert.ok(fixed.caption.startsWith('🗺️'), 'Should add category emoji at start');
  assert.ok(fixed.caption.includes('\n#'), 'Should insert newline before hashtags');
});

// 5. Platform Hook Adapter
test('Feature 3: platform-hook-adapter generates differentiated hooks for YouTube, Instagram, Facebook', () => {
  const { generatePlatformHooks } = require('../utils/platform-hook-adapter');
  
  const item = {
    title: 'भारत की पहली महिला राष्ट्रपति',
    topic: 'Polity',
    category: 'polity',
    question: 'Who was the first woman President of India?',
    answer: 'Pratibha Patil'
  };

  const hooks = generatePlatformHooks(item);
  assert.ok(hooks.youtube.adaptedHook.includes('Quiz'), 'YouTube hook should be keyword/quiz oriented');
  assert.ok(hooks.instagram.adaptedHook.includes('97%'), 'Instagram hook should have viral percentage challenge');
  assert.ok(hooks.facebook.adaptedHook.includes('Can you answer'), 'Facebook hook should have engagement question');
});

// 6. Channel Outlier Tracker
test('Feature 2: channel-outlier-tracker calculates median views and saves report', async () => {
  const { ChannelOutlierTracker } = require('../utils/channel-outlier-tracker');
  const tracker = new ChannelOutlierTracker({ minMultiplier: 2.0 });

  const result = await tracker.analyzeOurOutliers();
  assert.ok(typeof result.median === 'number', 'Median must be a number');
  assert.ok(Array.isArray(result.outliers), 'Outliers must be an array');
  assert.ok(Array.isArray(result.topFormulas), 'topFormulas must be an array');
});

// 7. Content Calendar
test('Feature 5: content-calendar produces balanced 7-day schedule with SSC/Railway/UPSC focus', () => {
  const { generateWeeklyCalendar } = require('../facebook/content-calendar');
  const calendar = generateWeeklyCalendar();

  assert.equal(calendar.length, 7, 'Must generate exactly 7 days');
  assert.equal(calendar[0].dayName, 'Monday');
  assert.equal(calendar[6].dayName, 'Sunday');

  // Verify categories and posts structure
  for (const day of calendar) {
    assert.ok(day.category, 'Each day must have a category');
    assert.ok(day.examFocus, 'Each day must have an exam focus');
    assert.ok(day.posts.morning.topic, 'Must have morning topic');
    assert.ok(day.posts.evening.topic, 'Must have evening topic');
    assert.notEqual(day.posts.morning.topic, day.posts.evening.topic, 'Morning and evening topics must differ');
  }
});

// 8. Daily Repurpose Pipeline
test('Feature 3b: repurpose-daily finds candidate and builds valid repurpose-plan', async () => {
  const { repurposeDaily } = require('../scripts/repurpose-daily');
  const plan = await repurposeDaily();

  assert.ok(plan, 'Repurpose plan must be generated');
  assert.ok(plan.platformHooks.instagram.adaptedHook, 'Must have Instagram adapted hook');
  assert.ok(plan.instagramDelivery.caption, 'Must have Instagram caption');
  assert.ok(plan.instagramDelivery.foldPreview.length <= 125, 'Fold preview should be ≤125 chars');
});
