const { Logger } = require('../utils/logger');
const { AITextService } = require('../utils/ai-text-service');
const {
  getRecentUsedQuestionTexts,
  getUsedQuestionKeysSet,
  isDuplicateQuestion,
  recordGeneratedQuestions
} = require('../utils/quiz-question-deduplicator');

class ScriptWriterAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('ScriptWriter');
    this.templates = this.loadTemplates();
    this.aiTextService = new AITextService(credentials?.credentials || credentials || {});
  }

  async initialize() {
    this.logger.info('Initializing Script Writer Agent...');
    return true;
  }

  loadTemplates() {
    return {
      tutorial: {
        structure: ['hook', 'introduction', 'problem', 'solution_steps', 'demonstration', 'recap', 'cta'],
        tone: 'educational',
        pacing: 'moderate'
      },
      explainer: {
        structure: ['hook', 'question', 'background', 'explanation', 'examples', 'implications', 'summary', 'cta'],
        tone: 'informative',
        pacing: 'steady'
      },
      list: {
        structure: ['hook', 'introduction', 'list_items', 'bonus_item', 'summary', 'cta'],
        tone: 'engaging',
        pacing: 'quick'
      },
      review: {
        structure: ['hook', 'introduction', 'overview', 'pros', 'cons', 'comparison', 'verdict', 'cta'],
        tone: 'analytical',
        pacing: 'detailed'
      },
      story: {
        structure: ['hook', 'setup', 'conflict', 'journey', 'climax', 'resolution', 'lesson', 'cta'],
        tone: 'narrative',
        pacing: 'dynamic'
      },
      quiz: {
        structure: ['hook', 'question_set', 'answer_reveals', 'recap', 'cta'],
        tone: 'energetic',
        pacing: 'quick'
      }
    };
  }

  async generateScript(strategy) {
    try {
      this.logger.info(`Generating script for: ${strategy.topic}`);

      const isQuiz = ['quiz', 'quiz_visuals', 'quiz_short', 'quiz_short_no_image'].includes(String(strategy.contentType || '').toLowerCase());
      const isQuizShortNoImage = String(strategy.contentType || '').toLowerCase() === 'quiz_short_no_image' ||
        String(strategy.requestedStyle || '').toLowerCase() === 'quiz_short_no_image' ||
        Boolean(strategy.noImages);
      const isQuizVisuals = !isQuizShortNoImage && (String(strategy.contentType || '').toLowerCase() === 'quiz_visuals' ||
        String(strategy.requestedStyle || '').toLowerCase() === 'quiz_visuals' ||
        Boolean(strategy.quizVisuals));
      const isQuizShort = isQuizShortNoImage || String(strategy.contentType || '').toLowerCase() === 'quiz_short' ||
        String(strategy.requestedStyle || '').toLowerCase() === 'quiz_short' ||
        Boolean(strategy.isShort);
      const template = this.templates[isQuiz ? 'quiz' : String(strategy.contentType || '').toLowerCase()] || this.templates.explainer;

      if (this.aiTextService.isAvailable()) {
        try {
          const aiScript = isQuiz
            ? await this.generateQuizScriptWithAI(strategy, template)
            : await this.generateScriptWithAI(strategy, template);
          if (!aiScript) {
            const error = new Error('AI script generation returned no result (credits, quota, or provider error)');
            error.code = 'AI_SCRIPT_GENERATION_FAILED';
            error.scriptPhase = 'script-writing';
            throw error;
          }
          if (isQuizVisuals) {
            aiScript.quizVisuals = true;
          }
          if (isQuizShort) {
            aiScript.isShort = true;
            aiScript.quizShort = true;
            aiScript.quizVisuals = !isQuizShortNoImage;
            if (isQuizShortNoImage) {
              aiScript.noImages = true;
              aiScript.quizShortNoImage = true;
            }
          }
          aiScript.fullScript = this.formatFullScript(aiScript);
          await this.db.saveScript(aiScript);
          this.logger.info(`Script generated with AI provider: ${aiScript.title}`);
          return aiScript;
        } catch (error) {
          const strict = process.env.SCRIPT_QUALITY_STRICT === 'true';
          if (isQuiz) {
            // A template fallback cannot invent real exam questions — it would
            // only produce generic filler. Fail loudly instead.
            error.scriptPhase = 'script-writing';
            throw error;
          }
          if (!strict) {
            this.logger.warn(`AI script generation failed; falling back to template: ${error.message}`);
          } else {
            // A filler template video published to the channel is worse than a failed
            // production, so unless the operator opts out, stop here.
            error.scriptPhase = 'script-writing';
            throw error;
          }
        }
      } else if (isQuiz) {
        const error = new Error('Quiz videos need an AI text provider to write real exam questions. Configure GEMINI_API_KEY (or another provider) first.');
        error.code = 'QUIZ_REQUIRES_AI_TEXT_PROVIDER';
        error.scriptPhase = 'script-writing';
        throw error;
      } else {
        this.logger.warn('No AI text provider configured — template fallback produces generic filler content, not a real explainer');
      }

      // Template fallback - wrap in try-catch to prevent job failure if template generation has issues
      try {
        this.logger.info('Using template script generation');
        // Generate script components
        const hook = await this.generateHook(strategy);
        const introduction = await this.generateIntroduction(strategy);
        const mainContent = await this.generateMainContent(strategy, template);
        const conclusion = await this.generateConclusion(strategy);
        const cta = await this.generateCTA(strategy);

        // Assemble complete script
        const script = {
          title: await this.generateTitle(strategy),
          hook,
          introduction,
          mainContent,
          conclusion,
          callToAction: cta,
          duration: this.estimateDuration(mainContent),
          tone: template.tone,
          pacing: template.pacing,
          keywords: strategy.keywords,
          claims: [],
          metadata: {
            strategy: strategy,
            generatedAt: new Date().toISOString(),
            version: '1.0',
            generationSource: 'template-fallback',
            qualityWarnings: [
              'Template fallback: generic filler content with repeated topic mentions.',
              'Configure an AI text provider (see .env.example: OPENROUTER_API_KEY / GEMINI_API_KEY) for real scripts.'
            ]
          }
        };

        // Format for readability
        script.fullScript = this.formatFullScript(script);

        // Save to database
        await this.db.saveScript(script);

        this.logger.info(`Script generated: ${script.title}`);
        return script;
      } catch (templateError) {
        this.logger.error('Template script generation failed:', templateError);
        // As a last resort, return a minimal script to prevent the job from failing completely
        const minimalScript = {
          title: `Fallback script for ${strategy.topic || 'unknown topic'}`,
          hook: { type: 'template', text: `Welcome to this video about ${strategy.topic || 'this topic'}.`, duration: '0:00-0:05' },
          introduction: { 
            greeting: "Hey everyone, welcome back!", 
            topicIntro: `Today, we're talking about ${strategy.topic || 'this topic'}.`, 
            valueProposition: `You'll learn about ${strategy.topic || 'this topic'}.`, 
            credibility: "This is a fallback script due to an error in template generation.", 
            duration: '0:05-0:20' 
          },
          mainContent: { sections: [], totalDuration: 0 },
          conclusion: { type: 'conclusion', title: 'Wrapping Up', recap: [`Thanks for watching!`], finalThought: `See you next time!`, duration: '30 seconds' },
          callToAction: { type: 'call_to_action', subscribe: 'Subscribe for more.', like: 'Like if you learned something.', comment: 'Leave a comment below.', nextVideo: 'Watch the next video.', duration: '15 seconds' },
          duration: '0:50',
          tone: 'informative',
          pacing: 'steady',
          keywords: strategy.keywords || [],
          claims: [],
          metadata: {
            strategy: strategy,
            generatedAt: new Date().toISOString(),
            version: '1.0',
            generationSource: 'minimal-fallback',
            qualityWarnings: [
              'Template generation failed, using minimal fallback.',
              'Check the logs for details on the template generation error.'
            ]
          }
        };
        minimalScript.fullScript = this.formatFullScript(minimalScript);
        // Try to save the minimal script
        try {
          await this.db.saveScript(minimalScript);
        } catch (saveError) {
          this.logger.error('Failed to save minimal script:', saveError);
        }
        this.logger.info('Generated minimal script as fallback');
        return minimalScript;
      }
    } catch (error) {
      this.logger.error('Failed to generate script:', error);
      throw error;
    }
  }

  async generateScriptWithAI(strategy, template) {
    if (!this.aiTextService.isAvailable()) {
      this.logger.info('Using template script generation because no AI text provider is configured');
      return null;
    }

    const prompt = `You are an expert YouTube scriptwriter who makes educational videos as good as the best tech channels on YouTube.
Return only valid JSON with this exact shape:
{
  "title": "compelling title under 100 characters",
  "hook": "opening hook in one specific, curiosity-driving sentence",
  "introduction": ["2-4 short spoken lines that open the video without wasting time"],
  "sections": [
    {
      "title": "section title",
      "onScreen": "3-6 word headline shown big on the slide",
      "content": ["spoken narration, written to be read aloud"],
      "bullets": ["2-4 short on-screen phrases, max 6 words each"],
      "visual": "one-line image prompt describing the concrete diagram or scene to show, e.g. 'isometric diagram of one load balancer routing requests to four identical app servers'",
      "duration": 60
    }
  ],
  "cta": "clear call to action",
  "conclusion": { "recap": ["2-4 specific takeaway lines recalling what was actually taught"], "finalThought": "one memorable closing line" },
  "claims": [
    { "text": "specific factual claim a reviewer must verify", "riskLevel": "standard|high", "sourceUrls": ["exact supplied source URL"] }
  ]
}

Topic: ${strategy.topic}
Style/content type: ${strategy.contentType}
Angle: ${strategy.angle}
Target audience: ${strategy.targetAudience}
Desired length: ${strategy.requestedLength || process.env.DEFAULT_VIDEO_LENGTH || '8-12 minutes'}
Tone: ${template.tone}
Pacing: ${template.pacing}
Brand voice: ${strategy.brandVoice || 'clear, credible, and engaging'}
Channel goal: ${strategy.channelGoal || 'help the viewer understand and act'}
Channel value proposition: ${strategy.channelValueProposition || 'give the viewer practical value'}
Editorial rationale: ${strategy.planRationale || 'fit the selected topic and audience'}
Channel constraints: ${strategy.channelConstraints || 'none beyond the factual-safety rules below'}
Preferred call to action: ${strategy.callToAction || 'invite the viewer to subscribe'}
Keywords: ${(strategy.keywords || []).join(', ')}
Research sources: ${JSON.stringify(strategy.researchSources || [])}

CONTENT RULES — these decide whether the script is accepted:
1. TEACH, DON'T ANNOUNCE. Every section must explain how something actually works: concrete mechanisms, cause and effect, real named systems or examples where relevant, and at least one analogy or concrete scenario per major section. A sentence that could appear in ANY video about ANY topic is a failed sentence.
2. NO REPETITION. Use the exact topic phrase ("${strategy.topic}") at most twice in the entire script. Every section must introduce NEW information. Never restate the intro or a previous section.
3. NO FILLER. Banned: "This section covers...", "Content coming soon...", "It's important to note", "In today's video", "Let's dive in" as a section opener, "The science behind this is fascinating", "versatility and power", "is a journey, not a destination", and any sentence that announces structure instead of teaching.
4. NO PLACEHOLDERS. Never write bracketed placeholders like [Specific case study] or [Detailed explanation with visuals]. Write the actual content.
5. SPOKEN STYLE: conversational, direct, second person. Each section: 80-200 spoken words. Numbers and specifics beat adjectives.
6. SLIDES: "onScreen" max 6 words, "bullets" are fragments not sentences. The narration carries the detail; slides stay skimmable.
7. VISUALS: each "visual" describes ONE concrete drawable scene or diagram with its subjects and layout. No words or letters in the image.

Avoid fabricated statistics, unsupported claims, and fake urgency. List every externally verifiable factual claim in claims. Use only exact URLs from Research sources; use an empty sourceUrls array when the supplied sources do not support a claim.`;

    try {
      const response = await this.withRetries(
        () => this.aiTextService.generateText(prompt, {
          maxTokens: 4096,
          temperature: 0.7
        }),
        `AI script generation (${this.aiTextService.providerName})`
      );
      const parsed = this.parseAIJsonResponse(response);
      const sections = this.normalizeAISections(parsed.sections, strategy);

      if (!parsed.title || !parsed.hook || sections.length === 0) {
        throw new Error('AI script response missing required fields');
      }

      const script = {
        title: String(parsed.title).slice(0, 100),
        hook: this.normalizeAIHook(parsed.hook),
        introduction: this.normalizeAIIntroduction(parsed.introduction),
        mainContent: {
          sections,
          totalDuration: this.calculateSectionsDuration(sections)
        },
        conclusion: this.normalizeAIConclusion(parsed.conclusion, strategy),
        callToAction: this.normalizeAICTA(parsed.cta, strategy),
        duration: this.estimateDuration({ sections }),
        tone: template.tone,
        pacing: template.pacing,
        keywords: strategy.keywords || [],
        claims: this.normalizeAIClaims(parsed.claims, strategy.researchSources || []),
        metadata: {
          strategy,
          generatedAt: new Date().toISOString(),
          version: '1.0',
          generationSource: 'ai'
        }
      };

      // Quality gate: refuse vague, repetitive, or placeholder scripts and give
      // the model one corrective pass listing exactly what was wrong.
      let gate = this.validateScriptQuality(script, strategy);
      if (!gate.passed) {
        this.logger.warn(`Script failed quality gate: ${gate.violations.join(' | ')}`);
        const correctivePrompt = `${prompt}

YOUR PREVIOUS DRAFT WAS REJECTED for these exact problems:
${gate.violations.map(v => `- ${v}`).join('\n')}

Rewrite the full script fixing every one of these problems. Return only the JSON again.`;
        const retryResponse = await this.withRetries(
          () => this.aiTextService.generateText(correctivePrompt, {
            maxTokens: 4096,
            temperature: 0.5
          }),
          'AI script corrective pass'
        );
        const retryParsed = this.parseAIJsonResponse(retryResponse);
        const retrySections = this.normalizeAISections(retryParsed.sections, strategy);
        if (!retryParsed.title || retrySections.length === 0) {
          const error = new Error(`Script quality gate rejected the script after a corrective pass: ${gate.violations.join('; ')}`);
          error.code = 'SCRIPT_QUALITY_REJECTED';
          error.violations = gate.violations;
          throw error;
        }
        script.title = String(retryParsed.title).slice(0, 100);
        script.hook = this.normalizeAIHook(retryParsed.hook);
        script.introduction = this.normalizeAIIntroduction(retryParsed.introduction);
        script.mainContent.sections = retrySections;
        script.mainContent.totalDuration = this.calculateSectionsDuration(retrySections);
        script.conclusion = this.normalizeAIConclusion(retryParsed.conclusion, strategy);
        script.callToAction = this.normalizeAICTA(retryParsed.cta, strategy);
        script.claims = this.normalizeAIClaims(retryParsed.claims, strategy.researchSources || []);
        script.duration = this.estimateDuration({ sections: retrySections });
        gate = this.validateScriptQuality(script, strategy);
        if (!gate.passed) {
          const error = new Error(`Script quality gate still failing after corrective pass: ${gate.violations.join('; ')}`);
          error.code = 'SCRIPT_QUALITY_REJECTED';
          error.violations = gate.violations;
          throw error;
        }
      }

      this.logger.info(`Using AI script generation via ${this.aiTextService.providerName}`);
      return script;
    } catch (error) {
      if (error.code === 'SCRIPT_QUALITY_REJECTED') {
        throw error;
      }
      this.logger.warn(`AI script generation failed; using template fallback: ${error.message}`);
      return null;
    }
  }

  async withRetries(fn, label, attempts = 3) {
    let lastError;
    for (let attempt = 1; attempt <= attempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        const status = error?.status;
        const message = String(error?.message || '');
        const transient = status === 429 || status === 408 || (status >= 500 && status <= 599) ||
          /timeout|timed out|empty response|ECONN|ENOTFOUND|fetch failed|network|JSON|SyntaxError|Unexpected token/i.test(message) ||
          error instanceof SyntaxError;
        // Auth/validation errors will not get better by retrying.
        if (!transient || attempt === attempts) break;
        const delayMs = Math.min(15000, 1500 * Math.pow(2, attempt - 1));
        this.logger.warn(`${label} attempt ${attempt} failed (${message}); retrying in ${delayMs}ms`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
    throw lastError;
  }

  // ---------------------------------------------------------------------------
  // Quiz videos: "Top N <subject> Question and answer" MCQ formats. Questions are
  // generated in batches, verified, and structurally validated before the script
  // is accepted.
  // ---------------------------------------------------------------------------

  parseRequestedQuestionCount(strategy = {}) {
    const isShort = Boolean(
      strategy.isShort ||
      String(strategy.contentType || '').toLowerCase() === 'quiz_short' ||
      String(strategy.requestedStyle || '').toLowerCase() === 'quiz_short'
    );
    const minVal = isShort ? 1 : 5;
    const text = `${strategy.topic || ''} ${strategy.angle || ''}`;
    const topMatch = text.match(/\btop\s*(\d{1,3})\b/i);
    if (topMatch) {
      const value = Number(topMatch[1]);
      if (value >= minVal && value <= 100) return value;
    }
    const standalone = text.match(/\b(\d{1,3})\b/);
    if (standalone) {
      const value = Number(standalone[1]);
      if (value >= minVal && value <= 100) return value;
    }
    if (isShort) {
      return 5;
    }
    const fallbackByLength = { short: 20, medium: 50, long: 100 };
    return fallbackByLength[strategy.requestedLengthKey] || 50;
  }

  quizLanguageFor(strategy = {}) {
    return strategy.language === 'en' ? 'en' : 'hi';
  }

  quizDuplicateKey(question) {
    return String(question || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .slice(0, 60);
  }

  normalizeQuizQuestions(rawQuestions, startNumber = 1) {
    if (!Array.isArray(rawQuestions)) return [];
    const {
      cleanQuestionText,
      cleanAnswerText,
      hindiWordsToNumbers,
      devanagariToStandardDigits,
      isCorruptedDevanagari
    } = require('../utils/quiz-narration');
    const normalized = [];
    for (const raw of rawQuestions) {
      if (!raw || typeof raw !== 'object') continue;
      let question = cleanQuestionText(raw.question || raw.q || '');
      // On-screen questions & options MUST display standard Arabic numerals (17, 28, 1947, 206), NOT Hindi words
      question = devanagariToStandardDigits(question);
      question = hindiWordsToNumbers(question);

      const options = (Array.isArray(raw.options) ? raw.options : [])
        .map(option => {
          let opt = cleanAnswerText(String(option || ''));
          opt = devanagariToStandardDigits(opt);
          opt = hindiWordsToNumbers(opt);
          return opt;
        })
        .filter(Boolean);

      if (!question || options.length !== 4) continue;

      // Reject questions with duplicate options
      const uniqueOptions = new Set(options.map(opt => opt.toLowerCase().trim()));
      if (uniqueOptions.size !== 4) {
        this.logger.warn(`Discarding question with duplicate options: "${question.slice(0, 60)}..."`);
        continue;
      }

      // Reject corrupted / token-split Devanagari (e.g. 'भ रत म र श ट', 'ठ ठर फरवर') so the batch will re-generate cleanly
      if (isCorruptedDevanagari(question) || options.some(opt => isCorruptedDevanagari(opt))) {
        this.logger.warn(`Discarding question with corrupted Devanagari text: "${question.slice(0, 60)}..."`);
        continue;
      }

      let answerIndex = Number(raw.answerIndex ?? raw.answer);
      if (!Number.isInteger(answerIndex) && typeof raw.answer === 'string') {
        const letter = raw.answer.trim().toUpperCase().charAt(0);
        answerIndex = 'ABCD'.indexOf(letter);
      }
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex > 3) continue;
      normalized.push({
        number: startNumber + normalized.length,
        question,
        options,
        answerIndex,
        explanation: String(raw.explanation || raw.reason || '').trim().slice(0, 200),
        visualPrompt: String(raw.visualPrompt || raw.imagePrompt || '').trim().slice(0, 300)
      });
    }
    return normalized;
  }

  buildQuizBatchPrompt({ strategy, language, size, totalQuestions = 50, collectedKeys, withMeta }) {
    const languageLine = language === 'hi'
      ? 'Write every question, option, explanation and header text in Hindi using proper Devanagari script. IMPORTANT: On-screen questions and options must write all numbers and dates as numeric digits (e.g. 17, 28 फरवरी 1928, 1947, 360, अनुच्छेद 324) and NOT spelled out as Hindi words. Write continuous, natural Hindi words with correct matras; never separate consonants with spaces.'
      : 'Write every question, option, explanation and header text in English.';

    // Combine current batch keys with persistent historical questions from previous videos
    const persistentTexts = getRecentUsedQuestionTexts(60);
    const combinedExclusions = [...new Set([...collectedKeys, ...persistentTexts])].slice(0, 80);
    const existing = combinedExclusions.map(key => `- ${key}`).join('\n') || '- (none yet)';
    const metaShape = withMeta
      ? `"title": "SEO video title under 100 characters, style like: Top ${totalQuestions} ${strategy.topic || 'Science'} Question and answer | General Science GK Quiz | SSC CGL, Railway",
  "subject": "short English subject, e.g. Science",
  "subjectHindi": "same subject in Hindi, e.g. विज्ञान",
`
      : '';

    return `You write multiple-choice quiz questions for an Indian exam-preparation YouTube channel (SSC, UPSC, Railway, Police, state exams).
The full video will feature a total of Top ${totalQuestions} questions (you are writing a batch of ${size} questions).
Return only valid JSON with this exact shape:
{
  ${metaShape}"questions": [
    {
      "question": "the question text without question numbers or countdown",
      "options": ["option A", "option B", "option C", "option D"],
      "answerIndex": 0,
      "explanation": "concise 1-2 line factual explanation in Hindi (10 to 25 words) about why this answer is correct or a famous related fact (e.g., 'बिहार में विश्व प्रसिद्ध नालंदा विश्वविद्यालय और बोधगया मंदिर स्थित है।')",
      "visualPrompt": "clear descriptive English prompt for generating an image specifically representing the correct answer or subject (e.g. if the answer is Lord Hardinge: 'Historical portrait photograph of Lord Hardinge II in viceregal uniform, archival 1910s British India'; if Chauri Chaura: 'Historical archival illustration of Chauri Chaura incident 1922'; if Bihar: 'Scenic landscape view of Nalanda University ruins in Bihar India'; if Indian Constitution: 'Parchment document of Constitution of India with Ashoka Lion Capital emblem'). NEVER use generic buildings for people or events."
    }
  ]
}

${languageLine}
Topic: ${strategy.topic}
Angle: ${strategy.angle}
Audience: ${strategy.targetAudience}
Subject focus: ${strategy.quizSubject || 'the topic above'}

Write exactly ${size} questions.

RULES:
1. Every question must be a real exam-style factual MCQ with exactly ONE correct option and three plausible, similar-looking distractors.
2. Check the answer yourself before writing it. "answerIndex" is the 0-based index of the correct option (0=A, 1=B, 2=C, 3=D).
3. Do NOT put numbers in front of question text (do NOT write "1.", "प्रश्न 1", "Q1.", etc.). The narration script will automatically add ("आपका पहला सवाल है—", "आपका अगला सवाल है—", "आपका आखिरी सवाल है—").
4. Do NOT include thinking words, countdown or timer fillers ("सोचिए", "समय शुरू होता है", "समय समाप्त").
5. NUMBERS ON SCREEN: Write all mathematical numbers, years, articles, and quantities as NUMERIC DIGITS (e.g., "अनुच्छेद 324", "28 फरवरी 1928", "1947", "360 डिग्री", "73वां संशोधन"). Do NOT spell out numbers as Hindi words in question or options. Voice-over will automatically speak them in Hindi.
6. HINDI SPELLING: Write pure, natural Hindi words in Devanagari with intact matras (e.g., "राष्ट्रीय", "विज्ञान", "दिवस"). NEVER separate consonants with spaces (do NOT write "भ रत" or "व ज ञ न").
7. Facts must be verifiably correct and stable (history, polity, science, geography, static GK). If in doubt, use confirmed facts instead of guessing.
8. Options must be short (1-8 words), distinct, and grammatically parallel. Options are displayed on screen only and will NOT be spoken in the voice-over.
9. Do not repeat or rephrase any question from this already-used list:
${existing}
10. Vary the sub-topics. Do not start every question the same way.
11. REQUIRED: Every question MUST have an informative 1-2 sentence "explanation" (10-25 words) in Hindi stating a famous historical/geographical/factual detail about the correct answer. This fact is spoken aloud after revealing the answer.
12. REQUIRED visualPrompt: Write a specific descriptive English visual prompt for generating an image strictly relevant to the correct answer. For historical people/rulers/leaders, specify a historical portrait photograph or painting. For historical battles/events/movements, describe that event scene. For laws/articles/constitution, describe the Indian constitution parchment or Parliament. For geography, describe that specific place/map. Do NOT default to generic buildings or landmarks when the subject is a person, battle, document, or science topic.
13. Strict JSON: every string in "options" and "question" must be enclosed in double quotes. Do NOT use unescaped double quotes inside question, options, or explanation text; use single quotes ('...') for any terms or titles inside sentences (e.g. 'मास्टर ग्रंथि', 'विटामिन C').
14. ZERO REPETITION & NO CLICHES: Never ask beginner cliches (e.g. counting bones in human body "मानव शरीर में हड्डियां", simple national symbols, simple capitals). Every question must be a fresh, competitive-exam level question (SSC CGL / UPSC / Railway NTPC standard) covering diverse specialized sub-domains.
Return only the valid JSON, no markdown outside, no commentary.`;
  }


  async generateQuizScriptWithAI(strategy, template) {
    const language = this.quizLanguageFor(strategy);
    const requestedTotal = this.parseRequestedQuestionCount(strategy);
    const batchSize = 10;
    const questions = [];
    const collectedKeys = getUsedQuestionKeysSet();
    let meta = null;
    const maxBatches = Math.ceil(requestedTotal / batchSize) + 4;

    this.logger.info(`Generating ${requestedTotal} quiz questions (${language}) in batches of ${batchSize}`);

    for (let batch = 0; batch < maxBatches && questions.length < requestedTotal; batch++) {
      const size = Math.min(batchSize, requestedTotal - questions.length);
      const prompt = this.buildQuizBatchPrompt({
        strategy,
        language,
        size,
        totalQuestions: requestedTotal,
        collectedKeys,
        withMeta: !meta
      });
      let parsed = null;
      try {
        parsed = await this.withRetries(
          async () => {
            const response = await this.aiTextService.generateText(prompt, { maxTokens: 4096, temperature: 0.8, json: true });
            return this.parseAIJsonResponse(response);
          },
          `AI quiz batch ${batch + 1}`,
          3
        );
      } catch (batchErr) {
        this.logger.warn(`AI quiz batch ${batch + 1} failed (${batchErr.message}). Continuing to next batch...`);
        continue;
      }

      if (!meta && parsed && parsed.title) {
        meta = {
          title: String(parsed.title || '').trim(),
          subject: String(parsed.subject || '').trim(),
          subjectHindi: String(parsed.subjectHindi || '').trim(),
          hook: String(parsed.hook || '').trim(),
          introduction: (Array.isArray(parsed.introduction) ? parsed.introduction : [parsed.introduction])
            .map(line => String(line || '').trim()).filter(Boolean).slice(0, 3),
          subscribe: String(parsed.subscribe || '').trim(),
          outro: String(parsed.outro || '').trim(),
          finalThought: String(parsed.finalThought || '').trim()
        };
      }

      const rawQuestions = parsed?.questions || parsed?.mcqs || [];
      let added = 0;
      for (const item of this.normalizeQuizQuestions(rawQuestions, questions.length + 1)) {
        const key = this.quizDuplicateKey(item.question);
        if (!key || collectedKeys.has(key) || isDuplicateQuestion(item.question, collectedKeys)) continue;
        collectedKeys.add(key);
        questions.push({ ...item, number: questions.length + 1 });
        added++;
      }
      this.logger.info(`Quiz batch ${batch + 1}: +${added} questions (${questions.length}/${requestedTotal})`);
    }

    const minimum = Math.min(requestedTotal, Math.max(3, Math.floor(requestedTotal * 0.8)));
    if (questions.length < minimum) {
      const error = new Error(`Quiz generation produced only ${questions.length}/${requestedTotal} valid questions (minimum ${minimum})`);
      error.code = 'SCRIPT_QUALITY_REJECTED';
      error.violations = [`Only ${questions.length} unique valid questions for a requested ${requestedTotal}`];
      throw error;
    }
    questions.length = Math.min(questions.length, requestedTotal);
    questions.forEach((question, index) => { question.number = index + 1; });

    // Second pass: have the model fact-check the marked answers and repair only
    // the questions it flags. Keeps one bad answer out of a 50-question video.
    try {
      const repaired = await this.verifyAndRepairQuizAnswers(questions, strategy, language);
      if (repaired.repairedCount) {
        this.logger.info(`Quiz verification repaired ${repaired.repairedCount} answer(s)`);
      }
    } catch (error) {
      this.logger.warn(`Quiz answer verification skipped: ${error.message}`);
    }

    // Record questions to persistent storage so they are never repeated across videos
    try {
      recordGeneratedQuestions(questions, strategy?.topic || meta?.subject || 'general');
    } catch (recErr) {
      this.logger.warn(`Failed to record generated questions for deduplication: ${recErr.message}`);
    }

    const { formatStrictQuizScript, formatShortQuizScript, introNarration } = require('../utils/quiz-narration');
    const isShort = Boolean(
      strategy.isShort ||
      String(strategy.contentType || '').toLowerCase() === 'quiz_short' ||
      String(strategy.requestedStyle || '').toLowerCase() === 'quiz_short' ||
      String(strategy.contentType || '').toLowerCase() === 'quiz_short_no_image' ||
      String(strategy.requestedStyle || '').toLowerCase() === 'quiz_short_no_image'
    );
    const secondsPerQuestion = isShort ? 5 : (language === 'hi' ? 8 : 7);
    const durationSeconds = isShort
      ? Math.round(questions.length * secondsPerQuestion) + 6
      : Math.round(questions.length * secondsPerQuestion) + 4;
    const subject = meta?.subject || this.deriveQuizSubject(strategy.topic);
    const subjectHindi = meta?.subjectHindi || this.deriveQuizSubjectHindi(strategy.topic, subject);
    const actualCount = questions.length;

    // Extract Part number if provided in topic, raw request, context or title
    const textToScan = [
      strategy.topic,
      strategy.context,
      meta?.title,
      strategy.title
    ].filter(Boolean).join(' ');
    const partMatch = textToScan.match(/(?:part|भाग)\s*[:#-]?\s*(\d+)/i);
    const partNumber = partMatch ? parseInt(partMatch[1], 10) : 1;

    // Dynamically replace any hardcoded count with the actualCount
    let finalTitle = meta?.title || `Top ${actualCount} ${subject} Question and answer`;
    if (/top\s*\d+/i.test(finalTitle)) {
      finalTitle = finalTitle.replace(/top\s*\d+/i, `Top ${actualCount}`);
    } else {
      finalTitle = `Top ${actualCount} ${finalTitle}`;
    }

    const introText = isShort ? '' : introNarration(subjectHindi, actualCount, language);
    const fullScript = isShort
      ? formatShortQuizScript(questions, language)
      : formatStrictQuizScript(questions, language, { introText, subject: subjectHindi });

    const script = {
      title: String(finalTitle).slice(0, 100),
      isShort,
      partNumber,
      hook: { type: isShort ? 'short_quiz' : 'quiz_intro', text: introText, duration: isShort ? '0:00' : '0:03' },
      introduction: {
        type: isShort ? 'short_quiz' : 'quiz_intro',
        lines: introText ? [introText] : [],
        duration: isShort ? '0:00' : '0:03'
      },
      mainContent: { sections: [], totalDuration: durationSeconds, type: isShort ? 'quiz_short' : 'quiz' },
      quiz: {
        type: isShort ? 'quiz_short' : 'quiz',
        isShort,
        part: partNumber,
        language,
        requestedQuestions: requestedTotal,
        totalQuestions: actualCount,
        subject,
        subjectHindi,
        headerLabel: `Top ${actualCount} ${subject} Question and answer`,
        thumbnailLabel: `${subjectHindi} GK TOP ${actualCount}`,
        questions,
        textScript: fullScript
      },
      fullScript,
      conclusion: {
        type: 'conclusion',
        title: '',
        recap: [],
        finalThought: '',
        duration: '0:00'
      },
      callToAction: {
        type: 'call_to_action',
        subscribe: '',
        like: '',
        comment: '',
        nextVideo: '',
        duration: '0:00'
      },
      duration: this.formatSecondsAsDuration(durationSeconds),
      tone: template.tone,
      pacing: template.pacing,
      keywords: strategy.keywords || [],
      claims: [],
      metadata: {
        strategy,
        generatedAt: new Date().toISOString(),
        version: '1.0',
        generationSource: 'ai-quiz'
      }
    };

    const gate = this.validateScriptQuality(script, strategy);
    if (!gate.passed) {
      const error = new Error(`Quiz quality gate rejected the script: ${gate.violations.join('; ')}`);
      error.code = 'SCRIPT_QUALITY_REJECTED';
      error.violations = gate.violations;
      throw error;
    }

    return script;
  }

  async verifyAndRepairQuizAnswers(questions, strategy, language) {
    const letter = index => 'ABCD'[index];
    const items = questions
      .map(question => `${question.number}. ${question.question} | ${question.options.map((option, index) => `${letter(index)}) ${option}`).join(' | ')} | marked answer: ${letter(question.answerIndex)}`)
      .join('\n');

    const checkPrompt = `You are a strict fact-checker for Indian competitive-exam quiz questions.
Below are numbered multiple-choice questions with their marked answers.
Decide for each question whether the marked answer is DEFINITELY factually incorrect.
Return only valid JSON: {"wrong":[{"number":3,"correctIndex":1,"reason":"short reason"}]}
Only include questions where the marked answer is definitely wrong or where more than one option could be argued correct. If you are unsure, leave the question out. Never flip an answer you are not certain about.

${items}`;

    const checkResponse = await this.withRetries(
      () => this.aiTextService.generateText(checkPrompt, { maxTokens: 2048, temperature: 0.2 }),
      'AI quiz answer verification'
    );
    const parsedCheck = this.parseAIJsonResponse(checkResponse);
    const flagged = (Array.isArray(parsedCheck.wrong) ? parsedCheck.wrong : [])
      .map(item => Number(item?.number))
      .filter(number => Number.isInteger(number) && number >= 1 && number <= questions.length);
    if (!flagged.length) return { repairedCount: 0 };

    const flaggedSet = new Set([...new Set(flagged)]);
    const flaggedItems = questions
      .filter(question => flaggedSet.has(question.number))
      .map(question => `${question.number}. ${question.question} | ${question.options.map((option, index) => `${letter(index)}) ${option}`).join(' | ')} | current marked answer: ${letter(question.answerIndex)}`)
      .join('\n');

    const repairPrompt = `Fix the following Indian exam quiz questions whose answers are wrong. Rewrite each question so it has exactly one clearly correct option, and state the correct 0-based index.
Return only valid JSON: {"questions":[{"number":3,"question":"...","options":["...","...","...","..."],"answerIndex":1,"explanation":"short reason"}]}
Keep the same language as the input (${language === 'hi' ? 'Hindi, Devanagari script' : 'English'}).

${flaggedItems}`;

    const repairResponse = await this.withRetries(
      () => this.aiTextService.generateText(repairPrompt, { maxTokens: 3072, temperature: 0.4 }),
      'AI quiz answer repair'
    );
    const parsedRepair = this.parseAIJsonResponse(repairResponse);
    const replacements = this.normalizeQuizQuestions(parsedRepair.questions || [], 0);
    let repairedCount = 0;
    for (const replacement of replacements) {
      const target = questions.find(question => question.number === Number(replacement.number));
      if (!target) continue;
      const uniqueOpts = new Set(replacement.options.map(o => o.toLowerCase().trim()));
      if (uniqueOpts.size !== 4) continue;
      target.question = replacement.question;
      target.options = replacement.options;
      target.answerIndex = replacement.answerIndex;
      if (replacement.explanation) target.explanation = replacement.explanation;
      repairedCount++;
    }
    return { repairedCount };
  }

  deriveQuizSubject(topic) {
    const cleaned = String(topic || '')
      .replace(/\btop\s*\d+\b/gi, '')
      .replace(/\b(question|questions|quiz|mcq|and answer|answers|with answers|in hindi|hindi)\b/gi, '')
      .replace(/[|,:-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned || 'General Knowledge';
  }

  deriveQuizSubjectHindi(topic, englishSubject = '') {
    const combined = `${topic || ''} ${englishSubject || ''}`.toLowerCase();
    if (/प्राचीन\s*भारत|ancient\s*india|ancient\s*history/i.test(combined)) return 'प्राचीन भारत का इतिहास';
    if (/मध्यकालीन|medieval/i.test(combined)) return 'मध्यकालीन भारत का इतिहास';
    if (/आधुनिक\s*भारत|modern\s*india|modern\s*history/i.test(combined)) return 'आधुनिक भारत का इतिहास';
    if (/इतिहास|history/i.test(combined)) return 'भारत का इतिहास';
    if (/भूगोल|geography/i.test(combined)) return 'भारत का भूगोल';
    if (/संविधान|polity|constitution/i.test(combined)) return 'भारतीय संविधान';
    if (/विज्ञान|science|physics|chemistry|biology/i.test(combined)) return 'सामान्य विज्ञान GK';
    if (/अर्थव्यवस्था|economy|economics/i.test(combined)) return 'भारतीय अर्थव्यवस्था';
    if (/करंट\s*अफेयर्स|current\s*affairs/i.test(combined)) return 'करंट अफेयर्स';
    if (/static\s*gk|विविध/i.test(combined)) return 'Static GK (सामान्य ज्ञान)';
    return 'सामान्य ज्ञान (GK)';
  }

  formatSecondsAsDuration(totalSeconds) {
    const seconds = Math.max(0, Math.round(Number(totalSeconds) || 0));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }

  validateQuizQuality(script, strategy) {
    const violations = [];
    const questions = script.quiz?.questions || [];
    const requested = Number(script.quiz?.requestedQuestions || questions.length);
    const minimum = Math.min(requested, Math.max(3, Math.floor(requested * 0.8)));

    if (questions.length < minimum) {
      violations.push(`Only ${questions.length} unique valid questions for a requested ${requested}`);
    }

    const seen = new Set();
    questions.forEach(question => {
      const label = `Q${question.number}`;
      if (!question.question || question.question.length < 15) {
        violations.push(`${label} question text is too short`);
      }
      if (!Array.isArray(question.options) || question.options.length !== 4) {
        violations.push(`${label} does not have exactly 4 options`);
      } else {
        if (new Set(question.options.map(option => option.toLowerCase())).size !== 4) {
          violations.push(`${label} has duplicate options`);
        }
        if (question.options.some(option => !option || option.length < 1)) {
          violations.push(`${label} has an empty option`);
        }
      }
      if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex > 3) {
        violations.push(`${label} has no valid answer`);
      }
      const key = this.quizDuplicateKey(question.question);
      if (seen.has(key)) {
        violations.push(`${label} duplicates an earlier question`);
      }
      seen.add(key);
    });

    // Language consistency: a Hindi quiz must actually be in Devanagari.
    const corpus = questions.map(question => `${question.question} ${(question.options || []).join(' ')}`).join(' ');
    const letters = corpus.replace(/[^\p{L}]/gu, '');
    const devanagari = corpus.match(/[\u0900-\u097F]/g) || [];
    const devanagariRatio = letters.length ? devanagari.length / letters.length : 0;
    if (script.quiz?.language === 'hi' && devanagariRatio < 0.5) {
      violations.push(`Quiz is marked Hindi but only ${(devanagariRatio * 100).toFixed(0)}% of letters are Devanagari`);
    }
    if (script.quiz?.language === 'en' && devanagariRatio > 0.5) {
      violations.push('Quiz is marked English but the questions are not in English');
    }

    if (!script.title) violations.push('A video title is required');
    if (violations.length > 0) {
      this.logger.warn(`Quiz quality violations: ${violations.slice(0, 8).join(' | ')}`);
    }

    return { passed: violations.length === 0, violations };
  }

  // Guards against the failure mode that produced the "distributed systems" video:
  // filler sentences, bracket placeholders, and the topic phrase repeated every line.
  validateScriptQuality(script, strategy) {
    if (script.quiz?.questions?.length) {
      return this.validateQuizQuality(script, strategy);
    }

    const violations = [];
    const sections = script.mainContent?.sections || [];
    const spokenParts = [
      script.hook?.text || '',
      ...(script.introduction?.lines || (script.introduction ? [
        script.introduction.greeting,
        script.introduction.topicIntro,
        script.introduction.valueProposition,
        script.introduction.credibility
      ] : [])),
      ...sections.flatMap(section => (Array.isArray(section.content) ? section.content : [section.content || ''])),
      ...(script.conclusion?.recap || []),
      script.conclusion?.finalThought || ''
    ];
    const spoken = spokenParts.filter(part => typeof part === 'string').join(' ');
    const words = spoken.split(/\s+/).filter(Boolean);
    const topic = String(strategy.topic || '').toLowerCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();

    // 1. Placeholders and stage directions must never reach the narration.
    const placeholderMatches = spoken.match(/\[[^\]]{2,\}\]/g) || [];
    if (placeholderMatches.length) {
      violations.push(`Bracketed placeholders in spoken text: ${placeholderMatches.slice(0, 3).join(', ')}`);
    }

    // 2. Known filler phrases mean the model is announcing, not teaching.
    const fillerPhrases = [
      'this section covers',
      'content coming soon',
      'important aspects of',
      'versatility and power',
      'is a journey, not a destination',
      'the science behind this is fascinating',
      'detailed explanation with visuals',
      'specific case study'
    ];
    const fillerHits = fillerPhrases.filter(phrase => spoken.toLowerCase().includes(phrase));
    if (fillerHits.length) {
      violations.push(`Filler phrases present: ${fillerHits.join(', ')}`);
    }

    // 3. Topic-phrase overuse (the "how distributed systems works works" effect).
    if (topic) {
      const occurrences = spoken.toLowerCase().split(topic).length - 1;
      const allowed = Math.max(3, Math.round(words.length / 150));
      if (occurrences > allowed) {
        violations.push(`Topic phrase "${topic}" appears ${occurrences} times (max ${allowed})`);
      }
    }

    // 4. Substance per section.
    const thinSections = sections
      .map(section => ({ title: section.title, wordCount: (Array.isArray(section.content) ? section.content.join(' ') : section.content || '').split(/\s+/).filter(Boolean).length }))
      .filter(section => section.wordCount < 25)
      .map(section => `"${section.title}" has only ${section.wordCount} spoken words`);
    if (thinSections.length) {
      violations.push(`Sections too thin to teach anything: ${thinSections.join('; ')}`);
    }

    // 5. Duplicate sections (the same filler paragraph three times).
    const sectionBodies = sections
      .map(section => (Array.isArray(section.content) ? section.content.join(' ') : String(section.content || '')).toLowerCase().trim());
    if (new Set(sectionBodies).size < sectionBodies.length) {
      violations.push('Two or more sections have identical content');
    }

    // 6. Overall substance: the narration should be able to fill at least half
    // of the declared runtime at a normal 130 wpm speaking pace.
    const declaredSeconds = this.parseDurationToSeconds(script.duration);
    const speakableSeconds = words.length / 130 * 60;
    if (declaredSeconds > 0 && speakableSeconds < declaredSeconds * 0.5) {
      violations.push(`Only ${words.length} spoken words for ${script.duration} of declared runtime (~${Math.round(speakableSeconds)}s speakable)`);
    }

    return { passed: violations.length === 0, violations };
  }

  parseDurationToSeconds(value) {
    if (Number.isFinite(Number(value))) return Math.max(0, Number(value));
    const parts = String(value || '').split(':').map(Number);
    if (parts.length === 2 && parts.every(Number.isFinite)) return parts[0] * 60 + parts[1];
    if (parts.length === 3 && parts.every(Number.isFinite)) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return 0;
  }

  parseDurationToMinutes(value) {
    return this.parseDurationToSeconds(value) / 60;
  }

  normalizeAIIntroduction(introduction) {
    const lines = (Array.isArray(introduction) ? introduction : [introduction])
      .filter(Boolean)
      .map(line => String(line).trim())
      .filter(Boolean);
    return {
      type: 'ai',
      lines: lines.length ? lines : ['Hey everyone, welcome back!', "In the next few minutes, we'll go past the buzzwords and into how this actually works."],
      duration: '0:05-0:25'
    };
  }

  normalizeAIConclusion(conclusion, strategy) {
    const recap = (Array.isArray(conclusion?.recap) ? conclusion.recap : [])
      .map(line => String(line).trim()).filter(Boolean);
    const finalThought = String(conclusion?.finalThought || '').trim();
    if (recap.length === 0 && !finalThought) {
      return null;
    }
    return {
      type: 'conclusion',
      title: 'Wrapping Up',
      recap: recap.length ? recap : [`That's ${strategy.topic} in practice.`],
      finalThought: finalThought || 'Keep building on this and it will stick.',
      duration: '30 seconds'
    };
  }

  repairJsonStringQuotes(jsonStr) {
    let inString = false;
    let isEscaped = false;
    let result = '';

    for (let i = 0; i < jsonStr.length; i++) {
      const char = jsonStr[i];

      if (char === '\\' && inString) {
        isEscaped = !isEscaped;
        result += char;
        continue;
      }

      if (char === '"' && !isEscaped) {
        if (!inString) {
          inString = true;
          result += char;
        } else {
          const rest = jsonStr.slice(i + 1).trimStart();
          const nextChar = rest[0];
          if (nextChar === ',' || nextChar === ':' || nextChar === '}' || nextChar === ']' || rest.length === 0) {
            inString = false;
            result += char;
          } else {
            result += "'";
          }
        }
        isEscaped = false;
        continue;
      }

      isEscaped = false;
      result += char;
    }

    return result;
  }

  extractQuizQuestionsFromRawText(rawText) {
    const questions = [];
    const objRegex = /\{\s*"question"\s*:\s*"([\s\S]*?)"\s*,\s*"options"\s*:\s*\[([\s\S]*?)\]\s*,\s*"answerIndex"\s*:\s*(\d+)[\s\S]*?\}/g;
    let match;
    while ((match = objRegex.exec(rawText)) !== null) {
      try {
        const qText = match[1].replace(/\\"/g, '"').trim();
        const rawOptions = match[2];
        const optRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"/g;
        const options = [];
        let optMatch;
        while ((optMatch = optRegex.exec(rawOptions)) !== null) {
          options.push(optMatch[1].trim());
        }
        const answerIndex = parseInt(match[3], 10);
        if (qText && options.length === 4 && !isNaN(answerIndex)) {
          questions.push({
            question: qText,
            options,
            answerIndex
          });
        }
      } catch (_) {}
    }
    return { questions };
  }

  parseAIJsonResponse(response) {
    const text = String(response || '').trim();
    const withoutFences = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```$/i, '')
      .trim();

    try {
      return JSON.parse(withoutFences);
    } catch (error) {
      const match = withoutFences.match(/\{[\s\S]*\}/);
      if (!match) {
        throw error;
      }
      try {
        return JSON.parse(match[0]);
      } catch (parseErr) {
        // Repair common LLM JSON defects:
        // 1. Remove trailing commas before } or ]
        let repaired = match[0].replace(/,\s*([\}\]])/g, '$1');
        // 2. Fix unquoted elements in string arrays: ["a", "b", unquoted, "d"]
        repaired = repaired.replace(/(["\d\w\u0900-\u097F]+)\s*,\s*([^"'{}\[\],\n\r]+?)\s*([,\]])/gu, '$1, "$2"$3');
        try {
          return JSON.parse(repaired);
        } catch (repairErr) {
          // 3. Fallback: repair unescaped quotes inside string fields (e.g. Hindi words in quotes)
          try {
            const quoteRepaired = this.repairJsonStringQuotes(repaired);
            return JSON.parse(quoteRepaired);
          } catch (quoteErr) {
            // 4. Fallback: resilient regex extraction of MCQ question objects
            const fallbackExtracted = this.extractQuizQuestionsFromRawText(match[0]);
            if (fallbackExtracted && fallbackExtracted.questions && fallbackExtracted.questions.length > 0) {
              return fallbackExtracted;
            }
            throw parseErr;
          }
        }
      }
    }
  }

  normalizeAIHook(hook) {
    const text = typeof hook === 'object' && hook !== null ? hook.text : hook;
    return {
      type: 'ai',
      text: String(text).trim(),
      duration: '0:00-0:05'
    };
  }

  normalizeAISections(sections, strategy) {
    if (!Array.isArray(sections)) {
      return [];
    }

    return sections
      .slice(0, 8)
      .map((section, index) => {
        const rawContent = Array.isArray(section.content)
          ? section.content
          : [section.content || section.summary || section.description];
        const content = rawContent
          .filter(Boolean)
          .map(line => String(line).trim())
          .filter(Boolean);

        return {
          type: 'ai_generated',
          title: String(section.title || `${strategy.topic} Part ${index + 1}`).trim(),
          onScreen: String(section.onScreen || section.title || '').trim().slice(0, 60),
          content,
          bullets: (Array.isArray(section.bullets) ? section.bullets : [])
            .map(bullet => String(bullet).trim())
            .filter(Boolean)
            .slice(0, 4),
          visual: String(section.visual || '').trim(),
          duration: parseInt(section.duration, 10) || 60
        };
      })
      .filter(section => section.title && section.content.length > 0);
  }

  normalizeAIClaims(claims, sources) {
    if (!Array.isArray(claims)) return [];
    const allowedUrls = new Set((sources || []).map(source => source.url));
    return claims.slice(0, 25).map(item => ({
      text: String(item?.text || item?.claim || '').trim().slice(0, 1000),
      riskLevel: item?.riskLevel === 'high' ? 'high' : 'standard',
      sourceUrls: [...new Set((Array.isArray(item?.sourceUrls) ? item.sourceUrls : [])
        .map(url => String(url))
        .filter(url => allowedUrls.has(url)))]
    })).filter(item => item.text);
  }

  normalizeAICTA(cta, strategy) {
    if (cta && typeof cta === 'object') {
      return {
        type: 'call_to_action',
        subscribe: String(cta.subscribe || cta.text || `Subscribe for more on ${strategy.topic}.`),
        like: String(cta.like || 'Like this video if it helped.'),
        comment: String(cta.comment || `Share your experience with ${strategy.topic} in the comments.`),
        nextVideo: String(cta.nextVideo || 'Watch the next related video for more context.'),
        duration: '15 seconds'
      };
    }

    return {
      type: 'call_to_action',
      subscribe: String(cta || `Subscribe for more practical videos about ${strategy.topic}.`),
      like: 'Like this video if it helped.',
      comment: `Share your experience with ${strategy.topic} in the comments.`,
      nextVideo: 'Watch the next related video for more context.',
      duration: '15 seconds'
    };
  }
  async generateTitle(strategy) {
    const templates = [
      `${strategy.angle}`,
      `${strategy.topic}: The Complete Guide`,
      `Everything You Need to Know About ${strategy.topic}`,
      `${strategy.topic} in ${new Date().getFullYear()}: What's Changed?`,
      `The Truth About ${strategy.topic} (Shocking Results)`,
      `How to Master ${strategy.topic} in 30 Days`,
      `${strategy.topic}: Beginner to Expert Guide`
    ];

    // Select based on content type
    if (strategy.contentType === 'Tutorial') {
      return `How to ${strategy.topic}: Step-by-Step Guide`;
    } else if (strategy.contentType === 'List') {
      return `Top 10 ${strategy.topic} Tips You Need to Know`;
    } else if (strategy.contentType === 'Review') {
      return `${strategy.topic} Review: Is It Worth It?`;
    }

    return templates[Math.floor(Math.random() * templates.length)];
  }

  async generateHook(strategy) {
    const hooks = [
      {
        type: 'question',
        text: `Have you ever wondered ${this.generateQuestionAbout(strategy.topic)}?`
      },
      {
        type: 'statistic',
        text: `Did you know that ${this.generateStatistic(strategy.topic)}?`
      },
      {
        type: 'statement',
        text: `${strategy.topic} is about to change everything, and here's why...`
      },
      {
        type: 'challenge',
        text: `Most people think they understand ${strategy.topic}, but they're completely wrong.`
      },
      {
        type: 'promise',
        text: `In the next few minutes, you'll learn exactly how to master ${strategy.topic}.`
      }
    ];

    const selected = hooks[Math.floor(Math.random() * hooks.length)];
    
    return {
      type: selected.type,
      text: selected.text,
      duration: '0:00-0:05'
    };
  }

  generateQuestionAbout(topic) {
    const questions = [
      `why ${topic} is becoming so important`,
      `how ${topic} actually works`,
      `what makes ${topic} different from everything else`,
      `why experts are talking about ${topic}`,
      `how ${topic} could change your life`
    ];
    
    return questions[Math.floor(Math.random() * questions.length)];
  }

  generateStatistic(topic) {
    const stats = [
      `many people are still figuring out how ${topic} works`,
      `the conversation around ${topic} keeps expanding`,
      `experts continue to debate where ${topic} is headed`,
      `people often miss the practical side of ${topic}`,
      `${topic} can be easier to approach with a clear framework`
    ];
    
    return stats[Math.floor(Math.random() * stats.length)];
  }

  async generateIntroduction(strategy) {
    return {
      greeting: "Hey everyone, welcome back to the channel!",
      topicIntro: `Today, we're diving deep into ${strategy.topic}.`,
      valueProposition: `By the end of this video, you'll understand exactly ${this.getValueProposition(strategy)}.`,
      credibility: this.getCredibilityStatement(strategy),
      duration: '0:05-0:20'
    };
  }

  getValueProposition(strategy) {
    const propositions = {
      'Tutorial': `how to implement ${strategy.topic} step by step`,
      'Explainer': `what ${strategy.topic} is and why it matters`,
      'List': `the most important things about ${strategy.topic}`,
      'Review': `whether ${strategy.topic} is right for you`,
      'Story': `the incredible journey of ${strategy.topic}`
    };
    
    return propositions[strategy.contentType] || `everything about ${strategy.topic}`;
  }

  getCredibilityStatement(_strategy) {
    const statements = [
      "I've spent months researching this topic",
      "After working with hundreds of people on this",
      "Based on the latest research and data",
      "Drawing from real-world experience",
      "Using proven methods and strategies"
    ];
    
    return statements[Math.floor(Math.random() * statements.length)];
  }

  async generateMainContent(strategy, template) {
    const sections = [];
    
    for (const section of template.structure) {
      if (!['hook', 'introduction', 'cta'].includes(section)) {
        sections.push(await this.generateSection(section, strategy));
      }
    }
    
    return {
      sections,
      totalDuration: this.calculateSectionsDuration(sections)
    };
  }

  async generateSection(sectionType, strategy) {
    const sectionGenerators = {
      problem: () => this.generateProblemSection(strategy),
      solution_steps: () => this.generateSolutionSteps(strategy),
      demonstration: () => this.generateDemonstration(strategy),
      explanation: () => this.generateExplanation(strategy),
      examples: () => this.generateExamples(strategy),
      list_items: () => this.generateListItems(strategy),
      pros: () => this.generatePros(strategy),
      cons: () => this.generateCons(strategy),
      comparison: () => this.generateComparison(strategy),
      implications: () => this.generateImplications(strategy)
    };

    const generator = sectionGenerators[sectionType];
    
    if (generator) {
      return await generator();
    }
    
    return this.generateGenericSection(sectionType, strategy);
  }

  async generateProblemSection(strategy) {
    return {
      type: 'problem',
      title: 'The Challenge',
      content: [
        `Many people struggle with ${strategy.topic}.`,
        `The main issues are:`,
        `1. Lack of clear information`,
        `2. Complexity and confusion`,
        `3. Not knowing where to start`,
        `But don't worry, we're going to solve all of these today.`
      ],
      visuals: ['Problem illustration', 'Statistics graphic'],
      duration: 30
    };
  }

  async generateSolutionSteps(strategy) {
    const steps = [];
    const numSteps = 3 + Math.floor(Math.random() * 3); // 3-5 steps
    
    for (let i = 1; i <= numSteps; i++) {
      steps.push({
        number: i,
        title: `Step ${i}: ${this.generateStepTitle(strategy.topic, i)}`,
        description: this.generateStepDescription(strategy.topic, i),
        tip: this.generateProTip(strategy.topic)
      });
    }
    
    return {
      type: 'solution_steps',
      title: 'The Solution',
      steps,
      duration: steps.length * 45
    };
  }

  generateStepTitle(topic, stepNumber) {
    const titles = [
      'Research and Preparation',
      'Setting Up the Foundation',
      'Implementation and Execution',
      'Testing and Optimization',
      'Scaling and Automation'
    ];
    
    return titles[stepNumber - 1] || `Advanced ${topic} Techniques`;
  }

  generateStepDescription(topic, _stepNumber) {
    return `This step involves understanding the key aspects of ${topic} and how to apply them effectively. Pay special attention to the details here, as they make all the difference.`;
  }

  generateProTip(_topic) {
    const tips = [
      `Pro tip: Start small and scale gradually`,
      `Remember: Consistency is more important than perfection`,
      `Quick tip: Document everything as you go`,
      `Expert advice: Focus on one aspect at a time`,
      `Insider secret: This works best when combined with regular practice`
    ];
    
    return tips[Math.floor(Math.random() * tips.length)];
  }

  async generateDemonstration(_strategy) {
    return {
      type: 'demonstration',
      title: 'Live Demo',
      content: [
        `Now let me show you exactly how this works.`,
        `[Screen recording or visual demonstration]`,
        `As you can see, the process is straightforward once you understand the basics.`,
        `The key is to follow the steps exactly as shown.`
      ],
      visuals: ['Screen recording', 'Step-by-step graphics'],
      duration: 120
    };
  }

  async generateExplanation(strategy) {
    return {
      type: 'explanation',
      title: 'Deep Dive',
      content: [
        `Let's break down ${strategy.topic} into its core components.`,
        `First, we need to understand the fundamental principles.`,
        `The science behind this is fascinating...`,
        `[Detailed explanation with visuals]`,
        `This is why ${strategy.topic} works so effectively.`
      ],
      visuals: ['Diagrams', 'Infographics', 'Charts'],
      duration: 90
    };
  }

  async generateExamples(strategy) {
    return {
      type: 'examples',
      title: 'Real-World Examples',
      content: [
        `Let's look at some real examples of ${strategy.topic} in action.`,
        `Example 1: [Specific case study]`,
        `Example 2: [Another relevant example]`,
        `Example 3: [Third compelling example]`,
        `These examples show the versatility and power of ${strategy.topic}.`
      ],
      visuals: ['Case study graphics', 'Before/after comparisons'],
      duration: 75
    };
  }

  async generateListItems(strategy) {
    const items = [];
    const numItems = 5 + Math.floor(Math.random() * 6); // 5-10 items
    
    for (let i = 1; i <= numItems; i++) {
      items.push({
        number: numItems - i + 1, // Countdown for engagement
        title: this.generateListItemTitle(strategy.topic, i),
        description: this.generateListItemDescription(strategy.topic),
        impact: this.generateImpactStatement()
      });
    }
    
    return {
      type: 'list_items',
      title: `Top ${numItems} Things About ${strategy.topic}`,
      items,
      duration: items.length * 30
    };
  }

  generateListItemTitle(topic, index) {
    const titles = [
      `The Hidden Power of ${topic}`,
      `Why ${topic} Matters More Than You Think`,
      `The Surprising Truth About ${topic}`,
      `How ${topic} Can Transform Your Approach`,
      `The ${topic} Secret Nobody Talks About`,
      `Mastering ${topic} in Record Time`,
      `The Ultimate ${topic} Hack`,
      `${topic}: The Game Changer`,
      `Breaking Down ${topic} Myths`,
      `The Future of ${topic}`
    ];
    
    return titles[index - 1] || `Advanced ${topic} Technique #${index}`;
  }

  generateListItemDescription(topic) {
    return `This aspect of ${topic} is crucial because it fundamentally changes how we approach the subject. Understanding this will give you a significant advantage.`;
  }

  generateImpactStatement() {
    const impacts = [
      'This alone can save you hours',
      'Game-changing for beginners',
      'Essential for long-term success',
      'Often overlooked but critical',
      'The difference between success and failure'
    ];
    
    return impacts[Math.floor(Math.random() * impacts.length)];
  }

  async generatePros(_strategy) {
    return {
      type: 'pros',
      title: 'The Benefits',
      points: [
        'Easy to get started',
        'Cost-effective solution',
        'Proven results',
        'Scalable approach',
        'Community support'
      ],
      duration: 45
    };
  }

  async generateCons(_strategy) {
    return {
      type: 'cons',
      title: 'Things to Consider',
      points: [
        'Learning curve at the beginning',
        'Requires consistent effort',
        'Results may vary',
        'Some technical knowledge helpful'
      ],
      duration: 30
    };
  }

  async generateComparison(strategy) {
    return {
      type: 'comparison',
      title: 'How It Compares',
      content: `Compared to alternatives, ${strategy.topic} stands out because of its unique approach and proven effectiveness.`,
      comparisonPoints: [
        'More efficient than traditional methods',
        'Better ROI than competitors',
        'Easier to implement',
        'More sustainable long-term'
      ],
      duration: 60
    };
  }

  async generateImplications(strategy) {
    return {
      type: 'implications',
      title: 'What This Means',
      content: [
        `The implications of ${strategy.topic} are far-reaching.`,
        'This will change how we think about the industry.',
        'Early adopters will have a significant advantage.',
        'The potential for growth is enormous.'
      ],
      duration: 45
    };
  }

  generateGenericSection(sectionType, strategy) {
    return {
      type: sectionType,
      title: sectionType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      content: `This section covers important aspects of ${strategy.topic} that you need to know.`,
      duration: 60
    };
  }

  async generateConclusion(strategy) {
    return {
      type: 'conclusion',
      title: 'Wrapping Up',
      recap: [
        `So that's everything you need to know about ${strategy.topic}.`,
        'We covered the key points:',
        '- The fundamentals and why they matter',
        '- Practical steps to get started',
        '- Real-world applications and examples',
        '- Tips for long-term success'
      ],
      finalThought: `Remember, ${strategy.topic} is a journey, not a destination. Keep learning and improving!`,
      duration: '30 seconds'
    };
  }

  async generateCTA(strategy) {
    return {
      type: 'call_to_action',
      subscribe: "If you found this helpful, make sure to subscribe and hit the notification bell!",
      like: "Give this video a thumbs up if you learned something new.",
      comment: `Let me know in the comments: What's your experience with ${strategy.topic}?`,
      nextVideo: "Check out this related video for more insights.",
      duration: '15 seconds'
    };
  }

  formatFullScript(script) {
    if (script.quiz?.questions?.length) {
      const { formatStrictQuizScript, introNarration } = require('../utils/quiz-narration');
      const quiz = script.quiz;
      const count = quiz.questions.length;
      const subject = quiz.subjectHindi || quiz.subject || 'सामान्य ज्ञान';
      const introText = script.hook?.text || introNarration(subject, count, quiz.language || 'hi');
      return formatStrictQuizScript(quiz.questions, quiz.language || 'hi', { introText, subject });
    }

    let fullScript = '';
    
    // Title
    fullScript += `TITLE: ${script.title}\n\n`;
    fullScript += '═'.repeat(50) + '\n\n';
    
    // Hook
    fullScript += `[${script.hook.duration}] HOOK\n`;
    fullScript += `${script.hook.text}\n\n`;
    
    // Introduction
    fullScript += `[${script.introduction.duration}] INTRODUCTION\n`;
    if (Array.isArray(script.introduction.lines)) {
      script.introduction.lines.forEach(line => {
        fullScript += `${line}\n`;
      });
    } else {
      fullScript += `${script.introduction.greeting}\n`;
      fullScript += `${script.introduction.topicIntro}\n`;
      fullScript += `${script.introduction.valueProposition}\n`;
      fullScript += `${script.introduction.credibility}\n`;
    }
    fullScript += '\n';
    
    // Main Content
    fullScript += 'MAIN CONTENT\n';
    fullScript += '─'.repeat(30) + '\n\n';

    for (const section of script.mainContent.sections) {
      fullScript += `[${this.formatDuration(section.duration)}] ${section.title.toUpperCase()}\n`;
      
      if (Array.isArray(section.content)) {
        section.content.forEach(line => {
          fullScript += `${line}\n`;
        });
      } else if (section.steps) {
        section.steps.forEach(step => {
          fullScript += `\n${step.title}\n`;
          fullScript += `${step.description}\n`;
          fullScript += `💡 ${step.tip}\n`;
        });
      } else if (section.items) {
        section.items.forEach(item => {
          fullScript += `\n#${item.number}: ${item.title}\n`;
          fullScript += `${item.description}\n`;
          fullScript += `Impact: ${item.impact}\n`;
        });
      } else if (section.points) {
        section.points.forEach(point => {
          fullScript += `• ${point}\n`;
        });
      } else {
        fullScript += `${section.content}\n`;
      }
      
      if (section.visuals) {
        fullScript += `\n[VISUALS: ${section.visuals.join(', ')}]\n`;
      } else if (section.visual) {
        fullScript += `\n[VISUAL: ${section.visual}]\n`;
      }
      
      fullScript += '\n';
    }
    
    // Conclusion
    fullScript += `[${script.conclusion.duration}] CONCLUSION\n`;
    script.conclusion.recap.forEach(line => {
      fullScript += `${line}\n`;
    });
    fullScript += `\n${script.conclusion.finalThought}\n\n`;
    
    // Call to Action
    fullScript += `[${script.callToAction.duration}] CALL TO ACTION\n`;
    fullScript += `${script.callToAction.subscribe}\n`;
    fullScript += `${script.callToAction.like}\n`;
    fullScript += `${script.callToAction.comment}\n`;
    fullScript += `${script.callToAction.nextVideo}\n\n`;
    
    // Metadata
    fullScript += '═'.repeat(50) + '\n';
    fullScript += `ESTIMATED DURATION: ${script.duration}\n`;
    fullScript += `TONE: ${script.tone}\n`;
    fullScript += `PACING: ${script.pacing}\n`;
    fullScript += `KEYWORDS: ${(script.keywords || []).join(', ')}\n`;
    
    return fullScript;
  }

  estimateDuration(mainContent) {
    const totalSeconds = mainContent.sections.reduce((total, section) => {
      return total + (section.duration || 60);
    }, 0);
    
    // Add hook, intro, conclusion, CTA
    const fullDuration = totalSeconds + 5 + 15 + 30 + 15;
    
    return this.formatDuration(fullDuration);
  }

  formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  calculateSectionsDuration(sections) {
    return sections.reduce((total, section) => total + (section.duration || 60), 0);
  }
}

module.exports = { ScriptWriterAgent };
