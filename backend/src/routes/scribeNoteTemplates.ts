import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { ScribeNoteTemplateModel } from '../models/scribeNoteTemplate.js';

const router = Router();
router.use(scribeAuthMiddleware);
const model = new ScribeNoteTemplateModel();

let seeded = false;
async function ensureSeeded() {
  if (!seeded) {
    await model.seedSystem();
    seeded = true;
  }
}

router.get('/', async (req: Request, res: Response) => {
  await ensureSeeded();
  const { noteType } = req.query;
  if (!noteType || typeof noteType !== 'string') {
    return res.status(400).json({ error: 'noteType query parameter is required' }) as any;
  }
  return res.json({ templates: await model.listForUser(req.scribeUserId!, noteType) });
});

router.post('/', async (req: Request, res: Response) => {
  const { noteType, name, verbosity, sections } = req.body;
  if (!noteType || typeof noteType !== 'string' || !name || typeof name !== 'string') {
    return res.status(400).json({ error: 'noteType and name are required and must be strings' }) as any;
  }
  const validVerbosity = ['brief', 'standard', 'detailed'];
  const resolvedVerbosity = validVerbosity.includes(verbosity) ? verbosity : 'standard';
  const template = await model.create({
    userId: req.scribeUserId!,
    noteType,
    name,
    verbosity: resolvedVerbosity as 'brief' | 'standard' | 'detailed',
    sections: Array.isArray(sections) ? sections : [],
  });
  return res.status(201).json({ template });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const result = await model.delete(req.params.id, req.scribeUserId!);
  if (result.rowCount === 0) {
    return res.status(404).json({ error: 'Template not found or cannot be deleted' }) as any;
  }
  return res.json({ ok: true });
});

export default router;
