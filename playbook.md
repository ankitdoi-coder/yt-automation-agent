# ExamIQ Bharat — YouTube Shorts Growth Playbook

**Channel:** ExamIQ (`@examiqbharat` / `UCjh63suNzws9XB2sF1xKzyw`)  
**Last Updated:** `2026-11-12` (`21:36 IST` / `16:06Z`)  
**Maintained By:** `yt-gk-experiments`  
**Database Synced:** `data/youtube_automation.db` (`experiments: 1`, `video_metrics: 71`, `video_features: 22`, `topic_backlog: 10`)  
**Snapshots:** [experiment_review.json](file:///d:/youtube-automation-agent/runs/2026-11-12/experiment_review.json) | [analyzer_snapshot.json](file:///d:/youtube-automation-agent/runs/2026-11-12/analyzer_snapshot.json)

---

## 1. Channel Baseline & Verified API Metrics

| Metric | Value (`2026-11-09`) | Value (`2026-11-12 21:36 IST`) | Source / Notes |
| :--- | :---: | :---: | :--- |
| **Total Channel Views** | `3,588` | **`4,700`** | YouTube Data API v3 (`channels.list`) |
| **Subscribers** | `7` | `7` | YouTube Data API v3 |
| **Total Videos** | `119` | `128` | YouTube Data API v3 |
| **Historical Control (`40–60s+`, n=50)** | `21.5` views / `58.6%` APV | Baseline Control | [report_2026-11-09.md](file:///d:/youtube-automation-agent/runs/2026-11-09/report_2026-11-09.md) |
| **Variant #1 (`c-cxf09GBCs`, T+28h)** | — | **`1,025` views** | `PT30S`, `3` Qs, `0` likes, `1` comment (`16:55 IST`) |
| **Variant #2 (`UaT3jlVOzI4`, T+0.1h)** | — | **`0` views** *(just live)* | `PT29S`, `3` Qs, `1` comment (`21:32 IST` — T+2h check `23:32 IST`) |

### 14-Day Traffic Sources (`2026-10-29` to `2026-11-09`, Analytics API v2)
- `SHORTS`: **329 views** (`64` watch min) | `YT_SEARCH`: **270 views** (`36` watch min) | `SUBSCRIBER`: **20 views** (`16` watch min) | `YT_CHANNEL`: **19 views** | `RELATED_VIDEO`: **18 views** (`86` watch min)

> [!NOTE]
> **Analytics API v2 Coverage & Studio CSV Gap:** Daily & video-level retention rows in Analytics API v2 currently end at `2026-11-09` (plus `sVkhs-XNjGE` on `2026-11-10`). Exact `averageViewPercentage` and `averageViewDuration` for `c-cxf09GBCs` (Nov 11) and `UaT3jlVOzI4` (Nov 12) require the T+48h lag to clear. **Impressions, CTR, and Viewed vs Swiped Away (%)** are unavailable via API and require a manual YouTube Studio CSV export.

---

## 2. Active Experiment Decision (`exp_20261109_rapid_pacing`)

- **Variable Under Test:** `duration_and_pacing` (Strictly ONE active variable)
- **Control:** `5` questions, `3.0s` pause, `~45s` duration (`58.6%` APV, `21.5` avg views)
- **Variant:** `3` rapid questions, `0.4s` chime pause (`880Hz`), tight target duration (`28–30s`), clean English mobile title `<50 chars`, Playwright slide cards, continuous suspense BGM
- **Target Metrics:** `averageViewPercentage >= 80%` (primary), `views >= 1,000` within 48h (secondary)
- **Minimum Sample Required:** **`5`** variant videos (`decision_date: 2026-11-14`)
- **Current Sample Size:** **`n = 2 / 5`** (`c-cxf09GBCs` + `UaT3jlVOzI4`)
- **Current Decision:** **`needs more data`** *(Confidence: LOW — strict `< 5` sample gate + Nov 11–12 APV% still pending Analytics lag)*

### T+2h / T+24h / T+72h Cohort Breakdown (`2026-11-12 21:36 IST`)

| Video ID & Cohort | Published (UTC) | Window | Dur | Views (Data API) | Analytics APV / AVD | Likes / Comments | Status / Evaluation |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| **`UaT3jlVOzI4`** (`yt-gk` Variant #2) | `2026-11-12 16:02` | `T+0.1h` | `29s` | `0` | *Pending lag* | `0` / `1` | `public` & `processed`; verify `T+2h` (>0 views) after `23:32 IST` tonight. |
| **`w5hQjqDhbkE`** (pre-fix workflow) | `2026-11-12 05:23` | `T+10.7h` | `30s` | **`0`** | *Pending* | `0` / `0` | Old `23`-tag metadata, `0` comment; monitor through `T+24h`. |
| **`WcQIgB8Oi68`** (`daily-video.yml`) | `2026-11-12 03:00` | `T+13h` | `25s` | `9` | *Pending* | `0` / `0` | Stagnant despite `<30s`; old duplicate Science MCQ title + `0` comments. |
| **`c-cxf09GBCs`** (`yt-gk` Variant #1) | `2026-11-11 11:25` | **`T+28.1h`** | `30s` | **`1,025`** | *Pending lag* | `0` / `1` | Crossed `>=1,000` (`~47.7x` baseline `21.5`); plateaued `+20` views from T+16h (`0` likes). Wait for T+48h APV. |
| **`Zvph4NbtpX4`** (`daily-video.yml`) | `2026-11-11 14:00` | **`T+26h`** | `28s` | **`2`** | *Pending* | `0` / `0` | T+24h stalled at `2` views despite `28s` & `public/processed`. |
| **`cK5t0PbkSh4`** (`daily-video.yml`) | `2026-11-11 03:00` | `T+37h` | `23s` | `17` | *Pending* | `0` / `0` | Stalled in teen views. |
| **`n9saJgDuKwk`** (`daily-video.yml`) | `2026-11-10 14:00` | `T+50h` | `29s` | `15` | *Pending* | `0` / `0` | Stalled at `15` views. |
| **`PronohAKFDk`** (unprivated late) | `2026-11-09 04:46` | **`T+83h`** | `33s` | `9` | `140.3%` / `46s` | `0` / `1` | Post-T+72h dead flat; late unprivating does not recover feed distribution. |
| **`4wunaAHed0M`** (unprivated late) | `2026-11-09 04:46` | **`T+83h`** | `36s` | `3` | `0%` / `0s` | `0` / `0` | Post-T+72h dead flat. |
| **`3wbfQ3AZbfQ`** (`daily-video.yml`) | `2026-11-08 03:00` | `T+109h` | `36s` | `16` | `77.35%` / `27s` | `0` / `0` | Exact same title as `c-cxf09GBCs` but old renderer/metadata stayed at `16`. |

---

## 3. Verified Patterns & Conflicting Hypotheses

1. **Direct Public + `yt-gk` Slide Cards Beat Pre-Fix Workflow (`n = 2` vs control, Confidence: LOW):** `c-cxf09GBCs` hit `1,025` views (`T+28h`) while `<30s` English-title Shorts from the pre-fix GitHub workflow (`WcQIgB8Oi68` = `9`, `Zvph4NbtpX4` = `2`, `cK5t0PbkSh4` = `17`, `n9saJgDuKwk` = `15`) all stalled under `20` views. Pipeline edits applied `2026-11-12` align `.github/workflows/daily-video.yml` (`07:50` & `16:50 IST` direct public), safe-zone green reveal CTA, and Q3 challenge comments.
2. **CONFLICT — `77%+` APV Alone vs Feed Breakout:** `OSYujMd9kBc` (`89.39%` APV, `11` views) and `3wbfQ3AZbfQ` (`77.35%` APV, `16` views) failed to break past `20` views. Early hook swipe-away (`Viewed vs Swiped Away`) + Like ratio (**Competitor Top 20% = `1.85%` likes/views vs our `c-cxf09GBCs` `0.00%`**) remain leading hypotheses to inspect once Studio CSV & T+48h APV arrive.
3. **CONFLICT — Hypothesis H2 (`10–30 items`):** Competitors hit `36k–86k` views with `Top 10/20` inside `26–29s`, whereas our `47–64s` 5Q videos collapsed to `20–38%` APV (`mUGLCw4x_DE` `28.14%`, `jtFxGiaXXBI` `33.44%`, `xUDIfAdj7Ec` `20.45%`). Hold question count at `3` until `n = 5` `exp_20261109_rapid_pacing` finishes.

---

## 4. Topic Backlog (`10-Day Non-Repeat`, Synced in `topic_backlog`)

| ID | Subtopic | Cluster | Mix | Status | Last Used / Video | Next Eligible |
| :--- | :--- | :--- | :---: | :---: | :---: | :---: |
| `tb_sci_human_body` | **Human Body & Biology Essentials** | General Science | Core (70%) | `used` | `2026-11-11` (`c-cxf09GBCs`) | `2026-11-21` |
| `tb_pol_articles` | **Fundamental Rights & Key Constitutional Articles** | Indian Polity | Core (70%) | `used` | `2026-11-12` (`UaT3jlVOzI4`) | `2026-11-22` |
| `tb_hist_battles` | **Important Battles & Treaties of India** | Indian History | Core (70%) | `ready` | — | **Next (`2026-11-13`)** |
| `tb_sci_vitamins` | **Vitamins, Deficiency Diseases & SI Units** | General Science | Core (70%) | `ready` | — | `2026-11-14+` *(keep 48h gap from Nov 12 `WcQIgB8Oi68`)* |
| `tb_static_parks` | **National Parks & Tiger Reserves of India** | Static GK | Explore (30%) | `ready` | — | **Now (`2026-11-13/14`)** |
| `tb_geo_rivers` | **Major Rivers, Dams & Tributaries** | Indian Geography | Explore (30%) | `ready` | — | **Now (`2026-11-14`)** |
| `tb_static_dances` | **Classical & Folk Dances of Indian States** | Static GK | Explore (30%) | `ready` | — | `2026-11-15+` |
| `tb_sci_physics` | **Light, Sound & Chemical Formulas** | General Science | Core (70%) | `ready` | — | `2026-11-16+` |
| `tb_pol_amendments` | **Major Constitutional Amendments (42nd, 44th, 73rd, 86th)** | Indian Polity | Core (70%) | `ready` | — | `2026-11-17+` |
| `tb_hist_modern` | **1857 Revolt & Gandhian Era Movements** | Indian History | Core (70%) | `ready` | — | `2026-11-18+` |

---

## 5. Next 7 Days Experiment Roadmap (`2026-11-13` to `2026-11-19`)

- **`2026-11-13` (Exp #1 Variant `n = 3–4 / 5`):** Keep `duration_and_pacing` fixed (`3Q`, `0.4s` pause, `<50` char English title). Run **`Important Battles & Treaties of India`** + **`National Parks & Tiger Reserves`**. Pull **T+24h** on `UaT3jlVOzI4` + check **T+48h Analytics APV** for `c-cxf09GBCs`.
- **`2026-11-14` (Exp #1 Decision Gate Day, `n = 5/5`):** Run **`Major Rivers, Dams & Tributaries`**. Complete `n = 5` variant uploads; pull T+48h/T+72h metrics + import YouTube Studio CSV (`Viewed vs Swiped Away`). Only decide `keep`/`drop` once `n >= 5` AND Analytics APV rows land; otherwise mark `needs more data` until `2026-11-16`.
- **`2026-11-15` to `2026-11-16` (T+48h Verification & Keep/Drop Decision):** Finalize `exp_20261109_rapid_pacing` in SQLite `experiments` (`keep` only if median APV `>= 80%` / clear lift over `58.6%` across `n >= 5`).
- **`2026-11-17` to `2026-11-19` (Experiment #2 — Single Variable):** If Exp #1 passes, launch `exp_20261117_hook_or_series` testing **ONE variable only** (either H1 `Single-Topic Numbered Series` vs standard title, OR `0-2s Shock Stat Hook` vs Challenge Hook) on **`Classical & Folk Dances`**, **`Light, Sound & Chemical Formulas`**, and **`Major Constitutional Amendments`**.
