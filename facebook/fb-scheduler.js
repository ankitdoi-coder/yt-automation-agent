/**
 * Facebook Reels Daily Scheduler & Self-Optimization Daemon
 * 
 * 1. Posts 5 viral reels every day at peak Indian Facebook engagement hours:
 *    - 09:00 AM (Morning scroll)
 *    - 01:00 PM (Lunch break)
 *    - 05:00 PM (Evening tea time)
 *    - 08:30 PM (Family dinner / post-dinner peak)
 *    - 10:30 PM (Bedtime late night viral scroll)
 * 
 * 2. Runs Analytics & Self-Optimization Agent every night at 11:30 PM:
 *    - Evaluates views, watch time, comments, and shares
 *    - Optimizes color themes, timer duration, and hooks for the next day!
 * 
 * Usage:
 *   node facebook/fb-scheduler.js
 */

const cron = require('node-cron');
const { ContentVault } = require('./content-vault');
const { FacebookVideoMaker } = require('./video-maker');
const { FacebookUploader } = require('./fb-uploader');
const { FacebookAnalyticsAgent } = require('./analytics-agent');

async function postSingleReel() {
  console.log(`\n[${new Date().toLocaleTimeString()}] ⏰ Scheduled Reel trigger started...`);
  const vault = new ContentVault();
  const videoMaker = new FacebookVideoMaker();
  const uploader = new FacebookUploader();

  const questions = await vault.getBatchQuestions(1);
  if (!questions.length) {
    console.log('No questions available.');
    return;
  }

  const item = questions[0];
  try {
    const videoPath = await videoMaker.createReel(item, Math.floor(Math.random() * 3));
    const title = `${item.title} | ${item.topic} | Exam IQ Bharat #reels #FacebookReels`;
    const baseTags = Array.isArray(item.tags)
      ? [...item.tags]
      : (typeof item.tags === 'string' ? item.tags.split(/\s+/) : ['#ExamIQ', '#GKQuiz', '#GeneralKnowledge', '#StaticGK', '#SSC', '#Railway']);
    if (!baseTags.some(t => /#reels/i.test(t))) baseTags.push('#Reels');
    if (!baseTags.some(t => /#facebookreels/i.test(t))) baseTags.push('#FacebookReels');
    if (!baseTags.some(t => /#reelsviral/i.test(t))) baseTags.push('#ReelsViral');

    const description = [
      `🎯 ${item.title} | ${item.topic}`,
      '',
      `Q. ${item.question}`,
      ...(item.options || []).map(o => `${o.letter}) ${o.text}`),
      '',
      `👉 अपना उत्तर कमेंट बॉक्स में बताएं! 🏆`,
      `🔔 रोज़ाना नए GK Tests के लिए Exam IQ Bharat को Follow करें!`,
      '',
      baseTags.join(' ')
    ].join('\n');

    const uploadRes = await uploader.uploadVideo(videoPath, { title, description });
    vault.recordUpload(item, uploadRes);
    console.log(`[Scheduled] ✅ Successfully published Exam GK Reel: ${uploadRes.url}`);
  } catch (err) {
    console.error('[Scheduled] ❌ Failed to post reel:', err.response?.data || err.message);
  }
}

async function runDailyAnalytics() {
  console.log(`\n[${new Date().toLocaleTimeString()}] 📊 Running scheduled Facebook Analytics & Content Optimization...`);
  const analytics = new FacebookAnalyticsAgent();
  try {
    await analytics.runAnalysis();
    console.log('[Analytics] ✅ Performance analyzed & adaptations saved for upcoming reels!');
  } catch (err) {
    console.error('[Analytics] ❌ Analytics run failed:', err.message);
  }
}

console.log('====================================================');
console.log('🕒 FACEBOOK REELS 5-DAILY AUTOMATION & ANALYTICS CRON');
console.log('====================================================');
console.log('Posting Schedules active:');
console.log('  1. 09:00 AM IST (Morning)');
console.log('  2. 01:00 PM IST (Lunch)');
console.log('  3. 05:00 PM IST (Tea Time)');
console.log('  4. 08:30 PM IST (Evening)');
console.log('  5. 10:30 PM IST (Night)');
console.log('Analytics Schedule active:');
console.log('  👉 11:30 PM IST (Nightly Auto-Optimization)');
console.log('Scheduler running... Press Ctrl+C to stop.\n');

// 9:00 AM IST
cron.schedule('0 9 * * *', () => postSingleReel());
// 1:00 PM IST
cron.schedule('0 13 * * *', () => postSingleReel());
// 5:00 PM IST
cron.schedule('0 17 * * *', () => postSingleReel());
// 8:30 PM IST
cron.schedule('30 20 * * *', () => postSingleReel());
// 10:30 PM IST
cron.schedule('30 22 * * *', () => postSingleReel());

// 11:30 PM IST - Daily Analytics & Adaptation
cron.schedule('30 23 * * *', () => runDailyAnalytics());
