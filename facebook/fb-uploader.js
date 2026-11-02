/**
 * Facebook Graph API Reels & Video Uploader
 */

require('dotenv').config();
const fs = require('fs');
const axios = require('axios');
const NodeFormData = require('form-data');
const { lintTitleAndThumbnail } = require('../utils/title-thumbnail-linter');

class FacebookUploader {
  constructor(pageId = null, accessToken = null) {
    this.pageId = pageId || process.env.FB_PAGE_ID;
    this.accessToken = accessToken || process.env.FB_PAGE_ACCESS_TOKEN;

    if (!this.pageId || !this.accessToken) {
      throw new Error('FB_PAGE_ID and FB_PAGE_ACCESS_TOKEN must be configured in .env');
    }
  }

  async uploadVideo(videoPath, { title, description } = {}) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const cleanTitle = title || 'सामान्य ज्ञान GK Quiz | Exam IQ Bharat';
    const cleanCaption = description || [
      cleanTitle,
      '',
      '🎯 आज के टेस्ट में आपका स्कोर कितना रहा? 5 में से अपना स्कोर कमेंट करके बताएं! 🏆',
      '🔔 रोज़ाना नए GK Tests और सरकारी परीक्षा तैयारी के लिए Exam IQ Bharat को Follow करें!',
      '',
      '#ExamIQ #GKQuiz #GeneralKnowledge #StaticGK #GKInHindi #SSC #Railway #Reels #FacebookReels #Trending'
    ].join('\n');

    console.log(`[FacebookUploader] Uploading video to Facebook Page (${this.pageId})...`);

    const form = new NodeFormData();
    form.append('access_token', this.accessToken);
    form.append('title', cleanTitle);
    form.append('description', cleanCaption);
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
    console.log(`[FacebookUploader] ✅ Video published to Facebook Reels! Video ID: ${videoId}`);

    return {
      success: true,
      id: videoId,
      url: `https://www.facebook.com/reel/${videoId}`,
      pageUrl: `https://www.facebook.com/${this.pageId}`,
      title: cleanTitle,
    };
  }

  async uploadPhoto(imagePath, { caption } = {}) {
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const cleanCaption = caption || [
      '🎯 आज का महत्वपूर्ण GK टेस्ट! | Exam IQ Bharat',
      '',
      '👇 क्या आप इसका सही जवाब जानते हैं? कमेंट में अपना उत्तर बताएं! 🏆',
      '🔔 रोज़ाना नए GK Tests व सरकारी परीक्षा तैयारी के लिए @ExamIQBharat को Follow करें!',
      '',
      '#ExamIQ #GKQuiz #GeneralKnowledge #StaticGK #GKInHindi #SSC #Railway #DailyGK #QuizTime'
    ].join('\n');

    console.log(`[FacebookUploader] Uploading photo to Facebook Page (${this.pageId})...`);

    const form = new NodeFormData();
    form.append('access_token', this.accessToken);
    form.append('caption', cleanCaption);
    form.append('source', fs.createReadStream(imagePath));

    const response = await axios.post(
      `https://graph.facebook.com/v21.0/${this.pageId}/photos`,
      form,
      {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000,
      }
    );

    const photoId = response.data?.id;
    const postId = response.data?.post_id;
    console.log(`[FacebookUploader] ✅ Photo published to Facebook Page! Photo ID: ${photoId}`);

    return {
      success: true,
      id: photoId,
      postId,
      url: `https://www.facebook.com/${photoId}`,
      pageUrl: `https://www.facebook.com/${this.pageId}`
    };
  }

  async uploadReel(videoPath, riddleItem) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Reel video file not found: ${videoPath}`);
    }

    // If riddleItem doesn't have questionLines, treat as generic video metadata
    if (!riddleItem || !Array.isArray(riddleItem.questionLines)) {
      return this.uploadVideo(videoPath, {
        title: riddleItem?.title,
        description: riddleItem?.description || riddleItem?.caption
      });
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

    const form = new NodeFormData();
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
