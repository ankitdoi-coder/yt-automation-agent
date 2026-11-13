const fs = require('fs');

const raw = fs.readFileSync('analytics/videos.csv', 'utf8');
const lines = raw.split('\n').filter(l => l.trim().length > 0);

function parseCsvLine(line) {
  let fields = [];
  let inQuotes = false;
  let curr = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) {
      fields.push(curr);
      curr = '';
    } else {
      curr += c;
    }
  }
  fields.push(curr);
  return fields.map(f => f.replace(/^"|"$/g, '').trim());
}

const headers = parseCsvLine(lines[0]);
const records = [];
for (let i = 1; i < lines.length; i++) {
  const values = parseCsvLine(lines[i]);
  const obj = {};
  headers.forEach((h, idx) => { obj[h] = values[idx] || ''; });
  records.push(obj);
}

const shorts = records.filter(r => r.video_type === 'SHORT');
console.log('Total Shorts in dataset:', shorts.length);

// 1. Duration Buckets
const durationBuckets = {
  '<15s': { count: 0, views: 0, apvSum: 0, apvCount: 0 },
  '15-25s': { count: 0, views: 0, apvSum: 0, apvCount: 0 },
  '25-40s': { count: 0, views: 0, apvSum: 0, apvCount: 0 },
  '40-60s+': { count: 0, views: 0, apvSum: 0, apvCount: 0 }
};

shorts.forEach(s => {
  const dur = Number(s.duration_seconds || 0);
  const views = Number(s.views || 0);
  const apv = parseFloat(s.apv_percent);
  let bucket = '<15s';
  if (dur >= 40) bucket = '40-60s+';
  else if (dur >= 25) bucket = '25-40s';
  else if (dur >= 15) bucket = '15-25s';

  durationBuckets[bucket].count++;
  durationBuckets[bucket].views += views;
  if (!isNaN(apv) && apv > 0) {
    durationBuckets[bucket].apvSum += apv;
    durationBuckets[bucket].apvCount++;
  }
});

console.log('\n--- DURATION BUCKETS ---');
for (const [k, v] of Object.entries(durationBuckets)) {
  const avgViews = v.count ? (v.views / v.count).toFixed(1) : 0;
  const avgApv = v.apvCount ? (v.apvSum / v.apvCount).toFixed(1) + '%' : 'N/A';
  console.log(k.padEnd(10), 'Count:', String(v.count).padStart(3), '| Total Views:', String(v.views).padStart(5), '| Avg Views/Video:', String(avgViews).padStart(5), '| Avg APV:', avgApv);
}

// 2. Topic Distribution
const topics = {};
shorts.forEach(s => {
  const t = s.title.toLowerCase();
  let cat = 'Other GK';
  if (t.includes('science') || t.includes('विज्ञान')) cat = 'General Science';
  else if (t.includes('polity') || t.includes('संविधान')) cat = 'Polity / Constitution';
  else if (t.includes('history') || t.includes('इतिहास')) cat = 'History';
  else if (t.includes('geography') || t.includes('भूगोल')) cat = 'Geography';
  else if (t.includes('audio')) cat = 'Audio Trend Short';

  if (!topics[cat]) topics[cat] = { count: 0, views: 0 };
  topics[cat].count++;
  topics[cat].views += Number(s.views || 0);
});

console.log('\n--- TOPIC PERFORMANCE ---');
for (const [cat, v] of Object.entries(topics)) {
  const avg = v.count ? (v.views / v.count).toFixed(1) : 0;
  console.log(cat.padEnd(25), 'Count:', String(v.count).padStart(3), '| Views:', String(v.views).padStart(5), '| Avg Views:', avg);
}

// 3. Title Length Buckets
const titleBuckets = {
  '<40 chars': { count: 0, views: 0 },
  '40-60 chars': { count: 0, views: 0 },
  '>60 chars': { count: 0, views: 0 }
};
shorts.forEach(s => {
  const len = s.title.length;
  let b = '>60 chars';
  if (len < 40) b = '<40 chars';
  else if (len <= 60) b = '40-60 chars';
  titleBuckets[b].count++;
  titleBuckets[b].views += Number(s.views || 0);
});

console.log('\n--- TITLE LENGTH PERFORMANCE ---');
for (const [k, v] of Object.entries(titleBuckets)) {
  const avg = v.count ? (v.views / v.count).toFixed(1) : 0;
  console.log(k.padEnd(15), 'Count:', String(v.count).padStart(3), '| Views:', String(v.views).padStart(5), '| Avg Views:', avg);
}

// 4. Top 10 Shorts
shorts.sort((a, b) => Number(b.views || 0) - Number(a.views || 0));
console.log('\n--- TOP 10 SHORTS ALL TIME ---');
shorts.slice(0, 10).forEach((s, idx) => {
  console.log(`${idx+1}. [${s.views} views] (APV: ${s.apv_percent || 'N/A'}%, Dur: ${s.duration_seconds}s) Title: "${s.title}" (ID: ${s.video_id})`);
});

// 5. Zero or low views
const zeroViews = shorts.filter(s => Number(s.views || 0) === 0);
console.log(`\nTotal Shorts with 0 views: ${zeroViews.length} out of ${shorts.length}`);
zeroViews.slice(0, 10).forEach(s => {
  console.log(`- 0 views: "${s.title}" | Published: ${s.publish_datetime} | ID: ${s.video_id}`);
});
