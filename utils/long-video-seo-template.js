// Permanent Viral SEO Metadata & Query Block for Long Quiz Videos
// Proven high-CTR and high-recommendation query block requested by channel owner

const VIRAL_BULLET_QUERIES = `cover topic in this video
your queries 👇👇
🔻. gk
🔻. general knowledge
🔻. important gk questions and answer
🔻. quiz test
🔻. br gk study
🔻. important gk
🔻. quiz test
🔻. competitive quiz
🔻. competitive general knowledge
🔻. gk in hindi
🔻. general knowledge quiz
🔻. quiz questions
🔻. general knowledge questions
🔻. gk quiz
🔻. general knowledge questions with answers
🔻. gk question in hindi 
🔻. gk question answer
🔻. india gk
🔻. hindi gk
🔻. samanya gyan
🔻. gk questions
🔻. india gk in hindi
🔻. 2021 gk questions and answers
🔻. lucent gk
🔻. lucent gk
🔻. lucent gk in hindi video
🔻. lucent gk in hindi
🔻. lucent geography in hindi
🔻. lucent geography
🔻. geography gk question
🔻. geography gk in hindi
🔻. lucent 1000 question
🔻. lucent 1000 prashn
🔻. lucent gk ka nichod
🔻. lucent gk important question
🔻. lucent gk important question in hindi
🔻. lucent gk important topics
🔻. lucent ka nichod science
🔻. lucent for ssc cgl
🔻. lucent for ssc
🔻. lucent for railway 
🔻. gk
🔻. gk questions and answers
🔻. gk question
🔻. general knowledge
🔻. br gk study
🔻. gk questions
🔻. g k 
🔻. general knowledge question
🔻. g k questions and answers
🔻. gk ke question
🔻. question
🔻. general knowledge questions and answers
🔻. samanya gyan
🔻. g.k questions in hindi
🔻. gk question answer
🔻. #sarkarinaukarigk
🔻. gk ke sawal
🔻. knowledge
🔻. question answer
🔻. general knowledge questions
🔻. gk knowledge
🔻. जनरल नॉलेज
🔻. जीके
🔻. gk quiz
🔻. g.k
🔻. gk ka question
🔻. ips question and answer
🔻. gk
🔻. gk question`;

const VIRAL_KEYWORD_PARAGRAPH = `GK, General Knowledge, Important GK Questions and answer for competitive exams, Competitive Exams, Quiz Test, mysterious story, Important gk, Quiz test, competitive quiz, competitive general knowledge, GK in Hindi, general knowledge quiz, quiz questions, general knowledge questions, gk quiz, general knowledge questions with answers, gk question in hindi, GK Question Answer, India GK, hindi gk, samanya gyan, gk questions, india gk in hindi, 2022 gk questions and answers, lucent gk, lucent gk, lucent gk in hindi video, lucent GK in hindi, lucent geography in hindi, lucent geography, geography gk question, geography gk in hindi, lucent 1000 question, lucent 1000 prashn, lucent gk ka nichod, lucent gk important question, lucent gk important question in hindi, lucent gk important topics, lucent ka nichod science, lucent for ssc cgl, lucent for ssc, lucent for railway, geography gk, lucent mcq, lucent mcq in hindi, lucent book gk, gk, gk questions and answers, gk question, general knowledge, gk questions, g k, general knowledge question, g k questions and answers, gk ke question, question, general knowledge questions and answers, samanya gyan, g.k questions in hindi, gk question answer, #sarkarinaukarigk, gk ke sawal, general knowledge, question answer,  general knowledge questions, gk knowledge, जनरल नॉलेज, जीके, gk quiz, g.k, gk ka question, ips question and answer, gk, gk question, gk afroz, gk questions, gktoday, gk tricks, gk study adda, gk video, gk live, gk by kumar Gaurav sir, gk by khan sir, gk today current affairs, question, सामान्य ज्ञान, general knowledge ke question, gk knowledge, gk dijiye, general class, general knowledge ki video in hindi, general knowledge gk, general knowledge questions and answers, General knowledge video, General knowledge 2023, general knowledge for kids, general knowledge quiz, general knowledge ke question, #gkquestion , Gk, gk question, gk questions and answers, general knowledge, g k, g k questions and answers, general knowledge questions and answers, gk question answer, question answer, question,  जीके, g.k questions in hindi, general knowledge questions, knowledge, general knowledge question, g. k, quiz, g k question, gk gs, gk ke sawal, gk ka question, जीके क्वेश्चन, gk 2020, gk 2021, gk 2022, gk 2023,  बीआर जीके स्टडी, g.k. question with answer, answer, lucent gk, GK 2021,  GK 2022, GK 2023, g,k,  जीके के सवाल, gk general knowledge,  जनरल नॉलेज, gk knowledge, gk questions and answers 2022, gk questions and answers 2023, gk questions and answers in hindi, GK Police, GK IAS, GK IPS, g. k. question in hindi, janral nolej in hindi, tense, current affairs, g.k questions, gk today current affairs, जी के, GK, GK BR, Gk, gK, G K, Gk quiz, GK BR, #gk,  #G_K, #g_k,  #G.K, GK ki Video, Good sawal, सवाल आपके जवाब हमारे , GK ka सवाल, जीके., GK., GK Hindi Question, सवाल,  question and answers, new gk question, new gk questions, hindi question, gk question gk question, answer, gk dijiye, general knowledge question answer, जीके जीके, g k 2022, g k 2023,  gk gk gk, GK GK GK, जीके का क्वेश्चन, samanya gyan, GK number 1, GK Question, gk question,  gK question, Gk GK gK जीके gk #gk`;

const VIRAL_HASHTAGS = `#gk
#lucentgk
#generalknowledge
#gk2026
#ssccgl
#sscgd
#rrbntpc
#railwaygk
#ias
#gkquiz
#gkquestion
#gkhindi
#sarkarinaukarigk
#सामान्यज्ञान
#जीके2026
#brgkstudy
#khansir
#gkfacts
#gkstudy 
#gktoday 
#gkinhindi 
#gkquestion`;

const SHORTS_VIRAL_HASHTAGS = `#Shorts #GKQuiz #GKInHindi #GeneralKnowledge #LucentGK #SSCGD #RailwayNTPC #Education #ExamPrep #gk`;

/**
 * Builds the complete permanent Viral Description for any video (Long or Shorts).
 * Strictly guarantees the user's viral bullet queries and keyword block are always present,
 * while safely keeping total length under YouTube's 5000-character description limit.
 */
function buildUniversalViralDescription({
  title = '',
  brand = 'ExamIQ Bharat',
  topic = 'General Knowledge',
  chapters = [],
  isShort = false,
  year = new Date().getFullYear()
}) {
  const fallbackTitle = isShort
    ? `Top 5 GK Questions and answers | General Knowledge | gk in hindi | #Shorts #GK`
    : `Top 50 Gk Questions and answers | General Knowledge | gk question | gk in hindi | SSC, Railway GK`;
  const cleanTitle = (title || fallbackTitle).trim();

  const titleHeader = cleanTitle;

  const ctaBlock = isShort
    ? `\n\n🎯 Target Exams: SSC CGL, CHSL, GD ${year}, Railway NTPC, Group D, State Police
👇 पूरे टेस्ट और व्याख्या के लिए नीचे दिए गए "Related Video" लिंक पर क्लिक करें!
🔔 रोज़ाना नए GK GS टेस्ट के लिए ${brand} को अभी Subscribe करें!
💬 आज के टेस्ट में आपका स्कोर कितना रहा? कमेंट में बताएं!`
    : `\n\n🎯 Target Exams: SSC CGL, CHSL, GD ${year}, Railway NTPC, Group D, State Police & All Competitive Exams
📘 Complete High-Yield Exam Preparation Series by ${brand}
🔔 सब्सक्राइब करें और बेल आइकन दबाएं ताकि कोई भी क्लास मिस न हो!`;

  const hashtagsBlock = isShort ? SHORTS_VIRAL_HASHTAGS : VIRAL_HASHTAGS;

  const timestampsBlock = !isShort && chapters && chapters.length > 0
    ? `\n\n⏱️ TIMESTAMPS:\n${chapters.map(ch => `${ch.time} ${ch.title}`).join('\n')}`
    : '';

  const prefix = `${titleHeader}${ctaBlock}${timestampsBlock}\n\n${VIRAL_BULLET_QUERIES}\n\n`;
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

function buildShortVideoDescription(opts = {}) {
  return buildUniversalViralDescription({ ...opts, isShort: true });
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
