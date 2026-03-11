import { Router, Request, Response, NextFunction } from 'express';
import { ScribeSignupTrackingModel } from '../models/scribeSignupTracking.js';
import { ScribeUserModel } from '../models/scribeUser.js';

const router = Router();
const trackingModel = new ScribeSignupTrackingModel();
const userModel = new ScribeUserModel();

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user?.is_admin) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
}

// GET / — List all signups with optional filters
router.get('/', requireAdmin, async (req: Request, res: Response) => {
  const { status, dateFrom, dateTo, search } = req.query as Record<string, string | undefined>;
  const records = await trackingModel.listAll({ status, dateFrom, dateTo, search });
  return res.json(records);
});

// GET /stats — Summary statistics
router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  const stats = await trackingModel.getStats();
  return res.json(stats);
});

// GET /export — CSV download
router.get('/export', requireAdmin, async (req: Request, res: Response) => {
  const { status, dateFrom, dateTo, search } = req.query as Record<string, string | undefined>;
  const records = await trackingModel.listAll({ status, dateFrom, dateTo, search });

  const headers = [
    'Email',
    'Name',
    'Specialty',
    'Signup Date',
    'Signup Source',
    'UTM Source',
    'UTM Medium',
    'UTM Campaign',
    'Referral Code',
    'Device Type',
    'Country',
    'Region',
    'Status',
    'Billing Cycle',
    'Payment Method',
    'Trial Ends',
    'Converted At',
    'Cancelled At',
    'Non-Conversion Reason',
    'Non-Conversion Detail',
  ];

  const escapeCsv = (val: string | null | undefined): string => {
    if (val == null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const formatDate = (val: string | null | undefined): string => {
    if (!val) return '';
    try { return new Date(val).toISOString(); } catch { return ''; }
  };

  const rows = records.map(r => [
    escapeCsv(r.email),
    escapeCsv(r.name),
    escapeCsv(r.specialty),
    formatDate(r.created_at),
    escapeCsv(r.signup_source),
    escapeCsv(r.utm_source),
    escapeCsv(r.utm_medium),
    escapeCsv(r.utm_campaign),
    escapeCsv(r.referral_code),
    escapeCsv(r.device_type),
    escapeCsv(r.ip_country),
    escapeCsv(r.ip_region),
    escapeCsv(r.subscription_status),
    escapeCsv(r.billing_cycle),
    escapeCsv(r.payment_method),
    formatDate(r.trial_ends_at),
    formatDate(r.converted_at),
    formatDate(r.cancelled_at),
    escapeCsv(r.non_conversion_reason),
    escapeCsv(r.non_conversion_detail),
  ].join(','));

  const csv = [headers.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="signup-tracking-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send(csv);
});

// POST /comp — Grant complimentary subscription by email
router.post('/comp', requireAdmin, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const target = await userModel.findByEmail(email.trim().toLowerCase());
  if (!target) {
    return res.status(404).json({ error: `No user found with email: ${email}` });
  }

  const updated = await userModel.grantComp(target.id);
  return res.json({
    message: `Complimentary access granted to ${email}`,
    user: { id: updated?.id, email: updated?.email, subscription_status: updated?.subscription_status },
  });
});

// DELETE /comp — Revoke complimentary subscription by email
router.delete('/comp', requireAdmin, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Email is required' });
  }

  const target = await userModel.findByEmail(email.trim().toLowerCase());
  if (!target) {
    return res.status(404).json({ error: `No user found with email: ${email}` });
  }

  if (target.subscription_status !== 'comp') {
    return res.status(400).json({ error: `User is not on a complimentary plan (current status: ${target.subscription_status})` });
  }

  const updated = await userModel.revokeComp(target.id);
  return res.json({
    message: `Complimentary access revoked for ${email}`,
    user: { id: updated?.id, email: updated?.email, subscription_status: updated?.subscription_status },
  });
});

// GET /comp — List all comp users
router.get('/comp', requireAdmin, async (_req: Request, res: Response) => {
  const { getPool } = await import('../database/db.js');
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, email, name, specialty, created_at
     FROM scribe_users
     WHERE subscription_status = 'comp'
     ORDER BY updated_at DESC`,
  );
  return res.json({ users: rows });
});

export default router;
