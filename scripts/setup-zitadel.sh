#!/usr/bin/env bash
# Idempotent Zitadel post-init setup: creates the Flexboard project + OIDC app
# and prints the IDs that go into .env.
# Run after `docker compose up -d` once Zitadel is healthy.
set -euo pipefail

ZITADEL_URL="${ZITADEL_URL:-http://localhost:8080}"
PAT_FILE="${PAT_FILE:-machinekey/sa.pat}"

# ------------------------------------------------------------------
# Read the PAT (file contains "PAT=<token>" on one line)
# ------------------------------------------------------------------
if [[ ! -f "$PAT_FILE" ]]; then
  echo "ERROR: $PAT_FILE not found. Is Zitadel initialised?" >&2
  exit 1
fi
PAT=$(grep -o 'PAT=.*' "$PAT_FILE" | cut -d= -f2-)
if [[ -z "$PAT" ]]; then
  echo "ERROR: Could not extract PAT from $PAT_FILE" >&2
  exit 1
fi

auth_header="Authorization: Bearer $PAT"

# ------------------------------------------------------------------
# Helper: POST JSON, return response body
# ------------------------------------------------------------------
zitadel_post() {
  local path="$1" body="$2"
  curl -sS -X POST \
    -H "$auth_header" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "$ZITADEL_URL$path"
}

zitadel_get() {
  local path="$1"
  curl -sS -H "$auth_header" "$ZITADEL_URL$path"
}

# ------------------------------------------------------------------
# 1. Verify connectivity
# ------------------------------------------------------------------
echo "Checking Zitadel connectivity..."
STATUS=$(curl -so /dev/null -w "%{http_code}" "$ZITADEL_URL/healthz")
if [[ "$STATUS" != "200" ]]; then
  echo "ERROR: Zitadel not reachable at $ZITADEL_URL (status $STATUS)" >&2
  exit 1
fi
echo "  OK"

# ------------------------------------------------------------------
# 2. Create project (idempotent: search first)
# ------------------------------------------------------------------
echo "Looking for existing 'Flexboard' project..."
EXISTING=$(zitadel_post /management/v1/projects/_search \
  '{"queries":[{"nameQuery":{"name":"Flexboard","method":"TEXT_QUERY_METHOD_EQUALS"}}]}')
PROJECT_ID=$(echo "$EXISTING" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', [])
print(r[0]['id'] if r else '')
")

if [[ -z "$PROJECT_ID" ]]; then
  echo "  Creating project..."
  RESP=$(zitadel_post /management/v1/projects '{"name":"Flexboard"}')
  PROJECT_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")
  echo "  Created: $PROJECT_ID"
else
  echo "  Found:   $PROJECT_ID"
fi

# ------------------------------------------------------------------
# 3. Create OIDC app (idempotent: search first)
# ------------------------------------------------------------------
echo "Looking for existing 'Flexboard Web' app..."
EXISTING_APPS=$(zitadel_post /management/v1/projects/"$PROJECT_ID"/apps/_search \
  '{"queries":[{"nameQuery":{"name":"Flexboard Web","method":"TEXT_QUERY_METHOD_EQUALS"}}]}')
APP_ID=$(echo "$EXISTING_APPS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', [])
print(r[0]['id'] if r else '')
")
CLIENT_ID=$(echo "$EXISTING_APPS" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', [])
print(r[0].get('oidcConfig', {}).get('clientId', '') if r else '')
")

if [[ -z "$APP_ID" ]]; then
  echo "  Creating OIDC app..."
  RESP=$(zitadel_post /management/v1/projects/"$PROJECT_ID"/apps/oidc '{
    "name": "Flexboard Web",
    "redirectUris": ["http://localhost/auth/callback"],
    "responseTypes": ["OIDC_RESPONSE_TYPE_CODE"],
    "grantTypes": ["OIDC_GRANT_TYPE_AUTHORIZATION_CODE"],
    "appType": "OIDC_APP_TYPE_WEB",
    "authMethodType": "OIDC_AUTH_METHOD_TYPE_NONE",
    "postLogoutRedirectUris": ["http://localhost"],
    "devMode": true,
    "accessTokenType": "OIDC_TOKEN_TYPE_JWT",
    "idTokenRoleAssertion": true,
    "accessTokenRoleAssertion": true
  }')
  CLIENT_ID=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['clientId'])")
  echo "  Created client ID: $CLIENT_ID"
else
  echo "  Found client ID: $CLIENT_ID"
fi

# ------------------------------------------------------------------
# 4. Ensure flexboard-sa has IAM_OWNER (instance level)
# ------------------------------------------------------------------
echo "Granting IAM_OWNER to flexboard-sa..."
SA_RESP=$(zitadel_post /management/v1/users/_search \
  '{"queries":[{"userNameQuery":{"userName":"flexboard-sa","method":"TEXT_QUERY_METHOD_EQUALS"}}]}')
SA_ID=$(echo "$SA_RESP" | python3 -c "
import sys, json
d = json.load(sys.stdin)
r = d.get('result', [])
print(r[0]['id'] if r else '')
")
if [[ -z "$SA_ID" ]]; then
  echo "  WARNING: flexboard-sa not found, skipping IAM_OWNER grant" >&2
else
  GRANT_RESP=$(curl -sS -X POST \
    -H "$auth_header" -H "Content-Type: application/json" \
    -d "{\"userId\":\"$SA_ID\",\"roles\":[\"IAM_OWNER\"]}" \
    "$ZITADEL_URL/admin/v1/members" 2>&1)
  # AlreadyExists is fine
  echo "  Done (SA ID: $SA_ID)"
fi

# ------------------------------------------------------------------
# 5. Output
# ------------------------------------------------------------------
echo ""
echo "========================================"
echo "Add these lines to your .env:"
echo "========================================"
echo "ZITADEL_PROJECT_ID=$PROJECT_ID"
echo "VITE_ZITADEL_CLIENT_ID=$CLIENT_ID"
echo "========================================"
