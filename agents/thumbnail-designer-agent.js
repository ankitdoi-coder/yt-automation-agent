const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { Logger } = require('../utils/logger');
const { AIVideoGenerator } = require('../utils/ai-video-generator');

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
      
      const thumbnailData = {
        path: optimizedThumbnail,
        concept,
        prompt,
        dimensions: { width: 1280, height: 720 },
        fileSize: await this.getFileSize(optimizedThumbnail),
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

  // High-CTR Dynamic Quiz Thumbnail Generator matching channel reference designs
  async generateQuizThumbnail(script) {
    const quiz = script.quiz || {};
    const questions = quiz.questions || [];
    
    // Extract dynamic question count (e.g. 5, 10, 15, 20, 30, 50)
    let count = questions.length || quiz.totalQuestions || 20;
    const matchCount = String(script.title || '').match(/top\s*(\d+)/i);
    if (matchCount && Number(matchCount[1])) {
      count = Number(matchCount[1]);
    }

    // Dynamic subjects
    const subjectHindi = quiz.subjectHindi || quiz.subject || this.extractSubjectFromTitle(script.title) || 'सामान्य ज्ञान';
    const subjectEng = quiz.subject || this.extractEnglishSubject(script.title) || 'General Knowledge';
    // Language selection: Always use high-CTR Hindi Exam thumbnail for ExamIQ Bharat unless explicitly English only
    const isHindi = quiz.language !== 'en' || /[\u0900-\u097F]/.test(script.title || '') || /[\u0900-\u097F]/.test(quiz.subject || '') || !quiz.language;

    const width = 1280;
    const height = 720;
    const outputPath = path.join(__dirname, '..', 'uploads', 'thumbnails', `quiz_thumb_${Date.now()}.png`);
    const bgPath = path.join(__dirname, '..', 'temp', `thumb_bg_${Date.now()}.png`);

    // 1. Generate topic-specific 3D background visual using AI
    const visualPrompt = this.buildThematicPrompt(script.metadata?.strategy?.topic || script.title, subjectHindi, subjectEng);
    let hasBg = false;
    try {
      this.logger.info(`Generating AI 3D background for thumbnail: "${visualPrompt.slice(0, 75)}..."`);
      await this.aiVideoGenerator.generateImage(visualPrompt, bgPath);
      hasBg = true;
    } catch (err) {
      this.logger.warn(`AI thumbnail background generation skipped/failed (${err.message}), using high-contrast thematic gradient`);
    }

    // 2. Extract dynamic checklist items from questions
    const checklistItems = this.extractChecklistItems(script, isHindi);

    // 3. Build SVG overlay matching reference designs
    const svgOverlay = isHindi
      ? this.buildHindiExamThumbnailSVG({ width, height, count, subjectHindi, subjectEng, checklistItems, scriptTitle: script.title })
      : this.buildEnglishQuizThumbnailSVG({ width, height, count, subjectEng, checklistItems });

    // 4. Composite: Background (AI or gradient) + SVG Typography & Cards + ExamIQ Logo
    const logoBuffer = await this.getChannelLogoBuffer(115);
    const composites = [{ input: Buffer.from(svgOverlay), top: 0, left: 0 }];

    if (logoBuffer) {
      // Place logo at top right for Hindi layout, or top left for English layout
      if (isHindi) {
        composites.push({ input: logoBuffer, top: 18, left: 1140 });
      } else {
        composites.push({ input: logoBuffer, top: 18, left: 24 });
      }
    }

    if (hasBg) {
      await sharp(bgPath)
        .resize(width, height)
        .composite(composites)
        .png()
        .toFile(outputPath);
      await fs.unlink(bgPath).catch(() => {});
    } else {
      const baseGradientSvg = `<svg width="${width}" height="${height}"><defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#0a192f"/><stop offset="100%" stop-color="#020c1b"/></linearGradient></defs><rect width="${width}" height="${height}" fill="url(#g)"/></svg>`;
      await sharp(Buffer.from(baseGradientSvg))
        .resize(width, height)
        .composite(composites)
        .png()
        .toFile(outputPath);
    }

    const concept = {
      style: isHindi ? 'hindi_exam_hero' : '3d_neon_hero',
      count,
      subjectHindi,
      subjectEng,
      checklistItems
    };

    const thumbnailData = {
      path: outputPath,
      concept,
      prompt: visualPrompt,
      dimensions: { width, height },
      fileSize: await this.getFileSize(outputPath),
      createdAt: new Date().toISOString()
    };

    await this.db.saveThumbnail(thumbnailData);
    this.logger.info(`Quiz thumbnail generated successfully: ${outputPath}`);
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
      if (text.length > 28) text = text.slice(0, 26).trimEnd() + '…';
      if (text && !items.includes(text)) {
        items.push(text);
        if (items.length >= 8) break;
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
    const col1 = checklistItems.slice(0, 4);
    const col2 = checklistItems.slice(4, 8);

    // Determine topTag dynamically
    let topTag = 'भारत की';
    const fullText = (scriptTitle || '') + ' ' + (subjectHindi || '') + ' ' + (subjectEng || '');
    if (/भारत\s+की/i.test(fullText)) {
      topTag = 'भारत की';
    } else if (/भारत\s+के/i.test(fullText)) {
      topTag = 'भारत के';
    } else if (/भारतीय|india/i.test(fullText)) {
      topTag = 'भारत की';
    } else if (/विश्व|world/i.test(fullText)) {
      topTag = 'विश्व के';
    } else if (/इतिहास|history/i.test(fullText)) {
      topTag = 'इतिहास के';
    } else if (/संविधान|polity/i.test(fullText)) {
      topTag = 'संविधान के';
    } else {
      topTag = 'महत्वपूर्ण';
    }

    // Clean redundant prefix from subjectHindi if it starts with भारत की / भारत के / भारतीय
    let displaySubjectHindi = subjectHindi;
    if (topTag.startsWith('भारत')) {
      displaySubjectHindi = displaySubjectHindi.replace(/^(भारत\s+की|भारत\s+के|भारतीय)\s+/i, '').trim() || subjectHindi;
    }

    const countStr = `Top ${count}`;
    const bannerWidth = Math.min(670, Math.max(480, 240 + (countStr.length * 28) + (topTag.length * 38)));

    const renderColumn = (items, startX) => items.map((item, index) => {
      const y = index * 56;
      return `
        <rect x="${startX}" y="${y - 18}" width="22" height="22" rx="4" fill="#D32F2F"/>
        <text x="${startX + 4}" y="${y - 1}" fill="#FFFFFF" font-size="16" font-family="Arial">✓</text>
        <text x="${startX + 32}" y="${y}" fill="#212121">${this.escapeHtml(item)}</text>`;
    }).join('\n');

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="2" dy="4" stdDeviation="4" flood-color="#000000" flood-opacity="0.65"/>
        </filter>
      </defs>

      <!-- Left Side White/Light Backdrop -->
      <rect x="0" y="0" width="700" height="${height}" fill="#FFFFFF"/>
      <polygon points="700,0 770,0 670,720 600,720" fill="#FFFFFF" opacity="0.9"/>

      <!-- Top Red/Yellow Brush Banner: Top X -->
      <g filter="url(#shadow)">
        <rect x="25" y="24" width="${bannerWidth}" height="92" rx="16" fill="#D32F2F"/>
        <text x="45" y="94" font-family="Arial Black, Impact, sans-serif" font-size="76" font-weight="900" fill="#FFFFFF">${countStr} <tspan dx="16" font-family="Noto Sans Devanagari, Nirmala UI, Mangal, DejaVu Sans, Arial" font-size="52" font-weight="900" fill="#FFF200">${topTag}</tspan></text>
      </g>

      <!-- Main Hero Title -->
      <g filter="url(#shadow)">
        <rect x="25" y="130" width="670" height="84" rx="12" fill="#FFEA00"/>
        <text x="40" y="190" font-family="Noto Sans Devanagari, Nirmala UI, Mangal, DejaVu Sans, Arial" font-size="46" font-weight="900" fill="#0D47A1">${this.escapeHtml(displaySubjectHindi)}</text>
      </g>

      <!-- Category Banners: GK Quiz + English Pill -->
      <g filter="url(#shadow)">
        <rect x="25" y="228" width="310" height="60" rx="12" fill="#111111"/>
        <text x="45" y="272" font-family="Arial Black, Impact, sans-serif" font-size="40" font-weight="900" fill="#FFF200">⚡ GK Quiz ⚡</text>

        <rect x="355" y="228" width="340" height="60" rx="30" fill="#D32F2F"/>
        <text x="525" y="266" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" font-weight="800" fill="#FFFFFF">${this.escapeHtml(subjectEng)}</text>
      </g>

      <!-- Checklist Box -->
      <g filter="url(#shadow)">
        <rect x="25" y="306" width="670" height="284" rx="16" fill="#FAFAFA" stroke="#DDDDDD" stroke-width="2"/>
        <g transform="translate(0, 348)" font-family="Noto Sans Devanagari, Nirmala UI, Mangal, DejaVu Sans, Arial" font-size="21" font-weight="700">
          ${renderColumn(col1, 45)}
          ${renderColumn(col2, 365)}
        </g>
      </g>

      <!-- Bottom Target Ribbon -->
      <g filter="url(#shadow)">
        <rect x="25" y="608" width="670" height="66" rx="33" fill="#D32F2F"/>
        <text x="55" y="650" font-size="28">🎯</text>
        <text x="100" y="650" font-family="Noto Sans Devanagari, Nirmala UI, Mangal, DejaVu Sans, Arial" font-size="28" font-weight="900" fill="#FFFFFF">सभी प्रतियोगी परीक्षाओं के लिए महत्वपूर्ण !</text>
      </g>
    </svg>`;
  }

  buildEnglishQuizThumbnailSVG({ width, height, count, subjectEng, checklistItems }) {
    const listHtml = checklistItems.slice(0, 5).map((item, index) => {
      const y = index * 40;
      return `
        <text x="0" y="${y}" fill="#2E7D32" font-weight="900">✓</text>
        <text x="24" y="${y}" fill="#222222">${this.escapeHtml(item)}</text>`;
    }).join('\n');

    return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="shadow" x="-10%" y="-10%" width="130%" height="130%">
          <feDropShadow dx="3" dy="5" stdDeviation="5" flood-color="#000000" flood-opacity="0.75"/>
        </filter>
      </defs>

      <!-- Left Side Dark Vignette overlay so text pops over background -->
      <rect x="0" y="0" width="620" height="${height}" fill="#0A0F1D" opacity="0.94"/>
      <polygon points="620,0 710,0 590,720 500,720" fill="#0A0F1D" opacity="0.94"/>

      <!-- TOP X Badge: Yellow Brush with Red/Black Text -->
      <g filter="url(#shadow)">
        <rect x="150" y="30" width="370" height="90" rx="14" fill="#FFEA00"/>
        <text x="180" y="98" font-family="Arial Black, Impact, sans-serif" font-size="78" font-weight="900" fill="#111111">TOP <tspan fill="#D32F2F">${count}</tspan></text>
        <text x="450" y="92" font-size="46">💡</text>
      </g>

      <!-- MOST IMPORTANT Ribbon -->
      <g filter="url(#shadow)">
        <rect x="50" y="136" width="540" height="66" rx="8" fill="#FFFFFF"/>
        <text x="320" y="184" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="44" font-weight="900" fill="#D32F2F" letter-spacing="2">MOST IMPORTANT</text>
      </g>

      <!-- Hero 3D Title in Vibrant Green -->
      <g filter="url(#shadow)">
        <text x="320" y="300" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="104" font-weight="900" fill="#00E676" stroke="#003311" stroke-width="6" paint-order="stroke fill" letter-spacing="3">${this.escapeHtml(subjectEng.toUpperCase())}</text>
      </g>

      <!-- Category Banner: GK QUESTIONS -->
      <g filter="url(#shadow)">
        <rect x="40" y="330" width="570" height="74" rx="12" fill="#FFD600"/>
        <text x="325" y="382" text-anchor="middle" font-family="Arial Black, Impact, sans-serif" font-size="52" font-weight="900" fill="#111111" letter-spacing="2">GK QUESTIONS</text>
      </g>

      <!-- Checklist Notepad (Bottom Left) -->
      <g filter="url(#shadow)">
        <rect x="40" y="430" width="310" height="260" rx="12" fill="#FBFBFB" stroke="#CCCCCC" stroke-width="2"/>
        <rect x="40" y="430" width="310" height="18" rx="4" fill="#E0E0E0"/>
        
        <g transform="translate(60, 480)" font-family="Arial, sans-serif" font-size="20" font-weight="800">
          ${listHtml}
        </g>
      </g>

      <!-- Must Watch Red Badge with Arrow -->
      <g filter="url(#shadow)">
        <rect x="375" y="520" width="220" height="60" rx="30" fill="#D32F2F"/>
        <text x="485" y="558" text-anchor="middle" font-family="Arial Black, sans-serif" font-size="26" font-weight="900" fill="#FFFFFF">Must Watch!</text>
        <path d="M 375,550 L 350,560 L 375,570 Z" fill="#D32F2F"/>
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
