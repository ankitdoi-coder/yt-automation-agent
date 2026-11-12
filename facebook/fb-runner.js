/**
 * Master Runner for Facebook Automation (ExamIQ Bharat)
 * 1. Export Mode (Default): Generates vertical GK Reels (1080x1920 MP4) + ready-to-paste
 *    Meta Business Suite captions bundle (ZIP Artifact) and optionally sends to Telegram.
 * 2. Publish API Mode (--publish-api / FB_DELIVERY_MODE=publish_api): Uploads directly
 *    through Meta Graph API (only recommended once the Meta App is Live/Published).
 *
 * Usage:
 *   node facebook/fb-runner.js --count 7
 *   node facebook/fb-runner.js --export-only --count 7
 *   node facebook/fb-runner.js --publish-api --count 1
 *   node facebook/fb-runner.js --publish-api --photo-only
 */

require('dotenv').config();
const path = require('path');
const { ContentVault } = require('./content-vault');
const { FacebookVideoMaker } = require('./video-maker');
const { FacebookUploader } = require('./fb-uploader');
const { AIQuizImageGenerator } = require('./ai-quiz-image-generator');
const {
  buildReelMetadata,
  createExportBundle,
  sendToTelegram,
} = require('./export-deliverer');

/**
 * Resolves delivery mode from CLI flags or environment ('export' by default).
 */
function resolveDeliveryMode(args = [], env = process.env) {
  if (args.includes('--publish-api') || args.includes('--api')) {
    return 'publish_api';
  }
  if (args.includes('--export-only') || args.includes('--export')) {
    return 'export';
  }
  const envMode = String(env.FB_DELIVERY_MODE || 'export').trim().toLowerCase();
  return envMode === 'publish_api' || envMode === 'api' ? 'publish_api' : 'export';
}

/**
 * Parses positive --count flag (bounded 1..30) with fallback.
 */
function parseRequestedCount(args = [], fallback = 1) {
  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    const parsed = parseInt(args[countIdx + 1], 10);
    if (Number.isFinite(parsed) && parsed >= 1) {
      return Math.min(parsed, 30);
    }
  }
  return fallback;
}

async function runFacebookReelsAutomation(options = {}) {
  const args = options.args || process.argv.slice(2);
  const count = options.count || parseRequestedCount(args, 1);
  const deliveryMode = options.deliveryMode || resolveDeliveryMode(args, process.env);
  const isPhotoOnly = options.isPhotoOnly ?? args.includes('--photo-only');
  const skipPhoto = options.skipPhoto ?? args.includes('--skip-photo');

  console.log('====================================================');
  console.log('🚀 EXAM IQ BHARAT: FACEBOOK REELS AGENT');
  console.log('====================================================');
  console.log(`Target Page: ${process.env.FB_PAGE_NAME || 'Exam IQ Bharat'} (ID: ${process.env.FB_PAGE_ID || '1289712677569663'})`);
  console.log(`Delivery Mode: ${deliveryMode.toUpperCase()} | Reels Count: ${isPhotoOnly ? 0 : count}`);
  console.log('----------------------------------------------------\n');

  const vault = options.vault || new ContentVault();
  const videoMaker = options.videoMaker || new FacebookVideoMaker();
  const uploader = deliveryMode === 'publish_api' ? (options.uploader || new FacebookUploader()) : null;
  const photoGenerator = options.photoGenerator || new AIQuizImageGenerator();

  const results = [];
  const renderedForExport = [];

  // ==========================================
  // 1. Render & Deliver Exam GK Reels (Videos)
  // ==========================================
  if (!isPhotoOnly) {
    const questions = await vault.getBatchQuestions(count);
    console.log(`[Batch] Selected ${questions.length} Exam GK question(s) for this run.\n`);

    for (let i = 0; i < questions.length; i++) {
      const item = questions[i];
      console.log('----------------------------------------------------');
      console.log(`🎬 Processing Reel [${i + 1}/${questions.length}]: "${item.title}"`);
      console.log(`📚 Topic: ${item.topic}`);
      console.log(`❓ Question: ${item.question}`);
      console.log(`🔐 Answer Key: ${item.answerText}`);
      console.log('----------------------------------------------------');

      try {
        const startTime = Date.now();
        const videoPath = await videoMaker.createReel(item, { index: i, commentChallenge: true });
        const renderDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⚡ Rendered in ${renderDuration}s: ${videoPath}`);

        const metadata = buildReelMetadata(item);

        if (deliveryMode === 'export') {
          renderedForExport.push({ item, videoPath, metadata });
          results.push({
            type: 'REEL_EXPORT',
            title: item.title,
            status: 'EXPORTED',
            file: path.basename(videoPath),
          });
        } else {
          console.log('📤 Uploading to Facebook Reels via Graph API...');
          const uploadRes = await uploader.uploadVideo(videoPath, {
            title: metadata.title,
            description: metadata.description,
          });
          vault.recordUpload(item, { ...uploadRes, deliveryMode: 'FACEBOOK_API' });

          results.push({
            type: 'REEL_VIDEO',
            title: item.title,
            status: 'SUCCESS',
            id: uploadRes.id,
            url: uploadRes.url,
          });
          console.log(`🎉 [${i + 1}/${questions.length}] Reel published! URL: ${uploadRes.url}\n`);

          if (i < questions.length - 1) {
            console.log('⏳ Waiting 8s before next item...');
            await new Promise(r => setTimeout(r, 8000));
          }
        }
      } catch (err) {
        console.error(`❌ [${i + 1}/${questions.length}] Failed for "${item.title}":`, err.response?.data || err.message);
        results.push({
          type: deliveryMode === 'export' ? 'REEL_EXPORT' : 'REEL_VIDEO',
          title: item.title,
          status: 'FAILED',
          error: err.message,
        });
      }
    }
  }

  // ==========================================
  // 2. Package Export Bundle + Optional Telegram
  // ==========================================
  let exportBundle = null;
  let telegramResult = null;
  if (deliveryMode === 'export' && renderedForExport.length > 0) {
    exportBundle = createExportBundle(renderedForExport, {
      exportDir: options.exportDir,
      scheduleStartDate: options.scheduleStartDate,
    });

    exportBundle.items.forEach((manifestItem, idx) => {
      vault.recordUpload(renderedForExport[idx].item, {
        id: null,
        deliveryMode: 'EXPORT_READY',
      });
      if (results[idx]) {
        results[idx].file = manifestItem.filename;
        results[idx].schedule = manifestItem.suggestedSchedule;
      }
    });

    console.log('\n📦 READY-TO-SCHEDULE BUNDLE CREATED:');
    console.log(`   📁 Folder:   ${exportBundle.exportDir}`);
    console.log(`   📝 Captions: ${exportBundle.captionsPath}`);
    console.log(`   📋 Manifest: ${exportBundle.manifestPath}`);
    console.log('   👉 Schedule via Meta Business Suite: https://business.facebook.com\n');

    if (options.sendTelegram !== false) {
      telegramResult = await sendToTelegram(exportBundle.items, options.telegramOptions || {});
    }
  }

  // ==========================================
  // 3. Companion AI Quiz Image Post (API Mode Only)
  // ==========================================
  if (deliveryMode === 'publish_api' && !skipPhoto) {
    console.log('----------------------------------------------------');
    console.log('🎨 Generating Companion AI Quiz Image Post...');
    console.log('----------------------------------------------------');
    try {
      const photoRes = await photoGenerator.generateAndPublish();
      results.push({
        type: 'AI_IMAGE_POST',
        title: photoRes.item?.title || 'AI Quiz Photo',
        status: 'SUCCESS',
        id: photoRes.uploadRes.id,
        url: photoRes.uploadRes.url,
      });
      console.log(`🎉 AI Quiz Photo published! URL: ${photoRes.uploadRes.url}\n`);
    } catch (photoErr) {
      console.error('❌ AI Quiz Photo post failed:', photoErr.response?.data || photoErr.message);
      results.push({
        type: 'AI_IMAGE_POST',
        title: 'AI Quiz Photo',
        status: 'FAILED',
        error: photoErr.message,
      });
    }
  }

  console.log('\n====================================================');
  console.log('📊 EXECUTION SUMMARY');
  console.log('====================================================');
  console.table(results);

  const completedCount = results.filter(r => r.status === 'SUCCESS' || r.status === 'EXPORTED').length;
  console.log(`\nCompleted: ${completedCount}/${results.length} item(s) processed (${deliveryMode}).`);

  return {
    deliveryMode,
    results,
    exportBundle,
    telegramResult,
  };
}

if (require.main === module) {
  runFacebookReelsAutomation().catch(err => {
    console.error('Fatal Runner Error:', err);
    process.exit(1);
  });
}

module.exports = {
  parseRequestedCount,
  resolveDeliveryMode,
  runFacebookReelsAutomation,
};
