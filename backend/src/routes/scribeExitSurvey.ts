import { Router, Request, Response } from 'express';
import { ScribeExitSurveyModel } from '../models/scribeExitSurvey.js';
import { ScribeSignupTrackingModel } from '../models/scribeSignupTracking.js';

const router = Router();
const exitSurveyModel = new ScribeExitSurveyModel();
const signupTrackingModel = new ScribeSignupTrackingModel();

const VALID_REASONS = [
  'too_expensive',
  'did_not_work_well',
  'did_not_use_it',
  'switched_to_another_product',
  'other',
];

// POST / — Submit an exit survey (one per user)
router.post('/', async (req: Request, res: Response) => {
  const { reason, suggestion } = req.body;

  if (!reason || typeof reason !== 'string') {
    return res.status(400).json({ error: 'Reason is required' }) as any;
  }
  if (!VALID_REASONS.includes(reason)) {
    return res.status(400).json({ error: `Invalid reason. Must be one of: ${VALID_REASONS.join(', ')}` }) as any;
  }
  if (suggestion && typeof suggestion !== 'string') {
    return res.status(400).json({ error: 'Suggestion must be a string' }) as any;
  }
  if (suggestion && suggestion.length > 2000) {
    return res.status(400).json({ error: 'Suggestion must be under 2000 characters' }) as any;
  }

  // Only allow one survey per user
  const existing = await exitSurveyModel.findByUserId(req.scribeUserId!);
  if (existing) {
    return res.status(409).json({ error: 'Exit survey already submitted' }) as any;
  }

  try {
    const record = await exitSurveyModel.create({
      userId: req.scribeUserId!,
      reason,
      suggestion: suggestion?.trim() || null,
    });

    // Update signup tracking with non-conversion reason (fire-and-forget)
    signupTrackingModel.recordNonConversion(
      req.scribeUserId!,
      reason,
      suggestion?.trim() || null,
    ).catch(err => console.error('[exit-survey] Failed to update signup tracking:', err));

    return res.status(201).json(record);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Submission failed';
    return res.status(400).json({ error: msg });
  }
});

// GET /mine — Check if current user already submitted
router.get('/mine', async (req: Request, res: Response) => {
  const survey = await exitSurveyModel.findByUserId(req.scribeUserId!);
  return res.json({ submitted: !!survey, survey: survey ?? null });
});

export default router;
