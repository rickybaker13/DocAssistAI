# DocAssistAI — Go-To-Market Campaign

## Phase 1: Foundation (Build Before Spending a Dollar)

These must be done before any paid ads run. They are the conversion infrastructure.

- [ ] **1. Record 15-second product demo video**
  - Screen recording: open app → start recording → transcript appears → structured note generates → done
  - Voiceover: "Record the visit. Get the note. That's DocAssistAI — documentation assistance for every doc."
  - No music, no fancy editing. Authentic, fast, clinical.
  - This single asset powers ads across all 4 platforms.
  - Export as: square (1:1) for Instagram/Facebook feed, vertical (9:16) for Stories/Reels, landscape (16:9) for LinkedIn/YouTube

- [x] **2. Build dedicated Security & Privacy page** (`/security`) ✅
  - 8-step PII flow diagram: Audio → TLS → Transcription → Presidio scrub → AI → Presidio re-inject → TLS → Clinician Review
  - Before/after de-identification example (John Smith → [PERSON_0], etc.)
  - 6 security commitments with technical backing
  - BAA availability section
  - Live at: `docassistai.app/security`

- [x] **3. Build segment-specific landing pages** ✅
  - [x] `/for-pas` — PA-focused: "You Didn't Go to PA School to Chart Until 9 PM"
  - [x] `/for-nps` — NP-focused: "No Scribe. No Coder. No MA to Help with Notes."
  - [x] `/for-residents` — Residents + med students: "80-Hour Weeks Are Hard Enough Without Charting Until 2 AM"
  - [x] `/for-practices` — Attendings & practice leaders: "Your Providers Spend 40% of Their Day on Documentation"
  - Each page includes: tailored headline, pain point stats, demo video slot, comparison table, trust signals, CTA
  - Tagline on all pages: **"Doc Assist AI — documentation assistance for every doc."**
  - Shared components: SegmentNav (cross-links all pages), SegmentHero, SegmentCTA, SegmentFooter, TrustSignals

- [x] **4. Build comparison table component** ✅
  - Anonymous competitor comparison (Enterprise Scribe A/B, Standalone Scribe C/D)
  - Reframed rows so checkmarks always mean "good": "Patient Data Protected from AI", "Works Without EHR Integration"
  - DocAssistAI pricing shown as $20/month, free trial as "Unlimited during the Free Trial"
  - Desktop table + mobile card responsive layouts

- [ ] **5. Install analytics and retargeting pixels**
  - [ ] Meta Pixel on all pages (required before running FB/IG ads)
  - [ ] LinkedIn Insight Tag
  - [ ] Reddit Pixel
  - [ ] Google Analytics 4 (baseline traffic measurement)
  - [ ] Set up conversion events: signup, demo video play, landing page visit

- [ ] **6. Create ad platform accounts**
  - [ ] Meta Business Manager (you have this from skipurgatoryhouse.com — create a new ad account for DocAssistAI)
  - [ ] LinkedIn Campaign Manager
  - [ ] Reddit Ads account
  - [ ] X (Twitter) Ads account

---

## Phase 2: Organic / Free Channels (Start Immediately, Costs $0)

These run in parallel with Phase 1 and continue indefinitely.

- [ ] **7. KevinMD guest article**
  - Topic: "PAs Write More Notes Than Anyone — It's Time to Fix That" or "What HIPAA-Compliant AI Documentation Actually Looks Like"
  - 500-1,000 words, no product pitch — thought leadership that mentions DocAssistAI naturally at the end
  - Submit at: kevinmd.com/heard-social-medias-leading-physician-voice
  - Free, 3M monthly page views, physician-heavy readership

- [ ] **8. Reddit organic engagement (2-3 weeks before any promotion)**
  - Create account, build karma through genuine participation
  - Target subreddits: r/physicianassistant, r/nursepractitioner, r/medicine, r/residency, r/medicalschool
  - Contribute to documentation/workflow discussions
  - When someone asks about AI scribes or documentation tools, mention DocAssistAI transparently
  - NEVER astroturf. Reddit will find out and the backlash will destroy credibility.

- [ ] **9. #MedTwitter / X organic presence**
  - Share documentation tips, clinical note best practices
  - Behind-the-scenes content: how we built HIPAA-compliant AI documentation
  - Short screen recordings of the product
  - Engage with #MedTwitter, #PAlife, #NPlife, #MedEd conversations
  - Post 3-4x/week minimum

- [ ] **10. Facebook group engagement**
  - Join PA-specific groups, NP networking groups
  - Contribute value (answer questions, share documentation tips) for 2+ weeks
  - Mention the tool when genuinely relevant, not as a cold pitch

- [ ] **11. LinkedIn organic content**
  - Post 2-3x/week: documentation burden stats, product updates, clinical workflow insights
  - Target connections: PA program directors, NP leaders, hospitalist group leaders

---

## Phase 3: Paid Ads ($500/month Startup Budget)

### Budget Allocation

| Platform | Monthly Budget | Why | Target |
|---|---|---|---|
| **Meta (FB/IG)** | $250 | Best PA/NP job-title targeting, cheapest leads | PAs, NPs |
| **Reddit Ads** | $125 | Cheapest CPMs, tech-savvy audience, authentic feel | r/medicine, r/residency, r/physicianassistant |
| **X/Twitter** | $75 | #MedTwitter community, cheapest CPC | Residents, med students, all clinicians |
| **LinkedIn** | $50 | Test only — expensive but precise. Scale up when budget allows. | Attendings, practice leaders |

### Ad Creative (Deploy in This Order)

- [ ] **12. Meta (Facebook/Instagram) ads**
  - **Campaign 1 — PAs:**
    - Primary text: "Still charting at 9 PM? Your AI scribe writes the note while you see the patient. HIPAA compliant. $20/month with a free trial."
    - Headline: "Stop Charting After Hours"
    - CTA button: "Sign Up" → `/for-pas`
    - Format: 15s video (demo) + static image variant (product UI screenshot with headline overlay)
  - **Campaign 2 — NPs:**
    - Primary text: "No scribe. No coder. No MA to help with notes. Sound familiar? DocAssistAI is the AI scribe you actually have access to. $20/month — free trial included."
    - Headline: "NPs Deserve Better Tools"
    - CTA button: "Sign Up" → `/for-nps`
  - **Targeting:** Job title (Physician Assistant, Nurse Practitioner) + Interests (Medical Documentation, Electronic Health Records, Clinical Workflow)
  - **Retargeting:** After 1 week, create retargeting audience from landing page visitors who didn't sign up

- [ ] **13. Reddit ads**
  - **Promoted post (r/physicianassistant, r/medicine, r/residency targeting):**
    - Title: "We built an AI scribe that de-identifies patient data before the AI sees it — looking for feedback"
    - Body: Authentic, technical, transparent. Explain the Presidio architecture. Ask for genuine feedback. Link to product.
  - **Format:** Promoted post (looks like organic content, not display ad)

- [ ] **14. X/Twitter ads**
  - **Promoted tweet:**
    - "Things that should not exist in 2026: Charting until midnight. Writing the same ROS template 20x a day. Copy-pasting your own notes because you're too tired to type. AI scribes exist now. HIPAA compliant ones. docassistai.app — free trial #MedTwitter #PAlife"
  - **Targeting:** #MedTwitter, #PAlife, #NPlife, healthcare interests
  - **Format:** Promoted tweet with link

- [ ] **15. LinkedIn ads (minimal test budget)**
  - **Sponsored content:**
    - "Your providers are spending 40% of their day on documentation. That is recoverable time. DocAssistAI generates structured notes during the encounter. PII is scrubbed before anything reaches the AI. $20/month — free trial to start."
  - **Targeting:** Job title (Physician Assistant, Nurse Practitioner, Physician, Medical Director) + Industry (Hospital & Healthcare)
  - **Format:** Single image (product UI) with text

---

## Phase 4: Measure & Optimize (Weekly)

- [ ] **16. Set up tracking spreadsheet or dashboard**
  - Track per platform per week: Spend, Impressions, Clicks, CTR, Signups, Cost Per Signup
  - Track per landing page: Visits, Signup Rate, Bounce Rate
  - Track overall: Total signups, active users, retention

- [ ] **17. Weekly review (every Monday)**
  - Which platform has the lowest cost per signup?
  - Which ad creative has the highest CTR?
  - Which landing page converts best?
  - Kill anything with CTR < 0.5% after 1,000 impressions
  - Double budget on the best performer
  - Test one new creative variant per platform per week

- [ ] **18. Monthly competitive check**
  - What are competitors advertising? (search "AI medical scribe" on each platform)
  - Any new entrants?
  - Pricing changes?
  - New features we should highlight as differentiators?

---

## Phase 5: Scale What Works

Once you have data (4-6 weeks in), the strategy shifts:

- [ ] **19. Scale winning channels**
  - Move budget from underperformers to the channel with lowest cost per signup
  - If Meta is winning: increase to $500/mo, add lookalike audiences from signup list
  - If Reddit is winning: increase to $300/mo, expand to more subreddits
  - Target: keep cost per signup under $10

- [ ] **20. Explore higher-budget channels when ready**
  - **Doximity** — 50% of PAs, 80% of MDs. Enterprise pricing but worth exploring when budget > $2K/mo
  - **Sermo Engagement Manager** — Self-serve ads to 1.5M verified HCPs. New PA/NP community.
  - **Medscape** — 94% of U.S. physicians monthly. Enterprise pricing.
  - **Podcast sponsorship** — The Curbsiders (note: a competitor already sponsors them), Brilliant Medicine, BackTable. $500-2K per episode.

- [ ] **21. Build referral program**
  - "Invite a colleague, both get [incentive]"
  - Word-of-mouth is the #1 acquisition channel in healthcare
  - PAs tell other PAs. Residents tell co-residents. This compounds.

- [ ] **22. Collect and deploy testimonials**
  - After 10+ active users, ask for short testimonials (name, credentials, 1-2 sentences)
  - Add to landing pages, use in ad creative
  - Video testimonials are gold — even a 15-second phone recording from a PA saying "this saves me an hour a day" is worth more than any ad copy

---

## Competitor Comparison Table (For Landing Pages)

Live on all segment landing pages. No competitor names — rows reframed so ✓ always means "good."

| Feature | Enterprise Scribe A | Enterprise Scribe B | Standalone Scribe C | Standalone Scribe D | **DocAssistAI** |
|---|---|---|---|---|---|
| **Monthly Cost** | $600–900/provider | $225–375/provider | $99/provider | $119/provider | **$20/month** |
| **Free Trial** | No | No | 10-visit trial | 30 consults/mo | **Unlimited during the Free Trial** |
| **PII De-identification** | Unclear | Unclear | No | No | **Yes — Presidio** |
| **Patient Data Protected from AI** | No | No | No | No | **Yes — scrubbed first** |
| **Fail-Closed if Service Down** | No | No | No | No | **Yes — 503, AI never called** |
| **Custom Note Templates** | Limited | Specialty-specific | Learns your style | 55+ templates | **72+ sections, 10 categories** |
| **Self-Serve Signup** | No (enterprise sales) | No (enterprise sales) | Yes | Yes | **Yes** |
| **Works Without EHR Integration** | No (Epic only) | No (Epic/Cerner) | Yes | Yes | **Yes — copy-paste with any EHR** |

---

## Ad Copy Quick Reference

### The Hook Lines (Use Across Platforms)

**For PAs:**
- "Still charting at 9 PM?"
- "14 patients. 14 notes. 2 extra hours. Every single day."
- "You didn't go to PA school to spend your evenings typing notes."

**For NPs:**
- "No scribe. No coder. No MA to help with notes. Sound familiar?"
- "You're the provider, the scribe, and the billing coder. Let AI handle one of those."

**For Residents & Students:**
- "PGY-1 tip they don't teach in orientation: let AI write your notes."
- "80-hour weeks are hard enough without charting until 2 AM."
- "Your attending is going to read your note. Make it good."

**For Attendings:**
- "Your providers are spending 40% of their day on documentation. That is recoverable time."
- "Better notes. Better coding. Less burnout. One tool."

### Trust Signals (Include on Every Landing Page)
- HIPAA compliant
- PII de-identified before AI processing
- Fail-closed architecture
- No PHI stored or logged
- Audio encrypted in transit (TLS/Caddy)
- Clinician reviews every note before it's finalized

### Tagline
**"Doc Assist AI — documentation assistance for every doc."**

---

## Channel-Specific Posting Schedule

| Day | Platform | Content Type |
|---|---|---|
| Monday | LinkedIn | Documentation burden stat + product mention |
| Tuesday | X/Twitter | Clinical note tip or #MedTwitter engagement |
| Wednesday | Reddit | Participate in 2-3 discussions (no self-promotion) |
| Thursday | X/Twitter | Product screenshot or 15s demo clip |
| Friday | LinkedIn | Behind-the-scenes or PII architecture insight |
| Weekend | Facebook groups | Engage in PA/NP groups, answer documentation questions |

---

## Key Metrics to Watch

| Metric | Target (Startup Phase) | Scale Phase |
|---|---|---|
| Cost per signup | < $10 | < $5 |
| Landing page conversion rate | > 5% | > 10% |
| Ad CTR (Meta) | > 1% | > 2% |
| Ad CTR (LinkedIn) | > 0.5% | > 1% |
| Weekly signups | 10-20 | 50+ |
| Monthly active users | Growing week-over-week | 200+ |

---

## Notes

- **Budget scales with traction.** $500/mo is the starting point. When cost per signup is proven, increase budget on the winning channel.
- **Organic is your best ROI.** KevinMD article, Reddit engagement, #MedTwitter presence, and Facebook groups cost nothing but time and will compound.
- **The 15s demo video is the most important single asset.** Prioritize recording it before anything else.
- **Retargeting is where Meta excels.** Most clinicians won't sign up on first visit. The retargeting sequence (demo video → social proof → direct CTA) converts the warm audience cheaply.
- **Pricing is $20/month.** All ad copy and landing pages reflect this. Free trial is unlimited duration — use "free trial" not "free tier."
