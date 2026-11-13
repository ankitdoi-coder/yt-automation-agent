---
name: yt-gk-video-builder
description: Builds a vertical 1080x1920 quiz Short from quiz.json using HTML slides, Playwright screenshots, Hindi TTS and FFmpeg, then runs a blocking technical QA gate (resolution, silence, loudness, text overflow). Use whenever the user wants to generate, render, fix or QA a quiz video, slide layout, audio mix, ticking/ding/BGM sounds, or Shorts pacing.
---

# PIPELINE
HTML slides (Playwright, 1080x1920) -> TTS (natural 1.0x, never time-stretch above 1.05x) -> FFmpeg.

# REQUIRED ELEMENTS (values come from experiment.json; never hardcode)
- Hook slide (0-2s): topic name + an honest promise ("10 Static GK Questions"). No fake statistics.
- Per question: question + 4 options, think window = experiment value, answer reveal with highlight, ding SFX on reveal, ticking SFX during think window, BGM around -20 dB, narration clearly above BGM (amix normalize=0).
- Visible motion: countdown bar or animated highlight, never a long frozen frame.
- Outro: honest CTA ("comment your score"). No hidden-answer trick unless it is the running experiment.
- Safe margins: keep text out of bottom 20% and right 12% (Shorts UI overlay).

# TECHNICAL QA GATE (BLOCKING)
Use ffprobe/ffmpeg. Fail the build if:
- resolution != 1080x1920, audio missing or clipping
- silence gap > 1.2s
- duration outside the experiment range
- loudness not near -14 LUFS (`loudnorm`/`ebur128`)
- text overflow detected, or file > 2 min unless the experiment is long-form
Extract 5 frames and confirm text is readable. Save `tech_qa.json` and `video.mp4` + `metadata.json`.
