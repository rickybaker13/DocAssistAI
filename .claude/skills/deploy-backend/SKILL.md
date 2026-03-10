---
name: deploy-backend
description: >-
  Use when the user asks to "deploy", "deploy backend", "push to production",
  "deploy to droplet", "update production", "ship it", or wants to deploy
  backend changes to the DigitalOcean droplet. Also use when the user asks
  to "check production", "verify deployment", "check health", or
  "is production working".
version: 0.1.0
---

# Deploy Backend to Production

Deploy DocAssistAI backend to the DigitalOcean droplet safely, avoiding the path resolution issues that have broken deployments in the past.

## Background — Why This Skill Exists

The `docker-compose.prod.yml` file lives in `infra/` but all its paths (`./backend`, `.env`, `./backend/presidio-config/`) are relative to the **project root**, NOT to `infra/`. The droplet setup script creates **symlinks** in the project root to make this work:

```
/opt/docassistai/docker-compose.prod.yml → infra/docker-compose.prod.yml
/opt/docassistai/Caddyfile → infra/Caddyfile
```

**The deploy command in CLAUDE.md is WRONG.** It says:
```bash
docker compose -f infra/docker-compose.prod.yml up -d --build   # ❌ BREAKS PATHS
```

This resolves `./backend` as `infra/backend` (doesn't exist) and `.env` as `infra/.env` (doesn't exist).

**The correct command uses the symlink from project root:**
```bash
docker compose -f docker-compose.prod.yml up -d --build   # ✅ CORRECT
```

## Deploy Workflow

### Step 1: Pre-Flight Checks

Before deploying, run these locally:

```bash
# Type-check backend
cd backend && npx tsc --noEmit

# Run scribe tests
cd backend && node --experimental-vm-modules node_modules/.bin/jest --testPathPatterns="scribe" --no-coverage

# Run frontend tests
npx vitest run src/
```

All must pass before deploying.

### Step 2: Deploy to Droplet

The correct single-command deploy:

```bash
ssh root@api.docassistai.app 'cd /opt/docassistai && git pull && docker compose -f docker-compose.prod.yml up -d --build'
```

**Critical details:**
- `cd /opt/docassistai` — MUST be in this directory (symlinks live here)
- `git pull` — pulls latest code from the branch deployed on the droplet
- `docker compose -f docker-compose.prod.yml` — uses the **symlink** in project root, NOT `infra/docker-compose.prod.yml`
- `--build` — rebuilds the backend image with new code
- `-d` — detached mode

### Step 3: Post-Deploy Health Verification

After deploying, verify all services are healthy:

```bash
# Hit the health endpoint
curl -s https://api.docassistai.app/api/health | python3 -m json.tool
```

**Expected healthy response:**
```json
{
  "presidio": "healthy",
  "analyzer": "ok",
  "anonymizer": "ok",
  "whisper": "ok"
}
```

### Step 4: Service-Level Verification

If any service shows unhealthy, debug with:

```bash
# Check container status
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml ps'

# Check backend logs (most common issues)
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml logs --tail=50 backend'

# Check specific service logs
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml logs --tail=30 presidio-analyzer'
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml logs --tail=30 presidio-anonymizer'
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml logs --tail=30 whisper'
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml logs --tail=30 caddy'
```

## Whisper Verification

**Production should use Groq cloud API, NOT self-hosted Whisper.**

The self-hosted Whisper container still runs in Docker (as a fallback) but `GROQ_API_KEY` must be set in the droplet `.env` so the fast Groq path is used (2-3s vs 15-25s per transcription).

**Check which Whisper path is active:**

```bash
# Check if GROQ_API_KEY is set in production
ssh root@api.docassistai.app 'grep GROQ_API_KEY /opt/docassistai/.env | head -1'
```

- If output shows `GROQ_API_KEY=gsk_...` (non-empty) → Groq is active ✅
- If output shows `GROQ_API_KEY=` (empty) or no output → falling back to slow self-hosted ❌

**To verify Groq is actually being used**, check backend logs after a transcription:

```bash
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml logs --tail=20 backend | grep Whisper'
```

- `[Whisper] Using Groq cloud API` → Groq ✅
- `[Whisper] Using self-hosted Whisper at http://whisper:9000` → Self-hosted ❌ (check GROQ_API_KEY)

## Presidio Verification

**Both Presidio analyzer AND anonymizer must be healthy.** If either is down, ALL LLM calls will fail with 503 (fail-closed design).

**Quick check:**
```bash
curl -s https://api.docassistai.app/api/health | python3 -m json.tool
```

Look for:
- `"presidio": "healthy"` — both services up ✅
- `"presidio": "degraded"` — one or both down ❌

**If degraded, restart Presidio:**
```bash
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml restart presidio-analyzer presidio-anonymizer'
```

Then wait ~45 seconds (analyzer needs time to load NLP models) and re-check health.

**Verify custom recognizers are mounted:**
```bash
ssh root@api.docassistai.app 'docker compose -f docker-compose.prod.yml exec presidio-analyzer cat /app/presidio_analyzer/conf/default_recognizers.yaml | head -5'
```

Should show the DocAssistAI custom recognizer YAML, not the default Presidio config.

## Common Deploy Failures

### 1. "no such file or directory" for ./backend or .env
**Cause:** Used `docker compose -f infra/docker-compose.prod.yml` instead of `docker compose -f docker-compose.prod.yml`
**Fix:** Always use the symlink path from project root.

### 2. Symlinks missing after fresh clone
**Cause:** `git clone` doesn't create the symlinks — `droplet-setup.sh` does.
**Fix:** Re-create symlinks:
```bash
ssh root@api.docassistai.app 'cd /opt/docassistai && ln -sf infra/docker-compose.prod.yml docker-compose.prod.yml && ln -sf infra/Caddyfile Caddyfile'
```

### 3. ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
**Cause:** `app.set('trust proxy', 1)` is missing or not the first line after `const app = express()`.
**Fix:** Check `backend/src/server.ts` — must be line 37 (immediately after `const app = express()`).

### 4. Presidio analyzer unhealthy (45s+ startup)
**Cause:** Presidio analyzer loads NLP models on startup — takes 30-45 seconds.
**Fix:** Wait and re-check. If still failing, check container logs.

### 5. Whisper unhealthy (60s+ startup)
**Cause:** Whisper loads the ASR model on startup — takes up to 60 seconds.
**Fix:** Wait and re-check. Not critical if Groq is configured (Groq is the primary path).

### 6. HTTPS not working
**Cause:** DNS for `api.docassistai.app` not pointing to droplet IP, or Caddy hasn't acquired TLS cert yet.
**Fix:** Verify DNS, then check Caddy logs:
```bash
ssh root@api.docassistai.app 'cd /opt/docassistai && docker compose -f docker-compose.prod.yml logs --tail=30 caddy'
```

## Full Verification Checklist

After every deploy, verify:

1. ✅ `curl https://api.docassistai.app/api/health` returns JSON
2. ✅ `presidio: "healthy"` (analyzer + anonymizer both "ok")
3. ✅ `whisper: "ok"` (container running as fallback)
4. ✅ Groq API key is set (primary transcription path)
5. ✅ Backend logs show no startup errors
6. ✅ Frontend at `https://www.docassistai.app` loads and can reach API
