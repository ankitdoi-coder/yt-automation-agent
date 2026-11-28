(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  if (typeof root !== 'undefined') {
    root.QuizFitText = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);

  function tokenizeHtml(html) {
    const tokens = [];
    const re = /<[^>]+>|&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z][\w-]*);|[\s\S]/gu;
    let m;
    while ((m = re.exec(html)) !== null) {
      const raw = m[0];
      if (raw[0] === '<') {
        const closeMatch = raw.match(/^<\s*\/\s*([a-zA-Z0-9-]+)\s*>$/);
        if (closeMatch) {
          tokens.push({ type: 'closeTag', raw, tagName: closeMatch[1].toLowerCase() });
        } else {
          const openMatch = raw.match(/^<\s*([a-zA-Z0-9-]+)(?=[\s/>])/);
          const tagName = openMatch ? openMatch[1].toLowerCase() : '';
          const selfClosing = raw.endsWith('/>') || VOID_TAGS.has(tagName);
          tokens.push({
            type: selfClosing ? 'voidTag' : 'openTag',
            raw,
            tagName,
          });
        }
      } else if (/^\s$/.test(raw)) {
        tokens.push({ type: 'space', raw });
      } else {
        tokens.push({ type: 'text', raw });
      }
    }
    return tokens;
  }

  function buildBalancedSlice(tokens, endTokenIdx, suffix = '') {
    let limit = Math.min(endTokenIdx, tokens.length - 1);
    while (limit >= 0 && tokens[limit].type === 'space') {
      limit--;
    }
    if (limit < 0) {
      return suffix;
    }

    const openStack = [];
    let out = '';
    for (let i = 0; i <= limit; i++) {
      const t = tokens[i];
      out += t.raw;
      if (t.type === 'openTag' && t.tagName) {
        openStack.push(t.tagName);
      } else if (t.type === 'closeTag' && t.tagName) {
        for (let k = openStack.length - 1; k >= 0; k--) {
          if (openStack[k] === t.tagName) {
            openStack.splice(k, 1);
            break;
          }
        }
      }
    }

    // Consume any immediately adjacent closing tags at limit+1 so tags close cleanly before suffix
    let j = limit + 1;
    while (j < tokens.length && tokens[j].type === 'closeTag') {
      const t = tokens[j];
      out += t.raw;
      for (let k = openStack.length - 1; k >= 0; k--) {
        if (openStack[k] === t.tagName) {
          openStack.splice(k, 1);
          break;
        }
      }
      j++;
    }

    for (let k = openStack.length - 1; k >= 0; k--) {
      out += `</${openStack[k]}>`;
    }
    return out + suffix;
  }

  function findNextVisibleToken(tokens, startIdx) {
    for (let i = startIdx; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'text' || t.type === 'space') {
        return t;
      }
    }
    return null;
  }

  function truncateHtmlPreservingTags(html, fitsFn) {
    const tokens = tokenizeHtml(String(html || ''));
    if (tokens.length === 0) {
      return { truncated: false, mode: 'none' };
    }

    // 1. Collect sentence-boundary cuts
    const sentenceCuts = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type !== 'text') continue;

      const nextVisible = findNextVisibleToken(tokens, i + 1);
      const isSentenceEnd =
        t.raw === '।' ||
        t.raw === '॥' ||
        t.raw === '!' ||
        t.raw === '?' ||
        (t.raw === '.' &&
          (!nextVisible ||
            nextVisible.type === 'space' ||
            /^["'”’)\]]$/.test(nextVisible.raw)));

      if (!isSentenceEnd) continue;

      let cutIdx = i;
      while (cutIdx + 1 < tokens.length) {
        const nxt = tokens[cutIdx + 1];
        if (nxt.type === 'closeTag') {
          cutIdx++;
        } else if (nxt.type === 'text' && /^["'”’)\]]$/.test(nxt.raw)) {
          cutIdx++;
        } else {
          break;
        }
      }
      if (sentenceCuts.length === 0 || sentenceCuts[sentenceCuts.length - 1] !== cutIdx) {
        sentenceCuts.push(cutIdx);
      }
    }

    // Binary search sentenceCuts for largest cut that fits
    if (sentenceCuts.length > 0) {
      let lo = 0;
      let hi = sentenceCuts.length - 1;
      let bestCut = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const candidate = buildBalancedSlice(tokens, sentenceCuts[mid], '');
        if (fitsFn(candidate)) {
          bestCut = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (bestCut !== -1) {
        const finalHtml = buildBalancedSlice(tokens, sentenceCuts[bestCut], '');
        fitsFn(finalHtml);
        return { truncated: true, mode: 'sentence', html: finalHtml };
      }
    }

    // 2. Fallback: word-boundary cuts (never mid-word)
    const wordCuts = [];
    let hasWordChars = false;
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.type === 'text') {
        hasWordChars = true;
      } else if (t.type === 'space' && hasWordChars) {
        wordCuts.push(i - 1);
        hasWordChars = false;
      }
    }
    if (hasWordChars) {
      wordCuts.push(tokens.length - 1);
    }

    if (wordCuts.length > 0) {
      let lo = 0;
      let hi = wordCuts.length - 1;
      let bestCut = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const candidate = buildBalancedSlice(tokens, wordCuts[mid], '…');
        if (fitsFn(candidate)) {
          bestCut = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      if (bestCut !== -1) {
        const finalHtml = buildBalancedSlice(tokens, wordCuts[bestCut], '…');
        fitsFn(finalHtml);
        return { truncated: true, mode: 'word', html: finalHtml };
      }
      const hardHtml = buildBalancedSlice(tokens, wordCuts[0], '…');
      fitsFn(hardHtml);
      return { truncated: true, mode: 'hard-word', stillOverflowing: true, html: hardHtml };
    }

    return { truncated: false, mode: 'none' };
  }

  function fitsBox(el) {
    return el.scrollHeight <= el.clientHeight + 1 && el.scrollWidth <= el.clientWidth + 1;
  }

  function getLineCount(el, fontSize, win) {
    const cs = win.getComputedStyle(el);
    const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const lh = parseFloat(cs.lineHeight) || fontSize * 1.25;
    const contentH = Math.max(0, el.scrollHeight - padY);
    return Math.max(1, Math.round(contentH / lh));
  }

  function readNumAttr(el, attr, fallback) {
    const raw = el.getAttribute(attr);
    if (raw === null || raw === '') return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function binarySearchFontSize(el, minPx, maxPx, checkFn) {
    let lo = Math.ceil(minPx);
    let hi = Math.floor(maxPx);
    let best = null;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      el.style.fontSize = mid + 'px';
      if (checkFn(mid)) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return best;
  }

  function fitQuestion(el, win, warnings) {
    const maxFont = readNumAttr(el, 'data-fit-max', 72);
    const minPreferred = readNumAttr(el, 'data-fit-min', 56);
    const minHard = readNumAttr(el, 'data-fit-min-hard', 32);
    const maxLines = readNumAttr(el, 'data-fit-max-lines', 3);

    let best = binarySearchFontSize(
      el,
      minPreferred,
      maxFont,
      (mid) => fitsBox(el) && getLineCount(el, mid, win) <= maxLines
    );

    if (best !== null) {
      el.style.fontSize = best + 'px';
      return best;
    }

    warnings.push(
      `question exceeded maxLines=${maxLines} or height at ${minPreferred}px; shrinking below ${minPreferred}px`
    );
    best = binarySearchFontSize(el, minHard, minPreferred - 1, () => fitsBox(el));
    const applied = best !== null ? best : minHard;
    el.style.fontSize = applied + 'px';

    if (best === null || applied <= minHard) {
      warnings.push(`question hit hard min font size ${minHard}px`);
    }
    return applied;
  }

  function fitOption(el, win, warnings) {
    const maxFont = readNumAttr(el, 'data-fit-max', 52);
    const minSingle = readNumAttr(el, 'data-fit-min', 40);
    const minWrap = readNumAttr(el, 'data-fit-min-wrap', 28);

    // Step 1: Single-line fit
    el.style.whiteSpace = 'nowrap';
    let best = binarySearchFontSize(el, minSingle, maxFont, () => fitsBox(el));
    if (best !== null) {
      el.style.fontSize = best + 'px';
      return best;
    }

    // Step 2: 2-line wrap fallback
    const snippet = (el.textContent || '').trim().slice(0, 30);
    warnings.push(`option "${snippet}" overflowed single-line at ${minSingle}px; wrapping to 2 lines`);
    el.style.whiteSpace = 'normal';
    el.style.lineHeight = '1.15';

    best = binarySearchFontSize(
      el,
      minWrap,
      minSingle,
      (mid) => fitsBox(el) && getLineCount(el, mid, win) <= 2
    );
    if (best === null) {
      best = binarySearchFontSize(el, minWrap, minSingle, () => fitsBox(el));
    }

    const applied = best !== null ? best : minWrap;
    el.style.fontSize = applied + 'px';
    if (best === null || applied <= minWrap) {
      warnings.push(`option hit min wrap font size ${minWrap}px`);
    }
    return applied;
  }

  function fitAnswer(el, warnings) {
    const maxFont = readNumAttr(el, 'data-fit-max', 92);
    const minFont = readNumAttr(el, 'data-fit-min', 36);

    el.style.whiteSpace = 'normal';
    const best = binarySearchFontSize(el, minFont, maxFont, () => fitsBox(el));
    const applied = best !== null ? best : minFont;
    el.style.fontSize = applied + 'px';
    if (best === null || applied <= minFont) {
      warnings.push(`answer hit min font size ${minFont}px`);
    }
    return applied;
  }

  function fitExplanation(el, warnings) {
    const maxFont = readNumAttr(el, 'data-fit-max', 56);
    const minFont = readNumAttr(el, 'data-fit-min', 36);
    const originalHtml = el.innerHTML;

    const best = binarySearchFontSize(el, minFont, maxFont, () => fitsBox(el));
    if (best !== null) {
      el.style.fontSize = best + 'px';
      if (best <= minFont) {
        warnings.push(`explanation hit min font size ${minFont}px`);
      }
      return { fontSize: best, truncated: false };
    }

    el.style.fontSize = minFont + 'px';
    warnings.push(`explanation overflowed at ${minFont}px; truncating at sentence boundary`);
    const trunc = truncateHtmlPreservingTags(originalHtml, (candidateHtml) => {
      el.innerHTML = candidateHtml;
      return fitsBox(el);
    });
    return { fontSize: minFont, truncated: trunc.truncated, mode: trunc.mode };
  }

  function fitQuizElements(doc = document) {
    const win = doc.defaultView || (typeof window !== 'undefined' ? window : globalThis);
    const warnings = [];
    const fitted = [];
    const elements = doc.querySelectorAll('[data-fit]');

    for (const el of elements) {
      if (el.clientWidth === 0 && el.clientHeight === 0) {
        continue;
      }
      const role = el.getAttribute('data-fit');
      if (role === 'question') {
        const fontSize = fitQuestion(el, win, warnings);
        fitted.push({ role, fontSize });
      } else if (role === 'option') {
        const fontSize = fitOption(el, win, warnings);
        fitted.push({ role, fontSize });
      } else if (role === 'answer') {
        const fontSize = fitAnswer(el, warnings);
        fitted.push({ role, fontSize });
      } else if (role === 'explanation') {
        const res = fitExplanation(el, warnings);
        fitted.push({ role, ...res });
      }
    }

    return { warnings, fitted };
  }

  return {
    fitQuizElements,
    truncateHtmlPreservingTags,
  };
});
