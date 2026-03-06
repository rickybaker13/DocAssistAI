# Payment Methods Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire up ACH, Apple Pay, and Google Pay as inline payment methods via Square Web Payments SDK, and remove all Bitcoin payment references.

**Architecture:** All three new payment methods use the same Square Web Payments SDK already loaded for card payments. Each produces a `sourceId` token that goes through the existing `POST /square-card-payment` backend endpoint (renamed to `/square-payment`). Changes are 90% frontend (3 new components, update 2 pages) and 10% backend cleanup (remove Bitcoin from types/options).

**Tech Stack:** React + TypeScript, Square Web Payments SDK (CDN), Express backend, Vitest + React Testing Library

---

### Task 1: Remove Bitcoin from Backend

**Files:**
- Modify: `backend/src/models/scribeBilling.ts:4`
- Modify: `backend/src/routes/scribeBilling.ts:43-48,160,168-174,186,189-194`

**Step 1: Update PaymentMethod type**

In `backend/src/models/scribeBilling.ts`, change line 4 from:

```typescript
export type PaymentMethod = 'square_card' | 'square_ach' | 'square_apple_pay' | 'square_google_pay' | 'square_bitcoin';
```

to:

```typescript
export type PaymentMethod = 'square_card' | 'square_ach' | 'square_apple_pay' | 'square_google_pay';
```

**Step 2: Update billing routes**

In `backend/src/routes/scribeBilling.ts`:

a) Remove Bitcoin from the `/options` methods array (line 48):
```typescript
// DELETE this line:
{ id: 'square_bitcoin', label: 'Bitcoin via Square (On-chain or Lightning)', type: 'crypto' },
```

b) Update `handleCheckoutRequest` validation (line 160) — remove `'square_bitcoin'`:
```typescript
if (!paymentMethod || !['square_card', 'square_ach', 'square_apple_pay', 'square_google_pay'].includes(paymentMethod)) {
```

c) Remove Bitcoin network validation (delete lines 168-174):
```typescript
// DELETE these lines:
if (network && !['bitcoin', 'lightning'].includes(network)) {
  return res.status(400).json({ error: 'Network must be either bitcoin or lightning' });
}

if (paymentMethod !== 'square_bitcoin' && network) {
  return res.status(400).json({ error: 'Network is only supported for Bitcoin payments' });
}
```

d) Remove Bitcoin from `createPreference` call (line 186) — remove network param:
```typescript
const preference = await billingModel.createPreference({
  userId: req.scribeUserId!,
  email: user.email,
  phone,
  paymentMethod,
});
```

e) Remove `square_bitcoin` from `checkoutTargets` (line 194):
```typescript
const checkoutTargets: Record<PaymentMethod, string | undefined> = {
  square_card: firstEnv('SQUARE_CHECKOUT_URL', 'SQUARE_WEBHOSTED_CHECKOUT_URL'),
  square_ach: process.env.SQUARE_ACH_CHECKOUT_URL,
  square_apple_pay: process.env.SQUARE_APPLE_PAY_CHECKOUT_URL,
  square_google_pay: process.env.SQUARE_GOOGLE_PAY_CHECKOUT_URL,
};
```

**Step 3: Add method-agnostic payment endpoint alias**

After the existing `square-card-payment` route, add:

```typescript
// Method-agnostic alias — all payment methods produce the same token type
router.post('/square-payment', scribeAuthMiddleware, /* same handler as square-card-payment */);
```

To avoid duplication, extract the handler into a named function first:
```typescript
const handleSquarePayment = async (req: Request, res: Response) => {
  // ... existing square-card-payment handler body ...
};

router.post('/square-card-payment', scribeAuthMiddleware, handleSquarePayment);
router.post('/square-payment', scribeAuthMiddleware, handleSquarePayment);
```

**Step 4: Build backend**

Run: `cd /Users/bitbox/Documents/DocAssistAI/backend && npm run build`
Expected: No errors

**Step 5: Commit**

```bash
git add backend/src/models/scribeBilling.ts backend/src/routes/scribeBilling.ts
git commit -m "refactor(billing): remove Bitcoin, add method-agnostic payment endpoint"
```

---

### Task 2: Update Window.Square Type Declaration

**Files:**
- Modify: `src/components/scribe-standalone/SquareCardForm.tsx:5-16`

**Step 1: Extend the Square type declaration**

The existing `Window.Square` type only declares `payments().card()`. Extend it to include ACH, Apple Pay, and Google Pay methods. Replace the `declare global` block:

```typescript
declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => Promise<SquarePayments>;
    };
  }
}

interface SquarePayments {
  card: () => Promise<SquareCard>;
  ach: () => Promise<SquareAch>;
  applePay: (paymentRequest: SquarePaymentRequest) => Promise<SquareDigitalWallet>;
  googlePay: (paymentRequest: SquarePaymentRequest) => Promise<SquareDigitalWallet>;
}

interface SquareCard {
  attach: (selector: string) => Promise<void>;
  destroy: () => Promise<void>;
  tokenize: () => Promise<SquareTokenResult>;
}

interface SquareAch {
  tokenize: (options: {
    accountHolderName: string;
    intent: 'CHARGE' | 'STORE';
    total: { amount: number; currencyCode: string };
  }) => Promise<SquareTokenResult>;
  destroy: () => Promise<void>;
}

interface SquareDigitalWallet {
  attach: (selector: string) => Promise<void>;
  destroy: () => Promise<void>;
  tokenize: () => Promise<SquareTokenResult>;
}

interface SquarePaymentRequest {
  countryCode: string;
  currencyCode: string;
  total: { amount: string; label: string };
}

interface SquareTokenResult {
  status: string;
  token?: string;
  errors?: Array<{ message?: string }>;
}
```

Move these interfaces to a shared file: `src/components/scribe-standalone/square-types.ts`

Then update `SquareCardForm.tsx` to import from it:
```typescript
import type { SquareTokenResult } from './square-types';
```

**Step 2: Commit**

```bash
git add src/components/scribe-standalone/square-types.ts src/components/scribe-standalone/SquareCardForm.tsx
git commit -m "refactor: extract Square SDK types to shared file"
```

---

### Task 3: Create SquareAchButton Component

**Files:**
- Create: `src/components/scribe-standalone/SquareAchButton.tsx`

**Step 1: Create the component**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { Building2 } from 'lucide-react';
import { getBackendUrl } from '../../config/appConfig';
import type { SquareConfigResponse } from './square-types';
import { ensureSquareSdkLoaded, fetchSquareConfig } from './square-helpers';

interface Props {
  phone: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const SquareAchButton: React.FC<Props> = ({ phone, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const initAttempted = useRef(false);
  const configRef = useRef<SquareConfigResponse | null>(null);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const init = async () => {
      try {
        const cfg = await fetchSquareConfig();
        if (!cfg?.enabled || !cfg.appId || !cfg.locationId) return;

        configRef.current = cfg;
        const env = cfg.environment === 'production' ? 'production' : 'sandbox';
        setEnabled(true);

        await ensureSquareSdkLoaded(env);
        if (!window.Square) throw new Error('Square SDK unavailable.');
        setReady(true);
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Unable to initialize ACH payments.');
      }
    };

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    if (!window.Square || !configRef.current) {
      onError('Square SDK is not ready.');
      return;
    }

    setLoading(true);
    try {
      const payments = await window.Square.payments(configRef.current.appId!, configRef.current.locationId!);
      const ach = await payments.ach();
      const tokenResult = await ach.tokenize({
        accountHolderName: 'Account Holder',
        intent: 'CHARGE',
        total: { amount: 2000, currencyCode: 'USD' },
      });

      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        const err = tokenResult.errors?.[0]?.message || 'Bank authentication failed.';
        onError(err);
        return;
      }

      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/square-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceId: tokenResult.token, phone: phone || undefined }),
      });

      const data = await res.json();
      if (!res.ok) {
        onError(data.error || 'ACH payment failed.');
        return;
      }

      onSuccess(data.message || 'Bank payment processed successfully.');
    } catch (error) {
      if ((error as any)?.message?.includes('cancelled')) return; // user closed Plaid modal
      onError(error instanceof Error ? error.message : 'ACH payment failed.');
    } finally {
      setLoading(false);
    }
  };

  if (!enabled) {
    return <p className="text-xs text-amber-300">Square ACH payments are not configured yet.</p>;
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
      <p className="text-xs text-slate-400">
        Click below to securely link your bank account via Plaid. Funds are debited directly — no card needed.
      </p>
      <button
        type="button"
        onClick={handlePay}
        disabled={!ready || loading}
        className="w-full rounded-lg bg-emerald-400 px-4 py-2 text-sm font-semibold text-slate-900 disabled:opacity-50 inline-flex items-center justify-center gap-2"
      >
        <Building2 size={16} />
        {loading ? 'Connecting to bank...' : 'Pay with bank account'}
      </button>
    </div>
  );
};
```

**Step 2: Extract shared helpers**

Create `src/components/scribe-standalone/square-helpers.ts` with the shared SDK loading logic and config fetching extracted from `SquareCardForm.tsx`:

```typescript
import { getBackendUrl } from '../../config/appConfig';
import type { SquareConfigResponse } from './square-types';

const SQUARE_SDK_SELECTOR = 'script[data-square-sdk="true"]';

const getSquareSdkUrl = (environment: 'sandbox' | 'production'): string => (
  environment === 'production'
    ? 'https://web.squarecdn.com/v1/square.js'
    : 'https://sandbox.web.squarecdn.com/v1/square.js'
);

export const ensureSquareSdkLoaded = async (environment: 'sandbox' | 'production'): Promise<void> => {
  const desiredSdkUrl = getSquareSdkUrl(environment);

  if (window.Square) return;

  const existingScript = document.querySelector<HTMLScriptElement>(SQUARE_SDK_SELECTOR);

  if (existingScript) {
    if (existingScript.src !== desiredSdkUrl) {
      existingScript.remove();
    } else {
      await new Promise<void>((resolve, reject) => {
        if (window.Square) { resolve(); return; }
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Failed to load Square SDK.')), { once: true });
      });
      return;
    }
  }

  const script = document.createElement('script');
  script.src = desiredSdkUrl;
  script.async = true;
  script.dataset.squareSdk = 'true';
  document.body.appendChild(script);

  await new Promise<void>((resolve, reject) => {
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Square SDK.'));
  });
};

export const fetchSquareConfig = async (): Promise<SquareConfigResponse | null> => {
  try {
    const res = await fetch(`${getBackendUrl()}/api/scribe/billing/square-config`, { credentials: 'include' });
    if (!res.ok) return null;
    return (await res.json()) as SquareConfigResponse;
  } catch {
    return null;
  }
};
```

Then refactor `SquareCardForm.tsx` to import `ensureSquareSdkLoaded` and `fetchSquareConfig` from `square-helpers.ts` and delete its local copies.

**Step 3: Build and verify**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vite build`
Expected: No errors

**Step 4: Commit**

```bash
git add src/components/scribe-standalone/SquareAchButton.tsx \
        src/components/scribe-standalone/square-helpers.ts \
        src/components/scribe-standalone/SquareCardForm.tsx
git commit -m "feat(billing): add ACH bank payment component, extract shared Square helpers"
```

---

### Task 4: Create SquareApplePayButton Component

**Files:**
- Create: `src/components/scribe-standalone/SquareApplePayButton.tsx`

**Step 1: Create the component**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { getBackendUrl } from '../../config/appConfig';
import { ensureSquareSdkLoaded, fetchSquareConfig } from './square-helpers';
import type { SquareConfigResponse } from './square-types';

interface Props {
  phone: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const SquareApplePayButton: React.FC<Props> = ({ phone, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null); // null = checking
  const initAttempted = useRef(false);
  const walletRef = useRef<{ tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }>; destroy: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const init = async () => {
      try {
        const cfg = await fetchSquareConfig();
        if (!cfg?.enabled || !cfg.appId || !cfg.locationId) { setSupported(false); return; }

        const env = cfg.environment === 'production' ? 'production' : 'sandbox';
        await ensureSquareSdkLoaded(env);
        if (!window.Square) { setSupported(false); return; }

        const payments = await window.Square.payments(cfg.appId, cfg.locationId);
        const paymentRequest = {
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: '20.00', label: 'DocAssist Scribe' },
        };

        try {
          const applePay = await payments.applePay(paymentRequest);
          await applePay.attach('#apple-pay-button');
          walletRef.current = applePay;
          setSupported(true);
        } catch {
          // Device/browser doesn't support Apple Pay
          setSupported(false);
        }
      } catch {
        setSupported(false);
      }
    };

    init();

    return () => {
      if (walletRef.current) {
        walletRef.current.destroy().catch(() => {});
        walletRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    if (!walletRef.current) { onError('Apple Pay is not ready.'); return; }

    setLoading(true);
    try {
      const tokenResult = await walletRef.current.tokenize();
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        const err = tokenResult.errors?.[0]?.message || 'Apple Pay authorization failed.';
        onError(err);
        return;
      }

      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/square-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceId: tokenResult.token, phone: phone || undefined }),
      });

      const data = await res.json();
      if (!res.ok) { onError(data.error || 'Apple Pay payment failed.'); return; }

      onSuccess(data.message || 'Apple Pay payment processed successfully.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Apple Pay payment failed.');
    } finally {
      setLoading(false);
    }
  };

  if (supported === null) {
    return <p className="text-xs text-slate-500">Checking Apple Pay availability...</p>;
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-xs text-amber-300">
          Apple Pay is not available on this device or browser. Try using Safari on an Apple device, or select a different payment method.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
      <p className="text-xs text-slate-400">
        Complete your payment securely with Apple Pay.
      </p>
      <div id="apple-pay-button" className="min-h-12" onClick={handlePay} />
      {loading && <p className="text-xs text-slate-400">Processing Apple Pay...</p>}
    </div>
  );
};
```

**Step 2: Add Apple Pay domain verification placeholder**

Create `public/.well-known/apple-developer-merchantid-domain-association` with placeholder content:

```
# This file will be populated with Square's domain verification string
# after registering docassistai.app in the Square Developer Console.
# Steps: Square Dashboard > Developer > Apple Pay > Add Sandbox Domain
```

**Step 3: Commit**

```bash
git add src/components/scribe-standalone/SquareApplePayButton.tsx \
        public/.well-known/apple-developer-merchantid-domain-association
git commit -m "feat(billing): add Apple Pay component and domain verification placeholder"
```

---

### Task 5: Create SquareGooglePayButton Component

**Files:**
- Create: `src/components/scribe-standalone/SquareGooglePayButton.tsx`

**Step 1: Create the component**

```tsx
import React, { useEffect, useRef, useState } from 'react';
import { getBackendUrl } from '../../config/appConfig';
import { ensureSquareSdkLoaded, fetchSquareConfig } from './square-helpers';
import type { SquareConfigResponse } from './square-types';

interface Props {
  phone: string;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

export const SquareGooglePayButton: React.FC<Props> = ({ phone, onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const initAttempted = useRef(false);
  const walletRef = useRef<{ tokenize: () => Promise<{ status: string; token?: string; errors?: Array<{ message?: string }> }>; destroy: () => Promise<void> } | null>(null);

  useEffect(() => {
    if (initAttempted.current) return;
    initAttempted.current = true;

    const init = async () => {
      try {
        const cfg = await fetchSquareConfig();
        if (!cfg?.enabled || !cfg.appId || !cfg.locationId) { setSupported(false); return; }

        const env = cfg.environment === 'production' ? 'production' : 'sandbox';
        await ensureSquareSdkLoaded(env);
        if (!window.Square) { setSupported(false); return; }

        const payments = await window.Square.payments(cfg.appId, cfg.locationId);
        const paymentRequest = {
          countryCode: 'US',
          currencyCode: 'USD',
          total: { amount: '20.00', label: 'DocAssist Scribe' },
        };

        try {
          const googlePay = await payments.googlePay(paymentRequest);
          await googlePay.attach('#google-pay-button');
          walletRef.current = googlePay;
          setSupported(true);
        } catch {
          setSupported(false);
        }
      } catch {
        setSupported(false);
      }
    };

    init();

    return () => {
      if (walletRef.current) {
        walletRef.current.destroy().catch(() => {});
        walletRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePay = async () => {
    if (!walletRef.current) { onError('Google Pay is not ready.'); return; }

    setLoading(true);
    try {
      const tokenResult = await walletRef.current.tokenize();
      if (tokenResult.status !== 'OK' || !tokenResult.token) {
        const err = tokenResult.errors?.[0]?.message || 'Google Pay authorization failed.';
        onError(err);
        return;
      }

      const res = await fetch(`${getBackendUrl()}/api/scribe/billing/square-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ sourceId: tokenResult.token, phone: phone || undefined }),
      });

      const data = await res.json();
      if (!res.ok) { onError(data.error || 'Google Pay payment failed.'); return; }

      onSuccess(data.message || 'Google Pay payment processed successfully.');
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Google Pay payment failed.');
    } finally {
      setLoading(false);
    }
  };

  if (supported === null) {
    return <p className="text-xs text-slate-500">Checking Google Pay availability...</p>;
  }

  if (!supported) {
    return (
      <div className="rounded-xl border border-slate-700 bg-slate-950 p-4">
        <p className="text-xs text-amber-300">
          Google Pay is not available in this browser. Try using Chrome, or select a different payment method.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-700 bg-slate-950 p-4">
      <p className="text-xs text-slate-400">
        Complete your payment securely with Google Pay.
      </p>
      <div id="google-pay-button" className="min-h-12" onClick={handlePay} />
      {loading && <p className="text-xs text-slate-400">Processing Google Pay...</p>}
    </div>
  );
};
```

**Step 2: Commit**

```bash
git add src/components/scribe-standalone/SquareGooglePayButton.tsx
git commit -m "feat(billing): add Google Pay component"
```

---

### Task 6: Update ScribeAccountPage to Use New Components

**Files:**
- Modify: `src/components/scribe-standalone/ScribeAccountPage.tsx`

**Step 1: Add imports**

Add at top of file:
```typescript
import { SquareAchButton } from './SquareAchButton';
import { SquareApplePayButton } from './SquareApplePayButton';
import { SquareGooglePayButton } from './SquareGooglePayButton';
```

**Step 2: Remove Bitcoin from BillingMethod type and defaults**

Change the `BillingMethod` interface `id` union to remove `'square_bitcoin'`:
```typescript
id: 'square_card' | 'square_ach' | 'square_apple_pay' | 'square_google_pay';
```

Remove Bitcoin from `DEFAULT_BILLING_OPTIONS.methods`:
```typescript
// DELETE:
{ id: 'square_bitcoin', label: 'Bitcoin via Square (On-chain or Lightning)', type: 'crypto' },
```

**Step 3: Remove Bitcoin state and UI**

- Delete the `network` state: `const [network, setNetwork] = useState<'bitcoin' | 'lightning'>('bitcoin');`
- Delete the Bitcoin network selector JSX block (lines 361-373)
- Remove `network` from the `handleBillingUpdate` body
- Remove the Bitcoin checkout URL warning text referencing `SQUARE_BITCOIN_CHECKOUT_URL`

**Step 4: Show the correct component for each payment method**

Replace the single `SquareCardForm` conditional block with:

```tsx
{paymentMethod === 'square_card' && options.methods.some((m) => m.id === 'square_card') && (
  <div className="space-y-2">
    <p className="text-xs text-slate-400">
      Enter your card details below. Card number, CVV, and expiration are collected in Square's encrypted iframe.
    </p>
    <SquareCardForm
      phone={phone}
      onSuccess={(msg) => { setBillingMessage(msg); setError(null); }}
      onError={(msg) => { setError(msg); setBillingMessage(null); }}
    />
  </div>
)}

{paymentMethod === 'square_ach' && (
  <SquareAchButton
    phone={phone}
    onSuccess={(msg) => { setBillingMessage(msg); setError(null); }}
    onError={(msg) => { setError(msg); setBillingMessage(null); }}
  />
)}

{paymentMethod === 'square_apple_pay' && (
  <SquareApplePayButton
    phone={phone}
    onSuccess={(msg) => { setBillingMessage(msg); setError(null); }}
    onError={(msg) => { setError(msg); setBillingMessage(null); }}
  />
)}

{paymentMethod === 'square_google_pay' && (
  <SquareGooglePayButton
    phone={phone}
    onSuccess={(msg) => { setBillingMessage(msg); setError(null); }}
    onError={(msg) => { setError(msg); setBillingMessage(null); }}
  />
)}
```

**Step 5: Build and verify**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vite build`
Expected: No errors

**Step 6: Commit**

```bash
git add src/components/scribe-standalone/ScribeAccountPage.tsx
git commit -m "feat(billing): wire up ACH, Apple Pay, Google Pay on Account page, remove Bitcoin"
```

---

### Task 7: Update ScribeRegisterPage to Remove Bitcoin

**Files:**
- Modify: `src/components/scribe-standalone/ScribeRegisterPage.tsx`

**Step 1: Remove Bitcoin from PaymentMethod type**

Change line 8:
```typescript
type PaymentMethod = 'square_card' | 'square_ach' | 'square_apple_pay' | 'square_google_pay';
```

**Step 2: Remove Bitcoin option from select dropdown**

Delete: `<option value="square_bitcoin">Bitcoin via Square</option>`

**Step 3: Remove Bitcoin state and UI**

- Remove `network` from form state initial value
- Delete the Bitcoin network selector conditional block (lines 221-234)
- Remove `network` references from the form

**Step 4: Build and run existing tests**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vite build && npx vitest run src/components/scribe-standalone/ScribeRegisterPage.test.tsx`
Expected: Build succeeds, tests pass

**Step 5: Commit**

```bash
git add src/components/scribe-standalone/ScribeRegisterPage.tsx
git commit -m "chore: remove Bitcoin payment option from registration page"
```

---

### Task 8: Build, Push, and Deploy

**Step 1: Run full test suite**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vitest run`
Expected: All tests pass

**Step 2: Build both frontend and backend**

Run: `cd /Users/bitbox/Documents/DocAssistAI && npx vite build && cd backend && npm run build`
Expected: Both build with no errors

**Step 3: Push to GitHub**

Run: `cd /Users/bitbox/Documents/DocAssistAI && git push origin main`

This triggers Vercel auto-deploy for the frontend.

**Step 4: Deploy backend to DigitalOcean**

User runs on DO droplet:
```bash
cd /opt/docassistai && git pull origin main
docker compose -f infra/docker-compose.prod.yml build --no-cache backend
docker compose -f infra/docker-compose.prod.yml up -d --force-recreate backend
```

**Step 5: Verify in browser**

- Navigate to `https://www.docassistai.app/scribe/account`
- Hard refresh (Cmd+Shift+R) to clear service worker
- Verify payment method dropdown shows: Credit Card, Bank Account, Apple Pay, Google Pay (NO Bitcoin)
- Select "Bank Account" → verify ACH button renders
- Select "Apple Pay" → verify it shows availability check (may show "not available" depending on device)
- Select "Google Pay" → verify it shows availability check
- Select "Credit Card" → verify card form still works
