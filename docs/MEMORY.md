# Session Memory — 2026-02-28

## What We Did This Session

### 1. AWS Bedrock Model Access (Primary Focus)

**Problem:** The app's AI service was returning errors because the configured Bedrock model was inaccessible.

**Investigation & Findings:**

| Model ID | Status | Notes |
|---|---|---|
| `us.anthropic.claude-3-7-sonnet-20250219-v1:0` | Legacy — permanently dead | Was the original production model |
| `us.anthropic.claude-3-5-sonnet-20241022-v2:0` | Legacy — permanently dead | Tried as replacement, also Legacy |
| `anthropic.claude-3-5-sonnet-20240620-v1:0` | Accessible (throttled on day 1) | Claude 3.5 Sonnet v1 |
| `us.anthropic.claude-haiku-4-5-20251001-v1:0` | Accessible (throttled on day 1) | Marketplace subscription needed first |
| `us.anthropic.claude-sonnet-4-6` | Accessible (throttled on day 1) | **Final choice** — best available model |

**Root Causes Resolved:**
- **AWS Marketplace subscription required:** Newer Bedrock models gate access behind a Marketplace subscription. We accepted the Marketplace offer (email confirmation received 2/28).
- **IAM permissions added:** The `Matt-DocAssistAI` IAM user needed `aws-marketplace:ViewSubscriptions` and `aws-marketplace:Subscribe` permissions. Created a new IAM policy and attached it.
- **New subscription daily throttle:** All newly-subscribed models return "Too many tokens per day" on the first day. This resets at midnight UTC.

**Changes Made:**
- `backend/src/config/aiConfig.ts` — Default `BEDROCK_MODEL` updated to `us.anthropic.claude-sonnet-4-6`
- `backend/.env.example` — Updated model reference
- `CLAUDE.md` — Updated model documentation
- Droplet `.env` — Updated `BEDROCK_MODEL=us.anthropic.claude-sonnet-4-6`
- Backend container force-recreated to pick up new env

### 2. Docker / Caddy Port Conflict (Resolved)

**Problem:** Old `docassistai-*` containers from a previous compose project were holding ports 80/443, preventing the new `infra-*` Caddy container from starting.

**Fix:** Stopped all old `docassistai-*` containers, then started the `infra-*` stack. Caddy came up and obtained TLS certs.

### 3. Caddy DNS Resolution (Previously Fixed)

The `infra/docker-compose.prod.yml` was updated to add explicit DNS servers (`8.8.8.8`, `8.8.4.4`) to the Caddy container so it can resolve Let's Encrypt ACME endpoints from within Docker's network.

### 4. TLS Certificate Migration

Copied TLS certs from the old `docassistai_caddy_data` Docker volume to the new `infra_caddy_data` volume so Caddy didn't need to re-issue certificates.

---

## Current Production State (as of session end)

| Component | Status |
|---|---|
| Health endpoint | `curl https://api.docassistai.app/api/health` → `{"presidio":"healthy","analyzer":"ok","anonymizer":"ok","whisper":"ok"}` |
| Frontend (Vercel) | `https://www.docassistai.app` — serving |
| Backend (DO Droplet) | `https://api.docassistai.app` — running |
| PostgreSQL | Healthy (container `infra-postgres-1`) |
| Presidio Analyzer | Healthy |
| Presidio Anonymizer | Healthy |
| Whisper ASR | Healthy |
| Caddy TLS | Working, certs valid |
| **AI Service** | **Blocked by daily throttle — will work after midnight UTC 2/28** |

## AWS Account Details

- **IAM User:** `Matt-DocAssistAI` (ARN: `arn:aws:iam::094869897543:user/Matt-DocAssistAI`)
- **Region:** `us-east-1`
- **Bedrock Model:** `us.anthropic.claude-sonnet-4-6`
- **IAM Policies Attached:**
  1. Bedrock invoke permissions (`bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`)
  2. Marketplace permissions (`aws-marketplace:ViewSubscriptions`, `aws-marketplace:Subscribe`)

## Key Files Modified This Session

| File | Change |
|---|---|
| `backend/src/config/aiConfig.ts:56` | Default Bedrock model → `us.anthropic.claude-sonnet-4-6` |
| `backend/.env.example:21,24` | Updated model references |
| `CLAUDE.md:15` | Updated AI Provider model documentation |
| `infra/docker-compose.prod.yml` | Added DNS servers to Caddy (prior commit in this branch) |

## Branch

All changes on: `claude/fix-ses-sandbox-config-CBErR`
