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
16. [Key Infrastructure Gotchas](#16-key-infrastructure-gotchas)

---

## 1. Hosting & Deployment Architecture

| Layer | Provider | URL / Host | Notes |
|-------|----------|------------|-------|
| **Frontend** | Vercel | `https://www.docassistai.app` | Vercel redirects `docassistai.app` → `www` |
| **Backend API** | Railway | `https://docassistai-production.up.railway.app` | Docker container, Node.js 20 |
| **Presidio + Whisper** | DigitalOcean Droplet | `http://<DROPLET_IP>:5001/5002/9000` | Docker Compose; setup via `infra/droplet-setup.sh` |

### Local Development

| Service | Address |
|---------|---------|
| Frontend (Vite) | `http://localhost:8080` — `npm run dev` |
| Backend (Express) | `http://localhost:3000` — `cd backend && npm run dev` |
| Presidio / Whisper | Docker Compose on same ports as production |

---

## 2. Ports & Services

| Service | Port | Protocol | Environment |
|---------|------|----------|-------------|
| Frontend (Vite dev) | 8080 | HTTP | Development |
| Backend API | 3000 | HTTP | Dev / Railway internal |
| Presidio Analyzer | 5002 → 3000 (container) | HTTP | Docker / Droplet |
| Presidio Anonymizer | 5001 → 3000 (container) | HTTP | Docker / Droplet |
| Whisper ASR | 9000 | HTTP | Docker / Droplet |
| Frontend (Vercel) | 443 | HTTPS | Production |
| Backend (Railway) | 443 | HTTPS | Production |

---

## 3. Database

| Property | Value |
|----------|-------|
| Engine | PostgreSQL |
| Driver | `pg` (node-postgres) pool — `backend/src/database/db.ts` |
| Production | Railway-managed PostgreSQL; `DATABASE_URL` auto-injected |
| Development | Local PostgreSQL or `DATABASE_URL` env var |
| Testing | `pg-mem` in-memory (auto-selected when `NODE_ENV=test`) |
| SSL | Enabled in production (`rejectUnauthorized: false`) |
| Migrations | `backend/src/database/migrations.ts` — `COLUMN_MIGRATIONS` pattern with `pragma_table_info` guard |

---

## 4. Docker Services

Defined in `docker-compose.yml` at the project root.

```yaml
services:
  presidio-analyzer:
    image: mcr.microsoft.com/presidio-analyzer:latest
    ports: ["5002:3000"]
    volumes:
      - ./backend/presidio-config:/usr/bin/presidio/conf
    environment:
      - RECOGNIZER_REGISTRY_CONF_FILE=/usr/bin/presidio/conf/recognizers.yaml
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      retries: 5
      start_period: 30s

  presidio-anonymizer:
    image: mcr.microsoft.com/presidio-anonymizer:latest
    ports: ["5001:3000"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      retries: 3
      start_period: 20s

  whisper:
    image: onerahmet/openai-whisper-asr-webservice:latest
    ports: ["9000:9000"]
    environment:
      - ASR_MODEL=base
      - ASR_ENGINE=faster_whisper
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/"]
      interval: 15s
      retries: 5
      start_period: 60s
```

**Start locally:**

```bash
docker-compose up presidio-analyzer presidio-anonymizer whisper
```

---

## 5. Environment Variables

### Frontend (`.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `VITE_TENANT_ID` | `<sandbox_tenant_id>` | Oracle Health / Cerner tenant |
| `VITE_FHIR_BASE_URL` | `https://fhir-ehr-code.cerner.com/r4/...` | FHIR endpoint |
| `VITE_AUTH_BASE_URL` | `https://authorization.cerner.com` | OAuth 2.0 authorization |
| `VITE_CLIENT_ID` | `<client_id>` | SMART on FHIR client |
| `VITE_REDIRECT_URI` | `http://localhost:8080/redirect` | OAuth redirect |
| `VITE_AI_PROVIDER` | `openrouter` / `openai` | Client-side AI provider |
| `VITE_AI_API_KEY` | `<key>` | AI provider key |
| `VITE_OPENAI_API_KEY` | `<key>` | OpenAI key (if using OpenAI) |
| `VITE_OPENAI_MODEL` | `gpt-4` | OpenAI model |
| `VITE_OPENROUTER_API_KEY` | `<key>` | OpenRouter key |
| `VITE_OPENROUTER_MODEL` | `openai/gpt-4-turbo-preview` | OpenRouter model |
| `VITE_APP_NAME` | `DocAssistAI` | Application display name |
| `VITE_APP_ID` | `<id>` | Application ID |
| `VITE_USE_MOCK_DATA` | `false` | Set `true` for local testing without EHR |
| `VITE_BACKEND_URL` | `http://localhost:3000` | Dev backend; empty string (`''`) in production (uses Vercel proxy) |

### Backend (`.env`)

| Variable | Example | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db` | PostgreSQL connection string |
| `JWT_SECRET` | `<64-char hex>` | JWT signing key |
| `COOKIE_SECRET` | `<64-char hex>` | Cookie signing key |
| `EXTERNAL_AI_TYPE` | `bedrock` / `anthropic` / `openai` / `openrouter` | AI provider selection |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Direct Anthropic API key |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` | Anthropic model ID |
| `AWS_REGION` | `us-east-1` | AWS region for Bedrock |
| `AWS_ACCESS_KEY_ID` | `AKIA...` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | `...` | AWS credentials |
| `BEDROCK_MODEL` | `us.anthropic.claude-sonnet-4-6-20250514-v1:0` | Bedrock model ARN |
| `PRESIDIO_ANALYZER_URL` | `http://<DROPLET_IP>:5002` | PII analyzer endpoint |
| `PRESIDIO_ANONYMIZER_URL` | `http://<DROPLET_IP>:5001` | PII anonymizer endpoint |
| `PRESIDIO_MIN_SCORE` | `0.7` | Confidence threshold |
| `PRESIDIO_TIMEOUT_MS` | `5000` | Per-request timeout |
| `WHISPER_API_URL` | `http://<DROPLET_IP>:9000` | Self-hosted Whisper; falls back to OpenAI cloud if unset |
| `WHISPER_TIMEOUT_MS` | `120000` | Whisper timeout |
| `PORT` | `3000` | Server listen port |
| `NODE_ENV` | `production` | Environment mode |
| `FRONTEND_URL` | `https://www.docassistai.app` | CORS allowed origin |
| `RATE_LIMIT_WINDOW_MS` | `900000` | Rate-limit window (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per window |

---

## 6. Domain & DNS / Vercel Configuration

### Vercel Routing (`vercel.json`)

```jsonc
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [
    // API proxy to Railway — MUST come before the SPA catch-all
    { "source": "/api/:path*", "destination": "https://docassistai-production.up.railway.app/api/:path*" },
    // SPA fallback
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "redirects": [
    { "source": "/", "destination": "/scribe/login", "permanent": false }
  ],
  "headers": [
    { "source": "/sw.js", "headers": [{ "key": "Cache-Control", "value": "no-cache" }] }
  ]
}
```

### Domain Summary

| Domain | Purpose |
|--------|---------|
| `docassistai.app` | Redirects to `www` (Vercel) |
| `www.docassistai.app` | Primary frontend |
| `docassistai-production.up.railway.app` | Backend API |
| `/api/*` on Vercel | Server-to-server proxy to Railway (no browser CORS needed) |

---

## 7. Authentication

### Session Auth (Scribe Module)

| Property | Value |
|----------|-------|
| Type | JWT stored in HTTP-only cookie |
| Cookie name | `scribe_token` |
| Expiration | 7 days |
| `SameSite` (production) | `None` + `Secure: true` (required for cross-domain) |
| `SameSite` (development) | `Lax` |
| Secret | `JWT_SECRET` env var |
| Routes | `/api/scribe/auth/login`, `/logout`, `/me` |

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
| Presidio Analyzer | `http://<DROPLET_IP>:5002` | Microsoft | PII detection |
| Presidio Anonymizer | `http://<DROPLET_IP>:5001` | Microsoft | PII replacement with typed tokens |
| Whisper ASR | `http://<DROPLET_IP>:9000` | Self-hosted (OpenAI model) | Speech-to-text |
| OpenAI API (fallback) | `https://api.openai.com` | OpenAI | Whisper cloud fallback |
| AWS Bedrock | `https://bedrock-runtime.*.amazonaws.com` | AWS | LLM inference (Claude Sonnet) |
| Anthropic API | `https://api.anthropic.com` | Anthropic | LLM (alternative provider) |
| Cerner FHIR Server | `https://fhir-ehr-code.cerner.com` | Oracle Health | Patient records |
| Cerner Auth | `https://authorization.cerner.com` | Oracle Health | OAuth 2.0 (SMART on FHIR) |

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
| Backend | Railway (automatic) | HTTPS on Railway domain |
| Database | Railway PostgreSQL | SSL enabled (`rejectUnauthorized: false`) |
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

No explicit CI/CD pipeline configuration; deployments are triggered by Git push:

| Component | Flow | Build Command | Artifact |
|-----------|------|---------------|----------|
| Frontend | `git push` → Vercel auto-deploy | `npm run build` | `dist/` |
| Backend | `git push` → Railway auto-deploy | Docker multi-stage build | `dist/server.js` |
| Droplet | Manual setup via `infra/droplet-setup.sh` | `docker-compose up` | Running containers |

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
| Whisper `/` | HTTP (port 9000) | Service status |

**Production quick-check:**

```bash
curl https://docassistai-production.up.railway.app/api/health
# → { "presidio": true, "analyzer": true, "anonymizer": true, "whisper": true }
```

Any `false` value means the backend is partially degraded.

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

## 16. Key Infrastructure Gotchas

| Issue | Detail |
|-------|--------|
| **`trust proxy` on Railway** | Must be the **first line** after `const app = express()` — before any middleware. Without it, `express-rate-limit` throws `ERR_ERL_UNEXPECTED_X_FORWARDED_FOR` and crashes the container. |
| **Railway crash-restart loop** | Container keeps restarting with the last successful build. Fix the crash in a new commit; Railway will build fresh. Check Railway → Deployments → View Logs. |
| **Cross-domain cookies** | `SameSite=None` (production) requires `Secure: true`. `SameSite=Lax` (dev) blocks cookies on cross-site `fetch` with `credentials: 'include'`. |
| **ESM `.js` extensions** | Node.js 20 ESM requires explicit `.js` on all relative imports in compiled output. `tsx watch` auto-resolves in dev; compiled ESM does not. |
| **ESM + Jest** | `jest` is not auto-injected in `--experimental-vm-modules` mode. Test files must `import { jest } from '@jest/globals'`. |
| **Vercel rewrite order** | API proxy rule **must precede** the SPA `/(.*)`  catch-all in `vercel.json`. |
| **`ANTHROPIC_API_KEY=` (empty)** | An empty-string value in the environment blocks `dotenv` from loading the real key. Start backend with `env -u ANTHROPIC_API_KEY npm run dev`. |
| **Presidio timeout** | Default 5 s; increase `PRESIDIO_TIMEOUT_MS` for large documents. |
