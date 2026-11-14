/**
 * Zernio (formerly getlate.dev) Automatic Social Reels Uploader
 * (Facebook Pages + Instagram Creator/Business Accounts)
 *
 * Publishes vertical 9:16 Reels publicly to connected Facebook Pages & Instagram Accounts via
 * Zernio's already-approved Meta Live App — zero manual Business Suite upload,
 * zero Business Verification/GST, and zero custom Meta App Review needed.
 *
 * API Flow (https://zernio.com/docs):
 *   1. GET /v1/accounts -> auto-discover active Facebook Page & Instagram account _ids
 *   2. POST /v1/media/presign -> get S3/R2 uploadUrl + publicUrl
 *   3. PUT {uploadUrl} -> upload MP4 binary
 *   4. POST /v1/posts -> publish Reel with platformSpecificData:
 *        - Facebook: { contentType: 'reel', firstComment }
 *        - Instagram: { contentType: 'reel', shareToFeed: true, firstComment }
 *   5. GET /v1/posts/{postId} -> poll when async status is 'publishing' to capture live Reel URLs
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const { humanizeCaption } = require('../utils/caption-humanizer');
const { autoFixCaption, lintCaption } = require('../utils/caption-linter');

const DEFAULT_ZERNIO_BASE_URL = 'https://zernio.com/api/v1';

/**
 * Redacts sensitive API tokens from logged error strings.
 */
function redactApiKey(text, apiKey) {
  const msg = String(text || '');
  if (!apiKey) return msg;
  return msg.split(apiKey).join('[REDACTED_ZERNIO_KEY]');
}

/**
 * Extracts a numeric Facebook Reel/Video ID from a published Facebook URL if available.
 */
function extractFacebookVideoId(url) {
  const raw = String(url || '');
  const match = raw.match(/\/(?:reel|videos)\/(\d+)/) || raw.match(/[?&](?:v|fbid)=(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extracts an Instagram Reel shortcode or media ID from an Instagram URL.
 */
function extractInstagramReelId(url) {
  const raw = String(url || '');
  const match = raw.match(/\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

class ZernioUploader {
  constructor(options = {}) {
    this.apiKey = String(options.apiKey ?? process.env.ZERNIO_API_KEY ?? '').trim();
    this.accountId = String(options.accountId ?? process.env.ZERNIO_FACEBOOK_ACCOUNT_ID ?? '').trim() || null;
    this.instagramAccountId = String(options.instagramAccountId ?? process.env.ZERNIO_INSTAGRAM_ACCOUNT_ID ?? '').trim() || null;
    this.baseUrl = String(options.baseUrl || process.env.ZERNIO_BASE_URL || DEFAULT_ZERNIO_BASE_URL).replace(/\/+$/, '');
    this.http = options.httpClient || axios;
    this.pollIntervalMs = options.pollIntervalMs ?? 5000;
    this.maxPolls = options.maxPolls ?? 12;

    if (!this.apiKey) {
      throw new Error('ZERNIO_API_KEY must be configured (free tier at https://zernio.com)');
    }
  }

  _authHeaders(extra = {}) {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      ...extra,
    };
  }

  /**
   * Extracts platform status, URLs, and errors for a specific target platform ('facebook' or 'instagram').
   */
  _extractPlatformState(post = {}, targetPlatform = 'facebook') {
    const platforms = Array.isArray(post.platforms) ? post.platforms : [];
    const target = String(targetPlatform || 'facebook').toLowerCase();
    const plat = platforms.find(p => String(p?.platform || '').toLowerCase() === target) || platforms[0] || {};
    const overallStatus = String(post.status || '').toLowerCase();
    const platformStatus = String(plat.status || overallStatus || '').toLowerCase();
    const platformPostUrl = plat.platformPostUrl || null;

    let externalId = null;
    if (target === 'facebook') {
      externalId = extractFacebookVideoId(platformPostUrl) || plat.platformPostId || null;
    } else if (target === 'instagram') {
      externalId = extractInstagramReelId(platformPostUrl) || plat.platformPostId || null;
    } else {
      externalId = plat.platformPostId || null;
    }

    const zernioPostId = post._id || post.id || null;
    const errorMsg = plat.errorMessage || plat.error || post.errorMessage || post.error || null;

    return {
      zernioPostId,
      overallStatus,
      platform: plat,
      platformStatus,
      platformPostUrl,
      externalId,
      fbVideoId: target === 'facebook' ? externalId : null,
      igMediaId: target === 'instagram' ? externalId : null,
      errorMsg,
    };
  }

  _extractFacebookPlatformState(post = {}) {
    const s = this._extractPlatformState(post, 'facebook');
    return {
      zernioPostId: s.zernioPostId,
      overallStatus: s.overallStatus,
      fbPlatform: s.platform,
      platformStatus: s.platformStatus,
      platformPostUrl: s.platformPostUrl,
      fbVideoId: s.fbVideoId,
      errorMsg: s.errorMsg,
    };
  }

  _extractInstagramPlatformState(post = {}) {
    const s = this._extractPlatformState(post, 'instagram');
    return {
      zernioPostId: s.zernioPostId,
      overallStatus: s.overallStatus,
      igPlatform: s.platform,
      platformStatus: s.platformStatus,
      platformPostUrl: s.platformPostUrl,
      igMediaId: s.igMediaId,
      errorMsg: s.errorMsg,
    };
  }

  /**
   * Resolves the connected Facebook Page accountId from ZERNIO_FACEBOOK_ACCOUNT_ID or GET /v1/accounts.
   */
  async resolveFacebookAccountId() {
    if (this.accountId) {
      return this.accountId;
    }

    try {
      const res = await this.http.get(`${this.baseUrl}/accounts`, {
        headers: this._authHeaders(),
        timeout: 20000,
      });

      const accounts = Array.isArray(res.data?.accounts)
        ? res.data.accounts
        : (Array.isArray(res.data) ? res.data : []);

      const fbAccounts = accounts.filter(a => String(a?.platform || '').toLowerCase() === 'facebook');
      const activeFb = fbAccounts.find(a => String(a?.status || '').toLowerCase() === 'active') || fbAccounts[0];
      const resolvedId = activeFb?._id || activeFb?.id;

      if (!resolvedId) {
        throw new Error(
          'No connected Facebook Page found in Zernio. Log in at https://zernio.com -> Connections -> connect your Exam IQ Bharat Facebook Page first.'
        );
      }

      this.accountId = String(resolvedId);
      console.log(`[ZernioUploader] ✅ Auto-detected Facebook Page account: ${activeFb.displayName || activeFb.username || this.accountId} (${this.accountId})`);
      return this.accountId;
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(redactApiKey(`Failed to resolve Zernio Facebook account: ${detail}`, this.apiKey));
    }
  }

  /**
   * Resolves the connected Instagram Professional/Creator accountId from ZERNIO_INSTAGRAM_ACCOUNT_ID or GET /v1/accounts.
   */
  async resolveInstagramAccountId() {
    if (this.instagramAccountId) {
      return this.instagramAccountId;
    }

    try {
      const res = await this.http.get(`${this.baseUrl}/accounts`, {
        headers: this._authHeaders(),
        timeout: 20000,
      });

      const accounts = Array.isArray(res.data?.accounts)
        ? res.data.accounts
        : (Array.isArray(res.data) ? res.data : []);

      const igAccounts = accounts.filter(a => String(a?.platform || '').toLowerCase() === 'instagram');
      const activeIg = igAccounts.find(a => String(a?.status || '').toLowerCase() === 'active') || igAccounts[0];
      const resolvedId = activeIg?._id || activeIg?.id;

      if (!resolvedId) {
        throw new Error(
          'No connected Instagram account found in Zernio. Log in at https://zernio.com -> Connections -> connect your Instagram Creator/Business account first.'
        );
      }

      this.instagramAccountId = String(resolvedId);
      console.log(`[ZernioUploader] ✅ Auto-detected Instagram account: ${activeIg.displayName || activeIg.username || this.instagramAccountId} (${this.instagramAccountId})`);
      return this.instagramAccountId;
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(redactApiKey(`Failed to resolve Zernio Instagram account: ${detail}`, this.apiKey));
    }
  }

  /**
   * Uploads an MP4 binary via Zernio presigned storage and returns its publicUrl.
   */
  async uploadVideoMedia(videoPath) {
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const buffer = fs.readFileSync(videoPath);
    const filename = path.basename(videoPath);

    let presignRes;
    try {
      presignRes = await this.http.post(
        `${this.baseUrl}/media/presign`,
        {
          filename,
          contentType: 'video/mp4',
          size: buffer.length,
        },
        {
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          timeout: 30000,
        }
      );
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(redactApiKey(`Zernio presign failed: ${detail}`, this.apiKey));
    }

    const uploadUrl = presignRes.data?.uploadUrl;
    const publicUrl = presignRes.data?.publicUrl;
    if (!uploadUrl || !publicUrl) {
      throw new Error(`Zernio presign response missing uploadUrl/publicUrl: ${JSON.stringify(presignRes.data)}`);
    }

    try {
      await this.http.put(uploadUrl, buffer, {
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(buffer.length),
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        timeout: 180000,
      });
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(redactApiKey(`Zernio binary upload failed: ${detail}`, this.apiKey));
    }

    console.log(`[ZernioUploader] ✅ Uploaded MP4 to Zernio media storage (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
    return { uploadUrl, publicUrl };
  }

  /**
   * Polls GET /v1/posts/{postId} when Zernio accepts a Reel asynchronously
   * so live URLs and any async failures are captured.
   */
  async waitForPostCompletion(zernioPostId, initialPost = {}, targetPlatform = 'facebook') {
    let latestPost = initialPost;
    const targets = Array.isArray(targetPlatform) ? targetPlatform : [targetPlatform];

    for (const t of targets) {
      const state = this._extractPlatformState(latestPost, t);
      if (state.platformStatus === 'failed' || state.overallStatus === 'failed') {
        throw new Error(`Zernio reported ${t} publish failure: ${state.errorMsg || JSON.stringify(latestPost)}`);
      }
    }

    const allDone = targets.every(t => {
      const s = this._extractPlatformState(latestPost, t);
      return s.platformPostUrl || s.platformStatus === 'published' || s.overallStatus === 'published';
    });

    if (allDone || !zernioPostId || this.maxPolls <= 0) {
      return latestPost;
    }

    console.log(`[ZernioUploader] ⏳ Zernio accepted Reel (${zernioPostId}); checking ${targets.join('/')} publish status...`);

    for (let attempt = 1; attempt <= this.maxPolls; attempt++) {
      if (this.pollIntervalMs > 0) {
        await new Promise(resolve => setTimeout(resolve, this.pollIntervalMs));
      }
      try {
        const pollRes = await this.http.get(`${this.baseUrl}/posts/${zernioPostId}`, {
          headers: this._authHeaders(),
          timeout: 20000,
        });
        latestPost = pollRes.data?.post || pollRes.data || latestPost;

        for (const t of targets) {
          const s = this._extractPlatformState(latestPost, t);
          if (s.platformStatus === 'failed' || s.overallStatus === 'failed') {
            throw new Error(`Zernio reported ${t} publish failure: ${s.errorMsg || JSON.stringify(latestPost)}`);
          }
        }

        const isComplete = targets.every(t => {
          const s = this._extractPlatformState(latestPost, t);
          return s.platformPostUrl || s.platformStatus === 'published' || s.overallStatus === 'published';
        });

        if (isComplete) {
          return latestPost;
        }
      } catch (err) {
        if (String(err.message || '').includes('publish failure:')) {
          throw err;
        }
        const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
        console.warn(`[ZernioUploader] ℹ️ Status poll attempt ${attempt}/${this.maxPolls}: ${redactApiKey(detail, this.apiKey)}`);
      }
    }

    return latestPost;
  }

  async _postAndAwaitCompletion(payload, targetPlatform = 'facebook') {
    let postRes;
    try {
      postRes = await this.http.post(`${this.baseUrl}/posts`, payload, {
        headers: this._authHeaders({ 'Content-Type': 'application/json' }),
        timeout: 120000,
      });
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(redactApiKey(`Zernio publishReel failed: ${detail}`, this.apiKey));
    }

    const initialPost = postRes.data?.post || postRes.data || {};
    return this.waitForPostCompletion(initialPost._id || initialPost.id, initialPost, targetPlatform);
  }

  /**
   * Cleans, humanizes, and optimizes captions for mobile fold breaks.
   */
  _prepareCaption(rawCaption, { platform = 'generic', item = {} } = {}) {
    let caption = String(rawCaption || '').trim();
    if (!caption) return caption;

    // 1. Humanize: strip ChatGPT/AI tells
    const humanized = humanizeCaption(caption);
    if (humanized.changesCount > 0) {
      console.log(`[ZernioUploader] ✍️ Caption humanized: ${humanized.changesCount} AI tells removed`);
      caption = humanized.humanized;
    }

    // 2. Lint and auto-fix for Instagram fold break (~125 chars)
    if (platform === 'instagram' || platform === 'both') {
      const lintResult = lintCaption(caption);
      if (!lintResult.passed) {
        console.log(`[ZernioUploader] ⚠️ Caption fold warnings: ${lintResult.issues.concat(lintResult.warnings).join(', ')}`);
        const fixed = autoFixCaption(caption, item);
        if (fixed.fixed) {
          caption = fixed.caption;
          console.log(`[ZernioUploader] ✅ Caption auto-fixed: ${fixed.changes.join(', ')}`);
        }
      }
      console.log(`[ZernioUploader] 📱 Instagram fold preview (${Math.min(caption.length, 125)} chars): "${caption.slice(0, 125)}"`);
    }

    return caption;
  }

  /**
   * Publishes a vertical video as a public Facebook Reel.
   */
  async publishFacebookReel(videoPath, { title, description, firstComment, item = {} } = {}) {
    const accountId = await this.resolveFacebookAccountId();
    const { publicUrl } = await this.uploadVideoMedia(videoPath);
    const rawContent = description || title || 'सामान्य ज्ञान GK Quiz | Exam IQ Bharat #Reels';
    const content = this._prepareCaption(rawContent, { platform: 'facebook', item });

    const strategies = [];
    if (firstComment) {
      strategies.push({
        label: 'reel + firstComment',
        platformEntry: {
          platform: 'facebook',
          accountId,
          platformSpecificData: { contentType: 'reel', firstComment },
        },
      });
    }
    strategies.push({
      label: 'core contentType=reel',
      platformEntry: {
        platform: 'facebook',
        accountId,
        platformSpecificData: { contentType: 'reel' },
      },
    });
    strategies.push({
      label: 'default single vertical video',
      platformEntry: { platform: 'facebook', accountId },
    });

    let post = null;
    for (let idx = 0; idx < strategies.length; idx++) {
      const strategy = strategies[idx];
      const payload = {
        content,
        mediaItems: [{ type: 'video', url: publicUrl }],
        platforms: [strategy.platformEntry],
        publishNow: true,
      };
      try {
        post = await this._postAndAwaitCompletion(payload, 'facebook');
        break;
      } catch (err) {
        const hasFallback = idx < strategies.length - 1;
        const msg = String(err.message || '');
        const isParamErr = /(rejected|parameter|invalid|firstComment|title|contentType|unsupported)/i.test(msg);
        if (!hasFallback || !isParamErr) {
          throw err;
        }
        console.warn(`[ZernioUploader] ⚠️ Strategy "${strategy.label}" rejected (${msg}); retrying with "${strategies[idx + 1].label}"...`);
      }
    }
    const {
      zernioPostId,
      platformStatus,
      platformPostUrl,
      fbVideoId,
    } = this._extractFacebookPlatformState(post);
    const finalUrl = platformPostUrl || (fbVideoId ? `https://www.facebook.com/reel/${fbVideoId}` : null);
    const finalStatus = platformStatus || 'published';

    if (finalUrl) {
      console.log(`[ZernioUploader] 🎉 Public Facebook Reel published automatically! URL: ${finalUrl}`);
    } else {
      console.log(`[ZernioUploader] ⏳ Zernio accepted Reel (Post ID: ${zernioPostId}, status: ${finalStatus}) — check Zernio dashboard if still processing.`);
    }

    return {
      success: true,
      platform: 'facebook',
      id: fbVideoId || zernioPostId,
      fbVideoId,
      zernioPostId,
      url: finalUrl,
      status: finalStatus,
      deliveryMode: 'ZERNIO_API',
      reelsFeed: true,
      publicUrl,
    };
  }

  /**
   * Publishes a vertical video as a public Instagram Reel.
   */
  async publishInstagramReel(videoPath, { title, description, firstComment, shareToFeed = true, item = {} } = {}) {
    const accountId = await this.resolveInstagramAccountId();
    const { publicUrl } = await this.uploadVideoMedia(videoPath);
    const rawContent = description || title || 'सामान्य ज्ञान GK Quiz | Exam IQ Bharat #Reels';
    const content = this._prepareCaption(rawContent, { platform: 'instagram', item });

    const strategies = [];
    if (firstComment) {
      strategies.push({
        label: 'reel + shareToFeed + firstComment',
        platformEntry: {
          platform: 'instagram',
          accountId,
          platformSpecificData: { contentType: 'reel', shareToFeed, firstComment },
        },
      });
    }
    strategies.push({
      label: 'reel + shareToFeed',
      platformEntry: {
        platform: 'instagram',
        accountId,
        platformSpecificData: { contentType: 'reel', shareToFeed },
      },
    });
    strategies.push({
      label: 'core reel',
      platformEntry: {
        platform: 'instagram',
        accountId,
        platformSpecificData: { contentType: 'reel' },
      },
    });
    strategies.push({
      label: 'default single video',
      platformEntry: { platform: 'instagram', accountId },
    });

    let post = null;
    for (let idx = 0; idx < strategies.length; idx++) {
      const strategy = strategies[idx];
      const payload = {
        content,
        mediaItems: [{ type: 'video', url: publicUrl }],
        platforms: [strategy.platformEntry],
        publishNow: true,
      };
      try {
        post = await this._postAndAwaitCompletion(payload, 'instagram');
        break;
      } catch (err) {
        const hasFallback = idx < strategies.length - 1;
        const msg = String(err.message || '');
        const isParamErr = /(rejected|parameter|invalid|firstComment|title|contentType|unsupported|shareToFeed)/i.test(msg);
        if (!hasFallback || !isParamErr) {
          throw err;
        }
        console.warn(`[ZernioUploader] ⚠️ Instagram strategy "${strategy.label}" rejected (${msg}); retrying with "${strategies[idx + 1].label}"...`);
      }
    }

    const {
      zernioPostId,
      platformStatus,
      platformPostUrl,
      igMediaId,
    } = this._extractInstagramPlatformState(post);
    const finalUrl = platformPostUrl || (igMediaId ? `https://www.instagram.com/reel/${igMediaId}` : null);
    const finalStatus = platformStatus || 'published';

    if (finalUrl) {
      console.log(`[ZernioUploader] 🎉 Public Instagram Reel published automatically! URL: ${finalUrl}`);
    } else {
      console.log(`[ZernioUploader] ⏳ Zernio accepted Instagram Reel (Post ID: ${zernioPostId}, status: ${finalStatus}) — check Zernio dashboard if still processing.`);
    }

    return {
      success: true,
      platform: 'instagram',
      id: igMediaId || zernioPostId,
      igMediaId,
      zernioPostId,
      url: finalUrl,
      status: finalStatus,
      deliveryMode: 'ZERNIO_API',
      reelsFeed: true,
      publicUrl,
    };
  }

  /**
   * Publishes a vertical video to BOTH Facebook and Instagram simultaneously in a single upload.
   */
  async publishMultiReel(videoPath, { title, description, firstComment, shareToFeed = true, targets = ['facebook', 'instagram'], item = {} } = {}) {
    console.log(`[ZernioUploader] 🌐 Publishing Reel across platforms: ${targets.join(', ')}...`);
    const { publicUrl } = await this.uploadVideoMedia(videoPath);
    const rawContent = description || title || 'सामान्य ज्ञान GK Quiz | Exam IQ Bharat #Reels';
    const content = this._prepareCaption(rawContent, { platform: 'both', item });

    const platformEntries = [];
    const resolvedTargets = [];

    for (const target of targets) {
      const t = String(target).toLowerCase();
      if (t === 'facebook') {
        try {
          const accountId = await this.resolveFacebookAccountId();
          platformEntries.push({
            platform: 'facebook',
            accountId,
            platformSpecificData: { contentType: 'reel', ...(firstComment ? { firstComment } : {}) },
          });
          resolvedTargets.push('facebook');
        } catch (err) {
          console.warn(`[ZernioUploader] ⚠️ Could not resolve Facebook account (${err.message}).`);
        }
      } else if (t === 'instagram') {
        try {
          const accountId = await this.resolveInstagramAccountId();
          platformEntries.push({
            platform: 'instagram',
            accountId,
            platformSpecificData: { contentType: 'reel', shareToFeed, ...(firstComment ? { firstComment } : {}) },
          });
          resolvedTargets.push('instagram');
        } catch (err) {
          console.warn(`[ZernioUploader] ⚠️ Could not resolve Instagram account (${err.message}).`);
        }
      }
    }

    if (platformEntries.length === 0) {
      throw new Error('No valid social accounts (Facebook or Instagram) could be resolved in Zernio.');
    }

    const payload = {
      content,
      mediaItems: [{ type: 'video', url: publicUrl }],
      platforms: platformEntries,
      publishNow: true,
    };

    const post = await this._postAndAwaitCompletion(payload, resolvedTargets);

    const fbState = resolvedTargets.includes('facebook') ? this._extractFacebookPlatformState(post) : null;
    const igState = resolvedTargets.includes('instagram') ? this._extractInstagramPlatformState(post) : null;

    const fbUrl = fbState?.platformPostUrl || (fbState?.fbVideoId ? `https://www.facebook.com/reel/${fbState.fbVideoId}` : null);
    const igUrl = igState?.platformPostUrl || (igState?.igMediaId ? `https://www.instagram.com/reel/${igState.igMediaId}` : null);

    if (fbUrl) console.log(`[ZernioUploader] 🎉 Facebook Reel: ${fbUrl}`);
    if (igUrl) console.log(`[ZernioUploader] 🎉 Instagram Reel: ${igUrl}`);

    return {
      success: true,
      deliveryMode: 'ZERNIO_API',
      zernioPostId: post._id || post.id,
      facebook: fbState ? { id: fbState.fbVideoId || post._id, url: fbUrl, status: fbState.platformStatus } : null,
      instagram: igState ? { id: igState.igMediaId || post._id, url: igUrl, status: igState.platformStatus } : null,
      url: igUrl || fbUrl || (post._id ? `https://zernio.com/posts/${post._id}` : null),
      id: post._id || post.id,
      status: 'published',
      publicUrl,
    };
  }

  /**
   * Main publishing interface with backward compatibility.
   * Dispatches to Facebook, Instagram, or Multi based on options.target or environment.
   */
  async publishReel(videoPath, options = {}) {
    const target = String(
      options.target ||
      options.platform ||
      process.env.SOCIAL_DELIVERY_TARGET ||
      process.env.FB_DELIVERY_TARGET ||
      'facebook'
    ).toLowerCase();

    if (target === 'instagram') {
      return this.publishInstagramReel(videoPath, options);
    }
    if (target === 'both' || target === 'multi' || target === 'all') {
      return this.publishMultiReel(videoPath, options);
    }
    return this.publishFacebookReel(videoPath, options);
  }
}

module.exports = {
  DEFAULT_ZERNIO_BASE_URL,
  ZernioUploader,
  extractFacebookVideoId,
  extractInstagramReelId,
  redactApiKey,
};
