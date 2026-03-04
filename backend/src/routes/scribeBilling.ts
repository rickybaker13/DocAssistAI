import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { ScribeBillingModel, PaymentMethod } from '../models/scribeBilling.js';
import { ScribeUserModel } from '../models/scribeUser.js';

const router = Router();
const billingModel = new ScribeBillingModel();
const userModel = new ScribeUserModel();

const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

router.get('/options', scribeAuthMiddleware, (_req: Request, res: Response) => {
  return res.json({
    subscription: {
      monthlyPriceUsd: 20,
      trialDays: 7,
    },
    methods: [
      { id: 'square_card', label: 'Credit Card (Square)', type: 'card' },
      { id: 'bitcoin', label: 'Bitcoin (On-chain or Lightning)', type: 'crypto' },
    ],
  });
});

router.post('/checkout-request', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const { paymentMethod, phone, network } = req.body as {
    paymentMethod?: PaymentMethod;
    phone?: string;
    network?: string;
  };

  if (!paymentMethod || !['square_card', 'bitcoin'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Unsupported payment method' });
  }

  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Phone number must be in E.164 format (example: +14155551234)' });
  }

  if (network && !['bitcoin', 'lightning'].includes(network)) {
    return res.status(400).json({ error: 'Network must be either bitcoin or lightning' });
  }

  if (paymentMethod !== 'bitcoin' && network) {
    return res.status(400).json({ error: 'Network is only supported for Bitcoin payments' });
  }

  const user = await userModel.findById(req.scribeUserId!);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const preference = await billingModel.createPreference({
    userId: req.scribeUserId!,
    email: user.email,
    phone,
    paymentMethod,
    network: paymentMethod === 'bitcoin' ? network ?? 'bitcoin' : undefined,
  });

  const checkoutTargets: Record<PaymentMethod, string | undefined> = {
    square_card: process.env.SQUARE_CHECKOUT_URL,
    bitcoin: process.env.BITCOIN_CHECKOUT_URL,
  };

  return res.status(201).json({
    preference,
    checkoutUrl: checkoutTargets[paymentMethod] ?? null,
    message: checkoutTargets[paymentMethod]
      ? 'Checkout link created. Redirect the user to this provider URL.'
      : 'Preference captured. Add provider checkout URLs in backend env vars to enable live checkout.',
  });
});

router.get('/history', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const entries = await billingModel.listForUser(req.scribeUserId!);
  return res.json({ entries });
});

export default router;
