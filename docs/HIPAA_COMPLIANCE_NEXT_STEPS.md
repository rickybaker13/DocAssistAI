# DocAssistAI — HIPAA Compliance Next Steps

_Last updated: 2026-02-27_

---

## 1. Business Associate Agreements (BAAs)

### Required BAAs

| Vendor | Why PHI Touches It | BAA Availability | Action |
|---|---|---|---|
| **AWS (Bedrock)** | LLM processes de-identified clinical text. Even scrubbed text contains diagnoses, treatments, and medications that may qualify as PHI in context. | AWS offers BAAs on all accounts — Bedrock is a HIPAA-eligible service. | Enable the AWS BAA in the AWS Management Console under **AWS Artifact > Agreements**. Accept the AWS BAA and the HIPAA Addendum. No cost. |
| **DigitalOcean** | Hosts Presidio (receives raw PHI for de-identification) and Whisper (receives raw audio of patient encounters). | DigitalOcean offers BAAs. Must be requested via support or account settings. | Request a BAA from DigitalOcean support or via the account compliance page. |
| **Railway** | Hosts the backend server — raw PHI (transcripts, note content, patient context) lives in memory during request processing. PostgreSQL stores user accounts. | Railway's BAA availability is unclear — investigate directly. | Contact Railway support to ask if they offer a BAA. **If not, plan migration to a HIPAA-eligible hosting provider** (AWS ECS/Fargate, GCP Cloud Run, or Azure Container Apps). |
| **Vercel** | `vercel.json` rewrites proxy all `/api/*` requests through Vercel's edge infrastructure, meaning raw PHI passes through Vercel servers in transit. | Vercel offers BAAs on **Enterprise plans only**. | Either upgrade to Vercel Enterprise and sign a BAA, **or** point the frontend directly to the Railway backend URL (bypassing the proxy) and handle CORS accordingly. |

### Conditionally Required BAAs

| Vendor | Condition | Action |
|---|---|---|
| **OpenAI** | Only if `WHISPER_API_URL` is ever unset in production, causing the Whisper fallback to send raw patient audio to OpenAI's cloud API. | As long as `WHISPER_API_URL` is set (self-hosted Whisper on DO), no OpenAI BAA is needed. Consider removing the fallback path entirely to eliminate risk. |
| **Anthropic (direct API)** | Only if `EXTERNAL_AI_TYPE` is switched from `bedrock` to `anthropic`. | Not needed while using Bedrock. If switching, Anthropic offers BAAs on certain plans. |

### NOT Required

| Vendor | Reason |
|---|---|
| **Microsoft (Presidio)** | Open-source software, self-hosted on your DigitalOcean droplet. No data leaves to Microsoft. |

---

## 2. Critical Security Gaps

### A. No Encryption in Transit: Railway ↔ DigitalOcean Droplet

**Risk:** Raw PHI (transcripts, clinical text, audio) is transmitted over **plaintext HTTP** between Railway and the DigitalOcean droplet. This is a direct HIPAA violation (45 CFR 164.312(e)(1) — Transmission Security).

**Current state:**
```
PRESIDIO_ANALYZER_URL=http://159.203.87.97:5002     # ← HTTP, not HTTPS
PRESIDIO_ANONYMIZER_URL=http://159.203.87.97:5001   # ← HTTP, not HTTPS
WHISPER_API_URL=http://159.203.87.97:9000            # ← HTTP, not HTTPS
```

**Fix options (pick one):**
1. **Nginx reverse proxy + Let's Encrypt** — Add a domain (e.g., `services.docassistai.app`), install Nginx on the droplet with a TLS cert, proxy to Docker containers internally. Change Railway env vars to `https://services.docassistai.app`.
2. **WireGuard VPN tunnel** — Private encrypted tunnel between Railway and the droplet. More complex but avoids needing a domain/cert.
3. **Caddy reverse proxy** — Simpler than Nginx, auto-provisions TLS certs.

**Priority: CRITICAL — must fix before handling real patient data.**

### B. Audit Logs Lost on Container Restart

**Risk:** Audit logs are written to the local filesystem (`./logs/audit.log`) via Winston. Railway containers are ephemeral — logs are destroyed on every deploy or restart. HIPAA requires 6-year retention (45 CFR 164.530(j)).

**Fix:** Send audit logs to a durable, tamper-evident destination:
- Railway's built-in log drain → external log service
- Direct to a managed service: AWS CloudWatch, Datadog, or Papertrail
- Write audit events to the PostgreSQL database (simplest — already have a DB)

### C. Hardcoded Fallback JWT Secret

**Risk:** `scribeAuth.ts` line 10 falls back to `'dev-secret-change-in-production'` if `JWT_SECRET` is unset. Anyone who finds this string can forge auth tokens.

```typescript
const getSecret = () => process.env.JWT_SECRET || 'dev-secret-change-in-production';
```

**Fix:** Hard-fail in production if `JWT_SECRET` is missing:
```typescript
const getSecret = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  return secret || 'dev-secret-change-in-production';
};
```

### D. SSL Certificate Validation Disabled

**Risk:** Database connection uses `rejectUnauthorized: false`, making it vulnerable to MITM attacks.

```typescript
const ssl = process.env.DATABASE_URL ? { rejectUnauthorized: false } : undefined;
```

**Fix:** Use Railway's provided CA certificate, or at minimum document why this is acceptable for the Railway internal network.

---

## 3. High-Priority Gaps

### E. No Multi-Factor Authentication (MFA)

HIPAA recommends MFA for PHI access (45 CFR 164.312(d) — Person or Entity Authentication). Current auth is email + password only.

**Fix:** Add TOTP-based MFA (e.g., `otplib` or `speakeasy` npm packages) or integrate an auth provider that supports MFA (Auth0, AWS Cognito).

### F. No Token Revocation / Session Invalidation

JWTs are self-contained with 7-day or 30-day expiry. No ability to:
- Revoke a compromised token
- Force logout on password change
- "Logout all devices"

**Fix:** Add a server-side session table or token blocklist. On logout/password change, invalidate all active tokens.

### G. No Automatic Session Timeout

No idle timeout — sessions last the full JWT lifetime (7 or 30 days) regardless of activity. HIPAA requires automatic logoff after inactivity (45 CFR 164.312(a)(2)(iii)).

**Fix:** Add an idle timer on the frontend (e.g., 15–30 minutes of inactivity triggers logout). Optionally use short-lived JWTs with a refresh token pattern.

### H. No Password Reset / Change Flow

No endpoint for password change or email-based password reset. Users cannot recover from compromised credentials.

### I. Console.log May Leak PHI to Railway Logs

Several backend files (e.g., `aiService.ts`) log system prompt previews and request metadata via `console.log`. On Railway, this output goes to Railway's logging infrastructure, which may not be HIPAA-compliant.

**Fix:** Scrub or redact all `console.log` output that could contain clinical content. Use structured logging with explicit PHI-free fields.

---

## 4. Moderate Gaps

| Gap | Description | Fix |
|---|---|---|
| **No RBAC** | Single user role — no admin vs. clinician distinction, no "need to know" access control. | Add role column to `scribe_users`, enforce in middleware. |
| **No data retention policy** | No automatic deletion of old data, no patient data deletion capability. | Define retention periods, add cleanup jobs. |
| **No backup / disaster recovery plan** | No documented DB backup procedure. Railway PostgreSQL may have built-in backups — verify. | Document backup strategy, test restores. |
| **OpenAI Whisper fallback** | If `WHISPER_API_URL` is ever unset, raw patient audio goes to OpenAI cloud without a BAA. | Remove the fallback code path or gate it behind an explicit opt-in env var. |
| **Frontend stores patient IDs in sessionStorage** | Accessible to any JS on the same origin (XSS risk). | Minimize client-side PHI storage; use server-side session state. |

---

## 5. What's Already Done (Strengths)

These measures are already implemented and working:

- **Presidio-based PII de-identification** — All text scrubbed before every LLM call
- **Fail-closed design** — 503 returned if Presidio is unreachable; LLM never called
- **Custom HIPAA recognizers** — MRN, DOB, health plan numbers, ages > 89
- **Request-scoped substitution maps** — Never persisted, never logged
- **bcrypt password hashing** (cost factor 12)
- **HttpOnly + Secure cookies** in production
- **CORS whitelisting** — Only configured frontend origins allowed
- **Helmet.js security headers**
- **Rate limiting** — Global and per-endpoint
- **Audit logging middleware** — Logs PHI access, AI usage, auth events (needs durable storage)
- **Self-hosted Whisper and Presidio** — PHI stays on infrastructure you control
- **UFW firewall on droplet** — Only SSH + service ports exposed

---

## 6. Recommended Priority Order

1. **Sign AWS BAA** — Free, takes 5 minutes in AWS Artifact
2. **Request DigitalOcean BAA** — Contact support
3. **Add TLS to droplet** (Nginx/Caddy + Let's Encrypt) — Fixes the HTTP plaintext gap
4. **Investigate Railway BAA** — Contact support; plan migration if unavailable
5. **Investigate Vercel BAA** — Enterprise plan, or remove the API proxy
6. **Fix JWT secret fallback** — Hard-fail in production
7. **Move audit logs to durable storage** — DB or external log service
8. **Add MFA** — TOTP-based
9. **Add session timeout + token revocation**
10. **Add password reset flow**
11. **Scrub console.log output**
12. **Remove OpenAI Whisper fallback** (or gate behind explicit opt-in)
