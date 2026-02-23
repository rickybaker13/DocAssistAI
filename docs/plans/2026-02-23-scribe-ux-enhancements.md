# Scribe UX Enhancements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add note templates (system + user-saved), verbosity control (Brief/Standard/Detailed), editable sections on finalized notes, and a prominent single-copy "Copy Note" button.

**Architecture:** New `note_templates` DB table + model + REST route handles template storage. Verbosity flows from `scribeBuilderStore` → `POST /api/scribe/notes` → `POST /api/ai/scribe/generate` where it is injected into the system prompt. Frontend `NoteBuilderPage` is rebuilt to be template-first. `ScribeNotePage` gains per-section delete and an "Add Section" drawer.

**Tech Stack:** TypeScript, React, Zustand (persist), better-sqlite3, Express, supertest (backend tests), React Testing Library (frontend tests)

---

## Task 1: Add DB migrations for verbosity + note_templates table

**Files:**
- Modify: `backend/src/database/migrations.ts`

**Step 1: Add `verbosity` column to `scribe_notes` and new `note_templates` table**

Replace the `CREATE_TABLES` export with:

```typescript
export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS scribe_users (
  id            TEXT PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  specialty     TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scribe_notes (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES scribe_users(id),
  note_type     TEXT NOT NULL,
  patient_label TEXT,
  transcript    TEXT,
  status        TEXT DEFAULT 'draft',
  verbosity     TEXT NOT NULL DEFAULT 'standard',
  deleted_at    TEXT,
  created_at    TEXT DEFAULT (datetime('now')),
  updated_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scribe_note_sections (
  id                TEXT PRIMARY KEY,
  note_id           TEXT NOT NULL REFERENCES scribe_notes(id),
  section_name      TEXT NOT NULL,
  content           TEXT,
  prompt_hint       TEXT,
  display_order     INTEGER NOT NULL DEFAULT 0,
  confidence        REAL,
  focused_ai_result TEXT,
  chat_insertions   TEXT DEFAULT '[]',
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scribe_section_templates (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES scribe_users(id),
  name        TEXT NOT NULL,
  prompt_hint TEXT,
  is_prebuilt INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now')),
  updated_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS note_templates (
  id         TEXT PRIMARY KEY,
  user_id    TEXT REFERENCES scribe_users(id),
  note_type  TEXT NOT NULL,
  name       TEXT NOT NULL,
  verbosity  TEXT NOT NULL DEFAULT 'standard',
  sections   TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
)
`;
```

**Step 2: Run backend tests to confirm no migration breakage**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeNote.test" 2>&1 | tail -20
```
Expected: all existing scribeNote tests pass.

**Step 3: Commit**

```bash
git add backend/src/database/migrations.ts
git commit -m "feat: add verbosity to scribe_notes and note_templates table"
```

---

## Task 2: Create system note templates seed data

**Files:**
- Create: `backend/src/database/systemNoteTemplates.ts`

**Step 1: Write the file**

```typescript
export interface SystemNoteTemplate {
  noteType: string;
  name: string;
  verbosity: 'standard';
  sections: Array<{ name: string; promptHint: string | null }>;
}

export const SYSTEM_NOTE_TEMPLATES: SystemNoteTemplate[] = [
  {
    noteType: 'progress_note',
    name: 'Standard SOAP Note',
    verbosity: 'standard',
    sections: [
      { name: 'Subjective', promptHint: 'Patient-reported symptoms, complaints, interval history since last visit' },
      { name: 'Objective', promptHint: 'Vital signs, physical exam findings, labs, imaging' },
      { name: 'Assessment', promptHint: 'Clinical impression, problem list, differential diagnosis' },
      { name: 'Plan', promptHint: 'Treatment plan, medications, follow-up, consults ordered' },
    ],
  },
  {
    noteType: 'h_and_p',
    name: 'Standard H&P',
    verbosity: 'standard',
    sections: [
      { name: 'Chief Complaint', promptHint: null },
      { name: 'HPI', promptHint: 'History of Present Illness — onset, duration, character, severity, context' },
      { name: 'Past Medical History', promptHint: null },
      { name: 'Medications', promptHint: null },
      { name: 'Allergies', promptHint: null },
      { name: 'Social History', promptHint: null },
      { name: 'Family History', promptHint: null },
      { name: 'Review of Systems', promptHint: null },
      { name: 'Physical Exam', promptHint: null },
      { name: 'Assessment', promptHint: null },
      { name: 'Plan', promptHint: null },
    ],
  },
  {
    noteType: 'transfer_note',
    name: 'Standard Transfer Note',
    verbosity: 'standard',
    sections: [
      { name: 'Reason for Transfer', promptHint: null },
      { name: 'Clinical Summary', promptHint: 'Brief summary of admission diagnosis, hospital course, key events' },
      { name: 'Active Problems', promptHint: null },
      { name: 'Medications', promptHint: null },
      { name: 'Pending Studies', promptHint: 'Labs, imaging, cultures, consults not yet resulted' },
      { name: 'Disposition', promptHint: null },
    ],
  },
  {
    noteType: 'accept_note',
    name: 'Standard Accept Note',
    verbosity: 'standard',
    sections: [
      { name: 'Reason for Admission', promptHint: null },
      { name: 'HPI', promptHint: 'History of Present Illness' },
      { name: 'Past Medical History', promptHint: null },
      { name: 'Medications', promptHint: null },
      { name: 'Allergies', promptHint: null },
      { name: 'Assessment', promptHint: null },
      { name: 'Plan', promptHint: null },
    ],
  },
  {
    noteType: 'consult_note',
    name: 'Standard Consult Note',
    verbosity: 'standard',
    sections: [
      { name: 'Reason for Consult', promptHint: null },
      { name: 'HPI', promptHint: null },
      { name: 'Past Medical History', promptHint: null },
      { name: 'Physical Exam', promptHint: null },
      { name: 'Assessment', promptHint: 'Consult impression and differential' },
      { name: 'Consult Recommendations', promptHint: null },
    ],
  },
  {
    noteType: 'discharge_summary',
    name: 'Standard Discharge Summary',
    verbosity: 'standard',
    sections: [
      { name: 'Admission Diagnosis', promptHint: null },
      { name: 'Hospital Course', promptHint: 'Chronological summary of key events, interventions, and response to treatment' },
      { name: 'Discharge Diagnosis', promptHint: null },
      { name: 'Medications', promptHint: 'Discharge medication list with any changes from admission' },
      { name: 'Discharge Instructions', promptHint: null },
      { name: 'Follow-up Plan', promptHint: null },
    ],
  },
  {
    noteType: 'procedure_note',
    name: 'Standard Procedure Note',
    verbosity: 'standard',
    sections: [
      { name: 'Procedure Details', promptHint: 'Procedure name, date, operator, assistant' },
      { name: 'Indication', promptHint: null },
      { name: 'Pre-procedure Assessment', promptHint: 'Consent, time-out, patient status before procedure' },
      { name: 'Procedure Description', promptHint: 'Step-by-step description of the procedure performed' },
      { name: 'Post-procedure Assessment', promptHint: 'Immediate patient status and findings after procedure' },
      { name: 'Complications', promptHint: 'Any complications encountered; if none write "No immediate complications"' },
    ],
  },
];
```

**Step 2: No test needed** — pure data file, covered by model tests in Task 3.

**Step 3: Commit**

```bash
git add backend/src/database/systemNoteTemplates.ts
git commit -m "feat: add system note template seed data for all 7 note types"
```

---

## Task 3: Create ScribeNoteTemplateModel with tests

**Files:**
- Create: `backend/src/models/scribeNoteTemplate.ts`
- Create: `backend/src/models/scribeNoteTemplate.test.ts`

**Step 1: Write the failing tests first**

```typescript
// backend/src/models/scribeNoteTemplate.test.ts
import { ScribeNoteTemplateModel } from './scribeNoteTemplate';
import { ScribeUserModel } from './scribeUser';
import { closeDb } from '../database/db';

describe('ScribeNoteTemplateModel', () => {
  const model = new ScribeNoteTemplateModel();
  const userModel = new ScribeUserModel();
  let userId: string;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    const user = userModel.create({ email: 'notetmpl@test.com', passwordHash: 'hash' });
    userId = user.id;
    model.seedSystem();
  });
  afterAll(() => closeDb());

  it('seeds system templates (user_id is null)', () => {
    const system = model.listSystem('progress_note');
    expect(system.length).toBeGreaterThan(0);
    expect(system.every(t => t.user_id === null)).toBe(true);
  });

  it('does not double-seed on second call', () => {
    model.seedSystem();
    const system = model.listSystem('progress_note');
    expect(system.length).toBe(1);
  });

  it('lists system + user templates for a note type', () => {
    const all = model.listForUser(userId, 'progress_note');
    expect(all.some(t => t.user_id === null)).toBe(true);
  });

  it('creates a user template', () => {
    const tmpl = model.create({
      userId,
      noteType: 'progress_note',
      name: 'My ICU Progress Note',
      verbosity: 'brief',
      sections: [{ name: 'Assessment', promptHint: null }, { name: 'Plan', promptHint: null }],
    });
    expect(tmpl.id).toBeTruthy();
    expect(tmpl.name).toBe('My ICU Progress Note');
    expect(tmpl.verbosity).toBe('brief');
    expect(JSON.parse(tmpl.sections).length).toBe(2);
  });

  it('user template appears in listForUser', () => {
    const all = model.listForUser(userId, 'progress_note');
    expect(all.some(t => t.name === 'My ICU Progress Note')).toBe(true);
  });

  it('deletes user template', () => {
    const tmpl = model.create({
      userId,
      noteType: 'progress_note',
      name: 'To Delete',
      verbosity: 'standard',
      sections: [],
    });
    const result = model.delete(tmpl.id, userId);
    expect(result.changes).toBe(1);
    const after = model.listForUser(userId, 'progress_note');
    expect(after.some(t => t.id === tmpl.id)).toBe(false);
  });

  it('cannot delete system template', () => {
    const system = model.listSystem('progress_note');
    const result = model.delete(system[0].id, userId);
    expect(result.changes).toBe(0);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeNoteTemplate.test" 2>&1 | tail -10
```
Expected: FAIL — `ScribeNoteTemplateModel` does not exist yet.

**Step 3: Write the model**

```typescript
// backend/src/models/scribeNoteTemplate.ts
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { getDb } from '../database/db';
import { SYSTEM_NOTE_TEMPLATES } from '../database/systemNoteTemplates.js';

export interface NoteTemplate {
  id: string;
  user_id: string | null;
  note_type: string;
  name: string;
  verbosity: string;
  sections: string; // JSON string
  created_at: string;
}

export class ScribeNoteTemplateModel {
  seedSystem(): void {
    const existing = getDb()
      .prepare('SELECT COUNT(*) as count FROM note_templates WHERE user_id IS NULL')
      .get() as { count: number };
    if (existing.count > 0) return;
    const insert = getDb().prepare(
      'INSERT INTO note_templates (id, user_id, note_type, name, verbosity, sections) VALUES (?, NULL, ?, ?, ?, ?)'
    );
    for (const t of SYSTEM_NOTE_TEMPLATES) {
      insert.run(randomUUID(), t.noteType, t.name, t.verbosity, JSON.stringify(t.sections));
    }
  }

  listSystem(noteType: string): NoteTemplate[] {
    return getDb()
      .prepare('SELECT * FROM note_templates WHERE user_id IS NULL AND note_type = ? ORDER BY name ASC')
      .all(noteType) as NoteTemplate[];
  }

  listForUser(userId: string, noteType: string): NoteTemplate[] {
    return getDb()
      .prepare(
        'SELECT * FROM note_templates WHERE (user_id IS NULL OR user_id = ?) AND note_type = ? ORDER BY user_id ASC, name ASC'
      )
      .all(userId, noteType) as NoteTemplate[];
  }

  create(input: {
    userId: string;
    noteType: string;
    name: string;
    verbosity: string;
    sections: Array<{ name: string; promptHint: string | null }>;
  }): NoteTemplate {
    const id = randomUUID();
    getDb()
      .prepare('INSERT INTO note_templates (id, user_id, note_type, name, verbosity, sections) VALUES (?, ?, ?, ?, ?, ?)')
      .run(id, input.userId, input.noteType, input.name, input.verbosity, JSON.stringify(input.sections));
    return getDb().prepare('SELECT * FROM note_templates WHERE id = ?').get(id) as NoteTemplate;
  }

  delete(id: string, userId: string): Database.RunResult {
    return getDb()
      .prepare('DELETE FROM note_templates WHERE id = ? AND user_id = ?')
      .run(id, userId);
  }
}
```

**Step 4: Run tests to confirm they pass**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeNoteTemplate.test" 2>&1 | tail -10
```
Expected: all 7 tests pass.

**Step 5: Commit**

```bash
git add backend/src/models/scribeNoteTemplate.ts backend/src/models/scribeNoteTemplate.test.ts
git commit -m "feat: add ScribeNoteTemplateModel with system seed and CRUD"
```

---

## Task 4: Create scribeNoteTemplates route with tests

**Files:**
- Create: `backend/src/routes/scribeNoteTemplates.ts`
- Create: `backend/src/routes/scribeNoteTemplates.test.ts`

**Step 1: Write the failing tests**

```typescript
// backend/src/routes/scribeNoteTemplates.test.ts
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import scribeNoteTemplatesRouter from './scribeNoteTemplates';
import { ScribeUserModel } from '../models/scribeUser';
import { ScribeNoteTemplateModel } from '../models/scribeNoteTemplate';
import { closeDb } from '../database/db';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/scribe/note-templates', scribeNoteTemplatesRouter);

const SECRET = 'test-secret';
let authCookie: string;

describe('Scribe Note Templates Routes', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = SECRET;
    const userModel = new ScribeUserModel();
    const user = userModel.create({ email: 'notetmpl-route@test.com', passwordHash: 'hash' });
    new ScribeNoteTemplateModel().seedSystem();
    const token = jwt.sign({ userId: user.id }, SECRET, { expiresIn: '1h' });
    authCookie = `scribe_token=${token}`;
  });
  afterAll(() => closeDb());

  it('GET /?noteType=progress_note — returns system + user templates', async () => {
    const res = await request(app)
      .get('/api/scribe/note-templates?noteType=progress_note')
      .set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.templates)).toBe(true);
    expect(res.body.templates.length).toBeGreaterThan(0);
  });

  it('GET without noteType — returns 400', async () => {
    const res = await request(app)
      .get('/api/scribe/note-templates')
      .set('Cookie', authCookie);
    expect(res.status).toBe(400);
  });

  it('POST / — creates user template', async () => {
    const res = await request(app)
      .post('/api/scribe/note-templates')
      .set('Cookie', authCookie)
      .send({
        noteType: 'progress_note',
        name: 'My ICU Note',
        verbosity: 'brief',
        sections: [{ name: 'Assessment', promptHint: null }],
      });
    expect(res.status).toBe(201);
    expect(res.body.template.name).toBe('My ICU Note');
    expect(res.body.template.verbosity).toBe('brief');
  });

  it('DELETE /:id — deletes user template', async () => {
    const createRes = await request(app)
      .post('/api/scribe/note-templates')
      .set('Cookie', authCookie)
      .send({ noteType: 'progress_note', name: 'To Delete', verbosity: 'standard', sections: [] });
    const id = createRes.body.template.id;
    const res = await request(app)
      .delete(`/api/scribe/note-templates/${id}`)
      .set('Cookie', authCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE system template — returns 404', async () => {
    const listRes = await request(app)
      .get('/api/scribe/note-templates?noteType=progress_note')
      .set('Cookie', authCookie);
    const systemTemplate = listRes.body.templates.find((t: any) => t.user_id === null);
    const res = await request(app)
      .delete(`/api/scribe/note-templates/${systemTemplate.id}`)
      .set('Cookie', authCookie);
    expect(res.status).toBe(404);
  });

  it('GET without auth — returns 401', async () => {
    const res = await request(app).get('/api/scribe/note-templates?noteType=progress_note');
    expect(res.status).toBe(401);
  });
});
```

**Step 2: Run to confirm failure**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeNoteTemplates.test" 2>&1 | tail -10
```
Expected: FAIL — route file does not exist.

**Step 3: Write the route**

```typescript
// backend/src/routes/scribeNoteTemplates.ts
import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth';
import { ScribeNoteTemplateModel } from '../models/scribeNoteTemplate';

const router = Router();
router.use(scribeAuthMiddleware);
const model = new ScribeNoteTemplateModel();

let seeded = false;
function ensureSeeded() {
  if (!seeded) { model.seedSystem(); seeded = true; }
}

router.get('/', (req: Request, res: Response) => {
  const { noteType } = req.query;
  if (!noteType || typeof noteType !== 'string') {
    return res.status(400).json({ error: 'noteType query parameter is required' }) as any;
  }
  ensureSeeded();
  return res.json({ templates: model.listForUser(req.scribeUserId!, noteType) });
});

router.post('/', (req: Request, res: Response) => {
  const { noteType, name, verbosity, sections } = req.body;
  if (!noteType || !name) {
    return res.status(400).json({ error: 'noteType and name are required' }) as any;
  }
  const validVerbosity = ['brief', 'standard', 'detailed'];
  const resolvedVerbosity = validVerbosity.includes(verbosity) ? verbosity : 'standard';
  const template = model.create({
    userId: req.scribeUserId!,
    noteType,
    name,
    verbosity: resolvedVerbosity,
    sections: Array.isArray(sections) ? sections : [],
  });
  return res.status(201).json({ template });
});

router.delete('/:id', (req: Request, res: Response) => {
  const result = model.delete(req.params.id, req.scribeUserId!);
  if (result.changes === 0) {
    return res.status(404).json({ error: 'Template not found or cannot be deleted' }) as any;
  }
  return res.json({ ok: true });
});

export default router;
```

**Step 4: Run tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeNoteTemplates.test" 2>&1 | tail -10
```
Expected: all 6 tests pass.

**Step 5: Commit**

```bash
git add backend/src/routes/scribeNoteTemplates.ts backend/src/routes/scribeNoteTemplates.test.ts
git commit -m "feat: add /api/scribe/note-templates route with GET, POST, DELETE"
```

---

## Task 5: Register route in server.ts

**Files:**
- Modify: `backend/src/server.ts`

**Step 1: Add import and route registration**

After the existing scribeAiRouter import line, add:
```typescript
import scribeNoteTemplatesRouter from './routes/scribeNoteTemplates.js';
```

After `app.use('/api/ai/scribe', scribeAiRouter);`, add:
```typescript
app.use('/api/scribe/note-templates', scribeNoteTemplatesRouter);
```

**Step 2: Confirm backend starts with no errors**

Check backend server logs:
```bash
# Backend is running via preview_logs — just verify no new errors appear
```

**Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: register /api/scribe/note-templates route in server"
```

---

## Task 6: Add verbosity support to ScribeNoteModel + route

**Files:**
- Modify: `backend/src/models/scribeNote.ts`
- Modify: `backend/src/routes/scribeNotes.ts`
- Modify: `backend/src/models/scribeNote.test.ts`

**Step 1: Add failing test to scribeNote.test.ts**

Find the existing `ScribeNoteModel` test file and add this test to the describe block:

```typescript
it('creates a note with verbosity', () => {
  const note = model.create({ userId, noteType: 'progress_note', verbosity: 'brief' });
  expect(note.verbosity).toBe('brief');
});

it('defaults verbosity to standard when not provided', () => {
  const note = model.create({ userId, noteType: 'progress_note' });
  expect(note.verbosity).toBe('standard');
});
```

**Step 2: Run to confirm failure**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeNote.test" 2>&1 | tail -10
```
Expected: FAIL — `verbosity` not yet in model.

**Step 3: Update ScribeNote interface and model**

In `backend/src/models/scribeNote.ts`:

Add `verbosity: string;` to the `ScribeNote` interface after `patient_label`.

Update `ALLOWED_UPDATE_COLUMNS`:
```typescript
private static readonly ALLOWED_UPDATE_COLUMNS = new Set(['transcript', 'status', 'patient_label', 'verbosity']);
```

Update `create()` signature and body:
```typescript
create(input: { userId: string; noteType: string; patientLabel?: string; verbosity?: string }): ScribeNote {
  const id = randomUUID();
  getDb().prepare(
    'INSERT INTO scribe_notes (id, user_id, note_type, patient_label, verbosity) VALUES (?, ?, ?, ?, ?)'
  ).run(id, input.userId, input.noteType, input.patientLabel ?? null, input.verbosity ?? 'standard');
  return this.findByIdUnchecked(id)!;
}
```

**Step 4: Update the POST /api/scribe/notes route**

In `backend/src/routes/scribeNotes.ts`, update the `router.post('/')` handler:

```typescript
router.post('/', (req: Request, res: Response) => {
  const { noteType, patientLabel, verbosity } = req.body;
  if (!noteType) return res.status(400).json({ error: 'noteType is required' }) as any;
  const validVerbosity = ['brief', 'standard', 'detailed'];
  const resolvedVerbosity = validVerbosity.includes(verbosity) ? verbosity : 'standard';
  const note = noteModel.create({
    userId: req.scribeUserId!,
    noteType,
    patientLabel,
    verbosity: resolvedVerbosity,
  });
  return res.status(201).json({ note });
});
```

**Step 5: Run all scribeNote tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeNote.test" 2>&1 | tail -10
```
Expected: all tests pass.

**Step 6: Commit**

```bash
git add backend/src/models/scribeNote.ts backend/src/routes/scribeNotes.ts backend/src/models/scribeNote.test.ts
git commit -m "feat: add verbosity field to scribe_notes model and POST route"
```

---

## Task 7: Inject verbosity into AI generation system prompt

**Files:**
- Modify: `backend/src/routes/scribeAi.ts`
- Modify: `backend/src/routes/scribeAi.test.ts`

**Step 1: Add failing test**

Open `backend/src/routes/scribeAi.test.ts`. Find the existing test for `/generate`. Add:

```typescript
it('POST /generate — accepts verbosity brief without error', async () => {
  const res = await request(app)
    .post('/api/ai/scribe/generate')
    .set('Cookie', authCookie)
    .send({
      transcript: 'Patient is feeling better today.',
      sections: [{ name: 'Assessment', promptHint: null }],
      noteType: 'progress_note',
      verbosity: 'brief',
    });
  expect(res.status).toBe(200);
  expect(Array.isArray(res.body.sections)).toBe(true);
});
```

**Step 2: Run to confirm existing tests pass (verbosity test may pass already, that's ok)**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeAi.test" 2>&1 | tail -15
```

**Step 3: Update the `/generate` handler in scribeAi.ts**

In `router.post('/generate', ...)`, add `verbosity` to destructuring and append to system prompt:

```typescript
router.post('/generate', async (req: Request, res: Response) => {
  const { transcript, sections, noteType, userContext, verbosity } = req.body;
  // ... existing validation unchanged ...

  const specialty = userContext?.specialty || 'Medicine';
  const sectionList = sections
    .map((s: any) => `- ${s.name}${s.promptHint ? ` (Focus: ${s.promptHint})` : ''}`)
    .join('\n');

  const verbosityInstruction =
    verbosity === 'brief'
      ? '\nWrite concisely. Use bullet points where appropriate. No more than 1–2 sentences per item. Omit filler phrases.'
      : verbosity === 'detailed'
      ? '\nWrite in full prose with complete sentences. Include all clinically relevant detail, context, and nuance.'
      : '';

  const systemPrompt = `You are a clinical documentation AI assistant for a ${specialty} physician.
Generate structured note content for each section listed below, based ONLY on the transcript provided.
Write in first-person plural physician voice ("We assessed...", "The patient was...", "Our plan includes...").
Be clinically precise. Do not fabricate findings not present in the transcript.
If a section cannot be completed from the transcript, write: "Insufficient information captured."
Return ONLY valid JSON — no markdown fences, no extra text.${verbosityInstruction}`;

  // ... rest of handler unchanged ...
});
```

**Step 4: Run tests**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test -- --testPathPattern="scribeAi.test" 2>&1 | tail -10
```
Expected: all tests pass.

**Step 5: Commit**

```bash
git add backend/src/routes/scribeAi.ts backend/src/routes/scribeAi.test.ts
git commit -m "feat: inject verbosity instruction into scribe generate system prompt"
```

---

## Task 8: Update scribeBuilderStore — add verbosity + selectedTemplateId

**Files:**
- Modify: `src/stores/scribeBuilderStore.ts`

**Step 1: Update the store**

Add to the `ScribeBuilderState` interface:

```typescript
verbosity: 'brief' | 'standard' | 'detailed';
selectedTemplateId: string | null;
setVerbosity: (v: 'brief' | 'standard' | 'detailed') => void;
setSelectedTemplate: (templateId: string, sections: CanvasSection[]) => void;
```

Add initial values in `create()`:

```typescript
verbosity: 'standard',
selectedTemplateId: null,
```

Add action implementations:

```typescript
setVerbosity: (verbosity) => set({ verbosity }),

setSelectedTemplate: (templateId, sections) => set({
  selectedTemplateId: templateId,
  canvasSections: sections,
}),
```

**Step 2: Confirm frontend compiles (Vite HMR will show errors if any)**

Check frontend preview logs — no red errors.

**Step 3: Commit**

```bash
git add src/stores/scribeBuilderStore.ts
git commit -m "feat: add verbosity and selectedTemplateId to scribeBuilderStore"
```

---

## Task 9: Create useNoteTemplates hook

**Files:**
- Create: `src/hooks/useNoteTemplates.ts`

**Step 1: Write the hook**

```typescript
// src/hooks/useNoteTemplates.ts
import { useState, useEffect, useCallback } from 'react';
import { getBackendUrl } from '../config/appConfig';

export interface NoteTemplate {
  id: string;
  user_id: string | null;
  note_type: string;
  name: string;
  verbosity: 'brief' | 'standard' | 'detailed';
  sections: string; // JSON string: Array<{name, promptHint}>
  created_at: string;
}

export interface ParsedSection {
  name: string;
  promptHint: string | null;
}

export function useNoteTemplates(noteType: string) {
  const [templates, setTemplates] = useState<NoteTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(() => {
    if (!noteType) return;
    setLoading(true);
    setError(null);
    fetch(`${getBackendUrl()}/api/scribe/note-templates?noteType=${encodeURIComponent(noteType)}`, {
      credentials: 'include',
    })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => setTemplates(d.templates || []))
      .catch(e => setError(e instanceof Error ? e.message : 'Failed to load templates'))
      .finally(() => setLoading(false));
  }, [noteType]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const saveTemplate = useCallback(
    async (name: string, verbosity: string, sections: ParsedSection[]) => {
      const res = await fetch(`${getBackendUrl()}/api/scribe/note-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ noteType, name, verbosity, sections }),
      });
      if (!res.ok) throw new Error('Failed to save template');
      fetchTemplates();
    },
    [noteType, fetchTemplates]
  );

  const deleteTemplate = useCallback(
    async (id: string) => {
      const res = await fetch(`${getBackendUrl()}/api/scribe/note-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to delete template');
      fetchTemplates();
    },
    [fetchTemplates]
  );

  const systemTemplates = templates.filter(t => t.user_id === null);
  const userTemplates = templates.filter(t => t.user_id !== null);

  return { templates, systemTemplates, userTemplates, loading, error, saveTemplate, deleteTemplate };
}
```

**Step 2: No isolated test needed** — will be exercised by component tests in Task 10.

**Step 3: Commit**

```bash
git add src/hooks/useNoteTemplates.ts
git commit -m "feat: add useNoteTemplates hook for fetching and managing note templates"
```

---

## Task 10: Rebuild NoteBuilderPage (template-first)

**Files:**
- Modify: `src/components/scribe-standalone/NoteBuilderPage.tsx`

**Step 1: Full replacement of NoteBuilderPage**

```tsx
// src/components/scribe-standalone/NoteBuilderPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionLibrary } from './SectionLibrary';
import { NoteCanvas } from './NoteCanvas';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';
import { useNoteTemplates, NoteTemplate } from '../../hooks/useNoteTemplates';
import { getBackendUrl } from '../../config/appConfig';

const NOTE_TYPES = [
  { value: 'progress_note', label: 'Progress Note' },
  { value: 'h_and_p', label: 'H&P' },
  { value: 'transfer_note', label: 'Transfer Note' },
  { value: 'accept_note', label: 'Accept Note' },
  { value: 'consult_note', label: 'Consult Note' },
  { value: 'discharge_summary', label: 'Discharge Summary' },
  { value: 'procedure_note', label: 'Procedure Note' },
];

type Verbosity = 'brief' | 'standard' | 'detailed';

const VERBOSITY_OPTIONS: { value: Verbosity; label: string; description: string }[] = [
  { value: 'brief', label: 'Brief', description: 'Bullet points, concise' },
  { value: 'standard', label: 'Standard', description: 'Balanced clinical prose' },
  { value: 'detailed', label: 'Detailed', description: 'Full prose, all detail' },
];

export const NoteBuilderPage: React.FC = () => {
  const {
    canvasSections, noteType, patientLabel, verbosity, selectedTemplateId,
    setNoteType, setPatientLabel, clearCanvas, setVerbosity, setSelectedTemplate,
  } = useScribeBuilderStore();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { systemTemplates, userTemplates, loading: templatesLoading, deleteTemplate, saveTemplate } = useNoteTemplates(noteType);

  const handleSelectTemplate = (tmpl: NoteTemplate) => {
    const sections = (JSON.parse(tmpl.sections) as Array<{ name: string; promptHint: string | null }>).map((s, i) => ({
      canvasId: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${i}`,
      templateId: `tmpl-${tmpl.id}-${i}`,
      name: s.name,
      promptHint: s.promptHint,
      isPrebuilt: tmpl.user_id === null,
    }));
    setSelectedTemplate(tmpl.id, sections);
    setVerbosity(tmpl.verbosity as Verbosity);
  };

  const handleStartRecording = async () => {
    if (canvasSections.length === 0) { setError('Add at least one section before recording'); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${getBackendUrl()}/api/scribe/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ noteType, patientLabel: patientLabel || null, verbosity }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create note');
      navigate(`/scribe/note/${data.note.id}/record`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An unexpected error occurred');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!saveTemplateName.trim()) { setSaveError('Template name is required'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const sections = canvasSections.map(s => ({ name: s.name, promptHint: s.promptHint }));
      await saveTemplate(saveTemplateName.trim(), verbosity, sections);
      setSaveTemplateName('');
      setShowSaveInput(false);
    } catch {
      setSaveError('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">New Note</h1>
        <button onClick={() => navigate('/scribe/dashboard')} className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
      </div>

      {/* Note type + patient label */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={noteType}
          onChange={e => { setNoteType(e.target.value); clearCanvas(); }}
          aria-label="Note type"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          {NOTE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input type="text" value={patientLabel} onChange={e => setPatientLabel(e.target.value)}
          placeholder="Patient label (optional)"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      {/* Template selection */}
      <div className="flex flex-col gap-2">
        {systemTemplates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Standard Templates</p>
            <div className="flex flex-wrap gap-2">
              {systemTemplates.map(tmpl => (
                <button key={tmpl.id} onClick={() => handleSelectTemplate(tmpl)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedTemplateId === tmpl.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                  {tmpl.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {userTemplates.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">My Templates</p>
            <div className="flex flex-wrap gap-2">
              {userTemplates.map(tmpl => (
                <div key={tmpl.id} className="flex items-center gap-1">
                  <button onClick={() => handleSelectTemplate(tmpl)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${selectedTemplateId === tmpl.id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}`}>
                    {tmpl.name}
                  </button>
                  <button onClick={() => deleteTemplate(tmpl.id)} aria-label={`Delete ${tmpl.name}`}
                    className="text-gray-300 hover:text-red-400 text-xs px-1">×</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {templatesLoading && <p className="text-xs text-gray-400">Loading templates...</p>}
      </div>

      {/* Section builder */}
      <div className="lg:grid lg:grid-cols-2 lg:gap-4">
        <div className={`${showLibrary ? 'block' : 'hidden'} lg:block bg-white border border-gray-200 rounded-xl overflow-hidden`} style={{ maxHeight: '60vh' }}>
          <div className="px-3 py-2 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Section Library</h2>
            <button onClick={() => setShowLibrary(false)} className="lg:hidden text-gray-400 text-lg">×</button>
          </div>
          <SectionLibrary />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Note Sections ({canvasSections.length})</h2>
            <div className="flex gap-2">
              <button onClick={() => setShowLibrary(true)} className="lg:hidden text-sm text-blue-600 border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50">
                + Add sections
              </button>
              {canvasSections.length > 0 && (
                <button onClick={clearCanvas} className="text-xs text-gray-400 hover:text-red-400">Clear all</button>
              )}
            </div>
          </div>
          <NoteCanvas />
        </div>
      </div>

      {/* Verbosity */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Note Verbosity</p>
        <div className="flex gap-2">
          {VERBOSITY_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setVerbosity(opt.value)}
              title={opt.description}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${verbosity === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save as template */}
      {canvasSections.length > 0 && (
        <div>
          {!showSaveInput ? (
            <button onClick={() => setShowSaveInput(true)} className="text-xs text-blue-600 hover:underline">
              + Save current sections as template
            </button>
          ) : (
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={saveTemplateName}
                onChange={e => setSaveTemplateName(e.target.value)}
                placeholder="Template name..."
                className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                onKeyDown={e => e.key === 'Enter' && handleSaveTemplate()}
              />
              <button onClick={handleSaveTemplate} disabled={saving}
                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { setShowSaveInput(false); setSaveTemplateName(''); }}
                className="text-sm text-gray-400 hover:text-gray-600">Cancel</button>
            </div>
          )}
          {saveError && <p className="text-xs text-red-600 mt-1">{saveError}</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-600 bg-red-50 rounded p-2">{error}</p>}
      <button onClick={handleStartRecording} disabled={creating || canvasSections.length === 0}
        className="w-full py-4 bg-blue-600 text-white rounded-xl font-semibold text-base hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
        {creating ? 'Starting...' : '🎙 Record'}
      </button>
    </div>
  );
};
```

**Step 2: Check frontend compiles**

Verify no red errors in frontend preview logs.

**Step 3: Commit**

```bash
git add src/components/scribe-standalone/NoteBuilderPage.tsx
git commit -m "feat: rebuild NoteBuilderPage with template-first flow and verbosity picker"
```

---

## Task 11: Pass verbosity from store to ScribeRecordPage generate call

**Files:**
- Modify: `src/components/scribe-standalone/ScribeRecordPage.tsx`

**Step 1: Add verbosity to the generate call**

In `ScribeRecordPage.tsx`, import the store and pass verbosity to the generate endpoint:

```tsx
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';

// Inside the component, add:
const { canvasSections, noteType, verbosity } = useScribeBuilderStore();
```

In the `handleTranscript` function, update the `genRes` fetch body to include `verbosity`:

```typescript
body: JSON.stringify({
  transcript,
  sections: canvasSections.map(s => ({ name: s.name, promptHint: s.promptHint || '' })),
  noteType,
  verbosity,
}),
```

**Step 2: Confirm no TS errors in frontend logs.**

**Step 3: Commit**

```bash
git add src/components/scribe-standalone/ScribeRecordPage.tsx
git commit -m "feat: pass verbosity from store to scribe generate API call"
```

---

## Task 12: Add onDelete prop to NoteSectionEditor

**Files:**
- Modify: `src/components/scribe-standalone/NoteSectionEditor.tsx`

**Step 1: Update Props interface and component**

```tsx
interface Props {
  section: Section;
  onChange: (id: string, content: string) => void;
  onFocusedAI: (section: Section) => void;
  onDelete?: () => void;  // NEW — optional
}
```

In the header `div` (the `flex items-center justify-between` row), add the delete button inside the right-side button group:

```tsx
{onDelete && (
  <button
    onClick={onDelete}
    aria-label={`Delete ${section.section_name} section`}
    className="text-xs text-gray-300 hover:text-red-400 px-1 transition-colors"
    title="Remove section"
  >
    ×
  </button>
)}
```

Place this as the last item in the right-side button group (after the copy button).

**Step 2: Confirm no TS errors.**

**Step 3: Commit**

```bash
git add src/components/scribe-standalone/NoteSectionEditor.tsx
git commit -m "feat: add optional onDelete prop to NoteSectionEditor"
```

---

## Task 13: Update ScribeNotePage — delete sections, add section drawer, Copy Note

**Files:**
- Modify: `src/components/scribe-standalone/ScribeNotePage.tsx`

**Step 1: Update ScribeNotePage with all enhancements**

Key changes:
1. Add `showAddSection` state (boolean) and `handleDeleteSection` function
2. Wire `onDelete` to each `NoteSectionEditor`
3. Add "Add Section" button and slide-up drawer using `SectionLibrary`
4. Rename "Copy All" → "Copy Note" as primary full-width green button
5. Make "Finalize" secondary

```tsx
// Add these imports at the top:
import { SectionLibrary } from './SectionLibrary';
import { useScribeBuilderStore } from '../../stores/scribeBuilderStore';

// Add state:
const [showAddSection, setShowAddSection] = useState(false);

// Add handler (local display-state only — no backend call):
const handleDeleteSection = (sectionId: string) => {
  setSections(prev => prev.filter(s => s.id !== sectionId));
  setEdits(prev => {
    const next = { ...prev };
    delete next[sectionId];
    return next;
  });
};

// Add handler for adding a section from the library drawer:
const { addSection, canvasSections } = useScribeBuilderStore();
const handleAddSectionFromLibrary = (template: { id: string; name: string; promptHint: string | null; isPrebuilt: boolean }) => {
  const newSection: SectionData = {
    id: `local-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
    section_name: template.name,
    content: null,
    confidence: null,
    display_order: sections.length,
  };
  setSections(prev => [...prev, newSection]);
  setEdits(prev => ({ ...prev, [newSection.id]: '' }));
  setShowAddSection(false);
};
```

Update `handleCopyAll` → rename to `handleCopyNote` (same logic):
```typescript
const handleCopyNote = () => {
  const fullNote = sections
    .map(s => `${s.section_name.toUpperCase()}\n${edits[s.id] || s.content || ''}`)
    .join('\n\n');
  navigator.clipboard.writeText(fullNote);
};
```

Update the top button row — swap "Copy All" for "Copy Note" and keep Finalize as secondary:
```tsx
<div className="flex gap-2">
  <button
    onClick={handleFinalize}
    disabled={saving}
    className="text-sm px-3 py-1.5 border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 transition-colors"
  >
    {saving ? 'Saving...' : 'Finalize'}
  </button>
</div>
```

Update the section list to wire `onDelete`:
```tsx
{sections.map(section => (
  <NoteSectionEditor
    key={section.id}
    section={{ ...section, content: edits[section.id] ?? section.content }}
    onChange={handleSectionChange}
    onFocusedAI={setFocusedSection}
    onDelete={() => handleDeleteSection(section.id)}
  />
))}
```

Add "Add Section" button and drawer after the section list:
```tsx
<button
  onClick={() => setShowAddSection(true)}
  className="text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors w-full"
>
  + Add Section
</button>

{showAddSection && (
  <div className="fixed inset-x-0 bottom-0 z-50 bg-white border-t border-gray-200 rounded-t-2xl shadow-2xl" style={{ maxHeight: '60vh' }}>
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
      <h3 className="font-semibold text-gray-900 text-sm">Add Section</h3>
      <button onClick={() => setShowAddSection(false)} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
    </div>
    <div className="overflow-y-auto" style={{ maxHeight: 'calc(60vh - 52px)' }}>
      <SectionLibraryForNote onSelect={handleAddSectionFromLibrary} existingSectionNames={new Set(sections.map(s => s.section_name))} />
    </div>
  </div>
)}
```

Add a "Copy Note" primary CTA at the very bottom (below the sections, above finalize):
```tsx
<button
  onClick={handleCopyNote}
  className="w-full py-3 bg-green-600 text-white rounded-xl font-semibold text-base hover:bg-green-700 transition-colors"
>
  Copy Note
</button>
```

**Note:** `SectionLibraryForNote` is a small inline wrapper around `SectionLibrary` that adds an `onSelect` callback and filters out already-present sections. Create it as a local component in the same file or a separate `SectionLibraryForNote.tsx`:

```tsx
// inline in ScribeNotePage.tsx or new file
interface SectionLibraryForNoteProps {
  onSelect: (t: { id: string; name: string; promptHint: string | null; isPrebuilt: boolean }) => void;
  existingSectionNames: Set<string>;
}

const SectionLibraryForNote: React.FC<SectionLibraryForNoteProps> = ({ onSelect, existingSectionNames }) => {
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; prompt_hint: string | null; is_prebuilt: number }>>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch(`${getBackendUrl()}/api/scribe/templates`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
      .catch(() => {});
  }, []);

  const filtered = templates.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) && !existingSectionNames.has(t.name)
  );

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 border-b border-gray-200">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search sections..." aria-label="Search sections"
          className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>
      {filtered.map(t => (
        <button key={t.id} onClick={() => onSelect({ id: t.id, name: t.name, promptHint: t.prompt_hint, isPrebuilt: t.is_prebuilt === 1 })}
          className="w-full text-left px-3 py-2.5 text-sm border-b border-gray-100 hover:bg-blue-50 transition-colors">
          {t.name}
        </button>
      ))}
      {filtered.length === 0 && <p className="text-center text-sm text-gray-400 py-4">No sections found</p>}
    </div>
  );
};
```

**Step 2: Verify frontend compiles with no errors.**

**Step 3: Commit**

```bash
git add src/components/scribe-standalone/ScribeNotePage.tsx
git commit -m "feat: add section delete, add-section drawer, and Copy Note CTA to ScribeNotePage"
```

---

## Task 14: Full test run and backend server verification

**Step 1: Run full backend test suite**

```bash
cd /Users/bitbox/Documents/DocAssistAI/backend && npm test 2>&1 | tail -30
```
Expected: all tests pass. Zero failures.

**Step 2: Check backend server logs for any startup errors**

Use `preview_logs` on the backend server. Expected: clean startup, no errors.

**Step 3: Check frontend preview logs for any build/HMR errors**

Use `preview_logs` on the frontend server. Expected: no red errors.

**Step 4: Take a screenshot of the NoteBuilderPage to confirm template cards render**

Navigate preview to `/scribe/login`, log in, navigate to `/scribe/new`. Take screenshot.

**Step 5: Final commit if any loose changes**

```bash
git status
```
If clean: done. If any unstaged: stage and commit with descriptive message.
