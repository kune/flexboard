# Flexboard

A self-hosted Kanban board application with real-time updates, OIDC authentication, and schema-driven card types.

**Tech stack:** React 19 · Fastify 5 · MongoDB · Dex (OIDC) · nginx · Docker Compose

---

## Features

- Kanban boards with drag-and-drop card management
- Schema-driven card types (task, bug, story, epic) with custom attributes
- Markdown rendering for descriptions and rich-text fields
- Real-time updates via Server-Sent Events (SSE)
- Comments and activity log per card
- OIDC authentication via self-hosted [Dex](https://dexidp.io/)

---

## Quick start

**Prerequisites:** Docker with Docker Compose v2, Python 3

```bash
git clone <repo-url> flexboard
cd flexboard
bash scripts/init.sh
```

The script will:
1. Prompt for an admin password and generate `config/dex.yaml` (bcrypt-hashed)
2. Build and start all services
3. Wait until everything is healthy

Once complete, open **http://localhost** and sign in with `admin@flexboard.localhost`.

---

## Re-running init

`init.sh` is safe to re-run. If `config/dex.yaml` already exists, the password step is skipped and `docker compose up -d --build` is run to apply any image changes.

---

## Manual setup (reference)

### 1. Create Dex config

```bash
cp config/dex.yaml.example config/dex.yaml
```

Replace the `hash` value with a real bcrypt hash:

```bash
python3 -c "import bcrypt; print(bcrypt.hashpw(b'YourPassword', bcrypt.gensalt(10)).decode())"
```

### 2. Build and start

```bash
docker compose up -d --build
```

---

## Environment variables

No environment variables are required. The following optional overrides can be set in a `.env` file:

| Variable | Default | Description |
|----------|---------|-------------|
| `FRONTEND_PORT` | `80` | Host port for the nginx frontend |
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
VITE_OIDC_AUTHORITY=http://localhost/dex
VITE_OIDC_CLIENT_ID=flexboard-web
```

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
  └─► nginx (:80)
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
