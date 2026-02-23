# DocAssist Scribe — Standalone Product Design

**Date:** 2026-02-23
**Status:** Approved — Ready for Implementation Planning
**Author:** DocAssistAI Product Team

---

## Product Vision

DocAssist Scribe is a standalone clinical documentation tool accessible at `scribe.docassist.ai` — mobile-first, works in any browser, no installation required. A clinician records a patient encounter, receives a structured AI note in seconds, reviews and refines it section by section, uses an in-note chat interface for clinical questions that ghost-writes answers directly into the note, and copies the final note into their EHR.

The product stands alone at launch and integrates seamlessly with the SMART on FHIR DocAssistAI platform later — no redesign required for the integration because the architecture is bridge-ready from day one.

**Core promise:** Any clinician. Any device. Five minutes from app open to a draft note ready to paste into the chart.

---

## Target Users

**Primary (v1):** ICU and critical care physicians, hospital medicine internists, intensivists in independent or small-group practice. Currently paying $60+/month for Commure Scribe, or manually dictating into Dragon or typing notes. High documentation burden (8–12 patients/day), complex multi-system assessments, significant medicolegal documentation stakes.

**Secondary (v1):** Hospitalists, general internists, and other inpatient clinicians across medicine and surgery. Notes are long and dense; time savings are measurable.

**Tertiary (v2+):** Allied health professionals — physical therapists, occupational therapists, speech language pathologists — who need section-by-section documentation of functional assessments. The section library's custom section capability directly serves PT/OT workflows (e.g., "Lower Extremity Strength," "Coordination," "Functional Goals").

**Long-term:** Any outpatient clinician willing to use a copy-paste EHR workflow; eventually, any clinician whose health system uses Epic/Oracle Health via SMART on FHIR launch.

---

## Competitive Differentiation

See `2026-02-23-competitor-analysis.md` for full analysis. Summary of primary differentiators:

| Feature | DocAssist Scribe | Commure ($60) | Nabla ($119) | DAX Copilot ($149–300) |
|---|---|---|---|---|
| Price | **$20/mo** | $60/mo | $119/mo | $149–300/mo |
| ICU-specific sections | **✅ Yes** | ❌ | ❌ | Partial |
| Drag-and-drop section builder | **✅ Yes** | ❌ | ❌ | ❌ |
| Per-section Focused AI + guideline citations | **✅ Yes** | ❌ | ❌ | ❌ |
| In-note chat + ghost-writing | **✅ Yes** | ❌ | ❌ | ❌ |
| No annual contract | **✅ Yes** | ❌ | ❌ | ❌ |
| No IT required | **✅ Yes** | Partial | ✅ Yes | ❌ |
| Native EHR push | ❌ (v2) | ✅ | Partial | ✅ |

---

## Architecture

### Frontend

```
scribe.docassist.ai  →  same Vite/React app, new route group /scribe/*

/scribe/login              — Auth screens (email + password)
/scribe/register           — New account creation
/scribe/dashboard          — Note history, new note button, search
/scribe/note/new           — Record + build + generate
/scribe/note/:id           — View/edit/refine saved note
/scribe/templates          — Section library + drag-and-drop template builder
/scribe/settings           — Account settings, subscription status
```

The `/scribe` route group renders its own layout component — no ICU dashboard chrome, no FHIR patient context, no EHR navigation. It is visually and functionally distinct from the main DocAssistAI application, branded as "DocAssist Scribe."

Subdomain routing: `scribe.docassist.ai` → same deployment, DNS CNAME pointing to same Vite app, Vite router detects `/scribe` prefix and renders the Scribe layout.

### Backend (existing Express server, new routes)

```
Authentication
  POST /api/scribe/auth/register        — Create account (email + password)
  POST /api/scribe/auth/login           — JWT login
  GET  /api/scribe/auth/me              — Get current user from JWT
  POST /api/scribe/auth/logout          — Invalidate session

Note Management
  GET  /api/scribe/notes                — List user's notes (paginated, searchable)
  POST /api/scribe/notes                — Save a new generated note
  GET  /api/scribe/notes/:id            — Get single note with sections
  PUT  /api/scribe/notes/:id            — Update note (content edits, section reorder)
  DELETE /api/scribe/notes/:id          — Soft-delete note

Template / Section Library
  GET  /api/scribe/templates            — Get user's section library (pre-built + custom)
  POST /api/scribe/templates            — Create custom section
  PUT  /api/scribe/templates/:id        — Update custom section name/prompt
  DELETE /api/scribe/templates/:id      — Delete custom section
  GET  /api/scribe/templates/prebuilt   — Get system pre-built sections (read-only)

AI Endpoints (new Scribe-specific)
  POST /api/ai/scribe/generate          — Generate all sections from transcript (one Claude call)
  POST /api/ai/scribe/focused           — Focused AI: deep analysis + guideline citations for one section
  POST /api/ai/scribe/ghost-write       — Ghost-write chat answer into note section in clinician's voice
  POST /api/ai/scribe/chat              — In-note chat: clinical Q&A (reuses existing /api/ai/chat)

Existing AI endpoints reused:
  POST /api/ai/transcribe               — Whisper transcription (already built)
```

### Database

SQLite (development) → Postgres (production, Heroku or Railway).

```sql
-- Users
CREATE TABLE scribe_users (
  id          TEXT PRIMARY KEY,  -- UUID
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name        TEXT,
  specialty   TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Notes
CREATE TABLE scribe_notes (
  id          TEXT PRIMARY KEY,  -- UUID
  user_id     TEXT NOT NULL REFERENCES scribe_users(id),
  note_type   TEXT NOT NULL,     -- 'progress_note', 'h_and_p', etc.
  patient_label TEXT,            -- free-text, not MRN
  transcript  TEXT,              -- raw Whisper output
  status      TEXT DEFAULT 'draft', -- 'draft', 'finalized'
  deleted_at  DATETIME,          -- soft delete
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Note Sections (each section of a note stored independently)
CREATE TABLE scribe_note_sections (
  id           TEXT PRIMARY KEY,  -- UUID
  note_id      TEXT NOT NULL REFERENCES scribe_notes(id),
  section_name TEXT NOT NULL,
  content      TEXT,              -- AI-generated + edited content
  prompt_hint  TEXT,              -- section's generation prompt
  display_order INTEGER NOT NULL,
  focused_ai_result TEXT,         -- JSON: analysis + citations from Focused AI call
  chat_insertions TEXT,           -- JSON array of {query, answer, inserted_text, timestamp}
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Section Template Library (per user)
CREATE TABLE scribe_section_templates (
  id           TEXT PRIMARY KEY,  -- UUID
  user_id      TEXT REFERENCES scribe_users(id),  -- NULL = system pre-built
  name         TEXT NOT NULL,
  prompt_hint  TEXT,              -- "Focus on lower extremity strength, ROM, and functional progress"
  is_prebuilt  BOOLEAN DEFAULT FALSE,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## Feature Specifications

### 1. Authentication (Email + Password, JWT)

**Registration:**
- Fields: email, password (min 8 chars), name, specialty (optional dropdown)
- Password hashed with bcrypt (12 rounds)
- JWT issued on successful registration, stored in httpOnly cookie
- No email verification in v1 (add in v2)

**Login:**
- Email + password
- JWT returned in httpOnly cookie (7-day expiry)
- "Remember me" extends to 30 days

**Auth guard:**
- All `/scribe/*` routes except `/scribe/login` and `/scribe/register` require valid JWT
- Backend middleware validates JWT on all `/api/scribe/*` routes

**Security notes:**
- Passwords never stored in plaintext
- JWT secret rotated in production
- HIPAA-appropriate: no PHI in JWTs (user ID only)

---

### 2. Section Library + Drag-and-Drop Note Builder

The section library is the core differentiator of the product.

**Pre-built sections (system-provided, not editable):**

General:
- Chief Complaint, HPI (History of Present Illness), Past Medical History, Social History, Family History, Medications, Allergies, Review of Systems, Physical Exam, Assessment, Plan, Disposition

ICU/Critical Care:
- Sedation & Analgesia, Ventilator Management, Vasopressor Status, Lines & Drains, Infectious Disease, Neurological Status, Renal & Fluid Balance, Nutrition & GI, Goals of Care, Code Status, APACHE/SOFA Score, Overnight Events, Pending Studies

Specialty:
- Procedure Details, Operative Findings, Discharge Instructions, Follow-up Plan, Consult Recommendations, Reason for Transfer

**Custom sections (user-created):**
- User provides: Section Name (required), Prompt Hint (optional, plain English instruction to the AI)
- Example: Name = "Lower Extremity Strength", Hint = "Document lower extremity strength testing results, functional range of motion, and progress toward therapy goals"
- Example: Name = "Vasopressor Weaning", Hint = "Document current vasopressor doses, weaning progress, hemodynamic targets, and response"
- Custom sections are saved to the user's library and reusable across all future notes

**Note Canvas (drag-and-drop):**
- Two-column layout on desktop; single-column stacked on mobile
  - Left panel: Section Library (scrollable, searchable, grouped by category)
  - Right panel: Active Note Canvas (empty initially)
- Drag any section from library to canvas to add it
- Drag sections within the canvas to reorder them
- Tap/click × on any section in canvas to remove it
- Canvas sections show: section name, prompt hint (if any), empty content placeholder
- "Save as Template" button: saves current canvas section arrangement as a named note template for reuse (e.g., "My ICU Progress Note")
- On mobile: library is accessible via a bottom sheet drawer; canvas is the primary view

**Library Implementation:**
- `react-beautiful-dnd` or `@dnd-kit/core` for drag-and-drop
- Library state managed in Zustand store (`scribeBuilderStore`)
- Canvas state persists to localStorage between sessions (restore if browser refreshes before recording)

---

### 3. Recording + Transcription (Existing Pipeline — Reused)

The core audio pipeline is already built and tested. DocAssist Scribe reuses it directly:

**Existing components:**
- `AudioRecorder.tsx` — MediaRecorder API, race condition guards, stream cleanup on unmount, duration timer
- `POST /api/ai/transcribe` — multer multipart upload → OpenAI Whisper-1 → transcript text
- `WhisperService.ts` — Whisper-1 with medical terminology prompt, supports webm/mp4/wav

**Recording UX on the note screen:**
1. User has set up canvas sections (or loaded a saved template)
2. Large "Record" button at the top of the note screen
3. Tap → microphone permission prompt (first time only) → live red recording indicator + timer
4. Tap "Stop" → spinner: "Transcribing..."
5. Transcript text appears in a collapsible "Transcript" section below the record button
6. Generation begins automatically (see Section 4)

**Mobile considerations:**
- Screen does not lock during recording (wake lock API)
- Microphone permission state handled gracefully — if denied, show "Enable microphone in Settings" with instructions
- Audio format: webm preferred, mp4 fallback for Safari iOS

---

### 4. Note Generation (Single Claude Call, All Sections)

After transcription completes, a single Claude call generates content for all sections in the canvas simultaneously.

**Request payload to `POST /api/ai/scribe/generate`:**
```json
{
  "transcript": "...",
  "sections": [
    { "name": "HPI", "promptHint": "" },
    { "name": "Assessment", "promptHint": "" },
    { "name": "Vasopressor Status", "promptHint": "Current doses, weaning progress, hemodynamic targets" },
    { "name": "Plan", "promptHint": "" }
  ],
  "noteType": "progress_note",
  "userContext": { "specialty": "Critical Care" }
}
```

**System prompt pattern:**
```
You are a clinical documentation AI assistant for a {specialty} physician.
Generate content for each note section below, based ONLY on the transcript provided.
Write in the first-person plural physician voice ("We will...", "The patient was...", "Our assessment is...").
Be clinically precise. Do not fabricate findings not present in the transcript.
For each section with a prompt hint, prioritize that focus area.
If a section cannot be completed from the transcript, write: "Insufficient information captured."

Return JSON:
{
  "sections": [
    { "name": "Section Name", "content": "...", "confidence": 0.0-1.0 }
  ]
}
```

**UX after generation:**
- Sections populate sequentially with a brief stagger animation ("streaming feel") even though the response arrives all at once
- Each section shows a confidence indicator (color-coded badge: green >0.8, yellow 0.5–0.8, red <0.5)
- Low-confidence sections highlight in yellow to prompt clinician review
- All sections are immediately editable inline (contentEditable or textarea)

**Fallback:** If JSON parse fails, render raw content in a single "Note" section with a warning to review formatting.

---

### 5. Focused AI (Per-Section, Premium Metered)

Every section in the generated note displays a ⚡ "Focused AI" button.

**What Focused AI does:**
- Sends the section name, content, transcript, and specialty to `POST /api/ai/scribe/focused`
- Returns:
  - **Deeper analysis:** Expanded clinical reasoning for the section content
  - **Guideline citations:** Relevant clinical guidelines with specific recommendations
    - ICU: Surviving Sepsis Campaign, ARDS Network, PADIS, ACLS, AHA/ACC
    - Neurology: AHA/ASA Stroke Guidelines, NCS guidelines
    - General: UpToDate-style evidence summaries
  - **Confidence breakdown:** Which claims in the section are well-supported vs. inferred
  - **Suggested additions:** Clinically relevant items the clinician may have omitted

**UI:**
- Clicking ⚡ opens a slide-in panel (right side on desktop, bottom sheet on mobile)
- Panel shows: analysis text, guideline citations as expandable cards, suggested additions
- "Apply suggestions" button adds suggested text to the section (with clinician review diff)
- Focused AI result is saved with the note section for audit trail

**Billing (v2):**
- Tracked per-call server-side by user ID
- $0.50/call OR $5/month add-on for 15 calls/month
- Counter visible in user settings ("3 of 15 Focused AI calls used this month")
- In v1 beta: unlimited Focused AI, free

---

### 6. In-Note Chat + Ghost-Writing

A floating chat button (💬) is always visible on the note screen. It does not obstruct the note content.

**Open behavior:**
- Mobile: bottom sheet drawer slides up (50% screen height, expandable to full)
- Desktop: right panel slides in (350px wide, note canvas shifts left)
- Chat history persists for the current note session

**Chat interaction:**
1. Clinician types a clinical question: *"What MRI protocol should I order if worried about thrombus in the basilar artery?"*
2. AI responds with an evidence-based answer + citations (e.g., AHA/ASA stroke guidelines)
3. Below the response: **"Add to note ▾"** dropdown listing all current canvas sections + "New section..."
4. Clinician selects destination section (e.g., "Plan")
5. Second AI call to `POST /api/ai/scribe/ghost-write`:
   - Input: original chat answer, destination section's current content, note type, specialty
   - System prompt: *"Rewrite the following clinical information as a single sentence or short paragraph in the first-person plural physician voice, matching the writing style and clinical density of the existing section text. The output should read as if the attending physician dictated it naturally."*
   - Returns: ghost-written text formatted to match the note's existing style
6. Diff preview: shows exactly what will be added (green highlighted insertion)
7. Clinician taps "Confirm" → text inserted into section at cursor position (or appended)

**Ghost-writing examples:**

| Chat answer | Destination | Ghost-written output |
|---|---|---|
| "MRI brain with and without contrast + MRA with arterial phase is indicated for basilar artery thrombus evaluation" | Plan | "We will obtain MRI/MRA brain with and without contrast with arterial phase protocol to evaluate the basilar artery for thrombus." |
| "Surviving Sepsis Campaign recommends norepinephrine as first-line vasopressor for septic shock with MAP target ≥65 mmHg" | Vasopressor Status | "Norepinephrine is continued as first-line vasopressor per Surviving Sepsis Campaign guidelines, targeting a MAP ≥65 mmHg." |
| "ARDS Network low tidal volume strategy: 6 mL/kg IBW, plateau pressure <30 cmH2O" | Ventilator Management | "The patient is maintained on an ARDS Network-compliant low tidal volume strategy at 6 mL/kg IBW with plateau pressures targeted below 30 cmH2O." |

**Audit trail:**
- Every chat query, raw AI answer, and ghost-written insertion is saved as a JSON array in `scribe_note_sections.chat_insertions`
- This provides a complete record of AI-assisted additions for medicolegal purposes

---

### 7. Note History Dashboard

The dashboard is the landing screen after login (for returning users).

**Layout:**
- Search bar (searches by date, note type, patient label)
- Filter chips: All, Draft, Finalized; + by note type
- Note cards (chronological, most recent first):
  - Patient label (free-text, optional — not MRN)
  - Note type badge
  - Date + time
  - First line of Assessment or Plan section
  - "Draft" or "Finalized" status indicator
- "New Note" button (prominent, top right)

**Note card actions:**
- Tap → open note in editor
- Swipe left (mobile) → delete (with confirmation)
- Long press → context menu: Duplicate, Change status, Delete

**Persistence:**
- All notes auto-saved to server on every section edit (debounced, 2-second delay)
- Local state also cached in localStorage for offline resilience
- Notes soft-deleted (deleted_at timestamp set), not hard-deleted — recoverable within 30 days in v2

---

### 8. Custom Templates (Saved Section Arrangements)

Beyond individual custom sections, clinicians can save entire note canvas arrangements as named templates.

**Example templates:**
- "ICU Morning Rounds Note" — HPI, Overnight Events, Sedation & Analgesia, Ventilator Management, Vasopressor Status, Infectious Disease, Renal & Fluid Balance, Assessment, Plan, Goals of Care
- "Physical Therapy Daily Note" — Patient Response, Lower Extremity Strength, Coordination, Balance, Functional Mobility, Plan, Goals

**Saving a template:**
- After building a canvas arrangement, tap "Save as Template" → name it → saved to `scribe_section_templates` with user_id

**Loading a template:**
- On the "New Note" screen, tap "Load Template" → list of user's saved templates → tap to populate canvas

**Sharing templates (v2):**
- Generate a shareable link to a template (read-only) — another clinician can import it to their library

---

## Mobile UX Flow (Complete)

```
scribe.docassist.ai (mobile)
│
├── First visit → Login / Register screen
│   └── Email + password → JWT set → Dashboard
│
├── Dashboard
│   ├── Recent notes list (tap to open, swipe to delete)
│   └── "New Note" button → Note Builder
│
├── Note Builder
│   ├── Note type selector (dropdown: Progress Note, H&P, Consult, etc.)
│   ├── Patient label (optional free-text field)
│   ├── Canvas: drag sections here (empty initially)
│   ├── "+ Add sections" → bottom sheet with section library
│   │   ├── Search bar
│   │   ├── System sections (grouped: General, ICU, Specialty)
│   │   └── My custom sections + "Create new section" button
│   ├── Reorder sections in canvas by drag handle
│   └── "Record" button → Recording screen
│
├── Recording screen
│   ├── Large pulsing record button → tap to start
│   ├── Live timer (MM:SS)
│   ├── Tap "Stop" → "Transcribing..." spinner (Whisper)
│   └── On transcript ready → Note screen (auto-advance)
│
├── Note screen (core)
│   ├── Transcript (collapsible, always accessible)
│   ├── Sections (populated by AI, sequential reveal animation)
│   │   ├── Section header + confidence badge
│   │   ├── Content (tap to edit inline)
│   │   ├── ⚡ Focused AI button → analysis + guideline citations panel
│   │   └── Reorder by drag handle
│   ├── 💬 Chat button (floating, bottom right)
│   │   └── Bottom sheet: clinical Q&A → "Add to note ▾" → ghost-write → diff preview → Confirm
│   ├── "Copy All" button → copies full formatted note to clipboard
│   ├── "Copy Section" on each section → copies that section only
│   └── "Finalize" → marks note as finalized, closes editor
│
└── Section Library (scribe.docassist.ai/scribe/templates)
    ├── Pre-built sections (view-only, add to library)
    ├── My sections (edit name, prompt hint, delete)
    └── "Create section" → name + prompt hint form → save
```

---

## SMART on FHIR Integration Bridge (Future — v2)

The subdomain architecture is designed so that SMART on FHIR integration requires no redesign of the Scribe UI.

**How the bridge works:**
1. Health system configures DocAssist Scribe as a SMART app in their Epic/Oracle Health environment
2. Clinician launches from EHR context (Epic SmartText, PowerChart, etc.)
3. App receives `launch` parameter in URL: `scribe.docassist.ai/scribe/note/new?launch=xxx&iss=https://fhir.hospital.org`
4. App exchanges launch token for FHIR access token via OAuth 2.0 SMART launch flow
5. Patient context (name, MRN, encounter ID) pre-populates the note's patient label field
6. Optionally: Signal Engine fetches relevant chart data (labs, vitals, meds) and injects into Focused AI calls — giving guideline citations actual patient-specific context
7. On note completion: structured note sections available for export back to EHR via FHIR DocumentReference write

**No redesign needed because:**
- The Scribe UI is already a standalone route group with its own auth
- The `launch` URL parameter triggers a SMART auth flow before the JWT auth flow
- Patient context flows into the existing note data model as a pre-filled patient_label + optional contextStore entry
- The Focused AI endpoint already accepts session context from contextStore (built for the ICU platform)

---

## Billing Model

### v1 — Beta (Launch)
- **Free** for all users during beta period
- Purpose: user acquisition, clinical validation, feedback collection
- Target: 20–50 clinician beta users, primarily from DocAssistAI ICU physician network

### v2 — Paid (3–6 months post-launch)
- **$20/month** flat: unlimited recordings, standard AI generation, note history, custom templates, in-note chat, ghost-writing
- **Focused AI add-on**: $5/month for 15 calls/month, OR $0.50/call pay-as-you-go
- **Annual plan**: $180/year ($15/month) — 25% savings
- Stripe Billing for subscription management, payment portal, invoice download
- BAA available for all paid subscribers

### v3 — Team Plans
- **Team plan**: $15/user/month for groups of 5+
- **Health system**: Enterprise pricing with SMART on FHIR integration, SSO, admin dashboard, usage analytics, SLA

### Revenue Projections (Conservative)
| Cohort | Users | ARPU | MRR |
|---|---|---|---|
| Beta (free) | 20–50 | $0 | $0 |
| v2 Month 3 | 50 | $20 | $1,000 |
| v2 Month 6 | 150 | $22 | $3,300 |
| v2 Month 12 | 400 | $25 | $10,000 |

At $10K MRR, the $5,500/year OPN Healthcare Path Add-On (Oracle Marketplace credentialing) is self-funded with significant margin remaining for development.

---

## What's Already Built vs. What Needs Building

### Already Built ✅

| Component | Location | Status |
|---|---|---|
| Audio recording | `src/components/scribe/AudioRecorder.tsx` | Built + tested |
| Whisper transcription endpoint | `backend/src/routes/transcribe.ts` | Built + tested |
| WhisperService | `backend/src/services/transcription/whisperService.ts` | Built + tested |
| Note type selection + generation | `src/components/scribe/ScribePanel.tsx` | Built (needs upgrade) |
| Note editor (editable, copy) | `src/components/scribe/NoteEditor.tsx` | Built (needs upgrade) |
| Note generation endpoint | `backend/src/routes/ai.ts` (POST /generate-document) | Built (needs upgrade) |
| Section-based prompt builder | `backend/src/services/cowriter/noteBuilder.ts` | Built (needs upgrade) |
| Scribe state management | `src/stores/scribeStore.ts` | Built (needs upgrade) |
| Chat endpoint (clinical Q&A) | `backend/src/routes/ai.ts` (POST /chat) | Built — reuse as-is |

### Needs Building 🔨

**Frontend:**
- [ ] `/scribe` route group + Scribe layout component (no ICU chrome)
- [ ] Login / Register screens
- [ ] Dashboard with note history, search, filter
- [ ] Section Library UI (browseable, searchable, custom section creation)
- [ ] Drag-and-drop Note Canvas (`@dnd-kit/core`)
- [ ] Upgraded Note screen (per-section editing, confidence badges, section reorder)
- [ ] Focused AI panel (slide-in, analysis + citations)
- [ ] In-note Chat drawer (bottom sheet mobile, right panel desktop)
- [ ] Ghost-writing diff preview + confirm
- [ ] "Copy All" + "Copy Section" buttons
- [ ] Template save/load UI
- [ ] Scribe auth store (JWT, login state)
- [ ] Mobile wake lock during recording

**Backend:**
- [ ] `POST /api/scribe/auth/register` — bcrypt + JWT
- [ ] `POST /api/scribe/auth/login`
- [ ] `GET /api/scribe/auth/me`
- [ ] `GET/POST /api/scribe/notes` — note CRUD
- [ ] `GET/PUT /api/scribe/notes/:id`
- [ ] `GET/POST/PUT/DELETE /api/scribe/templates` — section library CRUD
- [ ] `POST /api/ai/scribe/generate` — upgraded multi-section generation
- [ ] `POST /api/ai/scribe/focused` — Focused AI with guideline citations
- [ ] `POST /api/ai/scribe/ghost-write` — ghost-writing endpoint
- [ ] Database setup: SQLite (dev), Postgres (prod), migration script
- [ ] JWT middleware for `/api/scribe/*` routes
- [ ] Focused AI call counter (per user, per month) for metered billing later

---

## Success Metrics for Beta

**Adoption:**
- 20+ active beta clinicians by month 2
- 3+ note generations per user per week (indicates real workflow integration, not just curiosity)

**Quality:**
- <20% of note sections require significant editing ("significant" = adding >3 sentences or changing the meaning)
- >80% of users report note quality equal to or better than their current documentation method

**Retention:**
- >70% of beta users still active at month 3
- >50% of beta users convert to paid at $20/month when billing activates

**Focused AI:**
- >30% of users try Focused AI at least once in first week
- >15% of users use Focused AI on multiple notes per week (indicates habit formation)

**In-note Chat:**
- >40% of users open the chat drawer at least once
- >20% of chat interactions result in a "ghost-write to note" insertion

**Qualitative:**
- Direct physician feedback on ICU-specific section quality
- Identification of missing pre-built sections for ICU workflows
- Template sharing requests (indicates community building)

---

*Design approved: 2026-02-23. Transition to implementation planning via writing-plans skill.*
