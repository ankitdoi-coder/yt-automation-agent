require('dotenv').config();
const { YouTubeAutomationAgent } = require('../index');
const { Logger } = require('../utils/logger');

const logger = new Logger('DailyRunner');

// Optimal Educational Upload Schedule for Indian Audience (IST)
const SCHEDULE_SLOTS = [
  {
    id: 'slot1',
    name: 'Morning Educational Quiz (Long-Form, 50 Questions)',
    timeIST: '11:30',
    style: 'quiz',
    length: 'medium',
    contentType: 'quiz'
  },
  {
    id: 'slot2',
    name: 'Lunch-Break Student Scroll (Shorts, 9:16 Vertical)',
    timeIST: '13:30',
    style: 'quiz_short',
    length: 'short',
    contentType: 'quiz_short'
  },
  {
    id: 'slot3',
    name: 'Evening Prime Study Block (Long-Form, 50 Questions)',
    timeIST: '16:30',
    style: 'quiz',
    length: 'medium',
    contentType: 'quiz'
  },
  {
    id: 'slot4',
    name: 'Post-Dinner Prime Scroll (Shorts, 9:16 Vertical)',
    timeIST: '20:00',
    style: 'quiz_short',
    length: 'short',
    contentType: 'quiz_short'
  }
];

function calculateSlotPublishDate(timeIST) {
  const [hours, minutes] = timeIST.split(':').map(Number);
  const now = new Date();

  // IST is UTC + 5.5 hours
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(now.getTime() + istOffsetMs);

  const targetIST = new Date(nowIST);
  targetIST.setUTCHours(hours, minutes, 0, 0);

  const targetUTC = new Date(targetIST.getTime() - istOffsetMs);

  // If slot time is in the past or within 15 minutes, upload as immediate PUBLIC
  const isPast = targetUTC.getTime() <= (now.getTime() + 15 * 60 * 1000);

  return {
    targetUTC,
    isoString: targetUTC.toISOString(),
    isPast,
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

  if (targetSlotInput !== 'all') {
    const matched = SCHEDULE_SLOTS.filter(s => s.id === targetSlotInput || s.style === targetSlotInput);
    if (matched.length > 0) {
      slotsToRun = matched;
    } else {
      logger.warn(`Unknown TARGET_SLOT "${targetSlotInput}", defaulting to all 4 daily slots`);
    }
  }

  logger.info(`📋 Preparing ${slotsToRun.length} video(s) for today's publishing calendar:`);
  slotsToRun.forEach(s => logger.info(`  • [${s.timeIST} IST] ${s.name} (${s.style})`));

  const results = [];

  for (let i = 0; i < slotsToRun.length; i++) {
    const slot = slotsToRun[i];
    const slotTiming = calculateSlotPublishDate(slot.timeIST);

    logger.info(`\n────────────────────────────────────────────────────────────`);
    logger.info(`🎬 Generating Video ${i + 1}/${slotsToRun.length}: ${slot.name}`);
    logger.info(`⏰ Target Publish Window: ${slot.timeIST} IST (UTC: ${slotTiming.isoString}) | Status: ${slotTiming.isPast ? 'Direct Public Upload' : 'Scheduled Auto-Public'}`);
    logger.info(`────────────────────────────────────────────────────────────`);

    try {
      const job = await agent.startGenerationJob({
        topic: process.env.VIDEO_TOPIC || null, // fresh trending topic via AI strategy
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

      logger.success(`✅ Generation complete! Production ID: ${finished.productionId}`);

      // Publish / Schedule directly to YouTube
      if (finished.productionId && agent.agents?.publishing) {
        logger.info(`Uploading to YouTube with target schedule: ${slotTiming.isoString}...`);

        // If target slot is future, update scheduled time before upload so YouTube native publishAt is set
        if (!slotTiming.isPast) {
          const entry = await agent.db.getLatestScheduleEntry?.(finished.productionId);
          if (entry) {
            entry.publishTime = slotTiming.isoString;
            entry.metadata = {
              ...entry.metadata,
              privacyStatus: 'public'
            };
            await agent.db.saveScheduleEntry(entry);
          }
        }

        const publishResult = await agent.agents.publishing.publishContent(finished.productionId, {
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
