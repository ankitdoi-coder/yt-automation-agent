/**
 * Facebook Graph API Reels & Video Uploader
 */

require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const { lintTitleAndThumbnail } = require('../utils/title-thumbnail-linter');

class FacebookUploader {
  constructor(pageId = null, accessToken = null) {
    this.pageId = pageId || process.env.FB_PAGE_ID;
    this.accessToken = accessToken || process.env.FB_PAGE_ACCESS_TOKEN;

    if (!this.pageId || !this.accessToken) {
      throw new Error('FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN must be configured in .env');
    }
  }

  async uploadReel(videoPath, riddleItem) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Reel video file not found: ${videoPath}`);
    }

    const title = `${riddleItem.title} 🤔 | मजेदार पहेलियां`;
    const caption = [
      `🔥 दम है तो बताओ! ${riddleItem.questionLines.join(' ')} 😜`,
      '',
      `👉 कमेंट में बताओ आपका दिमाग पहले कहां गया था! 👇😂`,
      '',
      riddleItem.tags ? riddleItem.tags.join(' ') : '#reels #facebookreels #paheliyan #funny #jokes #desicomedy #viral'
    ].join('\n');

    // Audit Packaging (Title & Hook)
    const titleAudit = lintTitleAndThumbnail(title, riddleItem.title);
    if (!titleAudit.isPassing) {
      console.log(`[FacebookUploader] ⚠️ Packaging audit warning (${titleAudit.score}/100): ${titleAudit.issues.map(i => i[1]).join(' | ')}`);
    } else {
      console.log(`[FacebookUploader] ✅ Packaging audit passed (${titleAudit.score}/100)`);
    }

    console.log(`[FacebookUploader] Uploading to Facebook Page (${this.pageId})...`);

    const form = new FormData();
    form.append('access_token', this.accessToken);
    form.append('title', title);
    form.append('description', caption);
    form.append('source', fs.createReadStream(videoPath));

    const response = await axios.post(
      `https://graph-video.facebook.com/v21.0/${this.pageId}/videos`,
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 120000,
      }
    );

    const videoId = response.data?.id;
    console.log(`[FacebookUploader] ✅ Reel published successfully! Video ID: ${videoId}`);

    return {
      success: true,
      id: videoId,
      url: `https://www.facebook.com/reel/${videoId}`,
      pageUrl: `https://www.facebook.com/${this.pageId}`,
      title,
      titleAudit,
    };
  }
}

module.exports = {
  FacebookUploader,
};
