'use strict';

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DEFAULT_SRC_DIR = 'C:/Users/hp/.gemini/antigravity/brain/005d60e2-9c1f-4706-b6b8-331dfa28d106/.user_uploaded';
const ASSETS_DIR = path.join(__dirname, '..', 'assets');

const SRC_FILES = {
  bg: 'media_1795689582073_1cdee3db.jpg',
  logo: 'media_1795689730046_9f5623d1.png',
  gkBanner: 'media_1795689789734_f2384e81.png',
  correctBadge: 'media_1795690048047_34fb3bfc.png',
  btnInstagram: 'media_1795689892738_b5138df0.png',
  footerBrush: 'media_1795689925417_35f22bfe.png',
  bottomBar: 'media_1795689950184_fc326deb.jpg',
};

function resolveSrc(srcDir, key) {
  const full = path.join(srcDir, SRC_FILES[key]);
  if (!fs.existsSync(full)) {
    throw new Error(`Missing source asset for ${key}: ${full}`);
  }
  return full;
}

/**
 * 1. bg-globe-blue.png (1080x1920)
 * Inpaint bottom-right 4-point diamond watermark (x=462..503, y=915..954 in 571x1024)
 * from clean adjacent palace silhouette (x=418..459, y=915..954) with 4px edge feathering.
 */
async function buildBgGlobeBlue(srcDir) {
  const srcPath = resolveSrc(srcDir, 'bg');
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  const dstX0 = 461;
  const dstX1 = 505;
  const dstY0 = 914;
  const dstY1 = 956;
  const srcOffsetX = -44; // sample from x = 417..461
  const feather = 4;

  for (let y = dstY0; y <= dstY1; y++) {
    for (let x = dstX0; x <= dstX1; x++) {
      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      const sx = x + srcOffsetX;
      const sy = y;
      const dxEdge = Math.min(x - dstX0, dstX1 - x);
      const dyEdge = Math.min(y - dstY0, dstY1 - y);
      const edgeDist = Math.min(dxEdge, dyEdge);
      const alpha = Math.min(1, (edgeDist + 1) / (feather + 1));

      const di = (y * width + x) * channels;
      const si = (sy * width + sx) * channels;
      for (let c = 0; c < 3; c++) {
        out[di + c] = Math.round(out[di + c] * (1 - alpha) + out[si + c] * alpha);
      }
    }
  }

  const outPath = path.join(ASSETS_DIR, 'bg-globe-blue.png');
  await sharp(out, { raw: { width, height, channels } })
    .resize(1080, 1920, { fit: 'cover', position: 'top', kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

/**
 * 2. logo-examiq.png (320x320 RGBA)
 * Pads 232x218 -> 232x232, applies circular dest-in mask at 232x232, THEN resizes to 320x320.
 */
async function buildLogoExamiq(srcDir) {
  const srcPath = resolveSrc(srcDir, 'logo');
  const padded = await sharp(srcPath)
    .ensureAlpha()
    .extend({ top: 7, bottom: 7, left: 0, right: 0, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(232, 232)
    .png()
    .toBuffer();

  const maskSvg = Buffer.from(`
    <svg width="232" height="232" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="edge" cx="50%" cy="50%" r="50%">
          <stop offset="97%" stop-color="#ffffff" stop-opacity="1"/>
          <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="116" cy="116" r="113" fill="url(#edge)"/>
    </svg>
  `);

  const masked = await sharp(padded)
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const outPath = path.join(ASSETS_DIR, 'logo-examiq.png');
  await sharp(masked)
    .resize(320, 320, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

/**
 * 3. banner-gk-quiz.png (780x230 RGBA)
 * Cleans compass overlap + top-left pin + removes outer dark-blue scraps at native 557x164,
 * THEN resizes to 780x230 so Sharp resize-before-composite never clips the mask.
 */
async function buildBannerGkQuiz(srcDir) {
  const srcPath = resolveSrc(srcDir, 'gkBanner');
  // At 557x164: capsule top rim has slope dy/dx = -0.0526 (-3.01 deg).
  // Slope-clone clean adjacent top-rim pixels over the two top defects:
  //   1) top-left pin (x=71..85, y=24..44) cloned from sx=x+24
  //   2) compass overlap (x=179..232, y=14..44) cloned from sx=x+56
  const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);
  const slope = -0.0526;

  const cloneZone = (x0, x1, y0, y1, dx) => {
    const featherX = 2;
    const featherY = 2;
    for (let x = x0; x <= x1; x++) {
      const sx = x + dx;
      if (sx < 0 || sx >= width) continue;
      const wx = Math.min(1, (Math.min(x - x0, x1 - x) + 1) / (featherX + 1));
      for (let y = y0; y <= y1; y++) {
        const sy = Math.round(y + dx * slope);
        if (sy < 0 || sy >= height) continue;
        const wy = y > y1 - featherY ? Math.max(0, (y1 - y + 1) / (featherY + 1)) : 1;
        const w = wx * wy;
        const di = (y * width + x) * channels;
        const si = (sy * width + sx) * channels;
        for (let c = 0; c < channels; c++) {
          out[di + c] = Math.round(out[di + c] * (1 - w) + data[si + c] * w);
        }
      }
    }
  };

  cloneZone(71, 85, 24, 45, 24);
  cloneZone(179, 232, 14, 45, 56);

  const maskSvg = Buffer.from(`
    <svg width="557" height="164" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-3.16 278.5 81.6)">
        <rect x="6" y="23" width="545" height="117" rx="58.5" ry="58.5" fill="#ffffff"/>
      </g>
    </svg>
  `);

  const composited = await sharp(out, { raw: { width, height, channels } })
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();

  const outPath = path.join(ASSETS_DIR, 'banner-gk-quiz.png');
  await sharp(composited)
    .resize(780, 230, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

/**
 * 4. icon-bulb.png (120x126 RGBA)
 * Extracted from f2384e81.png (x=16, y=28, 126x126).
 * Flood-fills dark navy moat inside the pill (preserving enclosed dark filament inside yellow bulb),
 * then flood-fills and deletes the outer yellow pill rim & exterior blue corners.
 */
async function buildIconBulb(srcDir) {
  const srcPath = resolveSrc(srcDir, 'gkBanner');
  const { data, info } = await sharp(srcPath)
    .extract({ left: 16, top: 28, width: 126, height: 126 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);

  // Step 1: Flood-fill dark navy moat from seed (63, 18) inside the pill (above the bulb).
  // Does not penetrate the solid yellow glass dome, so the dark filament stays 100% intact.
  const visitedNavy = new Uint8Array(width * height);
  const navyQueue = [18 * width + 63, 18 * width + 40, 18 * width + 86, 50 * width + 30, 50 * width + 98];
  const isDarkNavy = (idx) => {
    const r = out[idx], g = out[idx + 1], b = out[idx + 2], a = out[idx + 3];
    if (a < 20) return true;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    return lum < 64 && b >= r && r < 52 && g < 64;
  };

  let head = 0;
  while (head < navyQueue.length) {
    const pos = navyQueue[head++];
    if (visitedNavy[pos]) continue;
    visitedNavy[pos] = 1;
    const idx = pos * channels;
    if (!isDarkNavy(idx)) continue;
    out[idx + 3] = 0;

    const x = pos % width;
    const y = (pos - x) / width;
    if (x > 0) navyQueue.push(pos - 1);
    if (x < width - 1) navyQueue.push(pos + 1);
    if (y > 0) navyQueue.push(pos - width);
    if (y < height - 1) navyQueue.push(pos + width);
  }

  // Step 2: Flood-fill and clear everything connected to the outer rim / pill border
  // (top y<=13, left x<=10, bottom y>=116, right x>=120) so only the isolated bulb+rays remain.
  const visitedOuter = new Uint8Array(width * height);
  const outerQueue = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (y <= 13 || y >= 116 || x <= 10 || x >= 120) {
        const p = y * width + x;
        if (out[p * channels + 3] > 0) {
          outerQueue.push(p);
        }
      }
    }
  }

  head = 0;
  while (head < outerQueue.length) {
    const pos = outerQueue[head++];
    if (visitedOuter[pos]) continue;
    visitedOuter[pos] = 1;
    const idx = pos * channels;
    if (out[idx + 3] === 0) continue;
    out[idx + 3] = 0;

    const x = pos % width;
    const y = (pos - x) / width;
    if (x > 0) outerQueue.push(pos - 1);
    if (x < width - 1) outerQueue.push(pos + 1);
    if (y > 0) outerQueue.push(pos - width);
    if (y < height - 1) outerQueue.push(pos + width);
  }

  // Step 3: Softly anti-alias any 1px dark-navy fringe pixels adjacent to transparent background
  const alphaSnap = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) alphaSnap[p] = out[p * channels + 3];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (alphaSnap[p] === 0) continue;
      const hasTrans =
        alphaSnap[p - 1] === 0 || alphaSnap[p + 1] === 0 ||
        alphaSnap[p - width] === 0 || alphaSnap[p + width] === 0;
      if (!hasTrans) continue;
      const idx = p * channels;
      const r = out[idx], g = out[idx + 1], b = out[idx + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      if (lum < 82 && b >= r) {
        out[idx + 3] = Math.round(out[idx + 3] * Math.max(0, (lum - 30) / 52));
      }
    }
  }

  const outPath = path.join(ASSETS_DIR, 'icon-bulb.png');
  await sharp(out, { raw: { width, height, channels } })
    .trim()
    .resize(120, 126, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

/**
 * 5. badge-correct-answer.png (960x240 RGBA)
 * Vector-accurate high-res SVG->PNG replicating media_1795690048047_34fb3bfc.png (185x46).
 */
async function buildBadgeCorrectAnswer(srcDir, { fromRaw = false } = {}) {
  const outPath = path.join(ASSETS_DIR, 'badge-correct-answer.png');
  if (fromRaw) {
    const srcPath = resolveSrc(srcDir, 'correctBadge');
    const { data, info } = await sharp(srcPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const out = Buffer.from(data);
    for (let i = 0; i < out.length; i += info.channels) {
      const r = out[i], g = out[i + 1], b = out[i + 2];
      if (b > g + 10 && r < 60 && g < 80) {
        out[i + 3] = 0;
      }
    }
    await sharp(out, { raw: info })
      .resize(960, 240, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toFile(outPath);
    return outPath;
  }

  const svg = Buffer.from(`
    <svg width="960" height="240" viewBox="0 0 960 240" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ribbonMain" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#097A05"/>
          <stop offset="28%" stop-color="#179C0C"/>
          <stop offset="65%" stop-color="#22B313"/>
          <stop offset="100%" stop-color="#1A9E0D"/>
        </linearGradient>
        <linearGradient id="ribbonTail" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#76DB1A"/>
          <stop offset="100%" stop-color="#1F9A0E"/>
        </linearGradient>
        <linearGradient id="circleGrad" x1="20%" y1="15%" x2="85%" y2="85%">
          <stop offset="0%" stop-color="#29C717"/>
          <stop offset="100%" stop-color="#087E04"/>
        </linearGradient>
        <filter id="dropShadow" x="-10%" y="-15%" width="120%" height="140%">
          <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#001230" flood-opacity="0.55"/>
        </filter>
        <filter id="textShadow" x="-5%" y="-15%" width="110%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#043B02" flood-opacity="0.75"/>
        </filter>
      </defs>

      <g transform="rotate(-2.9 480 120)" filter="url(#dropShadow)">
        <!-- Left ribbon fold + notched tail -->
        <polygon points="104,132 104,196 34,218 64,166 24,132" fill="url(#ribbonTail)" stroke="#9DF236" stroke-width="2.5" stroke-linejoin="round"/>
        <polygon points="104,132 128,154 104,196" fill="#054F03"/>

        <!-- Right ribbon fold + notched tail -->
        <polygon points="872,72 938,60 906,112 942,158 866,170" fill="url(#ribbonTail)" stroke="#9DF236" stroke-width="2.5" stroke-linejoin="round"/>
        <polygon points="866,144 892,154 866,170" fill="#054F03"/>

        <!-- Main ribbon banner -->
        <path d="M 192,62 L 908,42 L 882,164 L 192,184 Z" fill="url(#ribbonMain)"/>
        <!-- Top & bottom lime highlight bevel lines -->
        <line x1="194" y1="65" x2="905" y2="45" stroke="#A6F742" stroke-width="4" stroke-linecap="round"/>
        <line x1="194" y1="181" x2="880" y2="161" stroke="#94ED31" stroke-width="4" stroke-linecap="round"/>

        <!-- Circular green checkmark badge -->
        <circle cx="176" cy="120" r="88" fill="#17A10C"/>
        <circle cx="176" cy="120" r="78" fill="url(#circleGrad)" stroke="#FFFFFF" stroke-width="8"/>
        <path d="M 138,122 L 165,149 L 218,93" fill="none" stroke="#FFFFFF" stroke-width="19" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Crisp bold italic label -->
        <text x="568" y="136"
              text-anchor="middle"
              font-family="Poppins, 'Segoe UI', Arial, sans-serif"
              font-size="76"
              font-weight="800"
              font-style="italic"
              letter-spacing="-0.5"
              fill="#FFFFFF"
              filter="url(#textShadow)">Correct Answer</text>
      </g>
    </svg>
  `);

  await sharp(svg).png({ compressionLevel: 9 }).toFile(outPath);
  return outPath;
}

/**
 * 6. btn-subscribe.png (500x145 RGBA)
 * Extracted from fc326deb.jpg (x=4..336, y=0..96) keeping the 3 yellow bell sparkles above the pill.
 */
async function buildBtnSubscribe(srcDir) {
  const srcPath = resolveSrc(srcDir, 'bottomBar');
  const { data, info } = await sharp(srcPath)
    .extract({ left: 4, top: 0, width: 333, height: 97 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);

  // Pill rounded rectangle in extracted coords: x=4.5..327.5 (w=323), y=17.5..90.5 (h=73), rx=36.5
  const rx = 36.5;
  const x0 = 4.5, x1 = 327.5, y0 = 17.5, y1 = 90.5;
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const halfW = (x1 - x0) / 2;
  const halfH = (y1 - y0) / 2;

  function pillDist(x, y) {
    const qx = Math.abs(x - cx) - (halfW - rx);
    const qy = Math.abs(y - cy) - (halfH - rx);
    return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rx;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * channels;
      const r = out[idx], g = out[idx + 1], b = out[idx + 2];
      const d = pillDist(x, y);

      if (d <= 0) {
        if (d > -1.2 && b > r + 15 && r < 55) {
          out[idx + 3] = 0;
        }
        continue;
      }
      if (d < 1.2 && r > b + 30) {
        out[idx + 3] = Math.round(255 * Math.max(0, 1 - d / 1.2));
        continue;
      }

      // Outside pill: keep only the 3 yellow bell sparkles (x=282..332, y=0..18)
      const inSparkleZone = x >= 282 && x <= 332 && y >= 0 && y <= 18;
      if (inSparkleZone && r > 130 && g > 100 && r > b + 40) {
        const strength = Math.min(1, (r - b - 20) / 100);
        out[idx + 3] = Math.round(255 * strength);
      } else {
        out[idx + 3] = 0;
      }
    }
  }

  const outPath = path.join(ASSETS_DIR, 'btn-subscribe.png');
  await sharp(out, { raw: { width, height, channels } })
    .resize(500, 145, { kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

/**
 * 7. btn-instagram.png (454x136 RGBA)
 * Extracted from fc326deb.jpg (left: 355, top: 6, width: 281, height: 102) so the vertical divider
 * is excluded and top glossy highlights are preserved, with a clean rounded-rect mask + blue-edge cleanup.
 */
async function buildBtnInstagram(srcDir) {
  const srcPath = resolveSrc(srcDir, 'bottomBar');
  const maskSvg = Buffer.from(`
    <svg width="281" height="102" xmlns="http://www.w3.org/2000/svg">
      <rect x="13" y="1" width="98" height="86" rx="22" ry="22" fill="#ffffff"/>
      <rect x="92" y="6" width="187" height="77" rx="19" ry="19" fill="#ffffff"/>
    </svg>
  `);

  const { data, info } = await sharp(srcPath)
    .extract({ left: 355, top: 6, width: 281, height: 102 })
    .ensureAlpha()
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const out = Buffer.from(data);

  // Strip any residual dark-blue background pixels outside the glossy IG button interior
  for (let p = 0; p < width * height; p++) {
    const x = p % width;
    const y = (p - x) / width;
    if (x >= 18 && x <= 104 && y >= 5 && y <= 82) continue;
    const idx = p * channels;
    if (out[idx + 3] === 0) continue;
    const r = out[idx], g = out[idx + 1], b = out[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (b > r + 14 && r < 46 && g < 78 && lum < 75) {
      out[idx + 3] = 0;
    }
  }

  const outPath = path.join(ASSETS_DIR, 'btn-instagram.png');
  await sharp(out, { raw: { width, height, channels } })
    .resize(454, 136, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

/**
 * 8. footer-bar.png (1080x210 RGBA)
 * Extracts the intact yellow brush ("— ExamIQ Bharat" + sparkle) from fc326deb.jpg,
 * removes all exterior dark-blue pixels (including behind the 4-point sparkle),
 * and composites crisp white tagline "GK  |  REASONING  |  MATHS  FOR GOVERNMENT EXAMS".
 */
async function buildFooterBar(srcDir) {
  const srcPath = resolveSrc(srcDir, 'bottomBar');
  const { data, info } = await sharp(srcPath)
    .extract({ left: 26, top: 105, width: 590, height: 82 })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.from(data);

  const visited = new Uint8Array(width * height);
  const queue = [];

  function isExteriorBlue(idx) {
    const a = out[idx + 3];
    if (a < 25) return true;
    const r = out[idx], g = out[idx + 1], b = out[idx + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Key out dark/medium blue background around brush and around right-side translucent star
    return (b > r + 14 && r < 72 && g < 105 && lum < 105) || (b > r + 28 && r < 110 && lum < 125);
  }

  for (let x = 0; x < width; x++) {
    queue.push(x, (height - 1) * width + x);
  }
  for (let y = 0; y < height; y++) {
    queue.push(y * width, y * width + (width - 1));
  }

  let head = 0;
  while (head < queue.length) {
    const pos = queue[head++];
    if (visited[pos]) continue;
    visited[pos] = 1;
    const idx = pos * channels;
    if (!isExteriorBlue(idx)) continue;
    out[idx + 3] = 0;

    const x = pos % width;
    const y = (pos - x) / width;
    if (x > 0) queue.push(pos - 1);
    if (x < width - 1) queue.push(pos + 1);
    if (y > 0) queue.push(pos - width);
    if (y < height - 1) queue.push(pos + width);
  }

  // Clean 1px blue fringe along brush and star boundaries
  const alphaCopy = new Uint8Array(width * height);
  for (let p = 0; p < width * height; p++) alphaCopy[p] = out[p * channels + 3];
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const p = y * width + x;
      if (alphaCopy[p] === 0) continue;
      const hasZero =
        alphaCopy[p - 1] === 0 || alphaCopy[p + 1] === 0 ||
        alphaCopy[p - width] === 0 || alphaCopy[p + width] === 0;
      if (hasZero) {
        const idx = p * channels;
        const r = out[idx], g = out[idx + 1], b = out[idx + 2];
        if (b > r + 10 && r < 125) {
          out[idx + 3] = Math.round(out[idx + 3] * 0.15);
        }
      }
    }
  }

  const brushBuf = await sharp(out, { raw: { width, height, channels } })
    .resize(940, 130, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: 'lanczos3' })
    .png()
    .toBuffer();

  const taglineSvg = Buffer.from(`
    <svg width="1080" height="210" xmlns="http://www.w3.org/2000/svg">
      <text x="540" y="178"
            text-anchor="middle"
            font-family="'Arial Narrow', 'Segoe UI', Arial, sans-serif"
            font-size="31"
            font-weight="800"
            letter-spacing="1.2"
            fill="#FFFFFF">GK  |  REASONING  |  MATHS  FOR GOVERNMENT EXAMS</text>
    </svg>
  `);

  const outPath = path.join(ASSETS_DIR, 'footer-bar.png');
  await sharp({
    create: {
      width: 1080,
      height: 210,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: brushBuf, left: 70, top: 4 },
      { input: taglineSvg, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  return outPath;
}

async function buildAllAssets({ srcDir = DEFAULT_SRC_DIR, fromRaw = false } = {}) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
  const built = [];
  built.push(await buildBgGlobeBlue(srcDir));
  built.push(await buildLogoExamiq(srcDir));
  built.push(await buildBannerGkQuiz(srcDir));
  built.push(await buildIconBulb(srcDir));
  built.push(await buildBadgeCorrectAnswer(srcDir, { fromRaw }));
  built.push(await buildBtnSubscribe(srcDir));
  built.push(await buildBtnInstagram(srcDir));
  built.push(await buildFooterBar(srcDir));
  return built;
}

if (require.main === module) {
  const fromRaw = process.argv.includes('--from-raw');
  buildAllAssets({ fromRaw })
    .then(async (paths) => {
      for (const p of paths) {
        const meta = await sharp(p).metadata();
        console.log(`[asset] ${path.basename(p)} -> ${meta.width}x${meta.height} (${meta.channels}ch)`);
      }
    })
    .catch((err) => {
      console.error('Asset build failed:', err);
      process.exit(1);
    });
}

module.exports = {
  ASSETS_DIR,
  DEFAULT_SRC_DIR,
  buildAllAssets,
};
