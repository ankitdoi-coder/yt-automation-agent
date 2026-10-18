/**
 * Master Runner for Facebook Reels Automation
 * Completely separate from YouTube pipeline
 * 
 * Usage:
 *   node facebook/fb-runner.js
 *   node facebook/fb-runner.js --count 5
 *   node facebook/fb-runner.js --count 1
 */

require('dotenv').config();
const { ContentVault } = require('./content-vault');
const { FacebookVideoMaker } = require('./video-maker');
const { FacebookUploader } = require('./fb-uploader');

async function runFacebookReelsAutomation() {
  console.log('====================================================');
  console.log('🚀 FACEBOOK REELS AUTO-POSTING AGENT (STANDALONE)');
  console.log('====================================================');

  // Parse arguments
  const args = process.argv.slice(2);
  let count = 5; // Default 5 reels
  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    count = parseInt(args[countIdx + 1], 10) || 5;
  }

  console.log(`Target Batch: ${count} Viral Reels`);
  console.log(`Target Page: ${process.env.FB_PAGE_NAME || 'Exam IQ Bharat'} (ID: ${process.env.FB_PAGE_ID})`);
  console.log('----------------------------------------------------\n');

  const vault = new ContentVault();
  const videoMaker = new FacebookVideoMaker();
  const uploader = new FacebookUploader();

  const riddles = await vault.getBatchRiddles(count);
  console.log(`[Batch] Selected ${riddles.length} viral riddles for this run.\n`);

  const results = [];

  for (let i = 0; i < riddles.length; i++) {
    const item = riddles[i];
    console.log(`----------------------------------------------------`);
    console.log(`🎬 Processing Reel [${i + 1}/${riddles.length}]: "${item.title}"`);
    console.log(`Question: ${item.questionLines.join(' ')}`);
    console.log(`Answer: ${item.answerText}`);
    console.log(`----------------------------------------------------`);

    try {
      // 1. Generate Video
      const startTime = Date.now();
      const videoPath = await videoMaker.createReel(item, i);
      const renderDuration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`⚡ Rendered in ${renderDuration}s: ${videoPath}`);

      // 2. Upload to Facebook
      console.log(`📤 Uploading to Facebook Page...`);
      const uploadRes = await uploader.uploadReel(videoPath, item);

      // 3. Record in History
      vault.recordUpload(item, uploadRes);

      results.push({
        status: 'SUCCESS',
        title: item.title,
        id: uploadRes.id,
        url: uploadRes.url,
      });

      console.log(`🎉 [${i + 1}/${riddles.length}] Uploaded successfully! Reel URL: ${uploadRes.url}\n`);

      // Gentle pause between uploads (8 seconds) if more reels remain
      if (i < riddles.length - 1) {
        console.log(`⏳ Waiting 8s before next reel...`);
        await new Promise(r => setTimeout(r, 8000));
      }

    } catch (err) {
      console.error(`❌ [${i + 1}/${riddles.length}] Failed for "${item.title}":`, err.response?.data || err.message);
      results.push({
        status: 'FAILED',
        title: item.title,
        error: err.message,
      });
    }
  }

  console.log('\n====================================================');
  console.log('📊 BATCH EXECUTION SUMMARY');
  console.log('====================================================');
  console.table(results);

  const successfulCount = results.filter(r => r.status === 'SUCCESS').length;
  console.log(`\nCompleted: ${successfulCount}/${results.length} Reels published successfully.`);

  if (successfulCount === 0 && results.length > 0) {
    console.error('❌ Error: All Reel uploads failed in this run. Check error details above.');
    process.exit(1);
  }

  console.log('All done! You can check your Facebook Page reels feed.');
}

if (require.main === module) {
  runFacebookReelsAutomation().catch(err => {
    console.error('Fatal Runner Error:', err);
    process.exit(1);
  });
}

module.exports = { runFacebookReelsAutomation };
