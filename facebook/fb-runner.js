/**
 * Master Runner for Facebook Automation (ExamIQ Bharat)
 * 1. Generates & Publishes High-Yield Exam GK Reels (Vertical 9:16 Shorts)
 * 2. Generates & Publishes AI-Illustrated Quiz Image Posts (Gemini / Pollinations)
 * 
 * Usage:
 *   node facebook/fb-runner.js
 *   node facebook/fb-runner.js --count 1
 *   node facebook/fb-runner.js --photo-only
 */

require('dotenv').config();
const { ContentVault } = require('./content-vault');
const { FacebookVideoMaker } = require('./video-maker');
const { FacebookUploader } = require('./fb-uploader');
const { AIQuizImageGenerator } = require('./ai-quiz-image-generator');

async function runFacebookReelsAutomation() {
  console.log('====================================================');
  console.log('🚀 EXAM IQ BHARAT: FACEBOOK AUTO-POSTING AGENT');
  console.log('====================================================');

  const args = process.argv.slice(2);
  let count = 1; // Default 1 reel per run
  const countIdx = args.indexOf('--count');
  if (countIdx !== -1 && args[countIdx + 1]) {
    count = parseInt(args[countIdx + 1], 10) || 1;
  }

  const isPhotoOnly = args.includes('--photo-only');
  const skipPhoto = args.includes('--skip-photo');

  console.log(`Target Page: ${process.env.FB_PAGE_NAME || 'Exam IQ Bharat'} (ID: ${process.env.FB_PAGE_ID})`);
  console.log(`Mode: ${isPhotoOnly ? 'AI Photo Quiz Post Only' : `${count} Exam GK Reel(s) + AI Photo Post`}`);
  console.log('----------------------------------------------------\n');

  const vault = new ContentVault();
  const videoMaker = new FacebookVideoMaker();
  const uploader = new FacebookUploader();
  const photoGenerator = new AIQuizImageGenerator();

  const results = [];

  // ==========================================
  // 1. Generate & Upload Exam GK Reels (Videos)
  // ==========================================
  if (!isPhotoOnly) {
    const questions = await vault.getBatchQuestions(count);
    console.log(`[Batch] Selected ${questions.length} Exam GK question(s) for this run.\n`);

    for (let i = 0; i < questions.length; i++) {
      const item = questions[i];
      console.log(`----------------------------------------------------`);
      console.log(`🎬 Processing Reel [${i + 1}/${questions.length}]: "${item.title}"`);
      console.log(`📚 Topic: ${item.topic}`);
      console.log(`❓ Question: ${item.question}`);
      console.log(`✅ Correct Answer: ${item.answerText}`);
      console.log(`----------------------------------------------------`);

      try {
        // 1. Generate Video
        const startTime = Date.now();
        const videoPath = await videoMaker.createReel(item, i);
        const renderDuration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⚡ Rendered in ${renderDuration}s: ${videoPath}`);

        // 2. Upload to Facebook Reels
        console.log(`📤 Uploading to Facebook Reels...`);
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

        // 3. Record in History
        vault.recordUpload(item, uploadRes);

        results.push({
          type: 'REEL_VIDEO',
          title: item.title,
          status: 'SUCCESS',
          id: uploadRes.id,
          url: uploadRes.url,
        });

        console.log(`🎉 [${i + 1}/${questions.length}] Reel published! URL: ${uploadRes.url}\n`);

        if (i < questions.length - 1) {
          console.log(`⏳ Waiting 8s before next item...`);
          await new Promise(r => setTimeout(r, 8000));
        }
      } catch (err) {
        console.error(`❌ [${i + 1}/${questions.length}] Failed for "${item.title}":`, err.response?.data || err.message);
        results.push({
          type: 'REEL_VIDEO',
          title: item.title,
          status: 'FAILED',
          error: err.message,
        });
      }
    }
  }

  // ==========================================
  // 2. Generate & Upload AI Quiz Image Post
  // ==========================================
  if (!skipPhoto) {
    console.log(`----------------------------------------------------`);
    console.log(`🎨 Generating Companion AI Quiz Image Post...`);
    console.log(`----------------------------------------------------`);
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
      console.error(`❌ AI Quiz Photo post failed:`, photoErr.response?.data || photoErr.message);
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

  const successfulCount = results.filter(r => r.status === 'SUCCESS').length;
  console.log(`\nCompleted: ${successfulCount}/${results.length} item(s) published successfully to Exam IQ Bharat.`);
}

if (require.main === module) {
  runFacebookReelsAutomation().catch(err => {
    console.error('Fatal Runner Error:', err);
    process.exit(1);
  });
}

module.exports = { runFacebookReelsAutomation };
