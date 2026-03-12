# DocAssistAI — IT Infrastructure

Comprehensive reference for the production hosting, networking, security, and operational configuration of DocAssistAI.

---

## Table of Contents

1. [Hosting & Deployment Architecture](#1-hosting--deployment-architecture)
2. [Ports & Services](#2-ports--services)
3. [Database](#3-database)
4. [Docker Services](#4-docker-services)
5. [Environment Variables](#5-environment-variables)
6. [Domain & DNS / Vercel Configuration](#6-domain--dns--vercel-configuration)
7. [Authentication](#7-authentication)
8. [External API Dependencies](#8-external-api-dependencies)
9. [SSL/TLS & Security](#9-ssltls--security)
10. [HIPAA / PII De-Identification](#10-hipaa--pii-de-identification)
11. [Rate Limiting](#11-rate-limiting)
12. [Node.js & Build Configuration](#12-nodejs--build-configuration)
13. [CI/CD & Deployment Flow](#13-cicd--deployment-flow)
14. [Health Checks & Monitoring](#14-health-checks--monitoring)
15. [Infrastructure Setup (DigitalOcean)](#15-infrastructure-setup-digitalocean)
16. [Data Retention & Automated Cleanup](#16-data-retention--automated-cleanup)
17. [Key Infrastructure Gotchas](#17-key-infrastructure-gotchas)

---

## 1. Hosting & Deployment Architecture

| Layer | Provider | URL / Host | Notes |
|-------|----------|------------|-------|
| **Frontend** | Vercel | `https://www.docassistai.app` | Auto-deploys on `git push`; no env vars needed |
| **Backend + All Services** | DigitalOcean Droplet | `https://api.docassistai.app` | All containers on one host behind Caddy reverse proxy |
| **Droplet IP** | DigitalOcean | `159.203.87.97` | Project path: `/opt/docassistai` |

### Local Development

| Service | Address |
|---------|---------|
| Frontend (Vite) | `http://localhost:8080` — `npm run dev` |
| Backend (Express) | `http://localhost:3000` — `cd backend && npm run dev` |
| Presidio / Whisper | Docker Compose on same ports as production |

---

## 2. Ports & Services

### Production (DO Droplet)

Only Caddy is exposed externally. All other services communicate over Docker's internal network.

| Service | External Port | Internal Port | Notes |
|---------|--------------|---------------|-------|
| Caddy (reverse proxy) | **80, 443** | — | Only externally-exposed ports; auto-TLS via Let's Encrypt |
| Backend (Express) | — | 3000 | Caddy proxies to `backend:3000` |
| PostgreSQL | — | 5432 | Internal only |
| Presidio Analyzer | — | 3000 | Internal only |
| Presidio Anonymizer | — | 3000 | Internal only |
| Whisper ASR (fallback) | — | 9000 | Internal only; used when Groq API unavailable |

### Development (Local)

| Service | Port | Notes |
|---------|------|-------|
| Frontend (Vite) | 8080 | `npm run dev` |
| Backend (Express) | 3000 | `cd backend && npm run dev` |
| Presidio Analyzer | 5002 → 3000 | Docker Compose |
| Presidio Anonymizer | 5001 → 3000 | Docker Compose |
| Whisper ASR | 9000 | Docker Compose (optional if using Groq) |

---

## 3. Database

| Property | Value |
|----------|-------|
| Engine | PostgreSQL 16 (Alpine) |
| Driver | `pg` (node-postgres) pool — `backend/src/database/db.ts` |
| Production | Docker container on DO droplet; `DATABASE_URL` set in `.env` |
| Development | Local PostgreSQL or `DATABASE_URL` env var |
| Testing | `pg-mem` in-memory (auto-selected when `NODE_ENV=test`) |
| SSL | Disabled in production (containers on same Docker network; `DATABASE_SSL=false`) |
| Migrations | `backend/src/database/migrations.ts` — `COLUMN_MIGRATIONS` pattern with idempotent guards |
| Data volume | `pgdata` Docker volume (persisted across container restarts) |

---

## 4. Docker Services

Defined in `infra/docker-compose.prod.yml`. A symlink at the project root (`docker-compose.prod.yml → infra/docker-compose.prod.yml`) allows running from `/opt/docassistai`.

### Production containers (DO Droplet)

| Container | Image | Purpose |
|-----------|-------|---------|
| `caddy` | `caddy:2-alpine` | Reverse proxy + auto-TLS for `api.docassistai.app` |
| `backend` | Custom (multi-stage Node 20 Alpine) | Express API server |
| `postgres` | `postgres:16-alpine` | Database |
| `presidio-analyzer` | `mcr.microsoft.com/presidio-analyzer:latest` | PII detection |
| `presidio-anonymizer` | `mcr.microsoft.com/presidio-anonymizer:latest` | PII replacement |
| `whisper` | `onerahmet/openai-whisper-asr-webservice:latest` | Fallback speech-to-text |

### Key commands

```bash
# Deploy / rebuild
cd /opt/docassistai
docker compose -f docker-compose.prod.yml up -d --build

# Rebuild backend only
docker compose -f docker-compose.prod.yml up -d --build backend

# View logs
docker compose -f docker-compose.prod.yml logs backend --tail 30
docker compose -f docker-compose.prod.yml logs caddy --tail 30

# Check container health
docker compose -f docker-compose.prod.yml ps
```

---

## 5. Environment Variables

### Frontend

**No environment variables needed in production.** The Vite build uses hardcoded defaults in `src/config/appConfig.ts`:
- Backend URL defaults to `https://api.docassistai.app` in production builds
- No secrets or API keys in the frontend

For local development, create a `.env` file with `VITE_BACKEND_URL=http://localhost:3000`.

### Backend (`.env` on DO Droplet at `/opt/docassistai/.env`)

See `infra/.env.example` for the full template.

| Variable | Example | Purpose |
|----------|---------|---------|
| **Database** | | |
| `POSTGRES_PASSWORD` | `<random>` | PostgreSQL password |
| `POSTGRES_USER` | `docassistai` | PostgreSQL user |
| `POSTGRES_DB` | `docassistai` | PostgreSQL database name |
| **Auth** | | |
| `JWT_SECRET` | `<64-char hex>` | JWT signing key |
| **AI (Anthropic)** | | |
| `EXTERNAL_AI_TYPE` | `anthropic` | AI provider selection |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic API key |
| `SCRIBE_GENERATE_MODEL` | `claude-haiku-4-5-20251001` | Model for note generation (optional; defaults to Sonnet) |
| **Transcription (Groq)** | | |
| `GROQ_API_KEY` | `gsk_...` | Groq Whisper API key (if unset, falls back to self-hosted Whisper) |
| **Payments (Square)** | | |
| `SQUARE_WEB_APP_ID` | `sq0idp-xxxx` | Square Web Payments SDK app ID |
| `SQUARE_LOCATION_ID` | `L1234567890` | Square location |
| `SQUARE_ACCESS_TOKEN` | `EAAAxxxx` | Square access token |
| `SQUARE_ENVIRONMENT` | `production` | Square environment |
| **Email (Resend)** | | |
| `RESEND_API_KEY` | `re_xxxx` | Resend API key |
| `EMAIL_FROM` | `DocAssistAI <noreply@docassistai.app>` | Sender address |
| **Cron** | | |
| `CRON_SECRET` | `<32-char hex>` | Billing cron auth secret |
| **Infra (set in docker-compose.prod.yml)** | | |
| `PRESIDIO_ANALYZER_URL` | `http://presidio-analyzer:3000` | Internal Docker hostname |
| `PRESIDIO_ANONYMIZER_URL` | `http://presidio-anonymizer:3000` | Internal Docker hostname |
| `WHISPER_API_URL` | `http://whisper:9000` | Internal Docker hostname |
| `FRONTEND_URL` | `https://www.docassistai.app` | CORS allowed origin |

---

## 6. Domain & DNS / Vercel Configuration

### Domain Summary

| Domain | Points To | Purpose |
|--------|-----------|---------|
| `docassistai.app` | Vercel | Redirects to `www` |
| `www.docassistai.app` | Vercel | Primary frontend (PWA) |
| `api.docassistai.app` | `159.203.87.97` (A record) | Backend API (Caddy → Express) |

### Vercel Configuration

- **No environment variables** needed (frontend has no secrets)
- Auto-deploys on `git push` to `main`
- SPA routing with redirect: `/` → `/scribe/login`
- The frontend calls `api.docassistai.app` directly (cross-origin with `credentials: 'include'`)

---

## 7. Authentication

### Session Auth (Scribe Module)

| Property | Value |
|----------|-------|
| Type | JWT stored in HTTP-only cookie |
| Cookie name | `scribe_token` |
| Expiration | 7 days (30 days with "Remember Me") |
| `SameSite` (production) | `None` + `Secure: true` (required for cross-domain) |
| `SameSite` (development) | `Lax` |
| Secret | `JWT_SECRET` env var (hard-fail in production if unset) |
| Routes | `/api/scribe/auth/login`, `/logout`, `/me` |
| **Inactivity timeout** | 15 minutes — frontend auto-logout with 60-second warning banner (HIPAA 45 CFR 164.312(a)(2)(iii)) |
| **Token revocation** | `token_invalidated_at` column on `scribe_users`. Auth middleware rejects tokens where JWT `iat` < `token_invalidated_at`. Set automatically on password change. |

### SMART on FHIR (EHR Access)

| Property | Value |
|----------|-------|
| Protocol | OAuth 2.0 |
| Library | `fhirclient` |
| Scope | Patient data via FHIR API |
| Integration | Frontend-direct (not proxied through backend) |

### CORS Policy

| Setting | Value |
|---------|-------|
| Allowed origins (prod) | `https://www.docassistai.app`, `https://docassistai.app` |
| Allowed origins (dev) | `http://localhost:*`, `http://127.0.0.1:*` |
| Methods | GET, POST, PUT, PATCH, DELETE, OPTIONS |
| Custom headers | `Content-Type`, `Authorization`, `X-Patient-Id`, `X-User-Id`, `X-Session-Id` |
| Credentials | `true` |

---

## 8. External API Dependencies

| Service | Endpoint | Provider | Purpose |
|---------|----------|----------|---------|
| **Anthropic API** | `https://api.anthropic.com` | Anthropic | LLM inference (Haiku 4.5 for notes, Sonnet 4.6 for analysis) |
| **Groq Whisper API** | `https://api.groq.com/openai/v1/audio/transcriptions` | Groq | Fast speech-to-text (~5s for 5-min audio) |
| **Resend** | `https://api.resend.com` | Resend | Transactional email (password reset, notifications) |
| **Square** | `https://connect.squareup.com` | Square | Payment processing |
| Presidio Analyzer | `http://presidio-analyzer:3000` (internal) | Microsoft | PII detection |
| Presidio Anonymizer | `http://presidio-anonymizer:3000` (internal) | Microsoft | PII replacement |
| Whisper ASR | `http://whisper:9000` (internal) | Self-hosted | Fallback speech-to-text (if Groq unavailable) |
| Cerner FHIR Server | `https://fhir-ehr-code.cerner.com` | Oracle Health | Patient records (EHR mode) |
| Cerner Auth | `https://authorization.cerner.com` | Oracle Health | OAuth 2.0 / SMART on FHIR (EHR mode) |

---

## 9. SSL/TLS & Security

### Express Security Middleware

```
1. trust proxy       — MUST be first line after `const app = express()`
2. helmet()          — Security headers (crossOriginResourcePolicy: "cross-origin")
3. cors()            — Controlled cross-origin access (see §7)
4. express-rate-limit — DDoS protection on /api/* (see §11)
```

### TLS in Production

| Component | TLS Provider | Notes |
|-----------|-------------|-------|
| Frontend | Vercel (automatic) | HTTPS on `www.docassistai.app` |
| Backend | Caddy (automatic via Let's Encrypt) | HTTPS on `api.docassistai.app` |
| Database | N/A | Internal Docker network, no TLS needed |
| Cookies | `Secure: true` | Production only |

---

## 10. HIPAA / PII De-Identification

**Architecture:** Microsoft Presidio sidecar via Docker Compose. `backend/src/services/piiScrubber.ts` intercepts all text fields before every LLM call.

| Step | Detail |
|------|--------|
| 1. Scrub | PHI replaced with typed tokens (`[PERSON_0]`, `[DATE_TIME_0]`, `[MEDICAL_RECORD_NUMBER_0]`, etc.) |
| 2. LLM call | Only scrubbed text reaches the AI provider |
| 3. Re-inject | Real values restored in LLM response before client receives it |
| **Fail behavior** | **Fail closed** — 503 returned to client; LLM never called if Presidio unreachable |
| Persistence | Substitution maps held in memory per request; never persisted or logged |

### Custom HIPAA Recognizers (`backend/presidio-config/`)

| Recognizer | Pattern | Score |
|------------|---------|-------|
| MedicalRecordNumberRecognizer | `MRN[#:]` prefix | 0.85 |
| DateOfBirthRecognizer | DOB patterns | 0.85–0.9 |
| HealthPlanNumberRecognizer | Insurance patterns | 0.70 |
| AccountNumberRecognizer | Account patterns | 0.75 |
| AgeOver89Recognizer | Age > 89 | 0.80 |

Plus all default Presidio recognizers (SSN, credit card, email, phone, IP, IBAN, etc.).

---

## 11. Rate Limiting

| Setting | Value |
|---------|-------|
| Window | 900,000 ms (15 minutes) |
| Max requests | 100 per window per IP |
| Scope | All `/api/*` routes |
| Proxy header | `X-Forwarded-For` (Railway compatible via `trust proxy`) |
| Error message | "Too many requests from this IP, please try again later." |

---

## 12. Node.js & Build Configuration

### Runtime

| Property | Value |
|----------|-------|
| Node.js version | 20 (LTS) |
| Module system | ESM (`"type": "module"` in both `package.json` files) |
| Docker base | `node:20-alpine` (multi-stage: compile → lean runtime) |

### Backend Dockerfile

```dockerfile
# Stage 1: compile TypeScript
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Stage 2: lean production image
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist/
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### TypeScript Targets

| Config | Target | Module | Module Resolution |
|--------|--------|--------|-------------------|
| Frontend (`tsconfig.json`) | ES2020 | ESNext | `bundler` |
| Backend (`backend/tsconfig.json`) | ES2020 | ESNext | `node` |

### Vite Configuration

- React plugin + PWA plugin (auto-updating service worker)
- Dev server: port 8080 (strict)
- Rollup input: `index.html` + `redirect.html`

---

## 13. CI/CD & Deployment Flow

| Component | Flow | Build Command | Artifact |
|-----------|------|---------------|----------|
| Frontend | `git push` → Vercel auto-deploy | `npm run build` | `dist/` served by Vercel CDN |
| Backend | Manual: `git pull` on droplet → `docker compose up -d --build` | Docker multi-stage build | Running container |

### Deploying Backend Changes

```bash
ssh root@159.203.87.97
cd /opt/docassistai
git pull
docker compose -f docker-compose.prod.yml up -d --build backend
docker compose -f docker-compose.prod.yml logs backend --tail 20
```

### Useful Commands

```bash
# Frontend build
npm run build

# Backend build
cd backend && npm run build

# Frontend tests
npx vitest run src/

# Backend tests (ESM mode required)
cd backend && node --experimental-vm-modules node_modules/.bin/jest --no-coverage

# Lint
npm run lint
```

---

## 14. Health Checks & Monitoring

| Endpoint | Method | Returns |
|----------|--------|---------|
| `GET /health` (backend) | HTTP | `{ status, timestamp, aiConfig }` |
| `GET /api/health` (backend) | HTTP | `{ presidio, analyzer, anonymizer, whisper }` |
| Presidio Analyzer `/health` | HTTP (port 3000 inside container) | Service status |
| Presidio Anonymizer `/health` | HTTP (port 3000 inside container) | Service status |
| Whisper `/` | HTTP (port 9000 inside container) | Service status |

**Production quick-check:**

```bash
curl https://api.docassistai.app/api/health
# → { "presidio": true, "analyzer": true, "anonymizer": true, "whisper": true }
```

Any `false` value means the backend is partially degraded.

### Performance Metrics (Audio → Note Pipeline)

| Step | Time | Service |
|------|------|---------|
| Audio upload | ~2-3s | iPhone → Caddy → Express |
| Transcription | ~5s | Groq Whisper API (`whisper-large-v3-turbo`) |
| PII scrubbing | ~1-2s | Presidio (local Docker) |
| Note generation | ~5-6s | Claude Haiku 4.5 (Anthropic API) |
| **Total** | **~15s** | End-to-end for ~5 min recording |

---

## 15. Infrastructure Setup (DigitalOcean)

The `infra/droplet-setup.sh` script provisions a fresh DigitalOcean droplet:

1. **System updates** — `apt-get update && upgrade`
2. **Docker CE installation** — official Docker repository
3. **UFW firewall rules:**
   - `22/tcp` — SSH
   - `5001/tcp` — Presidio Anonymizer
   - `5002/tcp` — Presidio Analyzer
   - `9000/tcp` — Whisper ASR
   - All other incoming — **DENY**
4. **Service deployment** — creates `/opt/docassistai/`, generates `docker-compose.yml`, pulls images, starts services
5. **Post-setup** — prints environment variable instructions and monitoring commands

---

## 16. Data Retention & Automated Cleanup

| Data Type | Retention Period | Cleanup Mechanism |
|---|---|---|
| **Clinical notes** | 3 days from last edit | `POST /api/cron/data-retention` (daily at 3 AM) |
| **Expired trial accounts** | 30 days after trial ends | Same cron job (CASCADE deletes all related data) |
| **Cancelled accounts** | 90 days after period ends | Same cron job |
| **Password reset tokens/OTPs** | 24 hours after expiry | Same cron job |
| **Audit logs** | 1 year | Winston file rotation (10 MB × 10 files) |
| **Database backups** | 7 daily `pg_dump` + 4 weekly DO snapshots | Cron at 2 AM + `find -mtime +7 -delete` |

### Cron Jobs (Droplet crontab)

| Time (UTC) | Job | Log |
|---|---|---|
| 2 AM | Database backup (`pg_dump`) | `/var/log/docassistai-backup.log` |
| 3 AM | Data retention cleanup | `/var/log/docassistai-retention.log` |
| 6 AM | Billing/trial processing | `/var/log/docassistai-cron.log` |

See `docs/disaster-recovery.md` for full backup/restore procedures.

---

## 17. Key Infrastructure Gotchas

| Issue | Detail |
|-------|--------|
| **Docker Compose path resolution** | Docker Compose resolves `env_file`, `build.context`, and volume paths from the **project directory** (where the symlink lives), not the compose file's actual location in `infra/`. Use `./backend` not `../backend`. |
| **`trust proxy`** | Must be the **first line** after `const app = express()` — before any middleware. Required for Caddy reverse proxy to pass correct client IPs. |
| **Cross-domain cookies** | `SameSite=None` (production) requires `Secure: true`. Frontend at `www.docassistai.app` sets cookies from `api.docassistai.app`. |
| **Caddy port conflicts** | If recreating the stack, ensure no old containers hold ports 80/443. Check with `ss -tlnp \| grep -E ':80\|:443'` and `docker port <container>`. |
| **Docker container name prefixes** | Running `docker compose` from different directories creates different name prefixes (`infra-*` vs `docassistai-*`). Old containers on a separate Docker network can't communicate with new ones. |
| **ESM `.js` extensions** | Node.js 20 ESM requires explicit `.js` on all relative imports in compiled output. `tsx watch` auto-resolves in dev; compiled ESM does not. |
| **ESM + Jest** | `jest` is not auto-injected in `--experimental-vm-modules` mode. Test files must `import { jest } from '@jest/globals'`. |
| **`ANTHROPIC_API_KEY=` (empty)** | An empty-string value in the environment blocks `dotenv` from loading the real key. Start backend with `env -u ANTHROPIC_API_KEY npm run dev`. |
| **Presidio timeout** | Default 5 s; increase `PRESIDIO_TIMEOUT_MS` for large documents. |
| **Groq Whisper model deprecation** | Check Groq docs periodically; `whisper-large-v3-turbo` may be superseded. Override via `GROQ_WHISPER_MODEL` env var. |
| **Anthropic model deprecation** | Claude models have ~6-month lifespans. `SCRIBE_GENERATE_MODEL` env var allows updating without code changes. Check [model deprecations](https://platform.claude.com/docs/en/about-claude/model-deprecations). |
