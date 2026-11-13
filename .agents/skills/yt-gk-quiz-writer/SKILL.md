---
name: yt-gk-quiz-writer
description: Generates and fact-checks Indian GK quiz questions (static GK, science, history, polity, geography) for Shorts, with 4 options, answer, one-line explanation and source. Use whenever the user wants quiz questions, MCQs, a topic series, or asks to verify GK answers. Blocks publishing if any answer is unverified.
---

# INPUT
`runs/YYYY-MM-DD/experiment.json` (topic, question count N) + topic_backlog.

# GENERATION
- N questions (default 10 for rapid-fire list; allowed 3-30 per experiment).
- Fields per question: `question`, `options[4]`, `correct_index`, `fact` (one line), `source` (NCERT / Lucent / official site), `difficulty`.
- Hindi-first text. Title language follows the current channel decision (English unless the experiment says otherwise).
- Difficulty mix: 40% easy, 40% medium, 20% hard.
- No ambiguous or disputed facts. Current-affairs items need a date label and must be < 6 months old.
- Add ONE unique value per video (memory trick or "why it matters" line) so it is not a bare template (YouTube treats mass-produced repetitive content as a monetization risk).

# FACT QA (BLOCKING)
For every question: (1) second independent LLM pass answering without seeing the key, (2) web search against a reliable source.
Record `verified`, `confidence`, `source_url`. If verified=false or confidence < 0.9 -> regenerate that question. Save `fact_qa.json`.
Output: `runs/YYYY-MM-DD/quiz.json`.
