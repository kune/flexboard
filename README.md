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

## Prerequisites

| Tool | Version |
|------|---------|
| Docker + Docker Compose | v2.x |
| pnpm | v9+ |
| Node.js | v22+ |
| Python 3 | 3.x (for setup script) |

---

## First-time setup

### 1. Clone and install dependencies

```bash
git clone <repo-url> flexboard
cd flexboard
pnpm install
```

### 2. Create the environment file

Copy the template and fill in the required values:

```bash
cp .env.example .env
```

Generate a 32-byte master key for Zitadel (must be exactly 32 characters):

```bash
openssl rand -base64 24 | tr -d '=' | head -c 32
```

Set passwords and the master key in `.env`:

```dotenv
ZITADEL_MASTERKEY=<32-character random string>
ZITADEL_DB_PASSWORD=<strong password>
ZITADEL_ADMIN_PASSWORD=<strong password>
```

Leave `ZITADEL_PROJECT_ID` and `VITE_ZITADEL_CLIENT_ID` blank for now — the setup script will provide them.

### 3. Start the infrastructure

Start all containers (Zitadel needs a few seconds to initialise on first run):

```bash
docker compose up -d
```

Wait until Zitadel is healthy:

```bash
docker compose ps
# zitadel should show "healthy"
```

### 4. Run the Zitadel setup script

This script creates the Flexboard project and OIDC application in Zitadel and prints the IDs you need:

```bash
bash scripts/setup-zitadel.sh
```

The script outputs two values:

```
ZITADEL_PROJECT_ID=<id>
VITE_ZITADEL_CLIENT_ID=<client-id>
```

Copy these into your `.env` file. Also set `VITE_ZITADEL_DOMAIN`:

```dotenv
ZITADEL_PROJECT_ID=<id>
VITE_ZITADEL_CLIENT_ID=<client-id>
VITE_ZITADEL_DOMAIN=http://localhost
```

### 5. Rebuild and restart

The frontend build embeds the Zitadel client ID at build time, so a rebuild is required:

```bash
docker compose up -d --build
```

### 6. Open the app

Navigate to [http://localhost](http://localhost) in your browser.

Sign in with the default Zitadel admin account:

| Field | Value |
|-------|-------|
| Username | `admin@flexboard.localhost` |
| Password | value of `ZITADEL_ADMIN_PASSWORD` in your `.env` |

---

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `ZITADEL_MASTERKEY` | Yes | 32-character encryption key for Zitadel |
| `ZITADEL_DB_PASSWORD` | Yes | Password for the Zitadel PostgreSQL database |
| `ZITADEL_ADMIN_PASSWORD` | Yes | Password for the initial `admin@flexboard.localhost` account |
| `ZITADEL_PROJECT_ID` | Yes (after setup) | Zitadel project ID (output of setup script) |
| `VITE_ZITADEL_CLIENT_ID` | Yes (after setup) | OIDC client ID for the SPA (output of setup script) |
| `VITE_ZITADEL_DOMAIN` | Yes | Public URL of Zitadel — `http://localhost` for local development |

---

## Development mode

In development mode the frontend and backend run locally (with hot reload) while only the infrastructure services (MongoDB, PostgreSQL, Zitadel, nginx) run in Docker.

### 1. Start infrastructure only

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This exposes the following ports on localhost:

| Service | Port |
|---------|------|
| nginx (app entry point) | 80 |
| MongoDB | 27017 |
| Zitadel | 8080 |
| PostgreSQL | 5432 |

### 2. Configure local environment

Create `apps/backend/.env.local` (or export these in your shell):

```dotenv
MONGODB_URI=mongodb://localhost:27017/flexboard
ZITADEL_DOMAIN=http://localhost
ZITADEL_PROJECT_ID=<from your .env>
PORT=3001
```

Create `apps/frontend/.env.local`:

```dotenv
VITE_ZITADEL_CLIENT_ID=<from your .env>
VITE_ZITADEL_DOMAIN=http://localhost
VITE_API_URL=http://localhost/api
```

### 3. Start the apps

In separate terminals:

```bash
# Backend (http://localhost:3001)
pnpm --filter @flexboard/backend dev

# Frontend (http://localhost:5173)
pnpm --filter @flexboard/frontend dev
```

Access the app at [http://localhost](http://localhost) (nginx proxies both).

---

## Architecture overview

```
Browser
  └─► nginx (:80)
        ├─► /api/*  ──► backend (Fastify, :3001)
        │                 └─► MongoDB (:27017)
        ├─► /auth/* ──► Zitadel (:8080)
        │   /zitadel/*     └─► PostgreSQL (:5432)
        └─► /*      ──► frontend (nginx static SPA)
```

| Container | Image | Role |
|-----------|-------|------|
| `frontend` | custom (nginx + built SPA) | Serves the React SPA |
| `backend` | custom (Node.js) | REST API + SSE broker |
| `mongo` | `mongo:7` | Application database |
| `zitadel` | `ghcr.io/zitadel/zitadel:v2.x` | OIDC identity provider |
| `postgres` | `postgres:16` | Zitadel's database |

---

## Useful commands

```bash
# View logs for all services
docker compose logs -f

# View backend logs only
docker compose logs -f backend

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Stop and remove volumes (full reset)
docker compose down -v
```

---

## Re-running the setup script

The setup script is idempotent — it is safe to run multiple times. It will reuse an existing project/application if one already exists with the same name, and will always print the correct IDs.

```bash
bash scripts/setup-zitadel.sh
```
