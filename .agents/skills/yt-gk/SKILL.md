---
name: yt-gk
description: Master daily workflow for ExamIQ Bharat GK quiz Shorts channel (SSC, Railway, Police, UPSC). Runs the full end-to-end loop (orchestrator, analyzer, quiz writer, video builder, uploader, experiment tracker). Shortcut for /yt-gk-orchestrator.
---

# yt-gk (Master Pipeline Shortcut)

This skill is the primary shortcut for **yt-gk-orchestrator**.

## Quick Execution Order:
1. **/yt-gk-analyzer**: Channel audit & daily single-variable experiment setup.
2. **/yt-gk-quiz-writer**: Fact-verified Hindi GK MCQs with NCERT/Lucent citations.
3. **/yt-gk-video-builder**: 1080x1920 slide video with audio sync, ticking SFX, and bell chime.
4. **/yt-gk-uploader**: Explicit public upload verification and challenge comment.
5. **/yt-gk-experiments**: T+2h, T+24h, T+72h review tracking and playbook updates.

See [yt-gk-orchestrator](../yt-gk-orchestrator/SKILL.md) for complete details.
