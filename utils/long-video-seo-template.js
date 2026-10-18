// Permanent Viral SEO Metadata & Query Block for Exam Preparation Videos
// Optimized for YouTube Education Algorithm (Category 27), High CTR & Exam Audience Clustering

const VIRAL_BULLET_QUERIES = `cover topic in this video
your queries 👇👇
🔻. gk
🔻. general knowledge
🔻. important gk questions and answer
🔻. ssc gd 2026 gk questions
🔻. railway ntpc gk gs in hindi
🔻. ssc cgl 2026 general awareness
🔻. static gk for competitive exams
🔻. lucent gk in hindi
🔻. lucent gk ka nichod
🔻. lucent 1000 important questions
🔻. samanya gyan 2026
🔻. bharat ka itihas gk
🔻. bharat ka samvidhan gk
🔻. indian polity gk questions
🔻. geography gk in hindi
🔻. general science gk in hindi
🔻. competitive exam gk quiz
🔻. gk questions and answers
🔻. gk in hindi
🔻. general knowledge quiz
🔻. gk quiz test
🔻. up police constable gk
🔻. bihar police gk gs
🔻. rpf si constable gk
🔻. delhi police gk
🔻. all competitive exam pyq gk
🔻. lucent gk book mcq
🔻. top 50 gk questions
🔻. gk question answer in hindi
🔻. india gk questions
🔻. samanya gyan important question
🔻. sarkari exam gk preparation
🔻. examiq bharat gk`;

const VIRAL_KEYWORD_PARAGRAPH = `GK, General Knowledge, Important GK Questions and answer for competitive exams, Competitive Exams, SSC CGL 2026, SSC GD 2026, Railway NTPC 2026, RRB Group D, RPF Constable, UP Police, State PCS, Lucent GK, Lucent GK in Hindi, Lucent Samanya Gyan, Lucent Geography, Lucent History, Indian Constitution GK, Bharat ka Samvidhan MCQ, Static GK in Hindi, General Knowledge Quiz, GK Questions and Answers, GK Question Answer, India GK, Hindi GK, Samanya Gyan, GK Questions, Lucent GK ka Nichod, Lucent GK Important Question, Lucent for SSC CGL, Lucent for Railway, Geography GK, Lucent MCQ in Hindi, Lucent Book GK, General Knowledge Questions, GK Knowledge, जनरल नॉलेज, जीके, GK Quiz, Samanya Gyan GK, Sarkari Naukri GK, GK ke Sawal, General Knowledge Video, GK Questions and Answers 2026, GK in Hindi, GK Police, GK IAS, GK Railway, General Knowledge Question Answer, ExamIQ Bharat, ExamIQ GK`;

const VIRAL_HASHTAGS = `#ExamIQ
#ExamIQBharat
#gk
#lucentgk
#generalknowledge
#gk2026
#ssccgl
#sscgd2026
#rrbntpc
#railwaygk
#staticgk
#gkinhindi
#samanyagyan
#sarkarinaukarigk
#सामान्यज्ञान
#जीके2026
#policeexam
#upscprelims
#gkquiz
#gkquestion`;

const SHORTS_VIRAL_HASHTAGS = `#Shorts #GKQuiz #GKInHindi #GeneralKnowledge #LucentGK #SSCGD2026 #RailwayNTPC #Education #ExamPrep #ExamIQ`;

/**
 * Builds the complete permanent Viral Description for any video (Long or Shorts).
 * Injects a natural language exam NLP block at the very top so YouTube's recommendation
 * model correctly associates the video with competitive exams, SSC, Railway & Education.
 * Safely keeps total length under YouTube's 5000-character description limit.
 */
function buildUniversalViralDescription({
  title = '',
  brand = 'ExamIQ Bharat',
  topic = 'General Knowledge',
  subject = '',
  subjectHindi = '',
  chapters = [],
  isShort = false,
  year = new Date().getFullYear()
}) {
  const fallbackTitle = isShort
    ? `Top 5 GK Questions and answers | General Knowledge | gk in hindi | #Shorts #GK`
    : `Top 50 Gk Questions and answers | General Knowledge | gk question | gk in hindi | SSC, Railway GK`;
  const cleanTitle = (title || fallbackTitle).trim();

  const titleHeader = cleanTitle;
  const activeSubject = subjectHindi || subject || topic || 'सामान्य ज्ञान (GK GS)';

  // High-intent exam NLP paragraph for YouTube's candidate generation & topic clustering algorithm
  const nlpHook = isShort
    ? `🎯 ${cleanTitle} — ${brand} द्वारा सरकारी प्रतियोगी परीक्षाओं (SSC CGL, GD ${year}, Railway NTPC, Police) के लिए अति महत्वपूर्ण सामान्य ज्ञान (GK GS) रैपिड फायर क्विज़।`
    : `🎯 ${cleanTitle}\n\nइस विशेष वीडियो क्लास में ${brand} द्वारा ${activeSubject} के पिछले 15 वर्षों में बार-बार पूछे गए सबसे महत्वपूर्ण और संभावित प्रश्न उत्तर (Top PYQs) व्याख्या सहित शामिल किए गए हैं।\n\n📌 यह क्लास विशेष रूप से SSC CGL, SSC CHSL, SSC GD ${year}, Railway RRB NTPC, Group D, RPF, UP Police, Bihar Police, Delhi Police, State PCS और सभी केंद्र व राज्य स्तरीय प्रतियोगी परीक्षाओं के संपूर्ण रिवीजन के लिए अति महत्वपूर्ण है।\n\n💡 सभी प्रश्न नए परीक्षा पैटर्न पर आधारित हैं। परीक्षा से पहले इन प्रश्नों को अच्छी तरह रट लें और अपनी तैयारी को मजबूत करें।`;

  const ctaBlock = isShort
    ? `\n\n🎯 Target Exams: SSC CGL, CHSL, GD ${year}, Railway NTPC, Group D, State Police
👇 पूरे टेस्ट और व्याख्या के लिए नीचे दिए गए "Related Video" लिंक पर क्लिक करें!
🔔 रोज़ाना नए GK GS टेस्ट के लिए ${brand} को अभी Subscribe करें!
💬 आज के टेस्ट में आपका स्कोर कितना रहा? कमेंट में बताएं!`
    : `\n\n🎯 Target Exams: SSC CGL, CHSL, GD ${year}, Railway NTPC, Group D, State Police & All Competitive Exams
📘 Complete High-Yield Exam Preparation Series by ${brand}
🔔 सब्सक्राइब करें और बेल आइकन दबाएं ताकि कोई भी क्लास मिस न हो!
💬 आज के 50 प्रश्नों में आपका स्कोर कितना रहा? कमेंट करके जरूर बताएं! 🏆`;

  const studyResources = !isShort
    ? `\n\n📚 Official Educational References & Study Links:
• NCERT Official Portal: https://ncert.nic.in
• Legislative Department (Constitution of India): https://legislative.gov.in
• Staff Selection Commission (SSC): https://ssc.gov.in
• Railway Recruitment Control Board (RRB): https://indianrailways.gov.in`
    : '';

  const hashtagsBlock = isShort ? SHORTS_VIRAL_HASHTAGS : VIRAL_HASHTAGS;

  const timestampsBlock = !isShort && chapters && chapters.length > 0
    ? `\n\n⏱️ TIMESTAMPS:\n${chapters.map(ch => `${ch.time} ${ch.title}`).join('\n')}`
    : '';

  const prefix = `${titleHeader}\n\n${nlpHook}${ctaBlock}${studyResources}${timestampsBlock}\n\n${VIRAL_BULLET_QUERIES}\n\n`;
  const suffix = `\n\n${hashtagsBlock}`;

  // YouTube allows max 5000 characters. Keep safety buffer at 4950 chars.
  const availableForKeywords = Math.max(200, 4950 - prefix.length - suffix.length);

  let trimmedKeywords = VIRAL_KEYWORD_PARAGRAPH.slice(0, availableForKeywords);
  const lastCommaIndex = trimmedKeywords.lastIndexOf(',');
  if (lastCommaIndex > 200 && trimmedKeywords.length < VIRAL_KEYWORD_PARAGRAPH.length) {
    trimmedKeywords = trimmedKeywords.slice(0, lastCommaIndex);
  }

  const finalDescription = `${prefix}${trimmedKeywords}${suffix}`.trim();
  return finalDescription.slice(0, 4950);
}

function buildLongVideoDescription(opts = {}) {
  return buildUniversalViralDescription({ ...opts, isShort: false });
}

function buildShortVideoDescription({
  title = '',
  brand = 'ExamIQ Bharat',
  topic = 'General Knowledge',
  questions = [],
  year = new Date().getFullYear()
} = {}) {
  const cleanTitle = (title || 'Top 5 GK Questions in Hindi | GK Quiz #Shorts').trim();
  const cleanTopic = (topic || 'सामान्य ज्ञान').trim();

  let questionsList = '';
  if (Array.isArray(questions) && questions.length > 0) {
    const validQs = questions.slice(0, 5).map((q, idx) => {
      const qText = typeof q === 'string' ? q : (q.question || '');
      return `Q${idx + 1}. ${qText.trim()}`;
    }).filter(q => q.length > 6);
    if (validQs.length > 0) {
      questionsList = '\n\n📌 इस वीडियो में पूछे गए महत्वपूर्ण सवाल:\n' + validQs.join('\n');
    }
  }

  return `🎯 ${cleanTitle}

इस GK Shorts वीडियो में हमने प्रतियोगी परीक्षाओं (SSC CGL, GD ${year}, Railway NTPC, Police Exam) के लिए अति महत्वपूर्ण और रोचक सामान्य ज्ञान (GK Quiz) के सवाल शामिल किए हैं।${questionsList}

💬 आज के टेस्ट में आपका 5 में से कितना स्कोर रहा? कमेंट बॉक्स में जरूर बताएं! 🎯
🔔 ऐसे ही रोज़ाना नए GK Tests और Shorts के लिए ${brand} को Subscribe करें!

🔍 Queries Solved:
• GK in Hindi
• General Knowledge Quiz
• Lucent GK Important Questions
• Samanya Gyan for Competitive Exams
• Viral GK Shorts

#shorts #gk #gkinhindi #generalknowledge #gkquiz #lucentgk #examiq`.trim();
}

module.exports = {
  VIRAL_BULLET_QUERIES,
  VIRAL_KEYWORD_PARAGRAPH,
  VIRAL_HASHTAGS,
  SHORTS_VIRAL_HASHTAGS,
  buildUniversalViralDescription,
  buildLongVideoDescription,
  buildShortVideoDescription
};
