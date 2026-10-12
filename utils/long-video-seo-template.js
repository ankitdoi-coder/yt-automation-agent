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

const VIRAL_KEYWORD_PARAGRAPH = `GK, General Knowledge, Important GK Questions and answer for competitive exams, Competitive Exams, Quiz Test, mysterious story, Important gk, Quiz test, competitive quiz, competitive general knowledge, GK in Hindi, general knowledge quiz, quiz questions, general knowledge questions, gk quiz, general knowledge questions with answers, gk question in hindi, GK Question Answer, India GK, hindi gk, samanya gyan, gk questions, india gk in hindi, 2022 gk questions and answers, lucent gk, lucent gk, lucent gk in hindi video, lucent GK in hindi, lucent geography in hindi, lucent geography, geography gk question, geography gk in hindi, lucent 1000 question, lucent 1000 prashn, lucent gk ka nichod, lucent gk important question, lucent gk important question in hindi, lucent gk important topics, lucent ka nichod science, lucent for ssc cgl, lucent for ssc, lucent for railway, geography gk, lucent mcq, lucent mcq in hindi, lucent book gk, gk, gk questions and answers, gk question, general knowledge, gk questions, g k, general knowledge question, g k questions and answers, gk ke question, question, general knowledge questions and answers, samanya gyan, g.k questions in hindi, gk question answer, #sarkarinaukarigk, gk ke sawal, general knowledge, question answer,  general knowledge questions, gk knowledge, जनरल नॉलेज, जीके, gk quiz, g.k, gk ka question, ips question and answer, gk, gk question, gk afroz, gk questions, gktoday, gk tricks, gk study adda, gk video, gk live, gk by kumar Gaurav sir, gk by khan sir, gk today current affairs, question, सामान्य ज्ञान, general knowledge ke question, gk knowledge, gk dijiye, general class, general knowledge ki video in hindi, general knowledge gk, general knowledge questions and answers, General knowledge video, General knowledge 2023, general knowledge for kids, general knowledge quiz, general knowledge ke question, #gkquestion , Gk, gk question, gk questions and answers, general knowledge, g k, g k questions and answers, general knowledge questions and answers, gk question answer, question answer, question,  जीके, g.k questions in hindi, general knowledge questions, knowledge, general knowledge question, g. k, quiz, g k question, gk gs, gk ke sawal, gk ka question, जीके क्वेश्चन, gk 2020, gk 2021, gk 2022, gk 2023,  बीआर जीके स्टडी, g.k. question with answer, answer, lucent gk, GK 2021,  GK 2022, GK 2023, g,k,  जीके के सवाल, gk general knowledge,  जनरल नॉलेज, gk knowledge, gk questions and answers 2022, gk questions and answers 2023, gk questions and answers in hindi, GK Police, GK IAS, GK IPS, g. k. question in hindi, janral nolej in hindi, tense, current affairs, g.k questions, gk today current affairs, जी के, GK, GK BR, Gk, gK, G K, Gk quiz, GK BR, #gk,  #G_K, #g_k,  #G.K, GK ki Video, Good sawal, सवाल आपके जवाब हमारे , GK ka सवाल, जीके., GK., GK Hindi Question, सवाल,  question and answers, new gk question, new gk questions, hindi question, gk question gk question, answer, gk dijiye, general knowledge question answer, जीके जीके, g k 2022, g k 2023,  gk gk gk, GK GK GK, जीके का क्वेश्चन, samanya gyan, GK number 1, GK Question, gk question,  gK question, Gk GK gK जीके gk`;

const VIRAL_HASHTAGS = `#gk
#lucentgk
#generalknowledge
#gk2022
#ias
#futuretakgk 
#gkquiz
#gkquestion
#gkhindi
#sarkarinaukarigk
#सामान्यज्ञान
#जीके2022
#brgkstudy
#khansir
#gkfacts
#gkstudy 
#gktoday 
#gkinhindi 
#gkquestion`;

/**
 * Builds the complete permanent Long Video description.
 * Ensures the viral queries block requested by channel owner is permanently integrated,
 * while fitting cleanly inside YouTube's 5000-character description limit.
 */
function buildLongVideoDescription({
  title = '',
  brand = 'ExamIQ Bharat',
  topic = 'General Knowledge',
  chapters = [],
  year = new Date().getFullYear()
}) {
  const cleanTitle = title || `Top GK Questions in Hindi (${year}) | Lucent GK Quiz | ${brand}`;

  const header = `Welcome to ${brand}!
${cleanTitle}

🎯 DAILY QUIZ SCORE CHALLENGE:
How many questions can you answer correctly? Test your general knowledge and drop your score (e.g. 22/25) in the comments below! 🏆`;

  const timestampsBlock = chapters && chapters.length > 0
    ? `\n\n⏱️ TIMESTAMPS:\n${chapters.map(ch => `${ch.time} ${ch.title}`).join('\n')}`
    : '';

  const resources = `\n\n📖 STUDY RESOURCES:
• NCERT Official Portal: https://ncert.nic.in
• Wikipedia Knowledge Base: https://en.wikipedia.org

🔔 Subscribe to ${brand} for daily high-scoring GK quizzes & exam prep!

⚠️ DISCLAIMER:
This video is created strictly for educational purposes (Section 107 Copyright Act 1976).
© ${year} ${brand}. All Rights Reserved.`;

  // Calculate remaining space for keyword paragraph to strictly guarantee <= 4950 chars (under YouTube 5000 limit)
  const fixedLength = header.length + timestampsBlock.length + VIRAL_BULLET_QUERIES.length + VIRAL_HASHTAGS.length + resources.length + 30;
  const availableForParagraph = Math.max(500, 4950 - fixedLength);

  let trimmedParagraph = VIRAL_KEYWORD_PARAGRAPH.slice(0, availableForParagraph);
  const lastCommaIndex = trimmedParagraph.lastIndexOf(',');
  if (lastCommaIndex > 200) {
    trimmedParagraph = trimmedParagraph.slice(0, lastCommaIndex);
  }

  return `${header}${timestampsBlock}

${VIRAL_BULLET_QUERIES}

${trimmedParagraph}

${VIRAL_HASHTAGS}
${resources}`.trim();
}

module.exports = {
  VIRAL_BULLET_QUERIES,
  VIRAL_KEYWORD_PARAGRAPH,
  VIRAL_HASHTAGS,
  buildLongVideoDescription
};
