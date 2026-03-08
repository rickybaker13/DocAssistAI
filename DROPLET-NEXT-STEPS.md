# DocAssistAI — Droplet Deployment & Operations

> Last updated: 2026-03-07
> Droplet IP: `159.203.87.97`
> Backend URL: `https://api.docassistai.app`
> Frontend URL: `https://www.docassistai.app`

---

## Deployment Status: COMPLETE

All deployment steps have been completed and verified:

- [x] **Step 1: Stack deployed** — Docker Compose stack running on droplet (Caddy, Backend, Presidio, PostgreSQL, Whisper)
- [x] **Step 2: DNS configured** — `api.docassistai.app` → `159.203.87.97`, TLS auto-provisioned by Caddy (valid through May 2026)
- [x] **Step 3: Health verified** — All services healthy (`/api/health` returns OK)
- [x] **Step 4: Data migrated** — PostgreSQL data migrated from Railway to DO droplet
- [x] **Step 5: Frontend updated** — Vercel points to `api.docassistai.app` via `appConfig.ts`
- [x] **Step 6: Smoke tested** — Login, audio recording, transcription, note generation all verified on iPhone PWA

### Performance (verified 2026-03-07)

| Step | Time |
|------|------|
| Audio upload | ~2-3s |
| Groq Whisper transcription | ~5s |
| Presidio PII scrubbing | ~1-2s |
| Claude Haiku 4.5 note generation | ~5-6s |
| **Total** | **~15 seconds** |

---

## Architecture

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
   │Analyzer │ │          │ │  (backup)│
   │& Anon.  │ │          │ │         │
   └─────────┘ └──────────┘ └─────────┘
   (internal)   (internal)   (internal)

   External APIs: Groq (transcription), Anthropic (AI), Square (billing), Resend (email)
```

All inter-service communication stays on Docker's internal network. Only Caddy is exposed externally.

---

## Gotchas & Lessons Learned

### Docker Compose Path Resolution
**Always use the symlink at project root**, never `infra/docker-compose.prod.yml` directly. Docker Compose resolves relative paths from the compose file's directory — using the `infra/` path breaks `.env`, `./backend`, and `./presidio-config` resolution.

```bash
# CORRECT
docker compose -f docker-compose.prod.yml up -d --build

# WRONG — breaks path resolution
docker compose -f infra/docker-compose.prod.yml up -d --build
```

### Caddy Port Binding
If Caddy container shows no port mappings (`docker port docassistai-caddy-1` returns empty), force-recreate:
```bash
docker compose -f docker-compose.prod.yml up -d --force-recreate caddy
```
Verify with `docker port docassistai-caddy-1` — should show `80/tcp -> 0.0.0.0:80` and `443/tcp -> 0.0.0.0:443`.

### Anthropic Model Deprecation
`claude-3-5-haiku-20241022` was retired Feb 19, 2026. Current model: `claude-haiku-4-5-20251001`. Set via `SCRIBE_GENERATE_MODEL` in `.env`. Check Anthropic model lifecycle page periodically.

### Old Container Conflicts
If old containers from previous stack names (e.g., `infra-*`) conflict with new `docassistai-*` containers, stop and remove them:
```bash
docker ps -a --filter "name=infra-" -q | xargs docker rm -f
```

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

## Routine Operations

```bash
# SSH into droplet
ssh root@159.203.87.97

# Project directory
cd /opt/docassistai

# View all logs (live)
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f caddy

# Check container status
docker compose -f docker-compose.prod.yml ps

# Restart a single service
docker compose -f docker-compose.prod.yml restart backend

# Rebuild and restart backend only
docker compose -f docker-compose.prod.yml up -d --build backend

# Full rebuild (all services)
docker compose -f docker-compose.prod.yml down && docker compose -f docker-compose.prod.yml up -d --build

# Pull latest code and redeploy
cd /opt/docassistai && git pull && docker compose -f docker-compose.prod.yml up -d --build

# Database access
docker compose -f docker-compose.prod.yml exec postgres psql -U docassistai -d docassistai

# Database backup
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U docassistai docassistai > backup-$(date +%Y%m%d).sql
```

---

## Troubleshooting

**Presidio analyzer won't start:**
```bash
docker compose -f docker-compose.prod.yml logs presidio-analyzer
# Common issues: bad YAML in recognizers.yaml, missing volume mount
```

**Backend can't reach Presidio:**
```bash
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

**Backend shows deprecated model error:**
Update `SCRIBE_GENERATE_MODEL` in `.env` to the current Haiku model, then restart:
```bash
docker compose -f docker-compose.prod.yml restart backend
```

---

## Next Steps

See **[PRE-LAUNCH-CHECKLIST.md](./PRE-LAUNCH-CHECKLIST.md)** for the full pre-launch plan including:
- Legal documents (TOS, Privacy Policy)
- User consent flow
- Clinical testing plan
- Social media marketing campaign
- Launch checklist
