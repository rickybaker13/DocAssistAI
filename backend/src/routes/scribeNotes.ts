import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth';
import { ScribeNoteModel } from '../models/scribeNote';
import { ScribeNoteSectionModel } from '../models/scribeNoteSection';

const router = Router();
router.use(scribeAuthMiddleware);

const noteModel = new ScribeNoteModel();
const sectionModel = new ScribeNoteSectionModel();

router.get('/', (req: Request, res: Response) => {
  const notes = noteModel.listForUser(req.scribeUserId!);
  return res.json({ notes });
});

router.post('/', (req: Request, res: Response) => {
  const { noteType, patientLabel } = req.body;
  if (!noteType) return res.status(400).json({ error: 'noteType is required' }) as any;
  const note = noteModel.create({ userId: req.scribeUserId!, noteType, patientLabel });
  return res.status(201).json({ note });
});

router.get('/:id', (req: Request, res: Response) => {
  const note = noteModel.findById(req.params.id, req.scribeUserId!);
  if (!note) return res.status(404).json({ error: 'Note not found' }) as any;
  const sections = sectionModel.listForNote(note.id);
  return res.json({ note, sections });
});

router.put('/:id', (req: Request, res: Response) => {
  const note = noteModel.findById(req.params.id, req.scribeUserId!);
  if (!note) return res.status(404).json({ error: 'Note not found' }) as any;
  const { transcript, status, patient_label } = req.body;
  const fields: any = {};
  if (transcript !== undefined) fields.transcript = transcript;
  if (status !== undefined) fields.status = status;
  if (patient_label !== undefined) fields.patient_label = patient_label;
  if (Object.keys(fields).length > 0) noteModel.update(note.id, req.scribeUserId!, fields);
  const updated = noteModel.findById(note.id, req.scribeUserId!);
  return res.json({ note: updated });
});

router.delete('/:id', (req: Request, res: Response) => {
  const note = noteModel.findById(req.params.id, req.scribeUserId!);
  if (!note) return res.status(404).json({ error: 'Note not found' }) as any;
  noteModel.softDelete(note.id, req.scribeUserId!);
  return res.json({ ok: true });
});

export default router;
