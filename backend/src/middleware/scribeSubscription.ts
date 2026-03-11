import { Request, Response, NextFunction } from 'express';
import { ScribeUserModel } from '../models/scribeUser.js';

const userModel = new ScribeUserModel();

export async function scribeSubscriptionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const userId = req.scribeUserId;
  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const user = await userModel.findById(userId);
  if (!user) {
    res.status(401).json({ error: 'User not found' });
    return;
  }

  const now = new Date();
  const status = user.subscription_status;

  if (status === 'expired') {
    res.status(402).json({ error: 'Subscription expired', code: 'SUBSCRIPTION_EXPIRED' });
    return;
  }

  if (status === 'trialing') {
    const trialEnd = user.trial_ends_at ? new Date(user.trial_ends_at) : null;
    if (trialEnd && now > trialEnd) {
      await userModel.markExpired(userId);
      res.status(402).json({ error: 'Subscription expired', code: 'SUBSCRIPTION_EXPIRED' });
      return;
    }
    next();
    return;
  }

  // Complimentary accounts — always allowed, no expiry check
  if (status === 'comp') {
    next();
    return;
  }

  if (status === 'active' || status === 'cancelled') {
    const periodEnd = user.period_ends_at ? new Date(user.period_ends_at) : null;
    if (periodEnd && now > periodEnd) {
      await userModel.markExpired(userId);
      res.status(402).json({ error: 'Subscription expired', code: 'SUBSCRIPTION_EXPIRED' });
      return;
    }
    next();
    return;
  }

  // Unknown status — block
  res.status(402).json({ error: 'Subscription expired', code: 'SUBSCRIPTION_EXPIRED' });
}
