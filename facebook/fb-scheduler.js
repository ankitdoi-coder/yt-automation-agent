/**
 * Facebook Reels Daily Scheduler
 * Posts 5 viral reels every day at peak Indian Facebook engagement hours:
 * 1. 09:00 AM (Morning scroll)
 * 2. 01:00 PM (Lunch break)
 * 3. 05:00 PM (Evening tea time)
 * 4. 08:30 PM (Family dinner / post-dinner peak)
 * 5. 10:30 PM (Bedtime late night viral scroll)
 * 
 * Usage:
 *   node facebook/fb-scheduler.js
 */

const cron = require('node-cron');
const { runFacebookReelsAutomation } = require('./fb-runner');
const { ContentVault } = require('./content-vault');
const { FacebookVideoMaker } = require('./video-maker');
const { FacebookUploader } = require('./fb-uploader');

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

console.log('====================================================');
console.log('🕒 FACEBOOK REELS 5-DAILY AUTOMATION SCHEDULER');
console.log('====================================================');
console.log('Schedules active:');
console.log('  1. 09:00 AM (Morning)');
console.log('  2. 01:00 PM (Lunch)');
console.log('  3. 05:00 PM (Tea Time)');
console.log('  4. 08:30 PM (Evening)');
console.log('  5. 10:30 PM (Night)');
console.log('Scheduler running... Press Ctrl+C to stop.\n');

// 9:00 AM
cron.schedule('0 9 * * *', () => postSingleReel());
// 1:00 PM
cron.schedule('0 13 * * *', () => postSingleReel());
// 5:00 PM
cron.schedule('0 17 * * *', () => postSingleReel());
// 8:30 PM
cron.schedule('30 20 * * *', () => postSingleReel());
// 10:30 PM
cron.schedule('30 22 * * *', () => postSingleReel());
