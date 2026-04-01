# CodeAssist — Billing Coder Feature Design

> Date: 2026-04-01
> Status: Approved

## Problem

Billing coders currently copy clinical notes from the EHR, manually extract ICD-10 and CPT codes, enter them into a spreadsheet, and email the spreadsheet to UPA (University Physicians Associates) for claim submission. This is slow, error-prone, and entirely manual. DocAssistAI can automate the code extraction while maintaining HIPAA compliance through the existing Presidio PII de-identification pipeline.

## Target Users

- **Coding Manager** — creates a team account, invites coders, manages billing and usage. Has visibility into team-wide coding sessions and exports.
- **Billing Coder** — invited by a manager. Paste-and-code workflow only. No access to scribe/recording features.

Both are new roles (`coding_manager`, `billing_coder`) distinct from the existing `clinician` role.

## Pricing Model

**Hybrid: Base + Per-Note Overage**

| Component | Price |
|---|---|
| Base plan (monthly) | $99/mo |
| Included seats | 1 manager + 2 coders |
| Included notes | 500/month |
| Additional coder seat | $25/mo |
| Overage per note (after 500) | $0.10/note |
| Annual discount | $990/yr (~17% savings) |

**Profitability at key scenarios:**

| Scenario | Monthly notes | AI cost | Revenue | Margin |
|---|---|---|---|---|
| 1 coder, light (20/day) | 440 | $15 | $99 | 85% |
| 2 coders, moderate (30/day) | 1,320 | $46 | $181 | 75% |
| 5 coders, heavy (50/day) | 5,500 | $193 | $674 | 71% |

AI cost estimate: ~$0.035/note (Claude API, short extraction prompt on existing text).

## Workflow

### Per-Encounter Flow

1. Coder opens CodeAssist dashboard
2. Fills in patient header: name, MRN, DOS, provider, note type, facility
3. Pastes full clinical note into text area
4. Clicks "Generate Codes"
5. Backend: PII scrub → Claude extraction → PII re-inject → return codes
6. Coder reviews codes with supporting excerpts (audit trail)
7. Marks session as "reviewed" or flags disagreements
8. Session saved (codes + excerpts + patient header only — raw note discarded)

### Weekly Batch & Export Flow

1. Coder processes encounters one at a time throughout the week
2. "Weekly Batch" view shows all sessions grouped by week
3. Coder can download partial or complete batch at any point
4. Export generates CMS-1500-aligned `.xlsx` spreadsheet
5. Coder emails spreadsheet to UPA for claim submission

## Data Flow & HIPAA Architecture

```
BROWSER (coder's machine)
  │
  ├─ Patient header (name, MRN, DOS, provider)
  │    → HTTPS → Backend → encrypted → DB
  │    → NEVER sent to AI
  │
  └─ Pasted note text
       → HTTPS → Backend → Presidio PII scrub
       → Scrubbed text → Claude API
       → Response re-injected with real PHI
       → Codes + excerpts saved to DB
       → Raw note DISCARDED (never persisted)
```

**PHI inventory:**

| Data | Stored | Encrypted at Rest | Sent to AI |
|---|---|---|---|
| Patient name | Yes (DB) | Yes | No |
| MRN | Yes (DB) | Yes | No |
| Date of service | Yes (DB) | Yes | No |
| Provider name | Yes (DB) | Yes | No |
| Raw pasted note | No (transient) | N/A | Yes (after PII scrub) |
| Generated codes | Yes (JSONB) | Yes | No (output only) |
| Supporting excerpts | Yes (JSONB) | Yes | No (output only) |
| Spreadsheet file | No (streamed) | Yes (in transit) | No |

**Fail-closed behavior:** If Presidio is unreachable, return 503. LLM is never called without PII scrubbing.

## Database Schema

### New Tables

```sql
-- Team account for billing coders
CREATE TABLE coding_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  manager_user_id UUID NOT NULL REFERENCES scribe_users(id),
  plan_tier VARCHAR(50) DEFAULT 'base',
  included_seats INT DEFAULT 2,
  included_notes INT DEFAULT 500,
  overage_rate_cents INT DEFAULT 10,
  billing_cycle_start DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Team membership and invitations
CREATE TABLE coding_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES coding_teams(id),
  user_id UUID NOT NULL REFERENCES scribe_users(id),
  role VARCHAR(50) NOT NULL CHECK (role IN ('manager', 'coder')),
  invited_by UUID REFERENCES scribe_users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'deactivated'))
);

-- Individual coding sessions (no raw note text stored)
CREATE TABLE coding_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coder_user_id UUID NOT NULL REFERENCES scribe_users(id),
  team_id UUID NOT NULL REFERENCES coding_teams(id),
  patient_name VARCHAR(255) NOT NULL,          -- encrypted at rest
  mrn VARCHAR(100),                             -- encrypted at rest
  date_of_service DATE NOT NULL,
  provider_name VARCHAR(255) NOT NULL,          -- encrypted at rest
  facility VARCHAR(255),                        -- encrypted at rest
  note_type VARCHAR(100) NOT NULL,
  icd10_codes JSONB NOT NULL DEFAULT '[]',
  cpt_codes JSONB NOT NULL DEFAULT '[]',
  em_level JSONB,
  missing_documentation JSONB DEFAULT '[]',
  coder_status VARCHAR(50) DEFAULT 'coded' CHECK (coder_status IN ('coded', 'reviewed', 'flagged')),
  batch_week DATE NOT NULL,                     -- Monday of the week, for grouping
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Monthly usage metering per team
CREATE TABLE coding_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES coding_teams(id),
  month DATE NOT NULL,                          -- first of month
  notes_coded INT DEFAULT 0,
  overage_notes INT DEFAULT 0,
  overage_charge_cents INT DEFAULT 0,
  UNIQUE (team_id, month)
);
```

### Changes to Existing Tables

```sql
ALTER TABLE scribe_users
  ADD COLUMN user_role VARCHAR(50) DEFAULT 'clinician'
    CHECK (user_role IN ('clinician', 'coding_manager', 'billing_coder')),
  ADD COLUMN coding_team_id UUID REFERENCES coding_teams(id);
```

## API Endpoints

### AI Route (code extraction)

```
POST /api/ai/scribe/coder/extract-codes
Auth: scribeAuth + role IN ('billing_coder', 'coding_manager')
Rate limit: 10 req/min per user

Request:
{
  noteText: string,
  noteType?: string,
  specialty?: string
}

Response:
{
  icd10_codes: [{ code, description, confidence, supporting_text }],
  cpt_codes: [{ code, description, confidence, reasoning }],
  em_level: { suggested, mdm_complexity, reasoning },
  missing_documentation: string[],
  disclaimer: string
}
```

### Coding Sessions (CRUD)

```
GET    /api/scribe/coder/sessions                — list sessions (paginated, filterable)
GET    /api/scribe/coder/sessions/:id            — single session
PATCH  /api/scribe/coder/sessions/:id            — update coder_status
DELETE /api/scribe/coder/sessions/:id            — delete session
```

### Team Management (manager only)

```
POST   /api/scribe/coder/teams                   — create team
GET    /api/scribe/coder/teams/:id               — team details + members
POST   /api/scribe/coder/teams/:id/invite        — invite coder (email)
PATCH  /api/scribe/coder/teams/:id/members/:mid  — activate/deactivate
GET    /api/scribe/coder/teams/:id/usage         — usage stats
```

### Export

```
GET /api/scribe/coder/export?start=YYYY-MM-DD&end=YYYY-MM-DD&format=xlsx
Auth: scribeAuth + coder/manager role
Rate limit: 5 req/min per user
Response: binary .xlsx file (streamed, not stored on server)
```

## Spreadsheet Export Format (CMS-1500 Aligned)

| Column | Source |
|---|---|
| Patient Name | Coder-entered |
| MRN | Coder-entered |
| Date of Service | Coder-entered |
| Rendering Provider | Coder-entered |
| Facility | Coder-entered |
| Note Type | Coder-entered |
| ICD-10 Dx 1–12 | AI-generated (up to 12 diagnosis pointers) |
| CPT Code 1 | AI-generated |
| CPT Modifier | (empty — future feature) |
| CPT Units | Default: 1 |
| E/M Level | AI-generated |
| E/M MDM Complexity | AI-generated |
| Missing Documentation | AI-generated |
| Confidence (avg) | AI-generated |
| Coder Status | reviewed / flagged |

Generated server-side with `exceljs`. Streamed to client, never persisted on disk.

## Frontend Pages

| Route | Component | Roles |
|---|---|---|
| `/coder` | `CoderDashboard` | coder, manager |
| `/coder/session/:id` | `CoderSessionDetail` | coder, manager |
| `/coder/team` | `CoderTeamManagement` | manager only |

### Key UI Components

- **`NoteInputPanel`** — patient header form + large textarea + note type dropdown + "Generate Codes" button
- **`CoderResultsPanel`** — extends `BillingCodesPanel` pattern with audit trail column (supporting excerpts per code)
- **`WeeklyBatchTable`** — sessions grouped by week, filterable by date/provider/type, with export buttons
- **`CoderSessionCard`** — summary card for sessions list
- **`TeamUsageBar`** — "342 / 500 notes this month" visual meter
- **`InviteCoderModal`** — email invite form

### Routing Logic

After login, check `user.user_role`:
- `clinician` → existing scribe routes
- `billing_coder` → `/coder` dashboard
- `coding_manager` → `/coder` dashboard + `/coder/team`

## AI Prompt Design

- System prompt: ICD-10-CM Official Guidelines + CPT E/M 2021 MDM framework
- Temperature: 0.2 (precision)
- Prompt caching: `cache_control: { type: 'ephemeral' }` on system prompt
- Token preservation: all `[PERSON_0]` etc. tokens passed through unchanged
- Supporting excerpts: direct quotes from the (scrubbed) note, not paraphrased
- Missing documentation: flag gaps that could strengthen specificity or E/M level

**Disclaimer (always shown):**
"AI-suggested codes require professional review. These suggestions do not constitute medical coding advice. The coder is responsible for final code selection and compliance."

## Access Controls

| Action | Clinician | Coder | Manager |
|---|---|---|---|
| Scribe (record/note) | Yes | No | No |
| CodeAssist (paste/code) | No | Yes | Yes |
| View own sessions | No | Yes | Yes |
| View team sessions | No | No | Yes |
| Export spreadsheet | No | Yes (own) | Yes (team) |
| Invite coders | No | No | Yes |
| View usage/billing | No | No | Yes |

## Rate Limiting

- `extract-codes`: 10 req/min per user
- Export: 5 req/min per user

## Audit Logging

Every `extract-codes` call logs (without PHI):
- `coder_user_id`, `team_id`, `timestamp`, `note_type`, `code_count`, `request_duration_ms`
- No note text, no patient identifiers in logs

## Scope Exclusions (YAGNI for V1)

See `docs/FUTURE_DIRECTIONS.md` for full list. Key exclusions:
- No HCC/RAF scoring
- No modifier suggestions
- No auto-submission to payers
- No manual code editing
- No cross-encounter trending
- No real-time as-you-type coding
- No coder chat follow-ups
- No EHR integration
- No bulk upload

## Cost Impact

- AI cost: ~$0.035/note (Claude API extraction prompt)
- New dependency: `exceljs` for server-side spreadsheet generation
- Infrastructure: no new services — uses existing Presidio + Claude pipeline
- DB: 4 new tables, 2 new columns on `scribe_users`

## Provisioning Flow

1. Manager signs up → selects "Coding Team" plan during onboarding
2. Manager goes to Team Settings → "Invite Coder" → enters email
3. System creates `coding_team_members` row (pending) + sends invite email
4. Coder clicks invite → signup with team pre-associated → role set to `billing_coder`
5. On login, coder sees CodeAssist UI (not scribe UI)
