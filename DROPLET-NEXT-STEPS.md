# DocAssistAI — Droplet Deployment: Next Steps

> Last updated: 2026-02-27
> Branch: `claude/fix-fetch-error-FU45p`
> Droplet IP: `159.203.87.97`

## Where We Left Off

The DigitalOcean droplet is provisioned and partially configured. Docker, UFW firewall, and the base infrastructure are in place. The `.env` file has been created. Two bugs were found and fixed during deployment:

1. **Health checks used `curl`** — Presidio/Whisper Docker images don't have `curl`. Fixed to use Python `urllib`.
2. **Presidio analyzer volume mount path was wrong** — mounted to `/usr/bin/presidio/conf` but the image's WORKDIR is `/app`. Fixed to mount directly to `/app/presidio_analyzer/conf/default_recognizers.yaml`.

These fixes are committed and pushed to the branch but **have not yet been deployed on the droplet**.

---

## Step 1: Deploy the Fixed Stack on the Droplet

SSH into the droplet and run:

```bash
ssh root@159.203.87.97
cd /opt/docassistai

# Pull the latest fixes
git stash          # if needed — clear any local edits
git pull origin claude/fix-fetch-error-FU45p

# Re-copy presidio config (the volume mount path changed)
cp -r backend/presidio-config presidio-config

# Re-create the symlinks (setup script does this, but just in case)
ln -sf infra/docker-compose.prod.yml docker-compose.prod.yml
ln -sf infra/Caddyfile Caddyfile

# Bring up the stack
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

**IMPORTANT:** Always use `docker-compose.prod.yml` (the symlink at project root), never `infra/docker-compose.prod.yml` directly. Docker Compose resolves relative paths from the compose file's directory — using the `infra/` path breaks `.env`, `./backend`, and `./presidio-config` resolution.

### Verify

```bash
# Check all containers are healthy
docker compose -f docker-compose.prod.yml ps

# Check individual service logs if something fails
docker compose -f docker-compose.prod.yml logs presidio-analyzer
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs caddy
```

---

## Step 2: DNS Configuration

Point `api.docassistai.app` to the droplet IP. Caddy auto-provisions TLS once DNS resolves.

```bash
# Check current DNS
dig api.docassistai.app +short
# Should return: 159.203.87.97

# Once DNS is set, verify TLS
curl https://api.docassistai.app/api/health
```

If DNS is already configured from a previous setup, verify the A record still points to `159.203.87.97`.

---

## Step 3: Verify End-to-End Health

```bash
# Full health check (should return presidio, analyzer, anonymizer, whisper status)
curl https://api.docassistai.app/api/health

# Expected response shape:
# { "presidio": true, "analyzer": true, "anonymizer": true, "whisper": true }
```

---

## Step 4: Data Migration from Railway

If migrating an existing PostgreSQL database from Railway:

```bash
# On Railway (or wherever the old DB is):
pg_dump --no-owner --no-acl -Fc "$OLD_DATABASE_URL" > docassistai-backup.dump

# Copy to droplet:
scp docassistai-backup.dump root@159.203.87.97:/tmp/

# On the droplet — restore into the Docker Postgres container:
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_restore --no-owner --no-acl -d docassistai -U docassistai < /tmp/docassistai-backup.dump
```

---

## Step 5: Update Vercel Frontend

The Vercel frontend at `https://www.docassistai.app` needs its backend URL pointed to the droplet.

1. In Vercel project settings, verify no `VITE_BACKEND_URL` override is set (the app uses `https://api.docassistai.app` for production builds via `appConfig.ts`)
2. If previously pointing to Railway, trigger a Vercel redeploy to pick up the production backend URL

---

## Step 6: Smoke Test the Full App

1. Open `https://www.docassistai.app` in a browser
2. Test login / session creation
3. Test the Scribe workflow: upload audio → transcription → AI analysis
4. Verify PII de-identification is working (check that names/dates are scrubbed in AI requests)

---

## Architecture Reference

```
                    Internet
                       │
                       ▼
              ┌──────────────┐
              │    Caddy     │  :80/:443 (only exposed ports)
              │   (TLS)      │
              └──────┬───────┘
                     │ reverse_proxy :3000
                     ▼
              ┌──────────────┐
              │   Express    │  Backend API
              │   Backend    │
              └──┬───┬───┬───┘
                 │   │   │
        ┌────────┘   │   └────────┐
        ▼            ▼            ▼
   ┌─────────┐ ┌──────────┐ ┌─────────┐
   │Presidio │ │PostgreSQL│ │ Whisper  │
   │Analyzer │ │          │ │  ASR     │
   │& Anon.  │ │          │ │         │
   └─────────┘ └──────────┘ └─────────┘
   (internal)   (internal)   (internal)
```

All inter-service communication stays on Docker's internal network. Only Caddy is exposed externally.

---

## Key Files

| File | Purpose |
|---|---|
| `infra/docker-compose.prod.yml` | Production stack definition |
| `infra/Caddyfile` | Caddy reverse proxy + auto-TLS config |
| `infra/.env.example` | Template for `.env` secrets |
| `infra/droplet-setup.sh` | One-time droplet provisioning script |
| `backend/presidio-config/recognizers.yaml` | Custom HIPAA recognizers for Presidio |
| `backend/Dockerfile` | Backend Docker image (Node 20 Alpine, multi-stage) |

---

## Troubleshooting

**Presidio analyzer won't start:**
```bash
docker compose -f docker-compose.prod.yml logs presidio-analyzer
# Common issues: bad YAML in recognizers.yaml, missing volume mount
```

**Backend can't reach Presidio:**
```bash
# Verify internal DNS resolution
docker compose -f docker-compose.prod.yml exec backend \
  node -e "fetch('http://presidio-analyzer:3000/health').then(r=>r.json()).then(console.log)"
```

**Caddy TLS errors:**
```bash
docker compose -f docker-compose.prod.yml logs caddy
# Common: DNS not pointing to droplet, port 80/443 blocked by firewall
```

**POSTGRES_PASSWORD warning:**
Ensure `.env` exists at project root (`/opt/docassistai/.env`) with `POSTGRES_PASSWORD` set.

---

## Useful Commands

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# Restart a single service
docker compose -f docker-compose.prod.yml restart backend

# Rebuild and restart backend only
docker compose -f docker-compose.prod.yml up -d --build backend

# Full rebuild
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build

# Pull latest code and redeploy
cd /opt/docassistai && git pull && docker compose -f docker-compose.prod.yml up -d --build
```
