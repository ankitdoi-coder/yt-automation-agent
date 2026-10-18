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
    defaultTopic: 'रामायण एवं महाभारत के 5 रोचक व महत्वपूर्ण सवाल | Ramayan & Mahabharat GK Shorts'
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
    defaultTopic: 'भारतीय संविधान, भूगोल एवं सामान्य विज्ञान: 50 रामबाण प्रश्न | Lucent GK Marathon'
  },
  {
    id: 'slot4',
    name: 'Bedtime Rapid Scroll (Shorts 2, 9:16 Vertical)',
    timeIST: '21:30',
    style: 'quiz_short_no_image',
    length: 'short',
    contentType: 'quiz_short_no_image',
    defaultTopic: 'भारत में प्रथम व रोचक सामान्य ज्ञान: Top 5 Most Repeated Questions | ExamIQ Bharat Shorts'
  }
];

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
    return formatSlotTopic(slot.defaultTopic, '', 200);
  }
  const cleanBase = baseTopic.trim();

  // If topic is broad science / general science
  if (/science|विज्ञान/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - भौतिक विज्ञान (Physics) के 5 रोचक सवाल | GK Shorts 1');
      case 'slot2':
        return formatSlotTopic(cleanBase, ' - जीव विज्ञान (Biology): 50 महत्वपूर्ण प्रश्न | Long Class 1');
      case 'slot3':
        return formatSlotTopic(cleanBase, ' - रसायन विज्ञान व पर्यावरण: 50 महत्वपूर्ण प्रश्न | Long Class 2');
      case 'slot4':
        return formatSlotTopic(cleanBase, ' - अंतरिक्ष, प्रमुख आविष्कार व वैज्ञानिक खोजें: Top 5 GK Shorts 2');
      default:
        return formatSlotTopic(cleanBase, ` (${slot.name})`);
    }
  }

  // If topic is history / इतिहास / संविधान / polity
  if (/history|इतिहास|संविधान|polity/i.test(cleanBase)) {
    switch (slot.id) {
      case 'slot1':
        return formatSlotTopic(cleanBase, ' - 1857 की क्रांति व स्वतंत्रता सेनानी: Top 5 GK Shorts 1');
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
        if (slot.id === 'slot1' && (title.includes('रामायण') || title.includes('महाभारत') || title.includes('ramayan'))) return true;
        if (slot.id === 'slot2' && (title.includes('इतिहास') || title.includes('history') || title.includes('प्राचीन') || title.includes('भाग 1') || title.includes('masterclass'))) return true;
        if (slot.id === 'slot3' && (title.includes('संविधान') || title.includes('भूगोल') || title.includes('polity') || title.includes('भाग 2') || title.includes('marathon') || title.includes('विज्ञान'))) return true;
        if (slot.id === 'slot4' && (title.includes('प्रथम') || title.includes('रोचक') || title.includes('top 5 gk') || title.includes('shorts 2'))) return true;
        return false;
      });

      if (alreadyUploaded) {
        logger.info(`⏭️ Skipping ${slot.name} (${slot.id}): Already uploaded to channel today: "${alreadyUploaded.snippet?.title}". (Set FORCE_RUN=true to override).`);
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
    }
  }

  logger.info(`\n════════════════════════════════════════════════════════════`);
  logger.info(`📊 Daily Automation Summary (${results.length}/${slotsToRun.length} succeeded):`);
  results.forEach(r => logger.info(`  ✅ [${r.timeIST} IST] ${r.slot} -> ${r.url} (${r.status})`));
  logger.info(`════════════════════════════════════════════════════════════`);

  if (results.length === 0 && slotsToRun.length > 0) {
    throw new Error('All scheduled video jobs failed.');
  }

  process.exit(0);
}

run().catch(err => {
  logger.error(`❌ Pipeline exited with error: ${err.message}`);
  process.exit(1);
});
