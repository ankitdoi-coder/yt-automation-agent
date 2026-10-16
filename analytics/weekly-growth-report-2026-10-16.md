# Weekly Growth & Performance Report: ExamIQ Bharat
**Date:** 2026-10-16  
**Channel:** ExamIQ (`@examiqbharat`)  
**Channel ID:** `UCjh63suNzws9XB2sF1xKzyw`  

---

## 1. Executive Summary & Core KPIs

| Metric | Last 7 Days | Prior 7 Days | 7-Day Change | Channel All-Time |
| :--- | :--- | :--- | :--- | :--- |
| **Total Views** | **2,505** | **0** | **+100%** | 2,278 |
| **Shorts Views** | 413 | - | - | - |
| **Long-Form Views** | 2,092 | - | - | - |
| **Videos Uploaded** | 48 | 0 | 48 | 48 |
| **Total Subscribers** | - | - | - | **5** |

---

## 2. Top Performing Videos (Past 7 Days)

1. **[Long Video]** [Top 10 GK MCQ | GK Questions | GK Quiz in Hindi | Lucent GK #Shorts #GK | ExamIQ](https://youtu.be/ACWpOntSxcA)  
   - **Views:** 737 | **Likes:** 12 | **Comments:** 0  
   - **Published:** 2026-10-11 06:01 UTC

2. **[Long Video]** [Top 10 GK MCQ | GK Questions | GK Quiz in Hindi | Lucent GK #Shorts #GK | ExamIQ](https://youtu.be/Q7cK7Aip6dY)  
   - **Views:** 704 | **Likes:** 10 | **Comments:** 0  
   - **Published:** 2026-10-11 03:36 UTC

3. **[Long Video]** [Top 10 GK MCQ | GK Questions | GK Quiz in Hindi | Lucent GK #Shorts #GK | ExamIQ](https://youtu.be/zGy-v1bkGPw)  
   - **Views:** 184 | **Likes:** 3 | **Comments:** 0  
   - **Published:** 2026-10-11 05:30 UTC

---

## 3. Underperforming Videos (Past 7 Days)

1. **[Long Video]** [Railway NTPC & Group D | भारत का भूगोल एवं सामान्य विज्ञान: 50 अति महत्वपूर्ण प्रश्नोत्तरी (पिछले](https://youtu.be/vB9dvtd8sQo)  
   - **Views:** 0 | **Likes:** 0 | **Duration:** 1165s

2. **[Long Video]** [Top 50 भारत का भूगोल एवं सामान्य विज्ञान GK Quiz | ExamIQ](https://youtu.be/Wwpi5BT_bYI)  
   - **Views:** 0 | **Likes:** 0 | **Duration:** 1296s

3. **[Long Video]** [SSC CGL & Railway | भारत का इतिहास एवं संविधान: प्रतियोगी परीक्षाओं में बार-बार पूछे जाने वाले प्र](https://youtu.be/usNci4KFdUc)  
   - **Views:** 0 | **Likes:** 0 | **Duration:** 1244s

---

## 4. Growth Hypothesis & Diagnostic Insights

1. **Shorts Title Formatting (Proven Driver):**
   - The all-time peak days (Oct 11: 1,758 views) were driven by curiosity-first Lucent titles:
     - `Top 10 GK MCQ | GK Questions | GK Quiz in Hindi | Lucent GK` (737 views)
     - `Top 10 GK MCQ | GK Questions | GK Quiz in Hindi | Lucent GK` (704 views)
   - When titles were switched on Oct 15-16 to hyper-specific exam tags (`Police Exam 2026 | Static GK Top 5 MCQs (Set 1)`), views plummeted to 0-11 views.
   - **Action Taken:** Reset default `shorts.titleStyle` to `curiosity_lucent` in `config/growth.json`.

2. **Deduplication in Long-Form Content:**
   - 20-30 minute long videos previously experienced ~9s Average View Duration because questions repeated up to 36% across batches within the same video.
   - **Action Taken:** Activated strict semantic tokenization (Jaccard similarity > 0.45) and answer-entity collision detection.

3. **Upload Cadence & Algorithmic Saturation:**
   - Uploading 5-8 videos/day caused self-cannibalization. Recommended cadence is 1-2 Shorts/day + 1 Long video every 2-3 days.

---

## 5. Active Experiments
Total tracked experiment variants: **0**  
Reference: `analytics/experiments.csv`
