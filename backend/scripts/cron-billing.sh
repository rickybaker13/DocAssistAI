#!/usr/bin/env bash
# cron-billing.sh — Daily billing cron jobs for DocAssistAI
#
# Calls two endpoints on the backend:
#   1. /api/cron/renew-subscriptions  — charges stored cards for expiring subscriptions
#   2. /api/cron/trial-reminders      — emails users whose trial expires in ~3 days
#
# Required environment variables (set in crontab or source a .env):
#   BACKEND_URL    — e.g. http://localhost:3000 or https://api.docassistai.app
#   CRON_SECRET    — shared secret matching the backend's CRON_SECRET
#
# Usage:
#   # Run directly
#   BACKEND_URL=http://localhost:3000 CRON_SECRET=my-secret ./cron-billing.sh
#
#   # Crontab (runs daily at 6 AM UTC):
#   0 6 * * * BACKEND_URL=http://localhost:3000 CRON_SECRET=my-secret /path/to/cron-billing.sh >> /var/log/docassistai-cron.log 2>&1

set -euo pipefail

BACKEND_URL="${BACKEND_URL:?BACKEND_URL is required}"
CRON_SECRET="${CRON_SECRET:?CRON_SECRET is required}"

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "[$TIMESTAMP] Starting billing cron jobs..."

# 1. Auto-renew expiring subscriptions
echo "[$TIMESTAMP] POST /api/cron/renew-subscriptions"
RENEW_RESPONSE=$(curl -sf -w "\n%{http_code}" \
  -X POST "${BACKEND_URL}/api/cron/renew-subscriptions" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  2>&1) || true

RENEW_BODY=$(echo "$RENEW_RESPONSE" | head -n -1)
RENEW_STATUS=$(echo "$RENEW_RESPONSE" | tail -n 1)

if [ "$RENEW_STATUS" = "200" ]; then
  echo "[$TIMESTAMP] Renewals OK: $RENEW_BODY"
else
  echo "[$TIMESTAMP] Renewals FAILED (HTTP $RENEW_STATUS): $RENEW_BODY" >&2
fi

# 2. Send trial-expiring reminders
echo "[$TIMESTAMP] POST /api/cron/trial-reminders"
REMINDER_RESPONSE=$(curl -sf -w "\n%{http_code}" \
  -X POST "${BACKEND_URL}/api/cron/trial-reminders" \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  2>&1) || true

REMINDER_BODY=$(echo "$REMINDER_RESPONSE" | head -n -1)
REMINDER_STATUS=$(echo "$REMINDER_RESPONSE" | tail -n 1)

if [ "$REMINDER_STATUS" = "200" ]; then
  echo "[$TIMESTAMP] Reminders OK: $REMINDER_BODY"
else
  echo "[$TIMESTAMP] Reminders FAILED (HTTP $REMINDER_STATUS): $REMINDER_BODY" >&2
fi

echo "[$TIMESTAMP] Billing cron jobs complete."
