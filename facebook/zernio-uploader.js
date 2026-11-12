/**
 * Zernio (formerly getlate.dev) Automatic Facebook Reels Uploader
 *
 * Publishes vertical 9:16 Reels publicly to a connected Facebook Page via
 * Zernio's already-approved Meta Live App — zero manual Business Suite upload,
 * zero Business Verification/GST, and zero custom Meta App Review needed.
 *
 * API Flow (https://zernio.com/docs):
 *   1. (Optional) GET /v1/accounts -> auto-discover active Facebook Page _id
 *   2. POST /v1/media/presign -> get S3/R2 uploadUrl + publicUrl
 *   3. PUT {uploadUrl} -> upload MP4 binary
 *   4. POST /v1/posts -> publish Reel with platformSpecificData: { contentType: 'reel', firstComment }
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');

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

class ZernioUploader {
  constructor(options = {}) {
    this.apiKey = String(options.apiKey ?? process.env.ZERNIO_API_KEY ?? '').trim();
    this.accountId = String(options.accountId ?? process.env.ZERNIO_FACEBOOK_ACCOUNT_ID ?? '').trim() || null;
    this.baseUrl = String(options.baseUrl || process.env.ZERNIO_BASE_URL || DEFAULT_ZERNIO_BASE_URL).replace(/\/+$/, '');
    this.http = options.httpClient || axios;

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
   * Uploads and immediately publishes a vertical video as a public Facebook Reel.
   */
  async publishReel(videoPath, { title, description, firstComment } = {}) {
    const accountId = await this.resolveFacebookAccountId();
    const { publicUrl } = await this.uploadVideoMedia(videoPath);

    const buildPayload = (includeExtras = true) => {
      const platformSpecificData = {
        contentType: 'reel',
      };
      if (includeExtras) {
        if (title) platformSpecificData.title = String(title).slice(0, 255);
        if (firstComment) platformSpecificData.firstComment = firstComment;
      }
      return {
        content: description || title || 'सामान्य ज्ञान GK Quiz | Exam IQ Bharat',
        mediaItems: [{ type: 'video', url: publicUrl }],
        platforms: [
          {
            platform: 'facebook',
            accountId,
            platformSpecificData,
          },
        ],
        publishNow: true,
      };
    };

    let postRes;
    try {
      postRes = await this.http.post(`${this.baseUrl}/posts`, buildPayload(true), {
        headers: this._authHeaders({ 'Content-Type': 'application/json' }),
        timeout: 120000,
      });
    } catch (err) {
      const status = err.response?.status;
      const errBody = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      // Retry cleanly without optional Reel title/firstComment only if rejected as unsupported field
      if ((status === 400 || status === 422) && /(firstComment|title)/i.test(errBody)) {
        console.warn('[ZernioUploader] ⚠️ Optional Reel fields rejected; retrying with core contentType=reel payload...');
        postRes = await this.http.post(`${this.baseUrl}/posts`, buildPayload(false), {
          headers: this._authHeaders({ 'Content-Type': 'application/json' }),
          timeout: 120000,
        });
      } else {
        throw new Error(redactApiKey(`Zernio publishReel failed: ${errBody}`, this.apiKey));
      }
    }

    const post = postRes.data?.post || postRes.data || {};
    const platforms = Array.isArray(post.platforms) ? post.platforms : [];
    const fbPlatform = platforms.find(p => String(p?.platform || '').toLowerCase() === 'facebook') || platforms[0] || {};

    if (String(fbPlatform.status || post.status || '').toLowerCase() === 'failed') {
      throw new Error(`Zernio reported Facebook publish failure: ${fbPlatform.error || post.error || JSON.stringify(post)}`);
    }

    const platformPostUrl = fbPlatform.platformPostUrl || null;
    const fbVideoId = extractFacebookVideoId(platformPostUrl) || fbPlatform.platformPostId || null;
    const zernioPostId = post._id || post.id || null;
    const finalUrl = platformPostUrl || (fbVideoId ? `https://www.facebook.com/reel/${fbVideoId}` : null);

    console.log(`[ZernioUploader] 🎉 Public Facebook Reel published automatically! URL: ${finalUrl || zernioPostId}`);

    return {
      success: true,
      id: fbVideoId || zernioPostId,
      fbVideoId,
      zernioPostId,
      url: finalUrl,
      status: fbPlatform.status || post.status || 'published',
      deliveryMode: 'ZERNIO_API',
      reelsFeed: true,
      publicUrl,
    };
  }
}

module.exports = {
  DEFAULT_ZERNIO_BASE_URL,
  ZernioUploader,
  extractFacebookVideoId,
  redactApiKey,
};
