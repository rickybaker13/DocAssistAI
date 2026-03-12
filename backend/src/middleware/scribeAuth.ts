import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getPool } from '../database/db.js';

declare global {
  namespace Express {
    interface Request { scribeUserId?: string; }
  }
}

export async function scribeAuthMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.cookies?.scribe_token;
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    const secret = process.env.JWT_SECRET || 'dev-secret-change-in-production';
    const payload = jwt.verify(token, secret) as { userId: string; iat?: number };
    req.scribeUserId = payload.userId;

    // Check token revocation — reject tokens issued before password change
    if (payload.iat) {
      const result = await getPool().query(
        'SELECT token_invalidated_at FROM scribe_users WHERE id = $1',
        [payload.userId],
      );
      const user = result.rows[0];
      if (user?.token_invalidated_at) {
        const invalidatedAtSec = Math.floor(new Date(user.token_invalidated_at).getTime() / 1000);
        if (payload.iat < invalidatedAtSec) {
          res.status(401).json({ error: 'Session invalidated — please log in again' });
          return;
        }
      }
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
