# Disaster Recovery Runbook — DocAssistAI

Last updated: 2026-03-12

## Infrastructure Overview

| Component | Location | Backup Strategy |
|---|---|---|
| PostgreSQL | DigitalOcean droplet (Docker volume `pgdata`) | DO automated weekly snapshots + manual `pg_dump` |
| Backend code | GitHub `rickybaker13/DocAssistAI` | Git history |
| Caddy TLS certs | Docker volume `caddy_data` | Auto-renewed by Caddy (Let's Encrypt) |
| Presidio config | `backend/presidio-config/recognizers.yaml` | Checked into Git |
| Environment secrets | `/opt/docassistai/.env` on droplet | Stored in password manager (not in Git) |

## Recovery Time Objectives

| Scenario | RTO | RPO |
|---|---|---|
| Full droplet loss | < 2 hours | 1 week (DO snapshot interval) |
| Database corruption | < 30 min | Last `pg_dump` (daily if configured) |
| Code rollback | < 10 min | Last Git commit |

## Backup Procedures

### 1. DigitalOcean Droplet Snapshots (Automated)

Enabled in DO dashboard. Weekly snapshots retained for 4 weeks.

Cost: ~$1.60/month.

### 2. Manual Database Dump

Run from the droplet:

```bash
# Create a compressed dump
docker exec docassistai-postgres-1 pg_dump -U docassist docassistai \
  | gzip > /opt/backups/docassistai-$(date +%Y%m%d-%H%M).sql.gz

# Verify the dump
gunzip -t /opt/backups/docassistai-*.sql.gz
```

**Recommended:** Set up a daily cron job:

```bash
# /etc/cron.d/docassistai-backup
0 3 * * * root docker exec docassistai-postgres-1 pg_dump -U docassist docassistai | gzip > /opt/backups/docassistai-$(date +\%Y\%m\%d).sql.gz && find /opt/backups -name '*.sql.gz' -mtime +7 -delete
```

This runs at 3 AM daily and keeps 7 days of dumps.

### 3. Off-Site Backup (Recommended)

Copy dumps to a separate location (e.g., DO Spaces, S3):

```bash
# Upload to DO Spaces (requires s3cmd configured)
s3cmd put /opt/backups/docassistai-*.sql.gz s3://docassistai-backups/
```

## Restore Procedures

### Scenario A: Full Droplet Loss

1. **Provision a new droplet** (Ubuntu 22.04, same region)
2. **Restore from DO snapshot** (if available) — this restores everything
3. **Or rebuild from scratch:**

```bash
# Install Docker
curl -fsSL https://get.docker.com | sh

# Clone repo
git clone https://github.com/rickybaker13/DocAssistAI.git /opt/docassistai
cd /opt/docassistai

# Restore .env from password manager
nano .env

# Start stack
docker compose -f infra/docker-compose.prod.yml up -d --build

# Restore database from dump
gunzip -c /path/to/docassistai-YYYYMMDD.sql.gz | \
  docker exec -i docassistai-postgres-1 psql -U docassist docassistai
```

4. **Update DNS** if droplet IP changed:
   - `api.docassistai.app` → new droplet IP (Cloudflare/DO DNS)

5. **Verify:**
   ```bash
   curl https://api.docassistai.app/api/health
   ```

### Scenario B: Database Corruption (Stack Intact)

```bash
cd /opt/docassistai

# Stop backend (keep Caddy running for maintenance page)
docker compose -f infra/docker-compose.prod.yml stop backend

# Drop and recreate database
docker exec docassistai-postgres-1 psql -U docassist -c "DROP DATABASE docassistai;"
docker exec docassistai-postgres-1 psql -U docassist -c "CREATE DATABASE docassistai;"

# Restore from dump
gunzip -c /opt/backups/docassistai-YYYYMMDD.sql.gz | \
  docker exec -i docassistai-postgres-1 psql -U docassist docassistai

# Restart backend (migrations will apply any missing columns)
docker compose -f infra/docker-compose.prod.yml start backend
```

### Scenario C: Code Rollback

```bash
cd /opt/docassistai
git log --oneline -10          # Find the commit to roll back to
git checkout <commit-hash>
docker compose -f infra/docker-compose.prod.yml up -d --build backend
```

## Verification Checklist

After any restore, verify:

- [ ] `GET /api/health` returns `{ presidio, analyzer, anonymizer }` all healthy
- [ ] Login works (test with admin account)
- [ ] Note creation + AI scribe features work
- [ ] Transcription (Groq) works
- [ ] Payment processing responds (Square sandbox or production)
- [ ] Audit logs are being written (`docker exec docassistai-backend-1 ls -la /app/audit.log`)

## Contacts

| Role | Contact |
|---|---|
| Droplet access | DigitalOcean dashboard (team account) |
| DNS | Domain registrar / DO DNS panel |
| Secrets | Team password manager |

## Data Retention Policy

| Data Type | Retention Period | Cleanup Mechanism |
|---|---|---|
| Clinical notes | 3 days from last edit | `POST /api/cron/data-retention` (daily) |
| Expired trial accounts | 30 days after trial ends | Same cron job |
| Cancelled accounts | 90 days after period ends | Same cron job |
| Password reset tokens/OTPs | 24 hours after expiry | Same cron job |
| Audit logs | 1 year | Winston file rotation (10MB × 10 files) |
| Database backups | 7 daily dumps + 4 weekly DO snapshots | Cron `find -mtime +7 -delete` |
