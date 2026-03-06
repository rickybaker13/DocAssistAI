import { randomUUID } from 'crypto';
import { Router, Request, Response } from 'express';
import { scribeAuthMiddleware } from '../middleware/scribeAuth.js';
import { ScribeBillingModel, PaymentMethod } from '../models/scribeBilling.js';
import { ScribeUserModel } from '../models/scribeUser.js';
import { createSquareCustomer, storeCardOnFile } from '../services/billing/squareCustomer.js';
import { ScribePaymentHistoryModel } from '../models/scribePaymentHistory.js';

const router = Router();
const billingModel = new ScribeBillingModel();
const userModel = new ScribeUserModel();
const paymentHistoryModel = new ScribePaymentHistoryModel();

const PHONE_RE = /^\+?[1-9]\d{7,14}$/;

const firstEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) {
      return value;
    }
  }

  return undefined;
};

const getSquareConfig = () => {
  const appId = firstEnv('SQUARE_WEB_APP_ID', 'SQUARE_APPLICATION_ID', 'SQUARE_APP_ID');
  const locationId = firstEnv('SQUARE_LOCATION_ID', 'SQUARE_DEFAULT_LOCATION_ID');
  const accessToken = firstEnv('SQUARE_ACCESS_TOKEN', 'SQUARE_TOKEN', 'SQUARE_SECRET_ACCESS_TOKEN');

  return {
    appId,
    locationId,
    accessToken,
    environment: process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox' as const,
  };
};

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
    ],
  });
});


router.get('/square-config', scribeAuthMiddleware, (_req: Request, res: Response) => {
  const { appId, locationId, accessToken, environment } = getSquareConfig();

  return res.json({
    appId: appId ?? null,
    locationId: locationId ?? null,
    accessTokenConfigured: Boolean(accessToken),
    environment,
    enabled: Boolean(appId && locationId && accessToken),
  });
});

const handleSquarePayment = async (req: Request, res: Response) => {
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

  const { accessToken: squareAccessToken, locationId: squareLocationId, environment: squareEnvironment } = getSquareConfig();

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
    note: `DocAssistAI subscription for ${user.email}`,
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

  // --- Square Customer + Card on File ---
  let squareCustomerId = user.square_customer_id;
  let squareCardId = user.square_card_id;

  const squareConfig = {
    accessToken: squareAccessToken,
    environment: squareEnvironment,
  };

  try {
    // Create Square Customer if we don't have one
    if (!squareCustomerId) {
      const customer = await createSquareCustomer(squareConfig, {
        email: user.email,
        idempotencyKey: `cust-${user.id}`,
      });
      squareCustomerId = customer.customerId;
    }

    // Store the card on file (replace existing if any)
    const card = await storeCardOnFile(squareConfig, {
      sourceId: sourceId,
      customerId: squareCustomerId,
      idempotencyKey: randomUUID(),
    });
    squareCardId = card.cardId;

    // Persist IDs to user record
    await userModel.updateSquareIds(user.id, squareCustomerId, squareCardId);
  } catch (err) {
    // Card-on-file is best-effort — payment already succeeded
    console.error('[billing] Failed to store card on file:', err);
  }

  // Log the payment
  await paymentHistoryModel.create({
    userId: req.scribeUserId!,
    squarePaymentId: squareData?.payment?.id ?? undefined,
    amountCents: 2000,
    status: 'completed',
  });

  // Activate subscription: set status to 'active' and extend period by 30 days
  await userModel.activateSubscription(req.scribeUserId!);

  return res.status(201).json({
    success: true,
    paymentId: squareData?.payment?.id ?? null,
    status: squareData?.payment?.status ?? null,
    message: 'Payment processed securely with Square.',
  });
};

router.post('/square-card-payment', scribeAuthMiddleware, handleSquarePayment);
router.post('/square-payment', scribeAuthMiddleware, handleSquarePayment);

const handleCheckoutRequest = async (req: Request, res: Response) => {
  const { paymentMethod, phone } = req.body as {
    paymentMethod?: PaymentMethod;
    phone?: string;
  };

  if (!paymentMethod || !['square_card', 'square_ach', 'square_apple_pay', 'square_google_pay'].includes(paymentMethod)) {
    return res.status(400).json({ error: 'Unsupported payment method' });
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
  });

  const checkoutTargets: Record<PaymentMethod, string | undefined> = {
    square_card: firstEnv('SQUARE_CHECKOUT_URL', 'SQUARE_WEBHOSTED_CHECKOUT_URL'),
    square_ach: process.env.SQUARE_ACH_CHECKOUT_URL,
    square_apple_pay: process.env.SQUARE_APPLE_PAY_CHECKOUT_URL,
    square_google_pay: process.env.SQUARE_GOOGLE_PAY_CHECKOUT_URL,
  };

  return res.status(201).json({
    preference,
    checkoutUrl: checkoutTargets[paymentMethod] ?? null,
    message: checkoutTargets[paymentMethod]
      ? 'Checkout link created. Redirect the user to this provider URL.'
      : 'Preference captured. Add provider checkout URLs in backend env vars to enable live checkout.',
  });
};

router.post('/checkout-request', scribeAuthMiddleware, handleCheckoutRequest);

// Backward-compatible endpoint for older account-page clients.
router.post('/webhosted-checkout-link', scribeAuthMiddleware, handleCheckoutRequest);

router.get('/status', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const user = await userModel.findById(req.scribeUserId!);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({
    subscription_status: user.subscription_status,
    trial_ends_at: user.trial_ends_at,
    period_ends_at: user.period_ends_at,
    cancelled_at: user.cancelled_at,
    has_payment_method: Boolean(user.square_card_id),
  });
});

router.post('/cancel', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const result = await userModel.cancelSubscription(req.scribeUserId!);
  if (!result.success) {
    return res.status(400).json({ error: result.error });
  }
  return res.json({
    success: true,
    cancelled_at: result.user?.cancelled_at ?? null,
    period_ends_at: result.user?.period_ends_at ?? null,
    message: result.user?.period_ends_at
      ? `Subscription cancelled. You have access until ${new Date(result.user.period_ends_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
      : 'Subscription cancelled.',
  });
});

router.get('/history', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const entries = await billingModel.listForUser(req.scribeUserId!);
  return res.json({ entries });
});

router.get('/payments', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const payments = await paymentHistoryModel.listForUser(req.scribeUserId!);
  return res.json({ payments });
});

export default router;
