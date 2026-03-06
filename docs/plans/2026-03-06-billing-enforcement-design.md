# Billing Enforcement System Design

**Date:** 2026-03-06
**Status:** Approved

## Problem

After registration, users get a 7-day free trial (`subscription_status = 'trialing'`, `trial_ends_at = NOW() + 7 days`). However:

1. **No enforcement** — the backend never checks subscription status on API calls. Users can use the app indefinitely without paying.
2. **No recurring billing** — payments are one-time $20 charges. After `period_ends_at` passes, nothing happens.
3. **No frontend gate** — `ScribeAuthGuard` only checks authentication, not billing status.

## Approach

Server-side middleware + Square Card-on-File recurring billing. We manage the recurring logic ourselves using a daily cron job rather than Square's Subscriptions API (which requires catalog items, subscription plans, and webhook handling — overkill for a single $20/month plan).

## Subscription Lifecycle

```
Register → trialing (7 days)
  ├─ Pay before trial ends → active (30-day period)
  │   ├─ Auto-renew succeeds → active (period extended 30 days)
  │   ├─ Auto-renew fails → expired
  │   └─ Cancel → cancelled (access until period_ends_at, then expired)
  ├─ Trial expires without payment → expired
  └─ Cancel during trial → cancelled (access until trial_ends_at)
```

## Components

### 1. Subscription Middleware (`scribeSubscriptionMiddleware`)

Runs after `scribeAuthMiddleware` on all protected routes **except** auth and billing endpoints (users must be able to log in, view billing status, and make payments when expired).

Logic:
- `active` → check `period_ends_at`: not expired = allow; expired = set `expired`, return 402
- `trialing` → check `trial_ends_at`: not expired = allow; expired = set `expired`, return 402
- `cancelled` → check `period_ends_at`: not expired = allow; expired = set `expired`, return 402
- `expired` → return 402

402 response body: `{ error: 'Subscription expired', code: 'SUBSCRIPTION_EXPIRED' }`

### 2. Database Changes

New columns on `scribe_users`:
- `square_customer_id TEXT` — Square Customer ID for recurring charges
- `square_card_id TEXT` — Square Card on File ID

New table `scribe_payment_history`:
- `id TEXT PRIMARY KEY`
- `user_id TEXT REFERENCES scribe_users(id)`
- `square_payment_id TEXT` — Square payment ID
- `amount_cents INTEGER NOT NULL`
- `status TEXT NOT NULL` — completed, failed, refunded
- `failure_reason TEXT` — Square error message on failure
- `created_at TIMESTAMPTZ DEFAULT NOW()`

### 3. Square Card-on-File Flow

When a user makes their first payment:
1. Create Square Customer (`POST /v2/customers`) with user's email
2. Process payment as today (with `sourceId`)
3. Store card on file (`POST /v2/cards`) using the `sourceId` + `customer_id`
4. Save `square_customer_id` and `square_card_id` to `scribe_users`

On subsequent payments (method change):
1. Delete old card from Square, create new one
2. Update `square_card_id`

### 4. Auto-Renewal Cron Job

Daily cron (Vercel cron or similar) at midnight UTC:

```
Find users WHERE:
  subscription_status = 'active'
  AND period_ends_at <= NOW() + INTERVAL '1 day'
  AND square_card_id IS NOT NULL
  AND cancelled_at IS NULL

For each user:
  Charge $20 via Square (POST /v2/payments with customer_id + source = card_id)
  Success → extend period_ends_at by 30 days, log payment
  Failure → set subscription_status = 'expired', log failure, email user
```

### 5. Frontend 402 Handler

Global fetch interceptor on the frontend:
- On any 402 response → redirect to `/scribe/account?expired=true`
- Account page detects `?expired=true` and shows prominent banner

### 6. Account Page Updates

- Status badge: "Trial (X days left)" / "Active (renews DATE)" / "Expired"
- When expired: prominent CTA to pay, payment form front and center
- Show stored payment method if card on file exists
- "Update payment method" option to replace stored card

### 7. Email Notifications

Three actionable emails only:
- **3 days before trial expires**: "Your trial is ending soon — add a payment method to keep using DocAssistAI"
- **Trial/subscription expired**: "Your access has expired — add a payment method to continue"
- **Payment failed on auto-renewal**: "We couldn't charge your card — update your payment method to restore access"

No "subscription renewed" email — unnecessary noise.

## File Map

### New Files
| File | Purpose |
|------|---------|
| `backend/src/middleware/scribeSubscription.ts` | Subscription enforcement middleware |
| `backend/src/services/billing/recurringBilling.ts` | Auto-renewal charge logic |
| `backend/src/services/billing/squareCustomer.ts` | Square Customer + Card on File management |
| `backend/src/routes/scribeCron.ts` | Cron endpoint for auto-renewal |
| `backend/src/models/scribePaymentHistory.ts` | Payment history model |
| `src/hooks/useSubscriptionGuard.ts` | Frontend 402 interceptor hook |

### Modified Files
| File | Change |
|------|--------|
| `backend/src/server.ts` | Add subscription middleware to protected routes, mount cron route |
| `backend/src/routes/scribeBilling.ts` | Create Square Customer + Card on File during payment |
| `backend/src/models/scribeUser.ts` | Add square_customer_id, square_card_id fields + methods |
| `backend/src/database/migrations.ts` | Add new columns + payment_history table |
| `src/components/scribe-standalone/ScribeAuthGuard.tsx` | Add 402 handling |
| `src/components/scribe-standalone/ScribeAccountPage.tsx` | Expired state UI, stored card display, status badges |
| `src/stores/scribeAuthStore.ts` | Add subscription status to store |

## What Stays The Same
- Registration flow (trial starts without requiring payment)
- Account page location for payment setup
- Square payment tokenization on frontend
- All 4 payment methods (Card, ACH, Apple Pay, Google Pay)
- $20/month pricing, 7-day trial
