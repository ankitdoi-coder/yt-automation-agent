const { collectAnalytics } = require('./collect');
const { analyzeDataset } = require('./analyze');
const { decideImprovements } = require('./decide');
const { generateReport } = require('./report');
const { Logger } = require('../../utils/logger');

const logger = new Logger('AutopilotRunner');

async function runAutopilot(options = {}) {
  const isDryRun = options.dryRun ?? (process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true');
  const shouldApply = options.apply ?? (process.argv.includes('--apply') || process.env.APPLY_CHANGES === 'true');
  const lookbackDays = options.lookbackDays ?? parseInt(process.env.LOOKBACK_DAYS || '28', 10);

  logger.info(`=== STARTING GROWTH AUTOPILOT RUN ===`);
  logger.info(`Mode: ${shouldApply ? 'APPLY (Active Mutation)' : 'DRY RUN (Evaluation Only)'} | Lookback: ${lookbackDays} days`);

  try {
    // Step 1: Collect
    logger.info('Step 1/4: Collecting latest YouTube Data & Analytics API metrics...');
    const rawData = await collectAnalytics({ lookbackDays, dryRun: isDryRun });

    // Step 2: Analyze
    logger.info('Step 2/4: Running statistical bootstrap evaluation & regression audits...');
    const analysis = await analyzeDataset(rawData);

    // Step 3: Decide
    logger.info('Step 3/4: Passing hypotheses through hard guardrails & explore/exploit rules...');
    const proposal = await decideImprovements(analysis, { apply: shouldApply });

    // Step 4: Report
    logger.info('Step 4/4: Generating markdown reports and GitHub summaries...');
    const report = await generateReport({ analysis, proposal });

    logger.info(`=== GROWTH AUTOPILOT COMPLETED SUCCESSFULLY ===`);
    console.log('\n' + report.prSummary);

    return {
      success: true,
      proposalsCount: proposal.proposals.length,
      applied: proposal.applied,
      reportPath: report.reportPath
    };
  } catch (err) {
    logger.error(`Autopilot encountered fatal error: ${err.message}`);
    throw err;
  }
}

if (require.main === module) {
  runAutopilot().then(() => {
    process.exit(0);
  }).catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = {
  runAutopilot
};
