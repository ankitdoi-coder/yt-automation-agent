/**
 * Facebook Reels Export & Delivery Helper
 *
 * Packages generated vertical GK Reels (1080x1920 MP4) with ready-to-paste
 * Meta Business Suite metadata (Title, Description, Hashtags, Pinned Comment)
 * into a clean artifact folder and optionally delivers videos to Telegram.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const NodeFormData = require('form-data');

const DEFAULT_EXPORT_DIR = path.resolve(__dirname, 'output/export_ready');
const TELEGRAM_CAPTION_LIMIT = 1024;
const TELEGRAM_MESSAGE_LIMIT = 4096;
const TELEGRAM_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Builds standardized Facebook Reel title, description, tags, and engagement comment.
 */
function buildReelMetadata(item = {}) {
  const safeTitle = item.title || 'सामान्य ज्ञान GK Quiz';
  const safeTopic = item.topic || 'सामान्य ज्ञान';
  const title = `${safeTitle} | ${safeTopic} | Exam IQ Bharat #reels #FacebookReels`;

  const baseTags = Array.isArray(item.tags)
    ? [...item.tags]
    : (typeof item.tags === 'string' && item.tags.trim()
      ? item.tags.trim().split(/\s+/)
      : ['#ExamIQ', '#GKQuiz', '#GeneralKnowledge', '#StaticGK', '#SSC', '#Railway']);

  if (!baseTags.some(t => /^#reels$/i.test(t))) baseTags.push('#Reels');
  if (!baseTags.some(t => /^#facebookreels$/i.test(t))) baseTags.push('#FacebookReels');
  if (!baseTags.some(t => /^#reelsviral$/i.test(t))) baseTags.push('#ReelsViral');

  const optionLines = (item.options || []).map(o => `${o.letter}) ${o.text}`);
  const description = [
    `🎯 ${safeTitle} | ${safeTopic}`,
    '',
    item.question ? `Q. ${item.question}` : '',
    ...optionLines,
    '',
    '👉 अपना जवाब (A, B, C या D) कमेंट बॉक्स में बताएं! देखते हैं कितने लोग सही जवाब देते हैं! 🏆',
    '🔔 रोज़ाना नए GK Tests के लिए Exam IQ Bharat को Follow करें!',
    '',
    baseTags.join(' '),
  ]
    .filter((line, idx, arr) => !(line === '' && (idx === 0 || arr[idx - 1] === '')))
    .join('\n');

  const pinnedComment =
    '💬 आपका उत्तर (A, B, C या D) क्या है? कमेंट करें! सही जवाब देने वालों का कमेंट पिन किया जाएगा 🏆👇';

  const answerKey = item.answerText || item.correctOption || '';

  return {
    title,
    description,
    tags: baseTags,
    pinnedComment,
    answerKey,
  };
}

/**
 * Formats an IST Meta Business Suite recommended evening schedule slot.
 */
function formatIstScheduleSlot(baseDate = new Date(), dayOffset = 0) {
  const target = new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000);
  const formatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(target);
  return `${formatted} • 08:30 PM IST`;
}

/**
 * Sanitizes an identifier into a filesystem-safe filename stem.
 */
function sanitizeStem(rawId, fallbackIndex = 1) {
  const cleaned = String(rawId || `reel_${fallbackIndex}`)
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || `reel_${fallbackIndex}`;
}

/**
 * Removes existing files/folders inside targetDir before writing a fresh export batch.
 */
function clearDirectoryContents(targetDir) {
  if (!fs.existsSync(targetDir)) return;
  for (const entry of fs.readdirSync(targetDir)) {
    fs.rmSync(path.join(targetDir, entry), { recursive: true, force: true });
  }
}

/**
 * Packages rendered Reel MP4s with captions.txt and schedule_manifest.json for Meta Business Suite.
 */
function createExportBundle(entries = [], options = {}) {
  const exportDir = path.resolve(options.exportDir || DEFAULT_EXPORT_DIR);
  const cleanExisting = options.cleanExisting !== false;
  const scheduleStartDate = options.scheduleStartDate ? new Date(options.scheduleStartDate) : new Date();
  const pageName = options.pageName || process.env.FB_PAGE_NAME || 'Exam IQ Bharat';
  const pageId = options.pageId || process.env.FB_PAGE_ID || '1289712677569663';

  if (cleanExisting) {
    clearDirectoryContents(exportDir);
  }
  fs.mkdirSync(exportDir, { recursive: true });

  const manifestReels = [];
  const captionBlocks = [
    '====================================================',
    `EXAM IQ BHARAT — META BUSINESS SUITE SCHEDULE PACK`,
    `Generated: ${new Date().toISOString()}`,
    `Total Reels: ${entries.length}`,
    'Upload via: https://business.facebook.com -> Planner / Create Reel',
    '====================================================',
    '',
  ];

  const answerKeyLines = [
    '====================================================',
    'CREATOR ANSWER KEY (Only for replying/pinning later)',
    '====================================================',
  ];

  entries.forEach((entry, idx) => {
    const item = entry.item || {};
    const metadata = entry.metadata || buildReelMetadata(item);
    const num = String(idx + 1).padStart(2, '0');
    const filename = `${num}_${sanitizeStem(item.id, idx + 1)}.mp4`;
    const destPath = path.join(exportDir, filename);
    const suggestedSchedule = formatIstScheduleSlot(scheduleStartDate, idx);

    if (entry.videoPath && fs.existsSync(entry.videoPath)) {
      fs.copyFileSync(entry.videoPath, destPath);
    }

    manifestReels.push({
      index: idx + 1,
      id: item.id || null,
      category: item.category || null,
      topic: item.topic || null,
      filename,
      exportedVideoPath: destPath,
      sourceVideoPath: entry.videoPath || null,
      suggestedSchedule,
      title: metadata.title,
      description: metadata.description,
      tags: metadata.tags,
      pinnedComment: metadata.pinnedComment,
      answerKey: metadata.answerKey,
    });

    captionBlocks.push(
      `----------------------------------------------------`,
      `REEL ${num}: ${filename}`,
      `Suggested Schedule: ${suggestedSchedule}`,
      `Category: ${item.category || 'gk'} | ID: ${item.id || num}`,
      ``,
      `[Copy Caption / Description for Meta Business Suite]`,
      metadata.description,
      ``,
      `[Copy First Engagement Comment]`,
      metadata.pinnedComment,
      ``
    );

    answerKeyLines.push(`${num}. ${filename} -> ${metadata.answerKey || 'N/A'}`);
  });

  const captionsContent = [...captionBlocks, ...answerKeyLines, ''].join('\n');
  const captionsPath = path.join(exportDir, 'captions.txt');
  fs.writeFileSync(captionsPath, captionsContent, 'utf8');

  const manifest = {
    generatedAt: new Date().toISOString(),
    pageName,
    pageId,
    totalReels: manifestReels.length,
    uploadUrl: 'https://business.facebook.com',
    reels: manifestReels,
  };
  const manifestPath = path.join(exportDir, 'schedule_manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {
    exportDir,
    captionsPath,
    manifestPath,
    items: manifestReels,
  };
}

/**
 * Redacts the Telegram bot token from error text so secrets never leak to logs.
 */
function redactToken(text, botToken) {
  const msg = String(text || '');
  if (!botToken) return msg;
  return msg.split(botToken).join('[REDACTED_BOT_TOKEN]');
}

/**
 * Splits text into chunks below Telegram's 4096-char message limit.
 */
function splitTelegramText(text, maxLen = TELEGRAM_MESSAGE_LIMIT - 100) {
  const lines = String(text || '').split('\n');
  const chunks = [];
  let current = '';

  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > maxLen) {
      if (current) chunks.push(current);
      current = line.length > maxLen ? line.slice(0, maxLen) : line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * Delivers exported Reel MP4 files and copyable Meta Business Suite captions to Telegram.
 */
async function sendToTelegram(entries = [], options = {}) {
  const botToken = (options.botToken !== undefined ? options.botToken : process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (options.chatId !== undefined ? options.chatId : process.env.TELEGRAM_CHAT_ID || '').trim();

  if (!botToken || !chatId) {
    console.log('[TelegramDeliverer] ℹ️ Telegram skipped (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID not configured).');
    return {
      sent: false,
      skipped: true,
      sentCount: 0,
      total: entries.length,
      reason: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured',
    };
  }

  const httpClient = options.httpClient || axios;
  const delayMs = options.delayMs !== undefined ? options.delayMs : 1200;
  const baseUrl = `https://api.telegram.org/bot${botToken}`;

  let sentCount = 0;
  const errors = [];
  const answerLines = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const item = entry.item || {};
    const metadata = entry.metadata || buildReelMetadata(item);
    const videoFile = entry.exportedVideoPath && fs.existsSync(entry.exportedVideoPath)
      ? entry.exportedVideoPath
      : entry.videoPath;
    const filename = entry.filename || (videoFile ? path.basename(videoFile) : `reel_${i + 1}.mp4`);
    const scheduleLabel = entry.suggestedSchedule || formatIstScheduleSlot(new Date(), i);
    const num = String(i + 1).padStart(2, '0');

    answerLines.push(`${num}. ${filename} -> ${metadata.answerKey || 'N/A'}`);

    if (!videoFile || !fs.existsSync(videoFile)) {
      errors.push({ index: i + 1, filename, error: 'Video file missing on disk' });
      continue;
    }

    const fileSize = fs.statSync(videoFile).size;
    if (fileSize > TELEGRAM_VIDEO_MAX_BYTES) {
      errors.push({ index: i + 1, filename, error: `Video size (${fileSize} bytes) exceeds Telegram 50MB limit` });
      continue;
    }

    const fullCaption = [
      `🎬 Reel ${num}: ${filename}`,
      `📅 Schedule: ${scheduleLabel}`,
      '',
      metadata.description,
    ].join('\n');

    const videoCaption = fullCaption.length <= TELEGRAM_CAPTION_LIMIT
      ? fullCaption
      : fullCaption.slice(0, TELEGRAM_CAPTION_LIMIT - 3) + '...';

    try {
      const form = new NodeFormData();
      form.append('chat_id', chatId);
      form.append('supports_streaming', 'true');
      form.append('caption', videoCaption);
      form.append('video', fs.createReadStream(videoFile), { filename });

      await httpClient.post(`${baseUrl}/sendVideo`, form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000,
      });

      if (fullCaption.length > TELEGRAM_CAPTION_LIMIT) {
        await httpClient.post(
          `${baseUrl}/sendMessage`,
          {
            chat_id: chatId,
            text: `📝 Full Caption (${filename}):\n\n${metadata.description}`,
            disable_web_page_preview: true,
          },
          { timeout: 30000 }
        );
      }

      sentCount++;
      console.log(`[TelegramDeliverer] ✅ Sent Reel ${num}/${entries.length} (${filename}) to Telegram.`);
    } catch (err) {
      const safeErr = redactToken(err.response?.data ? JSON.stringify(err.response.data) : err.message, botToken);
      console.error(`[TelegramDeliverer] ❌ Failed sending ${filename}:`, safeErr);
      errors.push({ index: i + 1, filename, error: safeErr });
    }

    if (delayMs > 0 && i < entries.length - 1) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }

  // Send compact batch footer with First Comment & Creator Answer Key
  if (entries.length > 0 && sentCount > 0) {
    const sampleComment = entries[0]?.metadata?.pinnedComment || buildReelMetadata(entries[0]?.item).pinnedComment;
    const summaryText = [
      `✅ Exam IQ Bharat Batch Ready (${sentCount}/${entries.length} Reels)`,
      `🔗 Meta Business Suite: https://business.facebook.com`,
      '',
      `💬 Pinned Comment (Copy & Paste):`,
      sampleComment,
      '',
      `🔐 Creator Answer Key:`,
      ...answerLines,
    ].join('\n');

    for (const chunk of splitTelegramText(summaryText)) {
      try {
        await httpClient.post(
          `${baseUrl}/sendMessage`,
          { chat_id: chatId, text: chunk, disable_web_page_preview: true },
          { timeout: 30000 }
        );
      } catch (err) {
        const safeErr = redactToken(err.message, botToken);
        console.warn('[TelegramDeliverer] ⚠️ Summary message failed:', safeErr);
      }
    }
  }

  return {
    sent: sentCount > 0,
    skipped: false,
    sentCount,
    total: entries.length,
    errors,
  };
}

module.exports = {
  DEFAULT_EXPORT_DIR,
  TELEGRAM_CAPTION_LIMIT,
  buildReelMetadata,
  createExportBundle,
  formatIstScheduleSlot,
  sendToTelegram,
  splitTelegramText,
};
