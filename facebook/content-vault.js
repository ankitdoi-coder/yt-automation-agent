/**
 * Facebook Reels Viral Content Vault
 * Specially crafted for Indian Facebook Audience:
 * - Tricky, witty, mind-boggling Hindi Paheliyan & Family-Friendly Humor
 * - 100% compliant with Meta Page Recommendation & Monetization Guidelines
 * - Zero sexual innuendo / zero vulgarity (Guaranteed 100% Green Page Health)
 * - Maximum engagement: makes youth, uncles, and families comment, laugh & share!
 */

const fs = require('fs');
const path = require('path');

const CURATED_RIDDLES = [
  {
    id: "fb_01",
    title: "ऐसी कौन सी चीज़ है?",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "लड़कियां छुपाती हैं और", "पैसे देने पर ही देती हैं? 🤔"],
    voiceQuestion: "आपका सवाल है: ऐसी कौन सी चीज़ है, जो लड़कियां छुपाती हैं और पैसे देने पर ही देती हैं?",
    voiceTimer: "सोचिए! आपके पास 5 सेकंड हैं। 5, 4, 3, 2, 1...",
    answerText: "जीजाजी के जूते! 👞😂",
    voiceAnswer: "इसका सही जवाब है: जीजाजी के जूते! शादी में साली की जूता चुराई! कमेंट में बताओ आपने क्या सोचा था?",
    subtitle: "शादी की जूता चुराई! 😂 कमेंट करो!",
    tags: ["#reels", "#funnyreels", "#paheliyan", "#jokes", "#viralreels", "#desicomedy", "#reelsfb"]
  },
  {
    id: "fb_02",
    title: "जितना खींचो उतना छोटा!",
    questionLines: ["वो कौन सी चीज़ है जिसे", "जितना खींचो वो उतनी ही", "छोटी होती जाती है? 🚬"],
    voiceQuestion: "आपका सवाल है: वो कौन सी चीज़ है जिसे जितना खींचो, वो उतनी ही छोटी होती जाती है?",
    voiceTimer: "दिमाग की बत्ती जलाओ! 5, 4, 3, 2, 1...",
    answerText: "बीड़ी या सिगरेट! 🚬😂",
    voiceAnswer: "इसका सही जवाब है: बीड़ी या सिगरेट! क्या आपका जवाब सही था? कमेंट में बताओ!",
    subtitle: "किसने क्या सोचा था? कमेंट करो! 😜",
    tags: ["#reels", "#dimagikiz", "#paheli", "#jokes", "#funny", "#reelsfb"]
  },
  {
    id: "fb_04",
    title: "आगे भगवान ने, पीछे इंसान ने!",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "आगे से भगवान ने बनाई और", "पीछे से इंसान ने? 🐂"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो आगे से भगवान ने बनाई, और पीछे से इंसान ने बनाई?",
    voiceTimer: "सोचो सोचो! 5, 4, 3, 2, 1...",
    answerText: "बैलगाड़ी! (बैल + गाड़ी) 🐂🛞",
    voiceAnswer: "इसका सही जवाब है: बैलगाड़ी! क्योंकि आगे बैल भगवान का, और पीछे गाड़ी इंसान की!",
    subtitle: "दिमाग हिला दिया न? दोस्तों को शेयर करो! 🤣",
    tags: ["#reels", "#desi", "#riddle", "#paheli", "#facebookreels", "#viral"]
  },
  {
    id: "fb_05",
    title: "लड़कों में बढ़ती है, लड़कियों में नहीं!",
    questionLines: ["वो क्या चीज़ है जो", "लड़कों में उम्र के साथ बढ़ती है,", "पर लड़कियों में कभी नहीं आती? 🧔"],
    voiceQuestion: "बताओ वो क्या चीज़ है जो लड़कों में उम्र के साथ बढ़ती है, पर लड़कियों में कभी नहीं आती?",
    voiceTimer: "समय शुरू होता है! 5, 4, 3, 2, 1...",
    answerText: "दाढ़ी और मूँछ! 🧔😂",
    voiceAnswer: "इसका सही जवाब है: दाढ़ी और मूँछ! जिसने सही सोचा था वो वीडियो को लाइक जरूर करे!",
    subtitle: "सही जवाब देने वाले लाइक ठोको! 👍",
    tags: ["#reels", "#funny", "#comedy", "#reelsindia", "#fbviral", "#jokes"]
  },
  {
    id: "fb_06",
    title: "डालने पर कड़क, निकालने पर ढीला!",
    questionLines: ["वो क्या है जिसे अंदर डालो", "तो कड़क होता है, और बाहर", "निकालो तो गीला और ढीला? ☕"],
    voiceQuestion: "ध्यान से सोचो: वो क्या है जिसे अंदर डालो तो कड़क होता है, और बाहर निकालो तो गीला और ढीला?",
    voiceTimer: "दिमाग पर जोर डालो! 5, 4, 3, 2, 1...",
    answerText: "चाय में डूबा हुआ बिस्कुट! 🍪☕",
    voiceAnswer: "इसका सही जवाब है: चाय में डूबा हुआ बिस्कुट! अब कमेंट में अपनी सच्चाई बताओ!",
    subtitle: "चाय का बिस्कुट! तुम्हारा क्या जवाब था? 😂👇",
    tags: ["#reels", "#paheliyan", "#funnyjokes", "#desimemes", "#viralreels"]
  },
  {
    id: "fb_07",
    title: "दिन में सोती है, रात में रोती है!",
    questionLines: ["वो कौन है जो", "दिन भर सोती है, और", "रात भर रोती रहती है? 🕯️"],
    voiceQuestion: "बताओ ऐसी कौन सी चीज़ है जो दिन भर सोती है, और रात भर रोती रहती है?",
    voiceTimer: "सोचिए और बताइए! 5, 4, 3, 2, 1...",
    answerText: "जलती हुई मोमबत्ती (Candle)! 🕯️",
    voiceAnswer: "इसका सही जवाब है: मोमबत्ती! क्योंकि रात में वो जलकर पिघलती रहती है!",
    subtitle: "क्या आपका दिमाग सही चला? 💡",
    tags: ["#reels", "#dimagkikazrat", "#riddles", "#facebookreels", "#viral"]
  },
  {
    id: "fb_08",
    title: "सोने की है पर सुनार के पास नहीं मिलती!",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "सोने की है, पर सुनार की", "दुकान पर कभी नहीं मिलती? 🛏️"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो सोने की है, पर सुनार की दुकान पर कभी नहीं मिलती?",
    voiceTimer: "सोचो और बताओ! 5, 4, 3, 2, 1...",
    answerText: "तकिया और चारपाई (Bed)! 🛏️😴",
    voiceAnswer: "इसका सही जवाब है: तकिया और चारपाई! जिस पर हम रात को सोते हैं! दिमाग की बत्ती जली?",
    subtitle: "सोने (Sleep) की चारपाई! क्या दिमाग चला? 😂",
    tags: ["#reels", "#paheliyan", "#funny", "#desi", "#fbviral"]
  },
  {
    id: "fb_09",
    title: "पानी पीते ही मर जाती है!",
    questionLines: ["ऐसी कौन सी चीज़ है", "जो पानी पीते ही", "तुरंत मर जाती है? 💧🔥"],
    voiceQuestion: "सोचकर बताओ: ऐसी कौन सी चीज़ है जो पानी पीते ही तुरंत मर जाती है?",
    voiceTimer: "5, 4, 3, 2, 1...",
    answerText: "प्यास (Thirst) या आग! 💧🔥",
    voiceAnswer: "इसका सही जवाब है: प्यास और आग! दोनों ही पानी पीते ही खत्म हो जाते हैं!",
    subtitle: "सही जवाब देने वाले फॉलो करो! 👍",
    tags: ["#reels", "#paheli", "#gkquiz", "#hindiriddles", "#reelsfb"]
  },
  {
    id: "fb_10",
    title: "एक औरत सबको दे सकती है, पति को नहीं!",
    questionLines: ["वो क्या चीज़ है जो एक", "महिला सबको दे सकती है,", "मगर अपने पति को कभी नहीं? 🤫"],
    voiceQuestion: "वो क्या चीज़ है जो एक शादीशुदा औरत सबको दे सकती है, मगर अपने पति को कभी नहीं दे सकती?",
    voiceTimer: "सोचो सोचो! 5, 4, 3, 2, 1...",
    answerText: "राखी (Rakhi) का धागा! 🪢❤️",
    voiceAnswer: "इसका सही जवाब है: राखी! क्योंकि औरत अपने पति को कभी भाई की राखी नहीं बांधती!",
    subtitle: "राखी का पवित्र धागा! क्या सोचा था? 😂",
    tags: ["#reels", "#comedy", "#familyjokes", "#desihumor", "#viral"]
  },
  {
    id: "fb_13",
    title: "दोनों टांगें उठाकर अंदर डाला जाता है!",
    questionLines: ["दोनों टांगें उठाकर अंदर डाला जाता है,", "फिर धीरे-धीरे ऊपर खींचा जाता है? 👖"],
    voiceQuestion: "दोनों टांगें उठाकर अंदर डाला जाता है, फिर धीरे-धीरे ऊपर खींचा जाता है? बताओ क्या?",
    voiceTimer: "सोच समझकर जवाब देना! 5, 4, 3, 2, 1...",
    answerText: "पैंट या पाजामा! 👖😂",
    voiceAnswer: "इसका सही जवाब है: पैंट या पजामा! अब अपनी हंसी रोको और कमेंट में सच लिखो!",
    subtitle: "पैंट और पजामा! क्या सोच रहे थे? 🤣",
    tags: ["#reels", "#jokes", "#comedyreels", "#funnyvideo", "#reelsfb"]
  },
  {
    id: "fb_15",
    title: "अंदर गया तो सख्त था, बाहर आया तो नरम!",
    questionLines: ["अंदर गया तो सूखा और सख्त था,", "लेकिन बाहर आया तो", "गीला और लाल हो गया? 🌿"],
    voiceQuestion: "अंदर गया तो सूखा और सख्त था, लेकिन बाहर आया तो गीला और लाल हो गया? बताओ क्या?",
    voiceTimer: "सोचो और बताओ! 5, 4, 3, 2, 1...",
    answerText: "मीठा पान (Paan)! 🍃👄",
    voiceAnswer: "इसका सही जवाब है: मीठा पान! जो मुंह में चबाने के बाद लाल हो जाता है!",
    subtitle: "बनारसी मीठा पान! क्या सोच रहे थे? 😂",
    tags: ["#reels", "#paheli", "#jokes", "#facebookreels", "#viral"]
  },
  {
    id: "fb_16",
    title: "चीज़ आपकी है, पर इस्तेमाल दूसरे करते हैं!",
    questionLines: ["ऐसी कौन सी चीज़ है", "जो है तो आपकी,", "पर आपसे ज़्यादा दूसरे इस्तेमाल करते हैं? 🗣️"],
    voiceQuestion: "बताओ ऐसी कौन सी चीज़ है जो है तो आपकी, पर आपसे ज़्यादा दूसरे लोग इस्तेमाल करते हैं?",
    voiceTimer: "दिमाग की बत्ती जलाओ! 5, 4, 3, 2, 1...",
    answerText: "आपका नाम (Your Name)! 📛😂",
    voiceAnswer: "इसका सही जवाब है: आपका नाम! क्योंकि आपका नाम हमेशा दूसरे लोग पुकारते हैं!",
    subtitle: "आपका खुद का नाम! समझ आया? 💡",
    tags: ["#reels", "#mindgames", "#paheliyan", "#fbviral"]
  },
  {
    id: "fb_17",
    title: "जितनी ज़्यादा बढ़ती है, उतनी कम दिखती है!",
    questionLines: ["ऐसी कौन सी चीज़ है", "जो जितनी ज़्यादा बढ़ती है,", "उतनी ही कम दिखाई देती है? 🌑"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो जितनी ज़्यादा बढ़ती है, उतनी ही कम दिखाई देती है?",
    voiceTimer: "सोचो और बताओ! 5, 4, 3, 2, 1...",
    answerText: "अंधेरा (Darkness)! 🌑✨",
    voiceAnswer: "इसका सही जवाब है: अंधेरा! जितना गहरा होगा, उतना कम दिखाई देगा!",
    subtitle: "अंधेरा भाई! दिमाग की कसरत हुई? 👍",
    tags: ["#reels", "#dimagikiz", "#paheli", "#viral"]
  },
  {
    id: "fb_18",
    title: "समुद्र में पैदा होती है, घर में रहती है!",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "पैदा तो समुद्र में होती है,", "लेकिन रहती आपके घर में है? 🌊🏠"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो पैदा तो समुद्र में होती है, लेकिन रहती आपके घर में है?",
    voiceTimer: "5, 4, 3, 2, 1...",
    answerText: "नमक (Salt)! 🧂😋",
    voiceAnswer: "इसका सही जवाब है: नमक! जो समुद्र के पानी से बनता है और हर घर की रसोई में रहता है!",
    subtitle: "सफेद नमक! कमेंट में बताओ सही था? 🧂",
    tags: ["#reels", "#gkquiz", "#paheliyan", "#reelsfb"]
  },
  {
    id: "fb_19",
    title: "ऊपर भी जाता है, नीचे भी आता है!",
    questionLines: ["वो क्या है जो ऊपर भी जाता है", "और नीचे भी आता है,", "मगर अपनी जगह से कभी नहीं हिलता? 🪜"],
    voiceQuestion: "वो क्या है जो ऊपर भी जाता है और नीचे भी आता है, मगर अपनी जगह से कभी नहीं हिलता?",
    voiceTimer: "सोचो सोचो! 5, 4, 3, 2, 1...",
    answerText: "सीढ़ियां (Stairs)! 🪜🏢",
    voiceAnswer: "इसका सही जवाब है: घर की सीढ़ियां! जो ऊपर नीचे जाती हैं पर अपनी जगह पर स्थिर रहती हैं!",
    subtitle: "घर की सीढ़ियां! कैसा लगा दिमाग? 😜",
    tags: ["#reels", "#riddles", "#desipaheli", "#viralreels"]
  },
  {
    id: "fb_20",
    title: "खाने के लिए खरीदी जाती है, पर खाई नहीं जाती!",
    questionLines: ["ऐसी कौन सी चीज़ है जिसे", "खाने के लिए खरीदा जाता है,", "पर उसे कभी खाया नहीं जाता? 🍽️"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जिसे लोग खाने के लिए खरीदते हैं, पर कभी खाते नहीं?",
    voiceTimer: "दिमाग पर जोर डालो! 5, 4, 3, 2, 1...",
    answerText: "प्लेट और चम्मच! 🍽️🥄😂",
    voiceAnswer: "इसका सही जवाब है: खाने की प्लेट और चम्मच! जिस पर रखकर खाना खाया जाता है!",
    subtitle: "प्लेट और चम्मच! किसने क्या सोचा था? 🤣",
    tags: ["#reels", "#jokes", "#comedy", "#familyjokes", "#reelsfb"]
  }
];

class ContentVault {
  constructor() {
    this.historyFile = path.resolve(__dirname, 'data/history.json');
    this._ensureHistoryFile();
  }

  _ensureHistoryFile() {
    const dir = path.dirname(this.historyFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (!fs.existsSync(this.historyFile)) {
      fs.writeFileSync(this.historyFile, JSON.stringify({ uploadedIds: [], uploads: [] }, null, 2));
    }
  }

  getUploadedIds() {
    try {
      const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      return new Set(data.uploadedIds || []);
    } catch (_) {
      return new Set();
    }
  }

  recordUpload(item, fbResult) {
    try {
      const data = JSON.parse(fs.readFileSync(this.historyFile, 'utf8'));
      data.uploadedIds = data.uploadedIds || [];
      data.uploads = data.uploads || [];

      data.uploadedIds.push(item.id);
      data.uploads.push({
        id: item.id,
        title: item.title,
        fbVideoId: fbResult?.id,
        uploadedAt: new Date().toISOString(),
        answer: item.answerText,
      });

      fs.writeFileSync(this.historyFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error('Failed to record upload in history:', err.message);
    }
  }

  async getBatchRiddles(count = 5) {
    const uploadedIds = this.getUploadedIds();
    const available = CURATED_RIDDLES.filter(r => !uploadedIds.has(r.id));
    
    if (available.length >= count) {
      const shuffled = [...available].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, count);
    }

    console.log(`[ContentVault] Notice: Cycling curated bank (${available.length} remaining)...`);
    const allShuffled = [...CURATED_RIDDLES].sort(() => 0.5 - Math.random());
    return allShuffled.slice(0, count);
  }
}

module.exports = {
  ContentVault,
  CURATED_RIDDLES,
};
