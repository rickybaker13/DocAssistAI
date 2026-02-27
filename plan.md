# Plan: Remove Clinical Data Persistence (No-BAA Architecture)

## Goal
Ensure Railway PostgreSQL stores **only account & template data** — zero PHI/clinical content. This eliminates the need for a BAA with Railway because no protected health information is persisted.

## Current State (Problem)

Three DB writes currently persist PHI:

1. **`ScribeRecordPage.tsx:23-28`** — `PUT /api/scribe/notes/:id` saves `transcript` (raw clinical audio text) to `scribe_notes.transcript`
2. **`ScribeRecordPage.tsx:48-53`** — `POST /api/scribe/notes/:id/sections` bulk-inserts AI-generated section `content` + `confidence` into `scribe_note_sections`
3. **`ScribeNotePage.tsx:170-174`** — `PUT /api/scribe/notes/:id` saves `status: 'finalized'` (benign, but the note row also holds `transcript` and `patient_label`)

Additionally, `scribe_notes.patient_label` can contain identifiable info.

## Design Decision

The app already works in a mostly-client-side fashion:
- User edits are only in React state (`edits: Record<string, string>`)
- AI routes (`/generate`, `/focused`, `/ghost-write`, `/resolve-suggestion`) are **stateless** — they don't write to DB
- "Finalize" only updates `status`, then user clicks **"Copy Note"** to paste into EHR

**Strategy:** Keep note lifecycle fully in-memory on the client. The `scribe_notes` and `scribe_note_sections` tables become unnecessary. We remove them and pass transcript + sections through the frontend state instead.

---

## Changes (by file)

### Backend

#### 1. `backend/src/database/migrations.ts`
- Remove `CREATE TABLE IF NOT EXISTS scribe_notes` DDL
- Remove `CREATE TABLE IF NOT EXISTS scribe_note_sections` DDL
- Remove the `scribe_notes.verbosity` entry from `COLUMN_MIGRATIONS`
- Keep `scribe_users`, `scribe_section_templates`, `note_templates` unchanged

#### 2. `backend/src/routes/scribeNotes.ts`
- **Delete the entire file.** All endpoints (`GET/POST/PUT/DELETE /api/scribe/notes`, `POST /api/scribe/notes/:id/sections`) become unnecessary since we're not persisting clinical data.

#### 3. `backend/src/models/scribeNote.ts`
- **Delete the entire file.**

#### 4. `backend/src/models/scribeNoteSection.ts`
- **Delete the entire file.**

#### 5. `backend/src/server.ts` (or wherever routes are mounted)
- Remove the `import` and `app.use()` for `scribeNotes` route.

#### 6. `backend/src/routes/scribeNotes.test.ts`
- **Delete the entire file.** (Tests for removed route.)

### Frontend

#### 7. `src/components/scribe-standalone/ScribeRecordPage.tsx`
- **Remove** the `PUT /api/scribe/notes/:id` call that saves transcript (lines 23-29).
- **Remove** the `POST /api/scribe/notes/:id/sections` call that bulk-saves sections (lines 48-57).
- After AI generation completes, store transcript + generated sections in a **new Zustand store** (or extend the existing `scribeBuilderStore`) and navigate to the note page.
- The note page reads from this store instead of fetching from the backend.

#### 8. `src/components/scribe-standalone/ScribeNotePage.tsx`
- **Remove** the `GET /api/scribe/notes/:id` fetch on mount (lines 94-113). Instead, read note data + sections from the Zustand store.
- **Remove** the `handleFinalize` function that PUTs `status: 'finalized'` (lines 166-183). Replace with a client-side status update in the store.
- The `FocusedAIPanel` currently reads `note.transcript` — this will come from the store instead.
- No other changes needed: `handleCopyNote`, `handleSectionChange`, `handleApplySuggestion`, `handleChatInsert` all already work client-side.

#### 9. New/extended store: `src/stores/scribeNoteStore.ts`
Create a new Zustand store (with `persist` middleware for localStorage, so a page refresh doesn't lose work):

```typescript
interface ScribeNoteState {
  noteId: string | null;
  noteType: string;
  patientLabel: string;
  verbosity: string;
  transcript: string;
  sections: Array<{
    id: string;
    section_name: string;
    content: string | null;
    confidence: number | null;
    display_order: number;
  }>;
  status: 'draft' | 'finalized';
  // actions
  setNote: (data: Partial<ScribeNoteState>) => void;
  setSections: (sections: ScribeNoteState['sections']) => void;
  updateSection: (id: string, content: string) => void;
  finalize: () => void;
  reset: () => void;
}
```

Persisted to `localStorage` so the note survives page refresh but **never** reaches the server.

#### 10. `src/components/scribe-standalone/NoteBuilderPage.tsx` (or wherever `POST /api/scribe/notes` is called)
- **Remove** the `POST /api/scribe/notes` call that creates a note row in the DB.
- Instead, generate a client-side UUID and initialize the Zustand store.
- Navigate to `/scribe/record/:id` with the client-generated ID.

#### 11. Dashboard / note list
- If there's a dashboard that lists notes via `GET /api/scribe/notes`, it will need to either:
  - **(a)** Show only the current in-progress note from the Zustand store (simplest), or
  - **(b)** Be removed / replaced with a "Start New Note" button.
- Since notes are ephemeral (used once, then pasted into EHR), a full note history may not be needed.

### Database cleanup (production)

#### 12. Data migration for existing production DB
- `DROP TABLE IF EXISTS scribe_note_sections;`
- `DROP TABLE IF EXISTS scribe_notes;`
- This permanently removes any previously-stored clinical data from Railway PostgreSQL.
- **This should be done manually after verifying the new code works**, not as an automatic migration (too destructive for an automated step).

---

## What stays unchanged

| Component | Reason |
|-----------|--------|
| `scribe_users` table | Account data only (email, password hash, specialty) — no PHI |
| `scribe_section_templates` table | Template metadata — no PHI |
| `note_templates` table | Template structure — no PHI |
| All AI routes (`scribeAi.ts`) | Already stateless — no DB writes |
| PII scrubber (`piiScrubber.ts`) | Still needed to protect PHI in-transit to LLM |
| Auth routes (`scribeAuth.ts`) | Account management only |
| Template routes | No clinical data |

## Testing

1. **Frontend tests** (`ScribeRecordPage.test.tsx`, `ScribeNotePage.test.tsx`) — update to mock the Zustand store instead of API fetches for note data.
2. **Backend tests** — delete `scribeNotes.test.ts`. Verify remaining tests still pass.
3. **E2E flow** — Record → Generate → Edit → Copy Note → all works without any note DB calls.
4. Run: `cd backend && node --experimental-vm-modules node_modules/.bin/jest --no-coverage`
5. Run: `npx vitest run src/components/scribe-standalone/`

## Risk & Rollback

- **Risk:** If a user refreshes during note editing, localStorage persistence keeps data. If they clear browser data, the in-progress note is lost. This is acceptable for the intended workflow (record → generate → copy to EHR in one session).
- **Rollback:** The DB tables can be re-created via the old migration SQL if we ever need server-side persistence again (e.g., if a BAA is obtained).
