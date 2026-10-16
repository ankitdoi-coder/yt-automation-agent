const fs = require('fs');
const path = require('path');

const dir = path.resolve('data/scripts');
if (!fs.existsSync(dir)) {
  console.log('data/scripts does not exist');
  process.exit(0);
}
const files = fs.readdirSync(dir).filter(f => f.endsWith('_script.json'));
console.log(`Found ${files.length} script files in data/scripts/`);

let totalQuestionsScanned = 0;
let totalDuplicatesFound = 0;

for (const f of files) {
  try {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const parsed = JSON.parse(raw);
    const questions = parsed.quiz?.questions || parsed.questions || [];
    if (questions.length > 0) {
      console.log(`\n================================================================`);
      console.log(`File: ${f} | Title: "${parsed.title}" | Q Count: ${questions.length}`);
      
      const seen = new Map();
      const duplicates = [];

      questions.forEach((q, idx) => {
        totalQuestionsScanned++;
        const text = (q.question || q.q || '').trim();
        const norm = text.toLowerCase()
          .replace(/[^\u0900-\u097Fa-z]/gi, '')
          .slice(0, 35);

        if (seen.has(norm)) {
          totalDuplicatesFound++;
          duplicates.push({
            orig: seen.get(norm),
            dupIdx: idx + 1,
            dupText: text
          });
        } else {
          seen.set(norm, { idx: idx + 1, text });
        }
      });

      console.log(`  Duplicates: ${duplicates.length} / ${questions.length} (${((duplicates.length / questions.length) * 100).toFixed(1)}%)`);
      duplicates.forEach(d => {
        console.log(`    ⚠️ Q${d.dupIdx} repeats Q${d.orig.idx}: "${d.dupText.slice(0, 50)}..."`);
      });
    }
  } catch (e) {
    console.error(`Error in ${f}:`, e.message);
  }
}

console.log(`\nOVERALL REPETITION SUMMARY: ${totalDuplicatesFound} duplicates found in ${totalQuestionsScanned} questions across ${files.length} scripts.`);
