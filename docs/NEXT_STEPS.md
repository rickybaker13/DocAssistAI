# Next Steps — Getting DocAssistAI Fully Operational

## Immediate (Do First)

### 1. Verify AI Service After Throttle Reset
The Bedrock daily token limit resets at midnight UTC. After that:
```bash
# On the droplet:
curl -s -X POST https://api.docassistai.app/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Say hello in 5 words"}]}' | jq .
```
Expected: `{ "success": true, "data": { "content": "..." } }`

If it still fails with throttling, check the [AWS Service Quotas console](https://console.aws.amazon.com/servicequotas/) for Bedrock token limits and request an increase.

### 2. End-to-End Transcription Test
Once AI is responding, test the full flow from the frontend:
1. Log in at `https://www.docassistai.app/scribe/login`
2. Create a new note (select template, sections)
3. Record a short test encounter (e.g., "Patient is a 45-year-old male presenting with chest pain...")
4. Verify: audio → Whisper transcription → AI note generation → sections populated

If transcription fails, check Whisper logs:
```bash
docker logs infra-whisper-1 --tail 50
```

---

## Architecture Overview (How the Pieces Connect)

```
Browser (mic) → AudioRecorder component
    ↓ audio blob (webm/mp4)
POST /api/ai/transcribe (multipart upload)
    ↓ WhisperService → self-hosted Whisper container (port 9000)
    ↓ returns { transcript: "..." }
Frontend receives transcript
    ↓
POST /api/ai/scribe/generate
    ↓ PII Scrubber (Presidio) strips PHI → [PERSON_0], [DATE_0], etc.
    ↓ Claude (Bedrock) generates structured JSON sections
    ↓ PII re-injected into response
    ↓ returns { sections: [{ name, content, confidence }] }
Frontend displays generated note in NoteCanvas
```

**Post-generation AI features (all working, just need AI access):**
- `/api/ai/scribe/focused` — Deep analysis of a single note section (citations, suggestions)
- `/api/ai/scribe/ghost-write` — Converts chat answers into note-ready text
- `/api/ai/scribe/resolve-suggestion` — Turns AI suggestions into actionable note content
- `/api/ai/chat` — General clinical chat with optional patient context

---

## Short-Term (This Week)

### 3. Bedrock Quota Increase
New Bedrock marketplace subscriptions have very low default token limits. Request a quota increase:
- Go to **AWS Service Quotas → Amazon Bedrock**
- Find the tokens-per-minute and tokens-per-day limits for Claude Sonnet 4.6
- Request an increase appropriate for production usage

### 4. Clean Up Old Docker Containers
Old `docassistai-*` containers from the previous compose project are still on the droplet (stopped). Remove them:
```bash
docker rm docassistai-caddy-1 docassistai-backend-1 docassistai-postgres-1 \
  docassistai-whisper-1 docassistai-presidio-anonymizer-1 docassistai-presidio-analyzer-1
docker volume prune  # removes unused volumes (will prompt)
```

### 5. Merge the Branch
Once AI is confirmed working end-to-end:
```bash
# Create PR from claude/fix-ses-sandbox-config-CBErR → main
gh pr create --title "fix: update Bedrock model to Claude Sonnet 4.6" \
  --body "Switches from legacy Claude 3.7 Sonnet to Claude Sonnet 4.6. Adds Caddy DNS fix and Marketplace IAM permissions documentation."
```
Then deploy to production:
```bash
ssh root@159.203.87.97 'cd /opt/docassistai && git pull origin main && docker compose -f infra/docker-compose.prod.yml up -d --build'
```

### 6. PostgreSQL Production Hardening Checklist (Droplet Docker)
Use this checklist on the production droplet to ensure PostgreSQL is ready for production operations.

#### A) Credentials and secret rotation
- [ ] Confirm `POSTGRES_PASSWORD` is not a placeholder/default in `/opt/docassistai/.env`
- [ ] Rotate `POSTGRES_PASSWORD` to a long random value (at least 32 chars)
- [ ] Re-deploy services to pick up rotated credentials

```bash
cd /opt/docassistai
grep -n '^POSTGRES_PASSWORD=' .env
docker compose -f infra/docker-compose.prod.yml up -d
docker compose -f infra/docker-compose.prod.yml exec backend sh -lc 'echo "$DATABASE_URL"'
```

#### B) Runtime and connectivity checks
- [ ] Postgres container is healthy
- [ ] Backend `DATABASE_URL` points to `postgresql://...@postgres:5432/...`
- [ ] Postgres responds to SQL queries

```bash
docker compose -f infra/docker-compose.prod.yml ps
docker compose -f infra/docker-compose.prod.yml exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "select version();"'
docker compose -f infra/docker-compose.prod.yml exec postgres sh -lc 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "show max_connections; show shared_buffers; show wal_level;"'
```

#### C) Persistence checks
- [ ] Volume backing `/var/lib/postgresql/data` exists and is mounted
- [ ] No accidental ephemeral-only deployment

```bash
docker volume ls | grep pgdata
docker inspect $(docker compose -f infra/docker-compose.prod.yml ps -q postgres) --format '{{json .Mounts}}'
```

#### D) Backup readiness (must pass)
- [ ] `pg_dump` works and produces a non-empty backup file
- [ ] Backups are copied off-host (DO Spaces/S3/other)
- [ ] Restore drill performed at least monthly

```bash
mkdir -p /opt/docassistai/backups
docker compose -f infra/docker-compose.prod.yml exec -T postgres sh -lc 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > /opt/docassistai/backups/quick-backup.sql
ls -lh /opt/docassistai/backups/quick-backup.sql
```

#### E) Security posture
- [ ] Postgres is not exposed publicly (`5432` should not be host-bound)
- [ ] Only Caddy exposes internet ports (`80/443`)
- [ ] Droplet firewall allows only required inbound ports

```bash
docker compose -f infra/docker-compose.prod.yml ps
ss -lntp | rg ':5432|:80|:443'
ufw status
```

#### F) Monitoring and operational hygiene
- [ ] Alerts configured for container restarts, disk usage, memory pressure
- [ ] Host patching/reboot cadence defined and documented
- [ ] Log retention/rotation configured for Docker and app logs

Suggested periodic checks:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.RunningFor}}'
docker stats --no-stream
df -h
free -h
```

#### G) Optional: move to DigitalOcean Managed PostgreSQL
If you want managed failover, automated backups, and patch management:
- Provision DO Managed PostgreSQL cluster
- Update `DATABASE_URL` to managed cluster endpoint
- Run migration/restore from current containerized DB
- Validate app behavior and cut over
- Keep old containerized DB read-only briefly during verification, then decommission

---

## Medium-Term (Next 1–2 Weeks)

### 7. Email Service (SES)
Not yet implemented. Needed for:
- **Email verification on signup** — prevent fake email registrations
- **Password reset / forgot password flow**
- **Invite links** for new users

Steps when ready:
1. Add `@aws-sdk/client-ses` to backend dependencies
2. Create `backend/src/services/email/sesService.ts`
3. Add routes for password reset and email verification
4. Configure SES in AWS (verify domain, request production access to exit sandbox)
5. Add `SES_FROM_EMAIL`, `SES_REGION` env vars

### 8. Bedrock `ListFoundationModels` Permission
The IAM user currently cannot list available models (`bedrock:ListFoundationModels` denied). Add this to the IAM policy if you want to programmatically check model availability:
```json
{
  "Effect": "Allow",
  "Action": ["bedrock:ListFoundationModels"],
  "Resource": "*"
}
```

### 9. Frontend Error Handling for AI Throttling
Currently, if Bedrock returns a throttling error, the user sees a raw error message. Consider adding:
- A user-friendly "AI service is temporarily busy, please try again in a moment" message
- Automatic retry with exponential backoff for transient throttle errors in the Bedrock provider

---

## Longer-Term

### 10. Streaming Responses
The current Bedrock provider uses `InvokeModelCommand` (non-streaming). For better UX on long note generations, switch to `InvokeModelWithResponseStreamCommand` so users see text appear progressively.

### 11. RAG / Patient Data Indexing
The codebase has `backend/src/services/rag/` with embedding service, vector store, and patient data indexer — but these require an embedding API key that isn't configured. When ready:
- Configure embedding service (OpenAI embeddings or Bedrock Titan Embeddings)
- Index patient data for context-aware responses

### 12. HIPAA Compliance Checklist
See `docs/HIPAA_COMPLIANCE_NEXT_STEPS.md` for the full checklist. Key remaining items:
- BAA with AWS (for Bedrock + SES)
- BAA with DigitalOcean (for the droplet)
- Audit log persistence and rotation
- Encryption at rest verification

---

## CodeAssist (Billing Coder Module) — Post-Launch Priorities

_Added 2026-04-01. See `docs/plans/2026-04-01-codeassist-billing-coder-design.md` for full design._

### Immediate — Before First Real Users

| # | Task | Effort | Notes |
|---|---|---|---|
| 1 | **Wire pricing to Square** | 1–2 days | Connect $99/mo base + $25/seat + $0.10 overage to Square billing. Model exists in `coding_teams` + `coding_usage` tables. |
| 2 | **Email invites via Resend** | 2–4 hrs | `POST /api/scribe/coder/teams/:id/invite` currently creates stub user but doesn't send email. Wire up Resend. |
| 3 | **Coder onboarding flow** | 4–6 hrs | When coder clicks invite link → registration page pre-fills team. Currently requires manual SQL. |
| 4 | **Column-level encryption** | 2–4 hrs | `patient_name`, `mrn`, `provider_name` in `coding_sessions` marked for encryption at rest. Implement via `pgcrypto` or application-layer AES. |
| 5 | **Manual smoke test** | 1 hr | Create test manager, invite coder, paste a real-format note, verify codes, export xlsx, open in Excel. |
| 6 | **Update Privacy Policy / ToS** | 1–2 hrs | Add CodeAssist data handling, team accounts, and billing coder role to existing legal docs. |

### Short-Term — First 2 Weeks

| # | Task | Effort | Notes |
|---|---|---|---|
| 7 | **Manager billing dashboard** | 4–6 hrs | Show invoices, usage history chart, plan details on `/coder/team` page. |
| 8 | **Coder can edit codes before saving** | 4–6 hrs | V1 is read-only suggestions. Add inline editing (add/remove/modify codes). |
| 9 | **Batch status workflow** | 2–3 hrs | Bulk "Mark All Reviewed" button on weekly batch table. |
| 10 | **Export template customization** | 2–3 hrs | Let managers configure which columns appear in the xlsx export (some UPAs want different formats). |

### Medium-Term — See `docs/FUTURE_DIRECTIONS.md`

- HCC / RAF scoring
- CPT modifier suggestions
- EHR integration (FHIR)
- Clearinghouse auto-submission
- Provider-facing coding report
