# NEXORA — 1-Minute Live Demo Video Guide & Master Workflow
**Target Duration:** Exactly 60 Seconds (1 Minute)  
**Hackathon:** University Hackathon 2026 · Sime Darby Property Challenge  
**Team Name:** Victory (Ong Zheng Xi, Norman Lee, Vincent Loh Yong Sheng, Yoong Zi Yang, Tan Hui Shi)  
**Product Tagline:** *Powering Tomorrow, Intelligently*  
**Date:** October 2026  

---

## 1. Executive Summary & Winning Strategy for Judges

To win over the judges in just **60 seconds**, the demo cannot simply be a random click-through of dashboards. It must follow a tight **Problem → AI Innovation → Concrete Impact** narrative arc tied directly to the hackathon pitch slides:

1. **The Tension (00:00 - 00:10):** Single-building BEMS leave massive blind spots across precinct assets, causing uncoordinated demand peaks, guessing green CapEx, and slow manual ESG reporting.
2. **The Hero Climax (00:10 - 00:32):** A real-time crisis occurs at 14:00 peak heat — a massive crowd surge at **Nexora Galleria** pushes the common substation feeder to **1,712.9 kW**, threatening blackout or crippling TNB Maximum Demand penalty charges. Traditional BEMS would shut off mall chillers and ruin customer comfort. **NEXORA coordinates cross-sector flexibility across 3 neighboring assets (cold chain thermal storage, landscape irrigation, EV smart charging) to shave 32.9 kW and preserve 100% mall comfort without rebound peaks.**
3. **Financial Derisking (00:32 - 00:46):** The **Renewable Energy & CapEx Simulator** models 3D solar PV and BESS, showing up to **30.7% bill savings** and qualifying for Malaysia’s **14.4% GITA Corporate Tax Relief**.
4. **Verified Decarbonisation (00:46 - 01:00):** The **Carbon & ESG Dashboard** tracks **25% avoided carbon (~17 trees/tonne)**, monitors **GBI 72 points** towards Gold/Platinum, and generates one-click **Bursa Malaysia & IFRS S2** compliant audit reports.

---

## 2. Complete Alignment Matrix: Pitch Deck vs Prototype

| Pitch Deck Slide | Problem / Theme | Innovation (Slide 6) | Prototype Screen | Demonstrated Feature & Live Metrics | Measured Impact (Slide 7) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Slide 2 & 12** | **Isolated Building Silos & No Township View**<br>• BEMS only see single buildings<br>• Malls, hubs & solar run in silos<br>• Night baseload waste (14.2 MW / 82% of peak) | **1:1 Township Digital Twin**<br>Multi-scale 3D command center bridging precinct masterplans with floor-by-floor BMS operations. | `/#overview`<br>*(Township Command Center)* | Interactive 3D precinct twin covering all 6 facilities (Galleria, Exchange, Residences, Garden Kitchen, Hospital, Solar Park). Day/Night lighting toggle (`☾`). | Eliminates precinct blind spots; uncovers after-hours baseload leakage. |
| **Slide 2 & 4** | **Inefficient Optimisation & Manual Operations**<br>• Rigid manual schedules<br>• No grid / peak-hour shifting<br>• Synchronized TNB Maximum Demand (MD) spikes | **Township Energy Orchestration & TNB Tariff Arbitrage**<br>Cross-precinct load shifting with human-in-the-loop sign-off; prevents 30-min MD penalty charges. | `/#overview`<br>*(Alert Panel)*<br>↓<br>`/#action-simulator`<br>*(Action Simulator)* | **Flagship Township Capacity Alert:**<br>Mall cooling surge drives feeder to 1,712.9 kW (limit 1,680 kW).<br>AI coordinates 3 facilities:<br>1. Garden Kitchen: Cold room drift (`↓ 5.1 kW`)<br>2. Residences: Irrigation pump deferred (`↓ 7.4 kW`)<br>3. Exchange: 6 EV chargers throttled (`↓ 20.4 kW`)<br>**Total relief: 32.9 kW**. Staggered repayment avoids rebound peaks. 4-party human-in-the-loop approval. | **30.7% TNB bill cost savings**.<br>Feeder demand kept strictly ≤ 1,680 kW.<br>Mall cooling & customer comfort 100% preserved. |
| **Slide 2 & 6** | **Capital Misallocation & Unclear ROI**<br>• Guessing green investments<br>• Unclear payback periods<br>• Disconnected CapEx planning | **Renewable Energy & CapEx Simulator**<br>Simulates rooftop solar, BESS & EV before committing CapEx. Benchmarks TNB tariff offset & GITA tax allowance. | `/#simulator`<br>*(Renewable Simulator)* | 3D interactive rooftop solar PV & BESS placement on Galleria. Real-time CapEx, annual OPEX, simple payback timeline, 10-year ROI, and 20-year NPV. | **14.4% Corporate Tax Reduction (GITA/GITE)**.<br>Accurate financial underwriting for sustainability budgets. |
| **Slide 2 & 7** | **Unmeasured Carbon Impact & Manual Compliance**<br>• Slow, manual reporting<br>• Outdated sustainability data<br>• Unverifiable decarbonisation | **Tariff Arbitrage & ESG Audit Intelligence**<br>Translates precinct savings into Bursa Malaysia and IFRS S2 Scope 2 audit reports. | `/#carbon`<br>*(Carbon Dashboard)* | Real-time Scope 2 tracking, CO₂e avoided, tree equivalents (~17 trees/tonne), GBI point accumulation checklist (EE 35, EQ 21, SM 16), one-click PDF & CSV audit export. | **25% annual carbon avoided**.<br>**GBI 72 Points** (Gold/Platinum rating).<br>Audit-grade Bursa & IFRS S2 compliance. |

---

## 3. Second-by-Second Video Storyboard & Spoken Script

> **Delivery Guidance:**  
> • Total Spoken Word Count: **138 words**  
> • Ideal Cadence: ~135–140 words/minute (steady, authoritative, confident)  
> • Exactly **60 Seconds** total run time.

```
00:00 ──────────────── 00:10 ──────────────── 00:32 ──────────────── 00:46 ──────────────── 01:00
  Segment 1: Township      Segment 2: Hero Climax     Segment 3: CapEx        Segment 4: ESG
   Command Center          Township Flex Alert & Sim   Simulator (GITA)       Dashboard & Outro
```

---

### SEGMENT 1: Township 3D Command Center (`00:00 – 00:10` | 10 Seconds)

* **Visual View:** `http://127.0.0.1:5173/#overview`
* **On-Screen Mouse Actions:**
  1. Start with the full 3D interactive township model centered on screen.
  2. Perform one smooth, gentle camera orbit showing the 6 interconnected assets: Nexora Galleria, Nexora Exchange, Nexora Residences, The Garden Kitchen, Medical Hub, and Solar Park.
  3. Briefly toggle the night view (`☾`) in the top-right toolbar to illustrate after-hours baseload detection.
* **On-Screen Text Banner:** `NEXORA: Breaking Building Silos Across The Township`
* **Spoken Voiceover (23 words / ~10 sec):**
  > *"Traditional BEMS trap energy data in single-building silos. NEXORA unifies township assets into an AI-powered 3D command center, eliminating operational blind spots."*

---

### SEGMENT 2: Hero Climax — Galleria Crowd Surge & Action Simulator (`00:10 – 00:32` | 22 Seconds)

* **Visual View:** Scroll down on `/#overview` to **Action recommendations**, then transition into `/#action-simulator?action=township-flex-crisis-v1&asset=mall`.
* **On-Screen Mouse Actions:**
  1. **(00:10 - 00:15):** Frame the orange-bordered **Township capacity alert** card:
     - Badge: `⚡ Township capacity alert · TNB Grid & Substation Protection`
     - Title: `Galleria crowd surge: coordinate four township services`
     - Stress: Feeder reaches **1,712.9 kW**, breaching the **1,680 kW** limit.
  2. **(00:15 - 00:18):** Click the **[Simulation]** button.
  3. **(00:18 - 00:24):** In the **Action Simulator**, the 3D twin displays the coordinated response across 3 neighboring facilities:
     - *The Garden Kitchen:* Cold-room thermal inertia float (`↓ 5.1 kW`)
     - *Nexora Residences:* Deferred non-potable landscape irrigation (`↓ 7.4 kW`)
     - *Nexora Exchange:* Smart EV charger throttling (`↓ 20.4 kW`)
     - **Total Shaved: 32.9 kW** (bringing feeder back to 1,680 kW).
  4. **(00:24 - 00:29):** Click **[Run simulator]**:
     - The chart appears comparing 3 profiles:
       - *Orange line:* Crowd event with no response (breaches limit).
       - *Purple dashed line:* Dumb independent restart (creates secondary rebound spike of **1,714.0 kW**).
       - *Green dashed line:* NEXORA coordinated staggered repayment (remains strictly under **1,680 kW**).
  5. **(00:29 - 00:32):** Click **[Approve plan]** -> Show the 4-facility **Human-in-the-Loop** modal -> Click **Confirm approval** (badge updates to *"Approved demo plan"*).
* **On-Screen Text Banner:** `AI Cross-Sector Orchestration · 32.9 kW Peak Shaved · Mall Cooling 100% Preserved`
* **Spoken Voiceover (52 words / ~22 sec):**
  > *"When an afternoon crowd surge pushes Galleria's substation feeder past its 1,680 kW limit, NEXORA doesn't turn off mall chillers. Instead, our AI orchestrates cold chain thermal storage, landscape irrigation, and EV charging across neighboring assets, shaving 32.9 kW and preventing rebound peaks with multi-stakeholder human-in-the-loop sign-off."*

---

### SEGMENT 3: Renewable Energy & CapEx Simulator (`00:32 – 00:46` | 14 Seconds)

* **Visual View:** Click **Renewable Simulator** in the top navigation bar (`http://127.0.0.1:5173/#simulator`).
* **On-Screen Mouse Actions:**
  1. **(00:32 - 00:38):** Show the 3D building model of Nexora Galleria with interactive solar panels and battery storage (BESS) rendered on the rooftop. Toggle **Before / After** or rotate the model.
  2. **(00:38 - 00:46):** Scroll down to the **Investment Analysis** bento box:
     - Cursor hovers over: **Estimated CAPEX**, **Simple Payback (years)**, **10-Year ROI**, and the **GITA 14.4% Tax Relief** badge.
* **On-Screen Text Banner:** `Derisking Green CapEx · 30.7% Bill Savings · 14.4% GITA Tax Allowance`
* **Spoken Voiceover (32 words / ~14 sec):**
  > *"To derisk green investments, our Renewable Simulator benchmarks rooftop solar and BESS against local TNB tariffs, delivering up to 30.7% bill savings and qualifying for Malaysia's 14.4% GITA corporate tax incentive."*

---

### SEGMENT 4: Carbon & ESG Dashboard + Outro (`00:46 – 01:00` | 14 Seconds)

* **Visual View:** Click **Carbon Dashboard** in the navigation bar (`http://127.0.0.1:5173/#carbon`).
* **On-Screen Mouse Actions:**
  1. **(00:46 - 00:52):** Cursor highlights the top KPIs: **Scope 2 Emissions**, **Avoided CO₂e**, **Trees Equivalent (~17 trees/tonne)**, and the **GBI 72 Points / Gold Certification Readiness**.
  2. **(00:52 - 00:57):** Click **[Export Carbon Report]** or **[Prepare ESG Report]**, briefly showing the downloadable Bursa Malaysia / IFRS S2 compliant audit package.
  3. **(00:57 - 01:00):** Fade to closing title screen:  
     **NEXORA — Powering Tomorrow, Intelligently**  
     *Team Victory · University Hackathon 2026 · Sime Darby Property*
* **On-Screen Text Banner:** `Automated Scope 2 ESG Audit · Bursa Malaysia & IFRS S2 Ready`
* **Spoken Voiceover (31 words / ~14 sec):**
  > *"Finally, our Carbon Dashboard automates Bursa Malaysia and IFRS S2 reporting, tracking 25% avoided emissions and 72 Green Building Index points. NEXORA: powering tomorrow's sustainable townships, intelligently."*

---

## 4. Key Numbers to Emphasize (Voiceover & Graphics)

When speaking or placing lower-third titles, ensure these exact numbers stand out:

1. **32.9 kW Feeder Relief:** The exact demand reduction negotiated from neighboring assets during the Galleria crowd surge.
2. **1,712.9 kW → 1,680.0 kW:** The peak demand reduction preventing feeder trip and TNB Maximum Demand penalty charges.
3. **1,714.0 kW Rebound Avoided:** Demonstrates AI intelligence by preventing the secondary spike caused by dumb simultaneous restarts.
4. **4/4 Stakeholder Approvals:** Proves Human-in-the-Loop governance across mall, restaurant, residences, and exchange managers.
5. **30.7% TNB Bill Savings:** Demonstrated cost reduction via peak shifting and solar self-consumption.
6. **14.4% Corporate Tax Incentive:** GITA / GITE tax allowance calculated from Malaysian Green Technology guidelines.
7. **25% Annual Carbon Avoided:** Equivalent to ~17 trees planted per tonne of CO₂e avoided.
8. **72 GBI Points:** Energy Efficiency (35 pts), Indoor Environmental Quality (21 pts), Sustainable Site Planning (16 pts) achieving Gold/Platinum certification.

---

## 5. Technical Run-Sheet & Recording Checklist

### Pre-Recording Setup:
1. **Screen Resolution:** Set display to **1920 × 1080 (16:9 Full HD)**.
2. **Browser Window:** Maximize Chrome / Brave to full screen (press `F11` or green full-screen button). Set browser zoom to **90%** or **100%** so the full Bento layout is visible without excessive scrolling.
3. **Dev Server Verification:**
   - Backend running on `http://127.0.0.1:8000` (FastAPI).
   - Frontend running on `http://127.0.0.1:5173` (Vite).
4. **State Reset (Clean Demo State):**
   - Open Chrome DevTools (`F12`) -> Application -> Storage -> Clear site data (or clear `localStorage`).
   - Refresh the page to ensure the flagship alert displays in its pristine **`0/4 APPROVALS`** pending state.
5. **Mouse Movements:**
   - Turn off mouse acceleration if possible.
   - Move the pointer deliberately from point A to point B; avoid rapid circular wiggling or erratic jerks.
6. **Audio Quality:**
   - Use a clear USB microphone with slight noise suppression.
   - Speak with energetic, crisp pronunciation. Do not rush words.

---

## 6. Anticipated Judges Questions & High-Impact Answers

| Judge Question | Winning Response |
| :--- | :--- |
| *"How is this different from existing BEMS (Building Energy Management Systems)?"* | *"Existing BEMS operate in isolated silos — they only see one building. If a mall experiences a crowd surge, traditional BEMS can only throttle its own chillers, hurting shoppers. NEXORA pools flexibility across the entire township: cold storage thermal mass, non-potable irrigation, and EV charging absorb the peak collectively without sacrificing customer comfort."* |
| *"Why not just restart all deferred services immediately after the surge?"* | *"That is the exact trap of dumb automation! When you restart everything simultaneously at 14:30, it creates a massive secondary rebound peak of 1,714 kW — higher than the original surge! NEXORA uses a shared recovery ledger to stagger repayment under the feeder limit."* |
| *"Is this autonomous or does a human need to approve it?"* | *"NEXORA employs Human-in-the-Loop governance. The AI calculates optimal dispatch and simulates the physical impact first; facility managers across the participating assets review and sign off via digital approvals before any dispatch occurs."* |
| *"How does NEXORA support Malaysian national targets and ESG compliance?"* | *"NEXORA models Malaysian TNB Medium Voltage Time-of-Use tariffs, integrates MGTC guidelines for the 14.4% GITA tax allowance, tracks Green Building Index (GBI) points up to 72 points for Gold/Platinum rating, and exports one-click audit reports ready for Bursa Malaysia and IFRS S2 Scope 2 disclosures."* |

---
*Created for Team Victory · University Hackathon 2026 · NEXORA Prototype Demonstration.*
