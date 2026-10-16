const fs = require('fs');

function parseCSVLine(text) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  result.push(cur);
  return result;
}

const lines = fs.readFileSync('analytics/videos.csv', 'utf8').trim().split('\n');
const headers = parseCSVLine(lines[0]);
console.log('Headers:', headers);

const records = lines.slice(1).map(l => {
  const vals = parseCSVLine(l);
  const obj = {};
  headers.forEach((h, i) => { obj[h] = vals[i]; });
  obj.views = Number(obj.views || 0);
  obj.duration_seconds = Number(obj.duration_seconds || 0);
  return obj;
});

records.sort((a, b) => b.views - a.views);

console.log('\n--- TOP 15 VIDEOS BY VIEWS ---');
records.slice(0, 15).forEach((r, i) => {
  console.log(`${i+1}. [${r.video_type}] ${r.views} views (${r.duration_seconds}s) | ${r.title} | Pub: ${r.publish_datetime}`);
});

console.log('\n--- BOTTOM 15 VIDEOS BY VIEWS ---');
records.slice(-15).forEach((r, i) => {
  console.log(`${i+1}. [${r.video_type}] ${r.views} views (${r.duration_seconds}s) | ${r.title} | Pub: ${r.publish_datetime}`);
});

console.log('\n--- BY DATE BREAKDOWN ---');
const dateMap = {};
for (const r of records) {
  const day = (r.publish_datetime || '').slice(0, 10);
  if (!dateMap[day]) dateMap[day] = { count: 0, views: 0, shorts: 0, longs: 0 };
  dateMap[day].count++;
  dateMap[day].views += r.views;
  if (r.video_type === 'SHORT') dateMap[day].shorts++;
  else dateMap[day].longs++;
}
Object.keys(dateMap).sort().forEach(day => {
  const d = dateMap[day];
  console.log(`${day}: ${d.count} videos (${d.longs}L + ${d.shorts}S), Total Views: ${d.views}`);
});
