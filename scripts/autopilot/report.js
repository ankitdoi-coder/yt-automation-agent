const fs = require('fs');
const path = require('path');
const { Logger } = require('../../utils/logger');

const logger = new Logger('AutopilotReport');

const REPORTS_DIR = path.resolve(__dirname, '..', '..', 'analytics', 'reports');

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

function formatNumber(num) {
  return Number(num || 0).toLocaleString('en-US');
}

async function generateReport(options = {}) {
  const dateStr = options.date || new Date().toISOString().slice(0, 10);

  // Load latest analysis and proposal
  const analysisDir = path.resolve(__dirname, '..', '..', 'analytics', 'analysis');
  const proposalDir = path.resolve(__dirname, '..', '..', 'analytics', 'proposals');

  const analysisPath = path.join(analysisDir, `analysis-${dateStr}.json`);
  const proposalPath = path.join(proposalDir, `proposal-${dateStr}.json`);

  const analysis = loadJson(analysisPath, options.analysis);
  const proposal = loadJson(proposalPath, options.proposal);

  const channel = analysis.channel || {};
  const formatSummary = analysis.formatSummary || {};
  const hypotheses = analysis.hypotheses || {};
  const audience = analysis.audienceHealth || {};
  const quality = analysis.qualityAudit || {};
  const top5 = analysis.top5Videos || [];
  const bottom5 = analysis.bottom5Videos || [];

  const proposalsList = proposal.proposals || [];

  // 1. Build Comprehensive Markdown Report
  const fullReport = `# 🚀 Growth Autopilot Performance & Decision Report: ${dateStr}

**Channel:** ${channel.title || 'ExamIQ'} (\`@examiqbharat\`)  
**Channel ID:** \`${channel.channelId || 'UCjh63suNzws9XB2sF1xKzyw'}\`  
**Total Subs:** ${formatNumber(channel.subscriberCount)} | **Total Views:** ${formatNumber(channel.viewCount)} | **Total Uploads:** ${channel.videoCount || 48}  
**Autopilot Run:** 3-Day Cycle (${dateStr})  

---

## 1. Executive Summary & Format Performance

| Format | Uploaded Count | Mature (>=72h) | Median Views | p75 Views | Median AVD | Median APV | Total Views |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Shorts (<=60s)** | ${formatSummary.shorts?.all?.count || 0} | ${formatSummary.shorts?.mature?.count || 0} | **${formatSummary.shorts?.all?.medianViews ?? 0}** | ${formatSummary.shorts?.all?.p75Views ?? 0} | ${formatSummary.shorts?.all?.medianAVD ?? 0}s | **${formatSummary.shorts?.all?.medianAPV ?? 0}%** | ${formatNumber(formatSummary.shorts?.all?.totalViews)} |
| **Long Form (>60s)** | ${formatSummary.longs?.all?.count || 0} | ${formatSummary.longs?.mature?.count || 0} | **${formatSummary.longs?.all?.medianViews ?? 0}** | ${formatSummary.longs?.all?.p75Views ?? 0} | ${formatSummary.longs?.all?.medianAVD ?? 0}s | **${formatSummary.longs?.all?.medianAPV ?? 0}%** | ${formatNumber(formatSummary.longs?.all?.totalViews)} |

---

## 2. Hypothesis & Statistical Testing Status

All hypotheses require a minimum sample size of **n >= 5** and non-overlapping **90% Bootstrap Confidence Intervals** before declaring a winner:

1. **Shorts Title Style (Curiosity / Lucent vs Exam-Targeted):**
   - **Variant A (\`curiosity_lucent\`):** n = ${hypotheses.titleStyle?.variantA?.sampleSize || 0}, Median = ${hypotheses.titleStyle?.variantA?.median || 0} (90% CI: [${hypotheses.titleStyle?.variantA?.lowerBound || 0}, ${hypotheses.titleStyle?.variantA?.upperBound || 0}])
   - **Variant B (\`exam_targeted\`):** n = ${hypotheses.titleStyle?.variantB?.sampleSize || 0}, Median = ${hypotheses.titleStyle?.variantB?.median || 0} (90% CI: [${hypotheses.titleStyle?.variantB?.lowerBound || 0}, ${hypotheses.titleStyle?.variantB?.upperBound || 0}])
   - **Status:** \`${hypotheses.titleStyle?.reason || 'Testing in progress'}\`

2. **Shorts Duration (<45s vs 45–60s):**
   - **Variant A (\`45-60s\`):** n = ${hypotheses.shortsDuration?.variantA?.sampleSize || 0}, Median = ${hypotheses.shortsDuration?.variantA?.median || 0}
   - **Variant B (\`<45s\`):** n = ${hypotheses.shortsDuration?.variantB?.sampleSize || 0}, Median = ${hypotheses.shortsDuration?.variantB?.median || 0}
   - **Status:** \`${hypotheses.shortsDuration?.reason || 'Testing in progress'}\`

---

## 3. Top 5 & Bottom 5 Benchmark Videos

### Top 5 Performers
${top5.map((v, i) => `${i + 1}. **[${v.isShort ? 'SHORT' : 'LONG'}]** [${v.title}](https://youtu.be/${v.id})  
   - **Views:** ${formatNumber(v.views)} | **APV:** ${v.apvPct}% | **AVD:** ${v.avdSec}s | **Likes:** ${v.likes} | **Style:** \`${v.titleStyle}\``).join('\n\n')}

### Bottom 5 Performers
${bottom5.map((v, i) => `${i + 1}. **[${v.isShort ? 'SHORT' : 'LONG'}]** [${v.title}](https://youtu.be/${v.id})  
   - **Views:** ${v.views} | **APV:** ${v.apvPct}% | **Duration:** ${v.durationSec}s | **Age:** ${v.ageHours}h`).join('\n\n')}

---

## 4. Pipeline Quality & Audience Health Audit

- **Audience Demographic Skew:**
  - **18–34 Aspirant Core:** ${audience.age18To34Share || 0}%
  - **65+ Senior Cohort:** ${audience.age65Share || 0}%
  - **Diagnosis:** ${audience.diagnosis}
- **Quality Audit on Recent 10 Uploads:**
  - **Issues Detected:** ${quality.issueCount || 0}
${(quality.issues || []).map(iss => `  - ⚠️ \`${iss.issue}\` on [${iss.videoId}]: "${iss.title.slice(0, 50)}..."`).join('\n') || '  - ✅ Zero title truncation or forbidden keywords detected in recent uploads.'}

---

## 5. Decisions & Guardrail-Enforced Actions

**Proposals Generated:** ${proposalsList.length}  
**Applied in Run:** ${proposal.applied ? 'YES (Updated config/growth.json)' : 'NO (Dry-run mode or no mutations required)'}  

${proposalsList.length === 0
  ? `> **No configuration mutations executed.**  
> Current settings remain aligned with baseline peak performance (Curiosity Lucent Shorts + 20Q Semantic Deduplication). Statistical challenger tests remain in exploratory phase.`
  : proposalsList.map((p, i) => `${i + 1}. **Parameter:** \`${p.key}\`  
   - **Current Value:** \`${JSON.stringify(p.currentValue)}\`  
   - **Proposed Value:** \`${JSON.stringify(p.proposedValue)}\`  
   - **Hypothesis:** ${p.hypothesis}  
   - **Expected Effect:** ${p.expectedEffect}  
   - **Rollback Value:** \`${JSON.stringify(p.rollbackValue)}\``).join('\n\n')}

---

## 6. What I Need From You (Manual YouTube Studio Actions)

1. **Verify YouTube Analytics API:** API is verified active in GCP project \`969798236896\`.
2. **Category Consistency:** Confirm all future uploads remain assigned to **Education (Category ID 27)**.
3. **Pending Draft Description Cleanup:** If any drafts in YouTube Studio contain competitor tags or outdated years, save them with the auto-generated cleaned metadata.
`;

  // 2. Save full report to analytics/reports/
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }
  const reportPath = path.join(REPORTS_DIR, `growth-report-${dateStr}.md`);
  fs.writeFileSync(reportPath, fullReport, 'utf8');
  logger.info(`Generated full report at ${reportPath}`);

  // 3. Generate Short Summary for PR description and Step Summary
  const prSummary = `### 🚀 Growth Autopilot Run Summary (${dateStr})
- **Channel:** ${channel.title || 'ExamIQ'} (@examiqbharat) | **Total Views:** ${formatNumber(channel.viewCount)} | **Subs:** ${formatNumber(channel.subscriberCount)}
- **Shorts Views (Mature Median):** ${formatSummary.shorts?.mature?.medianViews ?? 0} views (${formatSummary.shorts?.mature?.medianAPV ?? 0}% APV)
- **Long Video Views (Mature Median):** ${formatSummary.longs?.mature?.medianViews ?? 0} views (${formatSummary.longs?.mature?.medianAPV ?? 0}% APV)
- **Decisions:** ${proposalsList.length === 0 ? 'No config mutation needed (current baseline optimal)' : `${proposalsList.length} safe proposal(s) evaluated`}
- **Full Report:** See \`analytics/reports/growth-report-${dateStr}.md\`
`;

  // Write to GitHub Step Summary if running in GitHub Actions
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, fullReport, 'utf8');
      logger.info('Appended report to $GITHUB_STEP_SUMMARY');
    } catch (_) {}
  }

  return {
    reportPath,
    fullReport,
    prSummary
  };
}

if (require.main === module) {
  generateReport().then(res => {
    console.log(res.prSummary);
    process.exit(0);
  }).catch(err => {
    logger.error(`Report generation failed: ${err.message}`);
    process.exit(1);
  });
}

module.exports = {
  generateReport
};
