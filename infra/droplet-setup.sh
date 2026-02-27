#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# DocAssistAI — DigitalOcean Droplet Setup (Full Stack)
#
# Provisions the entire backend on a single droplet:
#   Caddy (TLS) · Express API · PostgreSQL · Presidio · Whisper
#
# Prerequisites:
#   - Ubuntu 22.04+ droplet (8 GB RAM / 4 vCPU recommended)
#   - DNS: api.docassistai.app → droplet IP (required for TLS)
#
# Usage:
#   ssh root@<DROPLET_IP>
#   git clone https://github.com/<org>/DocAssistAI.git /opt/docassistai
#   cd /opt/docassistai
#   cp infra/.env.example .env && nano .env   # fill in secrets
#   bash infra/droplet-setup.sh
#
# After setup:
#   - API:  https://api.docassistai.app/api/health
#   - Logs: docker compose -f docker-compose.prod.yml logs -f
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

PROJECT_DIR=/opt/docassistai
cd "$PROJECT_DIR"

echo "==> Updating packages"
apt-get update -qq && apt-get upgrade -y -qq

# ── Install Docker if not present ────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker"
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
    gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
fi

echo "==> Docker version: $(docker --version)"

# ── UFW firewall — only expose SSH + HTTPS ───────────────────────────────────
echo "==> Configuring firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP  (Caddy redirects to HTTPS)
ufw allow 443/tcp  # HTTPS (Caddy — only external entry point)
# NOTE: Presidio (5001/5002), Whisper (9000), Postgres (5432) are NOT exposed.
# They communicate only over Docker's internal network.

# ── Fix Docker + UFW conflict ────────────────────────────────────────────────
sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw

if ! grep -q '# BEGIN DOCKER UFW' /etc/ufw/after.rules 2>/dev/null; then
  cat >> /etc/ufw/after.rules <<'UFWRULES'

# BEGIN DOCKER UFW
*filter
:ufw-user-forward - [0:0]
-A ufw-user-forward -j RETURN
COMMIT
# END DOCKER UFW
UFWRULES
  echo "  Added Docker forwarding rules to /etc/ufw/after.rules"
fi

ufw --force enable

# ── Validate .env exists ─────────────────────────────────────────────────────
if [ ! -f "$PROJECT_DIR/.env" ]; then
  echo ""
  echo "  ERROR: .env file not found at $PROJECT_DIR/.env"
  echo "  Copy the example and fill in your secrets:"
  echo ""
  echo "    cp infra/.env.example .env && nano .env"
  echo ""
  exit 1
fi

# Sanity check: make sure placeholder values have been replaced
if grep -q 'CHANGE_ME' "$PROJECT_DIR/.env"; then
  echo ""
  echo "  ERROR: .env still contains CHANGE_ME placeholder values."
  echo "  Edit .env and replace all CHANGE_ME values with real secrets."
  echo ""
  exit 1
fi

# ── Symlink production files to project root ─────────────────────────────────
ln -sf "$PROJECT_DIR/infra/docker-compose.prod.yml" "$PROJECT_DIR/docker-compose.prod.yml"
ln -sf "$PROJECT_DIR/infra/Caddyfile" "$PROJECT_DIR/Caddyfile"

# Copy presidio config to project root if not already there
if [ -d "$PROJECT_DIR/backend/presidio-config" ] && [ ! -d "$PROJECT_DIR/presidio-config" ]; then
  cp -r "$PROJECT_DIR/backend/presidio-config" "$PROJECT_DIR/presidio-config"
fi

# ── Pull images and build ────────────────────────────────────────────────────
echo "==> Pulling Docker images and building backend (this may take a few minutes)"
docker compose -f docker-compose.prod.yml pull --ignore-buildable
docker compose -f docker-compose.prod.yml build backend

# Restart Docker daemon so it re-creates iptables rules with the new
# FORWARD policy.
echo "==> Restarting Docker to apply firewall changes"
systemctl restart docker

echo "==> Starting services"
docker compose -f docker-compose.prod.yml up -d

echo ""
echo "==> Waiting for services to become healthy..."
sleep 15

# ── Health checks ────────────────────────────────────────────────────────────
check() {
  local name=$1 url=$2
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
    echo "  [OK]  $name"
  else
    echo "  [!!]  $name — not responding yet (may still be starting)"
  fi
}

echo "==> Internal health checks (localhost)"
check "PostgreSQL"          "localhost:5432"  # pg_isready is better, but curl is simpler here
check "Presidio Analyzer"   "http://localhost:5002/health" 2>/dev/null || true
check "Presidio Anonymizer" "http://localhost:5001/health" 2>/dev/null || true
check "Whisper ASR"         "http://localhost:9000/"       2>/dev/null || true

# These services are NOT exposed externally — only Caddy is.
# Use docker compose exec to verify internal connectivity instead:
echo ""
echo "==> Container status"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"

DROPLET_IP=$(curl -s http://checkip.amazonaws.com || hostname -I | awk '{print $1}')

echo ""
echo "==> Verifying HTTPS (via Caddy)"
if curl -sf --max-time 10 "https://api.docassistai.app/api/health" >/dev/null 2>&1; then
  echo "  [OK]  https://api.docassistai.app/api/health — TLS working!"
else
  echo "  [!!]  HTTPS not responding yet."
  echo "        Check DNS: api.docassistai.app should point to $DROPLET_IP"
  echo "        Check logs: docker compose -f docker-compose.prod.yml logs caddy"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Public IP:   $DROPLET_IP"
echo "  API:         https://api.docassistai.app/api/health"
echo "  Logs:        docker compose -f docker-compose.prod.yml logs -f"
echo "  Rebuild:     docker compose -f docker-compose.prod.yml up -d --build"
echo ""
echo "  Next steps:"
echo "    1. Verify DNS: api.docassistai.app → $DROPLET_IP"
echo "    2. Test health: curl https://api.docassistai.app/api/health"
echo "    3. Migrate data from Railway (pg_dump → psql import)"
echo "    4. Update Vercel frontend to point to https://api.docassistai.app"
echo "════════════════════════════════════════════════════════════════"
