import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth';
import { ScribeSectionTemplateModel } from '../models/scribeSectionTemplate';

const router = Router();
router.use(scribeAuthMiddleware);
const model = new ScribeSectionTemplateModel();

let seeded = false;
function ensureSeeded() { if (!seeded) { model.seedPrebuilt(); seeded = true; } }

router.get('/', (req: Request, res: Response) => {
  ensureSeeded();
  return res.json({ templates: model.listForUser(req.scribeUserId!) });
});

// Must come before /:id
router.get('/prebuilt', (_req: Request, res: Response) => {
  ensureSeeded();
  return res.json({ templates: model.listPrebuilt() });
});

router.post('/', (req: Request, res: Response) => {
  const { name, promptHint } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' }) as any;
  const template = model.create({ userId: req.scribeUserId!, name, promptHint });
  return res.status(201).json({ template });
});

router.put('/:id', (req: Request, res: Response) => {
  const { name, promptHint } = req.body;
  model.update(req.params.id, req.scribeUserId!, { name, promptHint });
  return res.json({ ok: true });
});

router.delete('/:id', (req: Request, res: Response) => {
  model.delete(req.params.id, req.scribeUserId!);
  return res.json({ ok: true });
});

export default router;
