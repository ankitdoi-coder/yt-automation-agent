/**
 * Facebook Reels & Posts Exam GK Content Vault
 * High-Demand Geopolitics, Static GK, Math IQ Quiz & General Science
 * 100% Educational, Brand-Safe, Highly Engaging for General Public & Aspirants.
 */

const fs = require('fs');
const path = require('path');
const { scoreHook } = require('../utils/hook-scorer');

const EXAM_GK_QUESTIONS = [
  // ==========================================
  // 🌍 1. Geopolitics & World Knowledge (अंतरराष्ट्रीय राजनीति व दुनिया का ज्ञान)
  // ==========================================
  {
    id: "geo_nuke_01",
    category: "geopolitics",
    topic: "भू-राजनीति (Geopolitics)",
    hookBar: "हर नागरिक को यह पता होना चाहिए",
    title: "दुनिया में सबसे ज्यादा परमाणु हथियार किसके पास हैं?",
    question: "दुनिया में सबसे ज्यादा परमाणु हथियार (Nuclear Weapons) किस देश के पास हैं?",
    questionLines: [
      "1. दुनिया में सबसे ज्यादा",
      "परमाणु हथियार किस",
      "देश के पास हैं? ☢️🌍"
    ],
    options: [
      { letter: "A", text: "अमेरिका (USA)" },
      { letter: "B", text: "रूस (Russia)" },
      { letter: "C", text: "चीन (China)" },
      { letter: "D", text: "उत्तर कोरिया (North Korea)" }
    ],
    correctOption: "B",
    answerText: "B) रूस (लगभग 5,580 परमाणु हथियार)",
    voiceQuestion: "सवाल ध्यान से सुनिए: दुनिया में सबसे ज्यादा परमाणु हथियार किस देश के पास हैं?",
    voiceTimer: "सोचने के लिए 3 सेकंड, आपका समय शुरू होता है अब!",
    voiceAnswer: "इसका सही जवाब है ऑप्शन B, रूस! रूस के पास 5,580 से अधिक परमाणु हथियार हैं, जबकि अमेरिका के पास लगभग 5,044 हैं।",
    explanation: "SIPRI रिपोर्ट के अनुसार रूस दुनिया का सबसे बड़ा परमाणु शक्ति संपन्न देश है, जिसके पास 5,580 से अधिक हथियार हैं।",
    aiPrompt: "cinematic 3D world map showing nuclear superpowers Russia and USA with glowing geopolitical defense telemetry, high detail 4k realism",
    tags: ["#ExamIQ", "#Geopolitics", "#NuclearWeapons", "#WorldGK", "#GeneralKnowledge", "#Reels", "#Shorts"]
  },
  {
    id: "geo_military_02",
    category: "geopolitics",
    topic: "ग्लोबल डिफेंस (Military Power)",
    hookBar: "दुनिया की सबसे ताकतवर सेना",
    title: "दुनिया की सबसे शक्तिशाली सेना किस देश की है?",
    question: "ग्लोबल फायरपावर रैंकिंग के अनुसार दुनिया की सबसे शक्तिशाली सेना किस देश की है?",
    questionLines: [
      "1. दुनिया की सबसे शक्तिशाली",
      "सेना (Strongest Military)",
      "किस देश की है? 🎖️⚔️"
    ],
    options: [
      { letter: "A", text: "रूस (Russia)" },
      { letter: "B", text: "चीन (China)" },
      { letter: "C", text: "अमेरिका (USA)" },
      { letter: "D", text: "भारत (India)" }
    ],
    correctOption: "C",
    answerText: "C) अमेरिका (USA)",
    voiceQuestion: "ग्लोबल फायरपावर के अनुसार दुनिया की सबसे शक्तिशाली सेना किस देश की है?",
    voiceTimer: "3 सेकंड में सही जवाब सोचिए!",
    voiceAnswer: "सही जवाब है ऑप्शन C, अमेरिका! अमेरिका पहले स्थान पर है, रूस दूसरे, चीन तीसरे और भारत चौथे स्थान पर आता है।",
    explanation: "Global Firepower Index में अमेरिका का सैन्य बजट ($880+ अरब) और तकनीक दुनिया में नंबर 1 स्थान पर है।",
    aiPrompt: "powerful aircraft carrier fleet and modern stealth fighter jets flying over open ocean, military superpower realism 4k",
    tags: ["#ExamIQ", "#Geopolitics", "#MilitaryPower", "#USAMilitary", "#IndianArmy", "#WorldAffairs", "#Reels"]
  },
  {
    id: "geo_passport_03",
    category: "geopolitics",
    topic: "अंतरराष्ट्रीय संबंध (Global Index)",
    hookBar: "दुनिया का सबसे ताकतवर पासपोर्ट",
    title: "दुनिया का सबसे शक्तिशाली पासपोर्ट किस देश का है?",
    question: "हेनले पासपोर्ट इंडेक्स के अनुसार दुनिया का सबसे शक्तिशाली पासपोर्ट किस देश का है?",
    questionLines: [
      "1. दुनिया का सबसे शक्तिशाली",
      "पासपोर्ट (Strongest Passport)",
      "किस देश का है? 🛂✈️"
    ],
    options: [
      { letter: "A", text: "अमेरिका (USA)" },
      { letter: "B", text: "सिंगापुर (Singapore)" },
      { letter: "C", text: "जापान (Japan)" },
      { letter: "D", text: "जर्मनी (Germany)" }
    ],
    correctOption: "B",
    answerText: "B) सिंगापुर (Singapore)",
    voiceQuestion: "हेनले पासपोर्ट इंडेक्स के अनुसार दुनिया का सबसे ताकतवर पासपोर्ट किस देश का है?",
    voiceTimer: "दिमाग की बत्ती जलाओ, 3 सेकंड हैं आपके पास!",
    voiceAnswer: "सही उत्तर है ऑप्शन B, सिंगापुर! सिंगापुर के पासपोर्ट से 195 देशों में वीजा-मुक्त प्रवेश मिलता है।",
    explanation: "सिंगापुर के नागरिक दुनिया के 195 देशों में बिना वीजा या वीजा-ऑन-अराइवल के यात्रा कर सकते हैं।",
    aiPrompt: "golden luxurious biometric passport with world globe hologram and international airport lounge aesthetic 4k",
    tags: ["#ExamIQ", "#HenleyPassport", "#Singapore", "#WorldTravel", "#Geopolitics", "#Reels"]
  },
  {
    id: "geo_gold_04",
    category: "geopolitics",
    topic: "विश्व अर्थव्यवस्था (Global Economy)",
    hookBar: "दुनिया में सबसे ज्यादा सोने का भंडार",
    title: "दुनिया में सबसे ज्यादा सोने का भंडार किस देश के पास है?",
    question: "दुनिया में सबसे ज्यादा सोने का भंडार (Gold Reserves) किस देश के पास है?",
    questionLines: [
      "1. दुनिया में सबसे ज्यादा",
      "सोने का भंडार (Gold)",
      "किस देश के पास है? 🪙🏛️"
    ],
    options: [
      { letter: "A", text: "भारत (India)" },
      { letter: "B", text: "चीन (China)" },
      { letter: "C", text: "अमेरिका (USA)" },
      { letter: "D", text: "जर्मनी (Germany)" }
    ],
    correctOption: "C",
    answerText: "C) अमेरिका (8,133 टन सोना)",
    voiceQuestion: "दुनिया में सबसे ज्यादा सोने का आधिकारिक भंडार किस देश के पास है?",
    voiceTimer: "3 सेकंड का समय है आपके पास!",
    voiceAnswer: "इसका सही जवाब है ऑप्शन C, अमेरिका! अमेरिका के पास 8,133 टन सोना है, जो फोर्ट नॉक्स में सुरक्षित है।",
    explanation: "अमेरिका के पास दुनिया का 70% से अधिक विदेशी मुद्रा भंडार के बराबर 8,133 टन सोने का भंडार है।",
    aiPrompt: "vast fortified bank vault filled with stacked glittering 24 karat gold bullion bars, dramatic cinematic lighting 4k",
    tags: ["#ExamIQ", "#GoldReserves", "#EconomyGK", "#Geopolitics", "#GeneralKnowledge", "#Reels"]
  },

  // ==========================================
  // 📚 2. Static GK & Inventions (परीक्षा और ज्ञान के प्रमुख सवाल)
  // ==========================================
  {
    id: "gk_sci_laser",
    category: "static_gk",
    topic: "सामान्य विज्ञान (General Science)",
    hookBar: "परीक्षा में बार बार पूछे जाने वाले सवाल",
    title: "लेजर का आविष्कार किसने किया?",
    question: "लेजर (LASER) का आविष्कार किसने किया था?",
    questionLines: [
      "1. लेजर (LASER) का",
      "आविष्कार किसने",
      "किया था? 🔬⚡"
    ],
    options: [
      { letter: "A", text: "अल्बर्ट आइंस्टीन" },
      { letter: "B", text: "थियोडोर मेमन" },
      { letter: "C", text: "आइजैक न्यूटन" },
      { letter: "D", text: "मैक्स प्लांक" }
    ],
    correctOption: "B",
    answerText: "B) थियोडोर मेमन (Theodore Maiman)",
    voiceQuestion: "सवाल ध्यान से देखिए: लेजर का आविष्कार किसने किया था?",
    voiceTimer: "सोचने के लिए 3 सेकंड, आपका समय शुरू होता है अब!",
    voiceAnswer: "इसका सही जवाब है ऑप्शन B, थियोडोर मेमन! उन्होंने 1960 में पहला सफल रूबी लेजर बनाया था।",
    explanation: "थियोडोर मेमन ने 16 मई 1960 को रूबी क्रिस्टल की मदद से दुनिया का पहला कार्यशील लेजर बनाया था।",
    aiPrompt: "vintage physics laboratory glowing red ruby laser beam cutting through darkness, high tech historical invention 4k",
    tags: ["#ExamIQ", "#GeneralScience", "#LaserInvention", "#ScienceQuiz", "#SSCCGL", "#RailwayExam", "#Reels"]
  },
  {
    id: "stat_notes_01",
    category: "static_gk",
    topic: "भारतीय मुद्रा (Indian Currency)",
    hookBar: "99% लोग अपने पर्स के नोट को नहीं देखते",
    title: "₹500 के नए नोट के पीछे किसका चित्र छपा है?",
    question: "भारतीय ₹500 के नए नोट के पीछे किसका ऐतिहासिक चित्र छपा है?",
    questionLines: [
      "1. भारतीय ₹500 के नए",
      "नोट के पीछे किसका",
      "चित्र छपा है? 💵✨"
    ],
    options: [
      { letter: "A", text: "लाल किला (Red Fort)" },
      { letter: "B", text: "ताजमहल (Taj Mahal)" },
      { letter: "C", text: "मंगलयान (Mangalyaan)" },
      { letter: "D", text: "सांची का स्तूप (Sanchi Stupa)" }
    ],
    correctOption: "A",
    answerText: "A) लाल किला (Red Fort, Delhi)",
    voiceQuestion: "₹500 के नए नोट के पीछे किस ऐतिहासिक इमारत का चित्र छपा है?",
    voiceTimer: "3 सेकंड में सोचकर जवाब दीजिए!",
    voiceAnswer: "सही जवाब है ऑप्शन A, लाल किला! दिल्ली का लाल किला हमारे ₹500 के नोट पर अंकित है।",
    explanation: "₹500 के नोट पर लाल किला, ₹200 पर सांची स्तूप, और ₹100 पर गुजरात की 'रानी की वाव' छपी है।",
    aiPrompt: "crisp Indian 500 rupee banknote with iconic Red Fort monument in sharp high-resolution macro photography 4k",
    tags: ["#ExamIQ", "#IndianNotes", "#CurrencyGK", "#StaticGK", "#SSCStaticGK", "#GeneralKnowledge", "#Reels"]
  },
  {
    id: "stat_rail_02",
    category: "static_gk",
    topic: "भारतीय रेलवे (Indian Infrastructure)",
    hookBar: "भारत और दुनिया का सबसे बड़ा रेलवे प्लेटफॉर्म",
    title: "दुनिया का सबसे लंबा रेलवे प्लेटफॉर्म कौन सा है?",
    question: "वर्तमान में दुनिया का सबसे लंबा रेलवे प्लेटफॉर्म कौन सा है?",
    questionLines: [
      "1. दुनिया का सबसे लंबा",
      "रेलवे प्लेटफॉर्म",
      "कौन सा है? 🚆✨"
    ],
    options: [
      { letter: "A", text: "गोरखपुर (उत्तर प्रदेश)" },
      { letter: "B", text: "हुबली (श्री सिद्धारूढ़ स्वामीजी)" },
      { letter: "C", text: "खड़गपुर (पश्चिम बंगाल)" },
      { letter: "D", text: "कोल्लम (केरल)" }
    ],
    correctOption: "B",
    answerText: "B) हुबली (कर्नाटक - 1,507 मीटर)",
    voiceQuestion: "वर्तमान में दुनिया का सबसे लंबा रेलवे प्लेटफॉर्म कौन सा है?",
    voiceTimer: "सोचने के लिए 3 सेकंड, आपका समय शुरू होता है अब!",
    voiceAnswer: "सही जवाब है ऑप्शन B, कर्नाटक का हुबली स्टेशन! इसका प्लेटफॉर्म 1,507 मीटर लंबा है, इसने गोरखपुर को पीछे छोड़ा।",
    explanation: "कर्नाटक के श्री सिद्धारूढ़ स्वामीजी हुबली स्टेशन का प्लेटफॉर्म नं. 8 (1,507 मी.) दुनिया का सबसे लंबा प्लेटफॉर्म है।",
    aiPrompt: "massive illuminated Indian railway station platform at golden sunset with modern Vande Bharat train 4k",
    tags: ["#ExamIQ", "#IndianRailways", "#HubballiPlatform", "#StaticGK", "#RailwayNTPC", "#Reels"]
  },
  {
    id: "stat_isro_03",
    category: "static_gk",
    topic: "भारतीय अंतरिक्ष (Space Science)",
    hookBar: "भारत का गौरव: ISRO",
    title: "ISRO का मुख्यालय कहाँ स्थित है?",
    question: "भारतीय अंतरिक्ष अनुसंधान संगठन (ISRO) का मुख्यालय किस शहर में स्थित है?",
    questionLines: [
      "1. ISRO का मुख्यालय",
      "(Headquarters) किस शहर",
      "में स्थित है? 🚀✨"
    ],
    options: [
      { letter: "A", text: "नई दिल्ली" },
      { letter: "B", text: "बेंगलुरु (Bengaluru)" },
      { letter: "C", text: "हैदराबाद" },
      { letter: "D", text: "श्रीहरिकोटा" }
    ],
    correctOption: "B",
    answerText: "B) बेंगलुरु (Bengaluru)",
    voiceQuestion: "भारतीय अंतरिक्ष अनुसंधान संगठन यानी ISRO का मुख्यालय कहाँ स्थित है?",
    voiceTimer: "3 सेकंड में सही जवाब सोचिए!",
    voiceAnswer: "सही उत्तर है ऑप्शन B, बेंगलुरु! ISRO की स्थापना 15 अगस्त 1969 को हुई थी।",
    explanation: "ISRO का मुख्यालय बेंगलुरु (कर्नाटक) में है, जबकि रॉकेट प्रक्षेपण केंद्र श्रीहरिकोटा (आंध्र प्रदेश) में है।",
    aiPrompt: "majestic ISRO satellite launch rocket launching into starlit sky from Sriharikota, cinematic patriotic 4k",
    tags: ["#ExamIQ", "#ISRO", "#SpaceGK", "#StaticGK", "#ScienceQuiz", "#Chandrayaan", "#Reels"]
  },
  {
    id: "stat_polity_04",
    category: "static_gk",
    topic: "भारतीय संविधान (Constitution)",
    hookBar: "संविधान का हृदय और आत्मा",
    title: "डॉ. अम्बेडकर ने किस अनुच्छेद को 'संविधान की आत्मा' कहा?",
    question: "डॉ. बी.आर. अम्बेडकर ने किस अनुच्छेद को 'संविधान का हृदय और आत्मा' कहा था?",
    questionLines: [
      "1. डॉ. अम्बेडकर ने किस",
      "अनुच्छेद को 'संविधान की",
      "आत्मा' कहा? ⚖️📜"
    ],
    options: [
      { letter: "A", text: "अनुच्छेद 14 (समानता)" },
      { letter: "B", text: "अनुच्छेद 19 (स्वतंत्रता)" },
      { letter: "C", text: "अनुच्छेद 21 (जीवन का अधिकार)" },
      { letter: "D", text: "अनुच्छेद 32 (संवैधानिक उपचार)" }
    ],
    correctOption: "D",
    answerText: "D) अनुच्छेद 32 (संवैधानिक उपचार)",
    voiceQuestion: "बाबा साहेब अम्बेडकर ने किस अनुच्छेद को संविधान का हृदय और आत्मा कहा था?",
    voiceTimer: "3 सेकंड में कमेंट करके बताएं!",
    voiceAnswer: "सही उत्तर है ऑप्शन D, अनुच्छेद 32! इसके तहत नागरिक सीधे सुप्रीम कोर्ट में अपने अधिकारों की रक्षा मांग सकते हैं।",
    explanation: "अनुच्छेद 32 नागरिकों को मौलिक अधिकारों के उल्लंघन पर सीधे सर्वोच्च न्यायालय जाने का अधिकार देता है।",
    aiPrompt: "majestic Supreme Court of India building illuminated at sunset with constitution book and scales of justice, 4k",
    tags: ["#ExamIQ", "#IndianConstitution", "#Article32", "#PolityGK", "#SSCCGL", "#UPSC", "#Reels"]
  },

  // ==========================================
  // 🧠 3. Math IQ & Brain Teasers (गणित और दिमागी पहेलियां)
  // ==========================================
  {
    id: "math_quiz_01",
    category: "math_quiz",
    topic: "गणित पहेली (Math IQ Quiz)",
    hookBar: "99% लोग इसका गलत जवाब देते हैं",
    title: "100 का 20% का 50% कितना होगा?",
    question: "100 का 20% का 50% कितना होगा?",
    questionLines: [
      "1. 100 का 20% का",
      "50% कितना",
      "होगा? 🧠📐"
    ],
    options: [
      { letter: "A", text: "20" },
      { letter: "B", text: "10" },
      { letter: "C", text: "5" },
      { letter: "D", text: "50" }
    ],
    correctOption: "B",
    answerText: "B) 10",
    voiceQuestion: "दिमाग की कसरत: 100 का 20% का 50% कितना होगा?",
    voiceTimer: "कमेंट में उत्तर दें, 3 सेकंड हैं आपके पास!",
    voiceAnswer: "सही जवाब है ऑप्शन B, 10! क्योंकि 100 का 20% होता है 20, और 20 का 50% यानी आधा होता है 10!",
    explanation: "गणना: 100 × (20/100) = 20, और फिर 20 × (50/100) = 10।",
    aiPrompt: "intricate glowing mathematical equations and percentage symbols floating on clean academic blackboard 4k",
    tags: ["#ExamIQ", "#MathQuiz", "#BrainTeaser", "#MathTricks", "#IQTest", "#Reels", "#Shorts"]
  },
  {
    id: "math_quiz_02",
    category: "math_quiz",
    topic: "गणित पहेली (Math IQ Quiz)",
    hookBar: "BODMAS नियम: जल्दी से बताओ",
    title: "5 + 5 × 5 - 5 का मान क्या होगा?",
    question: "5 + 5 × 5 - 5 का सही मान क्या होगा?",
    questionLines: [
      "1. 5 + 5 × 5 - 5",
      "का सही मान",
      "क्या होगा? 🔢🧠"
    ],
    options: [
      { letter: "A", text: "45" },
      { letter: "B", text: "25" },
      { letter: "C", text: "0" },
      { letter: "D", text: "50" }
    ],
    correctOption: "B",
    answerText: "B) 25",
    voiceQuestion: "BODMAS नियम का चैलेंज: 5 जमा 5 गुणा 5 घटा 5 का मान क्या होगा?",
    voiceTimer: "3 सेकंड में सही उत्तर सोचिए!",
    voiceAnswer: "सही उत्तर है ऑप्शन B, 25! BODMAS के अनुसार पहले गुणा करेंगे 5 गुना 5 बराबर 25, फिर 5 जोड़कर 5 घटाएंगे तो 25 आएगा!",
    explanation: "BODMAS नियम: पहले Multiply (5×5=25), फिर Add (5+25=30), फिर Subtract (30-5=25)।",
    aiPrompt: "golden mathematical symbols floating in 3D geometric matrix with bold numbers 4k",
    tags: ["#ExamIQ", "#MathRiddle", "#BODMAS", "#MathPuzzle", "#IQChallenge", "#Reels"]
  },
  {
    id: "math_quiz_03",
    category: "math_quiz",
    topic: "गणित पहेली (Logical Puzzle)",
    hookBar: "आईक्यू टेस्ट: दिमाग लगाओ",
    title: "1 से 100 तक '9' कितनी बार आता है?",
    question: "1 से 100 तक की गिनती लिखने पर अंक '9' कुल कितनी बार आता है?",
    questionLines: [
      "1. 1 से 100 तक की गिनती",
      "में अंक '9' कितनी",
      "बार आता है? 🔢🤯"
    ],
    options: [
      { letter: "A", text: "10 बार" },
      { letter: "B", text: "19 बार" },
      { letter: "C", text: "20 बार" },
      { letter: "D", text: "21 बार" }
    ],
    correctOption: "C",
    answerText: "C) 20 बार (20 Times)",
    voiceQuestion: "चुनौती भरा सवाल: 1 से 100 तक की गिनती में अंक '9' कुल कितनी बार आता है?",
    voiceTimer: "3 सेकंड का समय है, कमेंट में उत्तर दें!",
    voiceAnswer: "सही जवाब है ऑप्शन C, 20 बार! 9, 19, 29... में 10 बार और 90 से 99 की लाइन में 11 बार (99 में दो बार), कुल 20 बार!",
    explanation: "इकाई स्थान पर 9 (10 बार) + दहाई स्थान पर 9 (90 से 99 तक 10 बार) = कुल 20 बार।",
    aiPrompt: "abstract matrix of glowing neon numerals cascading down in deep blue cyberspace 4k",
    tags: ["#ExamIQ", "#MathPuzzle", "#BrainRiddle", "#IQTest", "#MindGames", "#Reels"]
  },
  {
    id: "math_quiz_04",
    category: "math_quiz",
    topic: "दिमागी तर्कशक्ति (Reasoning IQ)",
    hookBar: "ज्यादातर लोग 300 मिनट बोलते हैं!",
    title: "बिल्लियां, चूहे और मिनट वाली पहेली",
    question: "यदि 3 बिल्लियां 3 चूहों को 3 मिनट में पकड़ती हैं, तो 100 बिल्लियां 100 चूहों को कितने मिनट में पकड़ेंगी?",
    questionLines: [
      "1. 3 बिल्लियां 3 चूहे 3 मिनट",
      "में पकड़ें, तो 100 बिल्लियां",
      "100 चूहे कब पकड़ेंगी? 🐱🐭"
    ],
    options: [
      { letter: "A", text: "100 मिनट" },
      { letter: "B", text: "3 मिनट" },
      { letter: "C", text: "1 मिनट" },
      { letter: "D", text: "300 मिनट" }
    ],
    correctOption: "B",
    answerText: "B) 3 मिनट (3 Minutes)",
    voiceQuestion: "सोच समझकर जवाब दीजिए: 3 बिल्लियां 3 चूहों को 3 मिनट में पकड़ती हैं, तो 100 बिल्लियां 100 चूहों को कितने मिनट में पकड़ेंगी?",
    voiceTimer: "3 सेकंड में सही उत्तर कमेंट करें!",
    voiceAnswer: "सही जवाब है ऑप्शन B, 3 मिनट! क्योंकि हर एक बिल्ली को एक चूहा पकड़ने में 3 मिनट ही लगते हैं!",
    explanation: "1 बिल्ली = 1 चूहा = 3 मिनट। इसलिए 100 बिल्लियां अपने-अपने 100 चूहों को एक साथ 3 मिनट में पकड़ लेंगी।",
    aiPrompt: "funny stylized 3D rendered animated clever cat wearing glasses looking at stopwatch 4k",
    tags: ["#ExamIQ", "#LogicPuzzle", "#Reasoning", "#BrainTeaser", "#RiddleTime", "#Reels"]
  },

  // ==========================================
  // 🔬 4. General Science (सामान्य विज्ञान व दैनिक जीवन)
  // ==========================================
  {
    id: "sci_tyre_01",
    category: "general_science",
    topic: "दैनिक विज्ञान (Everyday Science)",
    hookBar: "हवाई जहाज का यह रहस्य क्या आप जानते हैं?",
    title: "हवाई जहाज के टायरों में कौन सी गैस भरी जाती है?",
    question: "हवाई जहाज के टायरों में कौन सी गैस भरी जाती है?",
    questionLines: [
      "1. हवाई जहाज के टायरों",
      "में कौन सी गैस भरी",
      "जाती है? ✈️🛞"
    ],
    options: [
      { letter: "A", text: "ऑक्सीजन (Oxygen)" },
      { letter: "B", text: "नाइट्रोजन (Nitrogen)" },
      { letter: "C", text: "हाइड्रोजन (Hydrogen)" },
      { letter: "D", text: "हीलियम (Helium)" }
    ],
    correctOption: "B",
    answerText: "B) नाइट्रोजन (Nitrogen Gas)",
    voiceQuestion: "सवाल ध्यान से सुनिए: हवाई जहाज के टायरों में कौन सी गैस भरी जाती है?",
    voiceTimer: "3 सेकंड का समय है आपके पास!",
    voiceAnswer: "सही उत्तर है ऑप्शन B, नाइट्रोजन गैस! नाइट्रोजन अत्यधिक घर्षण और तापमान बदलने पर भी फैलती या फटती नहीं है।",
    explanation: "नाइट्रोजन सूखी और अक्रिय गैस है, जिससे लैंडिंग के दौरान भीषण घर्षण और गर्मी में भी टायर में आग लगने का खतरा नहीं होता।",
    aiPrompt: "modern commercial jumbo jet landing on tarmac with smoking tires in slow motion cinematic 4k",
    tags: ["#ExamIQ", "#EverydayScience", "#AviationGK", "#GeneralScience", "#ScienceFacts", "#Reels"]
  },
  {
    id: "sci_eye_02",
    category: "general_science",
    topic: "मानव शरीर (Human Anatomy)",
    hookBar: "मनुष्य की आंख का कैमरा",
    title: "मनुष्य की आंख कितने मेगापिक्सल की होती है?",
    question: "वैज्ञानिक शोध के अनुसार मनुष्य की आंख लगभग कितने मेगापिक्सल की होती है?",
    questionLines: [
      "1. मनुष्य की आंख लगभग",
      "कितने मेगापिक्सल (MP)",
      "की होती है? 👁️📸"
    ],
    options: [
      { letter: "A", text: "108 मेगापिक्सल" },
      { letter: "B", text: "576 मेगापिक्सल" },
      { letter: "C", text: "240 मेगापिक्सल" },
      { letter: "D", text: "1000 मेगापिक्सल" }
    ],
    correctOption: "B",
    answerText: "B) 576 मेगापिक्सल (576 MP)",
    voiceQuestion: "क्या आप जानते हैं: मनुष्य की आंख कितने मेगापिक्सल की होती है?",
    voiceTimer: "दिमाग लगाओ, 3 सेकंड हैं आपके पास!",
    voiceAnswer: "इसका सही जवाब है ऑप्शन B, 576 मेगापिक्सल! हमारी आंखें एक बार में 576 मेगापिक्सल का स्पष्ट दृश्य कैप्चर करती हैं।",
    explanation: "डॉ. रोजर क्लार्क के वैज्ञानिक शोध के अनुसार मानव आंख की दृश्य क्षमता लगभग 576 मेगापिक्सल कैमरे के बराबर है।",
    aiPrompt: "macro detailed close up of human iris reflecting cosmos and digital camera sensor aperture 4k",
    tags: ["#ExamIQ", "#HumanBody", "#ScienceGK", "#BiologyFacts", "#EyeMegapixel", "#Reels"]
  },
  {
    id: "sci_bone_03",
    category: "general_science",
    topic: "जीव विज्ञान (Biology)",
    hookBar: "कंक्रीट से भी ज्यादा मजबूत हड्डी",
    title: "मानव शरीर की सबसे मजबूत हड्डी कौन सी है?",
    question: "मानव शरीर की सबसे मजबूत और सबसे लंबी हड्डी कौन सी होती है?",
    questionLines: [
      "1. मानव शरीर की सबसे",
      "मजबूत हड्डी (Strongest Bone)",
      "कौन सी होती है? 🦴💪"
    ],
    options: [
      { letter: "A", text: "जबड़े की हड्डी (Jaw Bone)" },
      { letter: "B", text: "फीमर / जांघ की हड्डी (Femur)" },
      { letter: "C", text: "रीढ़ की हड्डी (Spine)" },
      { letter: "D", text: "टिबिया (Tibia)" }
    ],
    correctOption: "B",
    answerText: "B) फीमर (Femur - जांघ की हड्डी)",
    voiceQuestion: "मानव शरीर की सबसे मजबूत और लंबी हड्डी कौन सी होती है?",
    voiceTimer: "3 सेकंड में कमेंट करके बताएं!",
    voiceAnswer: "सही जवाब है ऑप्शन B, फीमर यानी जांघ की हड्डी! यह हड्डी स्टील और कंक्रीट से भी ज्यादा भार सहने में सक्षम है।",
    explanation: "फीमर जांघ की हड्डी होती है जो शरीर के वजन का 30 गुना तक वजन सह सकती है। सबसे छोटी हड्डी कान की 'स्टेप्स' है।",
    aiPrompt: "3D medical glowing visualization of human skeletal system highlighting femur thigh bone 4k",
    tags: ["#ExamIQ", "#HumanAnatomy", "#BiologyGK", "#ScienceQuiz", "#SSCExam", "#Reels"]
  },
  {
    id: "gk_sci_01",
    category: "general_science",
    topic: "जीव विज्ञान (Biology)",
    hookBar: "कोशिका का पावर हाउस",
    title: "कोशिका का 'पावर हाउस' (Powerhouse of Cell)",
    question: "मानव शरीर में कोशिका का 'पावर हाउस' (Powerhouse of the Cell) किसे कहा जाता है?",
    questionLines: [
      "1. कोशिका का 'पावर हाउस'",
      "(Powerhouse of Cell)",
      "किसे कहा जाता है? 🔬⚡"
    ],
    options: [
      { letter: "A", text: "राइबोसोम (Ribosome)" },
      { letter: "B", text: "माइटोकॉन्ड्रिया (Mitochondria)" },
      { letter: "C", text: "लाइसोसोम (Lysosome)" },
      { letter: "D", text: "गॉल्जी काय (Golgi Body)" }
    ],
    correctOption: "B",
    answerText: "B) माइटोकॉन्ड्रिया (Mitochondria)",
    voiceQuestion: "सवाल ध्यान से सुनिए: कोशिका का पावर हाउस किसे कहा जाता है?",
    voiceTimer: "सोचने के लिए 3 सेकंड, आपका समय शुरू होता है अब!",
    voiceAnswer: "इसका सही जवाब है ऑप्शन B, माइटोकॉन्ड्रिया! यह कोशिका में ऊर्जा यानी ATP उत्पन्न करता है।",
    explanation: "माइटोकॉन्ड्रिया भोजन के ऑक्सीकरण द्वारा ऊर्जा (ATP) का निर्माण करता है, इसलिए इसे कोशिका का ऊर्जा गृह कहते हैं।",
    aiPrompt: "intricate 3D biological visualization of mitochondria inside a human cell, glowing ATP energy power plant 4k",
    tags: ["#ExamIQ", "#GeneralScience", "#ScienceGK", "#BiologyGK", "#SSCCGL", "#RailwayGK", "#Reels"]
  },
  {
    id: "gk_sci_02",
    category: "general_science",
    topic: "भौतिक विज्ञान (Physics)",
    hookBar: "सूर्य की किरणें और पृथ्वी",
    title: "सूर्य का प्रकाश पृथ्वी तक पहुँचने का समय",
    question: "सूर्य के प्रकाश को पृथ्वी तक पहुँचने में औसतन कितना समय लगता है?",
    questionLines: [
      "1. सूर्य के प्रकाश को",
      "पृथ्वी तक पहुँचने में",
      "कितना समय लगता है? ☀️🌍"
    ],
    options: [
      { letter: "A", text: "5 मिनट 20 सेकंड" },
      { letter: "B", text: "8 मिनट 20 सेकंड" },
      { letter: "C", text: "10 मिनट 10 सेकंड" },
      { letter: "D", text: "6 मिनट 45 सेकंड" }
    ],
    correctOption: "B",
    answerText: "B) 8 मिनट 20 सेकंड (लगभग 500 सेकंड)",
    voiceQuestion: "सूर्य के प्रकाश को पृथ्वी तक पहुँचने में औसतन कितना समय लगता है?",
    voiceTimer: "3 सेकंड में सही जवाब सोचिए!",
    voiceAnswer: "इसका सही जवाब है ऑप्शन B, 8 मिनट 20 सेकंड, यानी लगभग 500 सेकंड!",
    explanation: "सूर्य से पृथ्वी की दूरी लगभग 14.96 करोड़ किमी है और प्रकाश की गति 3 लाख किमी प्रति सेकंड होती है।",
    aiPrompt: "sunlight rays traveling through deep cosmic space reaching blue planet earth, glowing solar radiation 4k",
    tags: ["#ExamIQ", "#PhysicsGK", "#GeneralScience", "#SpaceScience", "#RailwayNTPC", "#SSCExam", "#Reels"]
  },
  {
    id: "gk_sci_03",
    category: "general_science",
    topic: "रसायन विज्ञान (Chemistry)",
    hookBar: "हंसाने वाली चमत्कारी गैस",
    title: "लाफिंग गैस का रासायनिक नाम",
    question: "लाफिंग गैस (Laughing Gas) का रासायनिक नाम क्या है?",
    questionLines: [
      "1. लाफिंग गैस (Laughing Gas)",
      "का रासायनिक नाम",
      "क्या है? 🧪😄"
    ],
    options: [
      { letter: "A", text: "नाइट्रिक ऑक्साइड (NO)" },
      { letter: "B", text: "नाइट्रस ऑक्साइड (N2O)" },
      { letter: "C", text: "नाइट्रोजन डाइऑक्साइड (NO2)" },
      { letter: "D", text: "सल्फर डाइऑक्साइड (SO2)" }
    ],
    correctOption: "B",
    answerText: "B) नाइट्रस ऑक्साइड (N2O)",
    voiceQuestion: "लाफिंग गैस यानी हंसाने वाली गैस का रासायनिक नाम क्या होता है?",
    voiceTimer: "दिमाग की बत्ती जलाओ, 3 सेकंड हैं आपके पास!",
    voiceAnswer: "सही जवाब है ऑप्शन B, नाइट्रस ऑक्साइड (N2O)! इसे सूंघने पर तंत्रिका तंत्र उत्तेजित होता है और हंसी आती है।",
    explanation: "नाइट्रस ऑक्साइड (N2O) को सूंघने पर उत्तेजना और हंसी आती है, इसे चिकित्सा क्षेत्र में एनेस्थीसिया के लिए भी उपयोग करते हैं।",
    aiPrompt: "vintage chemistry laboratory with bubbling glass flask emitting glowing light blue nitrous oxide gas 4k",
    tags: ["#ExamIQ", "#ChemistryGK", "#ScienceMCQ", "#CompetitiveExams", "#SSCGD", "#Reels"]
  }
];

class ContentVault {
  constructor() {
    this.historyFile = path.resolve(__dirname, 'data/history.json');
    if (!fs.existsSync(path.dirname(this.historyFile))) {
      fs.mkdirSync(path.dirname(this.historyFile), { recursive: true });
    }
  }

  getUploadedIds() {
    try {
      if (fs.existsSync(this.historyFile)) {
        const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
        return new Set(data.uploadedIds || []);
      }
    } catch (_) {}
    return new Set();
  }

  recordUpload(item, uploadRes) {
    try {
      let data = { uploadedIds: [], uploads: [] };
      if (fs.existsSync(this.historyFile)) {
        data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      }
      data.uploadedIds.push(item.id);
      data.uploads.push({
        id: item.id,
        category: item.category,
        topic: item.topic,
        title: item.title,
        fbVideoId: uploadRes?.id || uploadRes?.fbVideoId,
        uploadedAt: new Date().toISOString(),
        answer: item.answerText,
      });
      fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.warn('Failed recording upload history:', err.message);
    }
  }

  /**
   * Retrieves a balanced batch of high-demand GK questions
   */
  async getBatchQuestions(count = 1) {
    const uploadedIds = this.getUploadedIds();
    const available = EXAM_GK_QUESTIONS.filter(q => !uploadedIds.has(q.id));
    const pool = available.length >= count ? available : EXAM_GK_QUESTIONS;
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);

    return selected.map(item => {
      const textToScore = `${item.title} ${item.questionLines.join(' ')}`;
      const virality = scoreHook(textToScore);
      return {
        ...item,
        virality: {
          score: virality.verdict,
          band: virality.band,
          formula: virality.formula,
          weakest: virality.weakest,
          fix: virality.fix
        }
      };
    });
  }

  // Alias for backward compatibility with existing runner/schedulers
  async getBatchRiddles(count = 1) {
    return this.getBatchQuestions(count);
  }
}

module.exports = {
  ContentVault,
  EXAM_GK_QUESTIONS,
  // Keep aliases so any legacy imports do not break
  DOUBLE_MEANING_RIDDLES: EXAM_GK_QUESTIONS,
  NORMAL_TRICKY_RIDDLES: EXAM_GK_QUESTIONS,
};
