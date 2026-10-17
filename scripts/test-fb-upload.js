require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

async function testFacebookUpload() {
  const pageId = process.env.FB_PAGE_ID;
  const accessToken = process.env.FB_PAGE_ACCESS_TOKEN;

  console.log('--- 1. Facebook Page & Token Verification ---');
  console.log(`Target Page ID: ${pageId}`);

  try {
    const pageCheck = await axios.get(`https://graph.facebook.com/v21.0/${pageId}`, {
      params: {
        fields: 'id,name,category',
        access_token: accessToken,
      },
    });
    console.log(`✅ Page Verified: ${pageCheck.data.name} (ID: ${pageCheck.data.id})`);
  } catch (err) {
    console.error('❌ Token Verification Failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 2. Select a video file
  const videoPath = path.resolve(__dirname, '../data/videos/prod_1791705421709_xrc9ww8m4m_63trgy33jbc_final.mp4');
  if (!fs.existsSync(videoPath)) {
    console.error(`❌ Video file not found at: ${videoPath}`);
    process.exit(1);
  }

  const fileStats = fs.statSync(videoPath);
  console.log(`\n--- 2. Video Details ---`);
  console.log(`File: ${path.basename(videoPath)}`);
  console.log(`Size: ${(fileStats.size / (1024 * 1024)).toFixed(2)} MB`);

  // 3. Upload to Facebook
  console.log(`\n--- 3. Uploading Video to Facebook Page ---`);
  const form = new FormData();
  form.append('access_token', accessToken);
  form.append('title', 'Exam IQ Bharat - Special Education Quiz & GK Test');
  form.append('description', 'Exam IQ Bharat Practice Session #ExamIQ #GK #Education #CurrentAffairs #StudyWithMe');
  form.append('source', fs.createReadStream(videoPath));

  try {
    const uploadRes = await axios.post(
      `https://graph.facebook.com/v21.0/${pageId}/videos`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000,
      }
    );

    console.log('\n🎉 Video Successfully Uploaded to Facebook!');
    console.log(`Facebook Video ID: ${uploadRes.data.id}`);
    console.log(`Video URL: https://www.facebook.com/${uploadRes.data.id}`);
    console.log(`Page URL: https://www.facebook.com/${pageId}`);
  } catch (err) {
    console.error('\n❌ Video Upload Failed:', err.response?.data || err.message);
    process.exit(1);
  }
}

testFacebookUpload();
