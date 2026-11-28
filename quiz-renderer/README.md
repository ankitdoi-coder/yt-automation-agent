# `quiz-renderer/`

Unified HTML + Playwright Chromium quiz slide renderer for ExamIQ Bharat (YouTube Shorts, Instagram Reels, Facebook Reels, and FB/IG feed photo posts).

## Usage

```js
const {
  renderQuizSlides,
  renderQuizBatch,
  launchQuizBrowser,
  normalizeQuizItem,
  PROFILES,
} = require('./quiz-renderer');

const { questionPng, answerPng, item, warnings, profile } = await renderQuizSlides(
  {
    subject: 'Bhugol',
    subjectSub: '(Geography)',
    part: '1/2',
    qNo: 1,
    question: 'विश्व का **सबसे बड़ा** महाद्वीप कौन सा है?',
    options: ['अफ्रीका', 'एशिया', 'उत्तरी अमेरिका', 'अंटार्कटिका'],
    answerIndex: 1,
    explanation: 'एशिया पृथ्वी का **सबसे बड़ा** महाद्वीप है।',
  },
  { profile: 'shorts-9x16' }
);
```

For multi-question batches, use `renderQuizBatch(items, options)` or pass a shared `options.browser` from `launchQuizBrowser()` to reuse one Chromium instance.

## Pipeline Integration

`build-quiz-pipeline.js`, `facebook/video-maker.js` (single and multi-question Reels), and `facebook/ai-quiz-image-generator.js` use this renderer by default. Set `QUIZ_TEMPLATE=legacy` to select the prior HTML/SVG renderers. Shorts use the same template with CTA buttons hidden; Reels show them. Feed posts use `feed-1x1`; set `QUIZ_USE_AI_BACKGROUND=true` to opt into an AI background for feed posts.

## Swapping Static Assets

All 8 static PNG layers live in `quiz-renderer/assets/` and are embedded as base64 `data:image/png;base64,...` URIs at render time (zero network requests):

- `bg-globe-blue.png` (`1080x1920`)
- `logo-examiq.png` (`320x320`)
- `banner-gk-quiz.png` (`780x230`)
- `badge-correct-answer.png` (`960x240`)
- `icon-bulb.png` (`120x126`)
- `btn-subscribe.png` (`500x145`)
- `btn-instagram.png` (`454x136`)
- `footer-bar.png` (`1080x210`)

To swap any asset, replace the PNG in `quiz-renderer/assets/` keeping transparent RGBA edges where applicable (and matching target aspect ratio), or edit and re-run:

```bash
node quiz-renderer/scripts/build-assets.js
```

To rebuild offline `.woff2` fonts in `quiz-renderer/fonts/`:

```bash
node quiz-renderer/scripts/download-fonts.js
```

## Tuning CSS Coordinates

All measured `1080x1920` coordinates, colors, card borders, and typography sizes are centralized as CSS custom properties in `quiz-renderer/templates/base.css` under `:root`. Both `templates/quiz-question.html` and `templates/quiz-answer.html` share identical header (`--logo-*`, `--topic-*`, `--part-*`), CTA (`--cta-*`, `--sub-*`, `--ig-*`), and footer (`--footer-*`) variables so video cross-cuts stay locked in position.

Run the visual parity check after any layout change:

```bash
node quiz-renderer/tests/visual-diff.js
```

## Adding a New Output Profile

1. Add a new profile entry to `PROFILES` in `quiz-renderer/profiles.js` with `name`, `width`, `height`, `aspectRatio`, `scale`, `offsetY`, and `showCtaButtons`.
2. Add a matching `[data-profile="your-profile"]` CSS custom-property override block in `quiz-renderer/templates/base.css` (and `PROFILE_FIT_BOUNDS` in `quiz-renderer/index.js` if different font fit bounds are needed).

## Assets Requiring Manual Higher-Resolution Export

The following assets in `quiz-renderer/assets/` were cleaned/upscaled from low-resolution JPEG/PNG source crops and should be replaced with original designer exports if native 1080p vector/high-DPI sources become available:

- `badge-correct-answer.png` — source `media_1795690048047_34fb3bfc.png` was `185x46` (`5.19x` smaller than `960x240`, so current asset is a clean SVG rasterization matching the original).
- `bg-globe-blue.png` — upscaled `1.89x` from `571x1024` (`media_1795689582073_1cdee3db.jpg`).
- `btn-subscribe.png` — upscaled `1.50x` from `333x97` crop in `media_1795689950184_fc326deb.jpg`.
- `btn-instagram.png` — upscaled `1.61x` from `281x102` crop in `media_1795689950184_fc326deb.jpg`.
- `footer-bar.png` — yellow brush upscaled `1.59x` from `590x82` crop in `media_1795689950184_fc326deb.jpg`.
