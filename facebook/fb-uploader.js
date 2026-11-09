/**
 * Facebook Graph API Reels & Video Uploader
 * 
 * Routes vertical videos directly into Meta's public Reels Discovery Feed algorithm
 * using the official Meta Reels Publishing API:
 *   - Step 1: Initialize session (POST /{page-id}/video_reels?upload_phase=start)
 *   - Step 2: Binary transfer (POST {upload_url} to Meta rupload servers)
 *   - Step 3: Finish & Publish (POST /{page-id}/video_reels?upload_phase=finish&video_state=PUBLISHED)
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

  /**
   * Publishes video directly to Meta's Reels Discovery Feed algorithm
   */
  async publishReel(videoPath, { title, description } = {}) {
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

    const fileSize = fs.statSync(videoPath).size;
    console.log(`[FacebookUploader] 🎬 Meta Reels Publishing API started for Page (${this.pageId})... (Size: ${(fileSize / (1024 * 1024)).toFixed(2)} MB)`);

    // ========================================================
    // Step 1: Start Session -> POST /{page-id}/video_reels
    // ========================================================
    console.log(`[FacebookUploader] 📡 Step 1/3: Initializing Reel session on Meta Reels endpoint...`);
    const initRes = await axios.post(
      `https://graph.facebook.com/v21.0/${this.pageId}/video_reels`,
      null,
      {
        params: {
          upload_phase: 'start',
          access_token: this.accessToken,
        },
        timeout: 30000,
      }
    );

    const videoId = initRes.data?.video_id;
    if (!videoId) {
      throw new Error(`Meta Reels API did not return video_id: ${JSON.stringify(initRes.data)}`);
    }

    const uploadUrl = initRes.data?.upload_url || `https://rupload.facebook.com/video-upload/v21.0/${videoId}`;
    console.log(`[FacebookUploader] ✅ Session initialized! Video ID: ${videoId}`);

    // ========================================================
    // Step 2: Binary Video Transfer -> POST {upload_url}
    // ========================================================
    console.log(`[FacebookUploader] 📤 Step 2/3: Transferring video binary stream to Meta rupload servers...`);
    const videoStream = fs.createReadStream(videoPath);
    await axios.post(uploadUrl, videoStream, {
      headers: {
        'Authorization': `OAuth ${this.accessToken}`,
        'offset': '0',
        'file_size': String(fileSize),
        'Content-Length': String(fileSize),
        'Content-Type': 'application/octet-stream',
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 180000,
    });
    console.log(`[FacebookUploader] ✅ Video binary transferred successfully!`);

    // ========================================================
    // Step 3: Finish & Publish -> POST /{page-id}/video_reels
    // ========================================================
    console.log(`[FacebookUploader] 🚀 Step 3/3: Publishing to Meta Reels Discovery Feed (video_state: PUBLISHED)...`);
    const finishParams = {
      upload_phase: 'finish',
      access_token: this.accessToken,
      video_id: videoId,
      video_state: 'PUBLISHED',
      description: cleanCaption,
    };

    let finishRes;
    try {
      finishRes = await axios.post(
        `https://graph.facebook.com/v21.0/${this.pageId}/video_reels`,
        null,
        {
          params: finishParams,
          timeout: 60000,
        }
      );
    } catch (finishErr) {
      console.error(`[FacebookUploader] ❌ Step 3 publish error:`, finishErr.response?.data || finishErr.message);
      throw finishErr;
    }

    console.log(`[FacebookUploader] 🎉 Reel published to Meta Discovery Feed! Result:`, finishRes.data);

    // ========================================================
    // Step 4: Transcoding & Readiness Verification
    // ========================================================
    let reelStatus = 'processing';
    const pollStart = Date.now();
    const maxPollMs = 25000;
    while (Date.now() - pollStart < maxPollMs) {
      try {
        const statusRes = await axios.get(`https://graph.facebook.com/v21.0/${videoId}`, {
          params: {
            fields: 'status,published',
            access_token: this.accessToken,
          },
          timeout: 10000,
        });
        const currentStatus = statusRes.data?.status?.video_status || statusRes.data?.status;
        if (currentStatus) {
          reelStatus = currentStatus;
        }
        if (reelStatus === 'ready') {
          console.log(`[FacebookUploader] ✅ Reel transcoding complete & LIVE on Meta Reels Feed! (Status: ready)`);
          break;
        }
        if (reelStatus === 'error') {
          console.warn(`[FacebookUploader] ⚠️ Meta reported processing error: ${JSON.stringify(statusRes.data?.status)}`);
          break;
        }
      } catch (_) {
        // Non-critical probe failure
      }
      if (reelStatus === 'ready' || reelStatus === 'published') break;
      await new Promise(r => setTimeout(r, 2000));
    }

    const reelUrl = `https://www.facebook.com/reel/${videoId}`;
    console.log(`[FacebookUploader] 🔗 Live Reels Feed URL: ${reelUrl}`);

    return {
      success: true,
      id: videoId,
      videoId,
      uploadPhase: 'finish',
      status: reelStatus,
      url: reelUrl,
      pageUrl: `https://www.facebook.com/${this.pageId}`,
      title: cleanTitle,
      reelsFeed: true,
      mode: 'REELS_DISCOVERY_FEED',
    };
  }

  /**
   * Primary upload method for Reels (routes to Meta's public Reels Discovery Feed)
   * If caller passes { asTimeline: true }, falls back to standard page timeline upload.
   */
  async uploadVideo(videoPath, options = {}) {
    if (options && options.asTimeline === true) {
      return this.uploadTimelineVideo(videoPath, options);
    }
    return this.publishReel(videoPath, options);
  }

  /**
   * Legacy Timeline Post Video Uploader (shows only to followers on page timeline)
   */
  async uploadTimelineVideo(videoPath, { title, description } = {}) {
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

    console.log(`[FacebookUploader] Uploading standard timeline video to Facebook Page (${this.pageId})...`);

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
    console.log(`[FacebookUploader] ✅ Timeline video published! Video ID: ${videoId}`);

    return {
      success: true,
      id: videoId,
      videoId,
      url: `https://www.facebook.com/reel/${videoId}`,
      pageUrl: `https://www.facebook.com/${this.pageId}`,
      title: cleanTitle,
      reelsFeed: false,
      mode: 'TIMELINE_POST',
    };
  }

  /**
   * Upload Photo Post (/photos)
   */
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

  /**
   * Dedicated Reels Publisher for Riddle/Question items
   */
  async uploadReel(videoPath, riddleItem) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Reel video file not found: ${videoPath}`);
    }

    // If riddleItem doesn't have questionLines, treat as generic metadata
    if (!riddleItem || !Array.isArray(riddleItem.questionLines)) {
      return this.publishReel(videoPath, {
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
      Array.isArray(riddleItem.tags)
        ? riddleItem.tags.join(' ')
        : (typeof riddleItem.tags === 'string' ? riddleItem.tags : '#reels #facebookreels #paheliyan #funny #jokes #desicomedy #viral')
    ].join('\n');

    // Audit Packaging (Title & Hook)
    const titleAudit = lintTitleAndThumbnail(title, riddleItem.title);
    if (!titleAudit.isPassing) {
      console.log(`[FacebookUploader] ⚠️ Packaging audit warning (${titleAudit.score}/100): ${titleAudit.issues.map(i => i[1]).join(' | ')}`);
    } else {
      console.log(`[FacebookUploader] ✅ Packaging audit passed (${titleAudit.score}/100)`);
    }

    const result = await this.publishReel(videoPath, { title, description: caption });

    return {
      ...result,
      titleAudit,
    };
  }
}

module.exports = {
  FacebookUploader,
};
