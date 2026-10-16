const { google } = require('googleapis');
const { CredentialManager } = require('../utils/credential-manager');

async function testAnalytics() {
  console.log('Testing YouTube Analytics API connection...');
  const cm = new CredentialManager();
  await cm.initialize();
  const auth = cm.getYouTubeAuth();

  const analytics = google.youtubeAnalytics({ version: 'v2', auth });

  const now = new Date();
  const endDate = now.toISOString().slice(0, 10);
  const start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
  const startDate = start.toISOString().slice(0, 10);

  console.log(`Querying YouTube Analytics from ${startDate} to ${endDate} for channel==MINE...`);

  try {
    const res = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained',
      dimensions: 'day',
      sort: 'day'
    });

    console.log('\n=== YOUTUBE ANALYTICS API RESPONSE SUCCESS! ===');
    console.log('Column Headers:', res.data.columnHeaders.map(c => c.name).join(' | '));
    console.log(`Total Days of Data: ${res.data.rows?.length || 0}`);
    
    if (res.data.rows && res.data.rows.length > 0) {
      console.log('\nRecent 10 days metrics:');
      res.data.rows.slice(-10).forEach(row => {
        console.log(`Day: ${row[0]} | Views: ${row[1]} | Watch Min: ${Number(row[2]).toFixed(1)} | Avg Duration: ${Number(row[3]).toFixed(1)}s | Avg %: ${Number(row[4]).toFixed(1)}% | Subs+: ${row[5]}`);
      });
    }

    // Also test traffic source query
    console.log('\nQuerying Traffic Sources...');
    const trafficRes = await analytics.reports.query({
      ids: 'channel==MINE',
      startDate,
      endDate,
      metrics: 'views,estimatedMinutesWatched',
      dimensions: 'insightTrafficSourceType',
      sort: '-views'
    });

    console.log('\n=== TRAFFIC SOURCES ===');
    if (trafficRes.data.rows) {
      trafficRes.data.rows.forEach(row => {
        console.log(`Source: ${row[0].padEnd(30)} | Views: ${String(row[1]).padStart(6)} | Watch Time (min): ${Number(row[2]).toFixed(1)}`);
      });
    }

    return true;
  } catch (err) {
    console.error('\n=== YOUTUBE ANALYTICS API FAILED ===');
    console.error('Error message:', err.message);
    if (err.errors) {
      console.error('Detailed errors:', JSON.stringify(err.errors, null, 2));
    }
    return false;
  }
}

testAnalytics();
