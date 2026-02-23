# Ambient Clinical Intelligence — Competitive Landscape Research
**Date:** 2026-02-22
**Purpose:** Market analysis for DocAssistAI product and pricing strategy

---

## Market Overview

| Metric | Data |
|---|---|
| Ambient scribe revenue (2025) | $600M (+2.4x YoY) |
| AI-powered clinical documentation market (2025) | $4.01B |
| AI-powered clinical documentation market (2029 projected) | $10.91B (CAGR 28.4%) |
| Total VC invested in ambient AI (2025) | ~$1.6B |
| Health systems using/piloting ambient AI (2025) | 90%+ |
| Health systems with system-wide deployment | 30% |

**Market share (ambient scribe, per Menlo Ventures 2025):**
- Microsoft Dragon Copilot (Nuance DAX): ~33%
- Abridge: ~30%
- Ambience Healthcare: ~13%
- All others (Commure, Suki, DeepScribe, Freed, Nabla, etc.): ~24%

---

## Competitor Profiles

---

### 1. Microsoft Dragon Copilot (formerly Nuance DAX Copilot)

**Market position:** #1 by market share (~33%). Deployed at 150+ health systems.

**What they do:**
- Ambient multi-party, multi-language transcription during the clinical encounter
- AI-generated structured note from the transcript
- "Beyond the Note": referral letters, after-visit summaries, clinical evidence summaries
- Order suggestions surfaced from ambient recording within Epic
- Nursing solution (launched December 2025): records nurse-patient interactions, files into Epic flowsheet documentation
- AI learning loop personalizes to each clinician over time

**How they do it:**
- Azure OpenAI Service + Nuance's proprietary speech AI
- Deeply embedded in Epic via native API (notes appear in correct fields automatically)
- Available via web, mobile (iOS), desktop, and Epic-embedded

**How they scaled:**
- Nuance had 25+ years of healthcare speech AI dominance and 500,000+ physician users before Microsoft acquired them for $19.7B in 2021
- Microsoft's enterprise sales relationships with health systems removed the cold-start problem
- Epic partnership gave them distribution inside the most-used EHR in the country
- The DAX brand already existed in hospitals — DAX Copilot was an upgrade path, not a new sale
- Capital: effectively unlimited (Microsoft balance sheet)

**Pricing:** $600–$800/month per provider. Enterprise contracts only. 1–3 year commitments.

**Key strengths:**
- Deepest Epic integration of any third-party vendor
- Largest installed base and most clinical outcome data
- Global rollout capability (US, Canada, UK, EU expansion)
- 70% of users report reduced burnout; 50% documentation time reduction

**Known weaknesses:**
- Most expensive option in the market — inaccessible to small/independent practices
- iOS-only mobile historically
- Complex enterprise IT setup required
- Now faces competition from Epic's own native AI Charting tool within Epic
- Being rebranded from DAX Copilot to Dragon Copilot — customer confusion risk

**DocAssistAI opportunity:**
Dragon Copilot is purely audio-first. It does not read the chart — it transcribes what the physician says. For an ICU physician who needs the AI to know what happened overnight before they even open their mouth, Dragon Copilot provides zero value. We do not compete with Dragon Copilot — we solve a problem they have not attempted to solve. On pricing: at $19/month for Scribe tier (vs. their $600–800/month), we are 30–40x cheaper for the transcription-only use case.

---

### 2. Abridge

**Market position:** #2 by market share (~30%). #1 Best in KLAS for Ambient AI (2026, second consecutive year).

**What they do:**
- Ambient listening with generative AI note generation
- **Linked Evidence** (their key differentiator): every word/phrase in the AI-generated note is mapped back to the source audio or transcript — clinician can click any phrase to hear the original conversation
- 28+ languages, 50+ specialties
- Abridge Inside for Emergency Medicine (Epic ASAP module)
- Abridge Inside for Inpatient (co-developed with Epic)
- Outpatient orders workflow (early pilot)
- Prior authorization integration with Availity

**How they do it:**
- Generative AI with proprietary linked evidence architecture
- Built within Epic's Workshop program — exclusive co-development partner for inpatient workflows
- First vendor in Epic's Partners and Pals program

**How they scaled:**
- Founded 2018, originally a consumer health app, pivoted to ambient clinical AI
- Broke through with Mayo Clinic (2,000 clinicians), then Kaiser Permanente (largest generative AI rollout in healthcare history — 40 hospitals + 600+ offices)
- Epic Workshop partnership gave them co-development access unavailable to competitors
- UPMC partnership (12,000+ clinicians) and Northwell (20,000 physicians + 22,000 nurses) built enterprise credibility
- Capital raised: not publicly disclosed but significant institutional backing; Forbes AI 50, TIME Best Inventions
- Growth strategy: land at one major AMC, prove outcomes, expand regionally

**Pricing:** Custom enterprise only. No public pricing. Long enterprise sales cycles (6–18 months typical).

**Key strengths:**
- Linked Evidence auditability — addresses hallucination trust concerns more directly than any competitor
- Deepest Epic co-development relationship (Workshop program)
- Strong academic medical center penetration
- Consistent #1 KLAS scores — powerful social proof in enterprise sales

**Known weaknesses:**
- Enterprise-only — completely inaccessible to small/independent practices or individual clinicians
- Heavy Epic dependency — liability as Epic builds its own native tool
- Custom pricing means opaque value comparison for buyers
- Primarily physician-focused (nursing expansion not yet widely deployed)

**DocAssistAI opportunity:**
Abridge is audio-first, Epic-first, enterprise-first. Their linked evidence feature (tracing note text back to audio) is clever but solves a problem we don't have — our outputs trace back to specific FHIR data points with timestamps, not audio clips. For the ICU consultant who has never seen the patient and needs to synthesize a complex hospital course from the chart, Abridge offers nothing. We do.

---

### 3. Commure Scribe

**Market position:** Mid-market and enterprise. 150+ health systems, 2,000+ sites of care, 40M+ ambient appointments.

**What they do:**
- Ambient recording of patient-clinician encounters (in-person or telehealth)
- AI-generated structured clinical note pre-formatted to clinician style and specialty
- Automated ICD-10/CPT coding
- One-click EHR synchronization (where integrated; otherwise copy-paste)
- AI "nudges" suggesting contextually relevant updates during review
- 12-hour patient summaries and AI chart query interface
- Care pathway automation prompting personalized care programs
- Revenue cycle management (separate but integrated product)

**How they do it:**
- Proprietary LLMs continuously adapting to clinician preferences
- ASR as foundation, NLP and LLMs for note structuring
- Multi-input: audio, images, documents
- CommureOS infrastructure for deeper EHR data access
- 60+ languages, sessions up to 3+ hours

**How they scaled:**
- Commure was originally an enterprise healthcare infrastructure company
- Acquired Augmedix (pioneer ambient AI company, founded 2013) for ~$139M — gave them 200,000+ documented encounters and an existing enterprise customer base
- Merged with Athelas (AI scribe + RCM company) — gave them revenue cycle capabilities and additional health system relationships
- HCA Healthcare partnership (188 hospitals, 2,400+ ambulatory sites) — largest known deployment of ambient AI in healthcare history — gave them proof at massive scale
- Capital: very significant ($139M Augmedix acquisition alone, plus Athelas merger, plus ongoing VC/PE backing); named Fortune Future 50 2025
- Employee count: ~1,000+
- Growth strategy: platform bundling — 80% of customers use more than one Commure product, creating switching costs

**Pricing:**
- Pro: $708/year (~$59/month billed annually) or monthly equivalent
- Enterprise: custom
- Legacy Augmedix (human-in-the-loop scribe): ~$2,000/month

**Key strengths:**
- Integrated RCM platform — creates genuine switching costs and upsell revenue
- HCA-scale deployment — most enterprise credibility in market
- Deepest EHR data access via CommureOS
- Forward-deployed engineering embedded at health system partners

**Known weaknesses:**
- Platform breadth vs. depth tradeoff — may be weaker than specialists in any single area
- Rapid M&A (Augmedix + Athelas) creates integration risk
- Self-serve Pro tier lacks deep EHR write-back — still copy-paste for many clinicians
- Competing against Epic's own native tools in Epic-heavy systems

**DocAssistAI opportunity:**
This is the most direct comparison for our Scribe tier. Commure's $59/month Pro product requires the clinician to still copy-paste the note into the EHR. We can offer equivalent or better transcription + note generation at $19/month — one-third the price — and still be highly profitable because we have no human scribes, no $139M acquisition debt, no 1,000-person employee base, and no investor return pressure at that scale. Our SMART on FHIR integration (already built in DocAssistAI) can push notes directly into Cerner without copy-paste — a feature Commure's Pro tier does not offer. On the Signal Engine side (Briefing + Chat + Co-Writer), we offer capabilities Commure does not offer at any price point.

---

### 4. Ambience Healthcare

**Market position:** Fastest-growing major player. ~13% market share. $1.25B valuation after $243M Series C (July 2025).

**What they do:**
- AutoScribe: real-time ambient documentation
- Real-time compliance engine
- ICD-10 CDI (Clinical Documentation Improvement) assistant
- Chart Chat: AI copilot built directly into the EHR
- Point-of-care coding
- Specialty-specific chart summaries prepared pre-visit
- Inpatient capabilities (launched November 2025)

**How they do it:**
- Custom-built AI specifically trained on clinical data (not generic LLM wrappers)
- Deep integration with Epic Ambient Module and Haiku
- In Epic's Toolbox program

**How they scaled:**
- Founded ~2020; grew through targeted enterprise pilots
- Cleveland Clinic 6-month competitive head-to-head evaluation — selected Ambience over all major competitors — became an exclusive 5-year contract and the most powerful third-party validation in the market
- OpenAI Startup Fund investment (signals technology differentiation and OpenAI partnership)
- Investors: a16z, Kleiner Perkins, Optum Ventures, Oak HC/FT
- Total raised: $345M
- Growth strategy: win competitive head-to-head evaluations at marquee institutions, use as proof for the next sale
- Fastest product roadmap in the market — Chart Chat, CDI, inpatient all shipped within months of each other in 2025

**Pricing:** Custom enterprise only. No public pricing.

**Key strengths:**
- Fastest-moving product roadmap of any major player
- Cleveland Clinic exclusive 5-year contract after head-to-head evaluation
- OpenAI Startup Fund backing
- Moving toward documentation + revenue cycle platform

**Known weaknesses:**
- Newest major player — least long-term outcome data
- Enterprise-only
- Rapid feature expansion (CDI + coding + chat) raises execution risk
- Pricing opacity

**DocAssistAI opportunity:**
Ambience's Chart Chat is the closest existing product to our Chat Mode — but it is reactive (answer questions) not proactive (surface signal without being asked), it is Epic-only, and it is enterprise-only at custom pricing. Our Briefing Mode (which proactively surfaces signal before the clinician even asks) has no equivalent in any competitor's product.

---

### 5. Suki AI

**Market position:** Established mid-market and enterprise. KLAS score 93.2/100. Industry-leading 70%+ clinician adoption rate.

**What they do:**
- End-to-end ambient AI assistant from pre-charting through documentation to clinical reasoning
- Voice commands (no memorized syntax)
- Automated coding: ICD-10, HCC, CPT, E/M
- **Ambient prescription order staging** — first in industry to ambiently generate and stage prescription orders
- Chart-aware Clinical Q&A (answers patient-specific questions from EHR context)
- Patient chart summaries
- 100+ specialties, iOS and Android
- Suki for Partners API/SDK — allows other platforms to embed Suki

**How they do it:**
- Proprietary AI + Google Cloud Vertex AI
- Bidirectional real-time EHR integrations
- Partner/SDK strategy for distribution through other healthcare platforms

**How they scaled:**
- Founded 2017 by Punit Singh Soni (former Google, Flipkart executive)
- Grew through mid-market health systems (100+ provider groups) before pursuing enterprise
- Broadest native EHR integration portfolio: Epic, Oracle Health, athenahealth, MEDITECH — first ambient AI vendor integrated with MEDITECH Expanse
- 2025 nursing consortium: co-developing nursing solution with health systems
- Capital: significant institutional backing; exact total not publicly disclosed
- Employee count: ~200–400 estimated
- Growth strategy: broadest EHR integrations + partner/API model for distribution

**Pricing:**
- Suki Compose: ~$299/month/user
- Suki Assistant: ~$399/month/user
- Enterprise: custom

**Key strengths:**
- Broadest native EHR integration portfolio (4 major EHRs)
- 70%+ adoption rate — significantly above industry norm (~20–50% typical)
- Ambient prescription order staging (industry first)
- Partner API/SDK model enables embedding across diverse platforms
- 9X ROI in year 1 (KLAS-validated)

**Known weaknesses:**
- Mid-range pricing ($299–399/month) — not accessible to small practices
- Nursing solution still in co-development
- Coding/RCM capabilities still expanding vs. more mature competitors

**DocAssistAI opportunity:**
Suki's Clinical Q&A is reactive chart-querying — similar to our Chat Mode but without the proactive signal extraction of our Briefing Mode. Their 70%+ adoption rate tells us that when AI documentation tools are genuinely useful, clinicians will adopt them rapidly. We should target the same high-adoption outcome by focusing on ICU-specific signal quality that generalist tools like Suki cannot match.

---

### 6. DeepScribe

**Market position:** Specialty-focused. KLAS score 98.8/100 — highest of any ambient AI vendor in 2025. 1,500+ healthcare organizations.

**What they do:**
- Completely passive ambient capture (no commands during the visit)
- AI filtering: removes small talk, identifies clinically relevant content
- EHR-ready structured notes
- Smart Refinement for after-hours dictation
- HCC, CPT, ICD-10 suggestions with E&M coding directly in note
- Specialty-aware AI (Oncology, Cardiology, Orthopedics, Urology)

**How they do it:**
- Trained on ~2 million patient encounters (claimed largest clinical conversation database)
- Specialty-specific fine-tuning per specialty
- Zero interrupt philosophy — no setup needed per visit
- Standalone app with EHR write-back integration (not natively embedded in EHR UI)

**How they scaled:**
- Founded 2017, grew slowly through specialty practices
- Cracked high-complexity specialties (Oncology, Cardiology) that generalists handled poorly
- Highest KLAS score became a self-reinforcing marketing advantage in enterprise sales cycles
- Capital: ~$30M+ raised; smaller than top-tier competitors
- Employee count: ~100–200 estimated
- Growth strategy: specialty depth over breadth — become the undisputed best in complex specialties

**Pricing:** ~$8,000/year (~$667/month); EHR integration adds ~$100/month/provider.

**Key strengths:**
- Highest KLAS score of any ambient AI vendor (98.8/100)
- Unrivaled specialty depth in Oncology, Cardiology
- E&M coding embedded directly in draft notes
- Largest proprietary clinical conversation training dataset (claimed)

**Known weaknesses:**
- Point solution — no broader platform, no coding/RCM expansion, no patient apps
- Enterprise sales process; no self-serve
- May be displaced by expanding platforms (Commure, Ambience) as they deepen specialty coverage
- Limited specialty breadth despite depth in chosen specialties

**DocAssistAI opportunity:**
DeepScribe's strength is specialty audio training. Our strength is chart data synthesis. For ICU documentation, the chart is richer than the conversation — a DeepScribe equivalent in the ICU would capture what the attending says on rounds but miss the 47 lab values, 12 hours of vital signs, and overnight nursing notes that actually drove the clinical picture. We solve the problem DeepScribe cannot solve.

---

### 7. Nabla Copilot

**Market position:** European-founded (France), US expansion. Mid-market / SMB friendly. Powers NextGen Healthcare's Ambient Assist.

**What they do:**
- Ambient note generation for 55+ medical specialties
- Multilingual: English, Spanish, French + others
- ICD-10 coding suggestions
- EHR integration with auto-population
- Dictation mode + clinical nudges
- Privacy-first: no audio stored by default; PII masked during LLM processing

**How they do it:**
- LLM-based with specialized healthcare training
- Chrome extension — EHR-agnostic without deep native integration
- HIPAA + GDPR + SOC 2 Type 2 + ISO 27001 certified

**How they scaled:**
- Founded in France, expanded to US market
- NextGen Healthcare partnership gave them embedded distribution through mid-market EHR with existing practice customers
- Privacy-first positioning carved a niche in GDPR-regulated European markets and privacy-sensitive US settings
- Capital: $44.6M total raised ($24M Series B)
- Employee count: ~100 estimated
- Growth strategy: partnership-led distribution (NextGen) + privacy differentiation

**Pricing:** ~$119/month/provider. Free tier with limits.

**Key strengths:**
- GDPR compliance — strongest option for EU and privacy-sensitive markets
- Chrome extension works with any EHR without deep integration
- Privacy-by-design (no audio retention)
- Partnership model for distribution

**Known weaknesses:**
- Less deep EHR write-back vs. natively integrated competitors
- Smaller R&D budget limits feature velocity
- Less specialty depth than DeepScribe
- Primarily documentation-focused — no coding or RCM expansion

**DocAssistAI opportunity:**
Nabla's Chrome extension approach is smart for distribution — EHR-agnostic without deep integration. We use SMART on FHIR which is more powerful (we can read chart data, not just push text) but requires EHR support. Nabla's pricing ($119/month) gives us room — our Scribe tier at $19/month is 6x cheaper and includes direct FHIR integration.

---

### 8. Freed AI

**Market position:** Leading self-serve / SMB AI scribe. 25,000+ clinicians; 1,000+ organizations.

**What they do:**
- Ambient scribe with medical-terminology-trained ASR
- One-click push to any browser-based EHR
- Patient-friendly after-visit instructions
- Auto-generated clinical letters
- ICD-10 code suggestions
- Customizable templates that learn clinician style
- 14+ languages
- Works on any device, setup in minutes, zero IT required

**How they do it:**
- Consumer-grade LLM with medical specialization
- Browser extension for EHR compatibility without native integration
- Mobile app + web app

**How they scaled:**
- Targeted the completely underserved solo/small practice market that enterprise tools ignored
- $99/month flat rate with 7-day free trial, no credit card — removed all friction from the top of the funnel
- 15-minute setup wizard — zero IT, zero procurement, zero enterprise sales cycle
- Word of mouth among physicians and NPs who were frustrated with $600–800/month enterprise options
- Capital: relatively small; bootstrapped or lightly funded (exact amount not publicly disclosed)
- Employee count: ~20–50 estimated
- Growth strategy: pure PLG — make it so easy and cheap that clinicians adopt individually, then aggregate into organizational contracts

**Pricing:** $99/month flat rate per user. No enterprise minimum.

**Key strengths:**
- Price point — 6–8x cheaper than mid-market competitors
- Zero IT requirement — truly accessible to independent practices
- Fastest onboarding in the market (15 minutes)
- Broad care setting applicability including telehealth and rural practice

**Known weaknesses:**
- No native EHR write-back — copy-paste or one-click browser extension only
- No session analytics or productivity tracking
- Not suitable for enterprise needs
- Limited coding depth
- No nursing or allied health workflow specialization

**DocAssistAI opportunity:**
Freed proves the PLG model works in healthcare. Clinicians will pay $99/month out of pocket if the product genuinely saves them time. We can undercut Freed at $19/month with a product that is significantly more powerful (FHIR-integrated, chart-reading, ICU-optimized) and still be profitable. Freed's weakness is that it only knows what the doctor says — we know what the chart says.

---

### 9. Behavioral Health Specialists

#### Eleos Health
- **Focus:** Community behavioral health organizations
- **Core Features:** Ambient capture without audio storage; biopsychosocial assessment; treatment planning; compliance review (note cloning, empty notes); 100+ languages; behavioral analytics
- **Differentiator:** Purpose-built for Medicaid compliance, supervision workflows, multi-role notes
- **Pricing:** Custom enterprise

#### Upheal
- **Focus:** Individual therapists and small therapy practices
- **Core Features:** Consent-based session recording; SOAP/DAP/GIRP note generation; mood/theme/goal pattern tracking; practice management (scheduling, billing, telehealth)
- **Differentiator:** All-in-one therapy platform + AI documentation + session analytics
- **Pricing:** ~$69–99/month billed annually; free unlimited basic notes tier

**DocAssistAI opportunity:** Behavioral health is a future expansion opportunity. ICU first, then behavioral health as a distinct specialty mode.

---

### 10. EHR-Native Entrants (The Incumbent Threat)

All major EHRs have launched or announced native ambient AI scribes — the single most disruptive force in the market:

| EHR | Product | Status | Cost |
|---|---|---|---|
| **Epic** | AI Charting | Live (2025); used 16M+ times/month | Included for Epic customers |
| **athenahealth** | athenaAmbient + Sage AI | User testing begins February 2026 | No additional cost |
| **Oracle Health** | Native AI EHR | Launched August 2025 | TBD |
| **MEDITECH** | Via Suki partnership | Live | Via Suki pricing |

**Why this matters:** When the EHR offers a free ambient scribe, every third-party vendor must differentiate substantially. Basic transcription is commoditizing. The vendors who survive are those offering capabilities the EHR cannot — deeper specialty optimization, population analytics, cross-EHR portability, or (our approach) chart-data-driven intelligence rather than audio transcription.

**DocAssistAI opportunity:** Epic AI Charting transcribes the visit. It does not read the chart and synthesize 48 hours of ICU data before the physician walks in the room. We do not compete with Epic AI Charting — we complement it, or we replace the need for it by solving a fundamentally different problem.

---

## The Capital Efficiency Argument

This is the core strategic insight for DocAssistAI's pricing and positioning:

| Company | Capital Raised | Employees | Monthly Price |
|---|---|---|---|
| Microsoft/Nuance | $19.7B acquisition | ~10,000 (Nuance pre-acquisition) | $600–800/month |
| Abridge | Significant (undisclosed) | ~200–400 | Custom enterprise |
| Ambience | $345M | ~200–500 | Custom enterprise |
| Commure | $139M+ (Augmedix) + Athelas merger | ~1,000 | $59/month (Pro) |
| Suki | Significant (undisclosed) | ~200–400 | $299–399/month |
| DeepScribe | ~$30M | ~100–200 | ~$667/month |
| Nabla | $44.6M | ~100 | $119/month |
| Freed | Minimal | ~20–50 | $99/month |
| **DocAssistAI** | **Lean** | **AI agents (near-zero marginal cost)** | **$19–49/month** |

Every competitor built their pricing around:
- Large engineering and sales teams
- Human scribes (Augmedix/Commure legacy)
- Investor return expectations on large capital raises
- Enterprise sales infrastructure

We build our pricing around:
- AI agents doing the work of engineering, QA, content generation, and customer support
- SMART on FHIR doing the EHR integration work (no expensive custom integrations)
- Existing open-source LLM infrastructure (OpenAI API cost per note is cents, not dollars)
- PLG distribution (clinicians find us, adopt us, recommend us — no enterprise sales team required initially)
- Near-zero marginal cost per additional user or note generated

**The math on Scribe tier:**
- GPT-4o cost to generate a clinical note: ~$0.02–0.05 per note
- A clinician writes ~5–10 notes per day, ~150–200 per month
- AI cost per clinician per month: ~$3–10
- Our price: $19/month
- Gross margin: ~50–85% at scale
- Commure's price: $59/month for the same capability (minus direct EHR write-back)

**The math on Signal tier:**
- FHIR data fetch + signal extraction per patient per day: ~$0.10–0.30 in LLM costs (complex multi-resource synthesis)
- ICU clinician reviews ~8–15 patients per day
- AI cost per clinician per month: ~$25–100 (higher complexity)
- Our price: $49/month
- Gross margin: still positive at launch, improving rapidly with prompt optimization and model efficiency
- No competitor offers this capability at any price point

---

## Key Market Gaps We Are Filling

1. **ICU-native chart intelligence** — No competitor reads the chart and synthesizes signal. All start with audio.
2. **Consultant experience** — The consultant accept/consult note workflow is unaddressed by every major player.
3. **Proactive briefing** — Every competitor is reactive (transcribe what you say, answer what you ask). We are proactive (here is what matters, before you ask).
4. **Inpatient hospital-wide** — Existing tools are optimized for outpatient ambulatory visits. ICU documentation is a different problem.
5. **Nurse and allied health** — No ICU-specific tool for nursing documentation, flowsheet synthesis, or shift handoff.
6. **Population-level operational intelligence** — Quality, infection control, compliance, and research queries across the EMR. No ambient AI vendor offers this.
7. **Accessible pricing** — $19/month for Scribe, $49/month for Signal. The market has no offering between $99/month (Freed, limited) and $299/month (Suki, generalist). We own that gap with a hospital-inpatient-specialized product.

---

## Sources

- Menlo Ventures 2025 State of AI in Healthcare
- KLAS Research 2025 Ambient AI Spotlight Report
- KLAS Research 2026 Best in KLAS: Ambient AI
- Healthcare Dive: Commure/Augmedix acquisition coverage
- Fierce Healthcare: Abridge, Ambience, Epic AI Charting coverage
- Commure Scribe pricing page (getscribe.commure.com/pricing-page)
- Suki AI 2025 Year in Review
- Freed AI product documentation
- Nabla product documentation
- DeepScribe product documentation
- General Catalyst: Commure x HCA case study
- Research and Markets: AI-Powered Clinical Documentation Market Report
