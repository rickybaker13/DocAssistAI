import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request { scribeUserId?: string; }
  }
}

export function scribeAuthMiddleware(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.scribe_token;
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const payload = jwt.verify(token, secret) as { userId: string };
    req.scribeUserId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
