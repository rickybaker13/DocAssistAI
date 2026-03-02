import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { ScribeBillingModel, PaymentMethod } from '../models/scribeBilling.js';
import { ScribeUserModel } from '../models/scribeUser.js';

const router = Router();
const billingModel = new ScribeBillingModel();
const userModel = new ScribeUserModel();

const SUPPORTED_NETWORKS = ['ethereum', 'solana', 'avax', 'arbitrum'] as const;
type StablecoinNetwork = (typeof SUPPORTED_NETWORKS)[number];
const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

router.get('/options', scribeAuthMiddleware, (_req: Request, res: Response) => {
  return res.json({
    subscription: {
      monthlyPriceUsd: 20,
      trialDays: 7,
      bitcoinDiscountPercent: 15,
      bitcoinEffectivePriceUsd: 17,
    },
    methods: [
      { id: 'square_card', label: 'Credit Card (Square)', type: 'card' },
      { id: 'block_card', label: 'Credit Card (Block)', type: 'card' },
      { id: 'bitcoin', label: 'Bitcoin', type: 'crypto', discountPercent: 15 },
      { id: 'usdc', label: 'USDC', type: 'stablecoin', networks: SUPPORTED_NETWORKS },
      { id: 'usdt', label: 'USDT', type: 'stablecoin', networks: SUPPORTED_NETWORKS },
    ],
  });
});

router.post('/checkout-request', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const { paymentMethod, network, phone } = req.body as {
    paymentMethod?: PaymentMethod;
    network?: string;
    phone?: string;
  };

  if (!paymentMethod || !['square_card', 'block_card', 'bitcoin', 'usdc', 'usdt'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Unsupported payment method' });
  }

  if ((paymentMethod === 'usdc' || paymentMethod === 'usdt') && (!network || !SUPPORTED_NETWORKS.includes(network as StablecoinNetwork))) {
    return res.status(400).json({ error: 'Stablecoin payments require a supported network' });
  }

  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Phone number must be in E.164 format (example: +14155551234)' });
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
    network,
  });

  const checkoutTargets: Record<PaymentMethod, string | undefined> = {
    square_card: process.env.SQUARE_CHECKOUT_URL,
    block_card: process.env.BLOCK_CHECKOUT_URL,
    bitcoin: process.env.BITCOIN_CHECKOUT_URL,
    usdc: process.env.STABLECOIN_CHECKOUT_URL,
    usdt: process.env.STABLECOIN_CHECKOUT_URL,
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
