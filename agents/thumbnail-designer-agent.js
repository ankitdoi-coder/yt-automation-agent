const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { Logger } = require('../utils/logger');
const { AIVideoGenerator } = require('../utils/ai-video-generator');
const { lintTitleAndThumbnail } = require('../utils/title-thumbnail-linter');

class ThumbnailDesignerAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('ThumbnailDesigner');
    this.templatesPath = path.join(__dirname, '..', 'data', 'thumbnail-templates');
    this.aiVideoGenerator = new AIVideoGenerator(credentials, { db });
  }

  async initialize() {
    this.logger.info('Initializing Thumbnail Designer Agent...');
    await this.ensureTemplatesDirectory();
    return true;
  }

  async ensureTemplatesDirectory() {
    try {
      await fs.mkdir(this.templatesPath, { recursive: true });
      await fs.mkdir(path.join(__dirname, '..', 'uploads', 'thumbnails'), { recursive: true });
    } catch (error) {
      this.logger.error('Failed to create directories:', error);
    }
  }

  async generateThumbnail(script) {
    try {
      this.logger.info(`Generating thumbnail for: ${script.title}`);
      
      // Quiz thumbnails use a fixed MCQ-list layout matching the reference channels
      const isQuiz = ['quiz', 'quiz_visuals', 'quiz_short', 'quiz_short_no_image'].includes(String(script.metadata?.strategy?.contentType || '').toLowerCase()) || Boolean(script.quiz?.questions?.length);
      if (isQuiz) {
        return await this.generateQuizThumbnail(script);
      }
      
      // Generate thumbnail concept
      const concept = await this.generateConcept(script);
      
      // Create thumbnail prompt for AI generation
      const prompt = await this.createPrompt(concept);
      
      // Generate base thumbnail
      const thumbnailPath = await this.createThumbnail(concept);
      
      // Add text overlay
      const finalThumbnail = await this.addTextOverlay(thumbnailPath, concept);
      
      // Optimize for YouTube
      const optimizedThumbnail = await this.optimizeForYouTube(finalThumbnail);

      const thumbText = [concept?.primaryText, concept?.secondaryText].filter(Boolean).join(' ');
      const pairingAudit = lintTitleAndThumbnail(script.title || '', thumbText);
      if (!pairingAudit.isPassing) {
        this.logger.warn(`Thumbnail and title pairing warning (Score: ${pairingAudit.score}/100): ${pairingAudit.issues.map(i => i[1]).join(' | ')}`);
      }
      
      const thumbnailData = {
        path: optimizedThumbnail,
        concept,
        prompt,
        dimensions: { width: 1280, height: 720 },
        fileSize: await this.getFileSize(optimizedThumbnail),
        pairingAudit,
        createdAt: new Date().toISOString()
      };
      
      // Save to database
      await this.db.saveThumbnail(thumbnailData);
      
      this.logger.info('Thumbnail generated successfully');
      return thumbnailData;
    } catch (error) {
      this.logger.error('Failed to generate thumbnail:', error);
      throw error;
    }
  }

  lintPairing(title, thumbText) {
    return lintTitleAndThumbnail(title, thumbText);
  }

  // High-CTR 16:9 Full-Screen Text Quiz Thumbnail Generator (Clean educational layout)
  async generateQuizThumbnail(script) {
    const quiz = script.quiz || {};
    const questions = quiz.questions || [];
    
    // Extract dynamic question count (e.g. 5, 10, 15, 20, 30, 50, 100)
    let count = questions.length || quiz.totalQuestions || 20;
    const matchCount = String(script.title || '').match(/top\s*(\d+)/i);
    if (matchCount && Number(matchCount[1])) {
      count = Number(matchCount[1]);
    }

    // Dynamic subjects
    const subjectHindi = quiz.subjectHindi || quiz.subject || this.extractSubjectFromTitle(script.title) || 'सामान्य ज्ञान (GK)';
    const subjectEng = quiz.subject || this.extractEnglishSubject(script.title) || 'General Knowledge';
    const isHindi = quiz.language !== 'en' || /[\u0900-\u097F]/.test(script.title || '') || /[\u0900-\u097F]/.test(quiz.subject || '') || !quiz.language;

    const width = 1280;
    const height = 720;
    const outputPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `quiz_thumb_${Date.now()}.png`);

    // Extract dynamic checklist / question highlights
    const checklistItems = this.extractChecklistItems(script, isHindi);

    // Build 100% clean full-screen 16:9 SVG (No AI background images taking up half the frame)
    const svgOverlay = isHindi
      ? this.buildHindiExamThumbnailSVG({ width, height, count, subjectHindi, subjectEng, checklistItems, scriptTitle: script.title })
      : this.buildEnglishQuizThumbnailSVG({ width, height, count, subjectEng, checklistItems });

    await sharp(Buffer.from(svgOverlay))
      .resize(width, height)
      .png()
      .toFile(outputPath);

    const concept = {
      style: isHindi ? 'hindi_exam_fullscreen' : 'english_quiz_fullscreen',
      count,
      subjectHindi,
      subjectEng,
      checklistItems
    };

    const thumbnailData = {
      path: outputPath,
      concept,
      prompt: 'Clean 16:9 full-screen high-contrast typography educational thumbnail',
      dimensions: { width, height },
      fileSize: await this.getFileSize(outputPath),
      createdAt: new Date().toISOString()
    };

    await this.db.saveThumbnail(thumbnailData);
    this.logger.info(`Clean 16:9 Fullscreen Quiz thumbnail generated successfully: ${outputPath}`);
    return thumbnailData;
  }

  async getChannelLogoBuffer(size = 115) {
    const candidates = [
      path.join(__dirname, '..', 'data', 'assets', 'channel_logo.png'),
      path.join(__dirname, '..', 'assets', 'channel_logo.png')
    ];
    for (const p of candidates) {
      try {
        await fs.access(p);
        return await sharp(p).resize(size, size).toBuffer();
      } catch (_e) {}
    }
    return null;
  }

  buildThematicPrompt(topic, subjectHindi, subjectEng) {
    const combined = `${topic || ''} ${subjectHindi || ''} ${subjectEng || ''}`.toLowerCase();
    if (/bio|जीव|cell|organ|human|body|botany|zoology/i.test(combined)) {
      return 'Stunning 3D glowing anatomical human body model showing internal organs and brain, DNA double helix, scientific microscope with green plant on wooden desk, stack of textbooks, 3D biological cell model, clean dark studio background on left side, 16:9 aspect ratio, 8k resolution, cinematic lighting, no text in image';
    }
    if (/river|mountain|geog|नदी|पर्वत|भूगोल|lake|himalaya|दर्रे/i.test(combined)) {
      return 'Stunning 3D physical relief topographic map of India with shining blue rivers and snow-capped mountain ranges, scenic photographic insets of rivers and Himalayas, clean background on left side, 16:9 aspect ratio, 8k resolution, dramatic lighting, no text in image';
    }
    if (/history|इतिहास|war|battle|revolt|freedom|empire|mughal|maurya|गांधी/i.test(combined)) {
      return 'Majestic 3D historical scene of ancient Indian monuments, Red Fort, Ashoka Lion Capital emblem, ancient Indian coins, vintage parchment map, clean background on left side, 16:9 aspect ratio, 8k resolution, dramatic atmospheric studio lighting, no text in image';
    }
    if (/polity|संविधान|constitution|article|parliament|law|court|न्यायालय/i.test(combined)) {
      return 'Elegant 3D leather-bound book of the Constitution of India with golden Ashoka Lion Capital emblem, Parliament of India, golden scales of justice, clean background on left side, 16:9 aspect ratio, 8k resolution, dramatic cinematic lighting, no text in image';
    }
    if (/chem|phys|भौतिक|रसायन|science|विज्ञान|space|planet|ग्रह/i.test(combined)) {
      return 'Vibrant 3D glowing atomic model, colorful laboratory glassware, astronomical telescope, solar system planets and galaxy, clean background on left side, 16:9 aspect ratio, 8k resolution, dramatic cinematic lighting, no text in image';
    }
    return 'Stunning 3D golden quiz trophy and medals, glowing lightbulb of wisdom, educational globe, hardcover books, clean background on left side, 16:9 aspect ratio, 8k resolution, dramatic studio lighting, no text in image';
  }

  extractChecklistItems(script, isHindi) {
    const questions = script.quiz?.questions || [];
    if (!questions.length) {
      return isHindi
        ? ['भारत की प्रमुख नदियाँ', 'सबसे लंबी नदी कौन-सी है?', 'किस राज्य में कौन-सी नदी?', 'भारत की पर्वत श्रृंखलाएं', 'सबसे ऊँची चोटी कौन-सी है?', 'महत्वपूर्ण झीलें और दर्रे']
        : ['Major Concepts & Terms', 'High-Yield Exam Questions', 'Previous Year Questions', 'Detailed Explanations', 'All Competitive Exams'];
    }

    const items = [];
    for (const q of questions) {
      let text = String(q.question || '').replace(/^Q?\d+[\.\:\-]?\s*/i, '').trim();
      text = text.replace(/^(आपका\s+(?:पहला|अगला|आखिरी)\s+सवाल\s+है[—\-]?\s*)/i, '').trim();
      if (text.length > 46) text = text.slice(0, 44).trimEnd() + '…';
      if (text && !items.includes(text)) {
        items.push(text);
        if (items.length >= 6) break;
      }
    }

    while (items.length < 4) {
      items.push(isHindi ? 'महत्वपूर्ण परीक्षा प्रश्न' : 'Important Exam Facts');
    }
    return items;
  }

  extractSubjectFromTitle(title) {
    const cleaned = String(title || '')
      .replace(/\btop\s*\d+\b/gi, '')
      .replace(/\b(gk|quiz|questions?|and answers?|in hindi)\b/gi, '')
      .replace(/[|:\-_]+/g, ' ')
      .trim();
    return cleaned || 'सामान्य ज्ञान';
  }

  extractEnglishSubject(title) {
    const words = String(title || '').split(/[\s|:\-_]+/);
    const candidates = words.filter(w => /^[a-zA-Z]{4,}$/.test(w) && !/^(quiz|questions|most|important|hindi|part|test)$/i.test(w));
    return candidates.slice(0, 2).join(' ') || 'General Knowledge';
  }

  buildHindiExamThumbnailSVG({ width, height, count, subjectHindi, subjectEng, checklistItems, scriptTitle = '' }) {
    const items = checklistItems && checklistItems.length ? checklistItems.slice(0, 3) : [
      'बार-बार परीक्षाओं में पूछे जाने वाले प्रश्न',
      'Previous Year Questions (PYQs) का संपूर्ण निचोड़',
      'सभी प्रतियोगी परीक्षाओं के लिए अति महत्वपूर्ण'
    ];

    const safeSubject = this.escapeHtml(subjectHindi || 'सामान्य ज्ञान (General Knowledge)');

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0B132B"/>
          <stop offset="50%" stop-color="#1C2541"/>
          <stop offset="100%" stop-color="#0A0E1A"/>
        </linearGradient>

        <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="3" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
        </filter>
      </defs>

      <!-- 1. Background: Full 16:9 Screen (No AI Background Image) -->
      <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
      <rect x="8" y="8" width="1264" height="704" rx="12" fill="none" stroke="#FFD700" stroke-width="4" opacity="0.6"/>

      <!-- 2. Top Target Exam Banner (Full Screen Width) -->
      <rect x="14" y="14" width="1252" height="54" rx="8" fill="#D32F2F"/>
      <text x="640" y="50" text-anchor="middle" font-family="'Nirmala UI', Mangal, 'Segoe UI', Arial, sans-serif" font-size="24" font-weight="900" fill="#FFFFFF" letter-spacing="1">
        🎯 ALL COMPETITIVE EXAMS : SSC CGL • CHSL • GD • MTS • RAILWAY NTPC • POLICE • STATE EXAMS
      </text>

      <!-- 3. Top Badges: TOP Count + Status + Channel Branding -->
      <g filter="url(#shadow)">
        <!-- Count Badge -->
        <rect x="50" y="90" width="340" height="96" rx="16" fill="#FFEA00"/>
        <text x="220" y="162" text-anchor="middle" font-family="Arial Black, Impact, 'Nirmala UI', sans-serif" font-size="68" font-weight="900" fill="#D32F2F">
          TOP ${count}
        </text>

        <!-- Status Badge -->
        <rect x="410" y="96" width="530" height="84" rx="14" fill="#00E676"/>
        <text x="675" y="154" text-anchor="middle" font-family="'Nirmala UI', Mangal, 'Segoe UI', Arial, sans-serif" font-size="38" font-weight="900" fill="#0A192F">
          ⚡ अति महत्वपूर्ण प्रश्न ⚡
        </text>

        <!-- Channel Branding Badge -->
        <rect x="960" y="96" width="270" height="84" rx="14" fill="#FFFFFF"/>
        <text x="1095" y="138" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="28" font-weight="900" fill="#0D47A1">
          Exam<tspan fill="#D32F2F">IQ</tspan>
        </text>
        <text x="1095" y="166" text-anchor="middle" font-family="'Nirmala UI', Arial, sans-serif" font-size="18" font-weight="900" fill="#2E7D32" letter-spacing="2">
          BHARAT
        </text>
      </g>

      <!-- 4. Massive Full-Width Hero Subject Title (Full Screen Width) -->
      <g filter="url(#shadow)">
        <rect x="50" y="210" width="1180" height="116" rx="18" fill="#FFD700" stroke="#FFFFFF" stroke-width="2"/>
        <text x="640" y="292" text-anchor="middle" font-family="'Nirmala UI', Mangal, 'Segoe UI', Arial, sans-serif" font-size="${safeSubject.length > 25 ? 52 : 62}" font-weight="900" fill="#0D1B2A">
          ${safeSubject}
        </text>
      </g>

      <!-- 5. Full-Width Feature & Question Highlights Box -->
      <g filter="url(#shadow)">
        <rect x="50" y="350" width="1180" height="240" rx="18" fill="#111B30" stroke="#3A506B" stroke-width="2.5"/>

        <g font-family="'Nirmala UI', Mangal, 'Segoe UI', Arial, sans-serif" font-size="30" font-weight="800">
          <!-- Item 1 -->
          <circle cx="95" cy="410" r="14" fill="#00E676"/>
          <text x="95" y="418" text-anchor="middle" font-size="18" font-weight="900" fill="#000000">✓</text>
          <text x="130" y="420" fill="#FFFFFF">${this.escapeHtml(items[0] || 'बार-बार परीक्षाओं में पूछे जाने वाले प्रश्न')}</text>

          <!-- Item 2 -->
          <circle cx="95" cy="475" r="14" fill="#00E676"/>
          <text x="95" y="483" text-anchor="middle" font-size="18" font-weight="900" fill="#000000">✓</text>
          <text x="130" y="485" fill="#FFFFFF">${this.escapeHtml(items[1] || 'Previous Year Questions (PYQs) का संपूर्ण निचोड़')}</text>

          <!-- Item 3 -->
          <circle cx="95" cy="540" r="14" fill="#00E676"/>
          <text x="95" y="548" text-anchor="middle" font-size="18" font-weight="900" fill="#000000">✓</text>
          <text x="130" y="550" fill="#FFFFFF">${this.escapeHtml(items[2] || 'सभी प्रतियोगी परीक्षाओं के लिए 100% महत्वपूर्ण')}</text>
        </g>

        <!-- Right Guarantee Stamp -->
        <g transform="translate(940, 380)">
          <rect x="0" y="0" width="250" height="180" rx="14" fill="#D32F2F" stroke="#FFEA00" stroke-width="3"/>
          <text x="125" y="55" text-anchor="middle" font-family="'Nirmala UI', Arial Black, sans-serif" font-size="32" font-weight="900" fill="#FFEA00">
            100%
          </text>
          <text x="125" y="98" text-anchor="middle" font-family="'Nirmala UI', Mangal, sans-serif" font-size="28" font-weight="900" fill="#FFFFFF">
            परीक्षा में
          </text>
          <text x="125" y="138" text-anchor="middle" font-family="'Nirmala UI', Mangal, sans-serif" font-size="28" font-weight="900" fill="#FFFFFF">
            आने वाले!
          </text>
        </g>
      </g>

      <!-- 6. Bottom Banner: Full Width CTA Strip -->
      <g filter="url(#shadow)">
        <rect x="50" y="612" width="1180" height="82" rx="41" fill="#D32F2F" stroke="#FFD700" stroke-width="2"/>
        <text x="640" y="666" text-anchor="middle" font-family="'Nirmala UI', Mangal, 'Segoe UI', Arial, sans-serif" font-size="36" font-weight="900" fill="#FFFFFF">
          🔥 एक ही वीडियो में पूरा रिवीजन | रट लो परीक्षा से पहले! 🔥
        </text>
      </g>
    </svg>`;
  }

  buildEnglishQuizThumbnailSVG({ width, height, count, subjectEng, checklistItems }) {
    const items = checklistItems && checklistItems.length ? checklistItems.slice(0, 3) : [
      'High-Yield Exam Questions',
      'Previous Year Questions (PYQs) Solved',
      'Complete Revision for All Competitive Exams'
    ];

    const safeSubject = this.escapeHtml((subjectEng || 'GENERAL KNOWLEDGE').toUpperCase());

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradEn" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0B132B"/>
          <stop offset="50%" stop-color="#1C2541"/>
          <stop offset="100%" stop-color="#0A0E1A"/>
        </linearGradient>

        <filter id="shadowEn" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="3" dy="5" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
        </filter>
      </defs>

      <!-- 1. Background: Full 16:9 Screen -->
      <rect width="${width}" height="${height}" fill="url(#bgGradEn)"/>
      <rect x="8" y="8" width="1264" height="704" rx="12" fill="none" stroke="#FFD700" stroke-width="4" opacity="0.6"/>

      <!-- 2. Top Target Exam Banner -->
      <rect x="14" y="14" width="1252" height="54" rx="8" fill="#D32F2F"/>
      <text x="640" y="50" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="24" font-weight="900" fill="#FFFFFF" letter-spacing="1">
        🎯 ALL COMPETITIVE EXAMS : SSC CGL • CHSL • GD • RAILWAYS • POLICE • DEFENCE
      </text>

      <!-- 3. Top Badges -->
      <g filter="url(#shadowEn)">
        <rect x="50" y="90" width="340" height="96" rx="16" fill="#FFEA00"/>
        <text x="220" y="162" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="68" font-weight="900" fill="#D32F2F">
          TOP ${count}
        </text>

        <rect x="410" y="96" width="530" height="84" rx="14" fill="#00E676"/>
        <text x="675" y="154" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="38" font-weight="900" fill="#0A192F">
          ⚡ MOST IMPORTANT MCQS ⚡
        </text>

        <rect x="960" y="96" width="270" height="84" rx="14" fill="#FFFFFF"/>
        <text x="1095" y="138" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="28" font-weight="900" fill="#0D47A1">
          Exam<tspan fill="#D32F2F">IQ</tspan>
        </text>
        <text x="1095" y="166" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="800" fill="#2E7D32">
          BHARAT 🇮🇳
        </text>
      </g>

      <!-- 4. Hero Subject Title -->
      <g filter="url(#shadowEn)">
        <rect x="50" y="210" width="1180" height="116" rx="18" fill="#FFD700" stroke="#FFFFFF" stroke-width="2"/>
        <text x="640" y="292" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="${safeSubject.length > 25 ? 54 : 64}" font-weight="900" fill="#0D1B2A">
          ${safeSubject}
        </text>
      </g>

      <!-- 5. Feature Box -->
      <g filter="url(#shadowEn)">
        <rect x="50" y="350" width="1180" height="240" rx="18" fill="#111B30" stroke="#3A506B" stroke-width="2.5"/>

        <g font-family="'Segoe UI', Arial, sans-serif" font-size="30" font-weight="800">
          <circle cx="95" cy="410" r="14" fill="#00E676"/>
          <text x="95" y="418" text-anchor="middle" font-size="18" font-weight="900" fill="#000000">✓</text>
          <text x="130" y="420" fill="#FFFFFF">${this.escapeHtml(items[0] || 'High-Yield Exam Questions')}</text>

          <circle cx="95" cy="475" r="14" fill="#00E676"/>
          <text x="95" y="483" text-anchor="middle" font-size="18" font-weight="900" fill="#000000">✓</text>
          <text x="130" y="485" fill="#FFFFFF">${this.escapeHtml(items[1] || 'Previous Year Questions (PYQs) Solved')}</text>

          <circle cx="95" cy="540" r="14" fill="#00E676"/>
          <text x="95" y="548" text-anchor="middle" font-size="18" font-weight="900" fill="#000000">✓</text>
          <text x="130" y="550" fill="#FFFFFF">${this.escapeHtml(items[2] || 'Complete Revision for All Competitive Exams')}</text>
        </g>

        <g transform="translate(940, 380)">
          <rect x="0" y="0" width="250" height="180" rx="14" fill="#D32F2F" stroke="#FFEA00" stroke-width="3"/>
          <text x="125" y="55" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="32" font-weight="900" fill="#FFEA00">
            100%
          </text>
          <text x="125" y="98" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="28" font-weight="900" fill="#FFFFFF">
            EXAM
          </text>
          <text x="125" y="138" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="28" font-weight="900" fill="#FFFFFF">
            READY!
          </text>
        </g>
      </g>

      <!-- 6. Bottom Banner Strip -->
      <g filter="url(#shadowEn)">
        <rect x="50" y="612" width="1180" height="82" rx="41" fill="#D32F2F" stroke="#FFD700" stroke-width="2"/>
        <text x="640" y="666" text-anchor="middle" font-family="'Segoe UI', Arial, sans-serif" font-size="36" font-weight="900" fill="#FFFFFF">
          🔥 Complete Subject Masterclass | Watch Before Exam! 🔥
        </text>
      </g>
    </svg>`;
  }

  async generateConcept(script) {
    const concepts = {
      tutorial: {
        style: 'clean',
        elements: ['step numbers', 'arrows', 'progress indicators'],
        colors: ['blue', 'white', 'green'],
        emotion: 'helpful'
      },
      explainer: {
        style: 'informative',
        elements: ['icons', 'diagrams', 'question marks'],
        colors: ['purple', 'yellow', 'white'],
        emotion: 'curious'
      },
      list: {
        style: 'numbered',
        elements: ['large numbers', 'countdown', 'highlights'],
        colors: ['red', 'yellow', 'black'],
        emotion: 'exciting'
      },
      review: {
        style: 'comparative',
        elements: ['product image', 'rating stars', 'vs symbol'],
        colors: ['orange', 'gray', 'white'],
        emotion: 'analytical'
      },
      story: {
        style: 'dramatic',
        elements: ['faces', 'emotion', 'journey path'],
        colors: ['dark blue', 'gold', 'white'],
        emotion: 'intriguing'
      },
      quiz: {
        style: 'mcq_list',
        elements: ['black top banner', '3 MCQs with red keywords', 'white background'],
        colors: ['black', 'white', 'red'],
        emotion: 'exam_focused'
      }
    };

    const contentType = String(script.metadata?.strategy?.contentType || '').toLowerCase();
    const baseConcept = concepts[contentType] || concepts.explainer;
    
    return {
      title: this.formatThumbnailTitle(script.title, script),
      style: baseConcept.style,
      primaryText: this.extractPrimaryText(script.title, script),
      secondaryText: this.generateSecondaryText(script),
      elements: baseConcept.elements,
      colors: {
        primary: baseConcept.colors[0],
        secondary: baseConcept.colors[1],
        accent: baseConcept.colors[2]
      },
      emotion: baseConcept.emotion,
      composition: this.selectComposition(),
      effects: this.selectEffects()
    };
  }

  formatThumbnailTitle(title, script = null) {
    if (script?.metadata?.strategy?.contentType?.toLowerCase() === 'quiz') {
      return title; // keep full title for quiz
    }
    // Shorten title for thumbnail
    const words = String(title || '').split(' ');
    if (words.length > 5) {
      return words.slice(0, 5).join(' ') + '...';
    }
    return title;
  }

  extractPrimaryText(title, script = null) {
    if (script?.metadata?.strategy?.contentType?.toLowerCase() === 'quiz') {
      const quiz = script.metadata?.strategy?.quizSubject || script.metadata?.strategy?.topic || '';
      const match = quiz.match(/^Top\s+(\d+)\s+(.+?)\s+(?:Question|Quiz|GK)/i) || quiz.match(/^(\d+)\s+(.+?)\s+(?:Question|Quiz|GK)/i);
      if (match) return match[2].toUpperCase();
      return 'GK QUIZ';
    }
    // Extract most impactful words
    const impactWords = ['ultimate', 'complete', 'secret', 'truth', 'how', 'why', 'best', 'top', 'guide', 'master'];
    const titleWords = title.toLowerCase().split(' ');
    
    const foundImpactWords = titleWords.filter(word => impactWords.includes(word));
    
    if (foundImpactWords.length > 0) {
      return foundImpactWords[0].toUpperCase();
    }
    
    // Extract numbers if present
    const numbers = title.match(/\d+/);
    if (numbers) {
      return numbers[0];
    }
    
    // Use first significant word
    return titleWords.find(word => word.length > 4)?.toUpperCase() || 'WATCH';
  }

  generateSecondaryText(script) {
    if (script.metadata && script.metadata.strategy) {
      const strategy = script.metadata.strategy;
      
      if (strategy.contentType === 'Tutorial') {
        return 'STEP BY STEP';
      } else if (strategy.contentType === 'List') {
        return 'YOU WON\'T BELIEVE #1';
      } else if (strategy.contentType === 'Review') {
        return 'HONEST REVIEW';
      } else if (strategy.contentType === 'Quiz') {
        return `TOP ${strategy.quiz?.totalQuestions || 50} QUESTIONS`;
      }
    }
    
    return 'MUST WATCH';
  }

  selectComposition() {
    const compositions = [
      'rule-of-thirds',
      'centered',
      'diagonal',
      'golden-ratio',
      'symmetrical'
    ];
    
    return compositions[Math.floor(Math.random() * compositions.length)];
  }

  selectEffects() {
    return {
      blur: Math.random() > 0.5,
      vignette: Math.random() > 0.7,
      glow: Math.random() > 0.6,
      shadow: true,
      border: Math.random() > 0.8
    };
  }

  async createPrompt(concept) {
    const prompt = `Create a YouTube thumbnail with the following specifications:
    Style: ${concept.style}
    Primary Text: "${concept.primaryText}"
    Secondary Text: "${concept.secondaryText}"
    Color Scheme: ${concept.colors.primary}, ${concept.colors.secondary}, ${concept.colors.accent}
    Elements to include: ${concept.elements.join(', ')}
    Emotional tone: ${concept.emotion}
    Composition: ${concept.composition}
    
    The thumbnail should be eye-catching, professional, and optimized for high click-through rate.
    Resolution: 1280x720px
    Format: High contrast, bold text, clear imagery`;
    
    return prompt;
  }

  async createThumbnail(concept, suffix = '') {
    // Create a base thumbnail using Sharp
    const width = 1280;
    const height = 720;
    
    const marker = suffix ? `_${suffix}` : '';
    const outputPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `thumbnail${marker}_${Date.now()}.png`);
    
    // Create gradient background
    const svg = `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:${this.hexToRgb(concept.colors.primary)};stop-opacity:1" />
            <stop offset="100%" style="stop-color:${this.hexToRgb(concept.colors.secondary)};stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#gradient)" />
      </svg>
    `;
    
    await sharp(Buffer.from(svg))
      .resize(width, height)
      .png()
      .toFile(outputPath);
    
    return outputPath;
  }

  truncateText(text, maxLength) {
    const str = String(text || '').trim();
    if (str.length <= maxLength) return str;
    return `${str.slice(0, maxLength - 1).trimEnd()}…`;
  }

  escapeHtml(text) {
    return String(text ?? '')
      .replace(/&/g, '&')
      .replace(/</g, '<')
      .replace(/>/g, '>')
      .replace(/"/g, '"')
      .replace(/'/g, '&apos;');
  }

  hexToRgb(color) {
    // Color name to hex mapping
    const colors = {
      'blue': '#0066CC',
      'red': '#CC0000',
      'green': '#00CC66',
      'yellow': '#FFCC00',
      'purple': '#6600CC',
      'orange': '#FF6600',
      'white': '#FFFFFF',
      'black': '#000000',
      'gray': '#808080',
      'dark blue': '#003366',
      'gold': '#FFD700'
    };
    
    return colors[color] || '#000000';
  }

  async addTextOverlay(imagePath, concept, suffix = '') {
    const marker = suffix ? `_${suffix}` : '';
    const outputPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `thumbnail_final${marker}_${Date.now()}.png`);
    
    // Create text overlay SVG
    const textSvg = `
      <svg width="1280" height="720">
        <style>
          .primary { 
            fill: ${concept.colors.accent === 'white' ? 'white' : 'black'}; 
            font-size: 120px; 
            font-weight: bold; 
            font-family: Arial, sans-serif;
            text-anchor: middle;
          }
          .secondary { 
            fill: ${concept.colors.accent}; 
            font-size: 60px; 
            font-weight: bold; 
            font-family: Arial, sans-serif;
            text-anchor: middle;
          }
          .shadow {
            fill: black;
            opacity: 0.5;
          }
        </style>
        
        <!-- Shadow -->
        <text x="642" y="302" class="primary shadow">${concept.primaryText}</text>
        <text x="642" y="402" class="secondary shadow">${concept.secondaryText}</text>
        
        <!-- Main text -->
        <text x="640" y="300" class="primary">${concept.primaryText}</text>
        <text x="640" y="400" class="secondary">${concept.secondaryText}</text>
      </svg>
    `;
    
    const textOverlay = await sharp(Buffer.from(textSvg)).png().toBuffer();
    
    await sharp(imagePath)
      .composite([{
        input: textOverlay,
        top: 0,
        left: 0
      }])
      .toFile(outputPath);
    
    return outputPath;
  }

  async optimizeForYouTube(imagePath, suffix = '') {
    const marker = suffix ? `_${suffix}` : '';
    const outputPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `thumbnail_optimized${marker}_${Date.now()}.jpg`);
    
    // YouTube optimization: JPEG format, proper compression
    await sharp(imagePath)
      .resize(1280, 720, {
        fit: 'cover',
        position: 'centre'
      })
      .jpeg({
        quality: 90,
        progressive: true,
        optimizeScans: true
      })
      .toFile(outputPath);
    
    // Verify file size (YouTube limit is 2MB)
    const stats = await fs.stat(outputPath);
    if (stats.size > 2 * 1024 * 1024) {
      // Re-compress if too large
      await sharp(imagePath)
        .resize(1280, 720)
        .jpeg({ quality: 80 })
        .toFile(outputPath);
    }
    
    return outputPath;
  }

  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
  }

  async generateABVariants(concept) {
    const concepts = [
      {
        label: 'Color contrast',
        concept: {
          ...concept,
          colors: {
            primary: concept.colors.secondary,
            secondary: concept.colors.primary,
            accent: concept.colors.accent
          }
        }
      },
      {
        label: 'Alternate promise',
        concept: { ...concept, primaryText: this.generateAlternativeText(concept.primaryText) }
      },
      {
        label: 'Centered composition',
        concept: { ...concept, composition: 'centered' }
      }
    ];
    const variants = [];
    for (let index = 0; index < concepts.length; index++) {
      const { label, concept: variantConcept } = concepts[index];
      const suffix = `experiment_${index + 1}`;
      const base = await this.createThumbnail(variantConcept, suffix);
      const overlay = await this.addTextOverlay(base, variantConcept, suffix);
      const optimized = await this.optimizeForYouTube(overlay, suffix);
      variants.push({ label, path: optimized, concept: variantConcept });
    }
    return variants;
  }

  generateAlternativeText(originalText) {
    const alternatives = {
      'HOW': 'WHY',
      'BEST': 'TOP',
      'GUIDE': 'SECRETS',
      'TRUTH': 'FACTS',
      'ULTIMATE': 'COMPLETE'
    };
    
    return alternatives[originalText] || originalText + '!';
  }
}

module.exports = { ThumbnailDesignerAgent };
