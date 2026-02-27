#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# DocAssistAI — DigitalOcean Droplet Setup
# Provisions Presidio (PII de-identification) + Whisper (speech-to-text)
#
# Usage:
#   scp -r infra/ backend/presidio-config/ root@<DROPLET_IP>:/opt/docassistai/
#   ssh root@<DROPLET_IP> 'bash /opt/docassistai/infra/droplet-setup.sh'
#
# After setup the following services are available:
#   - Presidio Analyzer  :  http://<DROPLET_IP>:5002
#   - Presidio Anonymizer:  http://<DROPLET_IP>:5001
#   - Whisper ASR         :  http://<DROPLET_IP>:9000
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

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

# ── UFW firewall — only expose service ports + SSH ───────────────────────────
echo "==> Configuring firewall"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp    # SSH
ufw allow 5001/tcp  # Presidio Anonymizer
ufw allow 5002/tcp  # Presidio Analyzer
ufw allow 9000/tcp  # Whisper ASR
ufw --force enable

# ── Create project directory ─────────────────────────────────────────────────
PROJECT_DIR=/opt/docassistai
mkdir -p "$PROJECT_DIR"

# ── Write docker-compose file ────────────────────────────────────────────────
cat > "$PROJECT_DIR/docker-compose.yml" <<'COMPOSE'
services:
  presidio-analyzer:
    image: mcr.microsoft.com/presidio-analyzer:latest
    ports: ["5002:3000"]
    volumes:
      - ./presidio-config:/usr/bin/presidio/conf
    environment:
      - RECOGNIZER_REGISTRY_CONF_FILE=/usr/bin/presidio/conf/recognizers.yaml
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 10s
      retries: 5
      start_period: 30s

  presidio-anonymizer:
    image: mcr.microsoft.com/presidio-anonymizer:latest
    ports: ["5001:3000"]
    restart: always
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
    restart: always
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/"]
      interval: 15s
      retries: 5
      start_period: 60s
COMPOSE

# ── Copy Presidio custom recognizers if present ──────────────────────────────
if [ -d "$PROJECT_DIR/presidio-config" ]; then
  echo "==> Custom Presidio recognizers found"
else
  echo "==> WARNING: No presidio-config/ directory found at $PROJECT_DIR/presidio-config"
  echo "    Copy backend/presidio-config/ to $PROJECT_DIR/presidio-config before starting."
fi

# ── Pull images and start ────────────────────────────────────────────────────
echo "==> Pulling Docker images (this may take a few minutes)"
cd "$PROJECT_DIR"
docker compose pull

echo "==> Starting services"
docker compose up -d

echo ""
echo "==> Waiting for services to become healthy..."
sleep 10

# ── Health checks ────────────────────────────────────────────────────────────
check() {
  local name=$1 url=$2
  if curl -sf --max-time 5 "$url" >/dev/null 2>&1; then
    echo "  [OK]  $name"
  else
    echo "  [!!]  $name — not responding yet (may still be starting)"
  fi
}

check "Presidio Analyzer"  "http://localhost:5002/health"
check "Presidio Anonymizer" "http://localhost:5001/health"
check "Whisper ASR"         "http://localhost:9000/"

DROPLET_IP=$(curl -s http://checkip.amazonaws.com || hostname -I | awk '{print $1}')

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Set these environment variables on Railway:"
echo ""
echo "    PRESIDIO_ANALYZER_URL=http://${DROPLET_IP}:5002"
echo "    PRESIDIO_ANONYMIZER_URL=http://${DROPLET_IP}:5001"
echo "    WHISPER_API_URL=http://${DROPLET_IP}:9000"
echo ""
echo "  Monitor:  docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo "════════════════════════════════════════════════════════════════"
