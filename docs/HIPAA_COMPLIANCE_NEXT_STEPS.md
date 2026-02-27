# DocAssistAI — HIPAA Compliance & Infrastructure Next Steps

_Last updated: 2026-02-27_

---

## Target Architecture: Consolidate onto DigitalOcean

Eliminate Railway entirely. Move the Express backend + PostgreSQL onto the existing DigitalOcean droplet (8 GB RAM / 4 vCPU) alongside Whisper and Presidio. Vercel serves static files only — no API proxy, no PHI transit.

```
Browser (Vercel — static only)          DO Droplet (8GB/4CPU)                  AWS
──────────────────────────────          ─────────────────────                  ───
        │                                       │
        │── POST audio ──── HTTPS ────────────▶ │
        │                                       │── localhost ──▶ Whisper → transcript
        │                                       │── localhost ──▶ Presidio → scrub
        │                                       │── HTTPS ─────▶ Bedrock (scrubbed text only)
        │                                       │◀─ HTTPS ───── Bedrock (AI response)
        │                                       │── re-inject real values (in-memory, never persisted)
        │◀──── structured note ── HTTPS ───────│
        │                                       │
        │── login/logout ── HTTPS ────────────▶ │  Express API
        │                                       │  PostgreSQL (user accounts, audit logs)
        │                                       │  Whisper (Docker)
        │                                       │  Presidio Analyzer + Anonymizer (Docker)
```

**Key properties:**
- Raw PHI (audio, transcripts, notes) never leaves the droplet until scrubbed
- Whisper + Presidio calls are `localhost` — zero network latency, no TLS needed internally
- Only scrubbed (de-identified) text reaches AWS Bedrock
- Vercel serves the React bundle only — no PHI touches Vercel infrastructure
- 2 vendors handle PHI: **DigitalOcean** (infrastructure) and **AWS** (scrubbed AI inference)

---

## 1. Business Associate Agreements (BAAs)

### Required (2 total)

| Vendor | Why | Action |
|---|---|---|
| **AWS** | Bedrock processes de-identified clinical text (diagnoses, treatments, medications — may qualify as PHI in context even after scrubbing). | Accept the AWS BAA in **AWS Console → AWS Artifact → Agreements**. Bedrock is a HIPAA-eligible service. Free, takes 5 minutes. |
| **DigitalOcean** | Hosts the entire backend: raw audio, transcripts, clinical notes, Presidio PII processing, user accounts, audit logs. | Request a BAA from DigitalOcean support or via the account compliance page. DO offers BAAs. |

### NOT Required

| Vendor | Why |
|---|---|
| **Railway** | Being eliminated — no PHI or infrastructure after migration. |
| **Vercel** | Serves static frontend assets only. No API proxy, no PHI transit. |
| **Microsoft** | Presidio is open-source, self-hosted. No data leaves to Microsoft. |
| **OpenAI** | Whisper fallback code path will be removed (see §3). Self-hosted Whisper only. |
| **Anthropic** | Using Bedrock (AWS handles the BAA). Direct API not used in production. |

---

## 2. Migration Plan: Railway → DigitalOcean

### Phase 1 — TLS & Reverse Proxy

Add Caddy (auto-provisions Let's Encrypt certs) to the droplet.

1. Point `api.docassistai.app` DNS to the droplet IP
2. Add Caddy to Docker Compose as the entry point
3. Caddy terminates TLS, reverse-proxies to internal services:
   - `/api/*` → Express backend (port 3000)
   - Whisper and Presidio remain internal-only (localhost, no external exposure)
4. Update UFW: open port 443, close ports 5001/5002/9000 from external access (Caddy handles ingress, services are localhost-only behind it)

### Phase 2 — PostgreSQL on the Droplet

1. Add PostgreSQL container to Docker Compose (or install natively)
   - Mount a Docker volume for data persistence
   - Enable DO automated droplet backups ($1.60/mo for weekly snapshots)
2. Migrate the `scribe_users` + related tables from Railway PostgreSQL
   - `pg_dump` from Railway → `psql` import on droplet
3. Update `DATABASE_URL` to point to `localhost:5432`
4. Remove `rejectUnauthorized: false` SSL hack — localhost connection doesn't need SSL

### Phase 3 — Express Backend on the Droplet

1. Add the backend as a Docker container in Compose (multi-stage build, already has a Dockerfile)
2. Environment variables: set `PRESIDIO_ANALYZER_URL=http://presidio-analyzer:3000`, `WHISPER_API_URL=http://whisper:9000`, etc. — Docker Compose internal networking, no public URLs
3. Caddy routes `/api/*` → `backend:3000`
4. Update CORS: allow `https://www.docassistai.app`
5. Verify health check: `GET https://api.docassistai.app/api/health`

### Phase 4 — Frontend Cutover

1. Update `appConfig.ts`: production `backendUrl` → `https://api.docassistai.app`
2. Remove the `/api/:path*` rewrite from `vercel.json`
3. Update cookie config: `SameSite=None; Secure=true` (cross-domain: Vercel → DO)
4. Test full flow: login → record audio → transcribe → AI analysis → structured note

### Phase 5 — Decommission Railway

1. Verify everything works on DO for 48+ hours
2. Export final Railway PostgreSQL backup as insurance
3. Delete Railway project
4. Remove Railway references from documentation

### Phase 6 — Deployment Pipeline

Replace Railway's auto-deploy with one of:
- **GitHub Actions**: on push to `main`, SSH into droplet, `git pull && docker compose up --build -d`
- **Simple webhook**: lightweight endpoint on the droplet that triggers rebuild
- **Manual**: `ssh root@droplet 'cd /opt/docassistai && git pull && docker compose up --build -d'`

---

## 3. Security Gaps to Fix (Priority Order)

### Critical — Before Handling Real Patient Data

| # | Gap | Fix | Effort |
|---|---|---|---|
| 1 | **Sign AWS BAA** | Accept in AWS Artifact → Agreements | 5 min |
| 2 | **Request DO BAA** | Contact DigitalOcean support | 1 day (wait) |
| 3 | **TLS on droplet** | Caddy + Let's Encrypt (part of migration Phase 1) | 1–2 hrs |
| 4 | **Hardcoded JWT secret fallback** | Hard-fail in production if `JWT_SECRET` is unset | 10 min |
| 5 | **Remove OpenAI Whisper fallback** | Delete the `callOpenAI` code path in `whisperService.ts`. Self-hosted only. Eliminates accidental PHI leak to OpenAI. | 15 min |
| 6 | **Audit logs to durable storage** | Write audit events to PostgreSQL instead of ephemeral filesystem. On the droplet the filesystem is persistent (unlike Railway), but DB storage is more queryable and easier to back up. | 2–4 hrs |
| 7 | **Scrub console.log output** | Remove or redact any `console.log` that could contain clinical content (system prompts, transcripts, note text). | 1–2 hrs |

### High Priority — Soon After Launch

| # | Gap | Fix | Effort |
|---|---|---|---|
| 8 | **Automatic session timeout** | Frontend idle timer (15–30 min inactivity → logout). Required by 45 CFR 164.312(a)(2)(iii). | 2–3 hrs |
| 9 | **MFA** | TOTP-based (e.g., `otplib`). HIPAA recommends for PHI access. | 1–2 days |
| 10 | **Token revocation** | Server-side session table or token blocklist. Force logout on password change. | 4–6 hrs |
| 11 | **Password reset flow** | Email-based reset with time-limited token. | 4–6 hrs |

### Moderate — As Product Matures

| # | Gap | Fix |
|---|---|---|
| 12 | **RBAC** | Add role column to `scribe_users`, enforce in middleware. |
| 13 | **Data retention policy** | Define retention periods, add cleanup jobs. |
| 14 | **Backup & disaster recovery plan** | Document backup strategy (DO snapshots + `pg_dump` cron), test restores. |

---

## 4. What's Already Done (Strengths)

- **Presidio-based PII de-identification** — All text scrubbed before every LLM call
- **Fail-closed design** — 503 returned if Presidio is unreachable; LLM never called
- **Custom HIPAA recognizers** — MRN, DOB, health plan numbers, ages > 89
- **Request-scoped substitution maps** — Never persisted, never logged
- **bcrypt password hashing** (cost factor 12)
- **HttpOnly + Secure cookies** in production
- **CORS whitelisting** — Only configured frontend origins allowed
- **Helmet.js security headers**
- **Rate limiting** — Global and per-endpoint
- **Audit logging middleware** — Logs PHI access, AI usage, auth events
- **Self-hosted Whisper and Presidio** — PHI stays on infrastructure you control
- **UFW firewall on droplet** — Only SSH + service ports exposed

---

## 5. Consolidated Cost Estimate (Post-Migration)

| Item | Monthly Cost |
|---|---|
| DigitalOcean Droplet (8GB / 4CPU) | ~$48 |
| DO automated backups | ~$1.60 |
| Vercel (free tier or Pro at $20) | $0–20 |
| AWS Bedrock (usage-based) | Variable |
| Domain (annual, amortized) | ~$1 |
| **Railway** | **$0 (eliminated)** |
| **Total infrastructure** | **~$50–70/mo + Bedrock usage** |
