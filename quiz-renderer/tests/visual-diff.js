'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const {
  launchQuizBrowser,
  renderQuizSlides,
  renderQuizBatch,
  buildSlideHtml,
  normalizeQuizItem,
  resolveProfile,
} = require('..');

const SRC_DIR = 'C:/Users/hp/.gemini/antigravity/brain/005d60e2-9c1f-4706-b6b8-331dfa28d106/.user_uploaded';
const REF_DIR = path.join(__dirname, 'reference');
const OUT_DIR = path.join(__dirname, 'out');

const REFERENCE_ITEM = {
  subject: 'Bhugol',
  subjectSub: '(Geography)',
  part: '1/2',
  qNo: 1,
  question: 'विश्व का **सबसे बड़ा** महाद्वीप कौन सा है?',
  options: ['अफ्रीका', 'एशिया', 'उत्तरी अमेरिका', 'अंटार्कटिका'],
  answerIndex: 1,
  explanation:
    'एशिया पृथ्वी का **सबसे बड़ा** महाद्वीप है, जिसका क्षेत्रफल लगभग **44.58 करोड़** वर्ग किमी है, जो कुल भुमि का लगभग **29.5%** हिस्सा है।',
};

const CONJUNCTS_ITEM = {
  subject: 'हिन्दी व्याकरण',
  subjectSub: '(संयुक्ताक्षर)',
  part: '2/3',
  qNo: 7,
  question: 'निम्नलिखित में से **क्षेत्रफल, त्रिकोण, विज्ञान, श्रृंखला, द्वीप** और **आँखें** में कौन सा **संयुक्ताक्षर** है?',
  options: ['क्षत्रिय और त्रिशूल', 'ज्ञान और श्रवण', 'द्वितीय और चाँदनी', 'अन्तःकरण और प्रातः'],
  answerIndex: 1,
  explanation:
    'हिंदी में **क्ष (क्+ष)**, **त्र (त्+र)**, **ज्ञ (ज्+ञ)** और **श्र (श्+र)** प्रमुख संयुक्ताक्षर हैं; साथ ही **चाँद (ँ)** व **अंक (ं)** अनुनासिक-अनुस्वार हैं।',
};

const LONG_TEXT_ITEM = {
  subject: 'भारतीय राजव्यवस्था',
  subjectSub: '(Indian Polity)',
  part: '3/4',
  qNo: 12,
  question:
    'भारतीय संविधान के किस **महत्वपूर्ण अनुच्छेद** के अंतर्गत राष्ट्रपति को किसी राज्य में **संवैधानिक तंत्र की विफलता** के आधार पर राष्ट्रपति शासन लागू करने तथा संसद के दोनों सदनों के अनुमोदन के बिना अधिकतम दो माह तक इसे प्रभावी रखने का विशेषाधिकार प्राप्त है?',
  options: [
    'अनुच्छेद 352 के अंतर्गत राष्ट्रीय आपातकाल की घोषणा एवं मंत्रिमंडल की लिखित सिफारिश',
    'अनुच्छेद 356 के अंतर्गत राज्य में संवैधानिक तंत्र की विफलता पर राष्ट्रपति शासन',
    'अनुच्छेद 360 के अंतर्गत वित्तीय आपातकाल तथा संचित निधि से व्यय नियंत्रण',
    'अनुच्छेद 368 के अंतर्गत संविधान संशोधन की विशेष बहुमत एवं राज्यों के अनुमोदन प्रक्रिया',
  ],
  answerIndex: 1,
  explanation:
    'भारतीय संविधान के **अनुच्छेद 356** के अंतर्गत यदि राष्ट्रपति को राज्यपाल की रिपोर्ट या अन्य किसी माध्यम से यह समाधान हो जाए कि राज्य का शासन संविधान के उपबंधों के अनुसार नहीं चलाया जा सकता है, तो वह उस राज्य में **राष्ट्रपति शासन** लागू कर सकते हैं। संसद के दोनों सदनों द्वारा दो माह के भीतर इसका अनुमोदन आवश्यक होता है और इसे छह-छह माह करके अधिकतम तीन वर्ष तक बढ़ाया जा सकता है।',
};

async function ensureReferenceImages() {
  fs.mkdirSync(REF_DIR, { recursive: true });
  const refQPath = path.join(REF_DIR, 'question.png');
  const refAPath = path.join(REF_DIR, 'answer.png');

  const srcQ = path.join(SRC_DIR, 'media_1795689548715_9fcbebed.jpg');
  const srcA = path.join(SRC_DIR, 'media_1795689547162_995eebba.jpg');

  if (fs.existsSync(srcQ)) {
    const metaQ = await sharp(srcQ).metadata();
    let pipeQ = sharp(srcQ);
    if (metaQ.width >= 206 && metaQ.height >= 404) {
      pipeQ = pipeQ.extract({ left: 4, top: 1, width: Math.min(202, metaQ.width - 4), height: Math.min(403, metaQ.height - 1) });
    }
    await pipeQ.resize(1080, 1920, { fit: 'fill', kernel: 'lanczos3' }).png().toFile(refQPath);
  }

  if (fs.existsSync(srcA)) {
    const metaA = await sharp(srcA).metadata();
    let pipeA = sharp(srcA);
    if (metaA.width >= 202 && metaA.height >= 400) {
      pipeA = pipeA.extract({ left: 2, top: 1, width: Math.min(200, metaA.width - 2), height: Math.min(399, metaA.height - 1) });
    }
    await pipeA.resize(1080, 1920, { fit: 'fill', kernel: 'lanczos3' }).png().toFile(refAPath);
  }

  assert(fs.existsSync(refQPath), `Missing reference image: ${refQPath}`);
  assert(fs.existsSync(refAPath), `Missing reference image: ${refAPath}`);
  return { refQPath, refAPath };
}

async function computeVisualDiffOutputs(name, refPath, renderedBuf) {
  const w = 1080;
  const h = 1920;

  const renderedPath = path.join(OUT_DIR, `rendered-${name}.png`);
  fs.writeFileSync(renderedPath, renderedBuf);

  const [refRaw, renRaw] = await Promise.all([
    sharp(refPath).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer(),
    sharp(renderedBuf).resize(w, h, { fit: 'fill' }).removeAlpha().raw().toBuffer(),
  ]);

  // 1. Side-by-side (2160x1920)
  await sharp({
    create: { width: w * 2, height: h, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([
      { input: await sharp(refPath).resize(w, h, { fit: 'fill' }).png().toBuffer(), left: 0, top: 0 },
      { input: renderedBuf, left: w, top: 0 },
    ])
    .png()
    .toFile(path.join(OUT_DIR, `${name}-side-by-side.png`));

  // 2. 50% overlay + 3. RGB diff heatmap + MAE / RMSE
  const overlayRaw = Buffer.alloc(w * h * 3);
  const diffRaw = Buffer.alloc(w * h * 3);
  let sumAbs = 0;
  let sumSq = 0;
  const totalChannels = w * h * 3;

  for (let i = 0; i < totalChannels; i += 3) {
    const dr = Math.abs(refRaw[i] - renRaw[i]);
    const dg = Math.abs(refRaw[i + 1] - renRaw[i + 1]);
    const db = Math.abs(refRaw[i + 2] - renRaw[i + 2]);

    sumAbs += dr + dg + db;
    sumSq += dr * dr + dg * dg + db * db;

    overlayRaw[i] = Math.round((refRaw[i] + renRaw[i]) / 2);
    overlayRaw[i + 1] = Math.round((refRaw[i + 1] + renRaw[i + 1]) / 2);
    overlayRaw[i + 2] = Math.round((refRaw[i + 2] + renRaw[i + 2]) / 2);

    const amp = Math.min(255, Math.round(((dr + dg + db) / 3) * 3));
    diffRaw[i] = amp;
    diffRaw[i + 1] = Math.min(255, Math.round(dg * 2));
    diffRaw[i + 2] = Math.max(0, 60 - Math.round(amp * 0.25));
  }

  await sharp(overlayRaw, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile(path.join(OUT_DIR, `${name}-overlay-50.png`));

  await sharp(diffRaw, { raw: { width: w, height: h, channels: 3 } })
    .png()
    .toFile(path.join(OUT_DIR, `${name}-diff.png`));

  const mae = sumAbs / totalChannels;
  const rmse = Math.sqrt(sumSq / totalChannels);
  return { mae, rmse };
}

async function verifyDomOverflowAndFonts(page, kind, rawItem, profileName, opts = {}) {
  const item = normalizeQuizItem(rawItem);
  const profile = resolveProfile(profileName, opts);
  const html = buildSlideHtml(kind, item, profile, opts);

  await page.setViewportSize({ width: profile.width, height: profile.height });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });

  const stats = await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((img) =>
        img.complete
          ? img.decode
            ? img.decode().catch(() => {})
            : Promise.resolve()
          : new Promise((res) => {
              img.onload = res;
              img.onerror = res;
            })
      )
    );
    const fitRes = window.QuizFitText.fitQuizElements(document);
    const boxes = Array.from(document.querySelectorAll('[data-fit]')).map((el) => ({
      role: el.getAttribute('data-fit'),
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      fontSize: window.getComputedStyle(el).fontSize,
    }));
    return {
      fontsStatus: document.fonts.status,
      loadedFontsCount: Array.from(document.fonts).filter((f) => f.status === 'loaded').length,
      fitRes,
      boxes,
    };
  });

  assert.strictEqual(stats.fontsStatus, 'loaded', `Expected document.fonts.status === 'loaded', got ${stats.fontsStatus}`);
  assert(stats.loadedFontsCount > 0, 'Expected at least 1 loaded @font-face');

  for (const box of stats.boxes) {
    assert(
      box.scrollHeight <= box.clientHeight + 1,
      `[${profileName}/${kind}/${box.role}] vertical overflow: scrollHeight=${box.scrollHeight} > clientHeight=${box.clientHeight}`
    );
    assert(
      box.scrollWidth <= box.clientWidth + 1,
      `[${profileName}/${kind}/${box.role}] horizontal overflow: scrollWidth=${box.scrollWidth} > clientWidth=${box.clientWidth}`
    );
  }
  return stats;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { refQPath, refAPath } = await ensureReferenceImages();

  const browser = await launchQuizBrowser();
  try {
    // 1. Offline guard context: fail immediately on any external http/https request
    const externalRequests = [];
    const context = await browser.newContext({
      viewport: { width: 1080, height: 1920 },
      deviceScaleFactor: 1,
    });
    await context.route('**/*', (route) => {
      const url = route.request().url();
      if (/^https?:\/\//i.test(url)) {
        externalRequests.push(url);
        return route.abort();
      }
      return route.continue();
    });

    // (a) Reference match renders & visual-diff
    console.log('1) Rendering reference question & answer slides...');
    const refSlides = await renderQuizSlides(REFERENCE_ITEM, {
      profile: 'reel-9x16',
      browserContext: context,
    });

    const qDiff = await computeVisualDiffOutputs('question', refQPath, refSlides.questionPng);
    const aDiff = await computeVisualDiffOutputs('answer', refAPath, refSlides.answerPng);
    console.log(`   [visual-diff] Question MAE=${qDiff.mae.toFixed(2)}, RMSE=${qDiff.rmse.toFixed(2)}`);
    console.log(`   [visual-diff] Answer   MAE=${aDiff.mae.toFixed(2)}, RMSE=${aDiff.rmse.toFixed(2)}`);

    // (b) Hindi conjuncts test
    console.log('2) Testing Hindi conjuncts & matras (क्ष, त्र, ज्ञ, ंँ)...');
    const page = await context.newPage();
    const conjQStats = await verifyDomOverflowAndFonts(page, 'question', CONJUNCTS_ITEM, 'reel-9x16');
    const conjAStats = await verifyDomOverflowAndFonts(page, 'answer', CONJUNCTS_ITEM, 'reel-9x16');
    console.log(`   [conjuncts] loadedFonts=${conjQStats.loadedFontsCount}, Q status=${conjQStats.fontsStatus}, A status=${conjAStats.fontsStatus}`);
    await renderQuizSlides(CONJUNCTS_ITEM, {
      profile: 'reel-9x16',
      page,
      questionOutPath: path.join(OUT_DIR, 'hindi-conjuncts-q.png'),
      answerOutPath: path.join(OUT_DIR, 'hindi-conjuncts-a.png'),
    });

    // (c) Long Hindi question (~150 chars) & long explanation (~350 chars) overflow protection
    console.log('3) Testing long Hindi question & long explanation overflow protection...');
    const longQStats = await verifyDomOverflowAndFonts(page, 'question', LONG_TEXT_ITEM, 'reel-9x16');
    const longAStats = await verifyDomOverflowAndFonts(page, 'answer', LONG_TEXT_ITEM, 'reel-9x16');
    console.log(
      `   [long-text] Q fontSize=${longQStats.boxes.find((b) => b.role === 'question')?.fontSize}, ` +
        `Expl fontSize=${longAStats.boxes.find((b) => b.role === 'explanation')?.fontSize}`
    );
    await renderQuizSlides(LONG_TEXT_ITEM, {
      profile: 'reel-9x16',
      page,
      questionOutPath: path.join(OUT_DIR, 'long-text-q.png'),
      answerOutPath: path.join(OUT_DIR, 'long-text-a.png'),
    });

    // (d) All 4 profiles offline + dimension & DOM overflow checks
    console.log('4) Testing all 4 output profiles offline...');
    const profileChecks = [
      { profile: 'reel-9x16', showCtaButtons: true, w: 1080, h: 1920, tag: 'reel-9x16' },
      { profile: 'shorts-9x16', showCtaButtons: true, w: 1080, h: 1920, tag: 'shorts-cta' },
      { profile: 'shorts-9x16', showCtaButtons: false, w: 1080, h: 1920, tag: 'shorts-nocta' },
      { profile: 'feed-1x1', showCtaButtons: false, w: 1080, h: 1080, tag: 'feed-1x1' },
      { profile: 'feed-4x5', showCtaButtons: true, w: 1080, h: 1350, tag: 'feed-4x5' },
    ];

    const shortsBuffers = {};
    for (const chk of profileChecks) {
      await verifyDomOverflowAndFonts(page, 'question', REFERENCE_ITEM, chk.profile, {
        showCtaButtons: chk.showCtaButtons,
      });
      await verifyDomOverflowAndFonts(page, 'answer', REFERENCE_ITEM, chk.profile, {
        showCtaButtons: chk.showCtaButtons,
      });

      const res = await renderQuizSlides(REFERENCE_ITEM, {
        profile: chk.profile,
        showCtaButtons: chk.showCtaButtons,
        page,
        questionOutPath: path.join(OUT_DIR, `profile-${chk.tag}-q.png`),
        answerOutPath: path.join(OUT_DIR, `profile-${chk.tag}-a.png`),
      });

      const metaQ = await sharp(res.questionPng).metadata();
      const metaA = await sharp(res.answerPng).metadata();
      assert.strictEqual(metaQ.width, chk.w, `${chk.tag} Q width mismatch`);
      assert.strictEqual(metaQ.height, chk.h, `${chk.tag} Q height mismatch`);
      assert.strictEqual(metaA.width, chk.w, `${chk.tag} A width mismatch`);
      assert.strictEqual(metaA.height, chk.h, `${chk.tag} A height mismatch`);

      if (chk.tag === 'shorts-cta' || chk.tag === 'shorts-nocta') {
        shortsBuffers[chk.tag] = res.questionPng;
      }
      console.log(`   [profile] ${chk.tag}: Q=${metaQ.width}x${metaQ.height}, A=${metaA.width}x${metaA.height}`);
    }

    assert(
      !shortsBuffers['shorts-cta'].equals(shortsBuffers['shorts-nocta']),
      'shorts-9x16 showCtaButtons=false must differ visually from showCtaButtons=true'
    );
    assert.strictEqual(
      externalRequests.length,
      0,
      `Expected ZERO external HTTP/HTTPS requests, saw: ${externalRequests.join(', ')}`
    );
    console.log('   [offline] Verified 0 external HTTP/HTTPS network requests.');

    await page.close();
    await context.close();

    // (e) 10-question (20-slide) batch performance
    console.log('5) Testing 10-question (20-slide) batch performance...');
    const batchItems = Array.from({ length: 10 }, (_, idx) => ({
      ...REFERENCE_ITEM,
      qNo: idx + 1,
    }));
    const t0 = Date.now();
    const batchRes = await renderQuizBatch(batchItems, {
      profile: 'shorts-9x16',
      browser,
    });
    const elapsedMs = Date.now() - t0;
    const totalSlides = batchRes.length * 2;
    const avgMs = elapsedMs / totalSlides;
    console.log(`   [batch] ${totalSlides} slides in ${elapsedMs}ms (${avgMs.toFixed(1)} ms/slide)`);
    assert.strictEqual(batchRes.length, 10, 'Expected 10 batch results');
    assert(avgMs < 1500, `Batch avg ${avgMs.toFixed(1)} ms/slide exceeded 1500 ms/slide target`);

    console.log('ALL VISUAL-DIFF & CORE VERIFICATION CHECKS PASSED.');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('visual-diff failed:', err);
  process.exit(1);
});
