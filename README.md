# Flexboard

A self-hosted Kanban board application with real-time updates, OIDC authentication, and schema-driven card types.

**Tech stack:** React 19 · Fastify 5 · MongoDB · Zitadel (OIDC) · nginx · Docker Compose

---

## Features

- Kanban boards with drag-and-drop card management
- Schema-driven card types (task, bug, story, epic) with custom attributes
- Markdown rendering for descriptions and rich-text fields
- Real-time updates via Server-Sent Events (SSE)
- Comments and activity log per card
- OIDC authentication via self-hosted Zitadel

---

## Quick start

**Prerequisites:** Docker with Docker Compose v2, `openssl`, Python 3

```bash
git clone <repo-url> flexboard
cd flexboard
bash scripts/init.sh
```

The script will:
1. Generate a `.env` with random secrets (you choose the admin password)
2. Start Zitadel and wait for it to be healthy
3. Create the OIDC project and application in Zitadel
4. Write the resulting IDs back into `.env`
5. Build and start the full stack

Once complete, open **http://localhost** and sign in with `admin@flexboard.localhost`.

---

## Re-running init

`init.sh` is safe to re-run. It skips any step that is already complete:

- If `.env` already exists, no secrets are regenerated.
- If Zitadel already has the project/client configured, the setup step is skipped.
- `docker compose up -d --build` is always run at the end to apply any image changes.

---

## Manual setup (reference)

If you prefer to run the steps yourself:

### 1. Create `.env`

```bash
cp .env.example .env
```

Fill in the required values. Generate the masterkey with:

```bash
openssl rand -base64 32 | tr -d '/+=' | head -c 32
```

### 2. Start infrastructure

```bash
mkdir -p machinekey
docker compose up -d zitadel-db mongodb zitadel
# Wait until: docker compose ps shows zitadel as (healthy)
```

### 3. Configure Zitadel

```bash
bash scripts/setup-zitadel.sh
```

The script writes `ZITADEL_PROJECT_ID` and `VITE_ZITADEL_CLIENT_ID` directly into `.env`.

### 4. Build and start

```bash
docker compose up -d --build
```

---

## Environment variables

| Variable | Set by | Description |
|----------|--------|-------------|
| `ZITADEL_MASTERKEY` | You | 32-character encryption key for Zitadel |
| `ZITADEL_ADMIN_PASSWORD` | You | Password for `admin@flexboard.localhost` |
| `ZITADEL_DB_PASSWORD` | You | Password for Zitadel's PostgreSQL database |
| `VITE_ZITADEL_DOMAIN` | You | Public URL of Zitadel (`http://localhost` locally) |
| `ZITADEL_PROJECT_ID` | `init.sh` | Zitadel project ID |
| `VITE_ZITADEL_CLIENT_ID` | `init.sh` | OIDC client ID for the SPA |

---

## Development mode

Run only the infrastructure in Docker; the frontend and backend run locally with hot reload.

**Prerequisites (dev only):** Node.js v22+, pnpm v9+

### 1. Start infrastructure

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

Exposed ports: nginx :80, MongoDB :27017, Zitadel :8080, PostgreSQL :5432

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure local environment

`apps/backend/.env.local`:
```dotenv
MONGODB_URI=mongodb://localhost:27017/flexboard
ZITADEL_DOMAIN=http://localhost
ZITADEL_PROJECT_ID=<from your .env>
PORT=3001
```

`apps/frontend/.env.local`:
```dotenv
VITE_ZITADEL_CLIENT_ID=<from your .env>
VITE_ZITADEL_DOMAIN=http://localhost
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
        ├─► /auth/* ──► Zitadel (:8080)
        │   /oidc/*        └─► PostgreSQL
        └─► /*      ──► frontend (nginx SPA)
```

| Container | Image | Role |
|-----------|-------|------|
| `frontend` | custom (nginx + SPA) | Serves the React application |
| `backend` | custom (Node.js) | REST API + SSE broker |
| `mongo` | `mongo:7` | Application database |
| `zitadel` | `ghcr.io/zitadel/zitadel` | OIDC identity provider |
| `postgres` | `postgres:16` | Zitadel's database |

---

## Useful commands

```bash
# View logs
docker compose logs -f

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Full reset (removes all data)
docker compose down -v && rm -f .env machinekey/sa.pat
```
