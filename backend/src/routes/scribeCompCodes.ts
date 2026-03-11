import { Router, Request, Response, NextFunction } from 'express';
import { ScribeCompCodeModel } from '../models/scribeCompCode.js';
import { ScribeUserModel } from '../models/scribeUser.js';

const router = Router();
const compCodeModel = new ScribeCompCodeModel();
const userModel = new ScribeUserModel();

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// ─── User route (any authenticated user) ─────────────────────────────────────

// POST /redeem — Redeem a comp code
router.post('/redeem', async (req: Request, res: Response) => {
  const { code } = req.body;
  if (!code || typeof code !== 'string' || code.trim().length < 1) {
    return res.status(400).json({ error: 'Code is required' });
  }

  const result = await compCodeModel.redeem(code.trim(), req.scribeUserId!);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }

  return res.json({ message: 'Complimentary access granted!', subscription_status: 'comp' });
});

// ─── Admin routes ────────────────────────────────────────────────────────────

// POST / — Create a new comp code
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  const { code, label, maxUses, expiresAt } = req.body;
  if (!code || typeof code !== 'string' || code.trim().length < 3) {
    return res.status(400).json({ error: 'Code must be at least 3 characters' });
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(code.trim())) {
    return res.status(400).json({ error: 'Code can only contain letters, numbers, hyphens, and underscores' });
  }

  // Check for duplicate
  const existing = await compCodeModel.findByCode(code.trim());
  if (existing) {
    return res.status(409).json({ error: 'A code with this name already exists' });
  }

  const created = await compCodeModel.create({
    code: code.trim(),
    label,
    maxUses: maxUses ? Number(maxUses) : undefined,
    expiresAt,
    createdBy: req.scribeUserId!,
  });

  return res.status(201).json(created);
});

// GET / — List all comp codes
router.get('/', requireAdmin, async (_req: Request, res: Response) => {
  const codes = await compCodeModel.listAll();
  return res.json(codes);
});

// PATCH /:id/deactivate — Deactivate a code
router.patch('/:id/deactivate', requireAdmin, async (req: Request, res: Response) => {
  const code = await compCodeModel.findById(req.params.id);
  if (!code) {
    return res.status(404).json({ error: 'Code not found' });
  }
  await compCodeModel.deactivate(req.params.id);
  return res.json({ message: 'Code deactivated' });
});

// PATCH /:id/activate — Re-activate a code
router.patch('/:id/activate', requireAdmin, async (req: Request, res: Response) => {
  const code = await compCodeModel.findById(req.params.id);
  if (!code) {
    return res.status(404).json({ error: 'Code not found' });
  }
  await compCodeModel.activate(req.params.id);
  return res.json({ message: 'Code activated' });
});

// GET /:id/redemptions — List who redeemed a code
router.get('/:id/redemptions', requireAdmin, async (req: Request, res: Response) => {
  const code = await compCodeModel.findById(req.params.id);
  if (!code) {
    return res.status(404).json({ error: 'Code not found' });
  }
  const redemptions = await compCodeModel.listRedemptions(req.params.id);
  return res.json(redemptions);
});

export default router;
