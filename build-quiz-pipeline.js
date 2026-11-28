/**
 * Automated Quiz-Video Pipeline for ExamIQ Bharat / YouTube Shorts & Socials
 * 
 * Generates vertical 1080x1920 quiz videos from questions.json using:
 * 1. Playwright (Chromium) to render pixel-identical quiz-card.html frames
 * 2. FFmpeg to build 30fps clips with 8s question, 3s answer, 0.3s crossfade, and tick SFX
 * 3. FFmpeg concatenation to produce final.mp4
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { spawn } = require('child_process');
const { chromium } = require('playwright');
const quizRenderer = require('./quiz-renderer');

// Helper to run FFmpeg commands with Promise
function runFFmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', chunk => { stderr += chunk.toString(); });
    proc.on('close', code => {
      if (code === 0) resolve({ stderr });
      else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-300)}`));
    });
    proc.on('error', reject);
  });
}

// Ensure a clean tick sound exists for question frame start
async function ensureTickSound(assetsDir) {
  const tickPath = path.join(assetsDir, 'tick.wav');
  if (fs.existsSync(tickPath) && fs.statSync(tickPath).size > 100) {
    return tickPath;
  }
  const sourceTickPath = path.join(assetsDir, 'countdown_tick_tock.wav');
  if (fs.existsSync(sourceTickPath)) {
    try {
      await runFFmpeg(['-y', '-i', sourceTickPath, '-ss', '0', '-t', '0.3', tickPath]);
      return tickPath;
    } catch (_) {}
  }
  // Synthesize a clean 0.2s woodblock / clock tick if no file exists
  await runFFmpeg([
    '-y', '-f', 'lavfi',
    '-i', 'sine=frequency=1200:duration=0.15,afade=t=out:st=0.08:d=0.07',
    '-c:a', 'pcm_s16le', tickPath
  ]);
  return tickPath;
}

async function main() {
  const questionsFile = process.argv[2] || 'questions.json';
  const templatePath = path.resolve(__dirname, 'quiz-card.html');
  const framesDir = path.resolve(__dirname, 'frames');
  const clipsDir = path.resolve(__dirname, 'clips');
  const assetsAudioDir = path.resolve(__dirname, 'assets', 'audio');
  const finalVideoPath = path.resolve(__dirname, 'final.mp4');

  if (!fs.existsSync(questionsFile)) {
    console.error(`❌ Input questions file not found: ${questionsFile}`);
    process.exit(1);
  }

  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Visual template not found: ${templatePath}`);
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync(questionsFile, 'utf8'));
  const total = questions.length;
  console.log(`\n======================================================`);
  console.log(`🎬 EXAMIQ BHARAT — QUIZ VIDEO PIPELINE`);
  console.log(`📋 Total Questions: ${total}`);
  console.log(`🎨 Visual Template: ${templatePath}`);
  console.log(`======================================================\n`);

  // Create required directories
  fs.mkdirSync(framesDir, { recursive: true });
  fs.mkdirSync(clipsDir, { recursive: true });
  fs.mkdirSync(assetsAudioDir, { recursive: true });

  const tickSoundPath = await ensureTickSound(assetsAudioDir);

  const useLegacy = process.env.QUIZ_TEMPLATE === 'legacy';
  let renderedSlides = null;
  let browser;
  let context;
  let page;
  if (useLegacy) {
    console.log(`[1/3] Using legacy quiz-card.html renderer...`);
    try { browser = await chromium.launch({ channel: 'chrome', headless: true }); }
    catch (_) { browser = await chromium.launch({ headless: true }); }
    context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
    page = await context.newPage();
  } else {
    console.log(`[1/3] Rendering shared quiz slides (1080x1920)...`);
    renderedSlides = await quizRenderer.renderQuizBatch(questions.map((item, i) => ({
      ...item,
      subject: item.subject || item.topic || item.title,
      question: item.question || item.q,
      part: item.part || item.partNum || '1/2',
      qNo: item.qNo || item.number || i + 1,
      correctOption: item.correctOption || item.correctLetter || item.correct,
      explanation: item.explanation || item.fact || item.reason || '',
    })), { profile: 'shorts-9x16', showCtaButtons: false });
  }

  const generatedClips = [];

  // 2. Render each question: question frame & answer frame
  for (let i = 0; i < total; i++) {
    const item = questions[i];
    const n = i + 1;
    const part = item.part || 1;
    const correctLetter = (item.correct || 'A').toUpperCase();

    console.log(`\n▶ Processing Question ${n}/${total}: "${item.q}"`);

    // Build URL query params with UTF-8 encoding
    const baseParams = new URLSearchParams({
      title: item.title || 'सामान्य ज्ञान',
      part: String(part),
      n: String(n),
      total: String(total),
      q: item.q || '',
      a: item.options?.[0] || '',
      b: item.options?.[1] || '',
      c: item.options?.[2] || '',
      d: item.options?.[3] || '',
      correct: correctLetter
    });

    const fileUrlBase = `${pathToFileURL(templatePath).href}?${baseParams.toString()}`;

    // Frame (a): Question Frame (no reveal)
    const questionFramePath = path.join(framesDir, `q${n}_question.png`);
    if (useLegacy) {
      await page.goto(fileUrlBase, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(100);
      await page.screenshot({ path: questionFramePath });
    } else fs.writeFileSync(questionFramePath, renderedSlides[i].questionPng);
    console.log(`  📸 Captured Question Frame: frames/q${n}_question.png`);

    // Frame (b): Answer Frame (reveal=1)
    const answerFramePath = path.join(framesDir, `q${n}_answer.png`);
    const fileUrlAnswer = `${fileUrlBase}&reveal=1`;
    if (useLegacy) {
      await page.goto(fileUrlAnswer, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(100);
      await page.screenshot({ path: answerFramePath });
    } else fs.writeFileSync(answerFramePath, renderedSlides[i].answerPng);
    console.log(`  📸 Captured Answer Frame (Correct: ${correctLetter}): frames/q${n}_answer.png`);

    // 3. Render 1080x1920, 30fps clip via FFmpeg:
    //    - Question frame: 8.0s
    //    - Answer frame: 3.0s
    //    - 0.3s crossfade at offset 7.7s (total = 10.7s)
    //    - Tick sound at start of question frame
    const clipPath = path.join(clipsDir, `q${n}.mp4`);
    console.log(`  🎞️  Building clip via FFmpeg (8s question + 3s answer + 0.3s crossfade + tick)...`);

    await runFFmpeg([
      '-y',
      '-loop', '1', '-t', '8.0', '-framerate', '30', '-i', questionFramePath,
      '-loop', '1', '-t', '3.0', '-framerate', '30', '-i', answerFramePath,
      '-i', tickSoundPath,
      '-filter_complex',
      '[0:v][1:v]xfade=transition=fade:duration=0.3:offset=7.7,format=yuv420p[v];' +
      '[2:a]aformat=channel_layouts=stereo:sample_rates=44100,apad=whole_dur=10.7[a]',
      '-map', '[v]',
      '-map', '[a]',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-r', '30',
      '-s', '1080x1920',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', '10.7',
      clipPath
    ]);

    generatedClips.push(clipPath);
    console.log(`  ✅ Clip q${n}.mp4 ready (${(fs.statSync(clipPath).size / 1024 / 1024).toFixed(2)} MB)`);
  }

  if (browser) await browser.close();

  // 4. Concatenate all question clips into final.mp4
  console.log(`\n[3/3] Concatenating ${generatedClips.length} clips into final.mp4...`);
  const concatListPath = path.join(clipsDir, 'concat_list.txt');
  const concatContent = generatedClips.map(clip => `file '${clip.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(concatListPath, concatContent, 'utf8');

  await runFFmpeg([
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', concatListPath,
    '-c', 'copy',
    finalVideoPath
  ]);

  const finalSize = (fs.statSync(finalVideoPath).size / 1024 / 1024).toFixed(2);
  console.log(`\n🎉 SUCCESS: final.mp4 generated!`);
  console.log(`📍 Output Path: ${finalVideoPath}`);
  console.log(`📦 Size: ${finalSize} MB`);
  console.log(`🎞️  Total Clips: ${generatedClips.length}`);
}

main().catch(err => {
  console.error('\n❌ Error running quiz pipeline:', err);
  process.exit(1);
});
