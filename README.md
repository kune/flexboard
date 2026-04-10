# Flexboard

A self-hosted Kanban board application with real-time updates, OIDC authentication, and schema-driven card types.

**Tech stack:** React 19 · Fastify 5 · MongoDB · Dex (OIDC) · nginx · Docker Compose

---

## Features

- Kanban boards with drag-and-drop card management (mouse and touch)
- Schema-driven card types (task, bug, story, epic) with custom attributes
- Markdown rendering for descriptions and rich-text fields
- Real-time updates via Server-Sent Events (SSE)
- Comments and activity log per card
- Board membership with role-based access (owner / editor / viewer)
- OIDC authentication via self-hosted [Dex](https://dexidp.io/)
- **Responsive design** — fully usable on phones and tablets; scroll-snap Kanban, touch drag-and-drop, fullscreen Markdown editor on mobile

---

## Quick start

**Prerequisites:** Docker with Docker Compose v2, Python 3

```bash
git clone <repo-url> flexboard
cd flexboard
bash scripts/init.sh
```

The script will:
1. Prompt for an admin password and generate `config/dex.yaml` with a bcrypt hash
2. Build Docker images and start all services (`--force-recreate` ensures a clean state on re-runs)
3. Wait until every service passes its healthcheck

Once complete, open **http://localhost** and sign in with `admin@flexboard.localhost`.

---

## Re-running init

`init.sh` is safe to re-run. If `config/dex.yaml` already exists, the password step is skipped. All containers are recreated (`--force-recreate`) so any config or image changes take effect immediately. MongoDB data is preserved.

---

## Deploying on a LAN / VM

OIDC requires HTTPS on any address that is not `localhost` (the browser's `crypto.subtle` API is unavailable in plain HTTP contexts). Use the TLS compose overlay, which adds a self-signed certificate.

### 1. Generate a self-signed certificate

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/key.pem -out certs/cert.pem -days 365 \
  -subj "/CN=flexboard" \
  -addext "subjectAltName=IP:<YOUR_IP>"
```

### 2. Generate `config/dex.yaml`

```bash
export FLEXBOARD_BASE_URL=https://<YOUR_IP>
sed "s|\${FLEXBOARD_BASE_URL}|$FLEXBOARD_BASE_URL|g" \
  config/dex.yaml.example > config/dex.yaml
```

The example file includes six test accounts (password `Test1234!`). Edit `config/dex.yaml` to add or change accounts; restart Dex afterwards.

### 3. Start with TLS overlay

```bash
FLEXBOARD_BASE_URL=https://<YOUR_IP> \
  docker compose -f docker-compose.yml -f docker-compose.tls.yml up -d --build
```

Accept the browser security warning for the self-signed certificate (or install it as a trusted CA).

---

## Production deployment (Docker Hub images)

To run from published images without building from source:

```bash
export FLEXBOARD_BASE_URL=https://<YOUR_DOMAIN_OR_IP>
sed "s|\${FLEXBOARD_BASE_URL}|$FLEXBOARD_BASE_URL|g" \
  config/dex.yaml.example > config/dex.yaml

# HTTP (localhost only):
docker compose -f docker-compose.prod.yml up -d

# HTTPS (LAN / public):
docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml up -d
```

---

## Manual setup (reference)

### 1. Create Dex config

```bash
cp config/dex.yaml.example config/dex.yaml
```

Replace the `hash` values with real bcrypt hashes for your users:

```bash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'YourPassword', bcrypt.gensalt(10)).decode())"
```

### 2. Build and start

```bash
docker compose up -d --build
```

---

## Environment variables

No environment variables are required for a default localhost deployment. The following can be set in a `.env` file or exported before running `docker compose`:

| Variable | Default | Description |
|----------|---------|-------------|
| `FLEXBOARD_BASE_URL` | `http://localhost` | Public base URL; controls CORS origin and Dex issuer |
| `FRONTEND_PORT` | `80` | Host port for the nginx frontend (HTTP) |
| `DEX_PORT` | `5556` | Host port for the Dex OIDC provider |

---

## Development mode

Run only the infrastructure in Docker; the frontend and backend run locally with hot reload.

**Prerequisites (dev only):** Node.js v22+, pnpm v9+

### 1. Start infrastructure

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Exposed ports: nginx :80, MongoDB :27017, Dex :5556

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure local environment

`apps/backend/.env.local`:
```dotenv
MONGODB_URI=mongodb://localhost:27017/flexboard
DEX_ISSUER=http://localhost/dex
DEX_JWKS_URL=http://localhost:5556/dex/keys
PORT=3001
```

`apps/frontend/.env.local`:
```dotenv
VITE_OIDC_CLIENT_ID=flexboard-web
```

The OIDC authority is derived from `window.location.origin` at runtime; no `VITE_OIDC_AUTHORITY` override is needed for localhost.

### 4. Start the apps

```bash
# Backend
pnpm --filter @flexboard/backend dev

# Frontend (separate terminal)
pnpm --filter @flexboard/frontend dev
```

Access at **http://localhost** (proxied by nginx).

---

## Architecture

```
Browser
  └─► nginx (:80 / :443)
        ├─► /api/*  ──► backend (Fastify, :3001)
        │                 └─► MongoDB
        ├─► /dex/*  ──► Dex (:5556)
        └─► /*      ──► frontend (nginx SPA)
```

| Container | Image | Role |
|-----------|-------|------|
| `frontend` | custom (nginx + SPA) | Serves the React application |
| `backend` | custom (Node.js) | REST API + SSE broker |
| `mongo` | `mongo:7` | Application database |
| `dex` | `ghcr.io/dexidp/dex` | OIDC identity provider |

---

## Useful commands

```bash
# View logs
docker compose logs -f

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Full reset (removes all data and regenerates config on next init)
docker compose down -v && rm -f config/dex.yaml
```
