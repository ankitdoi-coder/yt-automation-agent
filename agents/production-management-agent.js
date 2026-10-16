const path = require('path');
const fs = require('fs').promises;
const { Logger } = require('../utils/logger');
const { AIVideoGenerator } = require('../utils/ai-video-generator');
const { SceneRepairService } = require('../utils/scene-repair-service');

class ProductionManagementAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('ProductionManagement');
    this.pipeline = [];
    this.assets = new Map();
    this.aiVideoGenerator = new AIVideoGenerator(credentials, { db });
    this.sceneRepair = new SceneRepairService(db, this.aiVideoGenerator, { logger: this.logger });
  }

  async initialize() {
    this.logger.info('Initializing Production Management Agent...');
    await this.setupDirectories();
    await this.loadPipeline();
    return true;
  }

  async setupDirectories() {
    const dirs = [
      'data/production',
      'data/assets',
      'data/videos',
      'data/audio',
      'data/scripts',
      'temp/processing'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(__dirname, '..', dir), { recursive: true });
    }
  }

  async loadPipeline() {
    try {
      const pipeline = await this.db.getProductionPipeline();
      this.pipeline = pipeline || [];
    } catch (error) {
      this.logger.warn('No existing pipeline found, starting fresh');
    }
  }

  async processContent(contentData) {
    try {
      this.logger.info('Processing content for production...');
      
      const { strategy, script, thumbnail, seo, jobId = null } = contentData;
      
      // Create production entry
      const productionId = this.generateProductionId();
      
      const productionData = {
        id: productionId,
        strategy,
        script,
        thumbnail,
        seo,
        status: 'processing',
        assets: {
          script: await this.processScript(script),
          thumbnail: await this.processThumbnail(thumbnail, script),
          audio: null, // Will be generated later
          video: null, // Will be generated later
          captions: null // Will be generated later
        },
        timeline: {
          created: new Date().toISOString(),
          scriptReady: new Date().toISOString(),
          thumbnailReady: new Date().toISOString(),
          audioGenerated: null,
          videoGenerated: null,
          captionsGenerated: null,
          readyForUpload: null
        },
        scheduledPublishTime: this.calculatePublishTime(strategy),
        priority: this.calculatePriority(strategy),
        estimatedDuration: script.duration,
        createdAt: new Date().toISOString()
      };
      productionData.jobId = jobId;
      
      // Add to pipeline
      this.pipeline.push(productionData);
      
      // Save to database
      await this.db.saveProductionData(productionData);
      
      // Generate video content
      await this.generateVideoContent(productionData);
      
      // Generate audio narration
      await this.generateAudioNarration(productionData);
      
      // Generate captions
      await this.generateCaptions(productionData);
      
      // Final assembly
      await this.assembleVideo(productionData);

      // Persist a scene-addressable production manifest for selective review and repair.
      await this.sceneRepair.initializeProduction(productionData, this.aiVideoGenerator.lastVideoResult || {});

      // Mark as ready — or simulated, when no real video could be produced
      const simulated = Boolean(productionData.assets.finalVideo?.simulated);
      if (simulated) {
        productionData.status = 'simulated';
        this.logger.warn(`Content ${productionId} produced PLACEHOLDER assets only — it will NOT be uploaded. Check your AI provider keys and FFmpeg installation.`);
      } else {
        productionData.status = 'ready';
        productionData.timeline.readyForUpload = new Date().toISOString();
      }

      await this.db.updateProductionData(productionData);

      this.logger.info(`Content processing complete: ${productionId} (status: ${productionData.status})`);
      return productionData;
    } catch (error) {
      this.logger.error('Failed to process content:', error);
      throw error;
    }
  }

  generateProductionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extra = Math.random().toString(36).substring(2, 15);
    return `prod_${timestamp}_${random}_${extra}`;
  }

  async processScript(script) {
    const scriptPath = path.join(__dirname, '..', 'data', 'scripts', `${Date.now()}_script.json`);
    
    // Create formatted script for TTS
    const ttsScript = this.formatScriptForTTS(script);
    
    // Save script files
    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));
    await fs.writeFile(
      scriptPath.replace('.json', '_tts.txt'), 
      ttsScript
    );
    
    return {
      originalPath: scriptPath,
      ttsPath: scriptPath.replace('.json', '_tts.txt'),
      duration: script.duration,
      sections: script.quiz?.totalQuestions || script.mainContent.sections.length
    };
  }

  formatScriptForTTS(script) {
    if (script.quiz?.questions?.length) {
      return this.formatQuizScriptForTTS(script);
    }

    let ttsText = '';
    
    // Add hook
    if (script.hook) {
      ttsText += `${script.hook.text}\n\n`;
    }
    
    // Add introduction
    if (script.introduction) {
      if (Array.isArray(script.introduction.lines)) {
        ttsText += `${script.introduction.lines.join('\n')}\n\n`;
      } else {
        ttsText += `${script.introduction.greeting}\n`;
        ttsText += `${script.introduction.topicIntro}\n`;
        ttsText += `${script.introduction.valueProposition}\n`;
        ttsText += `${script.introduction.credibility}\n\n`;
      }
    }

    // Add main content
    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach((section, index) => {
        // The AI script writes its own spoken transitions; a robotic
        // "Section 6: Real-World Examples" header reads badly aloud.
        if (script.metadata?.generationSource !== 'ai') {
          ttsText += `Section ${index + 1}: ${section.title}\n`;
        }
        
        if (Array.isArray(section.content)) {
          section.content.forEach(line => {
            if (typeof line === 'string' && !line.startsWith('[')) {
              ttsText += `${line}\n`;
            }
          });
        } else if (section.steps) {
          section.steps.forEach(step => {
            ttsText += `${step.title}. ${step.description}\n`;
            ttsText += `${step.tip}\n`;
          });
        } else if (section.items) {
          section.items.forEach(item => {
            ttsText += `Number ${item.number}: ${item.title}. ${item.description}\n`;
          });
        } else if (typeof section.content === 'string') {
          ttsText += `${section.content}\n`;
        }
        
        ttsText += '\n';
      });
    }
    
    // Add conclusion
    if (script.conclusion) {
      script.conclusion.recap.forEach(line => {
        if (typeof line === 'string' && !line.trim().startsWith('[')) {
          ttsText += `${line}\n`;
        }
      });
      ttsText += `\n${script.conclusion.finalThought}\n\n`;
    }
    
    // Add CTA
    if (script.callToAction) {
      ttsText += `${script.callToAction.subscribe}\n`;
      ttsText += `${script.callToAction.like}\n`;
      ttsText += `${script.callToAction.comment}\n`;
    }
    
    return ttsText;
  }

  // Quiz narration: strictly implements the user's GK Quiz voice-over script format:
  // "आपका पहला सवाल है— [Question]\nइसका सही जवाब है— [Answer]" etc.
  // Options are shown on screen only and are NOT read aloud.
  formatQuizScriptForTTS(script) {
    const quiz = script.quiz || {};
    const language = quiz.language === 'en' ? 'en' : 'hi';
    const { formatStrictQuizScript, introNarration } = require('../utils/quiz-narration');
    const questions = quiz.questions || [];
    const subject = quiz.subjectHindi || quiz.subject || 'सामान्य ज्ञान';
    const introText = script.hook?.text || introNarration(subject, questions.length, language);
    return formatStrictQuizScript(questions, language, { introText, subject });
  }

  async processThumbnail(thumbnail, script) {
    try {
      // If ThumbnailDesignerAgent already generated a valid image thumbnail, preserve and use it!
      if (thumbnail && thumbnail.path) {
        const ext = path.extname(thumbnail.path).toLowerCase();
        if (['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
          const exists = await fs.access(thumbnail.path).then(() => true).catch(() => false);
          if (exists) {
            this.logger.info(`Using generated thumbnail: ${thumbnail.path}`);
            return {
              path: thumbnail.path,
              originalPath: thumbnail.path,
              dimensions: thumbnail.dimensions || { width: 1280, height: 720 },
              fileSize: thumbnail.fileSize || 0,
              generatedWith: thumbnail.concept ? 'ThumbnailDesigner' : 'AI'
            };
          }
        }
      }

      // Otherwise try to generate AI thumbnail
      const thumbnailScript = thumbnail.script || script || { title: thumbnail.title || 'Untitled Video' };
      const aiThumbnail = await this.aiVideoGenerator.generateThumbnail(thumbnailScript, 'ethereal');
      
      return {
        path: aiThumbnail.path,
        originalPath: thumbnail?.path || aiThumbnail.path,
        dimensions: aiThumbnail.dimensions,
        fileSize: aiThumbnail.fileSize,
        generatedWith: 'AI'
      };
    } catch (error) {
      this.logger.error('AI thumbnail generation failed:', error);
      
      // Fallback to original processing
      const productionThumbnailPath = path.join(
        __dirname, '..', 'data', 'assets', 
        `thumbnail_${Date.now()}.jpg`
      );
      
      if (thumbnail.path && await fs.access(thumbnail.path).then(() => true).catch(() => false)) {
        const originalBuffer = await fs.readFile(thumbnail.path);
        await fs.writeFile(productionThumbnailPath, originalBuffer);
      } else {
        // Create placeholder
        await fs.writeFile(productionThumbnailPath + '.placeholder', 'Thumbnail placeholder');
      }
      
      return {
        path: productionThumbnailPath,
        originalPath: thumbnail.path,
        dimensions: thumbnail.dimensions || { width: 1792, height: 1024 },
        fileSize: thumbnail.fileSize || 0
      };
    }
  }

  calculatePublishTime(strategy) {
    if (strategy.bestPublishTime) {
      return strategy.bestPublishTime;
    }
    
    const isShort = Boolean(
      strategy.isShort ||
      String(strategy.contentType || '').toLowerCase().includes('short') ||
      String(strategy.requestedStyle || '').toLowerCase().includes('short')
    );

    const now = new Date();
    // Indian Standard Time is UTC + 5:30.
    // Optimal study hours:
    // Long-form: 7:00 PM IST = 13:30 UTC
    // Shorts: 8:00 AM IST = 02:30 UTC, 1:00 PM IST = 07:30 UTC, 8:30 PM IST = 15:00 UTC
    const targetDate = new Date(now);

    if (isShort) {
      const shortSlotsUTC = [
        { hour: 2, minute: 30 },   // 8:00 AM IST
        { hour: 7, minute: 30 },   // 1:00 PM IST
        { hour: 15, minute: 0 }    // 8:30 PM IST
      ];
      // Collect already scheduled Short publish times to prevent slot collisions
      const scheduledShortTimes = new Set(
        (this.pipeline || [])
          .filter(p => p.scheduledPublishTime && (p.strategy?.isShort || String(p.strategy?.contentType || '').includes('short')))
          .map(p => new Date(p.scheduledPublishTime).getTime())
      );

      // Pick next available slot that is at least 45 minutes in the future and not already taken
      let found = null;
      for (let dayOffset = 0; dayOffset <= 7 && !found; dayOffset++) {
        for (const slot of shortSlotsUTC) {
          const candidate = new Date(now);
          candidate.setUTCDate(now.getUTCDate() + dayOffset);
          candidate.setUTCHours(slot.hour, slot.minute, 0, 0);
          const timeMs = candidate.getTime();
          if (timeMs - now.getTime() > 45 * 60 * 1000) {
            const isColliding = Array.from(scheduledShortTimes).some(st => Math.abs(st - timeMs) < 90 * 60 * 1000);
            if (!isColliding) {
              found = candidate;
              break;
            }
          }
        }
      }
      return (found || new Date(now.getTime() + 2 * 60 * 60 * 1000)).toISOString();
    }

    // Long-form video: strictly 1 video per day at 7:00 PM IST = 13:30 UTC to prevent feed flooding
    const scheduledLongDates = new Set(
      (this.pipeline || [])
        .filter(p => p.scheduledPublishTime && !p.strategy?.isShort && !String(p.strategy?.contentType || '').includes('short'))
        .map(p => {
          const d = new Date(p.scheduledPublishTime);
          return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
        })
    );

    const candidateLong = new Date(now);
    candidateLong.setUTCHours(13, 30, 0, 0);
    if (candidateLong.getTime() - now.getTime() < 45 * 60 * 1000) {
      // If 7:00 PM IST today has already passed, schedule for tomorrow
      candidateLong.setUTCDate(candidateLong.getUTCDate() + 1);
    }
    // Prevent flooding: If candidate date is already occupied by a long-form video, push to next day
    for (let dayOffset = 0; dayOffset <= 14; dayOffset++) {
      const dateKey = `${candidateLong.getUTCFullYear()}-${candidateLong.getUTCMonth()}-${candidateLong.getUTCDate()}`;
      if (!scheduledLongDates.has(dateKey)) {
        break;
      }
      candidateLong.setUTCDate(candidateLong.getUTCDate() + 1);
    }
    return candidateLong.toISOString();
  }

  calculatePriority(strategy) {
    let priority = 50; // Base priority
    
    // Adjust based on estimated views
    if (strategy.estimatedViews > 100000) priority += 30;
    else if (strategy.estimatedViews > 50000) priority += 20;
    else if (strategy.estimatedViews > 10000) priority += 10;
    
    // Adjust based on trend score
    if (strategy.competitorAnalysis && strategy.competitorAnalysis.length > 0) {
      priority += 10;
    }
    
    // Time sensitivity
    const hoursUntilPublish = (new Date(strategy.bestPublishTime) - new Date()) / (1000 * 60 * 60);
    if (hoursUntilPublish < 24) priority += 20;
    else if (hoursUntilPublish < 48) priority += 10;
    
    return Math.min(100, priority);
  }

  async generateVideoContent(productionData) {
    this.logger.info('Generating AI video content...');
    
    try {
      const { script } = productionData;

      // Quiz videos:
      // - Standard 'quiz': pure typography slides (question + options + answer) on MCQ template
      // - 'quiz_visuals': generates answer-related AI images for ~50% of questions
      if (script.quiz?.questions?.length) {
        const isQuizShort = Boolean(
          script.isShort ||
          script.quizShort ||
          String(productionData.strategy?.contentType || '').toLowerCase() === 'quiz_short' ||
          String(productionData.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short' ||
          String(productionData.strategy?.contentType || '').toLowerCase() === 'quiz_short_no_image' ||
          String(productionData.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short_no_image'
        );
        const isExplicitQuizVisuals = Boolean(
          script.quizVisuals ||
          String(productionData.strategy?.contentType || '').toLowerCase() === 'quiz_visuals' ||
          String(productionData.strategy?.requestedStyle || '').toLowerCase() === 'quiz_visuals'
        );
        // User design mandate: Both Shorts and Long videos default to pure typography without AI images.
        // AI image generation is strictly reserved for YouTube thumbnails.
        const isQuizShortNoImage = isQuizShort && !isExplicitQuizVisuals;
        const isQuizVisuals = !isQuizShortNoImage && isExplicitQuizVisuals;

        if (isQuizShortNoImage) {
          // Dedicated Short Quiz WITHOUT visuals: zero image generation, pure typography layout
          this.logger.info('Short Quiz (Without Visuals) mode selected — skipping image generation.');
          productionData.assets.video = {
            visualAssets: [],
            duration: productionData.estimatedDuration,
            format: 'mp4',
            resolution: '1080x1920',
            fps: 30,
            generatedWith: 'quiz-short-no-image-template'
          };
          productionData.timeline.videoGenerated = new Date().toISOString();
          return [];
        }

        if (!isQuizVisuals) {
          // Standard Quiz (completely untouched)
          productionData.assets.video = {
            visualAssets: [],
            duration: productionData.estimatedDuration,
            format: 'mp4',
            resolution: '1920x1080',
            fps: 30,
            generatedWith: 'quiz-template'
          };
          productionData.timeline.videoGenerated = new Date().toISOString();
          return [];
        }

        // Quiz + Visuals & Quiz Short mode: generate answer visuals for every question
        this.logger.info(`Generating AI answer visuals for ${isQuizShort ? 'Quiz Short (9:16)' : 'Quiz + Visuals'} mode (all questions)...`);
        const visualAssets = [];
        for (let i = 0; i < script.quiz.questions.length; i++) {
          const q = script.quiz.questions[i];
          const answerOption = (q.options || [])[q.answerIndex] || '';
          const prompt = this.buildContextAwareVisualPrompt(q);
          this.logger.info(`Question ${i + 1} visual prompt: "${prompt}"`);
          try {
            const assets = await this.aiVideoGenerator.generateVisualAssets(prompt, 'quiz_visuals', 1);
            if (assets && assets[0]) {
              q.visualImage = assets[0];
              visualAssets.push(assets[0]);
              this.logger.info(`Generated visual for Quiz Question ${i + 1} (${answerOption}): ${assets[0]}`);
            }
          } catch (err) {
            this.logger.warn(`Could not generate visual for quiz question ${i + 1}: ${err.message}`);
          }
        }

        productionData.assets.video = {
          visualAssets: visualAssets,
          duration: productionData.estimatedDuration,
          format: 'mp4',
          resolution: isQuizShort ? '1080x1920' : '1920x1080',
          fps: 30,
          generatedWith: isQuizShort ? 'quiz-short-template' : 'quiz-visuals-template'
        };
        productionData.timeline.videoGenerated = new Date().toISOString();
        return visualAssets;
      }
      
      // Generate visual assets using DALL-E
      const visualPrompts = this.createVisualPromptsFromScript(script);
      const visualAssets = [];
      const profile = await this.db.getChannelProfile?.() || {};
      // Dreamy "ethereal" art is wrong for teaching content; only use it when the
      // channel explicitly set it, otherwise pick a style that fits the format.
      const visualStyle = profile.visual_style || this.defaultVisualStyleFor(script);
      
      for (const prompt of visualPrompts) {
        const assets = await this.aiVideoGenerator.generateVisualAssets(prompt, visualStyle, 1);
        visualAssets.push(...assets);
      }
      
      productionData.assets.video = {
        visualAssets: visualAssets,
        duration: productionData.estimatedDuration,
        format: 'mp4',
        resolution: '1920x1080',
        fps: 30,
        generatedWith: 'AI'
      };
      
      productionData.timeline.videoGenerated = new Date().toISOString();
      
      return visualAssets;
    } catch (error) {
      this.logger.error('AI video content generation failed:', error);
      // Fallback to placeholder
      return await this.createVideoElements(productionData);
    }
  }

  async createVideoElements(productionData) {
    const { script } = productionData;
    const elements = [];
    
    // Title slide
    elements.push({
      type: 'title_slide',
      content: script.title,
      duration: 3,
      style: 'modern',
      animation: 'fade_in'
    });
    
    // Content sections
    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach((section) => {
        // Section title
        elements.push({
          type: 'section_title',
          content: section.title,
          duration: 2,
          style: 'minimal',
          animation: 'slide_in'
        });
        
        // Content visuals
        if (section.type === 'list_items' && section.items) {
          section.items.forEach(item => {
            elements.push({
              type: 'list_item',
              content: {
                number: item.number,
                title: item.title,
                description: item.description
              },
              duration: 15,
              style: 'countdown',
              animation: 'zoom_in'
            });
          });
        } else if (section.type === 'solution_steps' && section.steps) {
          section.steps.forEach(step => {
            elements.push({
              type: 'step',
              content: {
                number: step.number,
                title: step.title,
                description: step.description
              },
              duration: 20,
              style: 'tutorial',
              animation: 'step_by_step'
            });
          });
        } else {
          // Generic content slide
          elements.push({
            type: 'content_slide',
            content: section.title,
            duration: section.duration || 30,
            style: 'informative',
            animation: 'fade_transition'
          });
        }
      });
    }
    
    // Conclusion slide
    elements.push({
      type: 'conclusion',
      content: 'Key Takeaways',
      duration: 5,
      style: 'summary',
      animation: 'reveal'
    });
    
    // Subscribe reminder
    elements.push({
      type: 'subscribe_reminder',
      content: 'Subscribe for More!',
      duration: 3,
      style: 'call_to_action',
      animation: 'bounce'
    });
    
    return elements;
  }

  async generateAudioNarration(productionData) {
    this.logger.info('Generating AI audio narration...');
    
    try {
      const audioPath = path.join(__dirname, '..', 'data', 'audio', `${productionData.id}_narration.mp3`);
      
      // Read the TTS script
      const ttsText = await fs.readFile(productionData.assets.script.ttsPath, 'utf8');
      
      let generatedPath;
      let slideDurations = null;
      if (productionData.script?.quiz?.questions?.length) {
        this.logger.info('Generating slide-synchronized quiz narration audio...');
        const quizAudioResult = await this.aiVideoGenerator.generateQuizAudio(
          productionData.script,
          audioPath,
          { productionId: productionData.id }
        );
        generatedPath = quizAudioResult.audioPath;
        slideDurations = quizAudioResult.slideDurations;
      } else {
        generatedPath = await this.aiVideoGenerator.generateTTSAudio(ttsText, audioPath);
      }

      const evidence = this.aiVideoGenerator.lastNarrationResult || {};
      const usable = await this.aiVideoGenerator.isUsableAudioFile(generatedPath);

      productionData.assets.audio = {
        path: generatedPath,
        duration: slideDurations
          ? slideDurations.reduce((sum, d) => sum + d, 0)
          : productionData.estimatedDuration,
        slideDurations: slideDurations || null,
        format: 'mp3',
        generatedWith: 'AI',
        quality: usable ? 'high' : null,
        status: usable ? 'ready' : 'unavailable',
        simulated: !usable,
        provider: evidence.provider || null,
        model: evidence.model || null,
        externalTaskId: evidence.externalTaskId || null,
        generatedAt: evidence.generatedAt || new Date().toISOString(),
        cost: evidence.cost || {},
        error: usable ? null : 'No live narration provider returned usable audio',
        intentionalSilence: false
      };

      if (usable) productionData.timeline.audioGenerated = new Date().toISOString();
      return generatedPath;
    } catch (error) {
      this.logger.error('AI audio generation failed:', error);
      return await this.simulateAudioGeneration(productionData, error);
    }
  }

  async generateCaptions(productionData) {
    this.logger.info('Generating captions...');
    
    const captionsPath = path.join(__dirname, '..', 'data', 'captions', `${productionData.id}_captions.srt`);
    
    // Generate SRT captions based on script timing
    const captions = await this.createSRTCaptions(productionData);
    
    await fs.mkdir(path.dirname(captionsPath), { recursive: true });
    await fs.writeFile(captionsPath, captions);
    
    productionData.assets.captions = {
      path: captionsPath,
      format: 'srt',
      language: 'en',
      autoGenerated: true
    };
    
    productionData.timeline.captionsGenerated = new Date().toISOString();
    
    return captionsPath;
  }

  async createSRTCaptions(productionData) {
    const { script } = productionData;
    let srt = '';
    let captionIndex = 1;
    let currentTime = 0;
    
    // Helper function to format time for SRT
    const formatSRTTime = (seconds) => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`;
    };
    
    // Process script sections for captions
    const processText = (text, startTime, duration) => {
      const words = String(text || '').trim().split(/\s+/).filter(Boolean);
      const wordsPerCaption = 8; // Optimal words per caption
      if (!words.length) return;
      
      for (let i = 0; i < words.length; i += wordsPerCaption) {
        const captionWords = words.slice(i, i + wordsPerCaption);
        const count = Math.ceil(words.length / wordsPerCaption);
        const captionDuration = duration / count;
        const captionStartTime = startTime + (i / words.length) * duration;
        const captionEndTime = captionStartTime + captionDuration;
        
        srt += `${captionIndex}\n`;
        srt += `${formatSRTTime(captionStartTime)} --> ${formatSRTTime(captionEndTime)}\n`;
        srt += `${captionWords.join(' ')}\n\n`;
        
        captionIndex++;
      }
    };

    if (script.quiz?.questions?.length) {
      const slides = this.aiVideoGenerator.buildQuizSlideData(script);
      const durations = productionData.assets.audio?.slideDurations || [];
      for (let i = 0; i < slides.length; i++) {
        const slide = slides[i];
        const dur = durations[i] || slide.estimatedSpeechDuration || 5;
        const text = slide.narrationText || '';
        const speechDur = Math.max(1.0, dur - (Number(slide.pauseAfter) || 0));
        processText(text, currentTime, speechDur);
        currentTime += dur;
      }
      return srt;
    }
    
    // Hook
    if (script.hook && script.hook.text) {
      processText(script.hook.text, currentTime, 5);
      currentTime += 5;
    }
    
    // Introduction
    if (script.introduction) {
      const introText = `${script.introduction.greeting} ${script.introduction.topicIntro} ${script.introduction.valueProposition}`;
      processText(introText, currentTime, 15);
      currentTime += 15;
    }
    
    // Main content
    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach(section => {
        let sectionText = '';
        
        if (Array.isArray(section.content)) {
          sectionText = section.content.filter(line => 
            typeof line === 'string' && !line.startsWith('[')
          ).join(' ');
        } else if (section.steps) {
          sectionText = section.steps.map(step => 
            `${step.title}. ${step.description}`
          ).join(' ');
        } else if (section.items) {
          sectionText = section.items.map(item => 
            `Number ${item.number}: ${item.title}. ${item.description}`
          ).join(' ');
        } else if (typeof section.content === 'string') {
          sectionText = section.content;
        }
        
        if (sectionText) {
          processText(sectionText, currentTime, section.duration || 60);
          currentTime += section.duration || 60;
        }
      });
    }
    
    // Conclusion
    if (script.conclusion) {
      const conclusionText = script.conclusion.recap.join(' ') + ' ' + script.conclusion.finalThought;
      processText(conclusionText, currentTime, 30);
      currentTime += 30;
    }
    
    return srt;
  }

  async assembleVideo(productionData) {
    this.logger.info('Assembling final AI-generated video...');
    
    try {
      const finalVideoPath = path.join(__dirname, '..', 'data', 'videos', `${productionData.id}_final.mp4`);
      const narrationReady = await this.aiVideoGenerator.isUsableAudioFile(productionData.assets.audio?.path);
      if (!narrationReady && productionData.assets.audio?.intentionalSilence !== true) {
        this.logger.warn('Final assembly is blocked until narration succeeds or the operator explicitly confirms an intentional silent video.');
        return await this.simulateVideoAssembly(productionData, 'Narration is missing');
      }

      // Use AI Video Generator to create the final video
      const producedPath = await this.aiVideoGenerator.generateVideo(
        productionData.script,
        productionData.assets.video.visualAssets || [],
        productionData.assets.audio.path,
        finalVideoPath,
        {
          jobId: productionData.jobId,
          productionId: productionData.id,
          estimatedDuration: productionData.assets.audio?.duration || productionData.estimatedDuration,
          durations: productionData.assets.audio?.slideDurations || null
        }
      );

      // The generator falls back to a placeholder .info file when it cannot render
      if (!producedPath || path.extname(producedPath).toLowerCase() !== '.mp4') {
        return await this.simulateVideoAssembly(productionData);
      }

      // Get file stats
      const stats = await fs.stat(finalVideoPath);
      
      const isQuizShort = Boolean(
        productionData.script?.isShort ||
        productionData.script?.quizShort ||
        String(productionData.strategy?.contentType || '').toLowerCase() === 'quiz_short' ||
        String(productionData.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short' ||
        String(productionData.strategy?.contentType || '').toLowerCase() === 'quiz_short_no_image' ||
        String(productionData.strategy?.requestedStyle || '').toLowerCase() === 'quiz_short_no_image'
      );

      productionData.assets.finalVideo = {
        path: finalVideoPath,
        fileSize: stats.size,
        duration: productionData.estimatedDuration,
        generatedWith: 'AI',
        resolution: isQuizShort ? '1080x1920' : '1920x1080',
        format: 'mp4',
        provider: this.aiVideoGenerator.lastVideoResult || { actualProvider: 'slideshow', model: 'local-ffmpeg' }
      };
      productionData.containsSyntheticMedia = Boolean(
        this.aiVideoGenerator.lastVideoResult?.actualProvider &&
        !['slideshow', 'simulation'].includes(this.aiVideoGenerator.lastVideoResult.actualProvider)
      );
      
      this.logger.info('AI video assembly complete');
      return finalVideoPath;
    } catch (error) {
      this.logger.error('AI video assembly failed:', error);
      // Fallback to simulation
      return await this.simulateVideoAssembly(productionData);
    }
  }

  async getPipelineStatus() {
    return this.pipeline.map(item => ({
      id: item.id,
      title: item.script?.title || 'Untitled',
      status: item.status,
      priority: item.priority,
      scheduledPublishTime: item.scheduledPublishTime,
      progress: this.calculateProgress(item)
    }));
  }

  calculateProgress(productionData) {
    const milestones = [
      'scriptReady',
      'thumbnailReady',
      'audioGenerated',
      'videoGenerated',
      'captionsGenerated',
      'readyForUpload'
    ];
    
    const completed = milestones.filter(milestone => 
      productionData.timeline[milestone] !== null
    ).length;
    
    return Math.round((completed / milestones.length) * 100);
  }

  async getNextReadyContent() {
    const ready = this.pipeline
      .filter(item => item.status === 'ready')
      .sort((a, b) => b.priority - a.priority);
    
    return ready[0] || null;
  }

  defaultVisualStyleFor(script) {
    const contentType = String(script.metadata?.strategy?.contentType || '').toLowerCase();
    if (['explainer', 'tutorial', 'review'].includes(contentType)) {
      return 'educational';
    }
    return 'ethereal';
  }

  buildContextAwareVisualPrompt(q) {
    if (q.visualPrompt && q.visualPrompt.trim().length > 10) {
      return q.visualPrompt.trim();
    }

    const answerOption = (q.options || [])[q.answerIndex] || '';
    const explanation = q.explanation || '';
    const question = q.question || '';
    const combined = `${answerOption} ${explanation} ${question}`.toLowerCase();
    const optLower = answerOption.toLowerCase();

    // 1. Geography / State / River / City / Place
    const isGeoAnswer = /(राज्य|शहर|देश|नदी|पर्वत|पहाड़|महासागर|घाटी|राजधानी|bihar|delhi|mumbai|state|city|river|mountain|lake|valley)/i.test(optLower) ||
      /(बिहार|उत्तर प्रदेश|मध्य प्रदेश|राजस्थान|गुजरात|महाराष्ट्र|पंजाब|हरियाणा|बंगाल|केरल|तमिलनाडु|कर्नाटक|ओडिशा|असम|कश्मीर)/i.test(optLower);

    if (isGeoAnswer) {
      const landmarkDetail = explanation ? ` Context: ${explanation}.` : '';
      return `Scenic documentary geographic landscape or heritage photo of ${answerOption}.${landmarkDetail} Authentic geography of India, natural daylight, National Geographic style`;
    }

    // 2. Person: check answerOption first, or question specifically asks about a person/leader
    const isPersonAnswer = /(वायसराय|गवर्नर|राजा|सम्राट|सुल्तान|शासक|प्रधान\s*मंत्री|राष्ट्रपति|लेखक|कवि|वैज्ञानिक|महात्मा|गुरु|भगत|शास्त्री|नेहरू|गांधी|अम्बेडकर|लॉर्ड|डॉ\.|स्वामी|viceroy|governor|emperor|king|president|prime minister|leader|scientist|author|poet|lord|dr\.|swami)/i.test(optLower) ||
      /(किसने|किस शासक|किस राजा|किस वायसराय|किस गवर्नर|किस वैज्ञानिक|किसने की थी|संस्थापक कौन|अध्यक्ष कौन|who was|who is)/i.test(question);

    if (isPersonAnswer) {
      return `Historical archival portrait photograph or classic realistic painting of ${answerOption}, formal historical attire, authentic facial features, dignitary portrait, documentary museum quality`;
    }

    // 3. Battle / War / Revolt / Movement / Incident
    const isEvent = /(युद्ध|लड़ाई|आंदोलन|क्रांति|विद्रोह|घटना|कांड|सत्याग्रह|मार्च|बैठक|संधि|battle|war|revolt|movement|incident|massacre|treaty|revolution)/i.test(combined);
    if (isEvent) {
      return `Historical archival reenactment painting or illustration depicting ${answerOption || question}, dramatic Indian history scene, authentic era setting, atmospheric lighting`;
    }

    // 4. Constitution / Law / Article / Parliament / Government
    const isLegal = /(संविधान|अनुच्छेद|अनुसूची|धारा|संशोधन|संसद|न्यायालय|कानून|अधिनियम|constitution|article|schedule|amendment|parliament|court|act)/i.test(combined);
    if (isLegal) {
      return `Parchment manuscript of the Constitution of India with official Lion Capital emblem of Ashoka, gold emblem seal, legal calligraphy document, dignified national presentation`;
    }

    // 5. Science / Biology / Anatomy / Space / Planet
    const isScience = /(ग्रह|सूर्य|चंद्रमा|तारा|कोशिका|रक्त|ग्रंथि|अंग|यकृत|हृदय|परमाणु|धातु|गैस|planet|solar system|moon|cell|organ|liver|heart|element|chemical|dna)/i.test(combined);
    if (isScience) {
      return `Scientific educational 3D anatomical or documentary photo representing ${answerOption}, high resolution, scientific accuracy, clean background`;
    }

    // 6. Specific Historical Concept / Dynasty / Inscription / Coin / Book / Art
    const isCulturalArtifact = /(सिक्का|अभिलेख|स्तंभ|शिलालेख|मुद्रा|ग्रंथ|पुस्तक|रचना|दर्पण|coin|inscription|pillar|edict|manuscript|book|literature|dynasty|वंश)/i.test(combined);
    if (isCulturalArtifact) {
      return `Museum archival artifact photograph of authentic ancient Indian ${answerOption || question}, historical Gupta or Maurya era artifact, clean museum presentation, macro detail lighting`;
    }

    // 7. Temple / Fort / Palace / Cave / Monument / Architecture / Ruins (ONLY when explicitly a monument)
    const isMonument = /(मंदिर|किला|महल|स्तूप|गुफा|मकबरा|मस्जिद|इमारत|मीनार|खंडहर|temple|fort|palace|cave|stupa|tomb|monument|ruins)/i.test(optLower);
    if (isMonument) {
      return `Architectural documentary photograph of ${answerOption}, historic Indian heritage site, majestic daylight view, authentic craftsmanship`;
    }

    // 8. General Geography / Mountain / River fallback
    const isGeography = /(नदी|पर्वत|पहाड़|झील|महासागर|सागर|घाटी|राज्य|जिला|देश|राजधानी|द्वीप|river|mountain|lake|ocean|state|capital|island|geography|map)/i.test(combined);
    if (isGeography) {
      return `Scenic documentary geographic landscape photograph of ${answerOption}, authentic terrain, natural daylight, National Geographic style`;
    }

    // High quality study material documentary fallback
    const detail = explanation ? ` Context: ${explanation}.` : '';
    return `High quality educational documentary photograph specifically illustrating ${answerOption} in the context of: ${question}.${detail} Authentic historical, scientific or cultural accuracy of India, clear single focal subject, 8k resolution study material visual`;
  }

  // Helper method to create visual prompts from script content
  createVisualPromptsFromScript(script) {
    const prompts = [];
    const topic = script.metadata?.strategy?.topic || script.title || '';

    // Title prompt
    prompts.push(`Bold hero illustration representing ${topic}. Clear visual storytelling, single focal subject`);

    // Content-based prompts. Prefer the per-scene visual direction the script
    // writer produced ("isometric diagram of a load balancer routing requests
    // to four servers"); a bare section title like "Deep Dive" gives the image
    // model nothing to draw.
    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach(section => {
        if (section.visual) {
          prompts.push(`${section.visual}. Context: ${topic}`);
          return;
        }
        const detail = Array.isArray(section.content)
          ? section.content.filter(line => typeof line === 'string' && !line.startsWith('[')).slice(0, 2).join('; ')
          : (typeof section.content === 'string' ? section.content : '');
        if (section.title || detail) {
          prompts.push(`Explanatory illustration of ${section.title || topic}. ${detail}. Concrete subjects and layout, no text, letters or labels in the image`.trim());
        }
      });
    }

    // Ensure we have at least 3 prompts
    while (prompts.length < 3) {
      prompts.push(`${script.title || 'Video topic'}, supporting explanatory visual, concrete subjects, no text in image`);
    }

    return prompts.slice(0, 12); // one usable image per scene
  }

  // Fallback simulation methods
  async simulateAudioGeneration(productionData, failure = null) {
    const audioPath = path.join(__dirname, '..', 'data', 'audio', `${productionData.id}_narration.mp3`);
    
    await fs.writeFile(audioPath + '.info', JSON.stringify({
      message: 'AI TTS audio would be generated here',
      timestamp: new Date().toISOString()
    }, null, 2));
    
    productionData.assets.audio = {
      path: audioPath + '.info',
      duration: productionData.estimatedDuration,
      format: 'mp3',
      status: 'unavailable',
      simulated: true,
      provider: this.aiVideoGenerator.lastNarrationResult?.provider || 'simulation',
      model: this.aiVideoGenerator.lastNarrationResult?.model || null,
      externalTaskId: this.aiVideoGenerator.lastNarrationResult?.externalTaskId || null,
      generatedAt: this.aiVideoGenerator.lastNarrationResult?.generatedAt || new Date().toISOString(),
      cost: this.aiVideoGenerator.lastNarrationResult?.cost || { billed: false },
      error: failure?.message || this.aiVideoGenerator.lastNarrationResult?.error || 'No live narration provider is configured',
      intentionalSilence: false
    };
    
    return audioPath + '.info';
  }

  async simulateVideoAssembly(productionData, reason = null) {
    const finalVideoPath = path.join(__dirname, '..', 'data', 'videos', `${productionData.id}_final.mp4`);
    
    const assemblyInstructions = {
      message: 'AI video would be assembled here',
      blockedReason: reason,
      assets: productionData.assets,
      timestamp: new Date().toISOString()
    };
    
    await fs.writeFile(
      finalVideoPath + '.assembly.json',
      JSON.stringify(assemblyInstructions, null, 2)
    );
    
    productionData.assets.finalVideo = {
      path: finalVideoPath + '.assembly.json',
      fileSize: 0,
      duration: productionData.estimatedDuration,
      simulated: true,
      blockedReason: reason
    };
    
    return finalVideoPath + '.assembly.json';
  }
}

module.exports = { ProductionManagementAgent };
