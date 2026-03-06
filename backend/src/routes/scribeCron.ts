import { Router, Request, Response } from 'express';
import { processAutoRenewals, sendTrialExpiringReminders } from '../services/billing/recurringBilling.js';

const router = Router();

const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret';

const firstEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value;
  }
  return undefined;
};

router.post('/renew-subscriptions', async (req: Request, res: Response) => {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessToken = firstEnv('SQUARE_ACCESS_TOKEN', 'SQUARE_TOKEN', 'SQUARE_SECRET_ACCESS_TOKEN');
  const locationId = firstEnv('SQUARE_LOCATION_ID', 'SQUARE_DEFAULT_LOCATION_ID');
  const environment = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' as const : 'sandbox' as const;

  if (!accessToken || !locationId) {
    return res.status(503).json({ error: 'Square not configured' });
  }

  try {
    const results = await processAutoRenewals({ accessToken, locationId, environment });
    return res.json({
      processed: results.length,
      renewed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (err) {
    console.error('[cron] Auto-renewal error:', err);
    return res.status(500).json({ error: 'Auto-renewal processing failed' });
  }
});

router.post('/trial-reminders', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const count = await sendTrialExpiringReminders();
    return res.json({ sent: count });
  } catch (err) {
    console.error('[cron] Trial reminder error:', err);
    return res.status(500).json({ error: 'Trial reminders failed' });
  }
});

export default router;
