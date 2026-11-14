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

  _buildHandSVG() {
    return `
    <svg width="120" height="130" viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg">
      <line x1="20" y1="10" x2="6" y2="0" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
      <line x1="32" y1="4" x2="32" y2="-10" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
      <line x1="44" y1="10" x2="58" y2="0" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
      <path d="M 32 15 C 27 15 24 19 24 24 L 24 65 L 18 59 C 13 54 6 56 3 61 C 0 66 1 73 6 77 L 26 98 C 32 104 38 110 46 110 L 75 110 C 85 110 90 102 90 92 L 90 60 C 90 54 84 52 80 54 C 80 48 74 46 69 48 C 68 43 62 41 57 43 L 57 24 C 57 19 54 15 49 15 C 44 15 41 19 41 24 L 41 48 L 38 48 L 38 24 C 38 19 35 15 32 15 Z" fill="#FFFFFF" stroke="#000000" stroke-width="4.5" stroke-linejoin="round"/>
    </svg>
    `;
  }

  _buildSVG({ item, isAnswer = false, timerText = null, isCommentChallenge = false, partNum = 1, showFollowBtn = true, showHandInSvg = true }) {
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

    // Central subtle watermark (matching Exam IQ Bharat branding: 🎓 EXAM IQ BHARAT)
    const logoEmbed = this.logoBase64
      ? `<image href="data:image/png;base64,${this.logoBase64}" x="290" y="800" width="500" height="500" opacity="0.08" />`
      : `
        <g opacity="0.09" transform="translate(540, 960)">
          <circle cx="0" cy="0" r="260" fill="none" stroke="#000000" stroke-width="6" stroke-dasharray="16 12"/>
          <circle cx="0" cy="0" r="220" fill="none" stroke="#000000" stroke-width="3"/>
          <text x="0" y="-40" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="70" text-anchor="middle">🎓</text>
          <text x="0" y="45" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="50" font-weight="900" fill="#000000" text-anchor="middle">EXAM IQ BHARAT</text>
          <text x="0" y="110" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#64748b" text-anchor="middle" letter-spacing="4">LEARN • PRACTICE • SCORE</text>
        </g>
      `;

    // Multi-line question wrapping
    const questionLines = item.questionLines && item.questionLines.length > 0
      ? item.questionLines.map(l => this._escapeXml(l.replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, '')))
      : [this._escapeXml((item.question || item.title).replace(/[\uD83C][\uDDE6-\uDDFF][\uD83C][\uDDE6-\uDDFF]/g, ''))];

    // Question font sizing — matches reference: bold red, centered, 2-3 lines
    const qFontSize = questionLines.length > 2 ? 52 : 60;
    const qStartY = questionLines.length > 2 ? 390 : 410;
    const qLineHeight = questionLines.length > 2 ? 72 : 80;

    // Options — plain (A) text, no box, left-aligned, black; answer slide: green ✓ on correct
    const optStartY = qStartY + (questionLines.length * qLineHeight) + 60;
    const optLineHeight = Math.min(118, Math.max(96, Math.floor((1420 - optStartY) / 4)));

    return `
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
      <defs>
        <!-- topic: ${topic} -->
        <!-- hook: ${hookBar} -->
        <!-- examiqbharat -->
        <filter id="btnShadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="#000000" flood-opacity="0.18"/>
        </filter>
        <filter id="headerShadow" x="0%" y="0%" width="100%" height="130%">
          <feDropShadow dx="0" dy="5" stdDeviation="6" flood-color="#000000" flood-opacity="0.12"/>
        </filter>
      </defs>

      <!-- ═══════════════════════════════════════════════
           BACKGROUND — Pure white
           ═══════════════════════════════════════════════ -->
      <rect width="1080" height="1920" fill="#FFFFFF"/>

      <!-- Faint center watermark -->
      ${logoEmbed}

      <!-- ═══════════════════════════════════════════════
           TOP YELLOW HEADER BAR (matches reference image)
           Height: 220px, color: #FFD800
           ═══════════════════════════════════════════════ -->
      <g filter="url(#headerShadow)">
        <rect x="0" y="0" width="1080" height="220" fill="#FFD800"/>

        <!-- Left media icons: ⏸ pause circle + 🔊 volume circle -->
        <circle cx="130" cy="110" r="52" fill="#756b5a" opacity="0.65"/>
        <text x="130" y="126" font-family="Arial, sans-serif" font-size="40" text-anchor="middle" fill="#ffffff">⏸</text>

        <circle cx="280" cy="110" r="52" fill="#756b5a" opacity="0.65"/>
        <text x="280" y="125" font-family="Arial, sans-serif" font-size="38" text-anchor="middle" fill="#ffffff">🔊</text>

        <!-- Right decorative menu circle -->
        <circle cx="950" cy="110" r="52" fill="#756b5a" opacity="0.65"/>
        <text x="950" y="125" font-family="Arial, sans-serif" font-size="36" text-anchor="middle" fill="#ffffff">⋮</text>

        <!-- Center title: Most General Knowledge\nQuestions part N -->
        <text x="540" y="92" font-family="Arial, 'Noto Sans', sans-serif"
              font-size="50" font-weight="900" fill="#000000" text-anchor="middle">Most General Knowledge</text>
        <text x="540" y="160" font-family="Arial, 'Noto Sans', sans-serif"
              font-size="50" font-weight="900" fill="#000000" text-anchor="middle">Questions part ${partNum}</text>
      </g>

      <!-- ═══════════════════════════════════════════════
           MAIN CONTENT AREA — white, starts at y=220
           ═══════════════════════════════════════════════ -->

      <!-- QUESTION: Bold, red/maroon, centered, Hindi -->
      <g>
        ${questionLines.map((line, idx) => `
          <text x="540" y="${qStartY + (idx * qLineHeight)}"
                font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif"
                font-size="${qFontSize}" font-weight="900"
                fill="#C0392B" text-anchor="middle">${line}</text>
        `).join('')}
      </g>

      <!-- OPTIONS: (A) text — plain, no box, left-aligned, black -->
      ${options.map((opt, idx) => {
        const isThisCorrect = !isCommentChallenge && isAnswer && (opt.letter === correctLetter);
        const yPos = optStartY + (idx * optLineHeight);
        const optLen = String(opt.text || '').length;
        const optFontSize = optLen > 32 ? 40 : (optLen > 22 ? 46 : 52);
        const optColor = isAnswer && !isThisCorrect && !isCommentChallenge ? '#888888' : '#000000';

        if (isThisCorrect) {
          return `
          <!-- Correct Option ${opt.letter} Highlighted -->
          <text x="90" y="${yPos}"
                font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif"
                font-size="${optFontSize}" font-weight="900" fill="#000000">
            (${opt.letter}) ${this._escapeXml(opt.text)}
            <tspan fill="#22C55E" font-size="${optFontSize + 8}" font-weight="900"> ✓</tspan>
          </text>
          `;
        } else {
          return `
          <!-- Option (${opt.letter}) -->
          <text x="90" y="${yPos}"
                font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif"
                font-size="${optFontSize}" font-weight="900" fill="${optColor}">
            (${opt.letter}) ${this._escapeXml(opt.text)}
          </text>
          `;
        }
      }).join('')}

      <!-- Timer countdown track (shown on question/timer slides) -->
      ${!isAnswer && !isCommentChallenge ? `
        <rect x="60" y="1380" width="960" height="12" rx="6" fill="#e2e8f0"/>
        ${timerText ? `<text x="90" y="1368" font-family="'Noto Sans Devanagari', Arial, sans-serif" font-size="28" font-weight="700" fill="#0369a1">${this._escapeXml(timerText)}</text>` : ''}
      ` : ''}

      <!-- Comment Challenge card (shown when isCommentChallenge=true) -->
      ${isCommentChallenge ? `
        <g>
          <rect x="60" y="1180" width="960" height="210" rx="18" fill="#fff7ed" stroke="#ea580c" stroke-width="3"/>
          <text x="540" y="1225" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="28" font-weight="900" fill="#ea580c" text-anchor="middle">
            💬 Comment Your Answer (कमेंट चैलेंज)
          </text>
          <text x="540" y="1282" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="34" font-weight="900" fill="#9a3412" text-anchor="middle">
            👉 अपना सही उत्तर कमेंट में बताएं! 🏆
          </text>
          <text x="540" y="1332" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="24" font-weight="bold" fill="#431407" text-anchor="middle">
            देखते हैं कितने लोग इसका सही जवाब जानते हैं!
          </text>
        </g>
      ` : ''}

      <!-- Fact / Explanation Card (during Frame 3) -->
      ${!isCommentChallenge && isAnswer ? `
        <g filter="url(#softShadow)">
          <rect x="60" y="1210" width="960" height="160" rx="18" fill="#f8fafc" stroke="#38bdf8" stroke-width="2.5"/>
          <text x="540" y="1252" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="26" font-weight="900" fill="#0369a1" text-anchor="middle">
            💡 परीक्षा तथ्य (Exam Fact)
          </text>
          <text x="540" y="1298" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="28" font-weight="bold" fill="#15803d" text-anchor="middle">
            ✅ सही जवाब: ${this._escapeXml(item.answerText || '')}
          </text>
          ${explanation ? `
          <text x="540" y="1340" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="22" font-weight="500" fill="#334155" text-anchor="middle">
            ${explanation.length > 60 ? explanation.slice(0, 60) + '...' : explanation}
          </text>` : ''}
        </g>
      ` : ''}

      <!-- ═══════════════════════════════════════════════
           BOTTOM BRAND BAR (matches Smart Study Plus reference image)
           White canvas background!
           Left: Pink box with red border + Exam IQ Bharat (yellow with black outline)
           Right: 🔔 bell + red FOLLOW button + animated hand cursor
           ═══════════════════════════════════════════════ -->
      <g>
        <!-- Left: Pink Brand Box (Reels Safe Zone at y=1430, height=105 -> y+h=1535 <= 1560) -->
        <rect x="60" y="1430" width="510" height="105" rx="14" fill="#FF5376" stroke="#B71C1C" stroke-width="4"/>
        <text x="315" y="1502" font-family="'Arial Black', 'Impact', 'Noto Sans', sans-serif"
              font-size="44" font-weight="900" font-style="italic" fill="#FFE600" stroke="#000000" stroke-width="3"
              text-anchor="middle" paint-order="stroke fill" data-channel="examiqbharat">Exam IQ Bharat</text>

        <!-- Right: Bell icon + Red FOLLOW pill + Hand cursor -->
        ${showFollowBtn ? `
        <!-- Bell 🔔 -->
        <text x="655" y="1502" font-family="'Apple Color Emoji', 'Segoe UI Emoji', Arial" font-size="52">🔔</text>

        <!-- Red FOLLOW button pill -->
        <g filter="url(#btnShadow)">
          <rect x="725" y="1445" width="275" height="78" rx="39" fill="#E50914" stroke="#B71C1C" stroke-width="2"/>
          <text x="862" y="1499" font-family="Arial, 'Noto Sans', sans-serif"
                font-size="38" font-weight="900" fill="#ffffff" text-anchor="middle">FOLLOW</text>
        </g>

        <!-- Hand Cursor tapping FOLLOW button (included in SVG for static previews) -->
        ${showHandInSvg && !isAnswer ? `
        <g transform="translate(860, 1485)">
          <line x1="20" y1="10" x2="6" y2="0" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
          <line x1="32" y1="4" x2="32" y2="-10" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
          <line x1="44" y1="10" x2="58" y2="0" stroke="#000000" stroke-width="4" stroke-linecap="round"/>
          <path d="M 32 15 C 27 15 24 19 24 24 L 24 65 L 18 59 C 13 54 6 56 3 61 C 0 66 1 73 6 77 L 26 98 C 32 104 38 110 46 110 L 75 110 C 85 110 90 102 90 92 L 90 60 C 90 54 84 52 80 54 C 80 48 74 46 69 48 C 68 43 62 41 57 43 L 57 24 C 57 19 54 15 49 15 C 44 15 41 19 41 24 L 41 48 L 38 48 L 38 24 C 38 19 35 15 32 15 Z" fill="#FFFFFF" stroke="#000000" stroke-width="4.5" stroke-linejoin="round"/>
        </g>
        ` : ''}
        ` : ''}

        <!-- Bottom progress line -->
        <line x1="0" y1="1914" x2="1080" y2="1914" stroke="#FF5376" stroke-width="6"/>
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
    const handPng = `${prefix}_hand.png`;

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

      // Derive part number from item index (1-based) or item.partNum
      const partNum = opts.partNum || item.partNum || (typeof opts.index === 'number' ? opts.index + 1 : 1);

      console.log(`[VideoMaker] Rendering educational frames matching Exam IQ layout (part ${partNum})...`);
      // Seg1: Question slide — pink box examiqbharat + red FOLLOW button (hand overlaid via animation)
      const svg1 = this._buildSVG({ item: itemWithImage, partNum, showFollowBtn: true, showHandInSvg: false });
      // Seg2: Timer slide — FOLLOW btn visible, timerText shown
      const svg2 = this._buildSVG({ item: itemWithImage, timerText, partNum, showFollowBtn: true, showHandInSvg: false });
      // Seg3: Answer slide — clean answer reveal with green checkmark ✓
      const svg3 = this._buildSVG({ item: itemWithImage, isAnswer: !isCommentChallenge, isCommentChallenge, partNum, showFollowBtn: false, showHandInSvg: false });

      await sharp(Buffer.from(this._buildHandSVG())).png().toFile(handPng);

      await sharp(Buffer.from(svg1)).png().toFile(f1Png);
      await sharp(Buffer.from(svg2)).png().toFile(f2Png);
      await sharp(Buffer.from(svg3)).png().toFile(f3Png);

      const d1 = await ffmpeg.getMediaDuration(qAudio);
      const d2 = await ffmpeg.getMediaDuration(timerAudio);
      const d3 = await ffmpeg.getMediaDuration(ansAudio);

      console.log(`[VideoMaker] Rendering FFmpeg segments with animated thumb click & audio effects (${(d1 + d2 + d3).toFixed(1)}s total)...`);

      // Segment 1: Question + animated thumb clicking FOLLOW button + subtle quiz suspense BGM
      const tapAnimY = `'1485-18*abs(sin(3.14159*t*1.5))'`;
      const tapPulse = `drawbox=x=725:y=1445:w=275:h=78:color=white@0.32:t=fill:enable='lt(mod(t,0.67),0.12)'`;
      const s1DipFilter = `${tapPulse},drawbox=x=0:y=0:w=iw:h=ih:color=black@0.22:t=fill:enable='between(t,${Math.max(0, d1 - 0.08).toFixed(3)},${d1.toFixed(3)})'`;
      if (this.audioAssets?.bgmPath && fs.existsSync(this.audioAssets.bgmPath)) {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
          '-i', qAudio,
          '-stream_loop', '-1', '-i', this.audioAssets.bgmPath,
          '-loop', '1', '-t', String(d1), '-i', handPng,
          '-filter_complex', `[0:v][3:v]overlay=x=860:y=${tapAnimY}:enable='between(t,0,${d1.toFixed(3)})',fps=30,format=yuv420p,${s1DipFilter}[vout];[2:a]volume=0.14[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`,
          '-map', '[vout]', '-map', '[aout]',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d1), seg1
        ]);
      } else {
        await ffmpeg.runFFmpeg([
          '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
          '-i', qAudio,
          '-loop', '1', '-t', String(d1), '-i', handPng,
          '-filter_complex', `[0:v][2:v]overlay=x=860:y=${tapAnimY}:enable='between(t,0,${d1.toFixed(3)})',fps=30,format=yuv420p,${s1DipFilter}[vout]`,
          '-map', '[vout]', '-map', '1:a',
          '-c:v', 'libx264', '-preset', 'fast', '-crf', '22', '-b:v', '2500k', '-maxrate', '3000k', '-bufsize', '6000k', '-r', '30',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg1
        ]);
      }

      // Segment 2: Timer + countdown tick-tock SFX + suspense BGM
      // Dynamic countdown bar shrinking across the 12px track at y=1380
      const s2BarFilter = `drawbox=x=60:y=1380:w='max(0,960*(1-t/${d2.toFixed(3)}))':h=12:color=#dc2626@0.95:t=fill,drawbox=x=0:y=0:w=iw:h=ih:color=white@0.20:t=fill:enable='between(t,${Math.max(0, d2 - 0.08).toFixed(3)},${d2.toFixed(3)})'`;
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
      const tempFiles = [qAudio, timerAudio, ansAudio, f1Png, f2Png, f3Png, handPng, seg1, seg2, seg3, concatList];
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
