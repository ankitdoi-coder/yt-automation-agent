'use strict';

const LETTERS = Object.freeze(['A', 'B', 'C', 'D']);

function escapeHtml(text = '') {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatHighlightHtml(text = '') {
  const escaped = escapeHtml(text);
  return escaped.replace(/\*\*([\s\S]+?)\*\*/g, (full, inner) => {
    if (!inner.trim() || /^\*+$/.test(inner.trim())) {
      return full;
    }
    return `<span class="hl">${inner}</span>`;
  });
}

function stripQuestionPrefix(text = '', { stripEmojis = false } = {}) {
  let out = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(?:(?:Q\.?\s*\d+|प्रश्न\s*\d+)\s*[.):\-–—]*\s+|\d{1,3}[.):\-–—]+\s+)/i, '')
    .trim();

  if (stripEmojis) {
    out = out
      .replace(/[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]+/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return out;
}

function stripOptionPrefix(text = '') {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\s*\(?[A-Da-d](?:[).:]|\s*[-–—]\s+)\s*/, '')
    .trim();
}

function splitParenTopic(str) {
  const trimmed = String(str ?? '').trim();
  const m = trimmed.match(/^(.+?)\s*\(([^()]+)\)\s*$/);
  if (m) {
    return { main: m[1].trim(), sub: `(${m[2].trim()})` };
  }
  return { main: trimmed, sub: '' };
}

function normalizePart(rawPart) {
  if (rawPart === null || rawPart === undefined || rawPart === false || rawPart === '') {
    return null;
  }
  if (typeof rawPart === 'number') {
    return Number.isFinite(rawPart) && rawPart > 0 ? rawPart : null;
  }
  const s = String(rawPart).trim().replace(/^part\s*[:#-]?\s*/i, '').trim();
  if (!s || s === '0' || s.toLowerCase() === 'null' || s.toLowerCase() === 'undefined') {
    return null;
  }
  if (/^\d+$/.test(s)) {
    const n = Number(s);
    return n > 0 ? n : null;
  }
  return s;
}

function normalizeQNo(rawQNo) {
  if (rawQNo === null || rawQNo === undefined || rawQNo === '') {
    return 1;
  }
  if (typeof rawQNo === 'number') {
    return Number.isFinite(rawQNo) && rawQNo > 0 ? rawQNo : 1;
  }
  const s = String(rawQNo).trim().replace(/^Q\.?\s*/i, '').trim();
  if (!s) return 1;
  if (/^\d+$/.test(s)) {
    return Number(s);
  }
  return s;
}

function resolveAnswerIndex(item, options, rawLetters) {
  const letterToIndex = (ch) => {
    const L = String(ch).toUpperCase();
    if (rawLetters.length === 4) {
      const idx = rawLetters.indexOf(L);
      if (idx !== -1) return idx;
    }
    return LETTERS.indexOf(L);
  };

  // 1. Explicit numeric index
  const rawIdx = item.answerIndex !== undefined && item.answerIndex !== null
    ? item.answerIndex
    : (item.correct_index !== undefined && item.correct_index !== null
      ? item.correct_index
      : item.correctIndex);

  if (rawIdx !== undefined && rawIdx !== null && rawIdx !== '') {
    const n = typeof rawIdx === 'number'
      ? rawIdx
      : (typeof rawIdx === 'string' && /^-?\d+$/.test(rawIdx.trim()) ? Number(rawIdx.trim()) : NaN);
    if (!Number.isInteger(n) || n < 0 || n > 3) {
      throw new Error(`normalizeQuizItem: answerIndex out of range 0..3 (got ${JSON.stringify(rawIdx)})`);
    }
    return n;
  }

  // 2. Explicit letter field
  const rawLetter = item.correctOption ?? item.correct ?? item.correctLetter;
  if (rawLetter !== undefined && rawLetter !== null && String(rawLetter).trim() !== '') {
    const m = String(rawLetter).match(/^\s*\(?([A-Da-d])\)?[).:\s]*$/);
    if (!m) {
      throw new Error(`normalizeQuizItem: invalid answer letter ${JSON.stringify(rawLetter)}`);
    }
    return letterToIndex(m[1]);
  }

  // 3. item.answer
  if (item.answer !== undefined && item.answer !== null && String(item.answer).trim() !== '') {
    if (typeof item.answer === 'number') {
      if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer > 3) {
        throw new Error(`normalizeQuizItem: numeric answer out of range 0..3 (got ${item.answer})`);
      }
      return item.answer;
    }
    const ans = String(item.answer).trim();
    const letterMatch = ans.match(/^\s*\(?([A-Da-d])(?:[).:]|\s*$)/);
    if (letterMatch) {
      return letterToIndex(letterMatch[1]);
    }
    const cleanAns = stripOptionPrefix(ans);
    const exactIdx = options.indexOf(cleanAns);
    if (exactIdx !== -1) return exactIdx;

    const lowerClean = cleanAns.toLowerCase();
    const ciIdx = options.findIndex((o) => o.toLowerCase() === lowerClean);
    if (ciIdx !== -1) return ciIdx;

    if (/^[0-3]$/.test(ans)) {
      return Number(ans);
    }
    throw new Error(`normalizeQuizItem: cannot resolve answer "${ans}" to options`);
  }

  // 4. item.answerText (Schema D fallback)
  if (typeof item.answerText === 'string' && item.answerText.trim()) {
    const at = item.answerText.trim();
    const letterMatch = at.match(/^\s*\(?([A-Da-d])[).:\s]/);
    if (letterMatch) {
      return letterToIndex(letterMatch[1]);
    }
    const cleanAt = stripOptionPrefix(at);
    const exactIdx = options.indexOf(cleanAt);
    if (exactIdx !== -1) return exactIdx;
    const prefixIdx = options.findIndex((o) => cleanAt.startsWith(o) || o.startsWith(cleanAt));
    if (prefixIdx !== -1) return prefixIdx;
  }

  throw new Error(
    'normalizeQuizItem: missing valid answer indicator (answerIndex/correct_index/correct/correctOption/answer/answerText)'
  );
}

function normalizeQuizItem(rawItem, context = {}) {
  if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
    throw new TypeError('normalizeQuizItem: rawItem must be a non-null object');
  }

  let item = rawItem;
  let ctx = context && typeof context === 'object' ? { ...context } : {};

  // Slide-wrapper unwrapping (e.g. buildQuizSlideData)
  if (rawItem.question && typeof rawItem.question === 'object' && !Array.isArray(rawItem.question)) {
    item = rawItem.question;
    ctx = {
      subject: rawItem.subject,
      subjectHindi: rawItem.subjectHindi,
      subjectSub: rawItem.subjectSub,
      part: rawItem.partNumber ?? rawItem.part,
      qNo: rawItem.questionNumber ?? rawItem.qNo,
      commentChallengeText: rawItem.commentChallengeText,
      ...ctx,
    };
  }

  // 1. subject & subjectSub
  let subject = '';
  let subjectSub = '';

  if (typeof item.subject === 'string' && item.subject.trim()) {
    if (item.subjectSub !== undefined && item.subjectSub !== null) {
      subject = item.subject.trim();
      subjectSub = String(item.subjectSub).trim();
    } else {
      const split = splitParenTopic(item.subject);
      subject = split.main;
      subjectSub = split.sub || (ctx.subjectSub != null ? String(ctx.subjectSub).trim() : '');
    }
  } else if (typeof item.topic === 'string' && item.topic.trim()) {
    const split = splitParenTopic(item.topic);
    subject = split.main;
    subjectSub = split.sub || (ctx.subjectSub != null ? String(ctx.subjectSub).trim() : '');
  } else if (typeof ctx.subjectHindi === 'string' && ctx.subjectHindi.trim()) {
    subject = ctx.subjectHindi.trim();
    if (ctx.subjectSub !== undefined && ctx.subjectSub !== null) {
      subjectSub = String(ctx.subjectSub).trim();
    } else if (
      typeof ctx.subject === 'string' &&
      ctx.subject.trim() &&
      ctx.subject.trim().toLowerCase() !== subject.toLowerCase()
    ) {
      subjectSub = `(${ctx.subject.trim()})`;
    }
  } else if (typeof item.title === 'string' && item.title.trim()) {
    const split = splitParenTopic(item.title);
    subject = split.main;
    subjectSub = split.sub || (ctx.subjectSub != null ? String(ctx.subjectSub).trim() : '');
  } else if (typeof ctx.subject === 'string' && ctx.subject.trim()) {
    const split = splitParenTopic(ctx.subject);
    subject = split.main;
    subjectSub = split.sub || (ctx.subjectSub != null ? String(ctx.subjectSub).trim() : '');
  } else {
    subject = String(item.category || ctx.category || ctx.defaultSubject || 'सामान्य ज्ञान').trim();
    subjectSub = String(ctx.subjectSub || '').trim();
  }

  // 2. part
  const rawPart = item.part !== undefined
    ? item.part
    : (item.partNumber !== undefined
      ? item.partNumber
      : (item.partNum !== undefined
        ? item.partNum
        : (ctx.part !== undefined ? ctx.part : (ctx.partNumber !== undefined ? ctx.partNumber : ctx.partNum))));
  const part = normalizePart(rawPart);

  // 3. qNo
  const rawQNo = item.qNo
    ?? item.number
    ?? item.questionNumber
    ?? ctx.qNo
    ?? (Number.isInteger(ctx.index) ? ctx.index + 1 : undefined)
    ?? (typeof item.id === 'number' ? item.id : undefined)
    ?? 1;
  const qNo = normalizeQNo(rawQNo);

  // 4. question
  let rawQ = '';
  let usedLines = false;
  if (typeof item.question === 'string' && item.question.trim()) {
    rawQ = item.question;
  } else if (Array.isArray(item.questionLines) && item.questionLines.length > 0) {
    rawQ = item.questionLines.map((s) => String(s ?? '').trim()).filter(Boolean).join(' ');
    usedLines = true;
  } else if (typeof item.q === 'string' && item.q.trim()) {
    rawQ = item.q;
  } else {
    throw new Error('normalizeQuizItem: missing question text (expected question, questionLines, or q)');
  }

  const question = stripQuestionPrefix(rawQ, { stripEmojis: usedLines });
  if (!question) {
    throw new Error('normalizeQuizItem: question text is empty after normalization');
  }

  // 5. options (4 strings)
  if (!Array.isArray(item.options) || item.options.length !== 4) {
    throw new Error('normalizeQuizItem: options must be an array of length 4');
  }

  const rawLetters = [];
  const options = item.options.map((opt, i) => {
    let text;
    if (opt && typeof opt === 'object') {
      if (typeof opt.letter === 'string') {
        rawLetters[i] = opt.letter.trim().toUpperCase();
      }
      text = String(opt.text ?? opt.label ?? opt.value ?? '');
    } else if (typeof opt === 'string' || typeof opt === 'number') {
      text = String(opt);
    } else {
      throw new Error(`normalizeQuizItem: invalid option at index ${i}`);
    }

    const cleaned = stripOptionPrefix(text);
    if (!cleaned) {
      throw new Error(`normalizeQuizItem: option at index ${i} is empty`);
    }
    return cleaned;
  });

  // 6. answerIndex
  const answerIndex = resolveAnswerIndex(item, options, rawLetters);

  // 7. explanation
  let rawExp = '';
  if (typeof item.explanation === 'string' && item.explanation.trim()) {
    rawExp = item.explanation;
  } else if (typeof item.fact === 'string' && item.fact.trim()) {
    rawExp = item.fact;
  } else if (typeof item.reason === 'string' && item.reason.trim()) {
    rawExp = item.reason;
  }
  const explanation = String(rawExp).replace(/\s+/g, ' ').trim();

  // 8. optional commentChallengeText
  const rawChallenge = (typeof item.commentChallengeText === 'string' && item.commentChallengeText.trim())
    ? item.commentChallengeText.trim()
    : ((typeof ctx.commentChallengeText === 'string' && ctx.commentChallengeText.trim())
      ? ctx.commentChallengeText.trim()
      : null);

  const result = {
    subject,
    subjectSub,
    part,
    qNo,
    question,
    options,
    answerIndex,
    explanation,
  };
  if (rawChallenge) {
    result.commentChallengeText = rawChallenge;
  }
  return result;
}

module.exports = {
  LETTERS,
  escapeHtml,
  formatHighlightHtml,
  normalizeQuizItem,
  stripQuestionPrefix,
  stripOptionPrefix,
};
