# DocAssistAI — Product Design Document
**Date:** 2026-02-22
**Author:** Ricky Baker, MD (Critical Care)
**Version:** 1.0

---

## Vision

> *Signal, not noise.*

DocAssistAI is an **ambient clinical intelligence platform** for hospital clinicians. Where every competitor starts with a microphone, we start with the chart. The AI ingests the full FHIR data stream for a patient, continuously extracts signal from noise, and presents it to the clinician in the right mode for what they need to do next.

Built by a critical care physician who lives this problem every day. Designed for the highest-acuity, highest-data-density environment in medicine — the ICU — then scaled across the hospital.

---

## The Problem

A critical care physician spends up to half their day documenting in the EMR. The data is all there — labs, vitals, meds, consult notes, imaging, microbiology, nursing flowsheets — but it is buried. Finding the signal in that noise requires manual chart review that takes 15–30 minutes per patient, per day, before a single word of documentation is written.

Existing AI tools solve the wrong problem. They listen to the room and transcribe what the doctor says. They do not read the chart and tell the doctor what matters.

No existing tool:
- Synthesizes the full FHIR data stream into a structured clinical briefing
- Serves the consultant who has never seen the patient
- Addresses ICU-specific data density (hourly vitals, drip titrations, vent settings, frequent labs)
- Works equally well for nurses, allied health, and physicians
- Scaffolds toward population-level operational intelligence

---

## Target Users

### Primary (ICU-first launch)
- **ICU Attending Physicians** — daily progress notes, family meetings, complex decision-making
- **Critical Care Fellows** — pre-rounding, note writing, learning patient courses
- **Intensivist Consultants** — rapid chart synthesis, accept notes, consult notes
- **ICU Nurses** — handoff notes, shift summaries, understanding the full patient picture

### Secondary (hospital-wide expansion)
- **Hospitalists** — progress notes, H&Ps, discharge summaries
- **Subspecialty Consultants** — any service being consulted on inpatient cases
- **Allied Health** — PT, OT, SLP, social work, case management documentation

### Institutional (population layer)
- **Quality & Safety Officers** — unit-level metric tracking, bundle compliance
- **Infection Control Teams** — MRSA, CLABSI, VAP, CDiff trend analysis
- **Clinical Researchers / Fellows** — population-level clinical queries
- **Hospital Administration / Compliance** — regulatory reporting, accreditation prep

---

## Go-To-Market Strategy

### Phase 1 — Clinician-Led (PLG inside the EHR)
Launches inside Cerner via SMART on FHIR. No IT involvement required. Individual physicians and nurses launch it themselves. Word spreads organically through the unit.

**Pricing:** $19–29/month per clinician (individual self-serve). Aggressively undercuts every competitor. Still highly profitable due to near-zero marginal cost (AI agents, no human scribes, no large employee base).

### Phase 2 — Unit Adoption
A unit (ICU, medicine floor) adopts informally. The CMIO/CMO hears from clinicians. Usage data and satisfaction metrics make the institutional case.

### Phase 3 — Hospital Contract
Full SMART on FHIR enterprise deployment. BAA signed. Population query layer unlocked for quality/compliance teams. Second buyer (quality/safety officer) activated.

**Pricing:** Enterprise tier (per-seat or site license). Still meaningfully cheaper than competitors at scale.

### Phase 4 — Epic Expansion
Same Signal Engine, different FHIR adapter. Epic FHIR R4 is largely compatible. Targets academic medical centers.

---

## Product Tiers

### Tier 1 — Scribe (Quick Win Revenue Product)
**Price: $19/month**

The fastest product to build and the wedge into the market. Ambient transcription + structured note generation. Clinician records the encounter or dictates; AI generates a structured note draft the clinician copies into the EHR (or pushes via browser extension).

This is what Commure charges $60/month for. We charge $19/month. Same capability, fraction of the price, highly profitable because we have no human scribes and no large engineering team — just AI agents.

- Ambient audio capture (encounter or dictation)
- Medical-terminology-aware transcription
- Structured note generation (SOAP, H&P, progress note, discharge summary)
- Template customization per clinician style
- One-click copy or browser extension push to any EHR
- HIPAA compliant, SOC 2 targeted

**Why we can price here:** Commure has ~1,000 employees, Augmedix acquisition debt, enterprise sales teams, and investor return expectations. We have AI agents and near-zero marginal cost per note generated.

### Tier 2 — Signal (Core Differentiator)
**Price: $49/month**

The Signal Engine. Full chart intelligence. All three modes. ICU-optimized.

Includes everything in Scribe tier plus:
- Briefing Mode
- Chat Mode
- Co-Writer Mode (all ICU note types)
- Cited, sourced outputs
- Time-windowed patient context (6h/12h/24h/48h/admission)
- Cerner SMART on FHIR integration

### Tier 3 — Signal + Population (Enterprise)
**Price: Custom (site license)**

Everything in Signal tier plus:
- Population Query Engine (natural language → FHIR bulk query → stats → report)
- Role-based access (quality officer, infection control, researcher, admin)
- Exportable reports and visualizations
- Epic integration
- BAA, enterprise SLA, dedicated onboarding
- Audit trail and governance dashboard

---

## Core Architecture: The Signal Engine

### What It Does

The Signal Engine is a continuously running AI pipeline that sits on top of the FHIR data layer and does four things:

1. **Ingests** all structured and unstructured data: labs, vitals, med changes, drip titrations, ventilator settings, nursing flowsheets, consult notes, radiology reports, microbiology, imaging impressions, prior history
2. **Normalizes** heterogeneous FHIR resources into a unified clinical timeline
3. **Extracts signal** — identifies what changed, what's trending, what's clinically significant, what's missing, what contradicts prior assessments
4. **Maintains a living patient context object** — a structured, always-current representation of the patient's clinical state, indexed by time window

Every user-facing mode reads from this context object. The engine runs once; all three modes benefit.

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    FHIR DATA LAYER                          │
│  Cerner (SMART on FHIR) → Epic (SMART on FHIR) [v2]        │
│  Labs │ Vitals │ Meds │ Notes │ Reports │ Orders │ Flowsheets│
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   SIGNAL ENGINE                             │
│  FHIR Normalizer → Clinical Timeline Builder                │
│  → Signal Extractor (LLM + rules) → Context Object Store   │
│  → Time-windowed Patient Context (6h/12h/24h/48h/admission) │
└────────────┬──────────────────┬──────────────┬─────────────┘
             │                  │              │
     ┌───────▼──────┐  ┌───────▼──────┐  ┌───▼──────────┐
     │   BRIEFING   │  │     CHAT     │  │  CO-WRITER   │
     │    Mode      │  │    Mode      │  │    Mode      │
     └──────────────┘  └──────────────┘  └──────────────┘
             │                  │              │
┌────────────▼──────────────────▼──────────────▼─────────────┐
│              REACT FRONTEND (existing DocAssistAI)          │
│         Launches via SMART on FHIR inside Cerner/Epic       │
└─────────────────────────────────────────────────────────────┘
             │
┌────────────▼────────────────────────────────────────────────┐
│         POPULATION QUERY ENGINE (scaffolded, v2+)           │
│    Natural language → FHIR bulk query → Stats → Report      │
│    Users: Quality │ Research │ Infection Control │ Admin     │
└─────────────────────────────────────────────────────────────┘
```

---

## The Three Modes

### Mode 1: Briefing
*"What's going on with this patient right now?"*

The clinician opens a patient. Before they touch a note, the AI presents a structured clinical briefing:

- **Headline**: the single most important clinical development ("Vasopressor requirements increasing over 6h despite adequate volume resuscitation — new BCx pending, consider broadening coverage")
- **Signal tier**: bullet-pointed key findings by domain — hemodynamics, respiratory, renal, infectious, neuro, lines/tubes/drains — only items with meaningful change or clinical relevance in the selected time window
- **Stable/unchanged**: collapsed section for quick acknowledgment
- **Pending/outstanding**: cultures, consults, imaging reads not yet returned
- **Time window selector**: 6h / 12h / 24h / 48h / full admission

**Users:** ICU attending on rounds, nurse taking over a patient, fellow pre-rounding, consultant learning the patient for the first time.

### Mode 2: Chat
*"Help me understand something specific about this patient"*

Conversational interface grounded entirely in the patient's chart. Every answer is cited — the AI shows which lab result, note, or order it pulled from, with timestamp.

Example queries:
- "What happened to this patient's creatinine over the last 72 hours?"
- "Summarize the cardiology consult and what they recommended"
- "When was the last time they were in sinus rhythm?"
- "What antibiotics have they received this admission and for how long?"
- "Has this patient been on steroids before and at what doses?"

**Users:** Consultant learning a patient rapidly, covering physician answering a family question, pharmacist reconciling meds, charge nurse getting handoff update.

### Mode 3: Co-Writer
*"Help me write this note"*

Clinician selects a note type. AI pre-populates every section with synthesized, chart-grounded content. Clinician edits, not writes from scratch. Each section is sourced — clinician sees exactly which data point drove each sentence.

**Supported note types (ICU-first):**
- Daily progress note (SOAP / narrative)
- History & Physical
- Transfer note (transferring out of ICU)
- Accept note (accepting a transfer into ICU)
- Consult note / consult accept note
- Discharge summary
- Procedure note (scaffolded)

The AI learns each clinician's editing patterns over time and adjusts future drafts accordingly.

**Ambient add-on (v2):** Clinician speaks exam findings or clinical reasoning not in the chart; AI weaves it into the appropriate note sections alongside chart-derived content.

---

## Population Query Engine (Scaffolded v1, Built v2+)

### What It Does

The same signal extraction capability at population scope. Accepts natural language questions, translates to structured FHIR bulk queries + statistical operations, returns formatted reports with visualizations.

### User Tiers and Use Cases

| Role | Example Queries | Output |
|---|---|---|
| **Quality/Safety Officer** | "What is our VAP rate by month for the last 12 months?" "Show sepsis bundle compliance by unit Q4 2025" | Dashboard, trend charts |
| **Infection Control** | "How has our MRSA acquisition rate trended over 5 years?" "List all CLABSI events in MICU last quarter with line days" | Regulatory-formatted report |
| **Clinical Researcher/Fellow** | "What is the median time to antibiotics for sepsis patients in our ICU in 2024?" "Compare APACHE II scores for patients requiring CRRT vs. IHD" | Exportable data table + summary stats |
| **Administration/Compliance** | "Generate our quarterly NHSN report for ICU HAIs" "How many patients met CMS sepsis core measure criteria last month?" | Accreditation-ready report |

### Scaffolding in v1

- FHIR normalization layer designed to be query-scope-agnostic (patient vs. population)
- Backend exposes `/api/population` namespace (structured but empty)
- Data models support cohort-level aggregation from day one
- FHIR Bulk API (`$export`) integration point documented and stubbed
- No population UI in v1 — hooks and architecture only

---

## Technical Stack

| Layer | Technology | Status |
|---|---|---|
| Frontend | React 18 + TypeScript + Tailwind + Zustand | Existing — extend |
| Backend | Express + TypeScript | Existing — extend |
| FHIR Client | fhirclient 2.5.0 | Existing — extend resource types |
| AI Provider | OpenAI GPT-4o (via existing abstraction layer) | Existing — extend prompts |
| Signal Engine | New pipeline service (Node/TypeScript) | Build |
| Context Store | Redis (session-scoped, no PHI persistence) | Build |
| Audio (Scribe tier) | Web Audio API + Whisper API | Build |
| Population layer | FHIR Bulk API + async job queue | Scaffold |
| Auth | SMART on FHIR (Cerner) → Epic FHIR R4 (v2) | Existing → extend |
| Compliance | HIPAA audit logging (existing), SOC 2 (target) | Existing → extend |

---

## Competitive Edge Summary

| Factor | Competitors | DocAssistAI |
|---|---|---|
| Starts with | Microphone | Chart (FHIR data) |
| Core insight | Transcribe what doctor says | Extract signal from what chart knows |
| ICU optimization | Generic multi-specialty | ICU-native, built by intensivist |
| Consultant experience | Not addressed | First-class mode |
| Between-visit data | Not addressed | Core feature |
| Nurse/allied health | Emerging, not ICU-specific | Designed in from day one |
| Population queries | Not offered | Roadmapped with scaffolding |
| Pricing (scribe) | $60–$800/month | $19/month |
| Pricing (signal) | Not offered by competitors | $49/month |
| Team size | 100–2,000+ employees | AI agents, near-zero marginal cost |
| Capital raised | $50M–$345M | Lean, capital-efficient |
| Go-to-market | Enterprise sales or direct-to-consumer | PLG inside EHR → enterprise |

---

## Build Sequence

### v0.1 — Scribe (Weeks 1–6)
Quick-win revenue product. Ambient transcription + note generation. Browser extension EHR push. $19/month self-serve.

### v0.2 — Signal Engine Core (Weeks 7–16)
FHIR normalizer, clinical timeline builder, signal extractor. Briefing mode only. Cerner SMART on FHIR. ICU data types: labs, vitals, meds, nursing flowsheets.

### v0.3 — Chat Mode (Weeks 17–22)
Conversational interface on top of Signal Engine. Cited answers. Patient-chart-grounded only.

### v0.4 — Co-Writer Mode (Weeks 23–32)
Note type selection. AI-populated sections. ICU note types. Source citations per sentence. Style learning.

### v0.5 — Epic Adapter (Weeks 33–40)
Same Signal Engine, Epic FHIR R4 adapter. Academic medical center targeting.

### v1.0 — Population Query Engine (Weeks 41–52)
FHIR Bulk API integration. Natural language → query → stats → report. Role-based access. Enterprise tier unlock.

---

## Open Questions / Future Considerations

- Ambient microphone integration (v2 Co-Writer add-on) — Web Audio API vs. native mobile app
- Offline/low-connectivity mode for rural hospital contexts
- Specialty expansion beyond ICU (hospitalist, EM, behavioral health)
- API/SDK for third-party EHR embedding (Suki-style partner model)
- ML-based style personalization (fine-tuning vs. prompt-based learning)
- Regulatory pathway: FDA SaMD classification risk assessment needed before clinical decision support features go live
