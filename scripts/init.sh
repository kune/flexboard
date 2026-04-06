#!/usr/bin/env bash
# One-shot Flexboard initialisation.
#
# Run once after cloning:
#   bash scripts/init.sh
#
# Safe to re-run: skips steps that are already complete.
set -euo pipefail

ENV_FILE=".env"
PAT_FILE="machinekey/sa.pat"
ZITADEL_URL="${ZITADEL_URL:-http://localhost:8080}"

step() { echo; echo "▶  $*"; }
log()  { echo "   $*"; }
err()  { echo "ERROR: $*" >&2; exit 1; }

# ── 1. Generate .env ──────────────────────────────────────────────────────────
step "Environment"
if [[ -f "$ENV_FILE" ]]; then
  log "Found existing $ENV_FILE — skipping generation."
else
  command -v openssl >/dev/null || err "openssl is required to generate secrets."

  MASTERKEY=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
  DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | head -c 24)

  echo ""
  echo "   Admin account will be: admin@flexboard.localhost"
  echo "   Password requirements: min 8 chars, at least one uppercase, lowercase, and digit."
  read -rsp "   Choose admin password: " ADMIN_PASS; echo ""
  [[ ${#ADMIN_PASS} -ge 8 ]] || err "Password must be at least 8 characters."

  cat > "$ENV_FILE" <<EOF
ZITADEL_MASTERKEY=$MASTERKEY
ZITADEL_ADMIN_PASSWORD=$ADMIN_PASS
ZITADEL_DB_PASSWORD=$DB_PASS
VITE_ZITADEL_DOMAIN=http://localhost
# Written automatically by this script after Zitadel is configured:
ZITADEL_PROJECT_ID=
VITE_ZITADEL_CLIENT_ID=
EOF
  log "Created $ENV_FILE"
fi

# Load current values so we can check if IDs are already present
set -a; source "$ENV_FILE"; set +a

# ── 2. Start infrastructure ───────────────────────────────────────────────────
step "Starting infrastructure"
mkdir -p machinekey
docker compose up -d zitadel-db mongodb zitadel

log "Waiting for Zitadel to become healthy (up to 120 s)…"
DEADLINE=$(( $(date +%s) + 120 ))
until docker compose ps zitadel 2>/dev/null | grep -q "(healthy)"; do
  sleep 3
  (( $(date +%s) < DEADLINE )) || err "Zitadel did not become healthy within 120 s."
done
log "Zitadel is ready."

# ── 3. Configure Zitadel (idempotent) ─────────────────────────────────────────
if [[ -n "${ZITADEL_PROJECT_ID:-}" && -n "${VITE_ZITADEL_CLIENT_ID:-}" ]]; then
  step "Zitadel already configured (project ${ZITADEL_PROJECT_ID}) — skipping."
else
  step "Configuring Zitadel"
  ZITADEL_URL="$ZITADEL_URL" PAT_FILE="$PAT_FILE" bash scripts/setup-zitadel.sh
fi

# ── 4. Build and start the full stack ─────────────────────────────────────────
step "Building and starting all services"
docker compose up -d --build

echo ""
echo "  +-----------------------------------------+"
echo "  |  Flexboard → http://localhost            |"
echo "  |  Admin:     admin@flexboard.localhost    |"
echo "  +-----------------------------------------+"
echo ""
