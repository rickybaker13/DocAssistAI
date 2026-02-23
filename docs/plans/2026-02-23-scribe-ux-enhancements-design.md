# Scribe UX Enhancements Design

**Date:** 2026-02-23
**Status:** Approved

---

## Overview

Five UX improvements to the Scribe standalone note-creation flow:

1. Pre-made note templates per note type
2. User-saved custom templates (stored in backend DB)
3. Editable sections on finalized notes (delete + add)
4. Verbosity control (Brief / Standard / Detailed)
5. Prominent single-note copy (rename "Copy All" → "Copy Note")

---

## Approved Flow

```
Dashboard
  → "New Note"
    → NoteBuilderPage (template-first)
        [1] Pick note type
        [2] Template cards appear (system + user's saved)
        [3] Select template → sections pre-load into canvas
        [4] Customize: remove sections, add from Section Library, reorder
        [5] Set verbosity: Brief / Standard / Detailed  (default: Standard)
        [6] ▶ Record
  → ScribeRecordPage (unchanged)
  → ScribeNotePage (enhanced)
        • × button on each section (removes from local display state)
        • "Add Section" button → Section Library slide-up drawer
        • "Copy Note" (primary CTA, full-width green) — copies full note as one string
        • "Finalize" (secondary, outline)
        • "Save as Template" — prompts for name, saves canvas layout to backend
```

---

## Data Model

### New table: `note_templates`

```sql
CREATE TABLE note_templates (
  id          TEXT PRIMARY KEY,
  user_id     TEXT,              -- NULL = system template
  note_type   TEXT NOT NULL,     -- 'progress_note', 'h_and_p', etc.
  name        TEXT NOT NULL,     -- 'Standard SOAP', 'My ICU Note'
  verbosity   TEXT NOT NULL DEFAULT 'standard',  -- 'brief'|'standard'|'detailed'
  sections    TEXT NOT NULL,     -- JSON: [{name, promptHint}]
  created_at  INTEGER NOT NULL
);
```

### System templates seeded at startup

| Note Type         | Sections |
|-------------------|----------|
| Progress Note     | Subjective, Objective, Assessment, Plan |
| H&P               | Chief Complaint, HPI, PMH, Medications, Allergies, Social History, Family History, Review of Systems, Physical Exam, Assessment & Plan |
| Transfer Note     | Reason for Transfer, Clinical Summary, Active Problems, Current Medications, Pending Studies, Disposition |
| Accept Note       | Reason for Admission, HPI, PMH, Medications, Allergies, Assessment, Plan |
| Consult Note      | Reason for Consult, HPI, Relevant History, Examination Findings, Impression, Recommendations |
| Discharge Summary | Admission Diagnosis, Hospital Course, Discharge Diagnosis, Discharge Medications, Follow-up Instructions, Discharge Condition |
| Procedure Note    | Procedure, Indication, Pre-procedure Assessment, Procedure Description, Post-procedure Assessment, Complications |

### Changes to existing tables

- `scribe_notes`: add `verbosity TEXT NOT NULL DEFAULT 'standard'`

---

## Backend Changes

### New file: `src/routes/scribeNoteTemplates.ts`

```
GET    /api/scribe/note-templates?noteType=<type>
         Returns system templates + authenticated user's own, for the given note type.

POST   /api/scribe/note-templates
         Body: { name, noteType, verbosity, sections }
         Creates a user-owned template. Returns created template.

DELETE /api/scribe/note-templates/:id
         Deletes user's own template only (403 if system or other user's).
```

### Modified: `src/routes/scribeNotes.ts`

- `POST /api/scribe/notes` — accept and store `verbosity` field

### Modified: `src/routes/scribeAi.ts`

- `POST /api/ai/scribe/generate` — accept `verbosity`, inject into system prompt:
  - `brief`: "Write concisely. Use bullet points where appropriate. No more than 1–2 sentences per item. Omit filler phrases."
  - `standard`: current behavior (no additional instruction)
  - `detailed`: "Write in full prose with complete sentences. Include all clinically relevant detail, context, and nuance."

### New model: `src/models/scribeNoteTemplate.ts`

Mirrors pattern of `ScribeSectionTemplateModel`. Methods: `listForUser(userId, noteType)`, `listSystem(noteType)`, `create(...)`, `delete(id, userId)`, `seedSystem()`.

---

## Frontend Changes

### `src/stores/scribeBuilderStore.ts`

Add fields:
```ts
verbosity: 'brief' | 'standard' | 'detailed'   // default: 'standard'
selectedTemplateId: string | null
setVerbosity: (v: 'brief' | 'standard' | 'detailed') => void
setSelectedTemplate: (templateId: string, sections: CanvasSection[]) => void
```

### New hook: `src/hooks/useNoteTemplates.ts`

```ts
useNoteTemplates(noteType: string)
  → { templates, loading, error, saveTemplate(name), deleteTemplate(id) }
```

Fetches `/api/scribe/note-templates?noteType=X`. Separates system vs. user templates for display.

### `src/components/scribe-standalone/NoteBuilderPage.tsx` (rebuilt)

- After note type selection, renders template cards below:
  - System templates first (label: "Standard Templates")
  - User templates below (label: "My Templates", with × delete on each)
  - Selected template highlighted in blue ring
- Canvas populates on template click (calls `setSelectedTemplate`)
- Verbosity pill row: `[Brief]  [Standard]  [Detailed]` — Standard pre-selected
- "Save as Template" button (disabled if canvas empty) — prompts for name via inline input, calls `saveTemplate(name)`

### `src/components/scribe-standalone/ScribeNotePage.tsx` (enhanced)

- `NoteSectionEditor` receives `onDelete` prop — renders × button top-right
- "Add Section" button at bottom of section list — opens Section Library as bottom drawer
- Rename "Copy All" → "Copy Note", make it primary full-width green CTA
- "Finalize" becomes secondary outline button alongside "Copy Note"

### `src/components/scribe-standalone/NoteSectionEditor.tsx`

- Add optional `onDelete?: () => void` prop
- If provided, render × button (top-right of section card)

---

## Verbosity in AI Prompt

The `verbosity` value flows:

```
scribeBuilderStore.verbosity
  → POST /api/scribe/notes (stored on note row)
  → POST /api/ai/scribe/generate (passed as param)
  → scribeAi route → appended to system prompt
```

---

## What Is Not Changing

- `ScribeRecordPage` — no changes
- `AudioRecorder` — no changes
- `SectionLibrary` — reused as-is, shown in both NoteBuilderPage and the new Add Section drawer on ScribeNotePage
- Section-level templates (`/api/scribe/templates`) — unchanged, still used by SectionLibrary
- Auth flow — unchanged

---

## Out of Scope

- Sharing templates between users
- Template versioning
- Per-section verbosity overrides
