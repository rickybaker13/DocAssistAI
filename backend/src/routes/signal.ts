import { Router, Request, Response } from 'express';
import { signalEngine } from '../services/signal/signalEngine.js';
import { contextStore } from '../services/signal/contextStore.js';

const router = Router();

router.post('/process', async (req: Request, res: Response) => {
  try {
    const { patientData, hoursBack = 24 } = req.body;
    const sessionId = (req.headers['x-session-id'] as string) ||
                      (req.headers['x-patient-id'] as string) ||
                      'default';

    if (!patientData) {
      return res.status(400).json({ error: 'patientData required' });
    }

    const signal = await signalEngine.process(sessionId, patientData, Number(hoursBack));
    return res.json({ signal });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Signal extraction failed';
    return res.status(500).json({ error: message });
  }
});

router.post('/invalidate', (req: Request, res: Response) => {
  const sessionId = (req.headers['x-session-id'] as string) || '';
  if (sessionId) contextStore.invalidate(sessionId);
  return res.json({ ok: true });
});

// Population query scaffold — v1.0 roadmap
router.post('/population', (_req: Request, res: Response) => {
  return res.status(501).json({
    error: 'Population query engine not yet implemented',
    roadmap: 'v1.0 — Q4 2026',
  });
});

export default router;
