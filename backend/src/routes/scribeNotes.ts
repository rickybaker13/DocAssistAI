import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { ScribeNoteModel } from '../models/scribeNote.js';
import { ScribeNoteSectionModel } from '../models/scribeNoteSection.js';

const router = Router();
router.use(scribeAuthMiddleware);

const noteModel = new ScribeNoteModel();
const sectionModel = new ScribeNoteSectionModel();

router.get('/', async (req: Request, res: Response) => {
  const notes = await noteModel.listForUser(req.scribeUserId!);
  return res.json({ notes });
});

router.post('/', async (req: Request, res: Response) => {
  const { noteType, patientLabel, verbosity } = req.body;
  if (!noteType) return res.status(400).json({ error: 'noteType is required' }) as any;
  const validVerbosity = ['brief', 'standard', 'detailed'];
  const resolvedVerbosity = validVerbosity.includes(verbosity) ? verbosity : 'standard';
  const note = await noteModel.create({
    userId: req.scribeUserId!,
    noteType,
    patientLabel,
    verbosity: resolvedVerbosity,
  });
  return res.status(201).json({ note });
});

router.get('/:id', async (req: Request, res: Response) => {
  const note = await noteModel.findById(req.params.id, req.scribeUserId!);
  if (!note) return res.status(404).json({ error: 'Note not found' }) as any;
  const sections = await sectionModel.listForNote(note.id);
  return res.json({ note, sections });
});

router.put('/:id', async (req: Request, res: Response) => {
  const note = await noteModel.findById(req.params.id, req.scribeUserId!);
  if (!note) return res.status(404).json({ error: 'Note not found' }) as any;
  const { transcript, status, patient_label } = req.body;
  const fields: any = {};
  if (transcript !== undefined) fields.transcript = transcript;
  if (status !== undefined) fields.status = status;
  if (patient_label !== undefined) fields.patient_label = patient_label;
  if (Object.keys(fields).length > 0) await noteModel.update(note.id, req.scribeUserId!, fields);
  const updated = await noteModel.findById(note.id, req.scribeUserId!);
  return res.json({ note: updated });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const note = await noteModel.findById(req.params.id, req.scribeUserId!);
  if (!note) return res.status(404).json({ error: 'Note not found' }) as any;
  await noteModel.softDelete(note.id, req.scribeUserId!);
  return res.json({ ok: true });
});

// POST /api/scribe/notes/:id/sections — bulk save AI-generated sections
router.post('/:id/sections', async (req: Request, res: Response) => {
  const note = await noteModel.findById(req.params.id, req.scribeUserId!);
  if (!note) return res.status(404).json({ error: 'Note not found' }) as any;

  const { sections } = req.body;
  if (!Array.isArray(sections) || sections.length === 0) {
    return res.status(400).json({ error: 'sections array required' }) as any;
  }

  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (typeof s.name !== 'string' || s.name.trim() === '') {
      return res.status(400).json({ error: `sections[${i}].name is required` }) as any;
    }
    if (s.confidence !== null && s.confidence !== undefined) {
      if (typeof s.confidence !== 'number' || s.confidence < 0 || s.confidence > 1) {
        return res.status(400).json({ error: `sections[${i}].confidence must be 0-1` }) as any;
      }
    }
  }

  await sectionModel.deleteForNote(note.id);
  const created = await sectionModel.bulkCreate(
    sections.map((s: any, i: number) => ({
      noteId: note.id,
      sectionName: s.name,
      displayOrder: i,
      promptHint: s.promptHint || null,
      content: s.content || null,
      confidence: s.confidence ?? null,
    }))
  );
  return res.status(201).json({ sections: created });
});

export default router;
