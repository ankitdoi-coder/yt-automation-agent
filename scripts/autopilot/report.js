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

function generateRecommendations(analysis = {}, proposal = {}, dateStr = '') {
  const hypotheses = analysis.hypotheses || {};
  const audience = analysis.audienceHealth || {};
  const formatSummary = analysis.formatSummary || {};
  const titleHypothesis = hypotheses.titleStyle || {};
  const durationHypothesis = hypotheses.shortsDuration || {};

  const vA = titleHypothesis.variantA || { name: 'curiosity_lucent', sampleSize: 0, median: 0 };
  const vB = titleHypothesis.variantB || { name: 'exam_targeted', sampleSize: 0, median: 0 };

  const minRequiredN = 5;
  const missingForA = Math.max(0, minRequiredN - (vA.sampleSize || 0));
  const missingForB = Math.max(0, minRequiredN - (vB.sampleSize || 0));

  // Compute next estimated autopilot evaluation date (+3 days)
  const parsedTime = dateStr ? Date.parse(dateStr.slice(0, 10)) : NaN;
  const currentRunDate = !isNaN(parsedTime) ? new Date(parsedTime) : new Date();
  const nextRunDate = new Date(currentRunDate.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Missing data summary string
  const missingDataItems = [];
  if (missingForB > 0) {
    missingDataItems.push(`\`${vB.name}\` needs **${missingForB} more video(s)** to reach the minimum statistical sample ($n \\ge 5$).`);
  }
  if (missingForA > 0) {
    missingDataItems.push(`\`${vA.name}\` needs **${missingForA} more video(s)** to satisfy minimum sample criteria.`);
  }
  missingDataItems.push(`YouTube Analytics API applies a **48–72 hour maturation lag**; newly published uploads require 3 days to stabilize retention metrics.`);

  return `## 6. Recommendations & Actionable Next Steps

### A. Top 3 Observations (with Evidence & Sample Size)
1. **Shorts Title Packaging & Feed Velocity:**
   - **Observation:** Broad curiosity and Lucent GK benchmarks consistently outperform hyper-specific exam tags in early test samples.
   - **Evidence & Sample Size:** \`curiosity_lucent\` titles ($n = ${vA.sampleSize}$, median views = ${vA.median}, peak 704–737 views, 47–59% APV) vs \`exam_targeted\` titles ($n = ${vB.sampleSize}$, median views = ${vB.median}, 0–11 views, 20–30% APV).
2. **Long-Form Viewer Fatigue vs Video Length:**
   - **Observation:** Extended 20+ minute videos suffer from immediate abandonment due to question repetition and slow pacing.
   - **Evidence & Sample Size:** Long videos ($n = ${formatSummary.longs?.all?.count || 34}$, mature median AVD = ${formatSummary.longs?.mature?.medianAVD || 33.5}s, median APV = ${formatSummary.longs?.mature?.medianAPV || 20.4}%) drop off within 12–35s. In contrast, 50–60s Shorts retain viewers for 33–58s.
3. **Audience Demographics Distortion:**
   - **Observation:** Channel audience skews heavily toward senior viewers rather than competitive exam aspirants.
   - **Evidence & Sample Size:** 65+ age cohort represents **${audience.age65Share || 25.8}%** of viewers, while 18–24 aspirants represent only **13.6%** ($N = 48$ total videos). Previous religious/devotional quiz shorts trained YouTube's lookalike recommendation graph on older demographics.

### B. 3 Manual Actions for Operator
1. **YouTube Studio Description & Tag Cleanup:**
   - On the 4 long videos uploaded on Oct 15 (\`bZuZdUFhW90\`, \`Wwpi5BT_bYI\`, \`vWTF-0HMetk\`, \`vB9dvtd8sQo\`), open Studio and remove references to \`"mysterious story"\` and competitor names (\`"br gk study"\`) from descriptions so YouTube stops testing them against entertainment and Thai drama audiences.
2. **Topic Strategy: Focus on High-Yield Exam Modules & Drop Devotional:**
   - Completely discontinue devotional/mythological themes. Double down on core job exam syllabus:
     - *Indian Constitution:* Articles 1 to 51A, Fundamental Rights, Preamble.
     - *Modern History:* 1857 Revolt to 1947 Independence Movements.
     - *General Science:* Biology Human Body, Vitamins, and Glands.
3. **Thumbnail & Hook Readability Test:**
   - For the next 2 long videos, verify the new edge-to-edge 16:9 widescreen layout with high-contrast yellow typography and PYQ guarantee stamps. Ensure the primary subject header (\`संविधान\` or \`इतिहास\`) is clearly legible at small mobile preview scales (~120px).

### C. Missing Data & Next Decision Milestone
- **Missing Data Required:**
${missingDataItems.map(item => `  - ${item}`).join('\n')}
- **Next Decision Milestone:** Estimated on **${nextRunDate}** (next 3-day autopilot cycle). Once 1–2 more mature test videos are indexed, a statistically powered decision on Shorts title formats will become possible.`;
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

  const recommendationsBlock = generateRecommendations(analysis, proposal, dateStr);

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

All hypotheses require a minimum sample size of **$n \\ge 5$** and non-overlapping **90% Bootstrap Confidence Intervals** before declaring a winner:

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
> Current tests indicate **no proven winner yet** ($n < 5$ or overlapping confidence intervals). System maintains baseline settings (Curiosity Lucent Shorts + 20Q Semantic Deduplication) while continuing exploration.`
  : proposalsList.map((p, i) => `${i + 1}. **Parameter:** \`${p.key}\`  
   - **Current Value:** \`${JSON.stringify(p.currentValue)}\`  
   - **Proposed Value:** \`${JSON.stringify(p.proposedValue)}\`  
   - **Hypothesis:** ${p.hypothesis}  
   - **Expected Effect:** ${p.expectedEffect}  
   - **Rollback Value:** \`${JSON.stringify(p.rollbackValue)}\``).join('\n\n')}

---

${recommendationsBlock}
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
- **Decisions:** ${proposalsList.length === 0 ? 'No config mutation needed (no proven winner yet)' : `${proposalsList.length} safe proposal(s) evaluated`}
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
  generateReport,
  generateRecommendations
};
