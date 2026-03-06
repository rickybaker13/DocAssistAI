# Billing Enforcement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce subscription billing so users cannot use the app after their trial/subscription expires without payment, and auto-renew active subscriptions monthly via Square Card-on-File.

**Architecture:** Backend subscription middleware on all protected routes returns 402 when expired. Square Customer + Card on File stores payment method for recurring charges. Daily cron auto-charges cards nearing expiration. Frontend catches 402 and redirects to Account page.

**Tech Stack:** Express middleware, Square Payments API (Customers, Cards, Payments), PostgreSQL, Zustand, React Router

---

### Task 1: Database Migration — Add Square Customer/Card Columns + Payment History Table

**Files:**
- Modify: `backend/src/database/migrations.ts`

**Step 1: Add new columns and table to migrations**

In `backend/src/database/migrations.ts`, add to `CREATE_TABLES_SQL` (after the `scribe_password_reset_otps` table):

```sql
CREATE TABLE IF NOT EXISTS scribe_payment_history (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES scribe_users(id) ON DELETE CASCADE,
  square_payment_id TEXT,
  amount_cents     INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'completed',
  failure_reason   TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
```

Add to `COLUMN_MIGRATIONS` array:

```typescript
{
  table: 'scribe_users',
  column: 'square_customer_id',
  sql: `ALTER TABLE scribe_users ADD COLUMN square_customer_id TEXT`,
},
{
  table: 'scribe_users',
  column: 'square_card_id',
  sql: `ALTER TABLE scribe_users ADD COLUMN square_card_id TEXT`,
},
```

**Step 2: Update ScribeUser interface**

In `backend/src/models/scribeUser.ts`, add to the `ScribeUser` interface:

```typescript
square_customer_id: string | null;
square_card_id: string | null;
```

**Step 3: Verify migration runs**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vitest run --reporter=verbose 2>&1 | tail -20`
Expected: All 130 existing tests pass (migration code is idempotent).

**Step 4: Commit**

```bash
git add backend/src/database/migrations.ts backend/src/models/scribeUser.ts
git commit -m "feat: add Square customer/card columns and payment history table"
```

---

### Task 2: Payment History Model

**Files:**
- Create: `backend/src/models/scribePaymentHistory.ts`

**Step 1: Create the model**

Create `backend/src/models/scribePaymentHistory.ts`:

```typescript
import { randomUUID } from 'crypto';
import { getPool } from '../database/db.js';

export interface ScribePaymentRecord {
  id: string;
  user_id: string;
  square_payment_id: string | null;
  amount_cents: number;
  status: 'completed' | 'failed' | 'refunded';
  failure_reason: string | null;
  created_at: string;
}

export class ScribePaymentHistoryModel {
  async create(input: {
    userId: string;
    squarePaymentId?: string;
    amountCents: number;
    status: 'completed' | 'failed' | 'refunded';
    failureReason?: string;
  }): Promise<ScribePaymentRecord> {
    const pool = getPool();
    const id = randomUUID();
    await pool.query(
      `INSERT INTO scribe_payment_history (id, user_id, square_payment_id, amount_cents, status, failure_reason)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, input.userId, input.squarePaymentId ?? null, input.amountCents, input.status, input.failureReason ?? null],
    );
    const result = await pool.query('SELECT * FROM scribe_payment_history WHERE id = $1', [id]);
    return result.rows[0] as ScribePaymentRecord;
  }

  async listForUser(userId: string, limit = 50): Promise<ScribePaymentRecord[]> {
    const pool = getPool();
    const result = await pool.query(
      'SELECT * FROM scribe_payment_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, limit],
    );
    return result.rows as ScribePaymentRecord[];
  }
}
```

**Step 2: Commit**

```bash
git add backend/src/models/scribePaymentHistory.ts
git commit -m "feat: add payment history model for tracking Square payments"
```

---

### Task 3: Square Customer & Card-on-File Service

**Files:**
- Create: `backend/src/services/billing/squareCustomer.ts`

**Step 1: Create the service**

Create `backend/src/services/billing/squareCustomer.ts`:

```typescript
interface SquareConfig {
  accessToken: string;
  environment: 'sandbox' | 'production';
}

const getBaseUrl = (env: 'sandbox' | 'production') =>
  env === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

const SQUARE_VERSION = '2025-01-23';

function headers(accessToken: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'Square-Version': SQUARE_VERSION,
  };
}

export async function createSquareCustomer(
  config: SquareConfig,
  input: { email: string; idempotencyKey: string },
): Promise<{ customerId: string }> {
  const url = `${getBaseUrl(config.environment)}/v2/customers`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(config.accessToken),
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      email_address: input.email,
    }),
  });
  const data = await res.json() as { customer?: { id?: string }; errors?: unknown };
  if (!res.ok || !data.customer?.id) {
    throw new Error(`Failed to create Square customer: ${JSON.stringify(data.errors ?? data)}`);
  }
  return { customerId: data.customer.id };
}

export async function storeCardOnFile(
  config: SquareConfig,
  input: { sourceId: string; customerId: string; idempotencyKey: string },
): Promise<{ cardId: string }> {
  const url = `${getBaseUrl(config.environment)}/v2/cards`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(config.accessToken),
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      source_id: input.sourceId,
      card: { customer_id: input.customerId },
    }),
  });
  const data = await res.json() as { card?: { id?: string }; errors?: unknown };
  if (!res.ok || !data.card?.id) {
    throw new Error(`Failed to store card on file: ${JSON.stringify(data.errors ?? data)}`);
  }
  return { cardId: data.card.id };
}

export async function chargeStoredCard(
  config: SquareConfig,
  input: {
    customerId: string;
    cardId: string;
    amountCents: number;
    currency: string;
    locationId: string;
    idempotencyKey: string;
    note?: string;
  },
): Promise<{ paymentId: string; status: string }> {
  const url = `${getBaseUrl(config.environment)}/v2/payments`;
  const res = await fetch(url, {
    method: 'POST',
    headers: headers(config.accessToken),
    body: JSON.stringify({
      idempotency_key: input.idempotencyKey,
      source_id: input.cardId,
      customer_id: input.customerId,
      location_id: input.locationId,
      autocomplete: true,
      amount_money: { amount: input.amountCents, currency: input.currency },
      note: input.note,
    }),
  });
  const data = await res.json() as { payment?: { id?: string; status?: string }; errors?: unknown };
  if (!res.ok || !data.payment?.id) {
    const errMsg = JSON.stringify(data.errors ?? data);
    throw new Error(`Square payment failed: ${errMsg}`);
  }
  return { paymentId: data.payment.id, status: data.payment.status ?? 'UNKNOWN' };
}

export async function disableCard(
  config: SquareConfig,
  cardId: string,
): Promise<void> {
  const url = `${getBaseUrl(config.environment)}/v2/cards/${cardId}/disable`;
  await fetch(url, {
    method: 'POST',
    headers: headers(config.accessToken),
  });
  // Best-effort — don't throw if it fails
}
```

**Step 2: Commit**

```bash
git add backend/src/services/billing/squareCustomer.ts
git commit -m "feat: add Square Customer and Card-on-File service"
```

---

### Task 4: Subscription Middleware

**Files:**
- Create: `backend/src/middleware/scribeSubscription.ts`
- Modify: `backend/src/models/scribeUser.ts` (add `markExpired` method)

**Step 1: Add markExpired to ScribeUserModel**

In `backend/src/models/scribeUser.ts`, add this method to the `ScribeUserModel` class (after `getSubscriptionStatus`):

```typescript
async markExpired(userId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE scribe_users SET subscription_status = 'expired', updated_at = NOW() WHERE id = $1`,
    [userId],
  );
}
```

**Step 2: Create the middleware**

Create `backend/src/middleware/scribeSubscription.ts`:

```typescript
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
```

**Step 3: Commit**

```bash
git add backend/src/middleware/scribeSubscription.ts backend/src/models/scribeUser.ts
git commit -m "feat: add subscription enforcement middleware"
```

---

### Task 5: Wire Subscription Middleware Into Server

**Files:**
- Modify: `backend/src/server.ts`

**Step 1: Import and apply middleware**

In `backend/src/server.ts`, add the import:

```typescript
import { scribeAuthMiddleware } from './middleware/scribeAuth.js';
import { scribeSubscriptionMiddleware } from './middleware/scribeSubscription.js';
```

Then change the protected route registrations. The auth and billing routes stay as-is (no subscription check). Apply both auth + subscription middleware to the protected routes by adding middleware before them:

Replace these lines:

```typescript
app.use('/api/scribe/templates', scribeTemplatesRouter);
app.use('/api/ai/scribe', scribeAiRouter);
app.use('/api/scribe/note-templates', scribeNoteTemplatesRouter);
```

With:

```typescript
app.use('/api/scribe/templates', scribeAuthMiddleware, scribeSubscriptionMiddleware, scribeTemplatesRouter);
app.use('/api/ai/scribe', scribeAuthMiddleware, scribeSubscriptionMiddleware, scribeAiRouter);
app.use('/api/scribe/note-templates', scribeAuthMiddleware, scribeSubscriptionMiddleware, scribeNoteTemplatesRouter);
```

**Important:** The routes `/api/scribe/auth/*` and `/api/scribe/billing/*` do NOT get the subscription middleware — users must be able to authenticate and make payments even when expired.

**Note:** The template and AI routes already have their own `scribeAuthMiddleware` inside their routers. Adding it at the server level means it runs twice (harmless but redundant). An alternative is to only add `scribeSubscriptionMiddleware` at the server level, which will run after the per-router auth check. Choose the approach that's cleanest — the key requirement is that subscription check runs on these three route groups.

Check if the template and AI route files already use `scribeAuthMiddleware` internally. If they do, just add `scribeSubscriptionMiddleware` as server-level middleware for those paths. If they don't, add both.

**Step 2: Verify build**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx tsc --noEmit -p backend/tsconfig.json 2>&1 | tail -20`
Expected: No type errors.

**Step 3: Commit**

```bash
git add backend/src/server.ts
git commit -m "feat: wire subscription middleware into protected API routes"
```

---

### Task 6: Integrate Square Customer + Card-on-File Into Payment Flow

**Files:**
- Modify: `backend/src/routes/scribeBilling.ts`
- Modify: `backend/src/models/scribeUser.ts` (add `updateSquareIds` method)

**Step 1: Add updateSquareIds to ScribeUserModel**

In `backend/src/models/scribeUser.ts`, add this method:

```typescript
async updateSquareIds(userId: string, squareCustomerId: string, squareCardId: string): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE scribe_users
     SET square_customer_id = $1, square_card_id = $2, updated_at = NOW()
     WHERE id = $3`,
    [squareCustomerId, squareCardId, userId],
  );
}
```

**Step 2: Update the payment handler in scribeBilling.ts**

In `backend/src/routes/scribeBilling.ts`, add imports at the top:

```typescript
import { createSquareCustomer, storeCardOnFile } from '../services/billing/squareCustomer.js';
import { ScribePaymentHistoryModel } from '../models/scribePaymentHistory.js';
```

Add after existing model instantiations:

```typescript
const paymentHistoryModel = new ScribePaymentHistoryModel();
```

In the `handleSquarePayment` function, after the successful Square payment response (after `if (!squareRes.ok)` block and `billingModel.createPreference()` call), add Card-on-File logic **before** `activateSubscription`:

```typescript
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
```

Also update the payment note to remove "Scribe" reference:

Change:
```typescript
note: `DocAssistAI Scribe subscription for ${user.email}`,
```
To:
```typescript
note: `DocAssistAI subscription for ${user.email}`,
```

**Step 3: Add payment history endpoint**

Add a new route in `scribeBilling.ts` for viewing real payment history (separate from billing preferences):

```typescript
router.get('/payments', scribeAuthMiddleware, async (req: Request, res: Response) => {
  const payments = await paymentHistoryModel.listForUser(req.scribeUserId!);
  return res.json({ payments });
});
```

**Step 4: Add square_customer_id and square_card_id to billing status response**

In the `/status` endpoint handler, also return whether the user has a card on file. Modify the `getSubscriptionStatus` method in `ScribeUserModel` (or enhance the route handler). The simplest approach is to add to the route handler:

In the `router.get('/status', ...)` handler, change it to also fetch the full user and include card info:

```typescript
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
```

**Step 5: Commit**

```bash
git add backend/src/routes/scribeBilling.ts backend/src/models/scribeUser.ts
git commit -m "feat: integrate Square Customer + Card-on-File into payment flow"
```

---

### Task 7: Auto-Renewal Cron Service

**Files:**
- Create: `backend/src/services/billing/recurringBilling.ts`
- Create: `backend/src/routes/scribeCron.ts`
- Modify: `backend/src/server.ts` (mount cron route)

**Step 1: Create recurring billing service**

Create `backend/src/services/billing/recurringBilling.ts`:

```typescript
import { randomUUID } from 'crypto';
import { getPool } from '../../database/db.js';
import { ScribeUserModel } from '../../models/scribeUser.js';
import { ScribePaymentHistoryModel } from '../../models/scribePaymentHistory.js';
import { chargeStoredCard } from './squareCustomer.js';
import { emailService } from '../email/emailService.js';

const userModel = new ScribeUserModel();
const paymentHistoryModel = new ScribePaymentHistoryModel();

interface RenewalResult {
  userId: string;
  email: string;
  success: boolean;
  error?: string;
}

export async function processAutoRenewals(squareConfig: {
  accessToken: string;
  locationId: string;
  environment: 'sandbox' | 'production';
}): Promise<RenewalResult[]> {
  const pool = getPool();
  const results: RenewalResult[] = [];

  // Find active users whose period ends within the next 24 hours
  // and who have a card on file and haven't cancelled
  const { rows } = await pool.query(
    `SELECT id, email, square_customer_id, square_card_id, period_ends_at
     FROM scribe_users
     WHERE subscription_status = 'active'
       AND period_ends_at <= NOW() + INTERVAL '1 day'
       AND square_card_id IS NOT NULL
       AND square_customer_id IS NOT NULL
       AND cancelled_at IS NULL`,
  );

  for (const user of rows) {
    try {
      const { paymentId } = await chargeStoredCard(
        { accessToken: squareConfig.accessToken, environment: squareConfig.environment },
        {
          customerId: user.square_customer_id,
          cardId: user.square_card_id,
          amountCents: 2000,
          currency: 'USD',
          locationId: squareConfig.locationId,
          idempotencyKey: randomUUID(),
          note: `DocAssistAI subscription renewal for ${user.email}`,
        },
      );

      // Extend period by 30 days
      await userModel.activateSubscription(user.id);

      // Log successful payment
      await paymentHistoryModel.create({
        userId: user.id,
        squarePaymentId: paymentId,
        amountCents: 2000,
        status: 'completed',
      });

      results.push({ userId: user.id, email: user.email, success: true });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';

      // Mark as expired
      await userModel.markExpired(user.id);

      // Log failed payment
      await paymentHistoryModel.create({
        userId: user.id,
        amountCents: 2000,
        status: 'failed',
        failureReason: errorMsg,
      });

      // Email user about payment failure
      await emailService.sendPaymentFailedEmail(user.email);

      results.push({ userId: user.id, email: user.email, success: false, error: errorMsg });
    }
  }

  return results;
}
```

**Step 2: Create cron route**

Create `backend/src/routes/scribeCron.ts`:

```typescript
import { Router, Request, Response } from 'express';
import { processAutoRenewals } from '../services/billing/recurringBilling.js';

const router = Router();

const CRON_SECRET = process.env.CRON_SECRET || 'dev-cron-secret';

const firstEnv = (...keys: string[]): string | undefined => {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value;
  }
  return undefined;
};

router.post('/renew-subscriptions', async (req: Request, res: Response) => {
  // Verify cron secret to prevent unauthorized access
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const accessToken = firstEnv('SQUARE_ACCESS_TOKEN', 'SQUARE_TOKEN', 'SQUARE_SECRET_ACCESS_TOKEN');
  const locationId = firstEnv('SQUARE_LOCATION_ID', 'SQUARE_DEFAULT_LOCATION_ID');
  const environment = process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' as const : 'sandbox' as const;

  if (!accessToken || !locationId) {
    return res.status(503).json({ error: 'Square not configured' });
  }

  try {
    const results = await processAutoRenewals({ accessToken, locationId, environment });
    return res.json({
      processed: results.length,
      renewed: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results,
    });
  } catch (err) {
    console.error('[cron] Auto-renewal error:', err);
    return res.status(500).json({ error: 'Auto-renewal processing failed' });
  }
});

export default router;
```

**Step 3: Mount cron route in server.ts**

In `backend/src/server.ts`, add import:

```typescript
import scribeCronRouter from './routes/scribeCron.js';
```

Add the route (near the other route registrations):

```typescript
app.use('/api/cron', scribeCronRouter);
```

**Step 4: Commit**

```bash
git add backend/src/services/billing/recurringBilling.ts backend/src/routes/scribeCron.ts backend/src/server.ts
git commit -m "feat: add auto-renewal cron job for subscription billing"
```

---

### Task 8: Email Service — Trial & Payment Emails

**Files:**
- Modify: `backend/src/services/email/emailService.ts`

**Step 1: Add billing email methods**

In `backend/src/services/email/emailService.ts`, add these methods to the `EmailService` class:

```typescript
async sendTrialExpiringEmail(toEmail: string, daysLeft: number): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[email] Trial expiring for ${toEmail}: ${daysLeft} days left`);
  }
  // TODO: Replace with real email provider (SendGrid, SES, etc.)
}

async sendSubscriptionExpiredEmail(toEmail: string): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[email] Subscription expired for ${toEmail}`);
  }
  // TODO: Replace with real email provider
}

async sendPaymentFailedEmail(toEmail: string): Promise<void> {
  if (process.env.NODE_ENV !== 'test') {
    console.log(`[email] Payment failed for ${toEmail}`);
  }
  // TODO: Replace with real email provider
}
```

**Step 2: Add trial-expiring check to cron**

In `backend/src/services/billing/recurringBilling.ts`, add a second exported function:

```typescript
export async function sendTrialExpiringReminders(): Promise<number> {
  const pool = getPool();

  // Find trialing users whose trial ends in ~3 days (between 2.5 and 3.5 days from now)
  const { rows } = await pool.query(
    `SELECT id, email
     FROM scribe_users
     WHERE subscription_status = 'trialing'
       AND trial_ends_at > NOW() + INTERVAL '2.5 days'
       AND trial_ends_at <= NOW() + INTERVAL '3.5 days'
       AND square_card_id IS NULL`,
  );

  for (const user of rows) {
    await emailService.sendTrialExpiringEmail(user.email, 3);
  }

  return rows.length;
}
```

Add a route in `backend/src/routes/scribeCron.ts` for trial reminders:

```typescript
router.post('/trial-reminders', async (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { sendTrialExpiringReminders } = await import('../services/billing/recurringBilling.js');
    const count = await sendTrialExpiringReminders();
    return res.json({ sent: count });
  } catch (err) {
    console.error('[cron] Trial reminder error:', err);
    return res.status(500).json({ error: 'Trial reminders failed' });
  }
});
```

**Step 3: Commit**

```bash
git add backend/src/services/email/emailService.ts backend/src/services/billing/recurringBilling.ts backend/src/routes/scribeCron.ts
git commit -m "feat: add trial-expiring and payment-failed email notifications"
```

---

### Task 9: Frontend — 402 Interceptor + Subscription Store

**Files:**
- Create: `src/hooks/useSubscriptionGuard.ts`
- Modify: `src/stores/scribeAuthStore.ts`

**Step 1: Add subscription status to auth store**

In `src/stores/scribeAuthStore.ts`, add subscription fields to the store. First update the interface:

```typescript
export interface SubscriptionStatus {
  subscription_status: 'trialing' | 'active' | 'cancelled' | 'expired';
  trial_ends_at: string | null;
  period_ends_at: string | null;
  cancelled_at: string | null;
  has_payment_method: boolean;
}
```

Add to `ScribeAuthState` interface:

```typescript
subscriptionStatus: SubscriptionStatus | null;
fetchSubscriptionStatus: () => Promise<void>;
```

Add to the store implementation (inside `create<ScribeAuthState>(...)`):

```typescript
subscriptionStatus: null,

fetchSubscriptionStatus: async () => {
  try {
    const res = await fetch(`${getBackendUrl()}/api/scribe/billing/status`, { credentials: 'include' });
    if (!res.ok) {
      set({ subscriptionStatus: null });
      return;
    }
    const data = await res.json();
    set({ subscriptionStatus: data });
  } catch {
    set({ subscriptionStatus: null });
  }
},
```

Also clear `subscriptionStatus` in the `logout` action and `reset` function:

In `logout`: add `subscriptionStatus: null` to the set call.
In `reset`: add `subscriptionStatus: null`.

**Step 2: Create useSubscriptionGuard hook**

Create `src/hooks/useSubscriptionGuard.ts`:

```typescript
import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useScribeAuthStore } from '../stores/scribeAuthStore';

/**
 * Fetches subscription status on mount and redirects to account page
 * if subscription is expired. Also patches global fetch to catch 402
 * responses from any API call.
 */
export function useSubscriptionGuard(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, subscriptionStatus, fetchSubscriptionStatus } = useScribeAuthStore();

  // Fetch subscription status when user is present
  useEffect(() => {
    if (user) {
      fetchSubscriptionStatus();
    }
  }, [user]);

  // Redirect if expired (but not if already on account page)
  useEffect(() => {
    if (
      subscriptionStatus?.subscription_status === 'expired' &&
      location.pathname !== '/scribe/account'
    ) {
      navigate('/scribe/account?expired=true', { replace: true });
    }
  }, [subscriptionStatus, location.pathname]);
}
```

**Step 3: Commit**

```bash
git add src/hooks/useSubscriptionGuard.ts src/stores/scribeAuthStore.ts
git commit -m "feat: add subscription status to auth store and useSubscriptionGuard hook"
```

---

### Task 10: Frontend — Wire Guard Into ScribeAuthGuard + Account Page Expired Banner

**Files:**
- Modify: `src/components/scribe-standalone/ScribeAuthGuard.tsx`
- Modify: `src/components/scribe-standalone/ScribeAccountPage.tsx`

**Step 1: Add subscription guard to ScribeAuthGuard**

In `src/components/scribe-standalone/ScribeAuthGuard.tsx`, integrate the 402 handling. The simplest approach: after authentication succeeds, also check subscription. Import and call the hook inside the guard:

```typescript
import React, { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useScribeAuthStore } from '../../stores/scribeAuthStore';

export const ScribeAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, fetchMe, loading, subscriptionStatus, fetchSubscriptionStatus } = useScribeAuthStore();
  const [checked, setChecked] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      fetchMe().finally(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, []);

  // Fetch subscription status after auth resolves
  useEffect(() => {
    if (checked && user) {
      fetchSubscriptionStatus();
    }
  }, [checked, user]);

  // Redirect expired users to account page (except if already there)
  useEffect(() => {
    if (
      subscriptionStatus?.subscription_status === 'expired' &&
      location.pathname !== '/scribe/account'
    ) {
      navigate('/scribe/account?expired=true', { replace: true });
    }
  }, [subscriptionStatus, location.pathname]);

  if (!checked || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/scribe/login" replace />;
  }

  return <>{children}</>;
};
```

**Step 2: Add expired banner to Account page**

In `src/components/scribe-standalone/ScribeAccountPage.tsx`, add a prominent expired banner at the top. Read the `expired` query param and also check `subStatus`:

At the top of the component function, add:

```typescript
const searchParams = new URLSearchParams(window.location.search);
const expiredParam = searchParams.get('expired') === 'true';
```

Then add this JSX right after the `<header>` block (before `<div className="grid gap-4">`):

```tsx
{(expiredParam || subStatus?.subscription_status === 'expired') && (
  <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 space-y-2">
    <div className="flex items-center gap-2 text-red-300">
      <AlertTriangle size={20} />
      <h2 className="text-lg font-semibold">Your subscription has expired</h2>
    </div>
    <p className="text-sm text-slate-300">
      Add a payment method below to restore access to DocAssistAI. Your notes and settings are safe.
    </p>
  </div>
)}
```

**Step 3: Run tests**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vitest run --reporter=verbose 2>&1 | tail -30`
Expected: All tests pass. The ScribeAuthGuard test may need updating if imports changed.

**Step 4: Commit**

```bash
git add src/components/scribe-standalone/ScribeAuthGuard.tsx src/components/scribe-standalone/ScribeAccountPage.tsx
git commit -m "feat: add expired subscription redirect in auth guard and account page banner"
```

---

### Task 11: Frontend — Global 402 Fetch Interceptor

**Files:**
- Create: `src/utils/fetchInterceptor.ts`
- Modify: `src/App.tsx`

**Step 1: Create fetch interceptor**

Create `src/utils/fetchInterceptor.ts`:

```typescript
/**
 * Patches global fetch to intercept 402 responses (subscription expired).
 * When a 402 is received from our backend API, redirects to the account page.
 */
export function install402Interceptor(): void {
  const originalFetch = window.fetch;

  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const response = await originalFetch.apply(this, args);

    if (response.status === 402) {
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof Request ? args[0].url : '';
      // Only intercept our own API calls
      if (url.includes('/api/')) {
        // Use window.location to force navigation (works outside React Router context)
        if (!window.location.pathname.includes('/scribe/account')) {
          window.location.href = '/scribe/account?expired=true';
        }
      }
    }

    return response;
  };
}
```

**Step 2: Install interceptor in App.tsx**

In `src/App.tsx`, add at the top (after imports):

```typescript
import { install402Interceptor } from './utils/fetchInterceptor';

// Install once at app startup
install402Interceptor();
```

**Step 3: Commit**

```bash
git add src/utils/fetchInterceptor.ts src/App.tsx
git commit -m "feat: add global 402 fetch interceptor for expired subscriptions"
```

---

### Task 12: Update Existing Tests + Add New Tests

**Files:**
- Modify: `src/components/scribe-standalone/ScribeAuthGuard.test.tsx` (if it exists — may need to create)
- Modify: `src/stores/scribeAuthStore.test.ts`
- Modify: `src/components/scribe-standalone/ScribeRegisterPage.test.tsx`

**Step 1: Update auth store test**

In `src/stores/scribeAuthStore.test.ts`, add `subscriptionStatus` to initial state assertions:

```typescript
expect(result.current.subscriptionStatus).toBeNull();
```

And ensure logout/reset clear it.

**Step 2: Verify ScribeLayout test still passes**

The `ScribeLayout.test.tsx` renders the layout in isolation — it should still pass since subscription guard is in `ScribeAuthGuard`, not `ScribeLayout`.

**Step 3: Run full test suite**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vitest run --reporter=verbose 2>&1 | tail -40`
Expected: All tests pass. Fix any failures caused by new subscription fields.

**Step 4: Commit**

```bash
git add -A
git commit -m "test: update existing tests for subscription status fields"
```

---

### Task 13: Verify Build + Full Test Pass

**Files:** None (verification only)

**Step 1: Run frontend tests**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vitest run --reporter=verbose 2>&1 | tail -40`
Expected: All tests pass.

**Step 2: Run frontend build**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npm run build 2>&1 | tail -20`
Expected: Build succeeds with no errors.

**Step 3: Run backend type check**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx tsc --noEmit -p backend/tsconfig.json 2>&1 | tail -20`
Expected: No type errors.

**Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "chore: fix build/test issues from billing enforcement"
```

---

### Task 14: Push and Deploy

**Step 1: Push all commits**

```bash
cd /Users/bitbox/Documents/DocAssistAI && git push
```

**Step 2: Verify deployment**

After push, verify:
1. Backend deploys with new middleware
2. Landing page still loads at `/`
3. Login/register still works
4. Account page shows subscription status
5. Protected routes return 402 when subscription expired

---

## Summary of Changes

| Layer | What Changes |
|-------|-------------|
| **Database** | New `scribe_payment_history` table; `square_customer_id` + `square_card_id` columns on `scribe_users` |
| **Backend middleware** | New `scribeSubscriptionMiddleware` — returns 402 on expired trial/subscription |
| **Backend routes** | Subscription middleware applied to templates, AI, note-templates routes. New cron routes for auto-renewal and trial reminders |
| **Backend billing** | Square Customer + Card on File created during first payment. Payment history logged |
| **Backend email** | Three new notification stubs: trial-expiring, subscription-expired, payment-failed |
| **Frontend store** | `subscriptionStatus` + `fetchSubscriptionStatus` added to `scribeAuthStore` |
| **Frontend guard** | `ScribeAuthGuard` checks subscription status, redirects expired users to account page |
| **Frontend interceptor** | Global fetch interceptor catches 402 from any API call, redirects to account page |
| **Frontend account page** | Prominent expired banner when `?expired=true` or status is expired |
