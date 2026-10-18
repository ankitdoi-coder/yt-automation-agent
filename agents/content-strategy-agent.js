const { Logger } = require('../utils/logger');
const { AITextService } = require('../utils/ai-text-service');
const { analyzeViralOutliers } = require('../utils/viral-outlier-analyzer');

class ContentStrategyAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('ContentStrategy');
    this.trendingTopics = [];
    this.competitorData = [];
    this.contentCalendar = [];
    this.aiTextService = new AITextService(credentials?.credentials || credentials || {});
  }

  async initialize() {
    this.logger.info('Initializing Content Strategy Agent...');
    await this.loadHistoricalData();
    await this.analyzeTrends();
    return true;
  }

  async loadHistoricalData() {
    try {
      const history = await this.db.getContentHistory();
      this.historicalPerformance = history;
    } catch (error) {
      this.logger.warn('No historical data found, starting fresh');
      this.historicalPerformance = [];
    }
  }

  async analyzeTrends() {
    try {
      // Analyze YouTube trends
      const trends = await this.fetchYouTubeTrends();
      
      // Analyze competitor channels
      const competitors = await this.analyzeCompetitors();
      this.competitorData = competitors;
      
      // Combine insights
      this.trendingTopics = this.mergeTrendData(trends, competitors);
      
      this.logger.info(`Identified ${this.trendingTopics.length} trending topics`);
    } catch (error) {
      this.logger.error('Error analyzing trends:', error);
    }
  }

  async fetchYouTubeTrends() {
    // Use YouTube API to fetch trending videos
    const youtube = this.credentials.getYouTubeClient();
    
    try {
      const response = await youtube.videos.list({
        part: 'snippet,statistics',
        chart: 'mostPopular',
        maxResults: 50,
        regionCode: process.env.YOUTUBE_REGION || 'US'
      });

      return response.data.items.map(video => ({
        videoId: video.id,
        title: video.snippet.title,
        tags: video.snippet.tags || [],
        viewCount: parseInt(video.statistics?.viewCount, 10) || 0,
        category: video.snippet.categoryId,
        publishedAt: video.snippet.publishedAt,
        publisher: video.snippet.channelTitle || 'YouTube',
        url: `https://www.youtube.com/watch?v=${video.id}`
      }));
    } catch (error) {
      this.logger.error('Failed to fetch YouTube trends:', error);
      return [];
    }
  }

  async analyzeCompetitors() {
    const competitorChannels = (process.env.COMPETITOR_CHANNELS || '').split(',');
    const competitorData = [];

    for (const channelId of competitorChannels) {
      if (!channelId) continue;
      
      try {
        const videos = await this.getChannelVideos(channelId);
        const analysis = this.analyzeVideoPerformance(videos);
        
        // Transform videos for viral outlier multiplier calculation
        const formattedVideos = (videos || []).map(v => ({
          channel: v.snippet?.channelTitle || channelId,
          title: v.snippet?.title || '',
          views: parseInt(v.statistics?.viewCount, 10) || 0,
          url: `https://www.youtube.com/watch?v=${v.id}`
        }));
        const viralOutliers = analyzeViralOutliers(formattedVideos, 1.8);

        competitorData.push({
          channelId,
          topPerformingTopics: analysis.topTopics,
          averageViews: analysis.avgViews,
          uploadFrequency: analysis.frequency,
          viralOutliers: viralOutliers.outliers.slice(0, 5),
          formulaBreakdown: viralOutliers.formulaBreakdown
        });
      } catch (error) {
        this.logger.error(`Failed to analyze competitor ${channelId}:`, error);
      }
    }

    return competitorData;
  }

  findViralOutliers(videos, minMultiplier = 1.5) {
    return analyzeViralOutliers(videos, minMultiplier);
  }

  async getChannelVideos(channelId) {
    const youtube = this.credentials.getYouTubeClient();
    
    try {
      const response = await youtube.search.list({
        part: 'snippet',
        channelId: channelId,
        maxResults: 20,
        order: 'date',
        type: 'video'
      });

      const videoIds = response.data.items.map(item => item.id.videoId).join(',');
      
      const videoDetails = await youtube.videos.list({
        part: 'statistics,snippet',
        id: videoIds
      });

      return videoDetails.data.items;
    } catch (error) {
      this.logger.error(`Failed to get videos for channel ${channelId}:`, error);
      return [];
    }
  }

  analyzeVideoPerformance(videos) {
    if (!videos || videos.length === 0) {
      return { topTopics: [], avgViews: 0, frequency: 0 };
    }

    const topics = {};
    let totalViews = 0;

    videos.forEach(video => {
      const title = video.snippet.title.toLowerCase();
      const views = parseInt(video.statistics?.viewCount, 10) || 0;
      totalViews += views;

      // Extract topics from title
      const keywords = this.extractKeywords(title);
      keywords.forEach(keyword => {
        if (!topics[keyword]) topics[keyword] = { count: 0, views: 0, evidence: [] };
        topics[keyword].count++;
        topics[keyword].views += views;
        topics[keyword].evidence.push({
          url: `https://www.youtube.com/watch?v=${video.id}`,
          title: video.snippet.title,
          publisher: video.snippet.channelTitle || 'Configured competitor channel',
          publishedAt: video.snippet.publishedAt,
          sourceType: 'video'
        });
      });
    });

    const topTopics = Object.entries(topics)
      .sort((a, b) => b[1].views - a[1].views)
      .slice(0, 10)
      .map(([topic, data]) => ({ topic, avgViews: data.views / data.count, evidence: data.evidence.slice(0, 5) }));

    return {
      topTopics,
      avgViews: totalViews / videos.length,
      frequency: videos.length
    };
  }

  extractKeywords(text) {
    // Simple keyword extraction
    const stopWords = ['the', 'is', 'at', 'which', 'on', 'and', 'a', 'an', 'as', 'are', 'was', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'could', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now'];
    
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3 && !stopWords.includes(word));
  }

  mergeTrendData(trends, competitors) {
    const mergedTopics = new Map();

    // Add trending topics
    trends.forEach(trend => {
      const keywords = this.extractKeywords(trend.title);
      keywords.forEach(keyword => {
        if (!mergedTopics.has(keyword)) {
          mergedTopics.set(keyword, { score: 0, sources: [], evidence: [] });
        }
        const topic = mergedTopics.get(keyword);
        topic.score += trend.viewCount / 1000000; // Normalize by millions
        topic.sources.push('trending');
        topic.evidence.push({
          url: trend.url,
          title: trend.title,
          publisher: trend.publisher,
          publishedAt: trend.publishedAt,
          sourceType: 'video'
        });
      });
    });

    // Add competitor topics
    competitors.forEach(competitor => {
      if (competitor.topPerformingTopics) {
        competitor.topPerformingTopics.forEach(({ topic, avgViews, evidence = [] }) => {
          if (!mergedTopics.has(topic)) {
            mergedTopics.set(topic, { score: 0, sources: [], evidence: [] });
          }
          const topicData = mergedTopics.get(topic);
          topicData.score += avgViews / 100000; // Normalize
          topicData.sources.push('competitor');
          topicData.evidence.push(...evidence);
        });
      }
    });

    // Convert to array and sort by score
    return Array.from(mergedTopics.entries())
      .map(([topic, data]) => ({ topic, ...data }))
      .map(item => ({
        ...item,
        evidence: [...new Map(item.evidence.filter(source => source.url).map(source => [source.url, source])).values()].slice(0, 5)
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
  }

  async generateContentStrategy(requestedTopic = null) {
    try {
      let topic, angle, targetAudience, contentType;

      const normalizedTopic = this.normalizeRequestedTopic(requestedTopic);
      if (normalizedTopic) {
        this.logger.info(`Normalizing requested topic: "${requestedTopic}" -> "${normalizedTopic}"`);
      }
      requestedTopic = normalizedTopic;

      const aiStrategy = await this.generateContentStrategyWithAI(requestedTopic);
      if (aiStrategy) {
        await this.db.saveContentStrategy(aiStrategy);
        this.logger.info(`Generated AI strategy for: ${aiStrategy.topic}`);
        return aiStrategy;
      }

      this.logger.info('Using template content strategy generation');
      if (requestedTopic) {
        topic = requestedTopic;
        angle = await this.generateAngle(topic);
      } else {
        // Select from trending topics
        const selectedTopic = this.selectOptimalTopic();
        topic = selectedTopic.topic;
        angle = await this.generateAngle(topic);
      }

      // Determine target audience
      targetAudience = await this.identifyTargetAudience(topic);

      // Select content type
      contentType = this.selectContentType(topic);

      // Generate content calendar entry
      const strategy = {
        topic,
        angle,
        targetAudience,
        contentType,
        language: this.detectLanguage(topic) || (['Quiz', 'Quiz_visuals', 'Quiz_short'].includes(contentType) ? 'hi' : 'en'),
        keywords: this.extractKeywords(topic),
        estimatedViews: this.predictViews(topic),
        bestPublishTime: this.calculateBestPublishTime(),
        competitorAnalysis: this.getCompetitorInsights(topic),
        createdAt: new Date().toISOString()
      };

      // Save to database
      await this.db.saveContentStrategy(strategy);

      this.logger.info(`Generated strategy for: ${topic}`);
      return strategy;
    } catch (error) {
      this.logger.error('Failed to generate content strategy:', error);
      throw error;
    }
  }

  // Operator-supplied topics can arrive as raw, unstructured sentences (the
  // "now i want to cratea a video series..." case). Extract the core subject
  // so the script writer and image model get something teachable to work with.
  normalizeRequestedTopic(requestedTopic) {
    if (!requestedTopic) return null;
    let topic = String(requestedTopic).trim().replace(/\s+/g, ' ');
    if (!topic) return null;

    const noisePatterns = [
      /^now\s+i\s+want\s+(to\s+)?cratea?\s+a?\s*video\s+series\s+where\s+i\s+am\s+going\s+to\s+/i,
      /^how\s+to\s+now\s+i\s+want\s+/i,
      /\s+series\s+where\s+i\s+am\s+going\s+to\s+build\s+/i,
      /\s+so\s+in\s+my\s+[\w\s]+?\s+project\s+but\s+first\s+video\s+should\s+be\s+/i,
      /\s+but\s+first\s+video\s+should\s+be\s+/i,
      /\s+7\s+day\s+series\s+so\s+/i,
      /\s+so\s+/i
    ];
    for (const pattern of noisePatterns) {
      topic = topic.replace(pattern, '').trim();
    }
    topic = topic.replace(/^(how to|how\s+to\s+now|how to|how to)\s+/i, '').trim();

    // A video topic should be a short, concrete subject — anything longer than
    // ~15 words is a plan, not a topic.
    const words = topic.split(/\s+/);
    if (words.length > 15) {
      topic = words.slice(0, 15).join(' ');
    }

    // Never let a topic be a bare stop-word or a fragment with no real subject.
    const meaningful = words.filter(w => w.length > 3 && !['want', 'cratea', 'series', 'going', 'build', 'video', 'feature', 'first', 'explain', 'everything', 'about'].includes(w.toLowerCase()));
    if (meaningful.length === 0) {
      return null;
    }

    return topic.replace(/\s+/g, ' ').trim();
  }

  async researchAndPlanChannel(channelStrategy) {
    const targetCount = Math.max(1, Math.min(5, Number(channelStrategy.videos_per_run || 1)));
    await this.analyzeTrends();

    const recentRows = await this.db.getAllRows(
      "SELECT topic, created_at FROM content_strategies WHERE created_at >= datetime('now', '-90 days') ORDER BY created_at DESC LIMIT 50"
    );
    const approvedLearnings = this.db.listLearningRecommendations
      ? await this.db.listLearningRecommendations({ status: 'approved', limit: 10 })
      : [];
    const signals = this.trendingTopics.slice(0, 15).map(item => ({
      topic: item.topic,
      score: Number(item.score || 0),
      sources: [...new Set(item.sources || [])],
      evidence: item.evidence || []
    }));
    const sourceCatalog = [...new Map(
      signals.flatMap(signal => signal.evidence || []).map(source => [source.url, source])
    ).values()].slice(0, 30);
    const signalSources = new Set(signals.flatMap(signal => signal.sources));
    const researchSources = [
      ...(signalSources.has('trending') ? ['YouTube most-popular videos'] : []),
      ...(signalSources.has('competitor') ? ['Configured competitor channels'] : []),
      ...(recentRows.length ? ['Channel content history'] : []),
      ...(approvedLearnings.length ? ['Operator-approved channel performance learnings'] : [])
    ];
    const research = {
      generatedAt: new Date().toISOString(),
      sources: researchSources.length ? researchSources : ['No usable live signals returned; evergreen strategy fallback'],
      signals,
      sourceCatalog,
      recentTopics: recentRows.map(row => row.topic),
      competitorChannelsAnalyzed: this.competitorData.length,
      approvedLearnings: approvedLearnings.map(item => ({
        category: item.category,
        title: item.title,
        rationale: item.rationale,
        confidence: item.confidence,
        proposedChange: item.proposedChange
      }))
    };

    let plan = await this.generateAutonomousPlanWithAI(channelStrategy, research, targetCount);
    plan = this.normalizeAutonomousPlan(plan, channelStrategy, targetCount, research);
    if (plan.length < targetCount) {
      const fallback = this.buildFallbackAutonomousPlan(channelStrategy, research, targetCount);
      plan = this.normalizeAutonomousPlan([...plan, ...fallback], channelStrategy, targetCount, research);
    }

    return { research, plan };
  }

  async generateAutonomousPlanWithAI(channelStrategy, research, targetCount) {
    if (!this.aiTextService.isAvailable()) return [];
    const prompt = `You are the strategy lead for an autonomous YouTube channel.
Turn the channel strategy and the supplied research signals into a focused content plan.
Return only a valid JSON array with exactly ${targetCount} items using this shape:
[{"topic":"specific video topic","pillar":"one exact content pillar from the supplied strategy","angle":"distinct audience-relevant angle","rationale":"why this advances the channel objective using the supplied evidence","format":"explainer|tutorial|list|review|story","length":"short|medium|long","sourceUrls":["exact URL from the supplied source catalog"]}]

Channel objective: ${channelStrategy.objective}
Audience: ${channelStrategy.audience}
Value proposition: ${channelStrategy.value_proposition || 'not specified'}
Content pillars: ${(channelStrategy.contentPillars || []).join(', ')}
Preferred format: ${channelStrategy.default_format}
Preferred length: ${channelStrategy.default_length}
Success metric: ${channelStrategy.success_metric || 'not specified'}
Primary KPI: ${channelStrategy.primary_kpi || 'views'}
Target: ${channelStrategy.target_value || 'not set'} per ${channelStrategy.target_window_days || 28} days
Monthly production budget: ${channelStrategy.monthly_budget ?? 'not set'} ${channelStrategy.outcome_currency || 'USD'}
Constraints: ${channelStrategy.constraints || 'none'}
Research signals: ${JSON.stringify(research.signals)}
Allowed source catalog: ${JSON.stringify(research.sourceCatalog)}
Recent topics to avoid repeating: ${JSON.stringify(research.recentTopics)}
Operator-approved performance learnings to apply: ${JSON.stringify(research.approvedLearnings)}

Do not invent trend data, statistics, sources, URLs, or factual claims. Use only exact URLs from the supplied source catalog. Apply only the supplied approved learnings; pending or rejected recommendations are not authorized. Prefer evergreen topics when the supplied signals are weak. Learnings with category "audience_demand" are audience-requested topics mined from real comments on published videos; prefer planning a video that directly answers one when it fits the channel objective, and cite it in the rationale.`;

    try {
      const response = await this.aiTextService.generateText(prompt, { maxTokens: 1800, temperature: 0.65 });
      const parsed = this.parseAIJsonResponse(response);
      return Array.isArray(parsed) ? parsed : Array.isArray(parsed.plan) ? parsed.plan : [];
    } catch (error) {
      this.logger.warn(`AI channel plan failed; using evidence-aware fallback: ${error.message}`);
      return [];
    }
  }

  buildFallbackAutonomousPlan(channelStrategy, research, targetCount) {
    const recent = new Set(research.recentTopics.map(topic => String(topic).toLowerCase()));
    const readableSignals = research.signals
      .map(signal => signal.topic)
      .filter(topic => topic.includes(' ') && topic.length >= 8 && !recent.has(topic.toLowerCase()));
    const pillars = channelStrategy.contentPillars || [];
    const pillarTopics = pillars.map(pillar => `${pillar}: a practical guide for ${channelStrategy.audience}`);
    const candidates = [...readableSignals, ...pillarTopics, ...this.getEvergreenFallbackTopics()];

    return candidates.slice(0, targetCount).map((topic, index) => ({
      topic,
      pillar: pillars.find(pillar => topic.toLowerCase().includes(String(pillar).toLowerCase())) || pillars[index % Math.max(1, pillars.length)] || '',
      angle: `${topic} through the lens of ${channelStrategy.value_proposition || channelStrategy.objective}`,
      rationale: readableSignals.includes(topic)
        ? 'Matches a current YouTube or configured competitor signal and fits the channel strategy.'
        : research.approvedLearnings.length
          ? `Builds an evergreen topic from the channel strategy while applying approved learning: ${research.approvedLearnings[0].title}.`
          : 'Builds an evergreen topic from the channel strategy when live research signals are limited.',
      format: index === 0 ? channelStrategy.default_format : ['explainer', 'tutorial', 'list'][index % 3],
      length: channelStrategy.default_length,
      sourceUrls: research.signals.find(signal => signal.topic === topic)?.evidence?.map(source => source.url) || []
    }));
  }

  normalizeAutonomousPlan(plan, channelStrategy, targetCount, research = {}) {
    const formats = new Set(['explainer', 'tutorial', 'list', 'review', 'story']);
    const lengths = new Set(['short', 'medium', 'long']);
    const allowedSourceUrls = new Set((research.sourceCatalog || []).map(source => source.url));
    const pillars = channelStrategy.contentPillars || [];
    const seen = new Set();
    return plan
      .map(item => ({
        topic: String(item.topic || '').trim().slice(0, 200),
        pillar: pillars.find(pillar => String(pillar).toLowerCase() === String(item.pillar || '').trim().toLowerCase()) || '',
        angle: String(item.angle || '').trim().slice(0, 500),
        rationale: String(item.rationale || '').trim().slice(0, 1000),
        format: formats.has(String(item.format || '').toLowerCase())
          ? String(item.format).toLowerCase()
          : channelStrategy.default_format,
        length: lengths.has(String(item.length || '').toLowerCase())
          ? String(item.length).toLowerCase()
          : channelStrategy.default_length,
        sourceUrls: [...new Set((Array.isArray(item.sourceUrls) ? item.sourceUrls : [])
          .map(url => String(url))
          .filter(url => allowedSourceUrls.has(url)))]
      }))
      .filter(item => {
        const key = item.topic.toLowerCase();
        if (!item.topic || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, targetCount);
  }

  async generateContentStrategyWithAI(requestedTopic = null) {
    if (!this.aiTextService.isAvailable()) {
      this.logger.info('Using template content strategy generation because no AI text provider is configured');
      return null;
    }

    const prompt = `You are the lead content strategist for "ExamIQ Bharat", India's top educational and family GK YouTube channel.
Channel Audience: Indian students preparing for competitive exams (SSC CGL, Railway RRB, UPSC, State Police), school/college students, and Indian families/elders who love Ramayan, Mahabharat, and Indian history/culture trivia.
Channel Language: Hindi (Devanagari) educational quiz format.

Return only valid JSON with this exact shape:
{
  "topic": "specific Hindi educational GK topic title",
  "angle": "distinct content angle with high student curiosity",
  "targetAudience": "SSC, Railway, UPSC, State PCS aspirants & general Indian learners",
  "contentType": "Quiz",
  "language": "hi",
  "keywords": ["keyword1", "keyword2", "keyword3"]
}

Requested topic: ${requestedTopic || 'none'}
Core Indian GK Pillars (Choose strictly from these):
1. General Science & Biology (जीव विज्ञान - कोशिका, मानव शरीर, रक्त परिसंचरण, विटामिन्स, रोग व उपचार)
2. General Science & Chemistry/Physics (अम्ल-क्षार-लवण, pH मान, आवर्त सारणी, प्रमुख मात्रक, भौतिक राशियां, वैज्ञानिक खोजें व आविष्कार)
3. High-Yield Static GK (प्रमुख पुस्तकें और लेखक, भारत के राष्ट्रीय उद्यान व वन्यजीव अभयारण्य, प्रमुख लोक नृत्य व त्यौहार, बांध व नदी परियोजनाएं)
4. Indian History (प्राचीन भारत - मौर्य/गुप्त काल, मध्यकालीन भारत - सल्तनत व मुग़ल काल, आधुनिक भारत, 1857 की क्रांति, स्वतंत्रता संग्राम सेनानी)
5. Indian Constitution & Polity (भारतीय संविधान, प्रमुख अनुच्छेद, मौलिक अधिकार व कर्तव्य, राष्ट्रपति, संसद, संविधान संशोधन)
6. Indian Geography (भारत की नदियां, पर्वत श्रृंखलाएं, प्रमुख दर्रे, झीलें, भारत के राज्य व सीमाएं)
7. First in India & World (भारत में प्रथम - पुरुष व महिला, प्रमुख सम्मान, भारत रत्न, नोबेल पुरस्कार)

Rules:
- NEVER generate Western business, corporate MBA, self-help, or tech topics (e.g. negotiation, productivity, side hustles).
- Always set "contentType": "Quiz" and "language": "hi".`;

    try {
      const response = await this.aiTextService.generateText(prompt, {
        maxTokens: 1000,
        temperature: 0.7
      });
      const parsed = this.parseAIJsonResponse(response);
      const topic = String(parsed.topic || requestedTopic || '').trim();

      if (!topic) {
        throw new Error('AI strategy response missing topic');
      }

      const contentType = this.normalizeContentType(parsed.contentType, topic);
      const keywords = Array.isArray(parsed.keywords) && parsed.keywords.length > 0
        ? parsed.keywords.map(keyword => String(keyword).trim()).filter(Boolean)
        : this.extractKeywords(topic);
      const language = this.detectLanguage(parsed.language) ||
        this.detectLanguage(topic) ||
        (['Quiz', 'Quiz_visuals', 'Quiz_short'].includes(contentType) ? 'hi' : 'en');

      this.logger.info(`Using AI content strategy via ${this.aiTextService.providerName}`);
      return {
        topic,
        angle: String(parsed.angle || await this.generateAngle(topic)).trim(),
        targetAudience: String(parsed.targetAudience || await this.identifyTargetAudience(topic)).trim(),
        contentType,
        language,
        keywords,
        estimatedViews: this.predictViews(topic),
        bestPublishTime: this.calculateBestPublishTime(),
        competitorAnalysis: this.getCompetitorInsights(topic),
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      this.logger.warn(`AI content strategy failed; using template fallback: ${error.message}`);
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

  normalizeContentType(contentType, topic = '') {
    const normalized = String(contentType || '').trim();
    if (normalized.toLowerCase() === 'quiz_short') {
      return 'Quiz_short';
    }
    if (normalized.toLowerCase() === 'quiz_short_no_image') {
      return 'Quiz_short_no_image';
    }
    if (normalized.toLowerCase() === 'quiz_visuals') {
      return 'Quiz_visuals';
    }

    const t = String(topic).toLowerCase();
    const quizSignals = ['quiz', 'mcq', 'gk', 'general knowledge', 'questions and answers', 'question and answer', 'प्रश्न', 'सामान्य ज्ञान', 'वस्तुनिष्ठ'];
    if (quizSignals.some(sig => t.includes(sig))) {
      return 'Quiz';
    }

    const allowed = new Set(['Tutorial', 'Explainer', 'List', 'Review', 'Story', 'News', 'Quiz', 'Quiz_visuals', 'Quiz_short', 'Quiz_short_no_image']);
    const titleCased = normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();

    return allowed.has(titleCased) ? titleCased : this.selectContentType(topic);
  }

  // Quiz channels serve Hindi-speaking exam audiences; everything else defaults
  // to English unless the topic itself asks for a language.
  detectLanguage(...values) {
    const text = values.filter(Boolean).join(' ');
    if (/[\u0900-\u097F]/.test(text)) return 'hi';
    if (/\b(hindi|hinglish)\b|हिंदी|हिन्दी/i.test(text)) return 'hi';
    if (/\b(english|angrezi)\b/i.test(text)) return 'en';
    return null;
  }
  selectOptimalTopic() {
    // Use scoring algorithm to select best topic
    const recentTopics = this.getRecentTopics();

    const scoredTopics = this.trendingTopics
      .filter(topic => !recentTopics.includes(topic.topic))
      .map(topic => ({
        ...topic,
        finalScore: topic.score * this.getSeasonalMultiplier(topic.topic) * this.getAudienceMultiplier(topic.topic)
      }))
      .sort((a, b) => b.finalScore - a.finalScore);

    // Single keywords scraped from trending titles ("crown", "official") make
    // meaningless video topics — only use a trend that reads like a real subject.
    const readable = scoredTopics.find(t => t.topic.trim().includes(' ') && t.topic.trim().length >= 8);
    if (readable) {
      return readable;
    }

    const fallbackTopics = this.getEvergreenFallbackTopics();
    const pick = fallbackTopics[Math.floor(Math.random() * fallbackTopics.length)];
    this.logger.info(`Template mode: no readable trending topic available — using evergreen topic "${pick}"`);
    return { topic: pick, score: 1 };
  }

  getEvergreenFallbackTopics() {
    return [
      'सामान्य विज्ञान (General Science): जीव विज्ञान (Biology) के 50 सबसे महत्वपूर्ण प्रश्न | Science GK',
      'भारत का संविधान: 50 सबसे महत्वपूर्ण अनुच्छेद और प्रश्न | Indian Polity GK Quiz',
      'भारत का इतिहास: प्राचीन से आधुनिक भारत के 50 महत्वपूर्ण प्रश्न | Indian History GK Quiz',
      'भारत का भूगोल: प्रमुख नदियां, पर्वत और राष्ट्रीय उद्यान | Indian Geography GK Quiz',
      'सामान्य विज्ञान: रसायन व भौतिक विज्ञान (Chemistry & Physics) के 50 महत्वपूर्ण प्रश्न | Science GK',
      'भारत में प्रथम (First in India): सबसे ज्यादा पूछे जाने वाले सामान्य ज्ञान प्रश्न | Static GK',
      'प्रमुख पुस्तकें और लेखक (Books and Authors): Static GK Top 50 Most Repeated Questions',
      'भारत के प्रमुख राष्ट्रीय उद्यान एवं वन्यजीव अभयारण्य: Static GK 50 महत्वपूर्ण प्रश्न',
      'भारत के प्रमुख ऐतिहासिक युद्ध और 1857 की क्रांति | Indian History Battle GK Quiz',
      'भारत की नदियां एवं बांध: प्रतियोगी परीक्षाओं के महत्वपूर्ण प्रश्न | Indian Rivers GK Quiz',
      'प्रसिद्ध वैज्ञानिक खोजें और आविष्कार सामान्य ज्ञान | Science Inventions GK Quiz',
      'भारत के प्रमुख लोक नृत्य एवं त्यौहार: Static GK 50 महत्वपूर्ण प्रश्न',
      'मानव शरीर (Human Anatomy) एवं विटामिन्स: Biology GK Top 50 Questions | SSC Railway',
      'गुप्त वंश एवं मौर्य साम्राज्य: भारतीय इतिहास के 50 सबसे महत्वपूर्ण प्रश्न | History GK Quiz',
      'विश्व व भारत का भूगोल: सौरमंडल और पृथ्वी से जुड़े महत्वपूर्ण प्रश्न | Solar System & Geography GK'
    ];
  }

  async generateAngle(topic) {
    // Generate unique angle for the topic
    const angles = [
      `The Ultimate Guide to ${topic}`,
      `${topic}: What Nobody Is Telling You`,
      `How ${topic} Will Change Everything in ${new Date().getFullYear()}`,
      `The Hidden Truth About ${topic}`,
      `${topic} Explained in 5 Minutes`,
      `Why ${topic} Is More Important Than You Think`,
      `${topic}: Expert Secrets Revealed`,
      `The Complete ${topic} Tutorial for Beginners`
    ];

    return angles[Math.floor(Math.random() * angles.length)];
  }

  async identifyTargetAudience(topic) {
    // Audience identification tailored for educational reach
    const defaultAudience = process.env.TARGET_AUDIENCE || 'Students, competitive exam aspirants (SSC, UPSC, Railway, State PCS), and lifelong learners';
    const audiences = {
      education: defaultAudience,
      tech: 'Tech enthusiasts, developers, engineering students',
      business: 'Entrepreneurs, business owners, professionals',
      entertainment: 'General audience, entertainment seekers',
      lifestyle: 'Lifestyle enthusiasts, self-improvement seekers'
    };

    const category = this.categorize(topic);
    return audiences[category] || defaultAudience;
  }

  categorize(topic) {
    const categories = {
      education: [
        'learn', 'tutorial', 'how to', 'guide', 'course', 'study',
        'gk', 'quiz', 'exam', 'upsc', 'ssc', 'rrb', 'ntpc', 'pcs',
        'question', 'questions', 'mcq', 'general knowledge', 'samanya gyan',
        'history', 'geography', 'polity', 'science', 'facts', 'lucent',
        'competitive', 'prashn', 'hindi gk', 'current affairs'
      ],
      tech: ['technology', 'software', 'app', 'ai', 'code', 'programming', 'crypto', 'blockchain'],
      business: ['business', 'money', 'finance', 'startup', 'entrepreneur', 'marketing'],
      lifestyle: ['life', 'health', 'fitness', 'food', 'travel', 'fashion']
    };

    const topicLower = topic.toLowerCase();
    
    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => topicLower.includes(keyword))) {
        return category;
      }
    }

    return 'education';
  }

  selectContentType(topic) {
    const types = [
      { type: 'Quiz', suitableFor: ['quiz', 'mcq', 'gk', 'general knowledge', 'questions and answers', 'question and answer', 'प्रश्न', 'सामान्य ज्ञान', 'वस्तुनिष्ठ'] },
      { type: 'Tutorial', suitableFor: ['how to', 'guide', 'learn'] },
      { type: 'List', suitableFor: ['best', 'top', 'worst'] },
      { type: 'Review', suitableFor: ['review', 'vs', 'comparison'] },
      { type: 'Explainer', suitableFor: ['what is', 'why', 'explained'] },
      { type: 'News', suitableFor: ['breaking', 'latest', 'new'] },
      { type: 'Story', suitableFor: ['story', 'journey', 'experience'] }
    ];

    const topicLower = topic.toLowerCase();
    
    for (const contentType of types) {
      if (contentType.suitableFor.some(keyword => topicLower.includes(keyword))) {
        return contentType.type;
      }
    }

    return 'Explainer';
  }

  predictViews(topic) {
    // Simplified view prediction based on topic score
    const topicData = this.trendingTopics.find(t => t.topic === topic);
    const baseViews = topicData ? topicData.score * 10000 : 5000;
    const variance = baseViews * 0.3;
    return Math.floor(baseViews + (Math.random() * variance * 2) - variance);
  }

  calculateBestPublishTime() {
    // Analyze best publishing times
    const bestTimes = [
      { day: 'Tuesday', hour: 14 },
      { day: 'Wednesday', hour: 14 },
      { day: 'Thursday', hour: 14 },
      { day: 'Friday', hour: 15 },
      { day: 'Saturday', hour: 10 },
      { day: 'Sunday', hour: 10 }
    ];

    const selected = bestTimes[Math.floor(Math.random() * bestTimes.length)];
    const nextDate = this.getNextWeekday(selected.day);
    nextDate.setHours(selected.hour, 0, 0, 0);
    
    return nextDate.toISOString();
  }

  getNextWeekday(dayName) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const targetDay = days.indexOf(dayName);
    const today = new Date();
    const currentDay = today.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
    const nextDate = new Date(today);
    nextDate.setDate(today.getDate() + daysUntilTarget);
    return nextDate;
  }

  getCompetitorInsights(topic) {
    // Get insights from competitor analysis
    return this.competitorData
      .filter(competitor => 
        competitor.topPerformingTopics.some(t => 
          t.topic.toLowerCase().includes(topic.toLowerCase())
        )
      )
      .map(competitor => ({
        channelId: competitor.channelId,
        averageViews: competitor.averageViews,
        relevantVideos: competitor.topPerformingTopics.filter(t => 
          t.topic.toLowerCase().includes(topic.toLowerCase())
        )
      }));
  }

  getRecentTopics() {
    // Get topics used in last 7 days to avoid repetition
    return this.historicalPerformance
      .filter(content => {
        const contentDate = new Date(content.createdAt);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return contentDate > weekAgo;
      })
      .map(content => content.topic);
  }

  getSeasonalMultiplier(topic) {
    // Adjust score based on seasonal relevance
    const month = new Date().getMonth();
    const seasonalTopics = {
      winter: ['christmas', 'holiday', 'new year', 'winter'],
      spring: ['spring', 'easter', 'garden'],
      summer: ['summer', 'vacation', 'beach', 'travel'],
      fall: ['halloween', 'thanksgiving', 'autumn', 'back to school']
    };

    const season = month < 3 ? 'winter' : month < 6 ? 'spring' : month < 9 ? 'summer' : 'fall';
    const topicLower = topic.toLowerCase();
    
    if (seasonalTopics[season].some(keyword => topicLower.includes(keyword))) {
      return 1.5;
    }
    
    return 1.0;
  }

  getAudienceMultiplier(topic) {
    // Adjust score based on target audience size
    const category = this.categorize(topic);
    const multipliers = {
      education: 1.35,
      tech: 1.2,
      business: 1.1,
      entertainment: 1.3,
      lifestyle: 1.15
    };
    
    return multipliers[category] || 1.25;
  }
}

module.exports = { ContentStrategyAgent };
