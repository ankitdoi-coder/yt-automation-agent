/**
 * Facebook Reels Daily Scheduler & Self-Optimization Daemon
 *
 * Conservative 1-reel/day schedule (paused unless FB_SCHEDULER_ENABLED=true).
 * Uses shared metadata builder so captions and tags stay aligned with fb-runner.
 *
 * Usage:
 *   node facebook/fb-scheduler.js
 */

const cron = require('node-cron');
const { ContentVault } = require('./content-vault');
const { FacebookVideoMaker } = require('./video-maker');
const { FacebookUploader } = require('./fb-uploader');
const { FacebookAnalyticsAgent } = require('./analytics-agent');
const { buildReelMetadata } = require('./export-deliverer');

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
    const videoPath = await videoMaker.createReel(item, { index: Math.floor(Math.random() * 3), commentChallenge: true });
    const { title, description } = buildReelMetadata(item);

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
console.log('⏸️ FACEBOOK REELS SCHEDULER (CONSERVATIVE 1-REEL/DAY MODE)');
console.log('====================================================');

if (process.env.FB_SCHEDULER_ENABLED !== 'true') {
  console.log('⚠️ Scheduler is currently PAUSED to prevent repetitive uploads until visibility check passes.');
  console.log('👉 To re-enable daily posting (1 reel/day at 08:30 PM IST), set FB_SCHEDULER_ENABLED=true in .env');
} else {
  console.log('Posting Schedule active (1 High-Yield Reel Daily):');
  console.log('  1. 08:30 PM IST (Peak Evening Family Slot)');
  console.log('Analytics Schedule active:');
  console.log('  👉 11:30 PM IST (Nightly Auto-Optimization)');
  console.log('Scheduler running... Press Ctrl+C to stop.\n');

  // 8:30 PM IST (1 high quality reel per day to avoid Meta spam/repetitive throttling)
  cron.schedule('30 20 * * *', () => postSingleReel());

  // 11:30 PM IST - Daily Analytics & Adaptation
  cron.schedule('30 23 * * *', () => runDailyAnalytics());
}
