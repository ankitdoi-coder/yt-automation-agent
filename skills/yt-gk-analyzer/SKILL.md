---
name: yt-gk-analyzer
description: Analyzes a YouTube Shorts channel through YouTube Data API v3 and YouTube Analytics API, compares against competitor channels' public data, and outputs a daily report plus ONE experiment for today. Use whenever the user asks why views are low, wants performance analysis, competitor research, topic selection, or "analyze my channel", even if they do not mention APIs.
---

# STEP 1 - OWN CHANNEL DATA
OAuth scopes: youtube.upload, youtube.force-ssl, yt-analytics.readonly.
- Data API: channels.list, playlistItems.list -> videos.list (snippet, contentDetails.duration, statistics, status.privacyStatus, status.madeForKids).
- Analytics API (filter creatorContentType==SHORTS; dimension video; also day and insightTrafficSourceType).
  Metrics: views, estimatedMinutesWatched, averageViewDuration, averageViewPercentage, likes, comments, shares, subscribersGained.
- NOT available via API: impressions, CTR, "viewed vs swiped away". Ask the user to export the Studio CSV and ingest it. Never invent these numbers.
- Store in SQLite: `video_metrics(video_id, date, ...)` and
  `video_features(video_id, topic, subtopic, q_count, duration_s, title_style, title_len, hook_type, voice_speed, bgm, upload_hour_ist)`.

# STEP 2 - COMPETITOR PATTERNS (public data only)
Input: 5-10 competitor channel IDs. Use videos.list for each video: topic, duration (contentDetails.duration), views, likes/views, comments/views, title format and length, upload frequency.
Output a table: "what the top 20% share" vs "bottom 50%". Everything stays HYPOTHESIS until tested on our channel.
Starting hypotheses (from user data, unproven):
- H1 Single-topic series (folk dances, national parks, books-authors, dams-rivers, Top 30 science) beat mixed "Top 5 GK".
- H2 Longer rapid-fire lists (10-30 items) may beat 3-5 item videos. CHECK competitor durations first.
- H3 Static GK beats current-affairs on views.
- H4 Clean readable slides with large text help retention.

# STEP 3 - DAILY REPORT (concise markdown)
- 7/28-day views, subs, avg views per video, trend.
- Top 5 vs bottom 5 videos and their feature differences.
- averageViewPercentage by duration bucket (<20s, 20-35s, 35-60s, 60s+).
- Performance by topic, title style, upload hour.
- Anomalies: a video stuck at 0-2 views after 24h -> check privacyStatus, madeForKids, processing/copyright/restriction state first.
- A confidence level (low/med/high) next to every conclusion.
- TODAY'S EXPERIMENT -> write `runs/YYYY-MM-DD/experiment.json`: variable, control, variant, success metric, sample size, decision date.

# STEP 4 - TOPIC SELECTION
- 70% of days: best-performing cluster, new subtopic. 30%: explore a new cluster to test a hypothesis.
- No topic repeated within 10 days. Maintain a `topic_backlog` table with status.
