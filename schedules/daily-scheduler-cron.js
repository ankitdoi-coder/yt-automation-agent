/**
 * 24/7 YouTube Automation Daily Scheduler Daemon
 * 
 * Pipeline:
 *  - 2 Long Videos (50 Questions each, 16:9)
 *  - 2 Shorts Videos (Top 5 Questions, 9:16)
 * 
 * Daily Schedule:
 *  - Cron triggers every day at 04:30 AM (local / IST)
 *  - Generates, renders, and auto-schedules to YouTube:
 *      • Slot 1 (09:30 AM IST) - Morning Rapid Revision (Shorts 1)
 *      • Slot 2 (02:00 PM IST) - Afternoon Study Masterclass (Long Video 1)
 *      • Slot 3 (07:00 PM IST) - Evening Prime Exam Class (Long Video 2)
 *      • Slot 4 (09:30 PM IST) - Bedtime Rapid Scroll (Shorts 2)
 * 
 * Usage:
 *   node schedules/daily-scheduler-cron.js
 *   node schedules/daily-scheduler-cron.js --now   (Run immediately on start, then continue 24/7 cron)
 */

require('dotenv').config();
const cron = require('node-cron');
const { fork } = require('child_process');
const path = require('path');
const chalk = require('chalk') || {
  cyan: { bold: (s) => s },
  green: { bold: (s) => s },
  yellow: (s) => s,
  red: (s) => s,
  gray: (s) => s
};

const MORNING_CRON = '50 7 * * *'; // 07:50 AM IST (~08:00 AM Direct Public Short)
const EVENING_CRON = '50 16 * * *'; // 04:50 PM IST (~05:00 PM Direct Public Short)
const SCHEDULE_TIMES = [
  { hour: 7, minute: 50, label: '07:50 AM IST' },
  { hour: 16, minute: 50, label: '04:50 PM IST' }
];
let isRunning = false;

function formatDateTime(date = new Date()) {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
}

function getNextCronRun() {
  const now = new Date();
  let earliest = null;
  for (const slot of SCHEDULE_TIMES) {
    const next = new Date(now);
    next.setHours(slot.hour, slot.minute, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    if (!earliest || next < earliest.nextDate) {
      earliest = { nextDate: next, label: slot.label };
    }
  }
  const diffMs = earliest.nextDate - now;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { nextDate: earliest.nextDate, label: earliest.label, diffStr: `${hours}h ${minutes}m` };
}

function runDailyPipeline(reason = 'Cron Scheduled Trigger') {
  if (isRunning) {
    console.log(`\n[${formatDateTime()}] ⚠️ Previous pipeline run is still active. Skipping concurrent trigger.`);
    return;
  }

  isRunning = true;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 [${formatDateTime()}] STARTING DAILY SHORTS PIPELINE (DIRECT PUBLIC UPLOAD)`);
  console.log(`📌 Trigger Reason: ${reason}`);
  console.log(`${'='.repeat(70)}\n`);

  const scriptPath = path.resolve(__dirname, '../scripts/run-daily-job.js');
  const child = fork(scriptPath, [], {
    env: {
      ...process.env,
      CI: 'false',
      PUBLISH_IMMEDIATELY: 'true',
      SCHEDULE_IN_ADVANCE: 'false',
      DEFAULT_PRIVACY_STATUS: process.env.DEFAULT_PRIVACY_STATUS || 'public'
    },
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    isRunning = false;
    const { nextDate, label, diffStr } = getNextCronRun();
    if (code === 0) {
      console.log(`\n✅ [${formatDateTime()}] Daily Pipeline completed successfully!`);
    } else {
      console.error(`\n❌ [${formatDateTime()}] Daily Pipeline exited with error code: ${code}`);
    }
    console.log(`⏳ Next scheduled run at ${label} (in ~${diffStr}) on ${formatDateTime(nextDate)}\n`);
  });

  child.on('error', (err) => {
    isRunning = false;
    console.error(`\n❌ [${formatDateTime()}] Failed to spawn daily pipeline:`, err.message);
  });
}

function printBanner() {
  const { nextDate, label, diffStr } = getNextCronRun();
  console.log('\n' + '═'.repeat(70));
  console.log('🤖  YOUTUBE AUTOMATION AGENT - 24/7 DAILY SCHEDULER DAEMON');
  console.log('═'.repeat(70));
  console.log(`⏰ Daily Trigger Times : 07:50 AM IST ('${MORNING_CRON}') & 04:50 PM IST ('${EVENING_CRON}')`);
  console.log(`📅 Current Local Time  : ${formatDateTime()}`);
  console.log(`⏳ Next Run Scheduled  : ${label} -> ${formatDateTime(nextDate)} (in ~${diffStr})`);
  console.log('🎬 Production Pipeline : 2 Daily Direct-Public Shorts (9:16 Vertical, 3 Qs, ~30s)');
  console.log('   • Slot 1 (07:50 AM IST): Morning Direct-Public Short (~08:00 AM Live)');
  console.log('   • Slot 2 (04:50 PM IST): Evening Direct-Public Short (~05:00 PM Live)');
  console.log('═'.repeat(70));
  console.log('Daemon running in background. Press Ctrl+C to terminate.\n');
}

// Initialize banner
printBanner();

// Check for --now or RUN_NOW flag
const runNow = process.argv.includes('--now') || process.env.RUN_NOW === 'true';
if (runNow) {
  console.log('⚡ Immediate run flag (--now) detected! Starting pipeline immediately...');
  runDailyPipeline('Immediate Run Flag (--now)');
}

// Schedule Morning trigger at 07:50 AM IST (~08:00 AM Public)
cron.schedule(MORNING_CRON, () => {
  console.log(`\n⏰ [${formatDateTime()}] 07:50 AM IST Morning Cron Triggered!`);
  runDailyPipeline('07:50 AM IST Morning Direct-Public Cron');
});

// Schedule Evening trigger at 04:50 PM IST (~05:00 PM Public)
cron.schedule(EVENING_CRON, () => {
  console.log(`\n⏰ [${formatDateTime()}] 04:50 PM IST Evening Cron Triggered!`);
  runDailyPipeline('04:50 PM IST Evening Direct-Public Cron');
});

// Hourly heartbeat to keep daemon visible and healthy
setInterval(() => {
  const { label, diffStr } = getNextCronRun();
  console.log(`[${formatDateTime()}] 💓 24/7 Scheduler Active | Status: ${isRunning ? 'Running Pipeline' : 'Idle'} | Next trigger: ${label} (in ~${diffStr})`);
}, 60 * 60 * 1000);

// Graceful termination handling
process.on('SIGINT', () => {
  console.log(`\n🛑 [${formatDateTime()}] Received SIGINT. Shutting down 24/7 Scheduler gracefully...`);
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(`\n🛑 [${formatDateTime()}] Received SIGTERM. Shutting down 24/7 Scheduler gracefully...`);
  process.exit(0);
});
