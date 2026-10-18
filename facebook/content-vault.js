/**
 * Facebook Reels Viral Content Vault
 * Balanced Strategy:
 * - 3 Normal / Witty Tricky Brain Teasers (60%)
 * - 2 Spicy Double-Meaning Paheliyan with 100% Innocent Punchlines (40%)
 * 
 * Perfect Indian Facebook Viral Formula:
 * - Uncles, Youth & Family comment flood
 * - Relatable desi humor, zero actual vulgarity or nudity
 */

const fs = require('fs');
const path = require('path');
const { scoreHook } = require('../utils/hook-scorer');

// 🌶️ Category 1: Double-Meaning Style (Spicy Hook + 100% Clean & Funny Innocent Answer)
const DOUBLE_MEANING_RIDDLES = [
  {
    id: "dm_01",
    category: "double_meaning",
    title: "अंधेरे में घुसाया, दर्द हुआ, खून निकला!",
    questionLines: ["अंधेरे में घुसाया, दर्द हुआ,", "हल्का सा खून भी निकला और", "फिर काम हो गया? 🩸👂"],
    voiceQuestion: "सवाल ध्यान से सुनिए: अंधेरे में घुसाया, थोड़ा दर्द हुआ, खून निकला और फिर काम हो गया?",
    voiceTimer: "गलत मत सोचो, दिमाग लगाओ! 4, 3, 2, 1...",
    answerText: "कान छिदवाना! (Ear Piercing) 👂✨",
    voiceAnswer: "इसका सही जवाब है: कान में बाली के लिए छेद करवाना! आपका दिमाग पहले कहां गया था? सच-सच बताओ!",
    subtitle: "किस-किस का दिमाग गलत दिशा में गया था? 😂",
    tags: ["#reels", "#paheliyan", "#comedyreels", "#funny", "#jokes", "#desi", "#reelsfb"]
  },
  {
    id: "dm_02",
    category: "double_meaning",
    title: "डालने पर कड़क, निकालने पर ढीला!",
    questionLines: ["वो क्या है जिसे अंदर डालो", "तो कड़क होता है, और बाहर", "निकालो तो गीला और ढीला? ☕"],
    voiceQuestion: "ध्यान से सोचो: वो क्या है जिसे अंदर डालो तो कड़क होता है, और बाहर निकालो तो गीला और ढीला?",
    voiceTimer: "दिमाग पर जोर डालो! 4, 3, 2, 1...",
    answerText: "चाय में डूबा हुआ बिस्कुट! 🍪☕",
    voiceAnswer: "इसका सही जवाब है: चाय में डूबा हुआ बिस्कुट! अब हंसना बंद करो और कमेंट में अपनी सच्चाई बताओ!",
    subtitle: "चाय का बिस्कुट! तुम्हारा क्या जवाब था? 😂👇",
    tags: ["#reels", "#paheliyan", "#funnyjokes", "#desimemes", "#viralreels"]
  },
  {
    id: "dm_03",
    category: "double_meaning",
    title: "हाथ में पकड़कर हिलाओ तो पानी निकलता है!",
    questionLines: ["हाथ में पकड़कर ऊपर-नीचे करो,", "तो ठंडा-ठंडा सफेद पानी", "निकलने लगता है? 🚰"],
    voiceQuestion: "हाथ में पकड़कर ऊपर-नीचे करो, तो ठंडा-ठंडा पानी निकलने लगता है? बताओ क्या?",
    voiceTimer: "सोच समझकर जवाब देना! 4, 3, 2, 1...",
    answerText: "गांव का हैंडपंप (Handpump)! 🚰😂",
    voiceAnswer: "इसका सही जवाब है: गांव का हैंडपंप! क्या आपका दिमाग भी 360 डिग्री घूम गया था? सच बताना!",
    subtitle: "हैंडपंप भाई, हैंडपंप! क्या सोच रहे थे? 🤣",
    tags: ["#reels", "#desijokes", "#comedy", "#reelsindia", "#viralreels"]
  },
  {
    id: "dm_04",
    category: "double_meaning",
    title: "पैरों के बीच लटकता है, सब हिलाते हैं!",
    questionLines: ["पैरों के बीच लटकता है,", "सफर में सब उसे हिलाते हैं,", "और आगे बढ़ जाते हैं? 🚲"],
    voiceQuestion: "पैरों के बीच लटकता है, सफर में सब उसे हिलाते हैं और आगे बढ़ जाते हैं? बताओ क्या?",
    voiceTimer: "गलत मत सोचो भाई! 4, 3, 2, 1...",
    answerText: "साइकिल का पैडल! 🚲😂",
    voiceAnswer: "इसका सही जवाब है: साइकिल का पैडल! सच बताना, तुम्हारे दिमाग में सबसे पहले क्या आया था?",
    subtitle: "अरे भाई साइकिल का पैडल था! क्या सोच रहे थे? 🤣",
    tags: ["#reels", "#doublemeaningjokes", "#funnypaheli", "#reelsfb"]
  },
  {
    id: "dm_05",
    category: "double_meaning",
    title: "अंगुली से पकड़कर मुंह में डालो!",
    questionLines: ["अंगुली से पकड़कर मुंह में डालो,", "हिलाओ तो झाग निकलता है,", "और सुकून मिलता है? 🪥"],
    voiceQuestion: "अंगुली से पकड़कर मुंह में डालो, हिलाओ तो झाग निकलता है और सुकून मिलता है? बताओ क्या?",
    voiceTimer: "दिमाग की बत्ती जलाओ! 4, 3, 2, 1...",
    answerText: "टूथब्रश (Toothbrush)! 🪥✨",
    voiceAnswer: "इसका सही जवाब है: टूथब्रश! भाई साहब, जिनका दिमाग गलत दिशा में दौड़ा था, वो कमेंट में हाजिरी लगाएं!",
    subtitle: "किस-किस का दिमाग भटक गया था? कमेंट करो! 😜",
    tags: ["#reels", "#funnyjokes", "#desicomedy", "#laughter", "#reelsfb"]
  },
  {
    id: "dm_06",
    category: "double_meaning",
    title: "दोनों टांगें उठाकर अंदर डाला जाता है!",
    questionLines: ["दोनों टांगें उठाकर अंदर डाला जाता है,", "फिर धीरे-धीरे ऊपर खींचा जाता है? 👖"],
    voiceQuestion: "दोनों टांगें उठाकर अंदर डाला जाता है, फिर धीरे-धीरे ऊपर खींचा जाता है? बताओ क्या?",
    voiceTimer: "सोच समझकर जवाब देना! 4, 3, 2, 1...",
    answerText: "पैंट या पाजामा! 👖😂",
    voiceAnswer: "इसका सही जवाब है: पैंट या पजामा! अब अपनी हंसी रोको और कमेंट में सच लिखो!",
    subtitle: "पैंट और पजामा! क्या सोच रहे थे? 🤣",
    tags: ["#reels", "#jokes", "#comedyreels", "#funnyvideo", "#reelsfb"]
  },
  {
    id: "dm_07",
    category: "double_meaning",
    title: "अंदर गया तो सख्त, बाहर आया तो नरम!",
    questionLines: ["अंदर गया तो सूखा और सख्त था,", "लेकिन बाहर आया तो", "गीला और लाल हो गया? 🌿"],
    voiceQuestion: "अंदर गया तो सूखा और सख्त था, लेकिन बाहर आया तो गीला और लाल हो गया? बताओ क्या?",
    voiceTimer: "सोचो और बताओ! 4, 3, 2, 1...",
    answerText: "बनारसी मीठा पान (Paan)! 🍃👄",
    voiceAnswer: "इसका सही जवाब है: मीठा पान! जो मुंह में चबाने के बाद लाल हो जाता है!",
    subtitle: "बनारसी मीठा पान! क्या सोच रहे थे? 😂",
    tags: ["#reels", "#paheli", "#jokes", "#facebookreels", "#viral"]
  },
  {
    id: "dm_08",
    category: "double_meaning",
    title: "जितना ठोको उतना अंदर जाता है!",
    questionLines: ["ऐसी कौन सी चीज़ है जिसे", "जितना ज़्यादा ठोका जाए,", "वो उतनी ही अंदर जाती है? 🔨"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जिसे जितना ज़्यादा ठोका जाए, वो उतनी ही अंदर जाती है?",
    voiceTimer: "दिमाग लगाओ! 4, 3, 2, 1...",
    answerText: "दीवार में कील (Nail)! 🔨📌",
    voiceAnswer: "इसका सही जवाब है: दीवार में कील! अब बताओ, आपका दिमाग कहां गया था? कमेंट करो!",
    subtitle: "दीवार की कील! क्या सोचा था? 😂",
    tags: ["#reels", "#paheliyan", "#funny", "#jokes", "#fbviral"]
  },
  {
    id: "dm_09",
    category: "double_meaning",
    title: "रात को ही करने में मजा आता है!",
    questionLines: ["ऐसी कौन सी चीज़ है", "जो सिर्फ रात को ही", "करने में सबसे ज़्यादा सुकून देती है? 😴"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो सिर्फ रात को ही करने में सबसे ज़्यादा सुकून देती है?",
    voiceTimer: "गलत मत सोचना! 4, 3, 2, 1...",
    answerText: "चैन की नींद (Deep Sleep)! 😴💤",
    voiceAnswer: "इसका सही जवाब है: चैन की नींद! दिनभर की थकान के बाद रात को सोने का ही मजा है!",
    subtitle: "चैन की नींद भाई! क्या सोच रहे थे? 🤣",
    tags: ["#reels", "#jokes", "#comedy", "#desimemes", "#reelsfb"]
  },
  {
    id: "dm_10",
    category: "double_meaning",
    title: "लड़कियां छुपाती हैं, पैसे देने पर देती हैं!",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "लड़कियां छुपाती हैं और", "पैसे देने पर ही देती हैं? 🤔"],
    voiceQuestion: "आपका सवाल है: ऐसी कौन सी चीज़ है, जो लड़कियां छुपाती हैं और पैसे देने पर ही देती हैं?",
    voiceTimer: "सोचिए! 4, 3, 2, 1...",
    answerText: "जीजाजी के जूते! 👞😂",
    voiceAnswer: "इसका सही जवाब है: जीजाजी के जूते! शादी में साली की जूता चुराई! कमेंट में बताओ आपने क्या सोचा था?",
    subtitle: "शादी की जूता चुराई! 😂 कमेंट करो!",
    tags: ["#reels", "#funnyreels", "#paheliyan", "#jokes", "#viralreels"]
  }
];

// 🧠 Category 2: Smart / Normal / Tricky Brain Teasers (Clean, Engaging, High-Shareability)
const NORMAL_TRICKY_RIDDLES = [
  {
    id: "norm_01",
    category: "smart_normal",
    title: "सोने की है पर सुनार के पास नहीं!",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "सोने की है, पर सुनार की", "दुकान पर कभी नहीं मिलती? 🛏️"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो सोने की है, पर सुनार की दुकान पर कभी नहीं मिलती?",
    voiceTimer: "सोचो और बताओ! 4, 3, 2, 1...",
    answerText: "तकिया और चारपाई (Bed)! 🛏️😴",
    voiceAnswer: "इसका सही जवाब है: तकिया और चारपाई! जिस पर हम रात को सोते हैं! दिमाग की बत्ती जली?",
    subtitle: "सोने (Sleep) की चारपाई! क्या दिमाग चला? 😂",
    tags: ["#reels", "#paheliyan", "#funny", "#desi", "#fbviral"]
  },
  {
    id: "norm_02",
    category: "smart_normal",
    title: "जितना खींचो उतना छोटा!",
    questionLines: ["वो कौन सी चीज़ है जिसे", "जितना खींचो वो उतनी ही", "छोटी होती जाती है? 🚬"],
    voiceQuestion: "आपका सवाल है: वो कौन सी चीज़ है जिसे जितना खींचो, वो उतनी ही छोटी होती जाती है?",
    voiceTimer: "दिमाग की बत्ती जलाओ! 4, 3, 2, 1...",
    answerText: "बीड़ी या सिगरेट! 🚬😂",
    voiceAnswer: "इसका सही जवाब है: बीड़ी या सिगरेट! क्या आपका जवाब सही था? कमेंट में बताओ!",
    subtitle: "किसने क्या सोचा था? कमेंट करो! 😜",
    tags: ["#reels", "#dimagikiz", "#paheli", "#jokes", "#funny"]
  },
  {
    id: "norm_03",
    category: "smart_normal",
    title: "पानी पीते ही मर जाती है!",
    questionLines: ["ऐसी कौन सी चीज़ है", "जो पानी पीते ही", "तुरंत मर जाती है? 💧🔥"],
    voiceQuestion: "सोचकर बताओ: ऐसी कौन सी चीज़ है जो पानी पीते ही तुरंत मर जाती है?",
    voiceTimer: "4, 3, 2, 1...",
    answerText: "प्यास (Thirst) या आग! 💧🔥",
    voiceAnswer: "इसका सही जवाब है: प्यास और आग! दोनों ही पानी पीते ही खत्म हो जाते हैं!",
    subtitle: "सही जवाब देने वाले फॉलो करो! 👍",
    tags: ["#reels", "#paheli", "#gkquiz", "#hindiriddles", "#reelsfb"]
  },
  {
    id: "norm_04",
    category: "smart_normal",
    title: "चीज़ आपकी, इस्तेमाल दूसरे करते हैं!",
    questionLines: ["ऐसी कौन सी चीज़ है", "जो है तो आपकी,", "पर आपसे ज़्यादा दूसरे इस्तेमाल करते हैं? 🗣️"],
    voiceQuestion: "बताओ ऐसी कौन सी चीज़ है जो है तो आपकी, पर आपसे ज़्यादा दूसरे लोग इस्तेमाल करते हैं?",
    voiceTimer: "दिमाग की बत्ती जलाओ! 4, 3, 2, 1...",
    answerText: "आपका नाम (Your Name)! 📛😂",
    voiceAnswer: "इसका सही जवाब है: आपका नाम! क्योंकि आपका नाम हमेशा दूसरे लोग पुकारते हैं!",
    subtitle: "आपका खुद का नाम! समझ आया? 💡",
    tags: ["#reels", "#mindgames", "#paheliyan", "#fbviral"]
  },
  {
    id: "norm_05",
    category: "smart_normal",
    title: "एक औरत सबको दे सकती है, पति को नहीं!",
    questionLines: ["वो क्या चीज़ है जो एक", "महिला सबको दे सकती है,", "मगर अपने पति को कभी नहीं? 🤫"],
    voiceQuestion: "वो क्या चीज़ है जो एक शादीशुदा औरत सबको दे सकती है, मगर अपने पति को कभी नहीं दे सकती?",
    voiceTimer: "सोचो सोचो! 4, 3, 2, 1...",
    answerText: "राखी (Rakhi) का धागा! 🪢❤️",
    voiceAnswer: "इसका सही जवाब है: राखी! क्योंकि औरत अपने पति को कभी भाई की राखी नहीं बांधती!",
    subtitle: "राखी का पवित्र धागा! क्या सोचा था? 😂",
    tags: ["#reels", "#comedy", "#familyjokes", "#desihumor", "#viral"]
  },
  {
    id: "norm_06",
    category: "smart_normal",
    title: "आगे भगवान ने, पीछे इंसान ने!",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "आगे से भगवान ने बनाई और", "पीछे से इंसान ने? 🐂"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो आगे से भगवान ने बनाई, और पीछे से इंसान ने बनाई?",
    voiceTimer: "सोचो सोचो! 4, 3, 2, 1...",
    answerText: "बैलगाड़ी! (बैल + गाड़ी) 🐂🛞",
    voiceAnswer: "इसका सही जवाब है: बैलगाड़ी! क्योंकि आगे बैल भगवान का, और पीछे गाड़ी इंसान की!",
    subtitle: "दिमाग हिला दिया न? दोस्तों को शेयर करो! 🤣",
    tags: ["#reels", "#desi", "#riddle", "#paheli", "#facebookreels"]
  },
  {
    id: "norm_07",
    category: "smart_normal",
    title: "लड़कों में बढ़ती है, लड़कियों में नहीं!",
    questionLines: ["वो क्या चीज़ है जो", "लड़कों में उम्र के साथ बढ़ती है,", "पर लड़कियों में कभी नहीं आती? 🧔"],
    voiceQuestion: "बताओ वो क्या चीज़ है जो लड़कों में उम्र के साथ बढ़ती है, पर लड़कियों में कभी नहीं आती?",
    voiceTimer: "समय शुरू होता है! 4, 3, 2, 1...",
    answerText: "दाढ़ी और मूँछ! 🧔😂",
    voiceAnswer: "इसका सही जवाब है: दाढ़ी और मूँछ! जिसने सही सोचा था वो वीडियो को लाइक जरूर करे!",
    subtitle: "सही जवाब देने वाले लाइक ठोको! 👍",
    tags: ["#reels", "#funny", "#comedy", "#reelsindia", "#fbviral"]
  },
  {
    id: "norm_08",
    category: "smart_normal",
    title: "दिन में सोती है, रात में रोती है!",
    questionLines: ["वो कौन है जो", "दिन भर सोती है, और", "रात भर रोती रहती है? 🕯️"],
    voiceQuestion: "बताओ ऐसी कौन सी चीज़ है जो दिन भर सोती है, और रात भर रोती रहती है?",
    voiceTimer: "सोचिए और बताइए! 4, 3, 2, 1...",
    answerText: "जलती हुई मोमबत्ती (Candle)! 🕯️",
    voiceAnswer: "इसका सही जवाब है: मोमबत्ती! क्योंकि रात में वो जलकर पिघलती रहती है!",
    subtitle: "क्या आपका दिमाग सही चला? 💡",
    tags: ["#reels", "#dimagkikazrat", "#riddles", "#facebookreels"]
  },
  {
    id: "norm_09",
    category: "smart_normal",
    title: "जितनी ज़्यादा बढ़ती है, उतनी कम दिखती है!",
    questionLines: ["ऐसी कौन सी चीज़ है", "जो जितनी ज़्यादा बढ़ती है,", "उतनी ही कम दिखाई देती है? 🌑"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो जितनी ज़्यादा बढ़ती है, उतनी ही कम दिखाई देती है?",
    voiceTimer: "सोचो और बताओ! 4, 3, 2, 1...",
    answerText: "अंधेरा (Darkness)! 🌑✨",
    voiceAnswer: "इसका सही जवाब है: अंधेरा! जितना गहरा होगा, उतना कम दिखाई देगा!",
    subtitle: "अंधेरा भाई! दिमाग की कसरत हुई? 👍",
    tags: ["#reels", "#dimagikiz", "#paheli", "#viral"]
  },
  {
    id: "norm_10",
    category: "smart_normal",
    title: "समुद्र में पैदा होती है, घर में रहती है!",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "पैदा तो समुद्र में होती है,", "लेकिन रहती आपके घर में है? 🌊🏠"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो पैदा तो समुद्र में होती है, लेकिन रहती आपके घर में है?",
    voiceTimer: "4, 3, 2, 1...",
    answerText: "नमक (Salt)! 🧂😋",
    voiceAnswer: "इसका सही जवाब है: नमक! जो समुद्र के पानी से बनता है और हर घर की रसोई में रहता है!",
    subtitle: "सफेद नमक! कमेंट में बताओ सही था? 🧂",
    tags: ["#reels", "#gkquiz", "#paheliyan", "#reelsfb"]
  },
  {
    id: "norm_11",
    category: "smart_normal",
    title: "ऊपर भी जाता है, नीचे भी आता है!",
    questionLines: ["वो क्या है जो ऊपर भी जाता है", "और नीचे भी आता है,", "मगर अपनी जगह से कभी नहीं हिलता? 🪜"],
    voiceQuestion: "वो क्या है जो ऊपर भी जाता है और नीचे भी आता है, मगर अपनी जगह से कभी नहीं हिलता?",
    voiceTimer: "सोचो सोचो! 4, 3, 2, 1...",
    answerText: "सीढ़ियां (Stairs)! 🪜🏢",
    voiceAnswer: "इसका सही जवाब है: घर की सीढ़ियां! जो ऊपर नीचे जाती हैं पर अपनी जगह पर स्थिर रहती हैं!",
    subtitle: "घर की सीढ़ियां! कैसा लगा दिमाग? 😜",
    tags: ["#reels", "#riddles", "#desipaheli", "#viralreels"]
  },
  {
    id: "norm_12",
    category: "smart_normal",
    title: "खाने के लिए खरीदते हैं, खाते नहीं!",
    questionLines: ["ऐसी कौन सी चीज़ है जिसे", "खाने के लिए खरीदा जाता है,", "पर उसे कभी खाया नहीं जाता? 🍽️"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जिसे लोग खाने के लिए खरीदते हैं, पर कभी खाते नहीं?",
    voiceTimer: "दिमाग पर जोर डालो! 4, 3, 2, 1...",
    answerText: "प्लेट और चम्मच! 🍽️🥄😂",
    voiceAnswer: "इसका सही जवाब है: खाने की प्लेट और चम्मच! जिस पर रखकर खाना खाया जाता है!",
    subtitle: "प्लेट और चम्मच! किसने क्या सोचा था? 🤣",
    tags: ["#reels", "#jokes", "#comedy", "#familyjokes"]
  },
  {
    id: "norm_13",
    category: "smart_normal",
    title: "फटने पर भी कोई आवाज़ नहीं होती!",
    questionLines: ["ऐसी कौन सी चीज़ है जो", "फटने पर बिल्कुल भी", "आवाज़ नहीं करती? 🥛😂"],
    voiceQuestion: "ऐसी कौन सी चीज़ है जो फटने पर बिल्कुल भी आवाज़ नहीं करती?",
    voiceTimer: "सोचो सोचो! 4, 3, 2, 1...",
    answerText: "फटा हुआ दूध (Curdled Milk)! 🥛",
    voiceAnswer: "इसका सही जवाब है: दूध का फटना! जिसमें कोई धमाका नहीं होता!",
    subtitle: "दूध का फटना भाई! हँसो मत! 🤣",
    tags: ["#reels", "#funny", "#desi", "#riddles"]
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
        category: item.category || 'general',
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

  /**
   * Balanced Selection:
   * For a batch of 5:
   * -> 3 Normal / Tricky Brain Teasers (60%)
   * -> 2 Spicy Double-Meaning Paheliyan (40%)
   * Interleaved to keep audience hooked!
   */
  async getBatchRiddles(count = 5) {
    const uploadedIds = this.getUploadedIds();

    const availDouble = DOUBLE_MEANING_RIDDLES.filter(r => !uploadedIds.has(r.id));
    const availNormal = NORMAL_TRICKY_RIDDLES.filter(r => !uploadedIds.has(r.id));

    const poolDouble = availDouble.length > 0 ? availDouble : DOUBLE_MEANING_RIDDLES;
    const poolNormal = availNormal.length > 0 ? availNormal : NORMAL_TRICKY_RIDDLES;

    const shufDouble = [...poolDouble].sort(() => 0.5 - Math.random());
    const shufNormal = [...poolNormal].sort(() => 0.5 - Math.random());

    // Attach Virality Hook Score to each riddle candidate
    const enrichWithVirality = (item) => {
      if (!item) return item;
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
    };

    let selected = [];
    if (count === 5) {
      // Golden 3:2 Ratio (3 Normal, 2 Double Meaning)
      selected = [
        shufNormal[0], // Slot 1: Normal (Morning)
        shufDouble[0], // Slot 2: Double Meaning 🔥 (Lunch)
        shufNormal[1], // Slot 3: Normal (Tea Time)
        shufDouble[1], // Slot 4: Double Meaning 🔥 (Evening Peak)
        shufNormal[2], // Slot 5: Normal (Night)
      ];
    } else if (count === 1) {
      // 40% chance of double meaning, 60% normal
      selected = Math.random() < 0.4 ? [shufDouble[0]] : [shufNormal[0]];
    } else {
      // Generic count: calculate ~40% double, 60% normal
      const doubleCount = Math.round(count * 0.4);
      const normalCount = count - doubleCount;
      const mixed = [
        ...shufNormal.slice(0, normalCount),
        ...shufDouble.slice(0, doubleCount),
      ].sort(() => 0.5 - Math.random());
      selected = mixed.slice(0, count);
    }

    return selected.filter(Boolean).map(enrichWithVirality);
  }
}

module.exports = {
  ContentVault,
  DOUBLE_MEANING_RIDDLES,
  NORMAL_TRICKY_RIDDLES,
};
