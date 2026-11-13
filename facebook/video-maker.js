/**
 * Facebook Reels Video Maker (High-Demand Educational & Viral GK Format)
 * Generates 1080x1920 Full HD Vertical MP4 Reels matching user's exact channel layout:
 * - Clean white background canvas
 * - Top Topic Pill (with book emojis)
 * - Sub-banner Hook bar (with shock emojis)
 * - Bold Question & 4 Clean Options (A, B, C, D)
 * - Option Reveal Highlight (Soft coral/red container with red border - Image 2 match)
 * - Center Watermark (Exam IQ Bharat emblem)
 * - Bottom Split Banner: Yellow [Exam IQ Bharat] + Red [को Follow करें 🔔]
 * - Crisp Hindi voiceover via edge-tts with Google TTS fallback
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const ffmpeg = require('../utils/ffmpeg');
const { ensureAudioAssets } = require('./audio-effects');

class FacebookVideoMaker {
  constructor() {
    this.outputDir = path.resolve(__dirname, 'output');
    this.tempDir = path.resolve(__dirname, 'temp');
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });

    // Load channel logo as base64 for watermark if present
    this.logoBase64 = null;
    try {
      const logoPath = path.resolve(__dirname, '../assets/channel_logo.png');
      if (fs.existsSync(logoPath)) {
        this.logoBase64 = fs.readFileSync(logoPath).toString('base64');
      }
    } catch (_) {}

    // Ensure retention audio assets (suspense BGM, countdown tick-tock SFX, reveal chime)
    try {
      this.audioAssets = ensureAudioAssets();
    } catch (err) {
      console.warn(`[VideoMaker] Audio assets initialization warning: ${err.message}`);
      this.audioAssets = null;
    }
  }

  getLearnedPrefs() {
    try {
      const prefsPath = path.resolve(__dirname, 'data/learned_preferences.json');
      if (fs.existsSync(prefsPath)) {
        return JSON.parse(fs.readFileSync(prefsPath, 'utf8'));
      }
    } catch (_) {}
    return null;
  }

  _getAIVideoGenerator() {
    if (!this._aiVideoGenerator) {
      try {
        const { AIVideoGenerator } = require('../utils/ai-video-generator');
        this._aiVideoGenerator = new AIVideoGenerator();
      } catch (err) {
        console.warn(`[VideoMaker] Could not load AIVideoGenerator: ${err.message}`);
        this._aiVideoGenerator = null;
      }
    }
    return this._aiVideoGenerator;
  }

  // Generate ultra-realistic voice audio (ElevenLabs / Gemini primary, Edge-TTS fallback)
  async _getAudio(text, outputPath) {
    // 1. Try ElevenLabs / Gemini Neural TTS via AIVideoGenerator
    const aiGen = this._getAIVideoGenerator();
    if (aiGen) {
      try {
        await aiGen.generateTTSAudio(text, outputPath);
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
          return outputPath;
        }
      } catch (err) {
        console.warn(`[VideoMaker] Premium AI TTS (ElevenLabs/Gemini) fallback: ${err.message}`);
      }
    }

    // 2. Try edge-tts via command line if available
    try {
      const { execSync } = require('child_process');
      execSync(`edge-tts --voice hi-IN-MadhurNeural --text "${text.replace(/"/g, '')}" --write-media "${outputPath}"`, {
        timeout: 15000,
        stdio: 'ignore'
      });
      if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
        return outputPath;
      }
    } catch (_) {}

    // 3. Google Translate TTS fallback
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=hi&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 20000,
    });
    fs.writeFileSync(outputPath, res.data);
    return outputPath;
  }

  _escapeXml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  _buildSVG({ item, isAnswer = false, timerText = null, isCommentChallenge = false }) {
    const topic = this._escapeXml(item.topic || 'सामान्य ज्ञान (General Knowledge)');
    const hookBar = this._escapeXml(item.englishHook || item.hookBar || '99% लोग Fail');
    const options = Array.isArray(item.options) ? item.options : [
      { letter: 'A', text: 'Option A' },
      { letter: 'B', text: 'Option B' },
      { letter: 'C', text: 'Option C' },
      { letter: 'D', text: 'Option D' }
    ];

    const correctLetter = (item.correctOption || 'A').toUpperCase();
    const explanation = this._escapeXml(item.explanation || '');
    const hasImage = !!item.imageBase64;
    const imageMime = item.imageMime || 'image/jpeg';

    // Central subtle watermark (10-12% opacity)
    const logoEmbed = this.logoBase64
      ? `<image href="data:image/png;base64,${this.logoBase64}" x="340" y="740" width="400" height="400" opacity="0.10" />`
      : `
        <g opacity="0.08" transform="translate(540, 940)">
          <circle cx="0" cy="0" r="220" fill="none" stroke="#000000" stroke-width="8" stroke-dasharray="16 12"/>
          <circle cx="0" cy="0" r="190" fill="none" stroke="#000000" stroke-width="4"/>
          <text x="0" y="-30" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="52" font-weight="900" fill="#000000" text-anchor="middle">EXAM IQ</text>
          <text x="0" y="45" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="44" font-weight="bold" fill="#000000" text-anchor="middle">BHARAT</text>
          <text x="0" y="110" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#000000" text-anchor="middle">★ OFFICIAL ★</text>
        </g>
      `;

    // Multi-line question wrapping
    const questionLines = item.questionLines && item.questionLines.length > 0
      ? item.questionLines.map(l => this._escapeXml(l.replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, '')))
      : [this._escapeXml((item.question || item.title).replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, ''))];

    return `
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <!-- Gradients -->
        <linearGradient id="topPillGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#bef264" />
          <stop offset="100%" stop-color="#facc15" />
        </linearGradient>
        <linearGradient id="blueHookGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#0284c7" />
          <stop offset="100%" stop-color="#1d4ed8" />
        </linearGradient>
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.08"/>
        </filter>
        <filter id="greenGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#22c55e" flood-opacity="0.35"/>
        </filter>
        <filter id="coralGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#ef4444" flood-opacity="0.25"/>
        </filter>
      </defs>

      <!-- Clean White Canvas Background -->
      <rect width="1080" height="1920" fill="#FFFFFF"/>

      <!-- Frame Outer Border (Visual format match) -->
      <rect x="24" y="24" width="1032" height="1872" rx="36" fill="none" stroke="#0284c7" stroke-width="8"/>

      <!-- Central Channel Watermark -->
      ${logoEmbed}

      <!-- 1. Top Header Box: 📚 GENERAL KNOWLEDGE 📚 + 99% लोग Fail Yellow Pill -->
      <g filter="url(#softShadow)">
        <rect x="45" y="45" width="990" height="200" rx="24" fill="#f8fafc" stroke="#0284c7" stroke-width="4"/>
        <!-- Row 1: Book icons + GENERAL KNOWLEDGE (or category) -->
        <text x="540" y="115" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="46" font-weight="900" fill="#15803d" text-anchor="middle" letter-spacing="2">
          📚 GENERAL KNOWLEDGE 📚
        </text>
        <text x="540" y="115" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="1" fill="transparent" text-anchor="middle">
          ${topic}
        </text>
        <!-- Row 2: Yellow Pill + 99% लोग Fail -->
        <rect x="240" y="145" width="600" height="75" rx="37" fill="#fef08a" stroke="#ca8a04" stroke-width="2.5"/>
        <text x="540" y="198" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="${hookBar.length > 25 ? 36 : 44}" font-weight="900" fill="#dc2626" text-anchor="middle">
          ${hookBar}
        </text>
      </g>

      <!-- 2. Question Text (Centered, Bold Blue Devanagari Text) -->
      <g>
        ${questionLines.map((line, idx) => `
          <text x="540" y="${320 + (idx * 68)}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="${questionLines.length > 2 ? 46 : 52}" font-weight="900" fill="#1e40af" text-anchor="middle">
            ${line}
          </text>
        `).join('')}
      </g>

      <!-- 3. Split Layout: Left Column Options (A, B, C, D) -->
      ${options.map((opt, idx) => {
        const isThisCorrect = !isCommentChallenge && isAnswer && (opt.letter === correctLetter);
        const yPos = 620 + (idx * 140);
        const optLen = String(opt.text || '').length;
        const optFontSize = hasImage
          ? (optLen > 18 ? 38 : (optLen > 12 ? 44 : 48))
          : (optLen > 28 ? 38 : (optLen > 21 ? 42 : 46));
        const optX = hasImage ? 85 : 100;
        const rectWidth = hasImage ? 410 : 860;

        if (isThisCorrect) {
          // Highlighted Correct Option (Vibrant Green Capsule)
          return `
          <!-- Correct Option ${opt.letter} Highlighted -->
          <g filter="url(#greenGlow)">
            <rect x="${optX - 20}" y="${yPos - 52}" width="${rectWidth}" height="104" rx="26" fill="#16a34a" stroke="#15803d" stroke-width="3.5"/>
            <text x="${optX}" y="${yPos + 18}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="${optFontSize}" font-weight="900" fill="#FFFFFF">
              ${opt.letter}. ${this._escapeXml(opt.text)}
            </text>
          </g>
          `;
        } else {
          // Standard Option (fades when answer revealed)
          const opacity = isAnswer && !isCommentChallenge ? '0.40' : '1.0';
          return `
          <!-- Option ${opt.letter} -->
          <g opacity="${opacity}">
            <text x="${optX}" y="${yPos + 18}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="${optFontSize}" font-weight="900" fill="#0f172a">
              ${opt.letter}. ${this._escapeXml(opt.text)}
            </text>
          </g>
          `;
        }
      }).join('')}

      <!-- 4. Split Layout: Right Column Cutout Subject Image -->
      ${hasImage ? `
        <image xlink:href="data:${imageMime};base64,${item.imageBase64}" href="data:${imageMime};base64,${item.imageBase64}" x="480" y="550" width="540" height="740" preserveAspectRatio="xMidYMid meet" />
      ` : ''}

      <!-- 5. Suspense Timer (during Frame 2) -->
      ${!isAnswer && !isCommentChallenge && timerText ? `
        <g filter="url(#softShadow)">
          <rect x="200" y="1220" width="680" height="85" rx="42" fill="#e11d48"/>
          <text x="540" y="1276" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle">
            ${this._escapeXml(timerText)}
          </text>
        </g>
      ` : ''}

      <!-- 6. Comment Challenge Card (during Frame 3 when commentChallenge is active) -->
      ${isCommentChallenge ? `
        <g filter="url(#softShadow)">
          <rect x="60" y="1170" width="960" height="230" rx="24" fill="#fff7ed" stroke="#ea580c" stroke-width="4"/>
          <rect x="80" y="1186" width="920" height="50" rx="14" fill="#ea580c"/>
          <text x="540" y="1222" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="28" font-weight="900" fill="#FFFFFF" text-anchor="middle">
            💬 Comment Your Answer (कमेंट चैलेंज)
          </text>
          <text x="540" y="1295" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="36" font-weight="900" fill="#9a3412" text-anchor="middle">
            👉 अपना सही उत्तर कमेंट में बताएं! 🏆
          </text>
          <text x="540" y="1355" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="26" font-weight="bold" fill="#431407" text-anchor="middle">
            देखते हैं कितने लोग इसका सही जवाब जानते हैं!
          </text>
        </g>
      ` : ''}

      <!-- 6b. Fact / Explanation Card (during Frame 3 when commentChallenge is false) -->
      ${!isCommentChallenge && isAnswer ? `
        <g filter="url(#softShadow)">
          <rect x="60" y="1200" width="960" height="200" rx="24" fill="#f8fafc" stroke="#38bdf8" stroke-width="3"/>
          <rect x="60" y="1200" width="960" height="54" rx="24" fill="#e0f2fe"/>
          <text x="540" y="1238" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="28" font-weight="900" fill="#0369a1" text-anchor="middle">
            💡 परीक्षा तथ्य (Exam Fact)
          </text>
          <text x="540" y="1296" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="32" font-weight="bold" fill="#15803d" text-anchor="middle">
            ✅ सही जवाब: ${this._escapeXml(item.answerText || '')}
          </text>
          <text x="540" y="1355" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="25" font-weight="500" fill="#334155" text-anchor="middle">
            ${explanation.length > 58 ? explanation.slice(0, 58) + '...' : explanation}
          </text>
        </g>
      ` : ''}

      <!-- 7. Bottom Split Footer Bar (Yellow Channel Name + Facebook Blue Follow Button) -->
      <g filter="url(#softShadow)">
        <!-- Yellow Box: Channel Name -->
        <rect x="60" y="1430" width="510" height="105" rx="18" fill="#facc15"/>
        <text x="315" y="1500" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="42" font-weight="900" fill="#000000" text-anchor="middle">
          Exam IQ Bharat
        </text>

        <!-- Blue Facebook Follow Button (Facebook Blue #1877F2 with 'f' logo) -->
        <rect x="590" y="1430" width="430" height="105" rx="18" fill="#1877F2"/>
        <circle cx="636" cy="1482" r="24" fill="#FFFFFF"/>
        <text x="636" y="1494" font-family="Arial, sans-serif" font-size="32" font-weight="900" fill="#1877F2" text-anchor="middle">f</text>
        <text x="815" y="1498" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle">
          को Follow करें 🔔
        </text>
      </g>
    </svg>
    `;
  }

  /**
   * Generates a complete 9:16 vertical Reel MP4 matching the educational format
   */
  async createReel(item, options = {}) {
    const opts = typeof options === 'number'
      ? { index: options, commentChallenge: true }
      : { commentChallenge: true, ...options };
    const isCommentChallenge = opts.commentChallenge !== false;
    const timerText = '⏳ सोचो! 3.. 2.. 1.. 🎯';

    const timestamp = Date.now();
    const prefix = path.join(this.tempDir, `fb_${item.id}_${timestamp}`);

    const qAudio = `${prefix}_q.mp3`;
    const timerAudio = `${prefix}_timer.mp3`;
    const ansAudio = `${prefix}_ans.mp3`;

    const f1Png = `${prefix}_f1.png`;
    const f2Png = `${prefix}_f2.png`;
    const f3Png = `${prefix}_f3.png`;

    const seg1 = `${prefix}_seg1.mp4`;
    const seg2 = `${prefix}_seg2.mp4`;
    const seg3 = `${prefix}_seg3.mp4`;

    const concatList = `${prefix}_concat.txt`;
    const finalMp4 = path.join(this.outputDir, `FB_REEL_${item.id}_${timestamp}.mp4`);

    try {
      console.log(`[VideoMaker] Generating audio narration for: ${item.id} ("${item.title}") [commentChallenge: ${isCommentChallenge}]...`);
      const qNarration = item.voiceQuestion || item.question;
      const tNarration = item.voiceTimer || 'सोचने के लिए 3 सेकंड, आपका समय शुरू होता है अब!';
      const aNarration = isCommentChallenge
        ? (item.voiceCommentChallenge || 'अब इस सवाल का सही जवाब आप कमेंट बॉक्स में बताइए! देखते हैं कितने लोग सही उत्तर देते हैं! और रोज़ाना नए GK टेस्ट के लिए Exam IQ Bharat को Follow करें!')
        : (item.voiceAnswer || `सही जवाब है ${item.answerText}`);

      await this._getAudio(qNarration, qAudio);
      await this._getAudio(tNarration, timerAudio);
      await this._getAudio(aNarration, ansAudio);

      // Check for question-related subject image
      let imageBase64 = item.imageBase64 || null;
      let imageMime = item.imageMime || 'image/jpeg';
      let resolvedImagePath = item.imagePath || null;

      if (!imageBase64 && !resolvedImagePath && item.imagePrompt) {
        const aiGen = this._getAIVideoGenerator();
        if (aiGen) {
          const generatedImg = `${prefix}_ai_img.jpg`;
          try {
            console.log(`[VideoMaker] Generating AI image for question: "${item.imagePrompt}"...`);
            await aiGen.generateImage(item.imagePrompt, generatedImg);
            if (fs.existsSync(generatedImg) && fs.statSync(generatedImg).size > 5000) {
              resolvedImagePath = generatedImg;
            }
          } catch (imgErr) {
            console.warn(`[VideoMaker] AI image generation notice: ${imgErr.message}`);
          }
        }
      }

      if (!imageBase64 && resolvedImagePath && fs.existsSync(resolvedImagePath)) {
        try {
          const meta = await sharp(resolvedImagePath).metadata();
          imageMime = meta.format === 'png' ? 'image/png' : 'image/jpeg';
          imageBase64 = fs.readFileSync(resolvedImagePath).toString('base64');
        } catch (_) {}
      }

      const itemWithImage = { ...item, imageBase64, imageMime };

      console.log(`[VideoMaker] Rendering educational frames matching Exam IQ layout...`);
      const svg1 = this._buildSVG({ item: itemWithImage });
      const svg2 = this._buildSVG({ item: itemWithImage, timerText });
      const svg3 = this._buildSVG({ item: itemWithImage, isAnswer: !isCommentChallenge, isCommentChallenge });

      await sharp(Buffer.from(svg1)).png().toFile(f1Png);
      await sharp(Buffer.from(svg2)).png().toFile(f2Png);
      await sharp(Buffer.from(svg3)).png().toFile(f3Png);

      const d1 = await ffmpeg.getMediaDuration(qAudio);
      const d2 = await ffmpeg.getMediaDuration(timerAudio);
      const d3 = await ffmpeg.getMediaDuration(ansAudio);

      console.log(`[VideoMaker] Rendering FFmpeg segments with suspense BGM & tick-tock SFX (${(d1 + d2 + d3).toFixed(1)}s total)...`);

      // Segment 1: Question + subtle quiz suspense BGM
      if (this.audioAssets?.bgmPath && fs.existsSync(this.audioAssets.bgmPath)) {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
          '-i', qAudio,
          '-stream_loop', '-1', '-i', this.audioAssets.bgmPath,
          '-filter_complex', '[2:a]volume=0.14[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]',
          '-map', '0:v', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d1), seg1
        ]);
      } else {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
          '-i', qAudio,
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg1
        ]);
      }

      // Segment 2: Timer + countdown tick-tock SFX + suspense BGM
      if (this.audioAssets?.tickTockPath && fs.existsSync(this.audioAssets.tickTockPath)) {
        const hasBgm = this.audioAssets.bgmPath && fs.existsSync(this.audioAssets.bgmPath);
        const extraArgs = hasBgm ? ['-stream_loop', '-1', '-i', this.audioAssets.bgmPath] : [];
        const filterStr = hasBgm
          ? '[2:a]volume=0.45[tick];[3:a]volume=0.12[bgm];[1:a][tick][bgm]amix=inputs=3:duration=first:dropout_transition=0:normalize=0[aout]'
          : '[2:a]volume=0.45[tick];[1:a][tick]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]';

        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d2), '-i', f2Png,
          '-i', timerAudio,
          '-stream_loop', '-1', '-i', this.audioAssets.tickTockPath,
          ...extraArgs,
          '-filter_complex', filterStr,
          '-map', '0:v', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d2), seg2
        ]);
      } else {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d2), '-i', f2Png,
          '-i', timerAudio,
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg2
        ]);
      }

      // Segment 3: Answer Reveal + chime / ding SFX + subtle ambient BGM
      if (this.audioAssets?.chimePath && fs.existsSync(this.audioAssets.chimePath)) {
        const hasBgm = this.audioAssets.bgmPath && fs.existsSync(this.audioAssets.bgmPath);
        const extraArgs = hasBgm ? ['-stream_loop', '-1', '-i', this.audioAssets.bgmPath] : [];
        const filterStr = hasBgm
          ? '[2:a]volume=0.38[ding];[3:a]volume=0.10[bgm];[1:a][ding][bgm]amix=inputs=3:duration=first:dropout_transition=0:normalize=0[aout]'
          : '[2:a]volume=0.38[ding];[1:a][ding]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]';

        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d3), '-i', f3Png,
          '-i', ansAudio,
          '-i', this.audioAssets.chimePath,
          ...extraArgs,
          '-filter_complex', filterStr,
          '-map', '0:v', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d3), seg3
        ]);
      } else {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d3), '-i', f3Png,
          '-i', ansAudio,
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg3
        ]);
      }

      fs.writeFileSync(concatList, `file '${seg1.replace(/\\/g, '/')}'\nfile '${seg2.replace(/\\/g, '/')}'\nfile '${seg3.replace(/\\/g, '/')}'\n`);

      console.log(`[VideoMaker] Stitching final vertical Reel MP4...`);
      await ffmpeg.runFFmpeg([
        '-y', '-f', 'concat', '-safe', '0', '-i', concatList,
        '-c', 'copy', '-movflags', '+faststart', finalMp4
      ]);

      console.log(`[VideoMaker] Exam GK Reel generated successfully: ${path.basename(finalMp4)}`);
      return finalMp4;
    } finally {
      // Clean up temporary files
      const tempFiles = [qAudio, timerAudio, ansAudio, f1Png, f2Png, f3Png, seg1, seg2, seg3, concatList];
      for (const file of tempFiles) {
        if (fs.existsSync(file)) {
          try { fs.unlinkSync(file); } catch (_) {}
        }
      }
    }
  }
}

module.exports = {
  FacebookVideoMaker,
};
