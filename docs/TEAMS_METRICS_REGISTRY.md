# Teams, Metrics & Clinical Registry

A team-based analytics and clinical intelligence platform built into DocAssistAI. Enables clinical teams to track workload, capture structured clinical data from notes, and run population-level queries — all without leaving the app.

## Overview

| Feature | Description | Access |
|---------|-------------|--------|
| **Teams** | Create/join teams with invite tokens, role-based access | All users |
| **Workload Metrics** | Auto-captured encounter counts, procedures, admissions per provider | Team members |
| **Clinical Registry** | AI-extracted diagnoses, acuity scores, complications per encounter | Team members |
| **Population Queries** | Search/filter/aggregate across all encounters | Team members |
| **Reports & Export** | CSV export, printable reports, provider breakdowns | Leads & admins |

## Architecture

```
Frontend (React/Vite)                    Backend (Express/PostgreSQL)
─────────────────────                    ────────────────────────────
TeamsPage                          ───→  /api/teams (CRUD, invites)
MetricsDashboardPage               ───→  /api/metrics (summary, daily, export)
PopulationDashboardPage            ───→  /api/encounters (query, stats)
ClinicalDataPanel (on note page)   ───→  /api/encounters/extract (AI extraction)
NoteBuilderPage (team selector)    ───→  /api/scribe/notes (auto-capture on save)
```

## Database Tables

### `teams`
```sql
id, name, specialty, settings (JSONB), created_by, created_at, updated_at
```

### `team_members`
```sql
id, team_id, user_id, role ('admin'|'lead'|'member'), joined_at
UNIQUE(team_id, user_id)
```

### `team_invites`
```sql
id, team_id, token (UNIQUE), role, max_uses, uses, created_by, expires_at
```

### `metric_events`
```sql
id, team_id, user_id, event_type, note_id, metadata (JSONB), event_date, created_at
```

### `encounter_data`
```sql
id, team_id, user_id, note_id
primary_diagnosis TEXT
diagnosis_codes JSONB        -- ["I60.9", "G93.6"]
acuity_scores JSONB          -- {"APACHE_II": 24, "GCS": 7, "Hunt_Hess": 4}
complications JSONB          -- ["DCI", "VAP", "CAUTI"]
interventions JSONB          -- ["EVD placement", "intubation", "CRRT"]
disposition TEXT              -- "discharged", "transferred_stepdown", "expired", etc.
admission_date, discharge_date DATE
metadata JSONB               -- extensible for custom fields
source TEXT                  -- "auto_extracted" | "manual" | "edited"
```

## Role-Based Access

| Capability | Member | Lead | Admin |
|-----------|--------|------|-------|
| View own metrics | ✓ | ✓ | ✓ |
| View team aggregates | ✓ | ✓ | ✓ |
| View individual provider stats | — | ✓ | ✓ |
| Export CSV / generate reports | — | ✓ | ✓ |
| Create invite tokens | — | ✓ | ✓ |
| Manage members (roles, remove) | — | — | ✓ |
| Update/delete team | — | — | ✓ |

## Invite Token Flow

1. Admin/lead generates an invite token with optional: role, max uses, expiration
2. Token is a short URL-safe string (e.g., `a3f8x9Bk`)
3. New user enters token on the Teams page → joins team with assigned role
4. Token usage is tracked; expired/maxed tokens are rejected
5. Admins can revoke tokens at any time

## Auto-Capture: Note Type → Metric Events

When a note is saved for the first time, `metricAutoCapture.ts` maps the note type to metric events:

| Note Type | Events Logged |
|-----------|--------------|
| `progress_note` | `patient_encounter`, `note_completed` |
| `h_and_p` | `patient_encounter`, `admission`, `note_completed` |
| `accept_note` | `patient_encounter`, `admission`, `note_completed` |
| `consult_note` | `patient_encounter`, `consult`, `note_completed` |
| `discharge_summary` | `patient_encounter`, `discharge`, `note_completed` |
| `transfer_note` | `patient_encounter`, `transfer`, `note_completed` |
| `procedure_note` | `patient_encounter`, `procedure`, `note_completed` |
| `event_note` | `patient_encounter`, `note_completed` |

- **INSERT only** — updates don't re-log (prevents double-counting)
- **Fire-and-forget** — metric capture never blocks note save
- If `team_id` is provided, logs to that team; otherwise logs to all user's teams

## Clinical Data Extraction (AI)

`clinicalExtractor.ts` uses Claude to extract structured clinical data from note content:

```
Note content → PII scrub → Claude (temp 0.1) → parse JSON → PII re-inject → store
```

**Extracted fields:**
- Primary diagnosis (e.g., "subarachnoid hemorrhage")
- ICD-10 codes (e.g., `["I60.9"]`)
- Acuity scores (e.g., `{"APACHE_II": 24, "GCS": 7}`)
- Complications (e.g., `["DCI", "VAP"]`)
- Interventions (e.g., `["EVD placement", "intubation"]`)
- Disposition (e.g., `"transferred_stepdown"`)

**Safety:**
- PII is scrubbed before sending to LLM (Presidio, same as note generation)
- Fails closed if Presidio is unavailable — no unscrubbed PHI sent to LLM
- Non-blocking — extraction failure doesn't affect note save

## Population Queries

The `EncounterDataModel` supports PostgreSQL JSONB queries:

```
GET /api/encounters/:teamId/query?diagnosis=SAH&from=2025-01-01
GET /api/encounters/:teamId/stats?from=2025-01-01&to=2025-12-31
```

**Available filters:** `diagnosis` (ILIKE), `complication` (JSONB @>), `intervention` (JSONB @>), `disposition` (exact), `userId`, date range

**Stats endpoint returns:**
- Diagnosis counts (top diagnoses ranked by frequency)
- Complication counts (aggregated from JSONB arrays)
- Acuity score averages (computed from JSONB key-value pairs)
- Disposition distribution

## API Endpoints

### Teams
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/teams` | List user's teams |
| `POST` | `/api/teams` | Create team (caller = admin) |
| `POST` | `/api/teams/join` | Redeem invite token |
| `GET` | `/api/teams/:id` | Get team details |
| `PATCH` | `/api/teams/:id` | Update team (admin) |
| `DELETE` | `/api/teams/:id` | Delete team (admin) |
| `GET` | `/api/teams/:id/members` | List members |
| `PATCH` | `/api/teams/:id/members/:userId` | Update member role |
| `DELETE` | `/api/teams/:id/members/:userId` | Remove member |
| `POST` | `/api/teams/:id/invites` | Create invite |
| `GET` | `/api/teams/:id/invites` | List invites |
| `DELETE` | `/api/teams/:id/invites/:inviteId` | Revoke invite |

### Metrics
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/metrics/log` | Log a metric event |
| `POST` | `/api/metrics/log/batch` | Log batch events (max 100) |
| `GET` | `/api/metrics/:teamId/summary` | Aggregate by event type |
| `GET` | `/api/metrics/:teamId/daily` | Daily breakdown |
| `GET` | `/api/metrics/:teamId/providers` | Per-provider breakdown |
| `GET` | `/api/metrics/:teamId/events` | Paginated event list |
| `GET` | `/api/metrics/:teamId/export` | CSV download |
| `GET` | `/api/metrics/:teamId/report` | JSON summary report |
| `GET` | `/api/metrics/event-types` | List well-known event types |

### Encounters (Clinical Registry)
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/encounters/extract` | AI-extract clinical data from note |
| `POST` | `/api/encounters` | Manually create encounter data |
| `PUT` | `/api/encounters/:id` | Update encounter (provider corrections) |
| `GET` | `/api/encounters/note/:noteId` | Get encounter for a specific note |
| `GET` | `/api/encounters/:teamId/query` | Population-level search |
| `GET` | `/api/encounters/:teamId/stats` | Aggregate statistics |
| `DELETE` | `/api/encounters/:id` | Delete encounter |

## Frontend Pages

| Route | Component | Description |
|-------|-----------|-------------|
| `/scribe/teams` | `TeamsPage` | Create/join teams, team list with role badges |
| `/scribe/teams/:id/manage` | `TeamManagePage` | Members, roles, invite tokens |
| `/scribe/teams/:id/metrics` | `MetricsDashboardPage` | Charts, stat cards, quick-log, CSV export, print |
| `/scribe/teams/:id/registry` | `PopulationDashboardPage` | Diagnosis charts, complications, search, acuity averages |

**Embedded components:**
- `ClinicalDataPanel` — collapsible panel on `ScribeNotePage` for AI extraction and manual clinical data entry
- Team selector dropdown on `NoteBuilderPage` for metrics tracking

## File Map

### Backend
```
backend/src/
├── database/migrations.ts          # Table DDL (teams, team_members, team_invites, metric_events, encounter_data)
├── models/
│   ├── team.ts                     # Team CRUD, membership, invites
│   ├── team.test.ts                # Team model tests (19 tests)
│   ├── metricEvent.ts              # Metric logging, aggregation queries
│   ├── metricEvent.test.ts         # Metric model tests
│   └── encounterData.ts            # Encounter CRUD, population queries (JSONB)
├── routes/
│   ├── teams.ts                    # Team & invite management endpoints
│   ├── metrics.ts                  # Metric logging, queries, CSV export, reports
│   └── encounterData.ts           # Clinical data CRUD, AI extraction, population queries
└── services/
    ├── metricAutoCapture.ts        # Note-type → event-type mapping, auto-log on save
    └── clinicalExtractor.ts        # PII-safe AI extraction of clinical data from notes
```

### Frontend
```
src/
├── hooks/
│   ├── useTeamMetrics.ts           # API hooks: useTeams, useTeamMembers, useTeamInvites, useMetrics
│   └── useEncounterData.ts         # API hooks: useEncounterForNote, usePopulationStats, usePopulationQuery
├── components/scribe-standalone/
│   ├── TeamsPage.tsx               # Team hub: create, join, list
│   ├── TeamManagePage.tsx          # Members, roles, invite tokens
│   ├── MetricsDashboardPage.tsx    # Charts, quick-log modal, export, print
│   ├── PopulationDashboardPage.tsx # Diagnosis/complication charts, search, stats
│   └── ClinicalDataPanel.tsx       # Embedded panel on note page for clinical data
├── stores/
│   ├── scribeBuilderStore.ts       # Added teamId field
│   └── scribeNoteStore.ts          # Added teamId to encounters
└── App.tsx                         # Routes for /scribe/teams/*
```

## Testing

```bash
# Backend model tests (19 passing)
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="team|metricEvent" --no-coverage

# Frontend tests
npx vitest run src/stores/scribeBuilderStore
npx vitest run src/components/scribe-standalone/ScribeLayout.test
```
