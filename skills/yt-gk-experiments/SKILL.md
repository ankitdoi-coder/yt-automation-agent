---
name: yt-gk-experiments
description: Tracks controlled one-variable experiments for a YouTube Shorts channel, pulls metrics at T+2h, T+24h and T+72h, compares variant vs control, and records keep/drop/needs-more-data decisions plus a weekly playbook. Use whenever the user asks what worked, whether a change helped, how to review video performance, or wants to avoid changing many things at once.
---

# EXPERIMENT LOG
Table `experiments(id, variable, control, variant, metric, min_sample, start, decision_date, status, result)`.
Only ONE active experiment per variable. Do not add or revert changes mid-experiment.

# REVIEW LOOP
- T+2h: check status public, views > 0, no restrictions.
- T+24h and T+72h: pull views, averageViewDuration, averageViewPercentage, likes, comments, subscribersGained, traffic sources into `video_metrics`.
- At decision_date: compare variant vs control with the real numbers and sample size. Write `keep / drop / needs more data` with confidence (low/med/high). Fewer than 5 videos per variant = "needs more data", never "keep".

# WEEKLY
Update `playbook.md` (what works, with numbers), the topic backlog, and the next 7 days of experiments. Flag results that conflict with earlier hypotheses.
