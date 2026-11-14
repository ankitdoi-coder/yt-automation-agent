require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { YouTubeAutomationAgent } = require('../index');
const { Logger } = require('../utils/logger');

const logger = new Logger('DailyRunner');

// Optimal Educational Upload Schedule for Indian Audience (IST)
// Optimal Educational Upload Schedule for Indian Audience (IST)
// 4 Daily Slots: 2 Long Videos (50 PYQs each) + 2 Shorts (9:16 Vertical)
// 1. Slot 1 (09:30 AM IST) - Morning Rapid Revision (Shorts, 9:16 Vertical)
// 2. Slot 2 (02:00 PM IST) - Afternoon Study Masterclass (Long Video 1, 50 Questions)
// 3. Slot 3 (07:00 PM IST) - Evening Prime Exam Class (Long Video 2, 50 Questions)
// 4. Slot 4 (09:30 PM IST) - Bedtime Rapid Scroll (Shorts, 9:16 Vertical)
// High-Retention Focused Daily Schedule for Algorithmic Growth:
function loadGrowthConfig() {
  try {
    const p = path.resolve(__dirname, '..', 'config', 'growth.json');
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8'));
    }
  } catch (_) {}
  return {};
}

// High-Yield Vertical Shorts Schedule (07:50 IST Morning ~08:00 AM Public & 16:50 IST Evening ~05:00 PM Public)
// 20-min Long videos are paused from daily automation to protect channel Domain Quality Score
const SCHEDULE_SLOTS = [
  {
    id: 'slot1',
    name: 'Morning Prime Revision (Shorts 1, 9:16 Vertical)',
    timeIST: '07:50',
    style: 'quiz_short_no_image',
    length: 'short',
    contentType: 'quiz_short_no_image',
    defaultTopic: 'General Science: Human Body & Biology Important Questions | Top 10 Science GK Shorts'
  },
  {
    id: 'slot2',
    name: 'Evening Prime Revision (Shorts 2, 9:16 Vertical)',
    timeIST: '16:50',
    style: 'quiz_short_no_image',
    length: 'short',
    contentType: 'quiz_short_no_image',
    defaultTopic: 'Indian Polity & Constitution: Fundamental Rights & Key Articles | Top 10 Polity GK Shorts'
  }
];

// High-Yield 10-Question Shorts Topic Pools (Sequential Parts across High-Demand Exam Categories)
const SLOT_TOPIC_POOLS = {
  slot1: [
    'General Science: Human Body & Biology Important Questions | Top 10 Science GK Shorts',
    'Vitamin, Chemical Names & Deficiency Diseases | Top 10 General Science GK Shorts',
    'Human Blood Circulation, Heart & Organs | Top 10 Biology GK Shorts',
    'Acids, Bases, pH Scale & Everyday Chemistry | Top 10 Chemistry GK Shorts',
    'SI Units, Physics Inventions & Laws | Top 10 Physics GK Shorts',
    'Indian Polity: Fundamental Rights & Key Constitutional Articles | Top 10 Polity GK Shorts',
    'Cell Biology, Genetics & Human Diseases | Top 10 Science GK Shorts'
  ],
  slot2: [
    'Indian Polity & Constitution: Key Articles & Amendments | Top 10 Polity GK Shorts',
    'Modern Indian History: 1857 Revolt & Freedom Struggle | Top 10 History GK Shorts',
    'Static GK: National Parks, Tiger Reserves & Wildlife Sanctuaries | Top 10 Static GK Shorts',
    'Indian Geography: Major Rivers, Dams & Mountain Passes | Top 10 Geography GK Shorts',
    'Ancient History: Maurya, Gupta Empire & Harappan Civilization | Top 10 History GK Shorts',
    'Famous Books & Authors + Classical Dances of India | Top 10 Static GK Shorts',
    'First in India & Important Constitutional Schedules | Top 10 Static GK Shorts'
  ],
  slot3: [
    'Static GK Marathon: भारत के राष्ट्रीय उद्यान, लोक नृत्य, नदियां व बांध: 50 प्रश्न | Static GK Class',
    'Lucent GK Top 50 Most Repeated Questions | SSC CGL, Railway NTPC, Police Exam GK',
    'रसायन एवं भौतिक विज्ञान (Chemistry & Physics): 50 रामबाण प्रश्न | General Science GK Marathon',
    'भारत एवं विश्व का भूगोल: नदियां, पर्वत, दर्रे और सौरमंडल के 50 महत्वपूर्ण प्रश्न | Geography GK',
    'प्रमुख पुस्तकें और लेखक, दिवस एवं महत्वपूर्ण संस्थान: Top 50 Static GK Marathon',
    'भारतीय इतिहास के 50 महत्वपूर्ण युद्ध, संधियां व राष्ट्रीय आंदोलन | History GK Marathon'
  ],
  slot4: [
    'Books and Authors Important Questions | Top 10 Static GK Shorts',
    'National Parks of India Important Questions | Top 10 Static GK Shorts',
    'Classical Dances and Festivals of India | Top 10 Static GK Shorts',
    'Indian Constitution Important Articles | Top 10 Polity GK Shorts',
    'First in India (Male & Female) GK | Top 10 Static GK Shorts',
    'Major Dams and River Cities of India | Top 10 Geography GK Shorts',
    'Gupta and Maurya Empire Important Questions | Top 10 History GK Shorts'
  ]
};

function detectCategory(topic) {
  const t = String(topic || '').toLowerCase();
  if (/polity|संविधान|constitution|article|अनुच्छेद/i.test(t)) return 'polity';
  if (/science|विज्ञान|biology|bio|chem|physics|शरीर|vitamin/i.test(t)) return 'science';
  if (/history|इतिहास|मौर्य|गुप्त|1857|मुगल/i.test(t)) return 'history';
  if (/geography|भूगोल|river|dam|नदी|बांध|पर्वत/i.test(t)) return 'geography';
  return 'static';
}

function getSlotDefaultTopic(slot) {
  const pool = SLOT_TOPIC_POOLS[slot.id];
  if (pool && pool.length > 0) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const diff = now - startOfYear;
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    const offset = slot.id === 'slot1' ? 0 : slot.id === 'slot2' ? 1 : slot.id === 'slot3' ? 2 : 3;
    const index = (dayOfYear + offset) % pool.length;
    return pool[index];
  }
  return slot.defaultTopic;
}

function formatSlotTopic(cleanBase, suffix = '', maxLen = 200) {
  if (!suffix) {
    return cleanBase.slice(0, maxLen).trim();
  }
  const maxBaseLen = maxLen - suffix.length;
  if (cleanBase.length <= maxBaseLen) {
    return `${cleanBase}${suffix}`.trim();
  }
  let truncatedBase = cleanBase.slice(0, Math.max(20, maxBaseLen)).trim();
  truncatedBase = truncatedBase.replace(/[\s\-_:|]+$/, '');
  const combined = `${truncatedBase}${suffix}`.trim();
  return combined.length > maxLen ? combined.slice(0, maxLen).trim() : combined;
}

// Differentiates each daily slot so parallel/sequential videos NEVER generate the same questions
function resolveSlotTopic(slot, baseTopic) {
  if (!baseTopic || !baseTopic.trim()) {
    return formatSlotTopic(getSlotDefaultTopic(slot), '', 200);
  }
  const cleanBase = baseTopic.trim();

  // If topic is broad science / general science
  if (/science|विज्ञान|bio|biology|chem|physics/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - Biology & Human Body: Top 10 Science GK Shorts');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - Physics & Chemistry: Top 10 Science GK Shorts');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - रसायन विज्ञान व भौतिक विज्ञान: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - Scientific Inventions & Units: Top 10 GK Shorts');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // If topic is static GK / विविध / पुस्तकें / राष्ट्रीय उद्यान / नृत्य
  if (/static|विविध|पुस्तक|author|book|उद्यान|park|dance|नृत्य|त्यौहार|festival/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - Books, Parks & Static GK: Top 10 Shorts');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - National Parks, Folk Dances & Heritage: Top 10 Static GK Shorts');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - लोक नृत्य, प्रमुख त्यौहार व दिवस: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - First in India: Top 10 Static GK Shorts');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // If topic is history / इतिहास / संविधान / polity
  if (/history|इतिहास|संविधान|polity/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - Maurya, Gupta & 1857 Revolt: Top 10 History GK Shorts');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - Fundamental Rights & Constitutional Articles: Top 10 Polity GK Shorts');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - आधुनिक भारत का इतिहास एवं भारतीय संविधान: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - Key Indian Constitution Articles: Top 10 Polity GK Shorts');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // If topic is geography / भूगोल
  if (/geography|भूगोल/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - Major Dams, Rivers & Lakes: Top 10 Geography GK Shorts');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - Mountain Passes, National Parks & Borders: Top 10 Geography GK Shorts');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - विश्व का भूगोल, सौरमंडल व महाद्वीप: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - Indian States & Passes: Top 10 GK Shorts');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // General custom topic - give distinct sub-angles per slot
  switch (slot.id) {
    case 'slot1':
      return formatSlotTopic(cleanBase, ': Top 10 Rapid-Fire Exam GK Questions #shorts');
    case 'slot2':
      return formatSlotTopic(cleanBase, ': Top 10 Most Repeated Exam Questions #shorts');
    case 'slot3':
      return formatSlotTopic(cleanBase, ': भाग 2 - 50 अति महत्वपूर्ण प्रश्न (शाम की प्राइम क्लास)');
    case 'slot4':
      return formatSlotTopic(cleanBase, ': Top 10 Difficult GK Questions #shorts');
    default:
      return formatSlotTopic(cleanBase, ` - ${slot.name}`);
  }
}

function calculateSlotPublishDate(timeIST) {
  const [hours, minutes] = timeIST.split(':').map(Number);
  const now = new Date();

  // IST is UTC + 5.5 hours
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffsetMs);

  const targetIST = new Date(nowIST);
  targetIST.setUTCHours(hours, minutes, 0, 0);

  const targetUTC = new Date(targetIST.getTime() - istOffsetMs);
  const isPast = targetUTC.getTime() <= now.getTime();

  // Direct public publishing (default): whenever cron/pipeline runs, publish immediately!
  // Never schedule into tomorrow if the trigger is slightly late or server delayed.
  const scheduleInAdvance = process.env.SCHEDULE_IN_ADVANCE === 'true';
  if (!scheduleInAdvance) {
    return {
      targetUTC: now,
      isoString: now.toISOString(),
      isPast: true,
      timeIST
    };
  }

  // Only if explicitly instructed to schedule in advance:
  if (isPast) {
    targetIST.setUTCDate(targetIST.getUTCDate() + 1);
    const nextUTC = new Date(targetIST.getTime() - istOffsetMs);
    return {
      targetUTC: nextUTC,
      isoString: nextUTC.toISOString(),
      isPast: false,
      timeIST
    };
  }

  return {
    targetUTC,
    isoString: targetUTC.toISOString(),
    isPast: false,
    timeIST
  };
}


async function run() {
  logger.info('🚀 Starting Daily Educational YouTube Pipeline (2 Long + 2 Shorts)...');
  const agent = new YouTubeAutomationAgent();

  const initialized = await agent.initialize();
  if (!initialized) {
    throw new Error('Agent initialization failed. Check credentials and configuration.');
  }

  if (agent.setupRequired) {
    const missing = agent.credentials?.getMissingCredentials?.() || [];
    throw new Error(`Setup is required: Missing credentials for ${missing.join(', ') || 'YouTube or AI provider'}. Verify your GitHub Secrets.`);
  }

  // Ensure fully automated publishing without manual approval bottlenecks
  await agent.db.setSetting('approval_required', 'false');

  // Determine which slots to run (respect cadence.maxShortsPerDay from config/growth.json)
  const growth = loadGrowthConfig();
  const maxShortsPerDay = Math.max(1, Number(growth.cadence?.maxShortsPerDay ?? 2));
  const minHoursBetweenUploads = Math.max(6, Number(growth.cadence?.minHoursBetweenUploads ?? 6));
  const targetSlotInput = (process.env.TARGET_SLOT || 'all').toLowerCase();
  const istHourNow = new Date(Date.now() + 5.5 * 60 * 60 * 1000).getUTCHours();
  const timeMatchedSlot = istHourNow < 13 ? SCHEDULE_SLOTS[0] : (SCHEDULE_SLOTS[1] || SCHEDULE_SLOTS[0]);
  let slotsToRun = process.env.RUN_ALL_SLOTS === 'true'
    ? SCHEDULE_SLOTS.slice(0, maxShortsPerDay)
    : [timeMatchedSlot];

  if (!targetSlotInput.startsWith('all')) {
    const matched = SCHEDULE_SLOTS.filter(s =>
      targetSlotInput.includes(s.id) ||
      s.id === targetSlotInput ||
      s.style === targetSlotInput
    );
    if (matched.length > 0) {
      slotsToRun = matched;
    } else {
      logger.warn(`Unknown TARGET_SLOT "${process.env.TARGET_SLOT}", defaulting to configured slots (${slotsToRun.length})`);
    }
  }

  logger.info(`📋 Preparing ${slotsToRun.length} video(s) for today's publishing calendar:`);
  slotsToRun.forEach(s => logger.info(`  • [${s.timeIST} IST] ${s.name} (${s.style})`));

  // Check recent YouTube uploads to prevent accidental duplicate videos for the same slot today
  let recentUploads = [];
  try {
    const youtube = agent.agents?.publishing?.youtube;
    if (youtube) {
      const channelRes = await youtube.channels.list({ part: 'contentDetails', mine: true });
      const uploadsPlaylistId = channelRes?.data?.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
      if (uploadsPlaylistId) {
        const playlistRes = await youtube.playlistItems.list({
          part: 'snippet',
          playlistId: uploadsPlaylistId,
          maxResults: 50
        });
        recentUploads = playlistRes?.data?.items || [];
      }
    }
  } catch (err) {
    logger.warn(`Could not check recent YouTube uploads for deduplication: ${err.message}`);
  }

  // Live sync category parts with YouTube uploads to guarantee sequential non-repeating numbers
  if (recentUploads.length > 0 && agent.db?.syncWithChannelVideos) {
    try {
      await agent.db.syncWithChannelVideos(recentUploads);
      logger.info('🔄 Live synchronized category series part numbers with YouTube channel uploads!');
    } catch (syncErr) {
      logger.warn(`Could not sync category series with channel uploads: ${syncErr.message}`);
    }
  }

  const results = [];
  const skippedSlots = [];
  const failedSlots = [];

  for (let i = 0; i < slotsToRun.length; i++) {
    const slot = slotsToRun[i];
    const slotTiming = calculateSlotPublishDate(slot.timeIST);

    // Enforce 1 Short per day / minHoursBetweenUploads gate across ALL Short uploads
    const isForceRun = process.env.FORCE_RUN === 'true' || process.env.FORCE_RUN === true;
    if (recentUploads.length > 0 && !isForceRun && targetSlotInput.startsWith('all')) {
      const recentShorts = recentUploads.filter(item => {
        const publishedAt = new Date(item.snippet?.publishedAt || 0).getTime();
        const ageHours = (Date.now() - publishedAt) / (1000 * 60 * 60);
        if (ageHours > 20) return false;
        const title = (item.snippet?.title || '').toLowerCase();
        return title.includes('#short') || /\btop\s*[35]\b|mcq\b|gk quiz|static gk|general science|polity|history/i.test(title);
      });

      const recentCooldownShort = recentShorts.find(item => ((Date.now() - new Date(item.snippet?.publishedAt || 0).getTime()) / (1000 * 60 * 60)) <= minHoursBetweenUploads);
      const alreadyUploaded = recentCooldownShort || (recentShorts.length >= maxShortsPerDay ? recentShorts[0] : null);

      if (alreadyUploaded) {
        logger.info(`⏭️ Skipping ${slot.name} (${slot.id}): Daily Short quota (${recentShorts.length}/${maxShortsPerDay} within ${minHoursBetweenUploads}h) already filled by "${alreadyUploaded.snippet?.title}". (Set FORCE_RUN=true to override).`);
        skippedSlots.push({ slot: slot.name, timeIST: slot.timeIST, title: alreadyUploaded.snippet?.title });
        continue;
      }
    }

    logger.info(`\n────────────────────────────────────────────────────────────`);
    logger.info(`🎬 Generating Video ${i + 1}/${slotsToRun.length}: ${slot.name}`);
    logger.info(`⏰ Target Publish Window: ${slot.timeIST} IST | Status: ${(process.env.PUBLISH_IMMEDIATELY !== 'false' || slotTiming.isPast) ? 'Direct Public Upload' : 'Scheduled Auto-Public'}`);
    logger.info(`────────────────────────────────────────────────────────────`);

    try {
      // Prevent back-to-back duplicate categories: check last uploaded Short on channel
      const lastShort = recentUploads.find(item => {
        const title = (item.snippet?.title || '').toLowerCase();
        return title.includes('#short') || /top\s*\d+|mcq|gk/i.test(title);
      });
      const lastCat = lastShort ? detectCategory(lastShort.snippet?.title) : null;

      let slotTopic = resolveSlotTopic(slot, process.env.VIDEO_TOPIC);
      let cat = detectCategory(slotTopic);

      // If slotTopic would repeat the exact same category as the last upload, rotate to alternate high-demand category!
      if (lastCat && cat === lastCat && !process.env.VIDEO_TOPIC) {
        const categoryCycle = ['polity', 'science', 'history', 'geography', 'static'];
        const currentIdx = categoryCycle.indexOf(cat);
        const nextCat = categoryCycle[(currentIdx + 1) % categoryCycle.length];
        logger.info(`🔄 Last upload was "${cat}". Alternating category to "${nextCat}" to prevent consecutive category fatigue.`);
        const altTopics = {
          polity: 'Indian Polity & Constitution: Fundamental Rights & Key Articles | Top 10 Polity GK Shorts',
          science: 'General Science: Human Body & Biology Important Questions | Top 10 Science GK Shorts',
          history: 'Indian History: Modern India & 1857 Revolt Important Questions | Top 10 History GK Shorts',
          geography: 'Indian Geography: Major Rivers, Dams & Mountain Passes | Top 10 Geography GK Shorts',
          static: 'Static GK: National Parks, Tiger Reserves & Wildlife Sanctuaries | Top 10 Static GK Shorts'
        };
        slotTopic = altTopics[nextCat] || slotTopic;
        cat = nextCat;
      }

      const isShortSlot = Boolean(slot.length === 'short' || String(slot.style || '').includes('short'));
      const partInfo = isShortSlot && agent.db?.getNextCategoryPart
        ? await agent.db.getNextCategoryPart(cat)
        : null;
      const partNumber = partInfo ? partInfo.nextPart : 1;

      logger.info(`📌 Category: ${cat.toUpperCase()} | Sequential Part Counter: Part ${partNumber}`);

      const job = await agent.startGenerationJob({
        topic: slotTopic,
        style: slot.style,
        length: slot.length,
        partNumber,
        category: cat,
        source: 'scheduler'
      });

      logger.info(`Job ${job.id} queued. Rendering script, narration & high-CTR visuals...`);
      const finished = await agent.waitForGenerationJob(job.id);

      if (finished.status === 'failed') {
        logger.error(`Generation failed for ${slot.name}: ${finished.error}`);
        failedSlots.push({ slot: slot.name, timeIST: slot.timeIST, error: finished.error });
        continue;
      }

      const productionId = finished.production_id || finished.productionId || finished.contentId;
      if (!productionId) {
        throw new Error(`Generation completed but production_id not found on job ${job.id}`);
      }

      logger.success(`✅ Generation complete! Production ID: ${productionId}`);

      // Publish / Schedule directly to YouTube
      if (agent.agents?.publishing) {
        logger.info(`Uploading to YouTube with target schedule: ${slotTiming.isoString}...`);

        const targetPrivacy = process.env.DEFAULT_PRIVACY_STATUS || 'public';
        const directPublic = process.env.SCHEDULE_IN_ADVANCE !== 'true'; // Default is always instant direct public
        const immediateIso = new Date().toISOString();
        const entry = await agent.db.getLatestScheduleEntry?.(productionId);
        if (entry) {
          entry.publishTime = directPublic ? immediateIso : slotTiming.isoString;
          entry.metadata = {
            ...entry.metadata,
            privacyStatus: targetPrivacy
          };
          if (directPublic) {
            delete entry.metadata.publishAt;
          }
          // Strictly enforce 100% English title for YouTube Shorts
          if (isShortSlot && (/[\u0900-\u097F]/.test(entry.title || '') || /[\u0900-\u097F]/.test(entry.metadata?.seo?.title || ''))) {
            const { enforceEnglishShortTitle } = require('../utils/youtube-metadata-validator');
            entry.title = enforceEnglishShortTitle(entry.title || entry.metadata?.seo?.title, entry.metadata);
            if (entry.metadata?.seo) {
              entry.metadata.seo.title = entry.title;
            }
          }
          await agent.db.saveScheduleEntry(entry);
        }
        if (Array.isArray(agent.agents.publishing.publishQueue)) {
          const queueEntry = agent.agents.publishing.publishQueue.find(e => e.productionId === productionId || e.id === productionId);
          if (queueEntry) {
            queueEntry.publishTime = directPublic ? immediateIso : slotTiming.isoString;
            queueEntry.metadata = {
              ...queueEntry.metadata,
              privacyStatus: targetPrivacy
            };
            if (directPublic) {
              delete queueEntry.metadata.publishAt;
            }
          }
        }

        const publishResult = await agent.agents.publishing.publishContent(productionId, {
          publishNow: directPublic
        });

        const statusMsg = directPublic
          ? `PUBLIC NOW: ${publishResult.youtubeUrl || publishResult.youtubeId}`
          : `SCHEDULED for ${slot.timeIST} IST: ${publishResult.youtubeUrl || publishResult.youtubeId}`;

        // Advance sequential category part counter in DB upon successful upload
        if (isShortSlot && agent.db?.incrementCategoryPart) {
          try {
            await agent.db.incrementCategoryPart(cat, publishResult.youtubeId || null);
            logger.success(`📈 Category "${cat}" advanced in DB (now at Part ${partNumber})`);
          } catch (incErr) {
            logger.warn(`Could not advance category part counter: ${incErr.message}`);
          }
        }

        logger.success(`🎉 Video Uploaded! ${statusMsg}`);
        results.push({
          slot: slot.name,
          timeIST: slot.timeIST,
          url: publishResult.youtubeUrl || publishResult.youtubeId,
          status: (directPublic || slotTiming.isPast) ? 'Published Public' : 'Scheduled Auto-Public'
        });
      }
    } catch (err) {
      logger.error(`Failed to process ${slot.name}: ${err.message}`, err);
      failedSlots.push({ slot: slot.name, timeIST: slot.timeIST, error: err.message });
    }
  }

  logger.info(`\n════════════════════════════════════════════════════════════`);
  logger.info(`📊 Daily Automation Summary (${results.length}/${slotsToRun.length} produced, ${skippedSlots.length} skipped):`);
  results.forEach(r => logger.info(`  ✅ [${r.timeIST} IST] ${r.slot} -> ${r.url} (${r.status})`));
  skippedSlots.forEach(s => logger.info(`  ⏭️ [${s.timeIST} IST] ${s.slot} -> Skipped (already published today: "${s.title}")`));
  failedSlots.forEach(f => logger.info(`  ❌ [${f.timeIST} IST] ${f.slot} -> Failed (${f.error})`));
  logger.info(`════════════════════════════════════════════════════════════`);

  if (failedSlots.length > 0) {
    throw new Error(`${failedSlots.length} scheduled video job(s) failed.`);
  }

  if (results.length === 0 && skippedSlots.length === slotsToRun.length) {
    logger.info('✨ All scheduled daily slots are already published and up to date for today. (Run with FORCE_RUN=true to regenerate).');
    process.exit(0);
  }

  process.exit(0);
}

run().catch(err => {
  logger.error(`❌ Pipeline exited with error: ${err.message}`);
  process.exit(1);
});
