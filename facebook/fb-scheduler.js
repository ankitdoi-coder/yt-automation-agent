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

  const riddles = await vault.getBatchRiddles(1);
  if (!riddles.length) {
    console.log('No riddles available.');
    return;
  }

  const item = riddles[0];
  try {
    const videoPath = await videoMaker.createReel(item, Math.floor(Math.random() * 5));
    const uploadRes = await uploader.uploadReel(videoPath, item);
    vault.recordUpload(item, uploadRes);
    console.log(`[Scheduled] ✅ Successfully published Reel: ${uploadRes.url}`);
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
