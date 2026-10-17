/**
 * Facebook Reels Video Maker
 * Generates 1080x1920 Full HD Vertical MP4 Reels:
 * - High-contrast vibrant themes for maximum Facebook thumb-stopping hook
 * - Hindi text rendering via Sharp (Nirmala UI / Arial)
 * - Clear Hindi narration audio
 * - 3-stage dynamic flow: Question -> Suspense Timer (5..4..3..2..1) -> Answer Reveal
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');
const { runFFmpeg, getMediaDuration } = require('../utils/ffmpeg');

// Eye-catching color themes for Reels variety
const COLOR_THEMES = [
  {
    name: 'Electric Violet',
    bg1: '#0d001a', bg2: '#27004f', bg3: '#080010',
    cardBg: '#190235', cardBorder: '#FFE600',
    bannerGradient1: '#FFE600', bannerGradient2: '#FF416C',
    ansBg: '#032410', ansBorder: '#00F260',
  },
  {
    name: 'Midnight Navy',
    bg1: '#000b1e', bg2: '#002554', bg3: '#000611',
    cardBg: '#051838', cardBorder: '#00E5FF',
    bannerGradient1: '#00E5FF', bannerGradient2: '#120E43',
    ansBg: '#01281f', ansBorder: '#00FF9D',
  },
  {
    name: 'Ruby Crimson',
    bg1: '#1a0006', bg2: '#4a0011', bg3: '#0d0003',
    cardBg: '#33000b', cardBorder: '#FFD700',
    bannerGradient1: '#FFD700', bannerGradient2: '#FF1361',
    ansBg: '#201d00', ansBorder: '#FFE600',
  },
  {
    name: 'Cyber Teal',
    bg1: '#00141a', bg2: '#003745', bg3: '#000a0d',
    cardBg: '#00252e', cardBorder: '#FF9100',
    bannerGradient1: '#FF9100', bannerGradient2: '#F80759',
    ansBg: '#022915', ansBorder: '#25D366',
  },
  {
    name: 'Royal Purple',
    bg1: '#110022', bg2: '#3b006b', bg3: '#090014',
    cardBg: '#250045', cardBorder: '#FFDF00',
    bannerGradient1: '#FFDD00', bannerGradient2: '#7928CA',
    ansBg: '#0b2612', ansBorder: '#00FF88',
  }
];

class FacebookVideoMaker {
  constructor() {
    this.outputDir = path.resolve(__dirname, 'output');
    this.tempDir = path.resolve(__dirname, 'temp');
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
  }

  // Generate crisp Hindi voice audio
  async _getAudio(text, outputPath) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=hi&q=${encodeURIComponent(text)}`;
    const res = await axios.get(url, {
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      timeout: 20000,
    });
    fs.writeFileSync(outputPath, res.data);
    return outputPath;
  }

  _buildSVG(theme, { questionLines, isAnswer, answerText, timerText, subtitle }) {
    return `
    <svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${theme.bg1}" />
          <stop offset="50%" stop-color="${theme.bg2}" />
          <stop offset="100%" stop-color="${theme.bg3}" />
        </linearGradient>
        <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="${theme.bannerGradient1}" />
          <stop offset="100%" stop-color="${theme.bannerGradient2}" />
        </linearGradient>
      </defs>
      
      <!-- Background -->
      <rect width="1080" height="1920" fill="url(#bg)"/>
      
      <!-- Top Hook Banner -->
      <rect x="70" y="140" width="940" height="140" rx="40" fill="url(#bannerGrad)"/>
      <text x="540" y="230" font-family="Nirmala UI, Arial, sans-serif" font-size="48" font-weight="900" fill="#000000" text-anchor="middle">
        🔥 दिमाग की बत्ती जलाओ | दम है तो बताओ! 🧠
      </text>

      <!-- Question Card -->
      <rect x="65" y="380" width="950" height="520" rx="35" fill="${theme.cardBg}" stroke="${theme.cardBorder}" stroke-width="7"/>
      ${questionLines.map((line, idx) => `
        <text x="540" y="${510 + (idx * 95)}" font-family="Nirmala UI, Arial, sans-serif" font-size="54" font-weight="bold" fill="${idx % 2 === 0 ? '#FFFFFF' : '#FFEA00'}" text-anchor="middle">
          ${line}
        </text>
      `).join('')}

      ${timerText ? `
        <!-- Suspense Countdown Timer Box -->
        <rect x="220" y="1010" width="640" height="150" rx="75" fill="#FF3366" stroke="#FFFFFF" stroke-width="4"/>
        <text x="540" y="1105" font-family="Nirmala UI, Arial, sans-serif" font-size="52" font-weight="900" fill="#FFFFFF" text-anchor="middle">
          ${timerText}
        </text>
      ` : ''}

      ${isAnswer ? `
        <!-- Answer Card -->
        <rect x="65" y="970" width="950" height="360" rx="35" fill="${theme.ansBg}" stroke="${theme.ansBorder}" stroke-width="8"/>
        <text x="540" y="1070" font-family="Nirmala UI, Arial, sans-serif" font-size="46" font-weight="bold" fill="${theme.ansBorder}" text-anchor="middle">
          ✅ सही जवाब (Answer):
        </text>
        <text x="540" y="1185" font-family="Nirmala UI, Arial, sans-serif" font-size="56" font-weight="900" fill="#FFFFFF" text-anchor="middle">
          ${answerText}
        </text>
        <text x="540" y="1275" font-family="Nirmala UI, Arial, sans-serif" font-size="40" font-weight="bold" fill="#FFEA00" text-anchor="middle">
          ${subtitle || 'किस-किस का दिमाग गलत गया था? सच बताओ! 😂'}
        </text>
      ` : ''}

      <!-- Bottom Viral CTA -->
      <rect x="120" y="1690" width="840" height="120" rx="60" fill="#150a2b" stroke="#7755AA" stroke-width="4"/>
      <text x="540" y="1765" font-family="Nirmala UI, Arial, sans-serif" font-size="42" font-weight="bold" fill="#00E5FF" text-anchor="middle">
        👉 कमेंट में बताओ और पेज फॉलो करो! 🔔
      </text>
    </svg>
    `;
  }

  /**
   * Generates a complete 9:16 vertical Reel MP4 for a riddle
   */
  async createReel(riddleItem, themeIndex = 0) {
    const theme = COLOR_THEMES[themeIndex % COLOR_THEMES.length];
    const timestamp = Date.now();
    const prefix = path.join(this.tempDir, `fb_${riddleItem.id}_${timestamp}`);

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
    const finalMp4 = path.join(this.outputDir, `FB_REEL_${riddleItem.id}_${timestamp}.mp4`);

    try {
      console.log(`[VideoMaker] Generating audio narration for: ${riddleItem.id}...`);
      await this._getAudio(riddleItem.voiceQuestion, qAudio);
      await this._getAudio(riddleItem.voiceTimer, timerAudio);
      await this._getAudio(riddleItem.voiceAnswer, ansAudio);

      console.log(`[VideoMaker] Rendering visual frames (Theme: ${theme.name})...`);
      const svg1 = this._buildSVG(theme, { questionLines: riddleItem.questionLines });
      const svg2 = this._buildSVG(theme, { questionLines: riddleItem.questionLines, timerText: '⏳ सोचो! 5.. 4.. 3.. 2.. 1' });
      const svg3 = this._buildSVG(theme, { questionLines: riddleItem.questionLines, isAnswer: true, answerText: riddleItem.answerText, subtitle: riddleItem.subtitle });

      await sharp(Buffer.from(svg1)).png().toFile(f1Png);
      await sharp(Buffer.from(svg2)).png().toFile(f2Png);
      await sharp(Buffer.from(svg3)).png().toFile(f3Png);

      const d1 = await getMediaDuration(qAudio);
      const d2 = await getMediaDuration(timerAudio);
      const d3 = await getMediaDuration(ansAudio);

      console.log(`[VideoMaker] Rendering FFmpeg segments (${(d1 + d2 + d3).toFixed(1)}s total)...`);
      await runFFmpeg([
        '-y', '-loop', '1', '-t', String(d1), '-i', f1Png,
        '-i', qAudio, '-c:v', 'libx264', '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p',
        '-shortest', seg1
      ]);

      await runFFmpeg([
        '-y', '-loop', '1', '-t', String(d2), '-i', f2Png,
        '-i', timerAudio, '-c:v', 'libx264', '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p',
        '-shortest', seg2
      ]);

      await runFFmpeg([
        '-y', '-loop', '1', '-t', String(d3), '-i', f3Png,
        '-i', ansAudio, '-c:v', 'libx264', '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', '192k', '-pix_fmt', 'yuv420p',
        '-shortest', seg3
      ]);

      fs.writeFileSync(concatList, `file '${seg1.replace(/\\/g, '/')}'\nfile '${seg2.replace(/\\/g, '/')}'\nfile '${seg3.replace(/\\/g, '/')}'\n`);

      console.log(`[VideoMaker] Stitching final vertical Reel MP4...`);
      await runFFmpeg([
        '-y', '-f', 'concat', '-safe', '0', '-i', concatList,
        '-c', 'copy', finalMp4
      ]);

      console.log(`[VideoMaker] Reel generated successfully: ${path.basename(finalMp4)}`);
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
