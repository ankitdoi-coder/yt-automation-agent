/**
 * YouTube to Facebook Reels Auto-Routing Utility
 * Cross-posts high-retention ExamIQ vertical Shorts to Facebook Page Reels
 * 
 * Usage:
 *   node scripts/route-yt-to-fb.js --check
 *   node scripts/route-yt-to-fb.js --video "path/to/video.mp4" --title "GK Quiz"
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { FacebookUploader } = require('../facebook/fb-uploader');

async function main() {
  const args = process.argv.slice(2);
  const pageId = process.env.FB_PAGE_ID;
  const token = process.env.FB_PAGE_ACCESS_TOKEN;

  console.log('====================================================');
  console.log('📲 ExamIQ Bharat: YouTube ➔ Facebook Reels Router');
  console.log('====================================================');

  if (!pageId || !token) {
    console.error('❌ Missing FB_PAGE_ID or FB_PAGE_ACCESS_TOKEN in .env');
    process.exit(1);
  }

  // 1. Check Page Status & Health
  try {
    const pageRes = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
      params: { fields: 'id,name,category,followers_count,fan_count', access_token: token },
      timeout: 10000,
    });
    console.log(`✅ Connected Page: "${pageRes.data.name}" (ID: ${pageRes.data.id})`);
    if (pageRes.data.followers_count !== undefined) {
      console.log(`👥 Followers: ${pageRes.data.followers_count || 0}`);
    }
  } catch (err) {
    console.error('❌ Failed to verify Facebook Page token:', err.response?.data || err.message);
    process.exit(1);
  }

  // Check mode: just inspect
  if (args.includes('--check')) {
    console.log('\n📊 Fetching Recent Video Reach on Facebook...');
    try {
      const vidsRes = await axios.get(`https://graph.facebook.com/v21.0/${pageId}/videos`, {
        params: {
          fields: 'id,title,created_time,views,likes.summary(true),comments.summary(true)',
          limit: 10,
          access_token: token,
        },
        timeout: 12000,
      });
      const vids = vidsRes.data?.data || [];
      console.log(`Found ${vids.length} recent videos on page:`);
      vids.forEach((v, idx) => {
        const views = v.views || 0;
        const likes = v.likes?.summary?.total_count || 0;
        const comments = v.comments?.summary?.total_count || 0;
        console.log(`  ${idx + 1}. [${v.created_time.slice(0, 10)}] "${(v.title || 'Untitled').slice(0, 45)}..." -> Views: ${views} | Likes: ${likes} | Comments: ${comments}`);
      });
    } catch (err) {
      console.error('❌ Failed fetching video metrics:', err.message);
    }
    return;
  }

  // Video upload mode
  const videoIdx = args.indexOf('--video');
  const videoPath = videoIdx !== -1 && args[videoIdx + 1] ? path.resolve(args[videoIdx + 1]) : null;

  if (videoPath) {
    if (!fs.existsSync(videoPath)) {
      console.error(`❌ File not found: ${videoPath}`);
      process.exit(1);
    }
    const titleIdx = args.indexOf('--title');
    const title = titleIdx !== -1 && args[titleIdx + 1] ? args[titleIdx + 1] : 'सामान्य ज्ञान GK Quiz | Exam IQ Bharat';

    const uploader = new FacebookUploader();
    const result = await uploader.uploadVideo(videoPath, { title });
    console.log('\n🎉 Successfully published to Facebook Reels!');
    console.log(`URL: ${result.url}`);
  } else {
    console.log('\nℹ️ Info: YouTube shorts are now AUTOMATICALLY routed to Facebook Reels during publishing.');
    console.log('To manually upload a video:');
    console.log('  node scripts/route-yt-to-fb.js --video path/to/video.mp4 --title "My Title"');
  }
}

main().catch(err => {
  console.error('❌ Router Error:', err.message);
  process.exit(1);
});
