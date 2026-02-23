import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ScribeUserModel } from '../models/scribeUser.js';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';

const router = Router();
const userModel = new ScribeUserModel();
const getSecret = () => process.env.JWT_SECRET || 'dev-secret-change-in-production';
const COOKIE = 'scribe_token';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// POST /api/scribe/auth/register
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, name, specialty } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' }) as any;
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' }) as any;
  if (userModel.findByEmail(email)) return res.status(409).json({ error: 'Email already registered' }) as any;

  const passwordHash = await bcrypt.hash(password, 12);
  const user = userModel.create({ email, passwordHash, name, specialty });
  const token = jwt.sign({ userId: user.id }, getSecret(), { expiresIn: '7d' });
  res.cookie(COOKIE, token, COOKIE_OPTS);
  return res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty } });
});

// POST /api/scribe/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, password, rememberMe } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' }) as any;
  const user = userModel.findByEmail(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: 'Invalid credentials' }) as any;
  }
  const token = jwt.sign({ userId: user.id }, getSecret(), { expiresIn: rememberMe ? '30d' : '7d' });
  const maxAge = rememberMe ? 30 * 24 * 60 * 60 * 1000 : COOKIE_OPTS.maxAge;
  res.cookie(COOKIE, token, { ...COOKIE_OPTS, maxAge });
  return res.json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty } });
});

// GET /api/scribe/auth/me
router.get('/me', scribeAuthMiddleware, (req: Request, res: Response) => {
  const user = userModel.findById(req.scribeUserId!);
  if (!user) return res.status(404).json({ error: 'User not found' }) as any;
  return res.json({ user: { id: user.id, email: user.email, name: user.name, specialty: user.specialty } });
});

// POST /api/scribe/auth/logout
router.post('/logout', (_req: Request, res: Response) => {
  res.cookie(COOKIE, '', { ...COOKIE_OPTS, maxAge: 0 });
  return res.json({ ok: true });
});

export default router;
