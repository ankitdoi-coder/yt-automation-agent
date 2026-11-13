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
 * Generates an algorithmic, high-CTR English/Hinglish curiosity hook (under 55 characters)
 * to prevent the 1.5s mobile scroll drop-off and qualify for Meta Reels Discovery Feed.
 */
function generateViralEnglishHook(item = {}) {
  if (item.englishHook && typeof item.englishHook === 'string' && item.englishHook.trim()) {
    return item.englishHook.trim();
  }

  const cat = String(item.category || '').toLowerCase();
  const title = String(item.title || '');
  const topic = String(item.topic || '');
  const q = String(item.question || '');

  // Math IQ category
  if (cat.includes('math') || title.includes('संख्या') || title.includes('गणित') || topic.includes('Math')) {
    if (title.includes('अभाज्य') || title.includes('Prime')) {
      return '99% Fail This! Only Even Prime Number? 🧠';
    }
    if (title.includes('प्रतिशत') || title.includes('Percent')) {
      return 'Can You Solve This Math Trap In 3s? ⚡';
    }
    return '99% People Fail This Quick Math Test! 🧠';
  }

  // Polity & Constitution
  if (cat.includes('pol') || topic.includes('संविधान') || topic.includes('Polity') || title.includes('अनुच्छेद') || title.includes('संशोधन')) {
    if (title.includes('अनुच्छेद') || q.includes('अनुच्छेद')) {
      return 'Can You Answer? Which Article Deals With This? 📜';
    }
    if (title.includes('संशोधन') || q.includes('संशोधन')) {
      return '99% Fail This Historic Amendment Quiz! ⚖️';
    }
    if (title.includes('राष्ट्रपति') || title.includes('राज्यपाल')) {
      return 'IAS Favorite: Minimum Age Requirement? 🏛️';
    }
    return '99% Fail This UPSC Polity Question! ⚖️';
  }

  // Geography & Ports/Rivers/Lakes
  if (cat.includes('geo') || cat.includes('stat') || topic.includes('भूगोल') || topic.includes('Geography') || title.includes('बंदरगाह') || title.includes('नदी')) {
    if (title.includes('बंदरगाह') || topic.includes('Port')) {
      return "India's 1st Free Port? (99% Guess Mumbai!) ⚓";
    }
    if (title.includes('नदी') || topic.includes('River')) {
      return "UPSC Trap: Name India's Longest River? 🌊";
    }
    if (title.includes('पठार') || title.includes('झील') || title.includes('पहाड़')) {
      return 'Only 1% Know This Geography Fact! 🗺️';
    }
    return '99% People Fail This Geography Question! 🌍';
  }

  // History & Freedom Struggle
  if (cat.includes('hist') || topic.includes('इतिहास') || topic.includes('History') || title.includes('गांधी') || title.includes('युद्ध')) {
    if (title.includes('दांडी') || title.includes('गांधी')) {
      return 'UPSC Trap: Where Did Dandi March Start? 🚶';
    }
    if (title.includes('युद्ध') || title.includes('Battle')) {
      return '90% Get This Wrong! Famous Battle Quiz ⚔️';
    }
    return 'History Trap: Can You Answer in 3 Seconds? 📜';
  }

  // Science (Physics, Chemistry, Biology)
  if (cat.includes('sci') || topic.includes('विज्ञान') || topic.includes('Science') || title.includes('कोशिका') || title.includes('रक्त')) {
    if (title.includes('कोशिका') || q.includes('Powerhouse')) {
      return 'Quick Science IQ: Powerhouse Of The Cell? ⚡';
    }
    if (title.includes('रक्त') || title.includes('विटामिन')) {
      return 'Only 1% Can Answer This Biology Quiz! 🔬';
    }
    return '99% Students Confused: Quick Science Test! 🧪';
  }

  // Default High-CTR Curiosity Hook
  return '99% People Fail This UPSC Question! 🎯';
}

/**
 * Builds standardized Facebook Reel title, description, tags, and engagement comment.
 */
function buildReelMetadata(item = {}) {
  const englishHook = generateViralEnglishHook(item);
  const safeTitle = item.title || 'सामान्य ज्ञान GK Quiz';
  const safeTopic = item.topic || 'सामान्य ज्ञान';
  const title = `${englishHook} | Exam IQ Bharat #Reels`;

  const baseTags = Array.isArray(item.tags)
    ? [...item.tags]
    : (typeof item.tags === 'string' && item.tags.trim()
      ? item.tags.trim().split(/\s+/)
      : ['#ExamIQ', '#GKQuiz', '#GeneralKnowledge', '#StaticGK', '#UPSC', '#SSCCGL']);

  if (!baseTags.some(t => /^#reels$/i.test(t))) baseTags.push('#Reels');
  if (!baseTags.some(t => /^#facebookreels$/i.test(t))) baseTags.push('#FacebookReels');
  if (!baseTags.some(t => /^#reelsviral$/i.test(t))) baseTags.push('#ReelsViral');

  const optionLines = (item.options || []).map(o => `${o.letter}) ${o.text}`);
  const description = [
    `🔥 ${englishHook}`,
    '',
    `🎯 ${safeTitle} | ${safeTopic}`,
    '',
    item.question ? `Q. ${item.question}` : '',
    ...optionLines,
    '',
    '👉 अपना जवाब (A, B, C या D) कमेंट बॉक्स में बताएं! Only 1% know the real answer 🏆',
    '⏱️ सही उत्तर वीडियो के अंत में देखें!',
    '🔔 रोज़ाना नए GK Tests के लिए Exam IQ Bharat को Follow करें!',
    '',
    baseTags.join(' '),
  ]
    .filter((line, idx, arr) => !(line === '' && (idx === 0 || arr[idx - 1] === '')))
    .join('\n');

  const pinnedComment =
    '💬 आपका उत्तर (A, B, C या D) क्या है? कमेंट करें! 90% लोग इसमें गलती करते हैं 👇';

  const answerKey = item.answerText || item.correctOption || '';

  return {
    title,
    englishHook,
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
  generateViralEnglishHook,
  sendToTelegram,
  splitTelegramText,
};
