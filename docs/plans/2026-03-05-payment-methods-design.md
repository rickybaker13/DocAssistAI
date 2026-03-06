# Payment Methods Integration Design

> Date: 2026-03-05
> Status: Approved
> Scope: Wire up ACH, Apple Pay, Google Pay via Square Web Payments SDK; remove Bitcoin

## Context

Only credit card payments are fully wired end-to-end. The billing options dropdown lists ACH, Apple Pay, Google Pay, and Bitcoin, but the latter three either show a "checkout URL not configured" message or do nothing. Bitcoin is being removed since Square doesn't support it as a recurring subscription payment method.

## Decisions

- **Approach:** Unified Square Web Payments SDK components (Approach 1)
- **ACH flow:** Button that opens Square's Plaid modal (not inline form)
- **Apple Pay:** Requires domain verification at `/.well-known/apple-developer-merchantid-domain-association` — owner will register sandbox domain in Square Developer Console
- **Square environment:** Still sandbox
- **Backend reuse:** All payment methods produce the same token format — the existing `POST /square-card-payment` endpoint processes them identically

## Architecture

```
Frontend Component  →  Square SDK tokenize()  →  POST /api/scribe/billing/square-payment
                                                        ↓
                                                  Square Payments API (v2/payments)
                                                        ↓
                                                  activateSubscription()
```

The backend endpoint accepts any Square `sourceId` token regardless of payment method. No backend payment-processing changes needed.

## New Frontend Components

### 1. SquareAchButton.tsx

- Renders a "Pay with Bank Account" button
- On click: `payments.ach()` → `ach.tokenize({ accountHolderName, intent: 'CHARGE', total: { amount: 2000, currencyCode: 'USD' } })`
- Opens Plaid modal for bank auth
- On success: sends token to backend via same endpoint as card
- Props: `phone`, `onSuccess`, `onError` (same as SquareCardForm)

### 2. SquareApplePayButton.tsx

- Checks device support: `payments.applePay(paymentRequest)` — if not supported, renders nothing
- Creates PaymentRequest: `{ countryCode: 'US', currencyCode: 'USD', total: { amount: '20.00', label: 'DocAssist Scribe' } }`
- On click: tokenizes → calls `verifyBuyer()` for SCA → sends to backend
- Graceful fallback: shows "Apple Pay is not available on this device" text

### 3. SquareGooglePayButton.tsx

- Same pattern as Apple Pay but with `payments.googlePay(paymentRequest)`
- Checks browser support, renders Google Pay button if available
- On click: tokenizes → `verifyBuyer()` → sends to backend
- Graceful fallback for unsupported browsers

## Account Page Changes (ScribeAccountPage.tsx)

Current: Always shows `SquareCardForm` when "Credit Card" is selected. Other methods show a "configure checkout URL" warning.

Updated:
- "Credit Card" → shows `SquareCardForm` (unchanged)
- "Bank Account (ACH)" → shows `SquareAchButton`
- "Apple Pay" → shows `SquareApplePayButton`
- "Google Pay" → shows `SquareGooglePayButton`
- Bitcoin option removed entirely from dropdown

Also remove:
- Bitcoin network selector UI
- Bitcoin-related state (`network`)
- Bitcoin checkout URL env var warning text

## Backend Changes (Minimal)

### scribeBilling.ts
- Remove `square_bitcoin` from the `/options` methods array
- Add endpoint alias: `POST /square-payment` (keep `/square-card-payment` for backward compat)
- Accept `paymentMethod` in the request body so billing preference records the correct method
- Remove Bitcoin from `handleCheckoutRequest` validation and `checkoutTargets`

### scribeBilling model (PaymentMethod type)
- Remove `'square_bitcoin'` from the union type

## Apple Pay Domain Verification

- Add file: `public/.well-known/apple-developer-merchantid-domain-association`
- Content provided by Square when you register the domain in Developer Console
- Manual step: Register `docassistai.app` in Square Developer Console → Apple Pay → Add Sandbox Domain

## Error Handling

Each component uses the same `onSuccess`/`onError` callback pattern as `SquareCardForm`:
- Device not supported → hide button or show message
- User cancelled auth → no error shown (silent)
- Bank auth failed → `onError("Bank authentication failed")`
- Payment declined → `onError("Payment failed")`
- Network error → `onError("Connection error")`

## Files Changed

| File | Change |
|------|--------|
| `src/components/scribe-standalone/SquareAchButton.tsx` | NEW — ACH payment button |
| `src/components/scribe-standalone/SquareApplePayButton.tsx` | NEW — Apple Pay button |
| `src/components/scribe-standalone/SquareGooglePayButton.tsx` | NEW — Google Pay button |
| `src/components/scribe-standalone/ScribeAccountPage.tsx` | Show correct component per method, remove Bitcoin |
| `backend/src/routes/scribeBilling.ts` | Remove Bitcoin from options, add method-agnostic endpoint |
| `backend/src/models/scribeBilling.ts` | Remove `square_bitcoin` from PaymentMethod type |
| `public/.well-known/apple-developer-merchantid-domain-association` | NEW — Apple Pay domain verification |

## Testing

- ACH: Use Square sandbox test bank credentials via Plaid sandbox
- Apple Pay: Requires HTTPS domain registered in Square sandbox console + Safari on Apple device
- Google Pay: Works in sandbox with test cards in Chrome
- Verify all three produce successful payments in Square Dashboard sandbox
- Verify subscription activates (status → active, period_ends_at set) for each method

## References

- [Square Web Payments SDK Overview](https://developer.squareup.com/docs/web-payments/overview)
- [ACH Bank Transfer Reference](https://developer.squareup.com/reference/sdks/web/payments/bank-payments)
- [Apple Pay Integration](https://developer.squareup.com/docs/web-payments/apple-pay)
- [Google Pay Integration](https://developer.squareup.com/docs/web-payments/google-pay)
- [Square Payments Quickstart Repo](https://github.com/square/web-payments-quickstart)
