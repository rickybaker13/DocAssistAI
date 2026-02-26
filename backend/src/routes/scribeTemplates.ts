import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { ScribeSectionTemplateModel } from '../models/scribeSectionTemplate.js';

const router = Router();
router.use(scribeAuthMiddleware);
const model = new ScribeSectionTemplateModel();

let seeded = false;
async function ensureSeeded() {
  if (!seeded) {
    await model.seedPrebuilt();
    seeded = true;
  }
}

router.get('/', async (req: Request, res: Response) => {
  await ensureSeeded();
  return res.json({ templates: await model.listForUser(req.scribeUserId!) });
});

// Must come before /:id
router.get('/prebuilt', async (_req: Request, res: Response) => {
  await ensureSeeded();
  return res.json({ templates: await model.listPrebuilt() });
});

router.post('/', async (req: Request, res: Response) => {
  const { name, promptHint } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' }) as any;
  const template = await model.create({ userId: req.scribeUserId!, name, promptHint });
  return res.status(201).json({ template });
});

router.put('/:id', async (req: Request, res: Response) => {
  const { name, promptHint } = req.body;
  const result = await model.update(req.params.id, req.scribeUserId!, { name, promptHint });
  if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Template not found or cannot be modified' }) as any;
  return res.json({ ok: true });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const result = await model.delete(req.params.id, req.scribeUserId!);
  if ((result.rowCount ?? 0) === 0) return res.status(404).json({ error: 'Template not found or cannot be deleted' }) as any;
  return res.json({ ok: true });
});

export default router;
