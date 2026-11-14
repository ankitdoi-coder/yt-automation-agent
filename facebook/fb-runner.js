/**
 * Master Runner for Facebook Automation (ExamIQ Bharat)
 * Delivery Modes:
 *   1. zernio (Automatic Public Reels via Zernio's Live Meta App — zero Business Verification / App Review)
 *   2. export (Creates Ready-to-Schedule MP4 + captions bundle ZIP + optional Telegram delivery)
 *   3. publish_api (Direct Meta Graph API upload — only for Live/Published Meta Apps)
 *   Default ('auto'): chooses 'zernio' automatically if ZERNIO_API_KEY is configured, otherwise 'export'.
 *
 * Usage:
 *   node facebook/fb-runner.js --count 1
 *   node facebook/fb-runner.js --publish-zernio --count 1
 *   node facebook/fb-runner.js --export-only --count 7
 *   node facebook/fb-runner.js --publish-api --count 1
 */

require('dotenv').config();
const path = require('path');
const { ContentVault } = require('./content-vault');
const { FacebookVideoMaker } = require('./video-maker');
const { FacebookUploader } = require('./fb-uploader');
const { ZernioUploader } = require('./zernio-uploader');
const { AIQuizImageGenerator } = require('./ai-quiz-image-generator');
const {
  buildReelMetadata,
  createExportBundle,
  sendToTelegram,
} = require('./export-deliverer');
const { selectBestHook } = require('../utils/instagram-hook-engine');

/**
 * Resolves delivery mode from CLI flags or environment.
 * Default 'auto' selects 'zernio' when ZERNIO_API_KEY is configured, otherwise 'export'.
 */
function resolveDeliveryMode(args = [], env = process.env) {
  if (args.includes('--publish-zernio') || args.includes('--zernio')) {
    return 'zernio';
  }
  if (args.includes('--publish-api') || args.includes('--api')) {
    return 'publish_api';
  }
  if (args.includes('--export-only') || args.includes('--export')) {
    return 'export';
  }
  const envMode = String(env.FB_DELIVERY_MODE || 'auto').trim().toLowerCase();
  if (envMode === 'zernio') return 'zernio';
  if (envMode === 'publish_api' || envMode === 'api') return 'publish_api';
  if (envMode === 'export') return 'export';
  return String(env.ZERNIO_API_KEY || '').trim() ? 'zernio' : 'export';
}

/**
 * Resolves target social platform(s): 'facebook', 'instagram', or 'both'.
 */
function resolveSocialTarget(args = [], env = process.env) {
  if (args.includes('--both') || args.includes('--multi') || args.includes('--all-socials') || args.includes('--all')) {
    return 'both';
  }
  if (args.includes('--instagram') || args.includes('--insta') || args.includes('--ig')) {
    return 'instagram';
  }
  if (args.includes('--facebook') || args.includes('--fb')) {
    return 'facebook';
  }
  const targetIdx = args.indexOf('--target');
  if (targetIdx !== -1 && args[targetIdx + 1]) {
    const t = args[targetIdx + 1].trim().toLowerCase();
    if (['facebook', 'instagram', 'both', 'all'].includes(t)) {
      return t === 'all' ? 'both' : t;
    }
  }
  const envTarget = String(env.SOCIAL_DELIVERY_TARGET || env.FB_TARGET_PLATFORM || 'both').trim().toLowerCase();
  return ['facebook', 'instagram', 'both'].includes(envTarget) ? envTarget : 'both';
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

  const socialTarget = options.socialTarget || resolveSocialTarget(args, process.env);

  console.log('====================================================');
  console.log('🚀 EXAM IQ BHARAT: SOCIAL REELS AGENT (FB & INSTA)');
  console.log('====================================================');
  console.log(`Target Page: ${process.env.FB_PAGE_NAME || 'Exam IQ Bharat'} (ID: ${process.env.FB_PAGE_ID || '1289712677569663'})`);
  console.log(`Delivery Mode: ${deliveryMode.toUpperCase()} | Social Target: ${socialTarget.toUpperCase()} | Reels Count: ${isPhotoOnly ? 0 : count}`);
  console.log('----------------------------------------------------\n');

  const vault = options.vault || new ContentVault();
  const videoMaker = options.videoMaker || new FacebookVideoMaker();
  const zernioUploader = deliveryMode === 'zernio' ? (options.zernioUploader || new ZernioUploader()) : null;
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
        // Evaluate and select highest-scoring hook formula (Hindi/English/Hinglish)
        const hookResult = selectBestHook(item);
        if (hookResult && hookResult.hookText) {
          item.englishHook = hookResult.hookText;
          item.hookScore = hookResult.score;
          item.hookFormula = hookResult.winningHook ? hookResult.winningHook.formula : null;
          console.log(`🎯 Algorithmic Hook Selected [Score: ${hookResult.score}, Formula: ${item.hookFormula || 'Custom'}]: "${item.englishHook}"`);
        }

        const metadata = buildReelMetadata(item);
        const enrichedItem = { ...item, englishHook: metadata.englishHook, hookScore: item.hookScore, hookFormula: item.hookFormula };

        const startTime = Date.now();
        const videoPath = await videoMaker.createReel(enrichedItem, { index: i, commentChallenge: true });
        const renderDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⚡ Rendered in ${renderDuration}s: ${videoPath}`);

        if (deliveryMode === 'export') {
          renderedForExport.push({ item, videoPath, metadata });
          results.push({
            type: 'REEL_EXPORT',
            title: item.title,
            status: 'EXPORTED',
            file: path.basename(videoPath),
          });
        } else if (deliveryMode === 'zernio') {
          console.log(`🚀 Auto-publishing public Reel via Zernio (Target: ${socialTarget.toUpperCase()})...`);
          const uploadRes = await zernioUploader.publishReel(videoPath, {
            title: metadata.title,
            description: metadata.description,
            firstComment: metadata.pinnedComment,
            target: socialTarget,
            item: enrichedItem,
          });
          vault.recordUpload(item, uploadRes);

          const resultType = socialTarget === 'instagram'
            ? 'INSTAGRAM_REEL'
            : (socialTarget === 'both' ? 'MULTI_REEL' : 'ZERNIO_REEL');

          results.push({
            type: resultType,
            title: item.title,
            status: 'SUCCESS',
            id: uploadRes.id,
            url: uploadRes.url || uploadRes.zernioPostId,
          });
          console.log(`🎉 [${i + 1}/${questions.length}] Live publicly via Zernio! URL: ${uploadRes.url || uploadRes.zernioPostId}\n`);

          if (i < questions.length - 1) {
            console.log('⏳ Waiting 5s before next upload...');
            await new Promise(r => setTimeout(r, 5000));
          }
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
          type: deliveryMode === 'export' ? 'REEL_EXPORT' : (deliveryMode === 'zernio' ? 'ZERNIO_REEL' : 'REEL_VIDEO'),
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
  resolveSocialTarget,
  runFacebookReelsAutomation,
};
