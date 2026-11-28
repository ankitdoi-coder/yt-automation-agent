'use strict';

const dns = require('dns');
const fs = require('fs');
const path = require('path');

// Prevent IPv6 connect timeouts to cdn.jsdelivr.net on Windows/dual-stack hosts
dns.setDefaultResultOrder('ipv4first');

const FONTS_DIR = path.join(__dirname, '..', 'fonts');

const FONT_MANIFEST = [
  {
    file: 'baloo-2-devanagari-700-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/baloo-2@5.3.0/files/baloo-2-devanagari-700-normal.woff2',
    family: 'Baloo 2',
    weight: 700,
    subset: 'devanagari',
  },
  {
    file: 'baloo-2-devanagari-800-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/baloo-2@5.3.0/files/baloo-2-devanagari-800-normal.woff2',
    family: 'Baloo 2',
    weight: 800,
    subset: 'devanagari',
  },
  {
    file: 'baloo-2-latin-700-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/baloo-2@5.3.0/files/baloo-2-latin-700-normal.woff2',
    family: 'Baloo 2',
    weight: 700,
    subset: 'latin',
  },
  {
    file: 'baloo-2-latin-800-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/baloo-2@5.3.0/files/baloo-2-latin-800-normal.woff2',
    family: 'Baloo 2',
    weight: 800,
    subset: 'latin',
  },
  {
    file: 'mukta-devanagari-700-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/mukta@5.3.0/files/mukta-devanagari-700-normal.woff2',
    family: 'Mukta',
    weight: 700,
    subset: 'devanagari',
  },
  {
    file: 'mukta-devanagari-800-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/mukta@5.3.0/files/mukta-devanagari-800-normal.woff2',
    family: 'Mukta',
    weight: 800,
    subset: 'devanagari',
  },
  {
    file: 'mukta-latin-700-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/mukta@5.3.0/files/mukta-latin-700-normal.woff2',
    family: 'Mukta',
    weight: 700,
    subset: 'latin',
  },
  {
    file: 'mukta-latin-800-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/mukta@5.3.0/files/mukta-latin-800-normal.woff2',
    family: 'Mukta',
    weight: 800,
    subset: 'latin',
  },
  {
    file: 'noto-sans-devanagari-devanagari-700-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-devanagari@5.3.0/files/noto-sans-devanagari-devanagari-700-normal.woff2',
    family: 'Noto Sans Devanagari',
    weight: 700,
    subset: 'devanagari',
  },
  {
    file: 'noto-sans-devanagari-devanagari-800-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-devanagari@5.3.0/files/noto-sans-devanagari-devanagari-800-normal.woff2',
    family: 'Noto Sans Devanagari',
    weight: 800,
    subset: 'devanagari',
  },
  {
    file: 'noto-sans-devanagari-latin-700-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-devanagari@5.3.0/files/noto-sans-devanagari-latin-700-normal.woff2',
    family: 'Noto Sans Devanagari',
    weight: 700,
    subset: 'latin',
  },
  {
    file: 'noto-sans-devanagari-latin-800-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-devanagari@5.3.0/files/noto-sans-devanagari-latin-800-normal.woff2',
    family: 'Noto Sans Devanagari',
    weight: 800,
    subset: 'latin',
  },
  {
    file: 'poppins-latin-700-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/poppins@5.3.0/files/poppins-latin-700-normal.woff2',
    family: 'Poppins',
    weight: 700,
    subset: 'latin',
  },
  {
    file: 'poppins-latin-800-normal.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/poppins@5.3.0/files/poppins-latin-800-normal.woff2',
    family: 'Poppins',
    weight: 800,
    subset: 'latin',
  },
];

function isValidWoff2Buffer(buf) {
  return Buffer.isBuffer(buf) && buf.length > 4 && buf.subarray(0, 4).toString('ascii') === 'wOF2';
}

function isValidWoff2File(filePath) {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile() || stat.size <= 4) return false;
    const fd = fs.openSync(filePath, 'r');
    try {
      const header = Buffer.alloc(4);
      const bytesRead = fs.readSync(fd, header, 0, 4, 0);
      return bytesRead === 4 && header.toString('ascii') === 'wOF2';
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return false;
  }
}

async function fetchWithRetry(url, attempts = 3) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const arrBuf = await res.arrayBuffer();
      const buf = Buffer.from(arrBuf);
      if (!isValidWoff2Buffer(buf)) {
        throw new Error(`Invalid wOF2 magic bytes (len=${buf.length}, magic=${buf.subarray(0, 4).toString('hex')})`);
      }
      return buf;
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        await new Promise((r) => setTimeout(r, 500 * i));
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`Failed to download ${url}: ${lastError?.message || lastError}`);
}

async function downloadFonts({ force = false, quiet = false } = {}) {
  fs.mkdirSync(FONTS_DIR, { recursive: true });
  const results = [];

  for (const entry of FONT_MANIFEST) {
    const destPath = path.join(FONTS_DIR, entry.file);
    if (!force && isValidWoff2File(destPath)) {
      const size = fs.statSync(destPath).size;
      if (!quiet) console.log(`[skip] ${entry.file} (${size} B, valid wOF2)`);
      results.push({ file: entry.file, status: 'skipped', size });
      continue;
    }

    const buf = await fetchWithRetry(entry.url);
    const tmpPath = `${destPath}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(tmpPath, buf);
      fs.renameSync(tmpPath, destPath);
    } catch (err) {
      try { fs.unlinkSync(tmpPath); } catch {}
      throw err;
    }
    if (!quiet) console.log(`[ok]   ${entry.file} (${buf.length} B, wOF2)`);
    results.push({ file: entry.file, status: 'downloaded', size: buf.length });
  }

  return results;
}

if (require.main === module) {
  const force = process.argv.includes('--force');
  downloadFonts({ force })
    .then((res) => {
      const downloaded = res.filter((r) => r.status === 'downloaded').length;
      const skipped = res.filter((r) => r.status === 'skipped').length;
      console.log(`Font setup complete: ${downloaded} downloaded, ${skipped} skipped (total ${res.length}).`);
    })
    .catch((err) => {
      console.error('Font download failed:', err.message);
      process.exit(1);
    });
}

module.exports = {
  FONT_MANIFEST,
  FONTS_DIR,
  downloadFonts,
  isValidWoff2File,
};
