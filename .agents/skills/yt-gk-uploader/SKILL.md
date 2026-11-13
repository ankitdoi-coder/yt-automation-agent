---
name: yt-gk-uploader
description: Uploads the finished quiz Short through YouTube Data API v3, sets title/description/privacy/schedule, verifies it is really public, and posts one rotating engagement comment. Use whenever the user asks to upload, publish, schedule, or fix a video stuck private/processing, or post comments on a new video.
---

# UPLOAD
videos.insert with:
- title <= 50 chars, topic keywords, `#shorts` only if that has been tested
- description: 2-3 natural lines + 3-5 relevant hashtags. NO keyword stuffing, NO competitor names
- categoryId=27 (Education), selfDeclaredMadeForKids=false
- privacyStatus explicit. For scheduling: privacyStatus=private + publishAt (one fixed daily time, default 19:30 IST, unless an upload-time experiment runs)

# VERIFY (BLOCKING)
After upload call videos.list and confirm status is public/scheduled, uploadStatus processed, no rejection or restriction. If not: alert the user with the exact status. Never retry more than twice.

# COMMENT
Post ONE comment via commentThreads.insert (50 quota units). Rotate 5+ wordings tied to a specific quiz item, e.g. "Q4 ka answer aapne kya socha?". Pinning is not supported by the API; tell the user to pin manually. Do not post identical comments across videos.

Log the video_id, features and quota used into `video_features`.
