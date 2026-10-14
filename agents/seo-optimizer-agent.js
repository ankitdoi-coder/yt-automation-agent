const { Logger } = require('../utils/logger');
const { AITextService } = require('../utils/ai-text-service');
const {
  buildLongVideoDescription,
  buildShortVideoDescription,
  buildUniversalViralDescription
} = require('../utils/long-video-seo-template');

class SEOOptimizerAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('SEOOptimizer');
    this.keywordDatabase = new Map();
    this.aiTextService = new AITextService(credentials?.credentials || credentials || {});
  }

  async initialize() {
    this.logger.info('Initializing SEO Optimizer Agent...');
    await this.loadKeywordDatabase();
    return true;
  }

  async loadKeywordDatabase() {
    try {
      const keywords = await this.db.getKeywordHistory();
      keywords.forEach(kw => {
        this.keywordDatabase.set(kw.keyword, kw.performance);
      });
    } catch (error) {
      this.logger.warn('No keyword history found');
    }
  }

  async optimize(script, strategy) {
    try {
      this.logger.info(`Optimizing SEO for: ${script.title}`);
      
      const profile = await this.db.getChannelProfile?.().catch(() => null);
      const brand = profile?.channel_name || process.env.CHANNEL_NAME || 'ExamIQ';

      // Create chapters/timestamps first so they can be injected into description
      const chapters = await this.generateChapters(script);
      const timestampsBlock = chapters.length > 0
        ? chapters.map(ch => `${ch.time} ${ch.title}`).join('\n')
        : '';

      const isQuizShort = Boolean(
        script.isShort ||
        strategy.isShort ||
        String(strategy.contentType || '').toLowerCase() === 'quiz_short' ||
        String(strategy.requestedStyle || '').toLowerCase() === 'quiz_short' ||
        String(strategy.contentType || '').toLowerCase() === 'quiz_short_no_image' ||
        String(strategy.requestedStyle || '').toLowerCase() === 'quiz_short_no_image'
      );

      let title, description, tags;

      if (isQuizShort) {
        this.logger.info('Generating viral Short Quiz SEO metadata with high-CTR packaging and educational tags');
        const qCount = script.quiz?.totalQuestions || script.quiz?.questions?.length || 5;
        const topicRaw = strategy.topic || script.title || 'General Knowledge';
        const cleanTopic = topicRaw
          .replace(/^top\s+\d+\s+/i, '')
          .replace(/#\w+/g, '')
          .replace(/\|.*$/g, '')
          .trim();
        
        // High-CTR, search-optimized Short title with exam targets, micro-topics, and set deduplication
        title = this.buildExamOptimizedShortTitle(script, strategy, brand);
        description = this.generateShortQuizDescription(title, brand, cleanTopic);
        tags = [
          'Shorts',
          'GK Shorts',
          'gk questions',
          'gk quiz',
          'gk in hindi',
          'lucent gk',
          'gk questions and answers',
          'samanya gyan',
          'gk mcq',
          'ssc gk',
          'railway gk',
          'upsc gk',
          'static gk',
          'education',
          'study tips',
          'competitive exams',
          cleanTopic.toLowerCase(),
          brand,
          'general knowledge'
        ];
      } else {
        const aiSEO = await this.generateSEOWithAI(script, strategy, brand, chapters);

        if (aiSEO) {
          ({ title, tags } = aiSEO);
        } else {
          this.logger.info('Using template SEO optimization');
          title = await this.optimizeTitle(script.title, strategy);
          tags = await this.generateTags(script, strategy);
        }

        // Channel owner strictly mandated permanent description for all long videos (proven high-views viral queries block)
        description = buildLongVideoDescription({
          title,
          brand,
          topic: strategy.topic || script.title || 'General Knowledge',
          chapters
        });

        // Ensure tags include user's top viral search queries
        const viralExamTags = [
          'gk', 'general knowledge', 'important gk questions and answer', 'quiz test',
          'br gk study', 'gk in hindi', 'general knowledge quiz', 'lucent gk', 'samanya gyan',
          'geography gk', 'lucent gk in hindi', 'gk questions and answers', 'lucent 1000 question'
        ];
        for (const vt of viralExamTags) {
          if (!tags.some(t => t.toLowerCase() === vt.toLowerCase())) {
            tags.push(vt);
          }
        }
      }

      // Ensure brand is in title if space permits (under 100 characters)
      if (brand && !title.toLowerCase().includes(brand.toLowerCase())) {
        if (title.length + brand.length + 3 <= 100) {
          title = `${title} | ${brand}`;
        }
      }

      // Ensure tags include brand and top competitive exam keywords
      const examTags = [brand, 'Education', 'GK in Hindi', 'General Knowledge Quiz', 'SSC CGL GK', 'UPSC Prelims', 'RRB NTPC GK', 'Static GK', 'Lucent GK'];
      for (const et of examTags) {
        if (!tags.some(t => t.toLowerCase() === et.toLowerCase())) {
          tags.unshift(et);
        }
      }

      // Generate hashtags
      const hashtags = isQuizShort
        ? ['#generalknowledge', '#gkinhindi', '#gkquestion', '#gkquiz', '#examgkquestions', '#science', '#currentaffairs', '#gk', '#gkfacts', '#education', '#shorts']
        : await this.generateHashtags(strategy);
      
      // Generate end screen elements
      const endScreen = await this.generateEndScreenStrategy();
      
      // Calculate SEO score
      const seoScore = await this.calculateSEOScore(title, description, tags);
      const categoryId = String(process.env.YOUTUBE_CATEGORY_ID || this.selectCategory(strategy) || 27);
      
      const seoData = {
        title,
        description,
        tags,
        hashtags,
        chapters,
        endScreen,
        seoScore,
        categoryId,
        metadata: {
          primaryKeyword: strategy.keywords?.[0] || strategy.topic || 'General Knowledge',
          secondaryKeywords: (strategy.keywords || []).slice(1, 5),
          targetLength: this.calculateOptimalLength(strategy.contentType),
          language: strategy.language || (strategy.contentType === 'Quiz' ? 'hi' : 'en'),
          category: parseInt(categoryId, 10)
        },
        createdAt: new Date().toISOString()
      };
      
      // Save to database
      await this.db.saveSEOData(seoData);
      
      this.logger.info(`SEO optimization complete. Score: ${seoScore}/100`);
      return seoData;
    } catch (error) {
      this.logger.error('Failed to optimize SEO:', error);
      throw error;
    }
  }

  async generateSEOWithAI(script, strategy, brand = 'ExamIQ', chapters = []) {
    if (!this.aiTextService.isAvailable()) {
      this.logger.info('Using template SEO optimization because no AI text provider is configured');
      return null;
    }

    const timestampsText = (chapters && chapters.length > 0)
      ? chapters.map(ch => `${ch.time} ${ch.title}`).join('\n')
      : '00:00 Introduction\n00:30 Main Questions\n03:00 Summary';

    const prompt = `You are a legendary YouTube Master & SEO Strategist managing 10+ high-traffic educational channels.
Your goal is to optimize this video for MAXIMUM ALGORITHMIC REACH (Browse Features, Suggested Videos, and YouTube Search) in the YouTube Education Category (Category ID 27).

Return only valid JSON with this exact shape:
{
  "title": "High-CTR, search-optimized educational title under 95 characters",
  "description": "Engaging, comprehensive, keyword-dense educational description with timestamps, study links, and comment hook",
  "tags": ["tag1", "tag2"]
}

CHANNEL BRAND: ${brand}
VIDEO TITLE: ${script.title}
TOPIC: ${strategy.topic}
CONTENT TYPE: ${strategy.contentType}
TARGET AUDIENCE: ${strategy.targetAudience} (Competitive Exam Aspirants: SSC CGL, UPSC, RRB NTPC, State PCS, Police Exams, and Lifelong Learners)
KEYWORDS: ${(strategy.keywords || []).join(', ')}
CATEGORY: Education (ID 27)

YOUTUBE MASTER RULES FOR MAXIMUM RECOMMENDATIONS & REACH:
1. TITLE:
   - High Click-Through Rate (CTR) for mobile & desktop feeds. Must be punchy, under 90 characters.
   - Use numbers, authority exam tags, or high-intent educational hooks: e.g. "Top 25 GK Questions for SSC CGL & Railway (${new Date().getFullYear()}) | ${brand}" or "${script.title} | Complete Exam Guide | ${brand}".
   - Ensure "${brand}" is cleanly integrated.
2. DESCRIPTION (Structured for YouTube Algorithm & Viewer Retention):
   - Hook (First 150 characters): Immediately delivers the value proposition and core search keyword before the "Show more" cut.
   - WHAT YOU WILL LEARN: 3-5 bullet points packed with semantic educational keywords (LSI keywords).
   - TIMESTAMPS: Include verified timestamps for Key Moments search indexing:
${timestampsText}
   - AUDIENCE CHALLENGE / PINNED COMMENT HOOK: "🎯 Daily Challenge: How many questions did you answer correctly? Comment your score below to get pinned! 🏆" (Viewer comments multiply algorithmic reach!).
   - STUDY RESOURCES & REFERENCES (GEO / E-E-A-T Trust):
     • NCERT Official: https://ncert.nic.in
     • Wikipedia Knowledge Base: https://en.wikipedia.org
     • Government of India Legislative Portal: https://legislative.gov.in
   - SYLLABUS & EXAM RELEVANCE: Mention target exams (SSC CGL, CHSL, MTS, UPSC Prelims, Railway RRB NTPC, State PCS, Police Constable & SI).
   - CALL TO ACTION: Like, share, subscribe to ${brand}.
   - HASHTAGS: #${brand} #Education #GKQuiz #GeneralKnowledge #ExamPrep #SSCCGL #UPSC.
3. TAGS:
   - 15-22 high-search-volume keywords: Exact match, long-tail queries, exam variants ("SSC CGL GK", "UPSC Prelims", "RRB NTPC"), bilingual variants ("GK in Hindi", "Samanya Gyan", "Lucent GK"), and "${brand}". Total tag character length under 450.`;

    try {
      const response = await this.aiTextService.generateText(prompt, {
        maxTokens: 1800,
        temperature: 0.6
      });
      const parsed = this.parseAIJsonResponse(response);
      const tags = this.normalizeAITags(parsed.tags, strategy);

      if (!parsed.title || !parsed.description || tags.length === 0) {
        throw new Error('AI SEO response missing required fields');
      }

      this.logger.info(`Using AI SEO optimization via ${this.aiTextService.providerName}`);
      return {
        title: String(parsed.title).trim().slice(0, 100),
        description: String(parsed.description).trim().slice(0, 5000),
        tags
      };
    } catch (error) {
      this.logger.warn(`AI SEO optimization failed; using template fallback: ${error.message}`);
      return null;
    }
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
      return JSON.parse(match[0]);
    }
  }

  normalizeAITags(tags, strategy) {
    const rawTags = Array.isArray(tags) ? tags : [];
    const fallbackTags = rawTags.length > 0 ? rawTags : strategy.keywords || [];
    const uniqueTags = [];
    let totalLength = 0;

    for (const tag of fallbackTags) {
      const cleaned = String(tag).trim();
      if (!cleaned || uniqueTags.includes(cleaned)) continue;
      if (totalLength + cleaned.length + 1 > 500) break;
      uniqueTags.push(cleaned);
      totalLength += cleaned.length + 1;
    }

    return uniqueTags;
  }

  buildExamOptimizedShortTitle(script, strategy, brand = 'ExamIQ Bharat') {
    const qCount = script.quiz?.totalQuestions || script.quiz?.questions?.length || 5;
    const year = new Date().getFullYear();
    const partNumber = script.partNumber || script.quiz?.part || 1;
    
    // Extract micro-topic from subjectHindi, subject, questions, or topic
    const subjectHindi = script.quiz?.subjectHindi || '';
    const subjectEng = script.quiz?.subject || '';
    const firstQuestion = (script.quiz?.questions?.[0]?.question || '').slice(0, 35);
    const combined = `${strategy?.topic || ''} ${script.title || ''} ${subjectHindi} ${subjectEng} ${firstQuestion}`.toLowerCase();

    let examTag = 'SSC GD';
    let topicName = 'सामान्य ज्ञान';

    if (/संविधान|polity|article|अनुच्छेद|राष्ट्रपति|संसद/i.test(combined)) {
      examTag = 'SSC CGL';
      topicName = 'संविधान';
    } else if (/भूगोल|geog|नदी|पर्वत|झील|river|mountain/i.test(combined)) {
      examTag = 'SSC GD';
      topicName = 'भूगोल';
    } else if (/इतिहास|history|युद्ध|मुगल|मौर्य|गांधी/i.test(combined)) {
      examTag = 'Railway NTPC';
      topicName = 'इतिहास';
    } else if (/bio|विज्ञान|science|मानव शरीर|विटामिन|cell/i.test(combined)) {
      examTag = 'Railway';
      topicName = 'विज्ञान GK';
    } else if (/first|प्रथम|राष्ट्रीय|static/i.test(combined)) {
      examTag = 'Police Exam';
      topicName = 'Static GK';
    } else if (subjectHindi && subjectHindi.length <= 15) {
      topicName = subjectHindi;
    }

    const templates = [
      `${examTag} ${year} | ${topicName} Top ${qCount} MCQs (Set ${partNumber}) #Shorts #GK`,
      `Lucent GK निचोड़: ${topicName} Top ${qCount} प्रश्न for ${examTag} #Shorts #GK`,
      `${examTag} & Railway: ${topicName} Top ${qCount} महत्वपूर्ण MCQs #Shorts #GK`,
      `Top ${qCount} ${topicName} GK Quiz (${year}) | ${examTag} & Police #Shorts #GK`
    ];

    const templateIdx = (partNumber - 1) % templates.length;
    let title = templates[templateIdx];

    if (title.length > 95) {
      title = `${examTag} ${year} | ${topicName} Top ${qCount} MCQs #Shorts #GK`;
    }
    return title.slice(0, 98);
  }

  generateShortQuizDescription(title, brand = 'ExamIQ Bharat', cleanTopic = 'General Knowledge') {
    return buildShortVideoDescription({
      title,
      brand,
      topic: cleanTopic
    });
  }

  async optimizeTitle(originalTitle, strategy) {
    const year = new Date().getFullYear();
    const isQuiz = ['quiz', 'quiz_visuals'].includes(String(strategy?.contentType || '').toLowerCase()) || /gk|quiz|questions/i.test(originalTitle);

    if (isQuiz) {
      const qCountMatch = originalTitle.match(/top\s*(\d+)/i);
      const qCount = qCountMatch ? qCountMatch[1] : '50';
      
      let subject = originalTitle
        .replace(/top\s*\d+/gi, '')
        .replace(/\|.*$/g, '')
        .replace(/questions?.*$/gi, '')
        .replace(/quiz.*$/gi, '')
        .trim();
      if (!subject || subject.length < 3) subject = 'सामान्य ज्ञान (General Knowledge)';

      let examTarget = 'SSC GD 2026';
      if (/संविधान|polity|इतिहास|history/i.test(originalTitle)) {
        examTarget = 'SSC CGL & Railway';
      } else if (/विज्ञान|science|bio/i.test(originalTitle)) {
        examTarget = 'Railway NTPC & Group D';
      } else if (/भूगोल|geography/i.test(originalTitle)) {
        examTarget = 'SSC GD & Police';
      }

      const formatted = `${examTarget} | ${subject} Top ${qCount} अति महत्वपूर्ण प्रश्न | Previous Year Questions | ExamIQ`;
      return formatted.length <= 100 ? formatted : formatted.slice(0, 98);
    }

    // Default title optimization for non-quiz videos
    let optimizedTitle = originalTitle;
    
    // Add educational power words if not present
    const eduPowerWords = ['Top 25', 'Complete Guide', 'Must-Know', 'Most Repeated', 'Ultimate', 'Essential', 'Important'];
    const hasPowerWord = eduPowerWords.some(word => 
      originalTitle.toLowerCase().includes(word.toLowerCase())
    );
    
    if (!hasPowerWord && originalTitle.length < 55) {
      const powerWord = eduPowerWords[Math.floor(Math.random() * eduPowerWords.length)];
      optimizedTitle = `${powerWord} ${optimizedTitle}`;
    }
    
    // Add year if relevant and not present
    const currentYear = new Date().getFullYear();
    if (!optimizedTitle.includes(currentYear.toString()) && optimizedTitle.length < 68) {
      optimizedTitle = `${optimizedTitle} (${currentYear})`;
    }
    
    // Ensure primary keyword is in title
    const primaryKeyword = strategy.keywords && strategy.keywords[0];
    if (primaryKeyword && !optimizedTitle.toLowerCase().includes(primaryKeyword.toLowerCase())) {
      if (optimizedTitle.length + primaryKeyword.length + 3 <= 85) {
        optimizedTitle = `${optimizedTitle} - ${primaryKeyword}`;
      }
    }
    
    // Truncate if too long
    if (optimizedTitle.length > 95) {
      optimizedTitle = optimizedTitle.substring(0, 92).trim() + '...';
    }
    
    // Capitalize properly
    optimizedTitle = this.titleCase(optimizedTitle);
    
    return optimizedTitle;
  }

  titleCase(str) {
    const smallWords = ['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'if', 'in', 'of', 'on', 'or', 'the', 'to', 'via', 'vs'];
    
    return str.split(' ').map((word, index) => {
      if (index === 0 || !smallWords.includes(word.toLowerCase())) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toLowerCase();
    }).join(' ');
  }

  async generateDescription(script, strategy) {
    const brand = process.env.CHANNEL_NAME || 'ExamIQ Bharat';
    const chapters = await this.generateChapters(script);
    const isQuizShort = Boolean(
      strategy?.isShort ||
      String(strategy?.contentType || '').toLowerCase().includes('short') ||
      String(strategy?.requestedStyle || '').toLowerCase().includes('short')
    );
    return isQuizShort
      ? buildShortVideoDescription({
          title: script.title,
          brand,
          topic: strategy?.topic || script.title
        })
      : buildLongVideoDescription({
          title: script.title,
          brand,
          topic: strategy?.topic || script.title || 'General Knowledge',
          chapters
        });
  }


  async generateTags(script, strategy) {
    const tags = new Set();
    
    // Add primary keywords
    (strategy.keywords || []).forEach(keyword => tags.add(keyword));
    
    // Add topic variations
    const topic = String(strategy.topic || script.title || 'General Knowledge').toLowerCase();
    tags.add(topic);
    tags.add(topic.replace(/\s+/g, ''));
    tags.add(topic.replace(/\s+/g, '_'));
    
    // Add content type tags
    const contentTypeTags = {
      'Tutorial': ['how to', 'tutorial', 'guide', 'step by step', 'learn'],
      'Explainer': ['explained', 'what is', 'understanding', 'explanation'],
      'Review': ['review', 'comparison', 'vs', 'best', 'top'],
      'List': ['top 10', 'best', 'list', 'countdown'],
      'Story': ['story', 'journey', 'experience', 'case study']
    };
    
    const typeTags = contentTypeTags[strategy.contentType] || [];
    typeTags.forEach(tag => tags.add(tag));
    
    // Add year tags
    const year = new Date().getFullYear();
    tags.add(year.toString());
    tags.add(`${topic} ${year}`);
    
    // Add niche-specific tags
    const niche = this.identifyNiche(strategy);
    const nicheTags = this.getNicheTags(niche);
    nicheTags.forEach(tag => tags.add(tag));
    
    // Add long-tail keywords
    const longTailKeywords = this.generateLongTailKeywords(strategy);
    longTailKeywords.forEach(keyword => tags.add(keyword));
    
    // Extract tags from script content
    if (script.keywords) {
      script.keywords.forEach(keyword => tags.add(keyword));
    }
    
    // Add channel branding tags
    if (process.env.CHANNEL_NAME) {
      tags.add(process.env.CHANNEL_NAME);
    }
    
    // YouTube allows max 500 characters in tags, prioritize most important
    const tagArray = Array.from(tags);
    const prioritizedTags = this.prioritizeTags(tagArray, strategy);
    
    // Ensure total character count doesn't exceed 500
    let totalLength = 0;
    const finalTags = [];
    
    for (const tag of prioritizedTags) {
      if (totalLength + tag.length + 1 <= 500) {
        finalTags.push(tag);
        totalLength += tag.length + 1; // +1 for comma separator
      }
    }
    
    return finalTags;
  }

  identifyNiche(strategy) {
    const topic = (strategy.topic || '').toLowerCase();
    
    const niches = {
      'education': [
        'learn', 'study', 'course', 'tutorial', 'education', 'teach',
        'gk', 'quiz', 'exam', 'upsc', 'ssc', 'rrb', 'ntpc', 'pcs',
        'question', 'questions', 'mcq', 'knowledge', 'history', 'science',
        'geography', 'polity', 'facts', 'general knowledge', 'samanya gyan',
        'lucent', 'test', 'competitive', 'prashn', 'hindi gk', 'current affairs'
      ],
      'technology': ['tech', 'software', 'hardware', 'gadget', 'computer', 'phone', 'app'],
      'gaming': ['game', 'gaming', 'gamer', 'play', 'stream'],
      'business': ['business', 'entrepreneur', 'startup', 'money', 'finance', 'invest'],
      'lifestyle': ['life', 'lifestyle', 'daily', 'routine', 'habit'],
      'health': ['health', 'fitness', 'workout', 'diet', 'nutrition', 'wellness'],
      'entertainment': ['fun', 'comedy', 'entertainment', 'funny', 'laugh']
    };
    
    for (const [niche, keywords] of Object.entries(niches)) {
      if (keywords.some(keyword => topic.includes(keyword))) {
        return niche;
      }
    }
    
    return 'education';
  }

  getNicheTags(niche) {
    const nicheTags = {
      'education': [
        'educational', 'learning', 'study tips', 'online learning', 'general knowledge',
        'gk in hindi', 'gk quiz', 'gk questions', 'samanya gyan', 'lucent gk',
        'exam preparation', 'ssc cgl gk', 'upsc prelims', 'rrb ntpc gk', 'static gk',
        'competitive exams', 'current affairs', 'general science'
      ],
      'technology': ['tech', 'technology', 'innovation', 'future tech', 'tech news'],
      'gaming': ['gaming', 'gameplay', 'walkthrough', 'lets play', 'game review'],
      'business': ['business tips', 'entrepreneurship', 'startup', 'business strategy', 'success'],
      'lifestyle': ['lifestyle', 'life hacks', 'daily routine', 'productivity', 'self improvement'],
      'health': ['health tips', 'fitness', 'healthy living', 'wellness', 'nutrition'],
      'entertainment': ['entertainment', 'fun', 'viral', 'trending', 'must watch'],
      'general': ['education', 'learning', 'study', 'exam preparation', 'knowledge']
    };
    
    return nicheTags[niche] || nicheTags.education;
  }

  generateLongTailKeywords(strategy) {
    const longTailTemplates = [
      `how to ${strategy.topic}`,
      `${strategy.topic} for beginners`,
      `${strategy.topic} tutorial`,
      `best ${strategy.topic}`,
      `${strategy.topic} tips and tricks`,
      `${strategy.topic} step by step`,
      `${strategy.topic} guide ${new Date().getFullYear()}`,
      `${strategy.topic} explained simply`,
      `everything about ${strategy.topic}`,
      `${strategy.topic} mistakes to avoid`
    ];
    
    return longTailTemplates.slice(0, 5);
  }

  prioritizeTags(tags, strategy) {
    // Score and sort tags by importance
    const scoredTags = tags.map(tag => {
      let score = 0;
      
      const keywords = strategy.keywords || [];
      const topicLower = (strategy.topic || '').toLowerCase();

      // Primary keyword gets highest score
      if (keywords[0] && tag === keywords[0]) score += 10;
      
      // Other strategy keywords
      if (keywords.includes(tag)) score += 5;
      
      // Contains topic
      if (topicLower && tag.includes(topicLower)) score += 3;
      
      // Long-tail keywords
      if (tag.split(' ').length > 2) score += 2;
      
      // Current year
      if (tag.includes(new Date().getFullYear().toString())) score += 1;
      
      return { tag, score };
    });
    
    // Sort by score descending
    scoredTags.sort((a, b) => b.score - a.score);
    
    return scoredTags.map(item => item.tag);
  }

  async generateHashtags(strategy) {
    const hashtags = [];
    
    // Primary hashtag
    const primaryHashtag = `#${strategy.topic.replace(/\s+/g, '')}`;
    hashtags.push(primaryHashtag);
    
    // Content type hashtag
    hashtags.push(`#${strategy.contentType.toLowerCase()}`);
    
    // Trending hashtags
    const trendingHashtags = [
      '#youtube',
      '#youtuber',
      '#subscribe',
      '#video',
      '#viral',
      '#trending',
      '#new'
    ];
    
    // Niche hashtags
    const niche = this.identifyNiche(strategy);
    const nicheHashtags = {
      'technology': ['#tech', '#technology', '#innovation'],
      'gaming': ['#gaming', '#gamer', '#games'],
      'education': ['#education', '#learning', '#study'],
      'business': ['#business', '#entrepreneur', '#success'],
      'lifestyle': ['#lifestyle', '#life', '#daily'],
      'health': ['#health', '#fitness', '#wellness'],
      'entertainment': ['#entertainment', '#fun', '#funny']
    };
    
    const selectedNicheHashtags = nicheHashtags[niche] || [];
    hashtags.push(...selectedNicheHashtags.slice(0, 2));
    
    // Add 2-3 trending hashtags
    hashtags.push(...trendingHashtags.slice(0, 3));
    
    // Year hashtag
    hashtags.push(`#${new Date().getFullYear()}`);
    
    // Limit to 15 hashtags (YouTube recommendation)
    return hashtags.slice(0, 15);
  }

  truncateText(text, maxLength) {
    const str = String(text || '').trim();
    if (str.length <= maxLength) return str;
    return `${str.slice(0, maxLength - 1).trimEnd()}…`;
  }

  async generateChapters(script) {
    const chapters = [];
    let currentTime = 0;

    if (script.quiz?.questions?.length) {
      chapters.push({
        time: '00:00',
        title: 'Intro',
        seconds: 0
      });
      currentTime = 4;
      const questions = script.quiz.questions;
      const secondsPerQ = script.quiz.language === 'hi' ? 8 : 7;
      questions.forEach((question, index) => {
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        chapters.push({
          time: timeString,
          title: `Q${question.number}: ${this.truncateText(question.question, 60)}`,
          seconds: currentTime
        });
        currentTime += secondsPerQ;
      });
      return chapters;
    }

    // Introduction
    chapters.push({
      time: '00:00',
      title: 'Introduction',
      seconds: 0
    });
    
    currentTime = 20; // Intro duration
    
    // Main content chapters
    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach(section => {
        const minutes = Math.floor(currentTime / 60);
        const seconds = currentTime % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        chapters.push({
          time: timeString,
          title: section.title || 'Section',
          seconds: currentTime
        });
        
        currentTime += section.duration || 60;
      });
    }
    
    // Conclusion
    const conclusionMinutes = Math.floor(currentTime / 60);
    const conclusionSeconds = currentTime % 60;
    chapters.push({
      time: `${conclusionMinutes.toString().padStart(2, '0')}:${conclusionSeconds.toString().padStart(2, '0')}`,
      title: 'Conclusion & Next Steps',
      seconds: currentTime
    });
    
    return chapters;
  }

  async generateEndScreenStrategy() {
    return {
      elements: [
        {
          type: 'video',
          position: 'left',
          title: 'Recommended Video',
          duration: 20
        },
        {
          type: 'playlist',
          position: 'right',
          title: 'Watch More',
          duration: 20
        },
        {
          type: 'subscribe',
          position: 'center-bottom',
          duration: 20
        }
      ],
      startTime: -20, // 20 seconds before end
      template: 'standard'
    };
  }

  async calculateSEOScore(title, description, tags) {
    let score = 0;
    
    // Title scoring (30 points max)
    if (title.length >= 60 && title.length <= 70) score += 10;
    else if (title.length >= 50 && title.length <= 100) score += 5;
    
    if (/\d/.test(title)) score += 5; // Contains number
    if (/[A-Z]/.test(title)) score += 5; // Proper capitalization
    if (title.includes(new Date().getFullYear().toString())) score += 5; // Current year
    if (['how', 'what', 'why', 'best', 'top'].some(word => title.toLowerCase().includes(word))) score += 5;
    
    // Description scoring (40 points max)
    if (description.length >= 200) score += 10;
    if (description.length >= 500) score += 10;
    if (description.includes('TIMESTAMPS')) score += 5;
    if (description.includes('http')) score += 5; // Contains links
    if (description.split('\n').length > 10) score += 5; // Well formatted
    if (description.substring(0, 200).toLowerCase().includes(String(tags[0] || '').toLowerCase()) || tags.slice(0, 5).some(t => description.toLowerCase().includes(t.toLowerCase()))) score += 5;
    
    // Tags scoring (30 points max)
    if (tags.length >= 10) score += 10;
    if (tags.length >= 15) score += 5;
    if (tags.some(tag => tag.split(' ').length > 2)) score += 5; // Long-tail keywords
    if (tags.join('').length <= 500) score += 5; // Within character limit
    if (new Set(tags).size === tags.length) score += 5; // No duplicates
    
    return Math.min(100, score);
  }

  calculateOptimalLength(contentType) {
    const optimalLengths = {
      'Tutorial': '10-15 minutes',
      'Explainer': '5-10 minutes',
      'Review': '8-12 minutes',
      'List': '8-15 minutes',
      'Story': '10-20 minutes',
      'Quiz': '6-12 minutes'
    };
    
    return optimalLengths[contentType] || '8-12 minutes';
  }

  selectCategory(strategy) {
    if (process.env.YOUTUBE_CATEGORY_ID) {
      return parseInt(process.env.YOUTUBE_CATEGORY_ID, 10);
    }
    const categories = {
      'education': 27, // Education
      'technology': 28, // Science & Technology
      'gaming': 20, // Gaming
      'business': 27, // Education (closest match)
      'lifestyle': 22, // People & Blogs
      'health': 26, // Howto & Style
      'entertainment': 24 // Entertainment
    };
    
    const niche = this.identifyNiche(strategy);
    return categories[niche] || 27; // Default to Education (Category 27)
  }
}

module.exports = { SEOOptimizerAgent };