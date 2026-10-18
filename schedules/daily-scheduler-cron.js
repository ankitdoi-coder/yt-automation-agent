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

const CRON_EXPRESSION = '30 4 * * *'; // 04:30 AM every day
let isRunning = false;

function formatDateTime(date = new Date()) {
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
}

function getNextCronRun(targetHour = 4, targetMinute = 30) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(targetHour, targetMinute, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  const diffMs = next - now;
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return { nextDate: next, diffStr: `${hours}h ${minutes}m` };
}

function runDailyPipeline(reason = 'Cron Scheduled Trigger') {
  if (isRunning) {
    console.log(`\n[${formatDateTime()}] ⚠️ Previous pipeline run is still active. Skipping concurrent trigger.`);
    return;
  }

  isRunning = true;
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🚀 [${formatDateTime()}] STARTING DAILY PIPELINE: 2 LONG + 2 SHORTS VIDEOS`);
  console.log(`📌 Trigger Reason: ${reason}`);
  console.log(`${'='.repeat(70)}\n`);

  const scriptPath = path.resolve(__dirname, '../scripts/run-daily-job.js');
  const child = fork(scriptPath, [], {
    env: { ...process.env, CI: 'false' },
    stdio: 'inherit'
  });

  child.on('exit', (code) => {
    isRunning = false;
    const { nextDate, diffStr } = getNextCronRun(4, 30);
    if (code === 0) {
      console.log(`\n✅ [${formatDateTime()}] Daily Pipeline completed successfully!`);
    } else {
      console.error(`\n❌ [${formatDateTime()}] Daily Pipeline exited with error code: ${code}`);
    }
    console.log(`⏳ Next scheduled run at 04:30 AM (in ~${diffStr}) on ${formatDateTime(nextDate)}\n`);
  });

  child.on('error', (err) => {
    isRunning = false;
    console.error(`\n❌ [${formatDateTime()}] Failed to spawn daily pipeline:`, err.message);
  });
}

function printBanner() {
  const { nextDate, diffStr } = getNextCronRun(4, 30);
  console.log('\n' + '═'.repeat(70));
  console.log('🤖  YOUTUBE AUTOMATION AGENT - 24/7 DAILY SCHEDULER DAEMON');
  console.log('═'.repeat(70));
  console.log(`⏰ Daily Trigger Time  : 04:30 AM Everyday (Cron: '${CRON_EXPRESSION}')`);
  console.log(`📅 Current Local Time  : ${formatDateTime()}`);
  console.log(`⏳ Next Run Scheduled  : ${formatDateTime(nextDate)} (in ~${diffStr})`);
  console.log('🎬 Production Pipeline : 4 Videos (2 Long Masterclasses + 2 Shorts)');
  console.log('   • Slot 1 (09:30 AM IST): Morning Rapid Revision (Shorts 1, 9:16)');
  console.log('   • Slot 2 (02:00 PM IST): Afternoon Study Masterclass (Long 1, 50 Qs)');
  console.log('   • Slot 3 (07:00 PM IST): Evening Prime Exam Class (Long 2, 50 Qs)');
  console.log('   • Slot 4 (09:30 PM IST): Bedtime Rapid Scroll (Shorts 2, 9:16)');
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

// Schedule the daily cron at 04:30 AM every day
cron.schedule(CRON_EXPRESSION, () => {
  console.log(`\n⏰ [${formatDateTime()}] 04:30 AM Cron Alarm Triggered!`);
  runDailyPipeline('04:30 AM Daily Scheduled Cron');
});

// Hourly heartbeat to keep daemon visible and healthy
setInterval(() => {
  const { nextDate, diffStr } = getNextCronRun(4, 30);
  console.log(`[${formatDateTime()}] 💓 24/7 Scheduler Active | Status: ${isRunning ? 'Running Pipeline' : 'Idle'} | Next trigger: 04:30 AM (in ~${diffStr})`);
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
