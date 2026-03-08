import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { ScribeUserModel } from '../models/scribeUser.js';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { emailService } from '../services/email/emailService.js';

const router = Router();
const userModel = new ScribeUserModel();
const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || 'dev-secret-change-in-production';
};
const COOKIE = 'scribe_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: (process.env.NODE_ENV === 'production' ? 'none' : 'lax') as 'none' | 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

router.post('/register', authLimiter, async (req: Request, res: Response) => {
  const { email, password, name, specialty } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' }) as any;
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Invalid email address' }) as any;
  if (password.length < MIN_PASSWORD_LENGTH) return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }) as any;
  if (await userModel.findByEmail(email)) return res.status(409).json({ error: 'Email already registered' }) as any;

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await userModel.create({ email, passwordHash, name, specialty });
  const token = jwt.sign({ userId: user.id }, getSecret(), { expiresIn: '7d' });
  res.cookie(COOKIE, token, COOKIE_OPTS);
  return res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty, is_admin: user.is_admin } });
});

router.post('/login', authLimiter, async (req: Request, res: Response) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' }) as any;
  const user = await userModel.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' }) as any;
  }
  const token = jwt.sign({ userId: user.id }, getSecret(), { expiresIn: rememberMe ? '30d' : '7d' });
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : COOKIE_OPTS.maxAge;
  res.cookie(COOKIE, token, { ...COOKIE_OPTS, maxAge });
  return res.json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty, is_admin: user.is_admin } });
});

router.post('/forgot-password', authLimiter, async (req: Request, res: Response) => {
  const { email } = req.body;
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Valid email address required' }) as any;
  }

  const user = await userModel.findByEmail(email);
  if (user) {
    const otp = await userModel.createPasswordResetOtp(user.id);
    await emailService.sendPasswordResetOtpEmail(user.email, otp);
  }

  return res.json({ ok: true, message: 'If an account exists for that email, a one-time code has been sent.' });
});

router.post('/reset-password', authLimiter, async (req: Request, res: Response) => {
  const { token, email, otp, password } = req.body;
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` }) as any;
  }

  let userId: string | null = null;
  if (typeof token === 'string' && token.trim()) {
    userId = await userModel.consumePasswordResetToken(token);
  } else {
    if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Valid email address required' }) as any;
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'A valid 6-digit OTP is required' }) as any;
    }
    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(400).json({ error: 'Reset code is invalid or expired' }) as any;
    }
    const validOtp = await userModel.consumePasswordResetOtp(user.id, otp);
    userId = validOtp ? user.id : null;
  }

  if (!userId) {
    return res.status(400).json({ error: 'Reset code is invalid or expired' }) as any;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await userModel.updatePassword(userId, passwordHash);

  return res.json({ ok: true });
});

router.get('/me', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user) return res.status(404).json({ error: 'User not found' }) as any;
  return res.json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty, is_admin: user.is_admin, billing_codes_enabled: user.billing_codes_enabled } });
});

router.patch('/profile', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const { name, specialty, billing_codes_enabled } = req.body;
  const user = await userModel.update(req.scribeUserId!, { name, specialty, billing_codes_enabled });
  if (!user) return res.status(404).json({ error: 'User not found' }) as any;
  return res.json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty, is_admin: user.is_admin, billing_codes_enabled: user.billing_codes_enabled } });
});

router.get('/consent-status', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const status = await userModel.getConsentStatus(req.scribeUserId!);
  if (!status) return res.status(404).json({ error: 'User not found' }) as any;
  return res.json(status);
});

router.post('/accept-terms', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const { tosVersion } = req.body;
  if (!tosVersion || typeof tosVersion !== 'string') {
    return res.status(400).json({ error: 'tosVersion is required' }) as any;
  }
  await userModel.acceptTerms(req.scribeUserId!, tosVersion);
  return res.json({ ok: true });
});

router.post('/logout', (_req: Request, res: Response) => {
  res.cookie(COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 });
  return res.json({ ok: true });
});

export default router;
