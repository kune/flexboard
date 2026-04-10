#!/usr/bin/env bash
# One-shot Flexboard initialisation.
#
# Run once after cloning:
#   bash scripts/init.sh
#
# Safe to re-run: skips steps that are already complete.
set -euo pipefail

DEX_CONFIG="config/dex.yaml"

step() { echo; echo "▶  $*"; }
log()  { echo "   $*"; }
err()  { echo "ERROR: $*" >&2; exit 1; }

# Generate a bcrypt hash of $1.
# Tries: (1) htpasswd, (2) python3 bcrypt module, (3) python3 venv + bcrypt.
_bcrypt_hash() {
  local password="$1"
  # htpasswd is built in on macOS and available via apache2-utils on Debian/Ubuntu.
  if command -v htpasswd >/dev/null 2>&1; then
    htpasswd -nbBC 10 x "$password" | cut -d: -f2 | sed 's/^\$2y\$/\$2a\$/'
    return
  fi
  # Python bcrypt module (already installed)
  if python3 -c "import bcrypt" 2>/dev/null; then
    python3 -c "
import bcrypt, sys
print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10)).decode())
" "$password"
    return
  fi
  # Last resort: temporary venv (avoids PEP 668 externally-managed-environment error)
  log "Creating temporary Python venv to install bcrypt…"
  local venv
  venv=$(mktemp -d)
  python3 -m venv "$venv" >/dev/null
  "$venv/bin/pip" install --quiet bcrypt
  "$venv/bin/python" -c "
import bcrypt, sys
print(bcrypt.hashpw(sys.argv[1].encode(), bcrypt.gensalt(10)).decode())
" "$password"
  rm -rf "$venv"
}

# ── 1. Generate Dex config ────────────────────────────────────────────────────
step "OIDC configuration"
if [[ -f "$DEX_CONFIG" ]]; then
  log "Found existing $DEX_CONFIG — skipping generation."
else
  command -v python3 >/dev/null || err "python3 is required."

  echo ""
  echo "   Admin account will be: admin@flexboard.localhost"
  echo "   Password requirements: min 8 characters."
  read -rsp "   Choose admin password: " ADMIN_PASS; echo ""
  [[ ${#ADMIN_PASS} -ge 8 ]] || err "Password must be at least 8 characters."

  log "Hashing password…"
  HASH=$(_bcrypt_hash "$ADMIN_PASS")

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
EOF

  # Append the admin password entry separately so $HASH is expanded by the shell
  cat >> "$DEX_CONFIG" <<EOF

enablePasswordDB: true

staticPasswords:
  - email: admin@flexboard.localhost
    hash: "$HASH"
    username: admin
    userID: "admin-000001"
EOF
  log "Created $DEX_CONFIG"
fi

# ── 2. Build and start all services ──────────────────────────────────────────
step "Building and starting all services"
docker compose up -d --build

log "Waiting for Dex to become healthy (up to 60 s)…"
DEADLINE=$(( $(date +%s) + 60 ))
until docker compose ps dex 2>/dev/null | grep -q "(healthy)"; do
  sleep 2
  (( $(date +%s) < DEADLINE )) || err "Dex did not become healthy within 60 s."
done
log "All services ready."

echo ""
echo "  +-----------------------------------------+"
echo "  |  Flexboard → http://localhost            |"
echo "  |  Admin:     admin@flexboard.localhost    |"
echo "  +-----------------------------------------+"
echo ""
