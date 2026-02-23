import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth';
import { ScribeNoteTemplateModel } from '../models/scribeNoteTemplate';

const router = Router();
router.use(scribeAuthMiddleware);
const model = new ScribeNoteTemplateModel();

model.seedSystem();

router.get('/', (req: Request, res: Response) => {
  const { noteType } = req.query;
  if (!noteType || typeof noteType !== 'string') {
    return res.status(400).json({ error: 'noteType query parameter is required' }) as any;
  }
  return res.json({ templates: model.listForUser(req.scribeUserId!, noteType) });
});

router.post('/', (req: Request, res: Response) => {
  const { noteType, name, verbosity, sections } = req.body;
  if (!noteType || typeof noteType !== 'string' || !name || typeof name !== 'string') {
    return res.status(400).json({ error: 'noteType and name are required and must be strings' }) as any;
  }
  const validVerbosity = ['brief', 'standard', 'detailed'];
  const resolvedVerbosity = validVerbosity.includes(verbosity) ? verbosity : 'standard';
  const template = model.create({
    userId: req.scribeUserId!,
    noteType,
    name,
    verbosity: resolvedVerbosity as 'brief' | 'standard' | 'detailed',
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
