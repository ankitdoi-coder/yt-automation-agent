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
    const topic = this._escapeXml(item.topic || 'सामान्य ज्ञान • भाग 1');
    const hookBar = this._escapeXml(item.englishHook || item.hookBar || 'परीक्षा में बार बार पूछे जाने वाले सवाल');
    const options = Array.isArray(item.options) ? item.options : [
      { letter: 'A', text: 'Option A' },
      { letter: 'B', text: 'Option B' },
      { letter: 'C', text: 'Option C' },
      { letter: 'D', text: 'Option D' }
    ];

    const correctLetter = (item.correctOption || 'A').toUpperCase();
    const explanation = this._escapeXml(item.explanation || '');

    // Central subtle watermark (matching YouTube Shorts style: 🎓 EXAM IQ BHARAT)
    const logoEmbed = this.logoBase64
      ? `<image href="data:image/png;base64,${this.logoBase64}" x="340" y="740" width="400" height="400" opacity="0.10" />`
      : `
        <g opacity="0.09" transform="translate(540, 940)">
          <circle cx="0" cy="0" r="280" fill="none" stroke="#000000" stroke-width="6" stroke-dasharray="16 12"/>
          <text x="0" y="-40" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="70" text-anchor="middle">🎓</text>
          <text x="0" y="45" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="52" font-weight="900" fill="#000000" text-anchor="middle">EXAM IQ BHARAT</text>
          <text x="0" y="115" font-family="Arial, sans-serif" font-size="24" font-weight="800" fill="#64748b" text-anchor="middle" letter-spacing="4">LEARN • PRACTICE • SCORE</text>
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
        <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#000000" flood-opacity="0.10"/>
        </filter>
        <filter id="greenGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#16a34a" flood-opacity="0.35"/>
        </filter>
      </defs>

      <!-- Clean White Canvas (Exact match to YouTube Shorts clean style) -->
      <rect width="1080" height="1920" fill="#FFFFFF"/>

      <!-- Central Channel Watermark -->
      ${logoEmbed}

      <!-- 1. Top Pill Badge: 📚 सामान्य ज्ञान • भाग 1 📚 (Exact YT Shorts #e4f932 Pill) -->
      <g filter="url(#softShadow)">
        <rect x="120" y="85" width="840" height="96" rx="48" fill="#e4f932" stroke="#111111" stroke-width="4.5"/>
        <text x="540" y="152" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="46" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="0.5">
          📚 ${topic} 📚
        </text>
      </g>

      <!-- 2. Blue Sub-header Bar: 🤯 परीक्षा में बार बार पूछे जाने वाले सवाल 🤯 (Exact YT Shorts #1565c0 Strip) -->
      <g filter="url(#softShadow)">
        <rect x="60" y="215" width="960" height="90" rx="14" fill="#1565c0"/>
        <text x="540" y="275" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="42" font-weight="900" fill="#FFFFFF" text-anchor="middle" letter-spacing="0.5">
          🤯 ${hookBar} 🤯
        </text>
      </g>

      <!-- 3. Question Block (Exact YT Shorts font-size: 58px; font-weight: 900; font-style: italic; color: #000000) -->
      <g>
        ${questionLines.map((line, idx) => `
          <text x="64" y="${385 + (idx * 75)}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="${questionLines.length > 2 ? 50 : 56}" font-weight="900" font-style="italic" fill="#000000">
            ${idx === 0 && !line.startsWith('1.') ? `1. ${line}` : line}
          </text>
        `).join('')}
      </g>

      <!-- 4. Timer / Status Strip (Exact YT Shorts Timer Strip & Slot) -->
      ${isCommentChallenge ? `
        <!-- Comment Challenge Strip -->
        <g filter="url(#softShadow)">
          <rect x="60" y="585" width="960" height="76" rx="16" fill="#fef08a" stroke="#ca8a04" stroke-width="3"/>
          <text x="540" y="638" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="34" font-weight="900" fill="#854d0e" text-anchor="middle">
            💬 सवाल नंबर 1 का जवाब कमेंट में दें!
          </text>
        </g>
      ` : (!isAnswer ? `
        <!-- Thinking / Countdown Phase: Badge + 14px Countdown Track Slot -->
        <g>
          <rect x="60" y="580" width="400" height="60" rx="14" fill="#e0f2fe"/>
          <text x="260" y="622" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="30" font-weight="800" fill="#0369a1" text-anchor="middle">
            ${timerText ? this._escapeXml(timerText) : '🤔 सोचिए और उत्तर दीजिए'}
          </text>
          <!-- 14px Track Slot for Animated Countdown Bar -->
          <rect x="60" y="655" width="960" height="14" rx="7" fill="#e2e8f0"/>
        </g>
      ` : `
        <!-- Answer Revealed Phase: Green Correct Badge -->
        <g>
          <rect x="60" y="580" width="280" height="60" rx="14" fill="#dcfce7"/>
          <text x="200" y="622" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="32" font-weight="900" fill="#15803d" text-anchor="middle">
            ✅ सही उत्तर
          </text>
          <rect x="60" y="655" width="960" height="14" rx="7" fill="#dcfce7"/>
        </g>
      `)}

      <!-- 5. Vertical Options List: A) ... B) ... C) ... (Exact YT Shorts clean-opt-item) -->
      ${options.map((opt, idx) => {
        const isThisCorrect = !isCommentChallenge && isAnswer && (opt.letter === correctLetter);
        const yPos = 720 + (idx * 135);
        const optLen = String(opt.text || '').length;
        const optFontSize = optLen > 28 ? 42 : (optLen > 20 ? 46 : 52);

        if (isThisCorrect) {
          // Highlighted Correct Option (Exact YT Shorts .correct-reveal style: #dcfce7 bg, 5px solid #16a34a)
          return `
          <!-- Correct Option ${opt.letter} Highlighted -->
          <g filter="url(#greenGlow)">
            <rect x="60" y="${yPos - 54}" width="960" height="108" rx="22" fill="#dcfce7" stroke="#16a34a" stroke-width="5"/>
            <text x="96" y="${yPos + 20}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="${optFontSize}" font-weight="900" font-style="italic" fill="#14532d">
              ${opt.letter}) ${this._escapeXml(opt.text)} <tspan fill="#16a34a" font-weight="900">✓</tspan>
            </text>
          </g>
          `;
        } else {
          // Standard Option
          const opacity = isAnswer && !isCommentChallenge ? '0.75' : '1.0';
          return `
          <!-- Option ${opt.letter} -->
          <g opacity="${opacity}">
            <rect x="60" y="${yPos - 54}" width="960" height="108" rx="22" fill="#ffffff" stroke="#e2e8f0" stroke-width="2.5"/>
            <text x="96" y="${yPos + 20}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="${optFontSize}" font-weight="900" font-style="italic" fill="#111111">
              ${opt.letter}) ${this._escapeXml(opt.text)}
            </text>
          </g>
          `;
        }
      }).join('')}

      <!-- 6. Fact / Explanation Card (during Frame 3) -->
      ${!isCommentChallenge && isAnswer ? `
        <g filter="url(#softShadow)">
          <rect x="60" y="1255" width="960" height="150" rx="18" fill="#f8fafc" stroke="#38bdf8" stroke-width="2.5"/>
          <text x="540" y="1295" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="26" font-weight="900" fill="#0369a1" text-anchor="middle">
            💡 परीक्षा तथ्य (Exam Fact)
          </text>
          <text x="540" y="1338" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="26" font-weight="bold" fill="#15803d" text-anchor="middle">
            ✅ सही जवाब: ${this._escapeXml(item.answerText || '')}
          </text>
          ${explanation ? `
          <text x="540" y="1378" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="22" font-weight="500" fill="#334155" text-anchor="middle">
            ${explanation.length > 60 ? explanation.slice(0, 60) + '...' : explanation}
          </text>` : ''}
        </g>
      ` : ''}

      ${isCommentChallenge ? `
        <g filter="url(#softShadow)">
          <rect x="60" y="1260" width="960" height="150" rx="20" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
          <text x="540" y="1302" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="28" font-weight="900" fill="#ea580c" text-anchor="middle">
            💬 Comment Your Answer (कमेंट चैलेंज)
          </text>
          <text x="540" y="1355" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="34" font-weight="900" fill="#9a3412" text-anchor="middle">
            👉 अपना सही उत्तर कमेंट में बताएं! 🏆
          </text>
          <text x="540" y="1395" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="24" font-weight="bold" fill="#431407" text-anchor="middle">
            देखते हैं कितने लोग इसका सही जवाब जानते हैं!
          </text>
        </g>
      ` : ''}

      <!-- 7. Bottom Split Footer (Exact YT Shorts split footer, safe zone y=1430) -->
      <g filter="url(#softShadow)">
        <!-- Left Box: Yellow Channel Name -->
        <rect x="60" y="1430" width="510" height="105" rx="18" fill="#facc15"/>
        <text x="315" y="1500" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="44" font-weight="900" fill="#000000" text-anchor="middle">
          Exam IQ Bharat
        </text>

        <!-- Right Box: Follow on Facebook (Facebook Blue #1877F2 with 'f' logo) -->
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

      // Segment 1: Question + subtle quiz suspense BGM + 0.08s micro-dip transition into timer
      const s1DipFilter = `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.22:t=fill:enable='between(t,${Math.max(0, d1 - 0.08).toFixed(3)},${d1.toFixed(3)})'`;
      if (this.audioAssets?.bgmPath && fs.existsSync(this.audioAssets.bgmPath)) {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
          '-i', qAudio,
          '-stream_loop', '-1', '-i', this.audioAssets.bgmPath,
          '-filter_complex', `[0:v]fps=30,format=yuv420p,${s1DipFilter}[vout];[2:a]volume=0.14[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`,
          '-map', '[vout]', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d1), seg1
        ]);
      } else {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
          '-i', qAudio,
          '-filter_complex', `[0:v]fps=30,format=yuv420p,${s1DipFilter}[vout]`,
          '-map', '[vout]', '-map', '1:a',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg1
        ]);
      }

      // Segment 2: Timer + countdown tick-tock SFX + suspense BGM
      // Motion Transition: Dynamic countdown bar shrinking across the 14px track at y=655 + micro-flash before reveal
      const s2BarFilter = `drawbox=x=60:y=655:w='max(0,960*(1-t/${d2.toFixed(3)}))':h=14:color=#dc2626@0.95:t=fill,drawbox=x=0:y=0:w=iw:h=ih:color=white@0.20:t=fill:enable='between(t,${Math.max(0, d2 - 0.08).toFixed(3)},${d2.toFixed(3)})'`;
      if (this.audioAssets?.tickTockPath && fs.existsSync(this.audioAssets.tickTockPath)) {
        const hasBgm = this.audioAssets.bgmPath && fs.existsSync(this.audioAssets.bgmPath);
        const extraArgs = hasBgm ? ['-stream_loop', '-1', '-i', this.audioAssets.bgmPath] : [];
        const filterStr = hasBgm
          ? `[0:v]fps=30,format=yuv420p,${s2BarFilter}[vout];[2:a]volume=0.45[tick];[3:a]volume=0.12[bgm];[1:a][tick][bgm]amix=inputs=3:duration=first:dropout_transition=0:normalize=0[aout]`
          : `[0:v]fps=30,format=yuv420p,${s2BarFilter}[vout];[2:a]volume=0.45[tick];[1:a][tick]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`;

        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d2), '-i', f2Png,
          '-i', timerAudio,
          '-stream_loop', '-1', '-i', this.audioAssets.tickTockPath,
          ...extraArgs,
          '-filter_complex', filterStr,
          '-map', '[vout]', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d2), seg2
        ]);
      } else {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d2), '-i', f2Png,
          '-i', timerAudio,
          '-filter_complex', `[0:v]fps=30,format=yuv420p,${s2BarFilter}[vout]`,
          '-map', '[vout]', '-map', '1:a',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg2
        ]);
      }

      // Segment 3: Answer Reveal + chime / ding SFX + subtle ambient BGM
      // Motion Transition: 0.16s answer reveal dopamine white flash synchronized with "Ding!" chime
      const s3FlashFilter = `drawbox=x=0:y=0:w=iw:h=ih:color=white@0.18:t=fill:enable='between(t,0,0.16)'`;
      if (this.audioAssets?.chimePath && fs.existsSync(this.audioAssets.chimePath)) {
        const hasBgm = this.audioAssets.bgmPath && fs.existsSync(this.audioAssets.bgmPath);
        const extraArgs = hasBgm ? ['-stream_loop', '-1', '-i', this.audioAssets.bgmPath] : [];
        const filterStr = hasBgm
          ? `[0:v]fps=30,format=yuv420p,${s3FlashFilter}[vout];[2:a]volume=0.38[ding];[3:a]volume=0.10[bgm];[1:a][ding][bgm]amix=inputs=3:duration=first:dropout_transition=0:normalize=0[aout]`
          : `[0:v]fps=30,format=yuv420p,${s3FlashFilter}[vout];[2:a]volume=0.38[ding];[1:a][ding]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`;

        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d3), '-i', f3Png,
          '-i', ansAudio,
          '-i', this.audioAssets.chimePath,
          ...extraArgs,
          '-filter_complex', filterStr,
          '-map', '[vout]', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d3), seg3
        ]);
      } else {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d3), '-i', f3Png,
          '-i', ansAudio,
          '-filter_complex', `[0:v]fps=30,format=yuv420p,${s3FlashFilter}[vout]`,
          '-map', '[vout]', '-map', '1:a',
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
