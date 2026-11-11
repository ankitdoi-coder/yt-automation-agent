// 📐 6. Math IQ & Logic Puzzles (15 Questions)
const mathPuzzles = [
  {
    "id": "math_train_01",
    "category": "math_quiz",
    "topic": "गणितीय तर्क (Math IQ Speed)",
    "hookBar": "स्पीड कन्वर्जन ट्रिक",
    "title": "72 किमी/घंटा को मीटर/सेकंड में बदलें?",
    "question": "एक ट्रेन 72 किमी प्रति घंटे की गति से दौड़ रही है, तो उसकी गति मीटर प्रति सेकंड में क्या होगी?",
    "questionLines": [
      "1. एक ट्रेन 72 किमी/घंटे से",
      "दौड़ रही है, उसकी गति",
      "m/s में क्या होगी? 🚆⏱️"
    ],
    "options": [
      {
        "letter": "A",
        "text": "25 m/s"
      },
      {
        "letter": "B",
        "text": "30 m/s"
      },
      {
        "letter": "C",
        "text": "20 m/s (20 मीटर/सेकंड)"
      },
      {
        "letter": "D",
        "text": "15 m/s"
      }
    ],
    "correctOption": "C",
    "answerText": "C) 20 m/s (72 × 5/18 = 20)",
    "voiceQuestion": "72 किमी प्रति घंटे की गति को मीटर प्रति सेकंड में बदलेंगे तो क्या आएगा?",
    "voiceTimer": "3 सेकंड में दिमाग लगाइए!",
    "voiceCommentChallenge": "कमेंट में उत्तर दें! ट्रिक: 5/18 से गुणा करें! Follow Exam IQ Bharat for daily math tricks!",
    "voiceAnswer": "सही जवाब है ऑप्शन C, 20 मीटर प्रति सेकंड! 72 को 5/18 से गुणा करने पर 20 आता है।",
    "explanation": "किमी/घंटा को m/s में बदलने के लिए 5/18 से गुणा किया जाता है: 72 × 5/18 = 20 m/s.",
    "tags": [
      "#ExamIQ",
      "#MathTrick",
      "#SpeedTimeDistance",
      "#MathQuiz",
      "#Reels"
    ]
  },
  {
    "id": "math_series_02",
    "category": "math_quiz",
    "topic": "संख्या श्रृंखला (Number Series)",
    "hookBar": "मिसिंग नंबर पहचानो",
    "title": "श्रृंखला का अगला पद क्या होगा: 2, 6, 12, 20, 30, ?",
    "question": "तार्किक संख्या श्रृंखला 2, 6, 12, 20, 30 का अगला पद क्या होगा?",
    "questionLines": [
      "1. श्रृंखला का अगला पद क्या",
      "होगा: 2, 6, 12, 20, 30, ?",
      "🧩🔢 दिमाग लगाओ!"
    ],
    "options": [
      {
        "letter": "A",
        "text": "48"
      },
      {
        "letter": "B",
        "text": "40"
      },
      {
        "letter": "C",
        "text": "45"
      },
      {
        "letter": "D",
        "text": "42"
      }
    ],
    "correctOption": "D",
    "answerText": "D) 42 (अंतर: +4, +6, +8, +10, +12)",
    "voiceQuestion": "श्रृंखला 2, 6, 12, 20, 30 का अगला नंबर क्या होगा?",
    "voiceTimer": "3 सेकंड हैं!",
    "voiceCommentChallenge": "कमेंट में बताएं सही उत्तर! क्या आपने पैटर्न पकड़ लिया? Follow Exam IQ Bharat!",
    "voiceAnswer": "सही उत्तर है ऑप्शन D, 42! क्योंकि अंतर 4, 6, 8, 10, और अब 12 जुड़ेगा, यानी 30 + 12 = 42।",
    "explanation": "n(n+1) पैटर्न: 1×2=2, 2×3=6, 3×4=12, 4×5=20, 5×6=30, 6×7=42.",
    "tags": [
      "#ExamIQ",
      "#NumberSeries",
      "#ReasoningTricks",
      "#IQQuiz",
      "#Reels"
    ]
  },
  {
    "id": "math_prime_03",
    "category": "math_quiz",
    "topic": "अभाज्य संख्या (Prime Numbers)",
    "hookBar": "गणित का बेसिक सवाल",
    "title": "सबसे छोटी अभाज्य संख्या (Prime Number) कौन सी है?",
    "question": "गणित में सबसे छोटी और एकमात्र सम अभाज्य संख्या कौन सी मानी जाती है?",
    "questionLines": [
      "1. सबसे छोटी अभाज्य संख्या",
      "(Smallest Prime Number)",
      "कौन सी है? 🔢🧠"
    ],
    "options": [
      {
        "letter": "A",
        "text": "0"
      },
      {
        "letter": "B",
        "text": "2"
      },
      {
        "letter": "C",
        "text": "1"
      },
      {
        "letter": "D",
        "text": "3"
      }
    ],
    "correctOption": "B",
    "answerText": "B) 2 (एकमात्र सम अभाज्य संख्या)",
    "voiceQuestion": "सबसे छोटी अभाज्य संख्या कौन सी होती है?",
    "voiceTimer": "3 सेकंड में सोचिए!",
    "voiceCommentChallenge": "कमेंट में उत्तर दें! 80% लोग 1 को अभाज्य मानकर गलती करते हैं। Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन B, 2! 1 न तो भाज्य है और न ही अभाज्य, इसलिए 2 सबसे छोटी अभाज्य संख्या है।",
    "explanation": "अभाज्य संख्या के ठीक 2 गुणनखंड होते हैं (1 और स्वयं)। 1 का केवल 1 ही गुणनखंड है।",
    "tags": [
      "#ExamIQ",
      "#PrimeNumbers",
      "#MathGK",
      "#BasicMath",
      "#Reels"
    ]
  },
  {
    "id": "math_discount_04",
    "category": "math_quiz",
    "topic": "क्रमिक छूट (Successive Discounts)",
    "hookBar": "शॉपिंग डिस्काउंट का गणित",
    "title": "10% और 20% की दो क्रमिक छूट का एकल समतुल्य बट्टा क्या है?",
    "question": "यदि किसी वस्तु पर पहले 10% और फिर 20% की छूट दी जाए, तो कुल प्रभावी छूट क्या होगी?",
    "questionLines": [
      "1. 10% और 20% की दो क्रमिक",
      "छूट का एकल समतुल्य बट्टा",
      "क्या होगा? 🛍️🏷️"
    ],
    "options": [
      {
        "letter": "A",
        "text": "28%"
      },
      {
        "letter": "B",
        "text": "25%"
      },
      {
        "letter": "C",
        "text": "18%"
      },
      {
        "letter": "D",
        "text": "30%"
      }
    ],
    "correctOption": "A",
    "answerText": "A) 28% [10 + 20 - (10×20)/100 = 28%]",
    "voiceQuestion": "10% और 20% की दो लगातार छूटों का कुल डिस्काउंट कितना होगा?",
    "voiceTimer": "3 सेकंड में गणना कीजिए!",
    "voiceCommentChallenge": "कमेंट में बताएं सही विकल्प! 30% मत लिख देना! Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन A, 28%! सूत्र: a + b - ab/100, यानी 10 + 20 - 2 = 28%.",
    "explanation": "₹100 की वस्तु पर 10% छूट के बाद ₹90, और ₹90 पर 20% छूट ₹18, कुल छूट = ₹28 (28%)।",
    "tags": [
      "#ExamIQ",
      "#DiscountTricks",
      "#CommercialMath",
      "#MathShortcuts",
      "#Reels"
    ]
  },
  {
    "id": "math_clock_05",
    "category": "math_quiz",
    "topic": "घड़ी का कोण (Clock Angles)",
    "hookBar": "घड़ी की सुइयों का कोण",
    "title": "घड़ी में ठीक 3:00 बजे दोनों सुइयों के बीच कितने डिग्री का कोण होता है?",
    "question": "घड़ी में जब ठीक 3 बजते हैं, तो घंटे और मिनट की सुई के बीच का कोण क्या होता है?",
    "questionLines": [
      "1. घड़ी में ठीक 3:00 बजे",
      "दोनों सुइयों के बीच कितने",
      "डिग्री का कोण होता है? ⏰📐"
    ],
    "options": [
      {
        "letter": "A",
        "text": "120°"
      },
      {
        "letter": "B",
        "text": "45°"
      },
      {
        "letter": "C",
        "text": "90°"
      },
      {
        "letter": "D",
        "text": "60°"
      }
    ],
    "correctOption": "C",
    "answerText": "C) 90° (समकोण / Right Angle)",
    "voiceQuestion": "घड़ी में ठीक 3:00 बजे दोनों सुइयों के बीच कितने डिग्री का कोण बनता है?",
    "voiceTimer": "3 सेकंड हैं आपके पास!",
    "voiceCommentChallenge": "कमेंट बॉक्स में अपना जवाब लिखें! 6:00 बजे 180° होता है। Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन C, 90 अंश यानी समकोण! प्रत्येक घंटे के अंतराल में 30° का कोण होता है।",
    "explanation": "1 घंटे में 30° का कोण बनता है: 3 × 30° = 90°.",
    "tags": [
      "#ExamIQ",
      "#ClockReasoning",
      "#MathPuzzle",
      "#Angles",
      "#Reels"
    ]
  },
  {
    "id": "math_square_06",
    "category": "math_quiz",
    "topic": "वर्ग ट्रिक्स (Fast Squares)",
    "hookBar": "वैदिक गणित स्क्वायर ट्रिक",
    "title": "25 का वर्ग (Square of 25) क्या होगा?",
    "question": "वैदिक गणित के अनुसार 5 पर समाप्त होने वाली संख्या 25 का वर्ग क्या होता है?",
    "questionLines": [
      "1. 25 का वर्ग (Square of 25)",
      "कितना होता है? ⚡🔢",
      "एक सेकंड में बताओ!"
    ],
    "options": [
      {
        "letter": "A",
        "text": "525"
      },
      {
        "letter": "B",
        "text": "725"
      },
      {
        "letter": "C",
        "text": "425"
      },
      {
        "letter": "D",
        "text": "625"
      }
    ],
    "correctOption": "D",
    "answerText": "D) 625 (2 × 3 = 6, 25)",
    "voiceQuestion": "25 का वर्ग कितना होता है?",
    "voiceTimer": "3 सेकंड में सोचिए!",
    "voiceCommentChallenge": "कमेंट में उत्तर दें! ट्रिक: 2 को 3 से गुणा करो (6) और आगे 25 लगा दो! Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन D, 625! 25 गुना 25 बराबर 625 होता है।",
    "explanation": "25 × 25 = 625. एकाधिकेन पूर्वेण विधि द्वारा मौखिक हल।",
    "tags": [
      "#ExamIQ",
      "#SquareTrick",
      "#VedicMath",
      "#QuickMath",
      "#Reels"
    ]
  },
  {
    "id": "math_cube_07",
    "category": "math_quiz",
    "topic": "घन संख्या (Cube Numbers)",
    "hookBar": "घन का आसान सवाल",
    "title": "8 का घन (Cube of 8) कितना होता है?",
    "question": "जब संख्या 8 को 3 बार परस्पर गुणा किया जाए (8 × 8 × 8) तो मान क्या होगा?",
    "questionLines": [
      "1. 8 का घन (8 का क्यूब)",
      "कितना होता है? 🧊🔢",
      "कैलकुलेशन करो!"
    ],
    "options": [
      {
        "letter": "A",
        "text": "648"
      },
      {
        "letter": "B",
        "text": "512"
      },
      {
        "letter": "C",
        "text": "1024"
      },
      {
        "letter": "D",
        "text": "256"
      }
    ],
    "correctOption": "B",
    "answerText": "B) 512 (8 × 8 × 8 = 512)",
    "voiceQuestion": "8 का घन कितना होता है?",
    "voiceTimer": "3 सेकंड का समय है!",
    "voiceCommentChallenge": "कमेंट में बताएं सही विकल्प! क्या आप 1 से 10 तक के क्यूब जानते हैं? Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन B, 512! 8 का वर्ग 64 और 64 गुना 8 बराबर 512 होता है।",
    "explanation": "8³ = 8 × 8 × 8 = 512.",
    "tags": [
      "#ExamIQ",
      "#CubeOfNumbers",
      "#MathIQ",
      "#Calculations",
      "#Reels"
    ]
  },
  {
    "id": "math_average_08",
    "category": "math_quiz",
    "topic": "औसत ट्रिक (Averages)",
    "hookBar": "प्रथम विषम संख्याओं का औसत",
    "title": "प्रथम 5 विषम संख्याओं (1, 3, 5, 7, 9) का औसत क्या होगा?",
    "question": "प्रथम n विषम संख्याओं का औसत n ही होता है, तो 1, 3, 5, 7, 9 का औसत क्या है?",
    "questionLines": [
      "1. प्रथम 5 विषम संख्याओं",
      "(1, 3, 5, 7, 9) का औसत",
      "क्या होगा? 📊🧠"
    ],
    "options": [
      {
        "letter": "A",
        "text": "5"
      },
      {
        "letter": "B",
        "text": "7"
      },
      {
        "letter": "C",
        "text": "4"
      },
      {
        "letter": "D",
        "text": "6"
      }
    ],
    "correctOption": "A",
    "answerText": "A) 5 (प्रथम n विषम संख्याओं का औसत n ही होता है)",
    "voiceQuestion": "प्रथम 5 विषम संख्याओं का औसत क्या होगा?",
    "voiceTimer": "3 सेकंड में सोचिए!",
    "voiceCommentChallenge": "कमेंट बॉक्स में अपना जवाब लिखें! ट्रिक: प्रथम n विषम संख्याओं का औसत n ही होता है! Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन A, 5! योग 25 बटा 5 यानी 5 आता है।",
    "explanation": "योग = 1+3+5+7+9 = 25. औसत = 25/5 = 5.",
    "tags": [
      "#ExamIQ",
      "#AverageTricks",
      "#MathTricks",
      "#Aptitude",
      "#Reels"
    ]
  },
  {
    "id": "math_ratio_09",
    "category": "math_quiz",
    "topic": "अनुपात एवं समानुपात (Ratio & Proportion)",
    "hookBar": "अनुपात की जादुई ट्रिक",
    "title": "यदि A:B = 2:3 और B:C = 4:5 है, तो A:B:C क्या होगा?",
    "question": "अनुपात संयोजन ट्रिक का उपयोग करके A:B:C का सही मान निकालें:",
    "questionLines": [
      "1. यदि A:B = 2:3 और B:C = 4:5",
      "है, तो A:B:C का अनुपात",
      "क्या होगा? 📐🔢"
    ],
    "options": [
      {
        "letter": "A",
        "text": "8:10:15"
      },
      {
        "letter": "B",
        "text": "6:9:15"
      },
      {
        "letter": "C",
        "text": "8:12:15"
      },
      {
        "letter": "D",
        "text": "10:12:15"
      }
    ],
    "correctOption": "C",
    "answerText": "C) 8:12:15 (2×4 : 3×4 : 3×5)",
    "voiceQuestion": "यदि A अनुपात B दो अनुपात तीन है और B अनुपात C चार अनुपात पांच है, तो A B C क्या होगा?",
    "voiceTimer": "3 सेकंड में सोचिए!",
    "voiceCommentChallenge": "कमेंट में उत्तर दें! उल्टे N की ट्रिक से सेकंडों में निकालें! Follow Exam IQ Bharat!",
    "voiceAnswer": "सही उत्तर है ऑप्शन C, 8:12:15! 2 गुना 4 = 8, 3 गुना 4 = 12, और 3 गुना 5 = 15.",
    "explanation": "A = 2×4=8, B = 3×4=12, C = 3×5=15. अनुपात: 8:12:15.",
    "tags": [
      "#ExamIQ",
      "#RatioAndProportion",
      "#AptitudeTricks",
      "#MathQuiz",
      "#Reels"
    ]
  },
  {
    "id": "math_percent_10",
    "category": "math_quiz",
    "topic": "प्रतिशत (Percentage Trick)",
    "hookBar": "प्रतिशत का आसान सवाल",
    "title": "किसी संख्या का 20% यदि 80 है, तो वह संख्या क्या होगी?",
    "question": "यदि एक अज्ञात संख्या x का 20% 80 के बराबर है, तो उस संख्या का मान क्या होगा?",
    "questionLines": [
      "1. किसी संख्या का 20% यदि",
      "80 है, तो वह संख्या",
      "क्या होगी? 💯🔢"
    ],
    "options": [
      {
        "letter": "A",
        "text": "500"
      },
      {
        "letter": "B",
        "text": "160"
      },
      {
        "letter": "C",
        "text": "300"
      },
      {
        "letter": "D",
        "text": "400"
      }
    ],
    "correctOption": "D",
    "answerText": "D) 400 (80 × 5 = 400)",
    "voiceQuestion": "किसी संख्या का बीस प्रतिशत यदि अस्सी है, तो वह संख्या क्या होगी?",
    "voiceTimer": "3 सेकंड में निकालिए!",
    "voiceCommentChallenge": "कमेंट में बताएं सही विकल्प! 20% मतलब 1/5 होता है! Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन D, 400! 80 को 5 से गुणा करने पर 400 आता है।",
    "explanation": "x × 20/100 = 80 => x = 80 × 5 = 400.",
    "tags": [
      "#ExamIQ",
      "#PercentageTricks",
      "#BasicAptitude",
      "#MathShortcuts",
      "#Reels"
    ]
  },
  {
    "id": "math_triangle_angle_11",
    "category": "math_quiz",
    "topic": "ज्यामिति (Geometry Basics)",
    "hookBar": "त्रिभुज के कोणों का नियम",
    "title": "त्रिभुज के तीनों आंतरिक कोणों का योग कितना होता है?",
    "question": "यूक्लिडीय ज्यामिति में किसी भी समतल त्रिभुज के तीनों अंतः कोणों का योग क्या होता है?",
    "questionLines": [
      "1. त्रिभुज के तीनों अंतः",
      "कोणों का योग (Sum of",
      "Angles) कितना होता है? 📐🔺"
    ],
    "options": [
      {
        "letter": "A",
        "text": "270°"
      },
      {
        "letter": "B",
        "text": "180°"
      },
      {
        "letter": "C",
        "text": "90°"
      },
      {
        "letter": "D",
        "text": "360°"
      }
    ],
    "correctOption": "B",
    "answerText": "B) 180° (दो समकोण)",
    "voiceQuestion": "त्रिभुज के तीनों आंतरिक कोणों का कुल योग कितना होता है?",
    "voiceTimer": "3 सेकंड में सोचिए!",
    "voiceCommentChallenge": "कमेंट में उत्तर दें! चतुर्भुज के चारों कोणों का योग कितना होता है? Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन B, 180 अंश! चाहे त्रिभुज कैसा भी हो, तीनों अंतः कोणों का योग 180° ही होता है।",
    "explanation": "त्रिभुज के अंतः कोणों का योग = (n - 2) × 180° = (3 - 2) × 180° = 180°.",
    "tags": [
      "#ExamIQ",
      "#TriangleAngles",
      "#Geometry",
      "#MathBasics",
      "#Reels"
    ]
  },
  {
    "id": "math_speed_12",
    "category": "math_quiz",
    "topic": "गति और दूरी (Speed Calculation)",
    "hookBar": "मीटर/सेकंड से किमी/घंटा",
    "title": "यदि एक धावक 100 मीटर 10 सेकंड में दौड़ता है, तो गति किमी/घंटा में क्या है?",
    "question": "100 मीटर की दूरी 10 सेकंड में तय करने वाले धावक की चाल किमी प्रति घंटे में क्या होगी?",
    "questionLines": [
      "1. यदि एक धावक 100 मीटर",
      "10 सेकंड में दौड़ता है, तो",
      "गति km/h में क्या है? 🏃‍♂️⚡"
    ],
    "options": [
      {
        "letter": "A",
        "text": "36 km/h"
      },
      {
        "letter": "B",
        "text": "30 km/h"
      },
      {
        "letter": "C",
        "text": "40 km/h"
      },
      {
        "letter": "D",
        "text": "25 km/h"
      }
    ],
    "correctOption": "A",
    "answerText": "A) 36 km/h (10 m/s × 18/5 = 36)",
    "voiceQuestion": "100 मीटर 10 सेकंड में तय करने पर गति कितने किमी प्रति घंटा होगी?",
    "voiceTimer": "3 सेकंड में सोचिए!",
    "voiceCommentChallenge": "कमेंट बॉक्स में अपना जवाब लिखें! m/s को 18/5 से गुणा करें! Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन A, 36 किमी प्रति घंटा! 100/10 = 10 m/s, और 10 गुना 18/5 = 36 km/h.",
    "explanation": "चाल = 100/10 = 10 m/s. km/h में बदलने के लिए: 10 × 18/5 = 36 km/h.",
    "tags": [
      "#ExamIQ",
      "#SpeedMath",
      "#TimeAndDistance",
      "#Aptitude",
      "#Reels"
    ]
  },
  {
    "id": "math_age_logic_13",
    "category": "math_quiz",
    "topic": "आयु पहेली (Age Problems)",
    "hookBar": "पिता और पुत्र की आयु पहेली",
    "title": "पिता पुत्र से 3 गुना बड़ा है, दोनों का योग 60 है तो पुत्र की आयु क्या है?",
    "question": "यदि पिता की आयु पुत्र की आयु की तिगुनी है और दोनों की आयु का योग 60 वर्ष है, तो पुत्र की आयु क्या होगी?",
    "questionLines": [
      "1. पिता पुत्र से 3 गुना बड़ा है,",
      "दोनों का योग 60 है, तो पुत्र",
      "की आयु क्या है? 👨‍👦🎂"
    ],
    "options": [
      {
        "letter": "A",
        "text": "20 वर्ष"
      },
      {
        "letter": "B",
        "text": "10 वर्ष"
      },
      {
        "letter": "C",
        "text": "15 वर्ष"
      },
      {
        "letter": "D",
        "text": "12 वर्ष"
      }
    ],
    "correctOption": "C",
    "answerText": "C) 15 वर्ष (पुत्र: 15, पिता: 45)",
    "voiceQuestion": "पिता पुत्र से तिगुना बड़ा है और दोनों की आयु का योग 60 वर्ष है, तो पुत्र की आयु क्या है?",
    "voiceTimer": "3 सेकंड में दिमाग लगाइए!",
    "voiceCommentChallenge": "कमेंट में उत्तर दें! 60 को 4 हिस्सों में बांटिए! Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन C, 15 वर्ष! पुत्र की आयु 15 वर्ष और पिता की आयु 45 वर्ष होगी।",
    "explanation": "3x + x = 60 => 4x = 60 => x = 15 वर्ष (पुत्र की आयु)।",
    "tags": [
      "#ExamIQ",
      "#AgePuzzles",
      "#LogicalReasoning",
      "#MathPuzzle",
      "#Reels"
    ]
  },
  {
    "id": "math_even_prime_14",
    "category": "math_quiz",
    "topic": "सम अभाज्य संख्या (Even Prime)",
    "hookBar": "गणित का अनोखा नंबर",
    "title": "पूरी गणित में एकमात्र 'सम अभाज्य संख्या' (Even Prime) कौन सी है?",
    "question": "अनंत संख्याओं में एकमात्र ऐसी सम संख्या कौन सी है जो अभाज्य भी है?",
    "questionLines": [
      "1. पूरी गणित में एकमात्र 'सम",
      "अभाज्य संख्या' (Even Prime)",
      "कौन सी है? 🔢✨"
    ],
    "options": [
      {
        "letter": "A",
        "text": "8"
      },
      {
        "letter": "B",
        "text": "4"
      },
      {
        "letter": "C",
        "text": "6"
      },
      {
        "letter": "D",
        "text": "2"
      }
    ],
    "correctOption": "D",
    "answerText": "D) 2 (Two)",
    "voiceQuestion": "पूरी दुनिया में एकमात्र सम अभाज्य संख्या कौन सी है?",
    "voiceTimer": "3 सेकंड में सोचिए!",
    "voiceCommentChallenge": "कमेंट में बताएं सही उत्तर! 2 के अलावा सभी सम संख्याएं भाज्य होती हैं! Follow Exam IQ Bharat!",
    "voiceAnswer": "सही जवाब है ऑप्शन D, संख्या 2! 2 के अलावा कोई भी सम संख्या अभाज्य नहीं हो सकती क्योंकि वह 2 से विभाजित होगी।",
    "explanation": "2 एकमात्र सम अभाज्य संख्या है।",
    "tags": [
      "#ExamIQ",
      "#EvenPrime",
      "#MathFacts",
      "#InterestingMath",
      "#Reels"
    ]
  },
  {
    "id": "math_pi_circle_15",
    "category": "math_quiz",
    "topic": "पाई का रहस्य (The Number Pi - π)",
    "hookBar": "वृत्त की परिधि और व्यास का रहस्य",
    "title": "वृत्त की परिधि और उसके व्यास के अनुपात को क्या कहा जाता है?",
    "question": "किसी भी वृत्त की परिधि (Circumference) और व्यास (Diameter) का अचर अनुपात (C/d = 3.14159...) क्या कहलाता है?",
    "questionLines": [
      "1. वृत्त की परिधि और उसके",
      "व्यास के अनुपात को क्या",
      "कहा जाता है? ⭕📐π"
    ],
    "options": [
      {
        "letter": "A",
        "text": "थीटा (θ)"
      },
      {
        "letter": "B",
        "text": "पाई (π)"
      },
      {
        "letter": "C",
        "text": "अल्फा (α)"
      },
      {
        "letter": "D",
        "text": "सिग्मा (σ)"
      }
    ],
    "correctOption": "B",
    "answerText": "B) पाई (π - मान लगभग 22/7 या 3.14159)",
    "voiceQuestion": "वृत्त की परिधि और उसके व्यास के अनुपात को क्या कहा जाता है?",
    "voiceTimer": "3 सेकंड हैं!",
    "voiceCommentChallenge": "कमेंट में बताएं सही जवाब! 14 मार्च को अंतरराष्ट्रीय पाई दिवस मनाया जाता है। Follow Exam IQ Bharat!",
    "voiceAnswer": "सही उत्तर है ऑप्शन B, पाई यानी π! यह एक अपरिमेय संख्या है जिसका मान लगभग 3.14 होता है।",
    "explanation": "π = परिधि / व्यास। पाई दिवस 14 मार्च (3/14) को 1:59 बजे मनाया जाता है।",
    "tags": [
      "#ExamIQ",
      "#PiNumber",
      "#Geometry",
      "#MathMysteries",
      "#Reels"
    ]
  }
];

module.exports = mathPuzzles;
