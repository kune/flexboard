#!/usr/bin/env bash
# One-shot Flexboard initialisation.
#
# Run once after cloning:
#   bash scripts/init.sh
#
# Safe to re-run: skips steps that are already complete.
#
# Default credentials (change after first login):
#   Email:    admin@flexboard.localhost
#   Password: Test1234!
set -euo pipefail

DEX_CONFIG="config/dex.yaml"

# Pre-computed bcrypt hash for the default password "Test1234!" (cost 10).
# Change this entry in config/dex.yaml after the first login.
DEFAULT_HASH='$2a$10$O3Vqj3kfz9OWR3pZNAXboe3XetsMxGHnzeWczwDrEVFgPq0LbSxfi'

step() { echo; echo "▶  $*"; }
log()  { echo "   $*"; }
err()  { echo "ERROR: $*" >&2; exit 1; }

# ── 1. Generate Dex config ────────────────────────────────────────────────────
step "OIDC configuration"
if [[ -f "$DEX_CONFIG" ]]; then
  log "Found existing $DEX_CONFIG — skipping generation."
else
  mkdir -p config
  DEX_BASE_URL="${FLEXBOARD_BASE_URL:-http://localhost}"
  cat > "$DEX_CONFIG" <<EOF
issuer: $DEX_BASE_URL/dex

storage:
  type: memory

web:
  http: 0.0.0.0:5556

oauth2:
  skipApprovalScreen: true

staticClients:
  - id: flexboard-web
    name: Flexboard Web
    redirectURIs:
      - $DEX_BASE_URL/auth/callback
    public: true

enablePasswordDB: true

# Default password for all accounts: Test1234!
# Change these hashes after the first login:
#   htpasswd -nbBC 10 x 'YourNewPassword' | cut -d: -f2 | sed 's/^\$2y\$/\$2a\$/'
staticPasswords:
  - email: admin@flexboard.localhost
    hash: "$DEFAULT_HASH"
    username: admin
    userID: "admin-000001"
EOF
  log "Created $DEX_CONFIG (default password: Test1234!)"
fi

# ── 2. Build and start all services ──────────────────────────────────────────
step "Building and starting all services"
# --force-recreate ensures containers from failed previous runs are replaced,
# picking up any config changes (e.g. a regenerated dex.yaml). Volumes are
# not affected, so existing MongoDB data is preserved on re-runs.
docker compose up -d --build --force-recreate

log "Waiting for Dex to become healthy (up to 60 s)…"
DEADLINE=$(( $(date +%s) + 60 ))
until docker compose ps dex 2>/dev/null | grep -q "(healthy)"; do
  sleep 2
  (( $(date +%s) < DEADLINE )) || err "Dex did not become healthy within 60 s."
done
log "All services ready."

echo ""
echo "  +--------------------------------------------------+"
echo "  |  Flexboard → http://localhost                    |"
echo "  |  Admin:     admin@flexboard.localhost            |"
echo "  |  Password:  Test1234!  ← change after first login|"
echo "  +--------------------------------------------------+"
echo ""
