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
const { runFFmpeg, getMediaDuration } = require('../utils/ffmpeg');
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

  // Generate crisp Hindi voice audio
  async _getAudio(text, outputPath) {
    // 1. Try edge-tts via command line if available
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

    // 2. Google Translate TTS fallback
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

  _buildSVG({ item, isAnswer = false, timerText = null }) {
    const topic = this._escapeXml(item.topic || 'सामान्य ज्ञान (General Knowledge)');
    const hookBar = this._escapeXml(item.hookBar || 'परीक्षा में बार बार पूछे जाने वाले सवाल');
    const options = Array.isArray(item.options) ? item.options : [
      { letter: 'A', text: 'Option A' },
      { letter: 'B', text: 'Option B' },
      { letter: 'C', text: 'Option C' },
      { letter: 'D', text: 'Option D' }
    ];

    const correctLetter = (item.correctOption || 'A').toUpperCase();
    const explanation = this._escapeXml(item.explanation || '');

    // Central subtle watermark (10-12% opacity)
    const logoEmbed = this.logoBase64
      ? `<image href="data:image/png;base64,${this.logoBase64}" x="340" y="740" width="400" height="400" opacity="0.12" />`
      : `
        <g opacity="0.10" transform="translate(540, 940)">
          <circle cx="0" cy="0" r="220" fill="none" stroke="#000000" stroke-width="8" stroke-dasharray="16 12"/>
          <circle cx="0" cy="0" r="190" fill="none" stroke="#000000" stroke-width="4"/>
          <text x="0" y="-30" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="52" font-weight="900" fill="#000000" text-anchor="middle">EXAM IQ</text>
          <text x="0" y="45" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="44" font-weight="bold" fill="#000000" text-anchor="middle">BHARAT</text>
          <text x="0" y="110" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#000000" text-anchor="middle">★ OFFICIAL ★</text>
        </g>
      `;

    // Multi-line question wrapping
    const questionLines = item.questionLines && item.questionLines.length > 0
      ? item.questionLines.map(l => this._escapeXml(l))
      : [this._escapeXml(item.question || item.title)];

    return `
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
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
        <filter id="coralGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#ef4444" flood-opacity="0.25"/>
        </filter>
      </defs>

      <!-- Clean White Canvas Background -->
      <rect width="1080" height="1920" fill="#FFFFFF"/>

      <!-- Central Channel Watermark -->
      ${logoEmbed}

      <!-- 1. Top Category Pill (with Book Emojis, Image 2 style) -->
      <g filter="url(#softShadow)">
        <rect x="170" y="85" width="740" height="90" rx="45" fill="url(#topPillGrad)" stroke="#65a30d" stroke-width="3"/>
        <text x="540" y="145" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="38" font-weight="900" fill="#0f172a" text-anchor="middle">
          📚 ${topic} 📚
        </text>
      </g>

      <!-- 2. Blue Hook Sub-banner (with Shock Emojis, Image 2 style) -->
      <g filter="url(#softShadow)">
        <rect x="60" y="205" width="960" height="90" rx="24" fill="url(#blueHookGrad)"/>
        <text x="540" y="263" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="38" font-weight="bold" fill="#FFFFFF" text-anchor="middle">
          🤯 ${hookBar} 🤯
        </text>
      </g>

      <!-- 3. Question (Bold, Crisp Black Devanagari Text, Image 2 style) -->
      <g>
        ${questionLines.map((line, idx) => `
          <text x="80" y="${380 + (idx * 75)}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="50" font-weight="900" fill="#0f172a">
            ${line}
          </text>
        `).join('')}
      </g>

      <!-- 4. Options List (A, B, C, D) -->
      ${options.map((opt, idx) => {
        const isThisCorrect = isAnswer && (opt.letter === correctLetter);
        const yPos = 680 + (idx * 140);

        if (isThisCorrect) {
          // Highlighted Option Capsule (Soft Coral/Pink Pill with Red Border - Exact match to Image 2!)
          return `
          <!-- Correct Option ${opt.letter} Highlighted -->
          <g filter="url(#coralGlow)">
            <rect x="70" y="${yPos - 55}" width="940" height="110" rx="30" fill="#fee2e2" stroke="#ef4444" stroke-width="4"/>
            <text x="105" y="${yPos + 18}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="48" font-weight="900" fill="#b91c1c">
              ${opt.letter}) ${this._escapeXml(opt.text)}
            </text>
          </g>
          `;
        } else {
          // Standard Option
          return `
          <!-- Option ${opt.letter} -->
          <g>
            <text x="105" y="${yPos + 18}" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="46" font-weight="bold" fill="#1e293b">
              ${opt.letter}) ${this._escapeXml(opt.text)}
            </text>
          </g>
          `;
        }
      }).join('')}

      <!-- 5. Suspense Timer (during Frame 2) -->
      ${!isAnswer && timerText ? `
        <g filter="url(#softShadow)">
          <rect x="240" y="1280" width="600" height="90" rx="45" fill="#e11d48"/>
          <text x="540" y="1338" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="38" font-weight="900" fill="#FFFFFF" text-anchor="middle">
            ${this._escapeXml(timerText)}
          </text>
        </g>
      ` : ''}

      <!-- 6. Fact / Explanation Card (during Frame 3) -->
      ${isAnswer ? `
        <g filter="url(#softShadow)">
          <rect x="70" y="1250" width="940" height="230" rx="25" fill="#f8fafc" stroke="#38bdf8" stroke-width="3"/>
          <rect x="70" y="1250" width="940" height="60" rx="25" fill="#e0f2fe"/>
          <text x="540" y="1292" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="30" font-weight="900" fill="#0369a1" text-anchor="middle">
            💡 परीक्षा तथ्य (Exam Fact)
          </text>
          <text x="540" y="1360" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="32" font-weight="bold" fill="#15803d" text-anchor="middle">
            ✅ सही जवाब: ${this._escapeXml(item.answerText || '')}
          </text>
          <text x="540" y="1425" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="27" font-weight="500" fill="#334155" text-anchor="middle">
            ${explanation.length > 58 ? explanation.slice(0, 58) + '...' : explanation}
          </text>
        </g>
      ` : ''}

      <!-- 7. Bottom Split Footer Bar (Image 2 style: Yellow Channel Name + Red "को Follow करें") -->
      <g filter="url(#softShadow)">
        <!-- Yellow Box: Channel Name -->
        <rect x="70" y="1680" width="500" height="120" rx="18" fill="#facc15"/>
        <text x="320" y="1755" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="44" font-weight="900" fill="#000000" text-anchor="middle">
          Exam IQ Bharat
        </text>

        <!-- Red Box: को Follow करें (Strictly Follow for Facebook!) -->
        <rect x="580" y="1680" width="430" height="120" rx="18" fill="#dc2626"/>
        <text x="795" y="1755" font-family="'Noto Sans Devanagari', 'Nirmala UI', Arial, sans-serif" font-size="38" font-weight="900" fill="#FFFFFF" text-anchor="middle">
          को Follow करें 🔔
        </text>
      </g>
    </svg>
    `;
  }

  /**
   * Generates a complete 9:16 vertical Reel MP4 matching the educational format
   */
  async createReel(item, _index = 0) {
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
      console.log(`[VideoMaker] Generating audio narration for: ${item.id} ("${item.title}")...`);
      const qNarration = item.voiceQuestion || item.question;
      const tNarration = item.voiceTimer || 'सोचने के लिए 3 सेकंड, आपका समय शुरू होता है अब!';
      const aNarration = item.voiceAnswer || `सही जवाब है ${item.answerText}`;

      await this._getAudio(qNarration, qAudio);
      await this._getAudio(tNarration, timerAudio);
      await this._getAudio(aNarration, ansAudio);

      console.log(`[VideoMaker] Rendering educational frames matching Exam IQ layout...`);
      const svg1 = this._buildSVG({ item });
      const svg2 = this._buildSVG({ item, timerText });
      const svg3 = this._buildSVG({ item, isAnswer: true });

      await sharp(Buffer.from(svg1)).png().toFile(f1Png);
      await sharp(Buffer.from(svg2)).png().toFile(f2Png);
      await sharp(Buffer.from(svg3)).png().toFile(f3Png);

      const d1 = await getMediaDuration(qAudio);
      const d2 = await getMediaDuration(timerAudio);
      const d3 = await getMediaDuration(ansAudio);

      console.log(`[VideoMaker] Rendering FFmpeg segments with suspense BGM & tick-tock SFX (${(d1 + d2 + d3).toFixed(1)}s total)...`);

      // Segment 1: Question + subtle quiz suspense BGM
      if (this.audioAssets?.bgmPath && fs.existsSync(this.audioAssets.bgmPath)) {
        await runFFmpeg([
          '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
          '-i', qAudio,
          '-stream_loop', '-1', '-i', this.audioAssets.bgmPath,
          '-filter_complex', '[2:a]volume=0.14[bgm];[1:a][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]',
          '-map', '0:v', '-map', '[aout]',
          '-c:v', 'libx264', '-tune', 'stillimage',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d1), seg1
        ]);
      } else {
        await runFFmpeg([
          '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
          '-i', qAudio, '-c:v', 'libx264', '-tune', 'stillimage',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg1
        ]);
      }

      // Segment 2: Timer + countdown tick-tock SFX + suspense BGM
      if (this.audioAssets?.tickTockPath && fs.existsSync(this.audioAssets.tickTockPath)) {
        const hasBgm = this.audioAssets.bgmPath && fs.existsSync(this.audioAssets.bgmPath);
        const extraArgs = hasBgm ? ['-stream_loop', '-1', '-i', this.audioAssets.bgmPath] : [];
        const filterStr = hasBgm
          ? '[2:a]volume=0.45[tick];[3:a]volume=0.12[bgm];[1:a][tick][bgm]amix=inputs=3:duration=first:dropout_transition=2[aout]'
          : '[2:a]volume=0.45[tick];[1:a][2:a]amix=inputs=2:duration=first:dropout_transition=2[aout]';

        await runFFmpeg([
          '-y', '-loop', '1', '-t', String(d2), '-i', f2Png,
          '-i', timerAudio,
          '-stream_loop', '-1', '-i', this.audioAssets.tickTockPath,
          ...extraArgs,
          '-filter_complex', filterStr,
          '-map', '0:v', '-map', '[aout]',
          '-c:v', 'libx264', '-tune', 'stillimage',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d2), seg2
        ]);
      } else {
        await runFFmpeg([
          '-y', '-loop', '1', '-t', String(d2), '-i', f2Png,
          '-i', timerAudio, '-c:v', 'libx264', '-tune', 'stillimage',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg2
        ]);
      }

      // Segment 3: Answer Reveal + chime / ding SFX + subtle ambient BGM
      if (this.audioAssets?.chimePath && fs.existsSync(this.audioAssets.chimePath)) {
        const hasBgm = this.audioAssets.bgmPath && fs.existsSync(this.audioAssets.bgmPath);
        const extraArgs = hasBgm ? ['-stream_loop', '-1', '-i', this.audioAssets.bgmPath] : [];
        const filterStr = hasBgm
          ? '[2:a]volume=0.38[ding];[3:a]volume=0.10[bgm];[1:a][ding][bgm]amix=inputs=3:duration=first:dropout_transition=2[aout]'
          : '[2:a]volume=0.38[ding];[1:a][2:a]amix=inputs=2:duration=first:dropout_transition=2[aout]';

        await runFFmpeg([
          '-y', '-loop', '1', '-t', String(d3), '-i', f3Png,
          '-i', ansAudio,
          '-i', this.audioAssets.chimePath,
          ...extraArgs,
          '-filter_complex', filterStr,
          '-map', '0:v', '-map', '[aout]',
          '-c:v', 'libx264', '-tune', 'stillimage',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-t', String(d3), seg3
        ]);
      } else {
        await runFFmpeg([
          '-y', '-loop', '1', '-t', String(d3), '-i', f3Png,
          '-i', ansAudio, '-c:v', 'libx264', '-tune', 'stillimage',
          '-c:a', 'aac', '-b:a', '192k', '-ar', '44100', '-pix_fmt', 'yuv420p',
          '-shortest', seg3
        ]);
      }

      fs.writeFileSync(concatList, `file '${seg1.replace(/\\/g, '/')}'\nfile '${seg2.replace(/\\/g, '/')}'\nfile '${seg3.replace(/\\/g, '/')}'\n`);

      console.log(`[VideoMaker] Stitching final vertical Reel MP4...`);
      await runFFmpeg([
        '-y', '-f', 'concat', '-safe', '0', '-i', concatList,
        '-c', 'copy', finalMp4
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
