// Shared narration and script formatting for quiz videos.
// Implements the user's GK Quiz Voice-Over Script Writer format:
//
// पहले सवाल के लिए:
// "आपका पहला सवाल है— [Question]
// इसका सही जवाब है— [Answer]"
//
// इसके बाद हर सवाल के लिए:
// "आपका अगला सवाल है— [Question]
// इसका सही जवाब है— [Answer]"
//
// आखिरी सवाल के लिए:
// "आपका आखिरी सवाल है— [Question]
// इसका सही जवाब है— [Answer]"
//
// Rules enforced:
// 1. किसी भी सवाल के आगे नंबर नहीं लगाना है।
// 2. किसी भी सवाल में A, B, C, D वाले Options नहीं बोलने हैं / नहीं देने हैं।
// 3. "सोचिए", "आपका समय शुरू होता है", Countdown आदि नहीं लिखना है।
// 4. हर Question के बाद तुरंत "इसका सही जवाब है—" लिखना है।
// 5. Answer को स्पष्ट और सही हिंदी में लिखना है।
// 6. Script ऐसी होनी चाहिए जिसे सीधे Text-to-Speech/Voice-Over में इस्तेमाल किया जा सके।
// 7. भाषा सरल, प्राकृतिक और बोलने में आसान हिंदी हो।
// 8. अनावश्यक Introduction, Explanation या Extra जानकारी नहीं जोड़नी है।
// 9. अगर Question में गलती हो तो उसे समझदारी से सुधारकर सही Question और सही Answer देना है।
// 10. अगर किसी Answer को लेकर संदेह हो, तो अनुमान लगाने के बजाय सही तथ्य के अनुसार Answer देना है।
// 11. सभी Questions उसी क्रम में रखने हैं जिस क्रम में दिए गए हैं।
// 12. कोई Question दोबारा नहीं लिखना है और कोई Question छोड़ना नहीं है।
// 13. हर Question के बीच एक खाली लाइन रखना है ताकि Voice-Over Script पढ़ने में आसानी हो।
// 14. पहले Question में केवल "आपका पहला सवाल है" लिखना है।
// 15. दूसरे से आखिरी से पहले तक सभी Questions में "आपका अगला सवाल है" लिखना है।
// 16. केवल आखिरी Question में "आपका आखिरी सवाल है" लिखना है।
// 17. अंत में कोई Outro या अतिरिक्त लाइन नहीं जोड़नी है, जब तक अलग से न कहा जाए।
// 18. अगर कोई अंक हो तो उनको शब्दों में लिखकर स्क्रिप्ट में बनाना।

const LETTERS = ['A', 'B', 'C', 'D'];

const DEVANAGARI_DIGITS = {
  '०': '0', '१': '1', '२': '2', '३': '3', '४': '4',
  '५': '5', '६': '6', '७': '7', '८': '8', '९': '9'
};

function devanagariToStandardDigits(text = '') {
  return String(text || '').replace(/[०-९]/g, d => DEVANAGARI_DIGITS[d] || d);
}

const HINDI_UNITS = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाइस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरेपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरेसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सरसठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उनासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी',
  'नब्बे', 'इक्यानवे', 'बानवे', 'तिरानवे', 'चौरानवे', 'पंचानवे', 'छियानवे', 'सत्तानवे', 'अट्ठानवे', 'निन्यानवे'
];

function numberToHindiWords(num) {
  num = parseInt(num, 10);
  if (isNaN(num)) return '';
  if (num < 100) return HINDI_UNITS[num] || String(num);
  if (num >= 100 && num < 1000) {
    const h = Math.floor(num / 100);
    const r = num % 100;
    return (HINDI_UNITS[h] || String(h)) + ' सौ' + (r > 0 ? ' ' + (HINDI_UNITS[r] || String(r)) : '');
  }
  // 1000 - 1099: "एक हज़ार" / "एक हज़ार पाँच"
  if (num >= 1000 && num < 1100) {
    const r = num % 1000;
    return 'एक हज़ार' + (r > 0 ? ' ' + (HINDI_UNITS[r] || String(r)) : '');
  }
  // 1100 - 1999: natural Hindi years / numbers, e.g. 1947 -> "उन्नीस सौ सैंतालीस"
  if (num >= 1100 && num < 2000) {
    const c = Math.floor(num / 100);
    const r = num % 100;
    return (HINDI_UNITS[c] || String(c)) + ' सौ' + (r > 0 ? ' ' + (HINDI_UNITS[r] || String(r)) : '');
  }
  if (num >= 2000 && num < 100000) {
    const th = Math.floor(num / 1000);
    const rem = num % 1000;
    const thWord = numberToHindiWords(th) + ' हज़ार';
    if (rem === 0) return thWord;
    return thWord + ' ' + numberToHindiWords(rem);
  }
  if (num >= 100000 && num < 10000000) {
    const lk = Math.floor(num / 100000);
    const rem = num % 100000;
    const lkWord = numberToHindiWords(lk) + ' लाख';
    if (rem === 0) return lkWord;
    return lkWord + ' ' + numberToHindiWords(rem);
  }
  if (num >= 10000000 && num < 1000000000) {
    const cr = Math.floor(num / 10000000);
    const rem = num % 10000000;
    const crWord = numberToHindiWords(cr) + ' करोड़';
    if (rem === 0) return crWord;
    return crWord + ' ' + numberToHindiWords(rem);
  }
  return String(num);
}

// Reverse mapping: Hindi number words -> Arabic numeric digits (e.g. 'सत्रह' -> '17', 'उन्नीस सौ सैंतालीस' -> '1947')
const HINDI_NUM_WORDS = {};
HINDI_UNITS.forEach((w, i) => { HINDI_NUM_WORDS[w] = i; });
const HINDI_NUM_VARIANTS = {
  'शून्य': 0, 'सिफर': 0, 'एक': 1, 'दो': 2, 'तीन': 3, 'चार': 4,
  'पांच': 5, 'पाँच': 5, 'छह': 6, 'छः': 6, 'सात': 7, 'आठ': 8, 'नौ': 9,
  'दस': 10, 'ग्यारह': 11, 'बारह': 12, 'तेरह': 13, 'चौदह': 14,
  'पंद्रह': 15, 'सोलह': 16, 'सत्रह': 17, 'अठारह': 18, 'उन्नीस': 19,
  'बीस': 20, 'इक्कीस': 21, 'बाईस': 22, 'तेईस': 23, 'चौबीस': 24,
  'पच्चीस': 25, 'छब्बीस': 26, 'सत्ताईस': 27, 'अट्ठाइस': 28, 'अट्ठाईस': 28,
  'उनतीस': 29, 'तीस': 30, 'इकतीस': 31, 'बत्तीस': 32,
  'तैंतीस': 33, 'चौंतीस': 34, 'पैंतीस': 35, 'छत्तीस': 36, 'सैंतीस': 37,
  'अड़तीस': 38, 'उनतालीस': 39, 'चालीस': 40, 'इकतालीस': 41, 'बयालीस': 42,
  'तैंतालीस': 43, 'चवालीस': 44, 'पैंतालीस': 45, 'छियालीस': 46, 'सैंतालीस': 47,
  'अड़तालीस': 48, 'उनचास': 49, 'पचास': 50, 'इक्यावन': 51, 'बावन': 52,
  'तिरेपन': 53, 'चौवन': 54, 'पचपन': 55, 'छप्पन': 56, 'सत्तावन': 57,
  'अट्ठावन': 58, 'उनसठ': 59, 'साठ': 60, 'इकसठ': 61, 'बासठ': 62,
  'तिरेसठ': 63, 'चौंसठ': 64, 'पैंसठ': 65, 'छियासठ': 66, 'सरसठ': 67,
  'अड़सठ': 68, 'उनहत्तर': 69, 'सत्तर': 70, 'इकहत्तर': 71, 'बहत्तर': 72,
  'तिहत्तर': 73, 'चौहत्तर': 74, 'पचहत्तर': 75, 'छिहत्तर': 76, 'सतहत्तर': 77,
  'अठहत्तर': 78, 'उनासी': 79, 'अस्सी': 80, 'इक्यासी': 81, 'बयासी': 82,
  'तिरासी': 83, 'चौरासी': 84, 'पचासी': 85, 'छियासी': 86, 'सत्तासी': 87,
  'अट्ठासी': 88, 'नवासी': 89, 'नब्बे': 90, 'इक्यानवे': 91, 'बानवे': 92,
  'तिरानवे': 93, 'चौरानवे': 94, 'पंचानवे': 95, 'छियानवे': 96, 'सत्तानवे': 97,
  'अट्ठानवे': 98, 'निन्यानवे': 99
};
Object.assign(HINDI_NUM_WORDS, HINDI_NUM_VARIANTS);
const HINDI_SCALE_WORDS = new Set(['सौ', 'हज़ार', 'हजार', 'लाख', 'करोड़']);

function parseCompoundHindiNumber(tokens) {
  let total = 0;
  let current = 0;
  for (const token of tokens) {
    if (token === 'करोड़') {
      current = (current || 1) * 10000000;
      total += current;
      current = 0;
    } else if (token === 'लाख') {
      current = (current || 1) * 100000;
      total += current;
      current = 0;
    } else if (token === 'हज़ार' || token === 'हजार') {
      current = (current || 1) * 1000;
      total += current;
      current = 0;
    } else if (token === 'सौ') {
      current = (current || 1) * 100;
    } else if (HINDI_NUM_WORDS[token] !== undefined) {
      current += HINDI_NUM_WORDS[token];
    } else {
      return null;
    }
  }
  return total + current;
}

// Converts spelled-out Hindi number words into numeric digits (for on-screen questions & options)
// e.g. "अनुच्छेद सत्रह" -> "अनुच्छेद 17", "उन्नीस सौ सैंतालीस" -> "1947", "अट्ठाईस फरवरी" -> "28 फरवरी"
function hindiWordsToNumbers(text = '') {
  if (!text) return '';
  const parts = String(text).split(/([^\p{L}\p{M}\p{N}]+)/u);
  const result = [];
  let numTokens = [];

  const flushNum = () => {
    if (numTokens.length > 0) {
      const parsed = parseCompoundHindiNumber(numTokens);
      if (parsed !== null && parsed !== undefined) {
        result.push(String(parsed));
      } else {
        result.push(numTokens.join(' '));
      }
      numTokens = [];
    }
  };

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const isNumWord = (HINDI_NUM_WORDS[part] !== undefined || HINDI_SCALE_WORDS.has(part));

    if (isNumWord) {
      numTokens.push(part);
    } else if (/^\s+$/.test(part) && numTokens.length > 0) {
      let nextIsNum = false;
      for (let j = i + 1; j < parts.length; j++) {
        if (!parts[j] || /^\s+$/.test(parts[j])) continue;
        if (HINDI_NUM_WORDS[parts[j]] !== undefined || HINDI_SCALE_WORDS.has(parts[j])) {
          nextIsNum = true;
        }
        break;
      }
      if (nextIsNum) {
        continue;
      } else {
        flushNum();
        result.push(part);
      }
    } else {
      flushNum();
      result.push(part);
    }
  }
  flushNum();
  return result.join('');
}

// Detects corrupted / token-split Devanagari text (e.g., 'भ रत म र श ट', 'ठ ठर फरवर')
function isCorruptedDevanagari(text = '') {
  const str = String(text || '').trim();
  if (!str) return false;

  // 1. Spaced-out single Devanagari consonants (e.g. 'भ रत म र श ट')
  if (/(?:^|\s)[\u0905-\u0939](\s+[\u0905-\u0939]){2,}(?:\s|$)/.test(str)) {
    return true;
  }

  // 2. High ratio of bare single Devanagari consonants (matra-stripped words like 'ठ ठर फरवर')
  const words = str.split(/\s+/).filter(Boolean);
  const bareConsonants = words.filter(w => /^[\u0905-\u0939]$/.test(w)).length;
  if (words.length >= 2 && (bareConsonants / words.length) >= 0.3) {
    return true;
  }

  // 3. Sentence with many consonants but zero or negligible matras
  const devanagariConsonants = (str.match(/[\u0905-\u0939]/g) || []).length;
  const matras = (str.match(/[\u093E-\u094C\u0962\u0963]/g) || []).length;
  if (devanagariConsonants >= 12 && matras === 0) {
    return true;
  }

  return false;
}

// Rule 18: Convert all numeric digits (Devanagari or standard) into Hindi words
function convertNumbersInText(text) {
  const normalized = devanagariToStandardDigits(text);
  return String(normalized || '').replace(/\d+/g, match => {
    const converted = numberToHindiWords(match);
    return converted || match;
  });
}

// Rule 1, 3: Strip leading question numbers, countdown, thinking words
function cleanQuestionText(raw = '') {
  let text = String(raw || '').trim();
  // Strip leading question numbers like "1.", "(1)", "1)", "1 -", "प्रश्न 1:", "सवाल 1.", "Q1.", "१."
  text = text.replace(/^(?:\((?:[0-9]+|[०-९]+)\)|(?:प्रश्न|सवाल|Question|Q)\s*(?:[0-9]+|[०-९]+)[\.\:\-\)।]?|(?:[0-9]+|[०-९]+)[\.\:\-\)।])\s*/i, '').trim();
  // Strip already-existing narration prefix if re-cleaning
  text = text.replace(/^(?:आपका\s+(?:पहला|अगला|आखिरी)\s+सवाल\s+है[\—\-\:\s]*)/i, '').trim();
  // Strip trailing thinking / countdown words
  text = text.replace(/\s*(?:सोचिए|सोचें|आपका समय शुरू होता है|समय शुरू होता है|समय समाप्त|काउंटडाउन|countdown|time's up)[\s\S]*$/i, '').trim();
  // Strip trailing embedded option lists if pasted in question
  text = text.replace(/\s*(?:(?:विकल्प\s*)?[A-Da-d][\)\.\:\-]|(?:\([A-Da-d]\)))\s+[\s\S]*$/, '').trim();
  // Strip trailing question marks and punctuation so we can add single clean '?'
  text = text.replace(/[\?\.।]+$/g, '').trim();
  return text;
}

// Rule 2, 8: Strip option letters, explanation, countdown, trailing punctuation
function cleanAnswerText(raw = '') {
  let text = String(raw || '').trim();
  // Strip already-existing narration prefix if re-cleaning
  text = text.replace(/^(?:इसका\s+सही\s+(?:जवाब|उत्तर)\s+है[\—\-\:\s]*|(?:सही\s+)?(?:उत्तर|जवाब)[\s\:\-\.]*)/i, '').trim();
  // Strip leading option letters like "A)", "B.", "(C)", "विकल्प B:" etc.
  text = text.replace(/^(?:(?:विकल्प\s*)?[A-Da-d][\)\.\:\-]|(?:\([A-Da-d]\)))\s*/i, '').trim();
  // Strip trailing thinking / countdown / time's up words if present
  text = text.replace(/\s*(?:सोचिए|समय समाप्त|countdown|time's up)[\s\S]*$/i, '').trim();
  // Strip trailing explanation (Rule 8: no extra explanation)
  text = text.replace(/\s*(?:[—–]|(?:\s+[-]))\s*[\s\S]*$/, '').trim();
  // Strip trailing periods or purna virams so we can add single clean '।'
  text = text.replace(/[\.।]+$/g, '').trim();
  return text;
}

// Question narration line according to Rules 14, 15, 16:
// 14. पहले Question में केवल "आपका पहला सवाल है" लिखना है।
// 15. दूसरे से आखिरी से पहले तक सभी Questions में "आपका अगला सवाल है" लिखना है।
// 16. केवल आखिरी Question में "आपका आखिरी सवाल है" लिखना है।
function questionNarration(question = {}, language = 'hi', index = 0, total = 1) {
  let text = cleanQuestionText(typeof question === 'string' ? question : question.question);
  if (!text) return '';

  if (language === 'hi') {
    text = convertNumbersInText(text);
    text += '?';

    if (index === 0) {
      return `आपका पहला सवाल है— ${text}`;
    } else if (index === total - 1 && total > 1) {
      return `आपका आखिरी सवाल है— ${text}`;
    } else {
      return `आपका अगला सवाल है— ${text}`;
    }
  }

  // English fallback
  text += '?';
  if (index === 0) {
    return `Your first question is— ${text}`;
  } else if (index === total - 1 && total > 1) {
    return `Your last question is— ${text}`;
  } else {
    return `Your next question is— ${text}`;
  }
}

// Answer narration line according to Rules 4, 5:
// "इसका सही जवाब है— [Answer]"
function answerNarration(question = {}, language = 'hi') {
  let rawAnswer = '';
  if (typeof question === 'string') {
    rawAnswer = question;
  } else if (Number.isInteger(question.answerIndex) && Array.isArray(question.options)) {
    rawAnswer = String(question.options[question.answerIndex] || '').trim();
  } else {
    rawAnswer = String(
      question.answer ||
      question.correctAnswer ||
      question.correct_answer ||
      question.answerText ||
      ''
    ).trim();
  }

  // If rawAnswer is just a single option letter ('A', 'B', 'C', 'D'), resolve it to the option text
  if (/^[A-Da-d]$/.test(rawAnswer) && Array.isArray(question?.options)) {
    const idx = 'ABCD'.indexOf(rawAnswer.toUpperCase());
    if (idx >= 0 && question.options[idx]) {
      rawAnswer = String(question.options[idx]).trim();
    }
  }

  let text = cleanAnswerText(rawAnswer);
  if (!text) return '';

  let explanation = '';
  if (question && typeof question === 'object' && question.explanation) {
    explanation = String(question.explanation).trim();
    if (explanation) {
      if (language === 'hi') {
        explanation = convertNumbersInText(explanation);
        if (!explanation.endsWith('।') && !explanation.endsWith('.')) explanation += '।';
      } else {
        if (!explanation.endsWith('.')) explanation += '.';
      }
    }
  }

  if (language === 'hi') {
    text = convertNumbersInText(text);
    text += '।';
    const base = `इसका सही जवाब है— ${text}`;
    return explanation ? `${base} ${explanation}` : base;
  }

  text += '.';
  const base = `The correct answer is— ${text}`;
  return explanation ? `${base} ${explanation}` : base;
}

function introNarration(subject = 'सामान्य ज्ञान', count = 10, language = 'hi') {
  if (language === 'hi') {
    const countWords = numberToHindiWords(count) || String(count);
    return `आज हम देखेंगे ${subject} के टॉप ${countWords} महत्वपूर्ण प्रश्न।`;
  }
  return `Today we will look at top ${count} important ${subject} questions.`;
}

// Strict Voice-Over script generator enforcing all 18 rules:
// - Optional dynamic intro: "आज हम देखेंगे [विषय] के टॉप [संख्या] महत्वपूर्ण प्रश्न।"
// - Question 1: "आपका पहला सवाल है— [Question]\nइसका सही जवाब है— [Answer]"
// - Question 2..N-1: "आपका अगला सवाल है— [Question]\nइसका सही जवाब है— [Answer]"
// - Question N: "आपका आखिरी सवाल है— [Question]\nइसका सही जवाब है— [Answer]"
// - Blank line between each question (Rule 13)
// - No question numbers (Rule 1)
// - No options A/B/C/D (Rule 2)
// - No countdown / thinking words (Rule 3)
// - Numbers converted to words (Rule 18)
function formatStrictQuizScript(questions = [], language = 'hi', options = {}) {
  if (!Array.isArray(questions) || questions.length === 0) return '';
  const total = questions.length;
  const blocks = [];

  const intro = options.introText || (options.includeIntro ? introNarration(options.subject || 'सामान्य ज्ञान', total, language) : null);
  if (intro) {
    blocks.push(intro);
  }

  for (let i = 0; i < total; i++) {
    const question = questions[i];
    const qLine = questionNarration(question, language, i, total);
    const aLine = answerNarration(question, language);
    if (qLine && aLine) {
      blocks.push(`${qLine}\n${aLine}`);
    } else if (qLine) {
      blocks.push(qLine);
    }
  }

  return blocks.join('\n\n').trim();
}

function wordCount(text) {
  return String(text || '').split(/\s+/).filter(Boolean).length;
}

// Estimates duration in seconds based on spoken words and punctuation pauses.
function estimateSpeechDuration(text, language = 'hi') {
  const str = String(text || '').trim();
  if (!str) return 0;

  const words = str.split(/\s+/).filter(Boolean).length;
  // Sentence-ending punctuation: । . ? !
  const sentenceCount = (str.match(/[।\.\?!]/g) || []).length;
  // Short pauses: , : ; —
  const shortPauseCount = (str.match(/[,:;—]/g) || []).length;

  const secondsPerWord = language === 'en' ? 0.42 : 0.48;
  const sentencePause = language === 'en' ? 0.50 : 0.60;
  const shortPause = language === 'en' ? 0.20 : 0.30;

  const duration = (words * secondsPerWord) + (sentenceCount * sentencePause) + (shortPauseCount * shortPause);
  return Math.max(1.5, duration);
}

// Short Quiz Rapid-Fire Narration:
// No "आपका पहला सवाल", no options spoken, no long explanations.
// Question is spoken directly, then answer is spoken directly.
function shortQuestionNarration(question = {}, language = 'hi') {
  let text = cleanQuestionText(typeof question === 'string' ? question : question.question);
  if (!text) return '';
  if (language === 'hi') {
    text = convertNumbersInText(text);
  }
  return `${text}?`;
}

function shortAnswerNarration(question = {}, language = 'hi') {
  let rawAnswer = '';
  if (typeof question === 'string') {
    rawAnswer = question;
  } else if (Number.isInteger(question.answerIndex) && Array.isArray(question.options)) {
    rawAnswer = String(question.options[question.answerIndex] || '').trim();
  } else {
    rawAnswer = String(
      question.answer ||
      question.correctAnswer ||
      question.correct_answer ||
      question.answerText ||
      ''
    ).trim();
  }

  if (/^[A-Da-d]$/.test(rawAnswer) && Array.isArray(question?.options)) {
    const idx = 'ABCD'.indexOf(rawAnswer.toUpperCase());
    if (idx >= 0 && question.options[idx]) {
      rawAnswer = String(question.options[idx]).trim();
    }
  }

  let text = cleanAnswerText(rawAnswer);
  if (!text) return '';

  if (language === 'hi') {
    text = convertNumbersInText(text);
    return `${text}।`;
  }
  return `${text}.`;
}

function formatShortQuizScript(questions = [], language = 'hi', options = {}) {
  const lines = [];
  const count = questions.length || 5;
  const countWords = language === 'hi' ? numberToHindiWords(count) : count;

  // 1. High-retention opening hook (First 2-3 seconds)
  const hook = options.hook || (language === 'hi'
    ? `क्या आप इन ${countWords} महत्वपूर्ण प्रश्नों के सही उत्तर जानते हैं? चलिए देखते हैं!`
    : `Can you score ${count} out of ${count} in this rapid fire exam quiz? Let's test your knowledge!`);
  lines.push(hook);
  lines.push('');

  // 2. Question & Answer cycles
  for (const q of questions) {
    const qText = shortQuestionNarration(q, language);
    const aText = shortAnswerNarration(q, language);
    if (qText) lines.push(qText);
    if (aText) lines.push(aText);
    lines.push('');
  }

  // 3. High-converting closing verbal CTA for Related Video + Subscribe
  const cta = options.cta || (language === 'hi'
    ? 'पूरे टेस्ट और फ्री पीडीएफ के लिए नीचे दिए गए रिलेटेड वीडियो पर क्लिक करें और सब्सक्राइब करें!'
    : 'Tap the related video below for the complete test and subscribe to ExamIQ Bharat!');
  lines.push(cta);

  return lines.join('\n').trim();
}

module.exports = {
  LETTERS,
  introNarration,
  questionNarration,
  answerNarration,
  shortQuestionNarration,
  shortAnswerNarration,
  formatStrictQuizScript,
  formatShortQuizScript,
  wordCount,
  estimateSpeechDuration,
  numberToHindiWords,
  convertNumbersInText,
  hindiWordsToNumbers,
  isCorruptedDevanagari,
  cleanQuestionText,
  cleanAnswerText,
  devanagariToStandardDigits
};
