import { randomUUID } from 'crypto';
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
      { id: 'square_ach', label: 'Bank account (ACH via Square)', type: 'bank' },
      { id: 'square_apple_pay', label: 'Apple Pay (Square)', type: 'wallet' },
      { id: 'square_google_pay', label: 'Google Pay (Square)', type: 'wallet' },
      { id: 'square_bitcoin', label: 'Bitcoin via Square (On-chain or Lightning)', type: 'crypto' },
    ],
  });
});


router.get('/square-config', scribeAuthMiddleware, (_req: Request, res: Response) => {
  const appId = process.env.SQUARE_WEB_APP_ID;
  const locationId = process.env.SQUARE_LOCATION_ID;
  const environment = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

  return res.json({
    appId: appId ?? null,
    locationId: locationId ?? null,
    environment,
    enabled: Boolean(appId && locationId),
  });
});

router.post('/square-card-payment', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const { sourceId, phone } = req.body as {
    sourceId?: string;
    phone?: string;
  };

  if (!sourceId) {
    return res.status(400).json({ error: 'Missing Square payment sourceId.' });
  }

  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Phone number must be in E.164 format (example: +14155551234)' });
  }

  const user = await userModel.findById(req.scribeUserId!);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
  const squareLocationId = process.env.SQUARE_LOCATION_ID;
  const squareEnvironment = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox';

  if (!squareAccessToken || !squareLocationId) {
    return res.status(503).json({
      error: 'Square card payments are not configured. Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID on backend.',
    });
  }

  const paymentBody = {
    source_id: sourceId,
    idempotency_key: randomUUID(),
    location_id: squareLocationId,
    autocomplete: true,
    amount_money: {
      amount: 2000,
      currency: 'USD',
    },
    note: `DocAssistAI Scribe subscription for ${user.email}`,
    buyer_email_address: user.email,
  };

  const squareUrl = squareEnvironment === 'production'
    ? 'https://connect.squareup.com/v2/payments'
    : 'https://connect.squareupsandbox.com/v2/payments';

  const squareRes = await fetch(squareUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${squareAccessToken}`,
      'Content-Type': 'application/json',
      'Square-Version': '2025-01-23',
    },
    body: JSON.stringify(paymentBody),
  });

  const squareData = (await squareRes.json()) as {
    errors?: unknown;
    payment?: {
      id?: string;
      status?: string;
    };
  };

  if (!squareRes.ok) {
    return res.status(502).json({
      error: 'Square declined or failed this payment.',
      details: squareData?.errors ?? squareData,
    });
  }

  await billingModel.createPreference({
    userId: req.scribeUserId!,
    email: user.email,
    phone,
    paymentMethod: 'square_card',
  });

  return res.status(201).json({
    success: true,
    paymentId: squareData?.payment?.id ?? null,
    status: squareData?.payment?.status ?? null,
    message: 'Payment processed securely with Square.',
  });
});

router.post('/checkout-request', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const { paymentMethod, phone, network } = req.body as {
    paymentMethod?: PaymentMethod;
    phone?: string;
    network?: string;
  };

  if (!paymentMethod || !['square_card', 'square_ach', 'square_apple_pay', 'square_google_pay', 'square_bitcoin'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Unsupported payment method' });
  }

  if (phone && !PHONE_RE.test(phone)) {
    return res.status(400).json({ error: 'Phone number must be in E.164 format (example: +14155551234)' });
  }

  if (network && !['bitcoin', 'lightning'].includes(network)) {
    return res.status(400).json({ error: 'Network must be either bitcoin or lightning' });
  }

  if (paymentMethod !== 'square_bitcoin' && network) {
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
    network: paymentMethod === 'square_bitcoin' ? network ?? 'bitcoin' : undefined,
  });

  const checkoutTargets: Record<PaymentMethod, string | undefined> = {
    square_card: process.env.SQUARE_CHECKOUT_URL,
    square_ach: process.env.SQUARE_ACH_CHECKOUT_URL,
    square_apple_pay: process.env.SQUARE_APPLE_PAY_CHECKOUT_URL,
    square_google_pay: process.env.SQUARE_GOOGLE_PAY_CHECKOUT_URL,
    square_bitcoin: process.env.SQUARE_BITCOIN_CHECKOUT_URL,
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
