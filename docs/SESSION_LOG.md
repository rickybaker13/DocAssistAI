# DocAssistAI — Session Log

## Quick Start (For New Sessions)

**Current branch:** `feature/docassistai-v0-complete`
**Build status:** Phase 1 through 8 plans written; execution in progress

```bash
# Start dev server
cd /Users/bitbox/Documents/DocAssistAI
npm run dev   # or: cd frontend && npm run dev AND cd backend && npm run dev

# Run backend tests
cd /Users/bitbox/Documents/DocAssistAI/backend
npx jest --no-coverage

# Navigate to Scribe standalone
http://localhost:8080/scribe/
```

---

## Project Structure

| Path | What it is |
|------|-----------|
| `frontend/` | React 18 + TypeScript + Tailwind + Zustand |
| `backend/` | Express + TypeScript, port 3000 |
| `docs/plans/` | All implementation plan files |
| `docs/SANDBOX_ACCESS.md` | Oracle Health Cerner sandbox setup |
| `docs/AGENTS-README.md` | Architecture overview |

### Key config
- **Backend port:** 3000
- **Frontend port:** 8080 (Vite)
- **JWT secret:** `backend/.env` → `JWT_SECRET=...`
- **SQLite DB:** `backend/data/scribe.db` (dev), `:memory:` (tests)

---

## What Is DocAssistAI?

Two products in one codebase:

### 1. ICU Platform (existing, v0 complete)
- SMART on FHIR OAuth via Oracle Health/Cerner
- Loads patient chart data, generates AI clinical notes
- Lives at `/` (root routes)
- Uses `VITE_FHIR_BASE_URL`, `VITE_CLIENT_ID`, etc.

### 2. Scribe Standalone (being built now)
- **Separate product:** `scribe.docassist.ai` / `/scribe/*` routes
- **No FHIR required** — physician records audio, AI drafts notes
- **Own auth:** email/password → JWT in httpOnly cookie (`scribe_token`)
- **Target:** ICU physicians, $20/month SaaS
- Lives at `/scribe/*` routes in the same codebase

---

## Testing Guide

### Testing Scribe Standalone (NO FHIR needed)
```bash
# 1. Start dev server
cd /Users/bitbox/Documents/DocAssistAI && npm run dev

# 2. Navigate to
http://localhost:8080/scribe/

# 3. Register with any email/password
# 4. Build a note, record audio, let AI draft sections
```

### Testing ICU Platform (Oracle Health Cerner sandbox)
```bash
# Open sandbox — no auth, read-only FHIR data
VITE_USE_OPEN_SANDBOX=true
VITE_FHIR_BASE_URL=https://fhir-open.cerner.com/r4/ec2458f2-1e24-41c8-b71b-0e701af7583d
VITE_OPEN_SANDBOX_PATIENT_ID=12742400

# Start dev server then navigate to http://localhost:8080
```

> **Note:** User mentioned "FHIR+Synthea sandbox" — the existing configured sandbox
> is **Oracle Health Cerner** (not Synthea). Scribe standalone doesn't use FHIR at all.

---

## GitHub / Git Workflow

```bash
# Check status
git status
git log --oneline -10

# Push current branch to GitHub
git push origin feature/docassistai-v0-complete

# Create PR when ready to merge to main
gh pr create --title "feat: Scribe standalone v1" --body "..."
```

> Files are saved to local project directory automatically as we build.
> Push to GitHub is a separate manual step — ask Claude to push when you want it synced.

---

## Build Plan: Scribe Standalone (8 Phases)

| Phase | Plan File | What it builds | Status |
|-------|-----------|---------------|--------|
| 1 | `scribe-standalone-phase1-db-auth.md` | SQLite DB + JWT auth API | ✅ Complete |
| 2 | `scribe-standalone-phase2-note-api.md` | Note/section/template CRUD API | ✅ Complete |
| 3 | `scribe-standalone-phase3-ai-endpoints.md` | AI generate/focused/ghost-write endpoints | ✅ Complete |
| 4 | `scribe-standalone-phase4-frontend-auth.md` | Login/register UI + Zustand auth store | ✅ Complete |
| 5 | `scribe-standalone-phase5-section-builder.md` | Drag-and-drop note builder canvas | ✅ Complete |
| 6 | `scribe-standalone-phase6-note-screen.md` | Record → AI draft → edit sections screen | ✅ Complete |
| 7 | `scribe-standalone-phase7-chat-ghostwrite.md` | Chat drawer + ghost-write insertion | ✅ Complete |
| 8 | `scribe-standalone-phase8-dashboard.md` | Note dashboard + search + status filter | ✅ Complete |

### Phase Status Key
- ⬜ Pending — not started
- 🔄 In Progress
- ✅ Complete — all tests passing, committed

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| DB | SQLite (better-sqlite3) | Zero config, sync API, easy dev |
| Auth | JWT in httpOnly cookie | XSS-proof, no localStorage tokens |
| Cookie name | `scribe_token` | Scoped to Scribe standalone only |
| JWT expiry | 7 days (30 days w/ rememberMe) | Balance UX and security |
| Password hashing | bcryptjs, 12 rounds | Standard, secure |
| Drag-and-drop | @dnd-kit/core + @dnd-kit/sortable | Accessible, modern alternative to react-dnd |
| Section builder state | Zustand + localStorage persist | Survives page refresh |
| AI responses | Claude via existing `aiService` | GPT-4o in codebase already |
| Testing | Jest + supertest, `:memory:` SQLite | Fast, isolated, no file cleanup |

---

## Key File Paths

### Backend (to be created)
```
backend/src/database/db.ts              — SQLite singleton, table init
backend/src/database/migrations.ts     — CREATE TABLE SQL
backend/src/database/prebuiltSections.ts — 30 clinical section templates
backend/src/models/scribeUser.ts        — User model
backend/src/models/scribeNote.ts        — Note model (soft-delete)
backend/src/models/scribeNoteSection.ts — Note sections
backend/src/models/scribeSectionTemplate.ts — Section template library
backend/src/middleware/scribeAuth.ts    — JWT cookie middleware
backend/src/routes/scribeAuth.ts        — /api/scribe/auth/*
backend/src/routes/scribeNotes.ts       — /api/scribe/notes
backend/src/routes/scribeTemplates.ts   — /api/scribe/templates
backend/src/routes/scribeAi.ts          — /api/ai/scribe/*
```

### Frontend (to be created)
```
src/stores/scribeAuthStore.ts           — Zustand auth store
src/stores/scribeBuilderStore.ts        — Zustand canvas state (persisted)
src/components/scribe-standalone/
  ScribeLayout.tsx                      — Outlet-based layout
  ScribeLoginPage.tsx                   — Login form
  ScribeRegisterPage.tsx                — Register form
  ScribeAuthGuard.tsx                   — Redirect if not logged in
  NoteBuilderPage.tsx                   — Note type + section canvas
  SectionLibrary.tsx                    — Searchable template library
  NoteCanvas.tsx                        — DndContext sortable canvas
  ScribeRecordPage.tsx                  — Audio record + AI generate
  ScribeNotePage.tsx                    — View/edit note sections
  NoteSectionEditor.tsx                 — Per-section inline editor + AI
  FocusedAIPanel.tsx                    — Deep analysis modal
  ScribeChatDrawer.tsx                  — Floating chat + ghost-write
  ScribeDashboardPage.tsx               — Notes list + search
  NoteCard.tsx                          — Note card component
```

---

## Token Limit Solution

Previous problem: Single large plan file caused `API Error: Claude's response exceeded the 32000 output token maximum`.

**Solution:** Split into 8 separate phase plan files. Each phase is built independently by a fresh subagent, keeping token usage well within limits.

---

## Session History

### 2026-02-27 — Session: AWS Bedrock Setup
- Confirmed **AWS Basic Support (Free)** is sufficient — no paid support plan needed
- Selected **Claude Sonnet 4.6** (`us.anthropic.claude-sonnet-4-6-20250514-v1:0`) as the AI model
  - Haiku ruled out: insufficient reasoning for medical documentation quality
  - Opus ruled out: ~5x cost for marginal gains
- Navigated AWS Bedrock model access: Model Access page retired; models now auto-enable on first invocation
- Submitted **Anthropic use case details** in the Bedrock Model Catalog (required for first-time Anthropic access)
- Model access confirmed — ready for first test invocation
- Full details saved in `docs/AWS_BEDROCK_SETUP.md`



### 2026-02-23 — Session 2
- Recovered context from git log + plan files
- Identified token limit problem with monolithic plan
- Wrote 8 phase plan files (phase1 through phase8)
- Started build phase execution (subagent-driven)

### Pre-2026-02-23 — Session 1
- Built ICU Platform v0 (FHIR, Co-Writer, chart grounding)
- Designed Scribe standalone product (approved design in `docs/plans/2026-02-23-scribe-standalone-design.md`)
- Completed phases: FHIR auth, patient data loading, note generation, Co-Writer mode v0.5
