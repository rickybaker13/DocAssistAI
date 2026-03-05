# DocAssistAI - Next Session TODO

> Created: March 5, 2026
> Context: Follow-up items after completing Square payment integration and subscription cancellation

---

## 1. Wire Up Additional Payment Methods (ACH, Apple Pay, Google Pay)

**Current state:** The billing options dropdown lists ACH, Apple Pay, Google Pay, and Bitcoin, but only Credit Card (Square) is fully wired end-to-end with the embedded card form. The others rely on hosted checkout URLs that aren't configured yet.

**What needs to happen:**
- Implement Square Web Payments SDK integration for **ACH (bank account)** payments
  - Square SDK supports ACH via `payments.ach()` method
  - Needs bank account linking flow (similar to card form but with account/routing fields)
- Implement **Apple Pay** via Square Web Payments SDK
  - Requires `payments.applePay()` — needs Apple Pay merchant verification
  - Only works on Safari/Apple devices — needs graceful fallback on other browsers
- Implement **Google Pay** via Square Web Payments SDK
  - Requires `payments.googlePay()` — needs Google Pay merchant ID
  - Works on Chrome and Android — needs graceful fallback
- **Remove Bitcoin** from the payment methods list
  - Square does not support Bitcoin as a recurring subscription payment method
  - Remove `square_bitcoin` from the `methods` array in `GET /api/scribe/billing/options`
  - Remove Bitcoin-related UI (network selector, lightning option) from `ScribeAccountPage.tsx`
  - Clean up `square_bitcoin` references in `handleCheckoutRequest` and related code

**Key files:**
- `backend/src/routes/scribeBilling.ts` — payment endpoints and options list
- `src/components/scribe-standalone/ScribeAccountPage.tsx` — billing method UI
- `src/components/scribe-standalone/SquareCardForm.tsx` — reference for SDK pattern (card form)
- New files needed: `SquareAchForm.tsx`, `SquareApplePayButton.tsx`, `SquareGooglePayButton.tsx`

**Reference:** Square Web Payments SDK docs: https://developer.squareup.com/docs/web-payments/overview

---

## 2. Rename PWA Label from "Scribe" to "DocAssist" (or "DocAI")

**Current state:** When installed as a PWA on iPhone, the app shows as "Scribe" on the home screen. The user wants it branded as "DocAssist", "DocAssistAI", or "DocAI" if the others are too long for the home screen icon.

**What needs to happen:**
- Update `public/manifest.webmanifest` (or `manifest.json`) — change `name` and `short_name` fields
  - `name`: "DocAssist Scribe" or "DocAssistAI"
  - `short_name`: "DocAssist" or "DocAI" (must be short enough for iOS home screen ~12 chars)
- Update `<title>` tag in `index.html` if it says "Scribe"
- Update any `<meta name="apple-mobile-web-app-title">` tag
- Check `<meta name="application-name">` tag
- Test on iPhone after deploying — user may need to delete and re-add the PWA to see the new name

**Key files:**
- `public/manifest.webmanifest` or `public/manifest.json`
- `index.html`
- Any PWA configuration in `vite.config.ts`

---

## 3. Social Media Marketing Campaign Pipeline

**Current state:** A social media marketing pipeline was built for skipurgatoryhouse.com that automates content creation and scheduling for Instagram, Facebook, Twitter/X, etc. DocAssistAI needs the same system.

**What needs to happen:**
- Review the skipurgatoryhouse.com social media pipeline implementation (in `/tmp/colorado-house`)
- Adapt it for DocAssistAI's target audience (healthcare professionals, medical scribes, clinicians)
- Set up:
  - Content generation (blog posts, tips, feature highlights)
  - Social media post creation with appropriate tone/branding
  - Scheduling pipeline for regular posting cadence
  - Platform integrations (Instagram, Facebook, Twitter/X, LinkedIn — LinkedIn is especially important for healthcare B2B)
- Consider healthcare-specific content angles:
  - HIPAA compliance messaging
  - Time-saving stats for clinicians
  - AI-assisted documentation benefits
  - Comparison with traditional medical scribing

**Reference:** skipurgatoryhouse.com social media pipeline implementation

---

## Recently Completed (for context)

- [x] Fixed Square Web Payments SDK integration (`await` on `payments()`)
- [x] Fixed duplicate card form rendering (initAttempted ref guard)
- [x] Implemented in-app subscription cancellation (replaced mailto link)
- [x] Added subscription lifecycle tracking (trialing/active/cancelled/expired)
- [x] Fixed snake_case field name mismatch in billing history API
- [x] Deployed frontend to Vercel + backend to DO droplet
