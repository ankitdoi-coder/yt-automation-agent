require('dotenv').config();
const { YouTubeAutomationAgent } = require('../index');
const { Logger } = require('../utils/logger');

const logger = new Logger('DailyRunner');

async function run() {
  logger.info('🚀 Starting Daily Automated Video Pipeline...');
  const agent = new YouTubeAutomationAgent();

  const initialized = await agent.initialize();
  if (!initialized) {
    throw new Error('Agent initialization failed. Check credentials and configuration.');
  }

  if (agent.setupRequired) {
    const missing = agent.credentials?.getMissingCredentials?.() || [];
    throw new Error(`Setup is required: Missing credentials for ${missing.join(', ') || 'YouTube or AI provider'}. Verify your GitHub Secrets.`);
  }

  const topic = process.env.VIDEO_TOPIC || null;
  const style = process.env.VIDEO_STYLE || 'quiz';
  const length = process.env.VIDEO_LENGTH || 'medium';

  logger.info(`Starting generation job (topic: ${topic || 'auto-strategy'}, style: ${style}, length: ${length})...`);
  const job = await agent.startGenerationJob({
    topic,
    style,
    length,
    source: 'scheduler'
  });

  logger.info(`Job queued: ${job.id}. Waiting for pipeline completion...`);
  const finished = await agent.waitForGenerationJob(job.id);

  if (finished.status === 'failed') {
    throw new Error(`Generation job failed: ${finished.error || 'Unknown error'}`);
  }

  logger.success(`✅ Generation job completed! Production ID: ${finished.productionId}`);

  // Ensure content is uploaded/scheduled on YouTube
  if (finished.productionId && agent.agents?.publishing) {
    try {
      logger.info(`Uploading content ${finished.productionId} to YouTube...`);
      const publishResult = await agent.agents.publishing.publishContent(finished.productionId, {
        publishNow: process.env.PUBLISH_IMMEDIATELY === 'true'
      });
      logger.success(`🎉 Video successfully published to YouTube: ${publishResult.youtubeUrl || publishResult.youtubeId}`);
    } catch (uploadErr) {
      logger.error(`Publishing step encountered an issue: ${uploadErr.message}`);
      throw uploadErr;
    }
  }

  logger.success('🏆 Daily automation pipeline completed successfully!');
  process.exit(0);
}

run().catch(err => {
  logger.error(`❌ Pipeline failed: ${err.message}`);
  process.exit(1);
});
