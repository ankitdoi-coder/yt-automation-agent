const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('data/youtube_automation.db');

db.all("SELECT id, title, main_content FROM scripts WHERE title LIKE '%Top 50%'", (err, rows) => {
  if (err) return console.error(err);
  console.log('Found:', rows.length);
  for (const r of rows) {
    console.log('Title:', r.title);
    try {
      const parsed = JSON.parse(r.main_content);
      console.log('Keys in main_content:', Object.keys(parsed));
      if (parsed.sections) {
        console.log('sections length:', parsed.sections.length);
        console.log('Sample section:', parsed.sections[0]);
      }
      if (parsed.questions) {
        console.log('questions length:', parsed.questions.length);
      }
    } catch (e) {
      console.log('Not json:', r.main_content.slice(0, 100));
    }
  }
});
