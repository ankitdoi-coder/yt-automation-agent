/**
 * YouTube -> Instagram Daily Repurpose Pipeline (ExamIQ Bharat)
 *
 * Takes today's latest YouTube video/quiz item and adapts it for Instagram:
 * 1. Re-angles the opening hook from keyword-first (YouTube SEO) to curiosity/challenge-first (Instagram scroll-stop)
 * 2. Humanizes the caption (strips AI tells)
 * 3. Lints the caption for Instagram's 125-char fold break
 * 4. Generates and saves a repurpose plan JSON
 *
 * Usage:
 *   node scripts/repurpose-daily.js
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { generatePlatformHooks } = require('../utils/platform-hook-adapter');
const { humanizeCaption } = require('../utils/caption-humanizer');
const { lintCaption, autoFixCaption, getHashtagsForCategory } = require('../utils/caption-linter');

const HISTORY_FILE = path.resolve(__dirname, '../facebook/data/history.json');
const REPURPOSE_PLAN_FILE = path.resolve(__dirname, '../facebook/data/repurpose-plan.json');

function loadHistory() {
  if (!fs.existsSync(HISTORY_FILE)) return { uploads: [] };
  try {
    const raw = fs.readFileSync(HISTORY_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? { uploads: parsed } : (parsed || { uploads: [] });
  } catch (err) {
    console.warn(`[RepurposeDaily] Could not read history.json (${err.message})`);
    return { uploads: [] };
  }
}

async function findLatestCandidate() {
  const history = loadHistory();
  const uploads = history.uploads || [];

  if (uploads.length > 0) {
    // Sort descending by uploadedAt
    const sorted = [...uploads].sort((a, b) => new Date(b.uploadedAt || 0).getTime() - new Date(a.uploadedAt || 0).getTime());
    return sorted[0];
  }

  // Fallback: pick from content-vault if history is empty
  const { ContentVault } = require('../facebook/content-vault');
  const vault = new ContentVault();
  const fresh = vault.getNextBatch(1);
  return fresh[0] || null;
}

async function repurposeDaily() {
  console.log('====================================================');
  console.log('🔄 YouTube -> Instagram Shorts Repurpose Pipeline');
  console.log('====================================================');

  const candidate = await findLatestCandidate();
  if (!candidate) {
    console.error('❌ No candidate video or quiz question found to repurpose.');
    return null;
  }

  console.log(`📌 Source Item: "${candidate.title || candidate.topic}" (${candidate.category || 'GK'})`);

  // 1. Generate adapted hooks
  const hooks = generatePlatformHooks(candidate);
  console.log(`\n🎯 Adapted Hooks:`);
  console.log(`   ▶️ YouTube:   "${hooks.youtube.adaptedHook}"`);
  console.log(`   📸 Instagram: "${hooks.instagram.adaptedHook}"`);
  console.log(`   👥 Facebook:  "${hooks.facebook.adaptedHook}"`);

  // 2. Build Instagram caption
  const rawCaption = `${hooks.instagram.adaptedHook}\n\n` +
    `क्या आप इस सवाल का सही जवाब जानते हैं? 🤔\n` +
    `कमेंट में अपना जवाब ज़रूर बताएं और अपनी तैयारी चेक करें!\n\n` +
    `👇 जवाब कमेंट करें!\n\n` +
    `${getHashtagsForCategory(candidate.category)}`;

  // 3. Humanize
  const humanized = humanizeCaption(rawCaption);
  let finalCaption = humanized.humanized;
  if (humanized.changesCount > 0) {
    console.log(`\n✍️ Caption Humanized: ${humanized.changesCount} AI tells removed`);
  }

  // 4. Lint & Auto-fix for Instagram fold break (125 chars)
  const lintResult = lintCaption(finalCaption);
  if (!lintResult.passed) {
    console.log(`⚠️ Caption Fold Warnings: ${lintResult.issues.concat(lintResult.warnings).join(', ')}`);
    const fixed = autoFixCaption(finalCaption, candidate);
    if (fixed.fixed) {
      finalCaption = fixed.caption;
      console.log(`✅ Caption auto-fixed (${fixed.changes.join(', ')})`);
    }
  }

  const foldPreview = finalCaption.slice(0, 125);
  console.log(`📱 Instagram Mobile Fold Preview (125 chars):`);
  console.log(`   "${foldPreview}"`);

  const plan = {
    repurposedAt: new Date().toISOString(),
    sourceItem: {
      id: candidate.id,
      title: candidate.title,
      topic: candidate.topic,
      category: candidate.category,
      originalHook: candidate.englishHook || candidate.title,
    },
    platformHooks: hooks,
    instagramDelivery: {
      overlayHookText: hooks.instagram.adaptedHook,
      caption: finalCaption,
      foldPreview,
      hashtags: getHashtagsForCategory(candidate.category),
      recommendedScheduleIST: '20:00 IST (Peak Instagram Reels Traffic)',
    },
  };

  const dir = path.dirname(REPURPOSE_PLAN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(REPURPOSE_PLAN_FILE, JSON.stringify(plan, null, 2), 'utf8');
  console.log(`\n💾 Repurpose plan saved -> ${REPURPOSE_PLAN_FILE}`);

  return plan;
}

if (require.main === module) {
  repurposeDaily().catch(err => {
    console.error('Fatal Repurpose Error:', err);
    process.exit(1);
  });
}

module.exports = { repurposeDaily, findLatestCandidate };
