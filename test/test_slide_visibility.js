const { AIVideoGenerator } = require('../utils/ai-video-generator');
const { chromium } = require('playwright');
const assert = require('assert');

(async () => {
  const gen = new AIVideoGenerator();

  // Test 1: Long Quiz
  const longScript = {
    title: 'Lucent GK Long Video',
    quiz: {
      isShort: false,
      subjectHindi: 'सामान्य ज्ञान (GK)',
      questions: [
        { number: 1, question: 'भारत का राष्ट्रीय पशु क्या है?', options: ['बाघ', 'शेर', 'हाथी', 'चीता'], answerIndex: 0 },
        { number: 2, question: 'भारत का राष्ट्रीय पक्षी क्या है?', options: ['कौआ', 'मोर', 'कबूतर', 'तोता'], answerIndex: 1 }
      ]
    }
  };

  const slides = gen.buildSlideData(longScript, []);
  const html = gen.createSlideshowHTML(longScript, [], slides);

  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const slideCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
  console.log('Testing Long Quiz Slide Opacity (Total slides:', slideCount, '):');

  for (let i = 0; i < slideCount; i++) {
    await page.evaluate((index) => {
      document.querySelectorAll('.slide').forEach((slide, s) => {
        const isActive = s === index;
        slide.classList.toggle('active', isActive);
        slide.style.opacity = isActive ? '1' : '0';
        slide.style.visibility = isActive ? 'visible' : 'hidden';
        slide.style.display = isActive ? '' : 'none';
      });
    }, i);

    const state = await page.evaluate((index) => {
      const el = document.querySelectorAll('.slide')[index];
      return {
        opacity: window.getComputedStyle(el).opacity,
        visibility: window.getComputedStyle(el).visibility,
        display: window.getComputedStyle(el).display
      };
    }, i);

    console.log(`  Slide ${i} computed state:`, state);
    assert.strictEqual(state.opacity, '1', `Slide ${i} must have opacity 1`);
    assert.strictEqual(state.visibility, 'visible', `Slide ${i} must have visibility: visible`);
    assert.notStrictEqual(state.display, 'none', `Slide ${i} must not be display: none`);
  }

  // Test 2: Short Quiz (Vertical)
  const shortScript = {
    title: 'Short GK',
    isShort: true,
    quiz: {
      isShort: true,
      questions: [
        { number: 1, question: 'सूर्य के सबसे निकट ग्रह कौन सा है?', options: ['बुध', 'शुक्र', 'पृथ्वी', 'मंगल'], answerIndex: 0 }
      ]
    }
  };

  const shortSlides = gen.buildSlideData(shortScript, []);
  const shortHtml = gen.createSlideshowHTML(shortScript, [], shortSlides);
  await page.setViewportSize({ width: 1080, height: 1920 });
  await page.setContent(shortHtml, { waitUntil: 'domcontentloaded' });
  const shortCount = await page.evaluate(() => document.querySelectorAll('.slide').length);
  console.log('Testing Short Quiz Slide Opacity (Total slides:', shortCount, '):');

  for (let i = 0; i < shortCount; i++) {
    await page.evaluate((index) => {
      document.querySelectorAll('.slide').forEach((slide, s) => {
        const isActive = s === index;
        slide.classList.toggle('active', isActive);
        slide.style.opacity = isActive ? '1' : '0';
        slide.style.visibility = isActive ? 'visible' : 'hidden';
        slide.style.display = isActive ? '' : 'none';
      });
    }, i);

    const state = await page.evaluate((index) => {
      const el = document.querySelectorAll('.slide')[index];
      return {
        opacity: window.getComputedStyle(el).opacity,
        visibility: window.getComputedStyle(el).visibility,
        display: window.getComputedStyle(el).display
      };
    }, i);

    console.log(`  Short Slide ${i} computed state:`, state);
    assert.strictEqual(state.opacity, '1', `Short Slide ${i} must have opacity 1`);
    assert.strictEqual(state.visibility, 'visible', `Short Slide ${i} must have visibility: visible`);
    assert.notStrictEqual(state.display, 'none', `Short Slide ${i} must not be display: none`);
  }

  console.log('🎉 ALL TESTS PASSED: All slides in long and short quizzes render with 100% opacity and proper visibility!');
  await browser.close();
})();
