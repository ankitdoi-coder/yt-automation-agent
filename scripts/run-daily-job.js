require('dotenv').config();
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
const SCHEDULE_SLOTS = [
  {
    id: 'slot1',
    name: 'Morning Rapid Revision (Shorts 1, 9:16 Vertical)',
    timeIST: '09:30',
    style: 'quiz_short_no_image',
    length: 'short',
    contentType: 'quiz_short_no_image',
    defaultTopic: 'सामान्य विज्ञान (General Science): जीव विज्ञान (Biology) के 5 अति महत्वपूर्ण प्रश्न | Science GK Shorts'
  },
  {
    id: 'slot2',
    name: 'Afternoon Study Masterclass (Long Video 1, 50 Questions)',
    timeIST: '14:00',
    style: 'quiz',
    length: 'medium',
    contentType: 'quiz',
    defaultTopic: 'प्राचीन एवं मध्यकालीन भारत का इतिहास: 50 सबसे महत्वपूर्ण प्रश्न | Indian History GK'
  },
  {
    id: 'slot3',
    name: 'Evening Prime Exam Class (Long Video 2, 50 Questions)',
    timeIST: '19:00',
    style: 'quiz',
    length: 'medium',
    contentType: 'quiz',
    defaultTopic: 'सामान्य विज्ञान एवं Static GK: 50 रामबाण प्रश्न | Lucent GK Marathon'
  },
  {
    id: 'slot4',
    name: 'Bedtime Rapid Scroll (Shorts 2, 9:16 Vertical)',
    timeIST: '21:30',
    style: 'quiz_short_no_image',
    length: 'short',
    contentType: 'quiz_short_no_image',
    defaultTopic: 'प्रमुख पुस्तकें और लेखक व भारत के राष्ट्रीय उद्यान: Top 5 Static GK Shorts'
  }
];

// High-Yield Syllabus Topic Pools for Daily Automated Rotation (Inspired by 1M+ views viral benchmarks)
// Prioritizes: General Science (Biology, Chemistry, Physics), High-Yield Static GK, and Indian History/Polity
const SLOT_TOPIC_POOLS = {
  slot1: [
    'सामान्य विज्ञान (General Science): जीव विज्ञान (Biology) के 5 अति महत्वपूर्ण प्रश्न | Science GK Shorts',
    'मानव शरीर (Human Anatomy) एवं विटामिन्स के 5 सबसे महत्वपूर्ण सवाल | Biology GK Shorts',
    'कोशिका (Cell) व मानव रोग: बार-बार पूछे जाने वाले 5 प्रश्न | General Science GK Shorts',
    'रसायन विज्ञान (Chemistry): अम्ल, क्षार और pH मान के 5 महत्वपूर्ण प्रश्न | Science GK Shorts',
    'भौतिक विज्ञान (Physics): प्रमुख मात्रक और आविष्कार के 5 प्रश्न | Science GK Shorts',
    'मानव रक्त परिसंचरण व प्रमुख अंग: Top 5 Biology GK Questions | Science Shorts',
    'विटामिन, उनके रासायनिक नाम व कमी से रोग: Top 5 Science GK Shorts'
  ],
  slot2: [
    'प्राचीन एवं मध्यकालीन भारत का इतिहास: 50 सबसे महत्वपूर्ण प्रश्न | Indian History GK Masterclass',
    'सामान्य विज्ञान (General Science): 50 सबसे महत्वपूर्ण प्रश्न (Biology + Physics + Chemistry) | Science GK',
    'भारतीय संविधान एवं राजव्यवस्था: 50 अति महत्वपूर्ण अनुच्छेद व प्रश्न | Indian Polity GK',
    'आधुनिक भारत का इतिहास एवं 1857 की क्रांति: 50 महत्वपूर्ण प्रश्न | Modern History GK Class',
    'जीव विज्ञान (Biology): कोशिका से मानव शरीर तक 50 महत्वपूर्ण प्रश्न | Lucent Science GK',
    'मौर्य वंश एवं गुप्त काल का स्वर्णिम इतिहास: 50 अति महत्वपूर्ण प्रश्न | Ancient History GK'
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
    'प्रमुख पुस्तकें और लेखक (Books and Authors): Top 5 Most Repeated Static GK | GK Shorts',
    'भारत के प्रमुख राष्ट्रीय उद्यान (National Parks of India): Top 5 Static GK Shorts',
    'भारत के प्रमुख लोक नृत्य एवं त्यौहार: Top 5 Most Repeated Questions | Static GK Shorts',
    'भारतीय संविधान के 5 अति महत्वपूर्ण अनुच्छेद: बार-बार पूछे जाने वाले सवाल | Polity GK Shorts',
    'भारत में प्रथम (First in India - Male & Female): Top 5 Static GK | GK Shorts',
    'प्रमुख नदियों के किनारे बसे शहर व प्रमुख बांध: Top 5 Static GK Shorts',
    'गुप्त वंश व मौर्य साम्राज्य: भारतीय इतिहास के 5 महत्वपूर्ण सवाल | History GK Shorts'
  ]
};

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
        return formatSlotTopic(cleanBase, ' - जीव विज्ञान (Biology) के 5 अति महत्वपूर्ण प्रश्न | Science GK Shorts 1');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - जीव विज्ञान (Biology) व मानव शरीर: 50 महत्वपूर्ण प्रश्न | Long Class 1');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - रसायन विज्ञान व भौतिक विज्ञान: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - प्रमुख वैज्ञानिक आविष्कार, मात्रक व खोजें: Top 5 GK Shorts 2');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // If topic is static GK / विविध / पुस्तकें / राष्ट्रीय उद्यान / नृत्य
  if (/static|विविध|पुस्तक|author|book|उद्यान|park|dance|नृत्य|त्यौहार|festival/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - प्रमुख पुस्तकें व लेखक: Top 5 Static GK Shorts 1');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - भारत के राष्ट्रीय उद्यान, बांध व नदियां: 50 महत्वपूर्ण प्रश्न | Long Class 1');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - लोक नृत्य, प्रमुख त्यौहार व दिवस: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - भारत में प्रथम (First in India): Top 5 Static GK Shorts 2');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // If topic is history / इतिहास / संविधान / polity
  if (/history|इतिहास|संविधान|polity/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - मौर्य काल, गुप्त वंश व 1857 की क्रांति: Top 5 GK Shorts 1');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - प्राचीन एवं मध्यकालीन भारत का इतिहास: 50 महत्वपूर्ण प्रश्न | Long Class 1');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - आधुनिक भारत का इतिहास एवं भारतीय संविधान: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - भारतीय संविधान के 5 अति महत्वपूर्ण अनुच्छेद: Top 5 GK Shorts 2');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // If topic is geography / भूगोल
  if (/geography|भूगोल/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - भारत के प्रमुख बांध व झीलें: Top 5 GK Shorts 1');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - भारत की नदियां, पर्वत व राष्ट्रीय उद्यान: 50 महत्वपूर्ण प्रश्न | Long Class 1');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - विश्व का भूगोल, सौरमंडल व महाद्वीप: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - भारत के राज्य, सीमाएं व प्रमुख दर्रे: Top 5 GK Shorts 2');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // General custom topic - give distinct sub-angles per slot
  switch (slot.id) {
    case 'slot1':
      return formatSlotTopic(cleanBase, ': Top 5 रोचक व परीक्षा उपयोगी सवाल | Rapid Fire GK Shorts 1');
    case 'slot2':
      return formatSlotTopic(cleanBase, ': भाग 1 - 50 अति महत्वपूर्ण प्रश्न (दोपहर मास्टरक्लास)');
    case 'slot3':
      return formatSlotTopic(cleanBase, ': भाग 2 - 50 अति महत्वपूर्ण प्रश्न (शाम की प्राइम क्लास)');
    case 'slot4':
      return formatSlotTopic(cleanBase, ': Top 5 मोस्ट रिपीटेड कठिन सवाल | ExamIQ Bharat Shorts 2');
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

  let targetUTC = new Date(targetIST.getTime() - istOffsetMs);

  // If slot time has already passed or is within 45 minutes, schedule for TOMORROW at that time!
  // This guarantees videos are ALWAYS scheduled in advance and never dumped into the past.
  if (targetUTC.getTime() <= (now.getTime() + 45 * 60 * 1000)) {
    targetIST.setUTCDate(targetIST.getUTCDate() + 1);
    targetUTC = new Date(targetIST.getTime() - istOffsetMs);
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

  // Determine which slots to run
  const targetSlotInput = (process.env.TARGET_SLOT || 'all').toLowerCase();
  let slotsToRun = SCHEDULE_SLOTS;

  if (!targetSlotInput.startsWith('all')) {
    const matched = SCHEDULE_SLOTS.filter(s =>
      targetSlotInput.includes(s.id) ||
      s.id === targetSlotInput ||
      s.style === targetSlotInput
    );
    if (matched.length > 0) {
      slotsToRun = matched;
    } else {
      logger.warn(`Unknown TARGET_SLOT "${process.env.TARGET_SLOT}", defaulting to all 4 daily slots`);
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
          maxResults: 15
        });
        recentUploads = playlistRes?.data?.items || [];
      }
    }
  } catch (err) {
    logger.warn(`Could not check recent YouTube uploads for deduplication: ${err.message}`);
  }

  const results = [];
  const skippedSlots = [];
  const failedSlots = [];

  for (let i = 0; i < slotsToRun.length; i++) {
    const slot = slotsToRun[i];
    const slotTiming = calculateSlotPublishDate(slot.timeIST);

    // If running full daily batch, skip slots already uploaded to YouTube in the last 18 hours
    const isForceRun = process.env.FORCE_RUN === 'true' || process.env.FORCE_RUN === true;
    if (recentUploads.length > 0 && !isForceRun && targetSlotInput.startsWith('all')) {
      const alreadyUploaded = recentUploads.find(item => {
        const publishedAt = new Date(item.snippet?.publishedAt || 0).getTime();
        const ageHours = (Date.now() - publishedAt) / (1000 * 60 * 60);
        if (ageHours > 18) return false;
        const title = (item.snippet?.title || '').toLowerCase();
        const isUploadShorts = title.includes('#shorts') || title.includes('#short') || /top\s*5\b|5\s*सवाल|5\s*mcq/i.test(title);
        const isUploadLong = !isUploadShorts && (/50\b|masterclass|marathon|क्लास|भाग\s*\d/i.test(title) || !title.includes('shorts'));

        if (slot.id === 'slot1') {
          // Slot 1 is Morning Rapid Revision Shorts (Science / Biology)
          return isUploadShorts && (title.includes('science') || title.includes('विज्ञान') || title.includes('biology') || title.includes('जीव विज्ञान') || title.includes('shorts 1') || title.includes('rapid revision'));
        }
        if (slot.id === 'slot2') {
          // Slot 2 is Afternoon Study Masterclass Long Video (50 Questions - History / Science)
          return isUploadLong && (title.includes('इतिहास') || title.includes('history') || title.includes('प्राचीन') || title.includes('मध्यकालीन') || title.includes('आधुनिक') || title.includes('भाग 1') || title.includes('masterclass'));
        }
        if (slot.id === 'slot3') {
          // Slot 3 is Evening Prime Exam Class Long Video (50 Questions - Marathon / Science / Polity)
          return isUploadLong && (title.includes('संविधान') || title.includes('भूगोल') || title.includes('polity') || title.includes('भाग 2') || title.includes('marathon') || title.includes('static') || title.includes('रामबाण'));
        }
        if (slot.id === 'slot4') {
          // Slot 4 is Bedtime Rapid Scroll Shorts (Static GK / First in India / Mixed)
          return isUploadShorts && (title.includes('प्रथम') || title.includes('रोचक') || title.includes('top 5 gk') || title.includes('shorts 2') || title.includes('static') || title.includes('पुस्तक') || title.includes('उद्यान') || title.includes('नृत्य'));
        }
        return false;
      });

      if (alreadyUploaded) {
        logger.info(`⏭️ Skipping ${slot.name} (${slot.id}): Already uploaded to channel today: "${alreadyUploaded.snippet?.title}". (Set FORCE_RUN=true to override).`);
        skippedSlots.push({ slot: slot.name, timeIST: slot.timeIST, title: alreadyUploaded.snippet?.title });
        continue;
      }
    }

    logger.info(`\n────────────────────────────────────────────────────────────`);
    logger.info(`🎬 Generating Video ${i + 1}/${slotsToRun.length}: ${slot.name}`);
    logger.info(`⏰ Target Publish Window: ${slot.timeIST} IST (UTC: ${slotTiming.isoString}) | Status: ${slotTiming.isPast ? 'Direct Public Upload' : 'Scheduled Auto-Public'}`);
    logger.info(`────────────────────────────────────────────────────────────`);

    try {
      const slotTopic = resolveSlotTopic(slot, process.env.VIDEO_TOPIC);
      const job = await agent.startGenerationJob({
        topic: slotTopic,
        style: slot.style,
        length: slot.length,
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

        // If target slot is future, update scheduled time before upload so YouTube native publishAt is set
        if (!slotTiming.isPast) {
          const entry = await agent.db.getLatestScheduleEntry?.(productionId);
          if (entry) {
            entry.publishTime = slotTiming.isoString;
            entry.metadata = {
              ...entry.metadata,
              privacyStatus: 'public'
            };
            await agent.db.saveScheduleEntry(entry);
          }
          if (Array.isArray(agent.agents.publishing.publishQueue)) {
            const queueEntry = agent.agents.publishing.publishQueue.find(e => e.productionId === productionId || e.id === productionId);
            if (queueEntry) {
              queueEntry.publishTime = slotTiming.isoString;
              queueEntry.metadata = {
                ...queueEntry.metadata,
                privacyStatus: 'public'
              };
            }
          }
        }

        const publishResult = await agent.agents.publishing.publishContent(productionId, {
          publishNow: slotTiming.isPast || process.env.PUBLISH_IMMEDIATELY === 'true'
        });

        const statusMsg = slotTiming.isPast || process.env.PUBLISH_IMMEDIATELY === 'true'
          ? `PUBLIC NOW: ${publishResult.youtubeUrl || publishResult.youtubeId}`
          : `SCHEDULED for ${slot.timeIST} IST: ${publishResult.youtubeUrl || publishResult.youtubeId}`;

        logger.success(`🎉 Video Uploaded! ${statusMsg}`);
        results.push({
          slot: slot.name,
          timeIST: slot.timeIST,
          url: publishResult.youtubeUrl || publishResult.youtubeId,
          status: slotTiming.isPast ? 'Published Public' : 'Scheduled Auto-Public'
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
