'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const {
  LETTERS,
  escapeHtml,
  formatHighlightHtml,
  normalizeQuizItem,
} = require('./adapter');
const { PROFILES, resolveProfile } = require('./profiles');
const { FONT_MANIFEST, FONTS_DIR } = require('./scripts/download-fonts');

const ASSETS_DIR = path.join(__dirname, 'assets');
const TEMPLATES_DIR = path.join(__dirname, 'templates');
const FIT_TEXT_PATH = path.join(__dirname, 'fit-text.js');

const UNICODE_RANGES = {
  devanagari:
    'U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B09',
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+FEFF, U+FFFD',
};

const PROFILE_FIT_BOUNDS = {
  'reel-9x16': {
    question: { max: 80, min: 52, minHard: 34, maxLines: 3 },
    option: { max: 60, min: 40, minWrap: 28 },
    answer: { max: 116, min: 34 },
    explanation: { max: 58, min: 36 },
  },
  'shorts-9x16': {
    question: { max: 80, min: 52, minHard: 34, maxLines: 3 },
    option: { max: 60, min: 40, minWrap: 28 },
    answer: { max: 116, min: 34 },
    explanation: { max: 58, min: 36 },
  },
  'feed-4x5': {
    question: { max: 54, min: 38, minHard: 26, maxLines: 3 },
    option: { max: 46, min: 32, minWrap: 22 },
    answer: { max: 82, min: 28 },
    explanation: { max: 42, min: 26 },
  },
  'feed-1x1': {
    question: { max: 46, min: 30, minHard: 22, maxLines: 3 },
    option: { max: 40, min: 28, minWrap: 20 },
    answer: { max: 72, min: 24 },
    explanation: { max: 38, min: 24 },
  },
};

let cachedResources = null;

function loadCachedResources() {
  if (cachedResources) return cachedResources;

  // 1. Offline @font-face CSS from local .woff2 files
  const fontFaceBlocks = [];
  for (const entry of FONT_MANIFEST) {
    const fontPath = path.join(FONTS_DIR, entry.file);
    if (!fs.existsSync(fontPath)) {
      throw new Error(
        `Missing offline font "${fontPath}". Run "node quiz-renderer/scripts/download-fonts.js" first.`
      );
    }
    const b64 = fs.readFileSync(fontPath).toString('base64');
    const unicodeRange = UNICODE_RANGES[entry.subset] || UNICODE_RANGES.latin;
    fontFaceBlocks.push(
      `@font-face {\n` +
        `  font-family: '${entry.family}';\n` +
        `  font-style: normal;\n` +
        `  font-display: block;\n` +
        `  font-weight: ${entry.weight};\n` +
        `  src: url('data:font/woff2;base64,${b64}') format('woff2');\n` +
        `  unicode-range: ${unicodeRange};\n` +
        `}`
    );
  }
  const fontCss = fontFaceBlocks.join('\n');

  // 2. Static PNG assets as base64 data URIs
  const assetFiles = {
    bgGlobeBlue: 'bg-globe-blue.png',
    logoExamiq: 'logo-examiq.png',
    bannerGkQuiz: 'banner-gk-quiz.png',
    badgeCorrectAnswer: 'badge-correct-answer.png',
    iconBulb: 'icon-bulb.png',
    btnSubscribe: 'btn-subscribe.png',
    btnInstagram: 'btn-instagram.png',
    footerBar: 'footer-bar.png',
  };

  const assets = {};
  for (const [key, filename] of Object.entries(assetFiles)) {
    const assetPath = path.join(ASSETS_DIR, filename);
    if (!fs.existsSync(assetPath)) {
      throw new Error(
        `Missing static asset "${assetPath}". Run "node quiz-renderer/scripts/build-assets.js" first.`
      );
    }
    assets[key] = `data:image/png;base64,${fs.readFileSync(assetPath).toString('base64')}`;
  }

  // 3. Templates + base.css + fit-text.js
  const baseCss = fs.readFileSync(path.join(TEMPLATES_DIR, 'base.css'), 'utf8');
  const questionTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'quiz-question.html'), 'utf8');
  const answerTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'quiz-answer.html'), 'utf8');
  const fitTextScript = fs.readFileSync(FIT_TEXT_PATH, 'utf8');

  cachedResources = {
    fontCss,
    assets,
    baseCss,
    questionTemplate,
    answerTemplate,
    fitTextScript,
  };
  return cachedResources;
}

function resolveBackgroundDataUri(backgroundDataUri, fallbackDataUri) {
  if (!backgroundDataUri) return fallbackDataUri;
  const raw = String(backgroundDataUri).trim();
  if (!raw) return fallbackDataUri;
  if (raw.startsWith('data:')) return raw;

  let localPath = raw;
  if (raw.startsWith('file://')) {
    try {
      localPath = require('url').fileURLToPath(raw);
    } catch {
      localPath = raw.replace(/^file:\/\/\/?/, '');
    }
  }
  if (fs.existsSync(localPath)) {
    const ext = path.extname(localPath).toLowerCase();
    const mime =
      ext === '.jpg' || ext === '.jpeg'
        ? 'image/jpeg'
        : ext === '.webp'
          ? 'image/webp'
          : 'image/png';
    return `data:${mime};base64,${fs.readFileSync(localPath).toString('base64')}`;
  }
  throw new Error(`quiz-renderer: backgroundDataUri is neither a data: URI nor an existing local file: ${raw}`);
}

function applyTemplateTokens(template, replacements) {
  let out = template;
  for (const [token, value] of Object.entries(replacements)) {
    out = out.split(token).join(value);
  }
  return out;
}

function buildPartBadgeHtml(part) {
  if (part === null || part === undefined || part === '') {
    return '';
  }
  return `
    <div class="part-badge" aria-label="Part ${escapeHtml(String(part))}">
      <svg class="part-brush-svg" viewBox="0 0 180 170" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="partShadow" x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#000B24" flood-opacity="0.55"/>
          </filter>
        </defs>
        <path filter="url(#partShadow)" fill="#D91215" d="
          M 34,26 C 58,10 105,8 142,20 C 166,28 174,56 170,92
          C 166,126 146,154 108,160 C 68,166 28,150 16,118
          C 6,90 12,42 34,26 Z
        "/>
        <path fill="#EC1B1E" opacity="0.88" d="
          M 22,48 C 52,22 118,16 154,36 C 170,46 168,118 144,142
          C 114,164 46,156 24,126 C 10,104 10,64 22,48 Z
        "/>
      </svg>
      <div class="part-badge-text">
        <span class="part-label">Part</span>
        <span class="part-val">${escapeHtml(String(part))}</span>
      </div>
    </div>
  `;
}

function buildOptionsHtml(options, fitBounds) {
  return options
    .map((opt, idx) => {
      const letter = LETTERS[idx];
      return `
        <div class="option-pill">
          <div class="option-circle">
            <span class="option-letter">${letter}</span>
          </div>
          <div class="option-text"
               data-fit="option"
               data-fit-max="${fitBounds.option.max}"
               data-fit-min="${fitBounds.option.min}"
               data-fit-min-wrap="${fitBounds.option.minWrap}">${formatHighlightHtml(opt)}</div>
        </div>
      `;
    })
    .join('\n');
}

function buildSlideHtml(kind, item, profile, options = {}) {
  const res = loadCachedResources();
  const fitBounds = PROFILE_FIT_BOUNDS[profile.name] || PROFILE_FIT_BOUNDS['shorts-9x16'];
  const bgDataUri = resolveBackgroundDataUri(options.backgroundDataUri, res.assets.bgGlobeBlue);
  const showCta = profile.showCtaButtons ? 'true' : 'false';
  const stageInlineStyle =
    profile.scale !== 1 || profile.offsetY !== 0
      ? `--scale: ${profile.scale}; --offset-y: ${profile.offsetY}px;`
      : '';

  const subjectSubHtml = item.subjectSub
    ? `<span class="topic-sub">${escapeHtml(item.subjectSub)}</span>`
    : '';
  const hasTopicClass = item.part ? 'has-part' : 'no-part';

  const commonReplacements = {
    '{{FONT_CSS}}': res.fontCss,
    '{{BASE_CSS}}': res.baseCss,
    '{{FIT_TEXT_JS}}': res.fitTextScript,
    '{{PROFILE}}': escapeHtml(profile.name),
    '{{SHOW_CTA}}': showCta,
    '{{STAGE_STYLE}}': stageInlineStyle,
    '{{TOPIC_PART_CLASS}}': hasTopicClass,
    '{{ASSET_BG_GLOBE_BLUE}}': bgDataUri,
    '{{ASSET_LOGO_EXAMIQ}}': res.assets.logoExamiq,
    '{{ASSET_BTN_SUBSCRIBE}}': res.assets.btnSubscribe,
    '{{ASSET_BTN_INSTAGRAM}}': res.assets.btnInstagram,
    '{{ASSET_FOOTER_BAR}}': res.assets.footerBar,
    '{{SUBJECT}}': escapeHtml(item.subject),
    '{{SUBJECT_SUB_HTML}}': subjectSubHtml,
    '{{PART_BADGE_HTML}}': buildPartBadgeHtml(item.part),
  };

  if (kind === 'question') {
    return applyTemplateTokens(res.questionTemplate, {
      ...commonReplacements,
      '{{ASSET_BANNER_GK_QUIZ}}': res.assets.bannerGkQuiz,
      '{{Q_NO}}': escapeHtml(String(item.qNo)),
      '{{QUESTION_HTML}}': formatHighlightHtml(item.question),
      '{{OPTIONS_HTML}}': buildOptionsHtml(item.options, fitBounds),
      '{{FIT_Q_MAX}}': String(fitBounds.question.max),
      '{{FIT_Q_MIN}}': String(fitBounds.question.min),
      '{{FIT_Q_MIN_HARD}}': String(fitBounds.question.minHard),
      '{{FIT_Q_MAX_LINES}}': String(fitBounds.question.maxLines),
    });
  }

  const answerLetter = LETTERS[item.answerIndex];
  const answerText = `${answerLetter}. ${item.options[item.answerIndex]}`;

  return applyTemplateTokens(res.answerTemplate, {
    ...commonReplacements,
    '{{ASSET_BADGE_CORRECT_ANSWER}}': res.assets.badgeCorrectAnswer,
    '{{ASSET_ICON_BULB}}': res.assets.iconBulb,
    '{{ANSWER_VALUE_HTML}}': formatHighlightHtml(answerText),
    '{{EXPLANATION_HTML}}': formatHighlightHtml(item.explanation || ''),
    '{{FIT_ANS_MAX}}': String(fitBounds.answer.max),
    '{{FIT_ANS_MIN}}': String(fitBounds.answer.min),
    '{{FIT_EXPL_MAX}}': String(fitBounds.explanation.max),
    '{{FIT_EXPL_MIN}}': String(fitBounds.explanation.min),
  });
}

async function launchQuizBrowser(options = {}) {
  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    ...(Array.isArray(options.args) ? options.args : []),
  ];

  const candidates = [];
  const envExe = options.executablePath || process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  if (envExe) {
    candidates.push({ headless: true, executablePath: envExe, args: launchArgs });
  }
  candidates.push({ headless: true, args: launchArgs });
  candidates.push({ headless: true, channel: 'chrome', args: launchArgs });
  candidates.push({ headless: true, channel: 'msedge', args: launchArgs });

  const errors = [];
  for (const cfg of candidates) {
    try {
      return await chromium.launch(cfg);
    } catch (err) {
      errors.push(`${cfg.executablePath || cfg.channel || 'bundled'}: ${err.message}`);
    }
  }
  throw new Error(`launchQuizBrowser failed across all Chromium candidates:\n${errors.join('\n')}`);
}

async function fitAndWaitPage(page) {
  return page.evaluate(async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const imgPromises = Array.from(document.images || []).map((img) => {
      if (img.complete) {
        return typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve();
      }
      return new Promise((resolve) => {
        const done = () => {
          if (typeof img.decode === 'function') {
            img.decode().catch(() => {}).then(resolve);
          } else {
            resolve();
          }
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', resolve, { once: true });
      });
    });
    await Promise.all(imgPromises);

    for (const selector of ['.topic-main', '.topic-sub']) {
      const topicEl = document.querySelector(selector);
      if (topicEl) {
        topicEl.style.fontSize = '';
        let fs = parseFloat(window.getComputedStyle(topicEl).fontSize) || 76;
        while (topicEl.scrollWidth > topicEl.clientWidth + 1 && fs > 22) {
          fs -= 2;
          topicEl.style.fontSize = fs + 'px';
        }
      }
    }

    if (window.QuizFitText && typeof window.QuizFitText.fitQuizElements === 'function') {
      return window.QuizFitText.fitQuizElements(document);
    }
    return { warnings: [], fitted: [] };
  });
}

async function captureSlidePng(page, cdpSession, profile) {
  const clip = { x: 0, y: 0, width: profile.width, height: profile.height };
  if (cdpSession) {
    try {
      const res = await cdpSession.send('Page.captureScreenshot', {
        format: 'png',
        optimizeForSpeed: true,
        clip: { ...clip, scale: 1 },
      });
      if (res && res.data) {
        return Buffer.from(res.data, 'base64');
      }
    } catch {
      // Fallback to standard Playwright screenshot
    }
  }
  return page.screenshot({
    type: 'png',
    clip,
  });
}

async function renderSingleSlideOnPage(page, html, profile, cdpSession = null) {
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const fitResult = await fitAndWaitPage(page);

  const png = await captureSlidePng(page, cdpSession, profile);

  return {
    png,
    warnings: Array.isArray(fitResult?.warnings) ? fitResult.warnings : [],
  };
}

function buildUnifiedShellHtml(item, profile, options = {}) {
  const res = loadCachedResources();
  const fitBounds = PROFILE_FIT_BOUNDS[profile.name] || PROFILE_FIT_BOUNDS['shorts-9x16'];
  const bgDataUri = resolveBackgroundDataUri(options.backgroundDataUri, res.assets.bgGlobeBlue);
  const showCta = profile.showCtaButtons ? 'true' : 'false';
  const stageInlineStyle =
    profile.scale !== 1 || profile.offsetY !== 0
      ? `--scale: ${profile.scale}; --offset-y: ${profile.offsetY}px;`
      : '';
  const answerLetter = LETTERS[item.answerIndex];
  const answerText = `${answerLetter}. ${item.options[item.answerIndex]}`;

  return `<!DOCTYPE html>
<html lang="hi" data-profile="${escapeHtml(profile.name)}" data-show-cta="${showCta}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
${res.fontCss}
${res.baseCss}
[data-slide-kind="question"] .mode-answer { display: none; }
[data-slide-kind="answer"] .mode-question { display: none; }
  </style>
</head>
<body data-slide-kind="question">
  <div class="canvas">
    <img class="bg-layer" src="${bgDataUri}" alt="" />
    <div class="stage" style="${stageInlineStyle}">
      <img class="logo-img" src="${res.assets.logoExamiq}" alt="ExamIQ Bharat" />
      <div class="logo-tagline">सही तैयारी<br>सफलता की गारंटी</div>

      <div class="topic-brush ${item.part ? 'has-part' : 'no-part'}">
        <svg class="topic-brush-svg" viewBox="0 0 600 220" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="yellowBrushGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#FFE424"/>
              <stop offset="60%" stop-color="#FAD405"/>
              <stop offset="100%" stop-color="#F0C000"/>
            </linearGradient>
            <filter id="brushShadow" x="-10%" y="-15%" width="120%" height="135%">
              <feDropShadow dx="0" dy="6" stdDeviation="5" flood-color="#000B24" flood-opacity="0.5"/>
            </filter>
          </defs>
          <path filter="url(#brushShadow)" fill="url(#yellowBrushGrad)" d="
            M 56,28 L 190,20 L 360,16 L 542,22
            L 568,36 L 548,46 L 584,62 L 560,78
            L 590,98 L 562,118 L 586,140 L 552,158
            L 570,180 L 520,192 L 320,198 L 88,196
            L 40,182 L 62,164 L 22,148 L 48,128
            L 14,108 L 46,88 L 18,68 L 54,50 Z
          "/>
        </svg>
        <div class="topic-text">
          <span class="topic-main">${escapeHtml(item.subject)}</span>
          <span class="topic-sub" style="${item.subjectSub ? '' : 'display: none;'}">${escapeHtml(item.subjectSub || '')}</span>
        </div>
      </div>

      <div id="part-slot">${buildPartBadgeHtml(item.part)}</div>

      <div class="mode-question">
        <img class="gk-banner" src="${res.assets.bannerGkQuiz}" alt="GK Quiz" />
        <div class="q-pill">Q.${escapeHtml(String(item.qNo))}</div>
        <div class="q-card">
          <div class="q-text"
               data-fit="question"
               data-fit-max="${fitBounds.question.max}"
               data-fit-min="${fitBounds.question.min}"
               data-fit-min-hard="${fitBounds.question.minHard}"
               data-fit-max-lines="${fitBounds.question.maxLines}">${formatHighlightHtml(item.question)}</div>
        </div>
        <div class="options-list">
          ${buildOptionsHtml(item.options, fitBounds)}
        </div>
      </div>

      <div class="mode-answer">
        <img class="correct-banner" src="${res.assets.badgeCorrectAnswer}" alt="Correct Answer" />
        <div class="ans-pill">Answer:</div>
        <div class="ans-box">
          <svg class="ans-burst ans-burst-left" viewBox="0 0 90 76" aria-hidden="true">
            <path d="M 46,24 L 30,6" stroke="#FAD606" stroke-width="7" stroke-linecap="round"/>
            <path d="M 32,42 L 8,30" stroke="#FAD606" stroke-width="7" stroke-linecap="round"/>
            <path d="M 34,62 L 10,60" stroke="#FAD606" stroke-width="7" stroke-linecap="round"/>
          </svg>
          <svg class="ans-burst ans-burst-right" viewBox="0 0 90 76" aria-hidden="true">
            <path d="M 46,24 L 30,6" stroke="#FAD606" stroke-width="7" stroke-linecap="round"/>
            <path d="M 32,42 L 8,30" stroke="#FAD606" stroke-width="7" stroke-linecap="round"/>
            <path d="M 34,62 L 10,60" stroke="#FAD606" stroke-width="7" stroke-linecap="round"/>
          </svg>
          <div class="ans-value"
               data-fit="answer"
               data-fit-max="${fitBounds.answer.max}"
               data-fit-min="${fitBounds.answer.min}">${formatHighlightHtml(answerText)}</div>
        </div>
        <div class="expl-pill">
          <img class="expl-bulb" src="${res.assets.iconBulb}" alt="" />
          <span class="expl-pill-label">Explanation:</span>
        </div>
        <div class="expl-card">
          <div class="expl-text"
               data-fit="explanation"
               data-fit-max="${fitBounds.explanation.max}"
               data-fit-min="${fitBounds.explanation.min}">${formatHighlightHtml(item.explanation || '')}</div>
        </div>
      </div>

      <div class="cta-row">
        <img class="cta-subscribe" src="${res.assets.btnSubscribe}" alt="Subscribe" />
        <div class="cta-divider"></div>
        <img class="cta-instagram" src="${res.assets.btnInstagram}" alt="Follow On Instagram" />
      </div>

      <img class="footer-bar" src="${res.assets.footerBar}" alt="ExamIQ Bharat" />
    </div>
  </div>
  <script>
${res.fitTextScript}
  </script>
</body>
</html>`;
}

async function renderPairOnSharedShell(page, item, profile, options, shellInitialized, cdpSession = null) {
  const fitBounds = PROFILE_FIT_BOUNDS[profile.name] || PROFILE_FIT_BOUNDS['shorts-9x16'];
  if (!shellInitialized) {
    const shellHtml = buildUnifiedShellHtml(item, profile, options);
    await page.setContent(shellHtml, { waitUntil: 'domcontentloaded' });
  }

  const answerLetter = LETTERS[item.answerIndex];
  const answerText = `${answerLetter}. ${item.options[item.answerIndex]}`;

  const qFit = await page.evaluate(
    async ({ subject, subjectSub, partHtml, hasPart, qNo, questionHtml, optionsHtmls, answerHtml, explHtml, isFirst }) => {
      if (isFirst) {
        if (document.fonts && document.fonts.ready) await document.fonts.ready;
        await Promise.all(
          Array.from(document.images || []).map((img) =>
            img.complete
              ? typeof img.decode === 'function'
                ? img.decode().catch(() => {})
                : Promise.resolve()
              : new Promise((resolve) => {
                  img.addEventListener('load', resolve, { once: true });
                  img.addEventListener('error', resolve, { once: true });
                })
          )
        );
      } else {
        const topicBrush = document.querySelector('.topic-brush');
        if (topicBrush) {
          topicBrush.classList.toggle('has-part', hasPart);
          topicBrush.classList.toggle('no-part', !hasPart);
        }
        const topicMainEl = document.querySelector('.topic-main');
        if (topicMainEl) topicMainEl.textContent = subject;
        const topicSubEl = document.querySelector('.topic-sub');
        if (topicSubEl) {
          topicSubEl.textContent = subjectSub;
          topicSubEl.style.display = subjectSub ? '' : 'none';
        }
        const partSlot = document.getElementById('part-slot');
        if (partSlot) partSlot.innerHTML = partHtml;
        const qPill = document.querySelector('.q-pill');
        if (qPill) qPill.textContent = `Q.${qNo}`;
        const qText = document.querySelector('.q-text');
        if (qText) {
          qText.style.fontSize = '';
          qText.innerHTML = questionHtml;
        }
        const optEls = document.querySelectorAll('.option-text');
        optEls.forEach((el, idx) => {
          el.style.fontSize = '';
          el.style.whiteSpace = '';
          el.style.lineHeight = '';
          el.innerHTML = optionsHtmls[idx] || '';
        });
        const ansVal = document.querySelector('.ans-value');
        if (ansVal) {
          ansVal.style.fontSize = '';
          ansVal.innerHTML = answerHtml;
        }
        const explText = document.querySelector('.expl-text');
        if (explText) {
          explText.style.fontSize = '';
          explText.innerHTML = explHtml;
        }
      }

      document.body.setAttribute('data-slide-kind', 'question');
      for (const selector of ['.topic-main', '.topic-sub']) {
        const topicEl = document.querySelector(selector);
        if (topicEl) {
          topicEl.style.fontSize = '';
          let fs = parseFloat(window.getComputedStyle(topicEl).fontSize) || 76;
          while (topicEl.scrollWidth > topicEl.clientWidth + 1 && fs > 22) {
            fs -= 2;
            topicEl.style.fontSize = fs + 'px';
          }
        }
      }
      return window.QuizFitText.fitQuizElements(document);
    },
    {
      subject: item.subject,
      subjectSub: item.subjectSub || '',
      partHtml: buildPartBadgeHtml(item.part),
      hasPart: Boolean(item.part),
      qNo: String(item.qNo),
      questionHtml: formatHighlightHtml(item.question),
      optionsHtmls: item.options.map((o) => formatHighlightHtml(o)),
      answerHtml: formatHighlightHtml(answerText),
      explHtml: formatHighlightHtml(item.explanation || ''),
      isFirst: !shellInitialized,
    }
  );

  const questionPng = await captureSlidePng(page, cdpSession, profile);

  const aFit = await page.evaluate(() => {
    document.body.setAttribute('data-slide-kind', 'answer');
    return window.QuizFitText.fitQuizElements(document);
  });

  const answerPng = await captureSlidePng(page, cdpSession, profile);

  return {
    questionPng,
    answerPng,
    warnings: [...(qFit?.warnings || []), ...(aFit?.warnings || [])],
    fitBounds,
  };
}

async function renderQuizSlides(quizItem, options = {}) {
  const item = normalizeQuizItem(quizItem, options.context);
  const profile = resolveProfile(options.profile, options);

  const qHtml = buildSlideHtml('question', item, profile, options);
  const aHtml = buildSlideHtml('answer', item, profile, options);

  let ownedBrowser = null;
  let ownedContext = null;
  let page = options.page || null;

  try {
    if (!page) {
      if (options.browserContext) {
        page = await options.browserContext.newPage();
        await page.setViewportSize({ width: profile.width, height: profile.height });
      } else {
        const browser = options.browser || (ownedBrowser = await launchQuizBrowser(options));
        ownedContext = await browser.newContext({
          viewport: { width: profile.width, height: profile.height },
          deviceScaleFactor: 1,
        });
        page = await ownedContext.newPage();
      }
    } else {
      const vp = page.viewportSize();
      if (!vp || vp.width !== profile.width || vp.height !== profile.height) {
        await page.setViewportSize({ width: profile.width, height: profile.height });
      }
    }

    const qRes = await renderSingleSlideOnPage(page, qHtml, profile);
    const aRes = await renderSingleSlideOnPage(page, aHtml, profile);

    const warnings = [...qRes.warnings, ...aRes.warnings];
    for (const w of warnings) {
      console.warn(`[quiz-renderer] ${w}`);
    }

    if (options.questionOutPath) {
      fs.mkdirSync(path.dirname(options.questionOutPath), { recursive: true });
      fs.writeFileSync(options.questionOutPath, qRes.png);
    }
    if (options.answerOutPath) {
      fs.mkdirSync(path.dirname(options.answerOutPath), { recursive: true });
      fs.writeFileSync(options.answerOutPath, aRes.png);
    }

    return {
      questionPng: qRes.png,
      answerPng: aRes.png,
      item,
      warnings,
      profile,
    };
  } finally {
    if (!options.page) {
      if (options.browserContext && page) {
        await page.close().catch(() => {});
      }
      if (ownedContext) {
        await ownedContext.close().catch(() => {});
      }
      if (ownedBrowser) {
        await ownedBrowser.close().catch(() => {});
      }
    }
  }
}

async function renderQuizBatch(quizItems, options = {}) {
  if (!Array.isArray(quizItems)) {
    throw new TypeError('renderQuizBatch: quizItems must be an array');
  }
  if (quizItems.length === 0) {
    return [];
  }

  const baseProfile = resolveProfile(options.profile, options);
  const ownedBrowser = options.browser ? null : await launchQuizBrowser(options);
  const browser = options.browser || ownedBrowser;
  let context = null;
  let page = null;
  let cdpSession = null;

  try {
    context = await browser.newContext({
      viewport: { width: baseProfile.width, height: baseProfile.height },
      deviceScaleFactor: 1,
    });
    page = await context.newPage();
    if (typeof context.newCDPSession === 'function') {
      cdpSession = await context.newCDPSession(page).catch(() => null);
    }

    const results = new Array(quizItems.length);
    let shellInitialized = false;

    for (let i = 0; i < quizItems.length; i++) {
      const rawItem = quizItems[i];
      const item = normalizeQuizItem(rawItem, {
        index: i,
        ...(options.context || {}),
      });
      const profile = resolveProfile(options.profile, options);
      const rendered = await renderPairOnSharedShell(
        page,
        item,
        profile,
        options,
        shellInitialized,
        cdpSession
      );
      shellInitialized = true;

      for (const w of rendered.warnings) {
        console.warn(`[quiz-renderer] ${w}`);
      }

      const qOut =
        typeof options.questionOutPath === 'function'
          ? options.questionOutPath(i, rawItem)
          : undefined;
      const aOut =
        typeof options.answerOutPath === 'function'
          ? options.answerOutPath(i, rawItem)
          : undefined;
      if (qOut) {
        fs.mkdirSync(path.dirname(qOut), { recursive: true });
        fs.writeFileSync(qOut, rendered.questionPng);
      }
      if (aOut) {
        fs.mkdirSync(path.dirname(aOut), { recursive: true });
        fs.writeFileSync(aOut, rendered.answerPng);
      }

      results[i] = {
        questionPng: rendered.questionPng,
        answerPng: rendered.answerPng,
        item,
        warnings: rendered.warnings,
        profile,
      };
    }

    return results;
  } finally {
    if (cdpSession) await cdpSession.detach().catch(() => {});
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (ownedBrowser) await ownedBrowser.close().catch(() => {});
  }
}

module.exports = {
  PROFILES,
  resolveProfile,
  normalizeQuizItem,
  launchQuizBrowser,
  renderQuizSlides,
  renderQuizBatch,
  buildSlideHtml,
};
