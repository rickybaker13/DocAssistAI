import { Router, Request, Response, NextFunction } from 'express';
import { ScribeFeedbackModel } from '../models/scribeFeedback.js';
import { ScribeUserModel } from '../models/scribeUser.js';

const router = Router();
const feedbackModel = new ScribeFeedbackModel();
const userModel = new ScribeUserModel();

// ── Admin middleware ───────────────────────────────────────────────────────
async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// ── User endpoints ────────────────────────────────────────────────────────

// POST / — Submit feedback (rate-limited: 5 per hour per user)
router.post('/', async (req: Request, res: Response) => {
  const { category, message } = req.body;
  if (!category || typeof category !== 'string') {
    return res.status(400).json({ error: 'Category is required' }) as any;
  }
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' }) as any;
  }
  if (message.length > 5000) {
    return res.status(400).json({ error: 'Message must be under 5000 characters' }) as any;
  }

  const recentCount = await feedbackModel.countRecentByUser(req.scribeUserId!, 60);
  if (recentCount >= 5) {
    return res.status(429).json({ error: 'Too many submissions. Please try again later.' }) as any;
  }

  try {
    const record = await feedbackModel.create({
      userId: req.scribeUserId!,
      category,
      message: message.trim(),
    });
    return res.status(201).json(record);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Submission failed';
    return res.status(400).json({ error: msg });
  }
});

// GET /mine — Current user's submissions
router.get('/mine', async (req: Request, res: Response) => {
  const items = await feedbackModel.listForUser(req.scribeUserId!);
  return res.json(items);
});

// ── Admin endpoints ───────────────────────────────────────────────────────

// GET /admin — List all feedback (with optional filters)
router.get('/admin', requireAdmin, async (req: Request, res: Response) => {
  const category = req.query.category as string | undefined;
  const status = req.query.status as string | undefined;
  const items = await feedbackModel.listAll({ category, status });
  return res.json(items);
});

// PATCH /admin/:id — Update status and/or admin_note
router.patch('/admin/:id', requireAdmin, async (req: Request, res: Response) => {
  const { status, admin_note } = req.body;
  const updated = await feedbackModel.updateStatus(req.params.id, {
    status,
    adminNote: admin_note,
  });
  if (!updated) {
    return res.status(404).json({ error: 'Feedback not found' }) as any;
  }
  return res.json(updated);
});

export default router;
