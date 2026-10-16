const fs = require('fs');
const path = require('path');
const { Logger } = require('../../utils/logger');

const logger = new Logger('AutopilotDecide');

const GUARDRAILS_FILE = path.resolve(__dirname, '..', '..', 'config', 'guardrails.json');
const GROWTH_CONFIG_FILE = path.resolve(__dirname, '..', '..', 'config', 'growth.json');
const KNOWN_GOOD_DIR = path.resolve(__dirname, '..', '..', 'analytics', 'known-good');
const PROPOSALS_DIR = path.resolve(__dirname, '..', '..', 'analytics', 'proposals');

function loadJson(filePath, fallback = {}) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
  } catch (err) {
    logger.warn(`Failed reading JSON from ${filePath}: ${err.message}`);
  }
  return fallback;
}

function getLatestKnownGoodSnapshot() {
  if (!fs.existsSync(KNOWN_GOOD_DIR)) return null;
  const files = fs.readdirSync(KNOWN_GOOD_DIR)
    .filter(f => f.startsWith('growth-known-good-') && f.endsWith('.json'))
    .sort();
  if (files.length === 0) return null;
  const latestFile = path.join(KNOWN_GOOD_DIR, files[files.length - 1]);
  return loadJson(latestFile);
}

function getNestedValue(obj, dotPath) {
  return dotPath.split('.').reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

function setNestedValue(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function validateAgainstGuardrails(proposals = [], guardrails) {
  const allowed = guardrails.allowedRanges || {};
  const immutable = new Set(guardrails.immutableKeys || []);
  const validated = [];

  let shortsVarsChanged = 0;
  let longsVarsChanged = 0;

  for (const prop of proposals) {
    const key = prop.key;
    const proposedVal = prop.proposedValue;

    // 1. Check prohibited immutable keys
    if (immutable.has(key) || immutable.has(key.split('.').pop())) {
      logger.warn(`Guardrail REJECT: key "${key}" is strictly immutable.`);
      continue;
    }

    // 2. Check allowed range / enum
    const rule = allowed[key];
    if (!rule) {
      logger.warn(`Guardrail REJECT: key "${key}" not in allowed guardrail registry.`);
      continue;
    }

    let clampedValue = proposedVal;
    if (rule.type === 'integer' || rule.type === 'number') {
      if (rule.min !== undefined && clampedValue < rule.min) clampedValue = rule.min;
      if (rule.max !== undefined && clampedValue > rule.max) clampedValue = rule.max;
    } else if (rule.type === 'enum') {
      if (!rule.allowed.includes(clampedValue)) {
        logger.warn(`Guardrail REJECT: value "${clampedValue}" not in allowed enum [${rule.allowed.join(', ')}].`);
        continue;
      }
    }

    // 3. Check format variable limit (at most 1 per format per run)
    if (key.startsWith('shorts.')) {
      if (shortsVarsChanged >= (guardrails.rules?.maxVariablesPerFormat || 1)) {
        logger.warn(`Guardrail REJECT: limit of 1 Shorts variable per run reached. Skipping ${key}.`);
        continue;
      }
      shortsVarsChanged++;
    } else if (key.startsWith('longVideos.')) {
      if (longsVarsChanged >= (guardrails.rules?.maxVariablesPerFormat || 1)) {
        logger.warn(`Guardrail REJECT: limit of 1 Long Video variable per run reached. Skipping ${key}.`);
        continue;
      }
      longsVarsChanged++;
    }

    validated.push({
      ...prop,
      proposedValue: clampedValue
    });

    if (validated.length >= (guardrails.rules?.maxConfigChangesPerRun || 2)) {
      logger.info(`Max changes limit (${guardrails.rules?.maxConfigChangesPerRun || 2}) reached.`);
      break;
    }
  }

  return validated;
}

async function decideImprovements(analysisInput = null, options = {}) {
  logger.info('Starting decision engine...');

  let analysis = analysisInput;
  if (!analysis) {
    const analysisDir = path.resolve(__dirname, '..', '..', 'analytics', 'analysis');
    if (!fs.existsSync(analysisDir)) {
      throw new Error(`Analysis directory not found: ${analysisDir}`);
    }
    const files = fs.readdirSync(analysisDir)
      .filter(f => f.startsWith('analysis-') && f.endsWith('.json'))
      .sort();
    if (files.length === 0) {
      throw new Error('No analysis JSON files found.');
    }
    const latest = path.join(analysisDir, files[files.length - 1]);
    logger.info(`Loading analysis from ${latest}`);
    analysis = JSON.parse(fs.readFileSync(latest, 'utf8'));
  }

  const guardrails = loadJson(GUARDRAILS_FILE);
  const currentGrowth = loadJson(GROWTH_CONFIG_FILE);
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);

  const rawProposals = [];
  let isRegressionRevert = false;

  // 1. Regression Handler: If regression detected, propose revert to last known-good config
  if (analysis.regressionAlert && analysis.regressionAlert.isDetected) {
    logger.warn(`REGRESSION DETECTED: ${analysis.regressionAlert.dropPercent}% view velocity drop.`);
    const knownGood = getLatestKnownGoodSnapshot();
    if (knownGood) {
      isRegressionRevert = true;
      // Propose restoration of core known-good parameters
      if (knownGood.shorts?.titleStyle && knownGood.shorts.titleStyle !== currentGrowth.shorts?.titleStyle) {
        rawProposals.push({
          key: 'shorts.titleStyle',
          currentValue: currentGrowth.shorts?.titleStyle,
          proposedValue: knownGood.shorts.titleStyle,
          hypothesis: `Revert to known-good baseline (${knownGood.shorts.titleStyle}) following ${analysis.regressionAlert.dropPercent}% velocity slump.`,
          expectedEffect: 'Stabilize Shorts feed velocity and restore baseline reach.',
          confidence: 'High (Known Baseline)',
          rollbackValue: currentGrowth.shorts?.titleStyle
        });
      }
      if (knownGood.shorts?.targetQuestionCount && knownGood.shorts.targetQuestionCount !== currentGrowth.shorts?.targetQuestionCount) {
        rawProposals.push({
          key: 'shorts.targetQuestionCount',
          currentValue: currentGrowth.shorts?.targetQuestionCount,
          proposedValue: knownGood.shorts.targetQuestionCount,
          hypothesis: `Restore baseline question count (${knownGood.shorts.targetQuestionCount}Q).`,
          expectedEffect: 'Maintain proven swipe retention.',
          confidence: 'High (Known Baseline)',
          rollbackValue: currentGrowth.shorts?.targetQuestionCount
        });
      }
    }
  }

  // 2. Statistical Winners Evaluation (Only if no regression)
  if (!isRegressionRevert) {
    const titleHypothesis = analysis.hypotheses?.titleStyle;
    if (titleHypothesis && titleHypothesis.isConclusive && titleHypothesis.winner) {
      if (currentGrowth.shorts?.titleStyle !== titleHypothesis.winner) {
        rawProposals.push({
          key: 'shorts.titleStyle',
          currentValue: currentGrowth.shorts?.titleStyle,
          proposedValue: titleHypothesis.winner,
          hypothesis: `Statistically significant winner: ${titleHypothesis.winner} consistently outperformed rival title formats.`,
          expectedEffect: 'Higher mobile CTR and increased Shorts feed browse impressions.',
          confidence: '90% Bootstrap CI',
          rollbackValue: currentGrowth.shorts?.titleStyle
        });
      }
    }

    const durationHypothesis = analysis.hypotheses?.shortsDuration;
    if (durationHypothesis && durationHypothesis.isConclusive && durationHypothesis.winner) {
      const targetSec = durationHypothesis.winner === '<45s' ? 42 : 54;
      if (currentGrowth.shorts?.targetDurationSeconds !== targetSec) {
        rawProposals.push({
          key: 'shorts.targetDurationSeconds',
          currentValue: currentGrowth.shorts?.targetDurationSeconds,
          proposedValue: targetSec,
          hypothesis: `Duration bucket ${durationHypothesis.winner} achieved significantly higher retention.`,
          expectedEffect: 'Maximized APV and loop completion rate.',
          confidence: '90% Bootstrap CI',
          rollbackValue: currentGrowth.shorts?.targetDurationSeconds
        });
      }
    }

    // Explore / Exploit challenger rotation if tests are inconclusive
    // If no statistically significant change exists, suggest a minor explored parameter
    if (rawProposals.length === 0) {
      // Check if long video questions can be tuned
      if (currentGrowth.longVideos?.targetQuestionCount === 50) {
        rawProposals.push({
          key: 'longVideos.targetQuestionCount',
          currentValue: 50,
          proposedValue: 20,
          hypothesis: 'Reducing question count from 50 (23m) to 20 (8m) will prevent viewer fatigue and eliminate duplicate questions.',
          expectedEffect: 'Raise long video Average View Duration from 9s to >2m.',
          confidence: 'Medium (Domain Best Practice)',
          rollbackValue: 50
        });
      }
    }
  }

  // 3. Validate proposals through Guardrails
  const approvedProposals = validateAgainstGuardrails(rawProposals, guardrails);

  const proposalRecord = {
    timestamp: now.toISOString(),
    date: dateStr,
    isRegressionRevert,
    totalProposalsGenerated: rawProposals.length,
    proposalsApproved: approvedProposals.length,
    proposals: approvedProposals,
    exploreExploitDistribution: guardrails.rules?.exploreExploitSplit || { exploit: 0.70, explore: 0.30 },
    applied: false
  };

  // 4. Apply changes if requested (--apply flag)
  const shouldApply = options.apply === true || process.argv.includes('--apply');
  if (shouldApply && approvedProposals.length > 0) {
    logger.info(`Applying ${approvedProposals.length} approved proposal(s) to config/growth.json...`);
    const updatedGrowth = { ...currentGrowth };
    for (const prop of approvedProposals) {
      setNestedValue(updatedGrowth, prop.key, prop.proposedValue);
      logger.info(`Updated "${prop.key}": ${prop.currentValue} -> ${prop.proposedValue}`);
    }
    updatedGrowth.updatedAt = now.toISOString();
    fs.writeFileSync(GROWTH_CONFIG_FILE, JSON.stringify(updatedGrowth, null, 2), 'utf8');
    proposalRecord.applied = true;
    logger.info(`Successfully updated ${GROWTH_CONFIG_FILE}`);
  } else if (approvedProposals.length === 0) {
    logger.info('No configuration mutations required. No proven winner yet or tests remain inconclusive.');
  } else {
    logger.info(`Dry-run mode: ${approvedProposals.length} proposal(s) available for inspection (not applied). Use --apply to execute.`);
  }

  // 5. Save Proposal Record to analytics/proposals/
  if (!fs.existsSync(PROPOSALS_DIR)) {
    fs.mkdirSync(PROPOSALS_DIR, { recursive: true });
  }
  const proposalPath = path.join(PROPOSALS_DIR, `proposal-${dateStr}.json`);
  fs.writeFileSync(proposalPath, JSON.stringify(proposalRecord, null, 2), 'utf8');
  logger.info(`Saved proposal record to ${proposalPath}`);

  return proposalRecord;
}

if (require.main === module) {
  decideImprovements().then(res => {
    logger.info(`Decide phase finished. Proposals: ${res.proposals.length}`);
    process.exit(0);
  }).catch(err => {
    logger.error(`Decide phase failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  decideImprovements,
  validateAgainstGuardrails,
  getNestedValue,
  setNestedValue
};
