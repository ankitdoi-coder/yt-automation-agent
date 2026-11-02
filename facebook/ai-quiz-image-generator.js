/**
 * Facebook AI Quiz Image Post Generator & Publisher
 * Generates stunning 1080x1080 AI-illustrated Quiz Graphics
 * and publishes them directly to Facebook Page Feed (/photos).
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { AIVideoGenerator } = require('../utils/ai-video-generator');
const { FacebookUploader } = require('./fb-uploader');
const { EXAM_GK_QUESTIONS } = require('./content-vault');

class AIQuizImageGenerator {
  constructor() {
    this.outputDir = path.resolve(__dirname, 'output');
    this.tempDir = path.resolve(__dirname, 'temp');
    if (!fs.existsSync(this.outputDir)) fs.mkdirSync(this.outputDir, { recursive: true });
    if (!fs.existsSync(this.tempDir)) fs.mkdirSync(this.tempDir, { recursive: true });
    this.aiGenerator = new AIVideoGenerator();
  }

  _escapeXml(str = '') {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Generates a 1080x1080 composite quiz image with AI background
   */
  async createQuizImage(item) {
    const timestamp = Date.now();
    const rawAiImagePath = path.join(this.tempDir, `ai_raw_${item.id}_${timestamp}.png`);
    const finalImagePath = path.join(this.outputDir, `AI_QUIZ_PHOTO_${item.id}_${timestamp}.png`);

    // 1. Generate Thematic AI Background
    console.log(`[AIQuizImage] Generating AI background for "${item.title}"...`);
    const aiPrompt = item.aiPrompt || `${item.topic} educational concept illustration, cinematic dramatic lighting, highly detailed, 4k`;
    
    try {
      await this.aiGenerator.generateImage(aiPrompt, rawAiImagePath);
      console.log(`[AIQuizImage] ✅ AI background image generated: ${rawAiImagePath}`);
    } catch (err) {
      console.warn(`[AIQuizImage] AI image generation fallback: ${err.message}`);
    }

    // 2. Prepare SVG Quiz Card Overlay
    const topic = this._escapeXml(item.topic || 'सामान्य ज्ञान (General Knowledge)');
    const questionLines = (item.questionLines || [item.question]).map(l => this._escapeXml(l));
    const options = Array.isArray(item.options) ? item.options : [
      { letter: 'A', text: 'Option A' },
      { letter: 'B', text: 'Option B' },
      { letter: 'C', text: 'Option C' },
      { letter: 'D', text: 'Option D' }
    ];

    const letterColors = {
      A: '#ef4444',
      B: '#3b82f6',
      C: '#f59e0b',
      D: '#10b981'
    };

    const overlaySvg = `
    <svg width="1080" height="1080" viewBox="0 0 1080 1080" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <!-- Dark gradient over AI image for maximum text contrast -->
        <linearGradient id="vignette" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#020617" stop-opacity="0.82" />
          <stop offset="35%" stop-color="#020617" stop-opacity="0.75" />
          <stop offset="70%" stop-color="#020617" stop-opacity="0.88" />
          <stop offset="100%" stop-color="#020617" stop-opacity="0.96" />
        </linearGradient>
        <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#facc15" />
          <stop offset="100%" stop-color="#f97316" />
        </linearGradient>
      </defs>

      <!-- Vignette Overlay -->
      <rect width="1080" height="1080" fill="url(#vignette)"/>

      <!-- Header: ExamIQ Bharat -->
      <rect x="60" y="40" width="960" height="70" rx="20" fill="url(#bannerGrad)"/>
      <text x="540" y="88" font-family="Nirmala UI, Arial, sans-serif" font-size="32" font-weight="900" fill="#000000" text-anchor="middle" letter-spacing="1">
        🎯 EXAM IQ BHARAT | DAILY GK QUIZ 🏆
      </text>

      <!-- Topic Pill -->
      <rect x="290" y="125" width="500" height="42" rx="21" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
      <text x="540" y="155" font-family="Nirmala UI, Arial, sans-serif" font-size="22" font-weight="bold" fill="#38bdf8" text-anchor="middle">
        📚 ${topic}
      </text>

      <!-- Question Card -->
      <rect x="50" y="185" width="980" height="230" rx="24" fill="#0f172a" stroke="#38bdf8" stroke-width="4"/>
      ${questionLines.map((line, idx) => `
        <text x="540" y="${250 + (idx * 55)}" font-family="Nirmala UI, Arial, sans-serif" font-size="36" font-weight="bold" fill="${idx % 2 === 0 ? '#FFFFFF' : '#facc15'}" text-anchor="middle">
          ${line}
        </text>
      `).join('')}

      <!-- 4 Option Buttons (2x2 Grid) -->
      ${options.map((opt, idx) => {
        const isLeft = idx % 2 === 0;
        const isTop = idx < 2;
        const x = isLeft ? 50 : 550;
        const y = isTop ? 440 : 570;
        const badgeColor = letterColors[opt.letter] || '#3b82f6';

        return `
        <!-- Option ${opt.letter} Card -->
        <rect x="${x}" y="${y}" width="480" height="105" rx="18" fill="#1e293b" stroke="#475569" stroke-width="3"/>
        
        <!-- Letter Badge -->
        <rect x="${x + 18}" y="${y + 18}" width="68" height="68" rx="14" fill="${badgeColor}"/>
        <text x="${x + 52}" y="${y + 64}" font-family="Arial, sans-serif" font-size="36" font-weight="900" fill="#FFFFFF" text-anchor="middle">
          ${opt.letter}
        </text>

        <!-- Option Text -->
        <text x="${x + 105}" y="${y + 62}" font-family="Nirmala UI, Arial, sans-serif" font-size="28" font-weight="bold" fill="#FFFFFF">
          ${this._escapeXml(opt.text.length > 22 ? opt.text.slice(0, 22) + '..' : opt.text)}
        </text>
        `;
      }).join('')}

      <!-- Comment Challenge Banner -->
      <rect x="70" y="705" width="940" height="85" rx="42" fill="#e11d48" stroke="#ffffff" stroke-width="3"/>
      <text x="540" y="760" font-family="Nirmala UI, Arial, sans-serif" font-size="32" font-weight="900" fill="#FFFFFF" text-anchor="middle">
        👇 क्या आप सही उत्तर जानते हैं? कमेंट में जवाब दें! 💬
      </text>

      <!-- Exam Prep Badges -->
      <rect x="140" y="815" width="800" height="45" rx="22" fill="#0f172a" stroke="#6366f1" stroke-width="2"/>
      <text x="540" y="845" font-family="Nirmala UI, Arial, sans-serif" font-size="20" font-weight="bold" fill="#a5b4fc" text-anchor="middle">
        ⚡ SSC CGL • CHSL • GD • RAILWAY NTPC • POLICE EXAM ⚡
      </text>

      <!-- Bottom Follow CTA -->
      <rect x="180" y="880" width="720" height="60" rx="30" fill="#1e1b4b" stroke="#38bdf8" stroke-width="2"/>
      <text x="540" y="920" font-family="Nirmala UI, Arial, sans-serif" font-size="24" font-weight="bold" fill="#38bdf8" text-anchor="middle">
        🔔 रोज़ाना नए GK टेस्ट के लिए @ExamIQBharat को Follow करें!
      </text>
    </svg>
    `;

    // 3. Composite with Sharp
    let basePipeline;
    if (fs.existsSync(rawAiImagePath) && fs.statSync(rawAiImagePath).size > 1000) {
      basePipeline = sharp(rawAiImagePath).resize(1080, 1080, { fit: 'cover' });
    } else {
      // Fallback dark gradient canvas if image generation was unavailable
      basePipeline = sharp({
        create: {
          width: 1080,
          height: 1080,
          channels: 4,
          background: { r: 15, g: 23, b: 42, alpha: 1 }
        }
      });
    }

    await basePipeline
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .png({ quality: 95 })
      .toFile(finalImagePath);

    console.log(`[AIQuizImage] ✅ Finished rendering quiz graphic: ${finalImagePath}`);

    // Clean up temporary raw image
    if (fs.existsSync(rawAiImagePath)) {
      try { fs.unlinkSync(rawAiImagePath); } catch (_) {}
    }

    return finalImagePath;
  }

  /**
   * Generates and publishes the AI Quiz Image Post to Facebook Page feed
   */
  async generateAndPublish(item = null) {
    const selectedItem = item || EXAM_GK_QUESTIONS[Math.floor(Math.random() * EXAM_GK_QUESTIONS.length)];
    const imagePath = await this.createQuizImage(selectedItem);

    const caption = [
      `🎯 आज का महत्वपूर्ण GK टेस्ट! 🏆`,
      `📚 विषय: ${selectedItem.topic || 'सामान्य ज्ञान'}`,
      '',
      `Q. ${selectedItem.question}`,
      '',
      ...(selectedItem.options || []).map(o => `${o.letter}) ${o.text}`),
      '',
      `👇 क्या आप इसका सही जवाब जानते हैं? कमेंट बॉक्स में अपना उत्तर (A, B, C, D) बताएं!`,
      `🔔 सरकारी परीक्षाओं (SSC, Railway, Police, UPSC) की तैयारी के लिए @ExamIQBharat को Follow करें!`,
      '',
      selectedItem.tags ? selectedItem.tags.join(' ') : '#ExamIQ #GKQuiz #GeneralKnowledge #StaticGK #SSC #Railway #DailyQuiz'
    ].join('\n');

    const uploader = new FacebookUploader();
    console.log(`[AIQuizImage] Uploading AI Quiz Photo to Facebook Page (${uploader.pageId})...`);
    const uploadRes = await uploader.uploadPhoto(imagePath, { caption });
    console.log(`[AIQuizImage] 🎉 Successfully posted AI Quiz Graphic! URL: ${uploadRes.url}`);

    return {
      success: true,
      imagePath,
      uploadRes,
      item: selectedItem
    };
  }
}

module.exports = {
  AIQuizImageGenerator,
};
