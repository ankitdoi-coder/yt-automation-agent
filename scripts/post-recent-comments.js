const { CredentialManager } = require('../utils/credential-manager');

async function main() {
  const cm = new CredentialManager();
  await cm.initialize();
  const youtube = cm.getYouTubeClient();
  if (!youtube) {
    console.error('No YouTube client available');
    process.exit(1);
  }

  const rawData = require('../analytics/raw/analytics-raw-2026-11-07.json');
  const recentVideos = (rawData.videos || []).slice(0, 10);
  console.log(`Checking comments for ${recentVideos.length} recent videos...`);

  let postedCount = 0;
  for (const v of recentVideos) {
    const videoId = v.id;
    if (!videoId) continue;
    console.log(`\nVideo: ${videoId} - "${v.title}"`);
    try {
      // Check existing comments
      const threadRes = await youtube.commentThreads.list({
        part: 'snippet',
        videoId: videoId,
        maxResults: 5
      }).catch(e => {
        return { data: { items: [], error: e.message } };
      });

      const items = threadRes.data?.items || [];
      console.log(`Current comments count: ${items.length}`);

      if (items.length === 0) {
        console.log(`Posting engagement comment on ${videoId}...`);
        const commentText = '🎯 आज के टेस्ट में आपका स्कोर कितना रहा? 3 में से कितने सही हुए, कमेंट करके बताएं! 🏆\n🔔 रोज़ाना नए GK Tests के लिए ExamIQ Bharat को Subscribe करें!';
        const postRes = await youtube.commentThreads.insert({
          part: 'snippet',
          requestBody: {
            snippet: {
              videoId: videoId,
              topLevelComment: {
                snippet: {
                  textOriginal: commentText
                }
              }
            }
          }
        });
        console.log(`✅ Successfully posted comment! Comment ID: ${postRes.data?.id}`);
        postedCount++;
      } else {
        console.log(`Already has ${items.length} comment(s), skipping.`);
      }
    } catch (err) {
      console.error(`❌ Error for ${videoId}:`, err.message);
    }
  }

  console.log(`\n🎉 Total comments successfully posted: ${postedCount}`);
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
