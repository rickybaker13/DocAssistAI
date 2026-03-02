# DocAssist Scribe — Enterprise Email Communication Requirements

**Date:** 2026-03-02  
**Status:** Draft implementation guide

## Why this exists

To ship production-grade authentication and customer communications, DocAssist Scribe needs more than registration/login email support. This document defines the minimum enterprise-safe email program for healthcare SaaS.

## Required transactional emails (Phase 1)

1. **Password reset request**
   - Trigger: user submits forgot-password form.
   - Security: send generic success response regardless of account existence.
   - UX: clear expiration notice and support contact.

2. **Password reset confirmation**
   - Trigger: successful password update.
   - Security: include timestamp/IP fingerprint summary when possible.
   - Action: include “Contact support immediately” path for fraudulent resets.

3. **New sign-in alert (optional but strongly recommended)**
   - Trigger: first login from new browser/device profile.
   - Security: helps early account takeover detection.

## Operational emails needed for enterprise readiness (Phase 2)

1. **Email verification / domain verification**
   - Establishes identity proofing and reduces typo/fraud accounts.

2. **MFA enrollment and backup code notices**
   - Required by many enterprise security questionnaires.

3. **Admin/organization invites and role changes**
   - Invite accepted, role promoted/demoted, workspace access revoked.

4. **Billing/compliance notices**
   - Failed payment, renewal, invoice delivery, contract changes.

5. **Security and trust notifications**
   - API key created/revoked, suspicious login, policy updates, BAA updates.

6. **Data lifecycle notifications**
   - Export complete, deletion requested, deletion complete.

## Competitor baseline (from current DocAssist competitor research)

The current competitive landscape in this repository shows these products emphasize enterprise workflows, EHR integrations, and multi-channel deployment:

- Commure Scribe
- Nabla
- Suki
- Nuance DAX Copilot
- Abridge
- DeepScribe

Implication for DocAssist: to compete in enterprise procurement, email communication maturity must extend beyond password reset into security, access governance, and billing/compliance messaging.

## Delivery and compliance checklist

- Verified sender domain (`docassistai.app`) with SPF, DKIM, DMARC.
- Dedicated transactional subdomain (e.g., `notify.docassistai.app`).
- Suppression handling (bounces/complaints/unsub where applicable).
- Structured audit logging for each outbound transactional email event.
- Template versioning and approval flow.
- Security copy review for anti-phishing clarity.

## Recommendation

- **Now:** ship password reset immediately.
- **Next:** add password-reset confirmation + login alerts.
- **Then:** implement verification, MFA, and org-role workflow emails as part of enterprise readiness.
