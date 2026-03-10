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

export default router;
