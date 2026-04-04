# Flexboard – Architecture Document

> **Version:** 0.1  
> **Date:** 2026-04-04  
> **Status:** Baseline — aligned with all architectural decisions

---

## Table of Contents

1. [System Context](#1-system-context)
2. [Container Architecture](#2-container-architecture)
3. [Monorepo Structure](#3-monorepo-structure)
4. [Technology Stack](#4-technology-stack)
5. [Data Model](#5-data-model)
6. [REST API Design](#6-rest-api-design)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Real-time Updates (SSE)](#8-real-time-updates-sse)
9. [Card Type Schema System](#9-card-type-schema-system)
10. [Frontend Architecture](#10-frontend-architecture)
11. [Deployment](#11-deployment)
12. [Architectural Decision Records](#12-architectural-decision-records)

---

## 1. System Context

Flexboard is a self-hosted, containerized web application. The only external dependency is the user's browser. All services — including the identity provider — run within the same Docker Compose stack.

```
                        ┌─────────────────────────────────────────────┐
                        │             Docker Compose Stack             │
                        │                                              │
  ┌──────────┐  HTTPS   │  ┌──────────┐    REST/SSE   ┌───────────┐  │
  │  Browser │──────────┼─▶│ Frontend │──────────────▶│  Backend  │  │
  │  (User)  │          │  │  (Nginx) │               │ (Node.js) │  │
  └──────────┘          │  └──────────┘               └─────┬─────┘  │
                        │                                    │        │
                        │          OIDC redirect             │MongoDB │
                        │  ┌──────────────────────────┐     │queries │
                        │  │  Zitadel (Identity       │     ▼        │
                        │  │  Provider)               │  ┌────────┐  │
                        │  │                          │  │MongoDB │  │
                        │  │  ┌──────────────────┐   │  └────────┘  │
                        │  │  │ PostgreSQL        │   │              │
                        │  │  │ (Zitadel DB)      │   │              │
                        │  └──┴──────────────────-┘   │              │
                        └─────────────────────────────────────────────┘
```

**Actors:**
- **User** – accesses the application via browser; authenticated through Zitadel.
- **Admin** – same user role in the MVP; post-MVP a dedicated admin role is foreseen.

**External systems:** none. All components are self-hosted.

---

## 2. Container Architecture

The Docker Compose stack consists of five containers:

```
┌─────────────────────────────────────────────────────────────────┐
│  Docker Compose: flexboard                                       │
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌────────────────────┐    │
│  │  frontend   │   │   backend   │   │      zitadel       │    │
│  │             │   │             │   │                    │    │
│  │  Nginx      │   │  Node.js    │   │  Identity Provider │    │
│  │  serving    │──▶│  Fastify    │   │  (OAuth 2.0/OIDC)  │    │
│  │  React SPA  │   │  REST API   │   └─────────┬──────────┘    │
│  └─────────────┘   └──────┬──────┘             │               │
│                           │                    │               │
│                    ┌──────▼──────┐   ┌─────────▼──────────┐   │
│                    │   mongodb   │   │   zitadel-db        │   │
│                    │             │   │                     │   │
│                    │  MongoDB    │   │  PostgreSQL         │   │
│                    │  (app data) │   │  (Zitadel state)    │   │
│                    └─────────────┘   └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

| Container | Image | Purpose | Exposes |
|-----------|-------|---------|---------|
| `frontend` | custom (nginx + SPA build) | Serves the compiled React app; proxies `/api` to backend | `80` / `443` |
| `backend` | custom (Node.js) | REST API + SSE; validates JWT; reads/writes MongoDB | `3000` (internal) |
| `mongodb` | `mongo:7` | Application data store | `27017` (internal) |
| `zitadel` | `ghcr.io/zitadel/zitadel` | OIDC identity provider; issues & validates tokens | `8080` (internal) |
| `zitadel-db` | `postgres:16` | Zitadel's own persistence | `5432` (internal) |

Only the `frontend` container is exposed to the host. All other containers communicate over an internal Docker network.

---

## 3. Monorepo Structure

The repository uses **pnpm workspaces**. A build orchestrator (Turborepo) handles task caching and parallelism.

```
flexboard/
├── apps/
│   ├── frontend/               # React SPA (Vite)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/         # Zustand stores
│   │   │   ├── lib/            # API client, SSE, i18n setup
│   │   │   └── locales/        # en.json (and future locales)
│   │   ├── Dockerfile
│   │   └── vite.config.ts
│   │
│   └── backend/                # Node.js REST API (Fastify)
│       ├── src/
│       │   ├── routes/         # One file per resource
│       │   ├── services/       # Business logic
│       │   ├── models/         # Mongoose models
│       │   ├── middleware/     # Auth, error handling
│       │   ├── sse/            # SSE broker
│       │   └── seed/           # Schema seeding on startup
│       ├── Dockerfile
│       └── tsconfig.json
│
├── packages/
│   └── shared/                 # Shared TypeScript types & Zod schemas
│       └── src/
│           ├── types/          # Card, Board, Column, User, …
│           └── schemas/        # Zod validation schemas (shared by front + back)
│
├── config/
│   └── card-types.yaml         # Card type schema definitions (source of truth)
│
├── docker/
│   └── nginx.conf              # Frontend Nginx config (SPA routing + API proxy)
│
├── docker-compose.yml          # Production / local-run stack
├── docker-compose.dev.yml      # Dev overrides (hot reload, exposed ports)
├── pnpm-workspace.yaml
├── package.json                # Root scripts, devDependencies
└── turbo.json                  # Turborepo pipeline
```

**Key convention:** `packages/shared` is the single source of truth for types and validation schemas used by both frontend and backend. This prevents drift between the two and keeps the TypeScript contract explicit.

---

## 4. Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend framework | React 19 + TypeScript | Large ecosystem, strong typing |
| Frontend build | Vite | Fast HMR, optimal production bundles |
| UI components | shadcn/ui (Radix UI) | Accessible, unstyled primitives; CSS-variable theming |
| Styling | Tailwind CSS + CSS custom properties | Utility-first; design tokens for themes |
| State – UI | Zustand | Minimal, unopinionated |
| State – server | TanStack Query | Caching, refetching, SSE integration |
| Drag and drop | dnd-kit | Modern, accessible |
| Markdown rendering | react-markdown + rehype-highlight | Safe renderer, no raw HTML |
| Markdown editing | @uiw/react-md-editor or tiptap | Write/Preview toggle |
| i18n | react-i18next | Industry standard; JSON locale files |
| Backend runtime | Node.js 22 + TypeScript | Shared language with frontend; enables shared types and Zod schemas via `packages/shared` |
| Backend framework | Fastify | Fast, schema-first, native SSE support; lower memory footprint than alternatives |
| Validation | Zod | TypeScript-native; schemas shared via `packages/shared` |
| ODM | Mongoose | Schema definitions on top of MongoDB driver |
| Database | MongoDB 7 | Flexible document model; nested field indexes |
| Identity provider | Zitadel (self-hosted) | OAuth 2.0 / OIDC; Docker-native; no external dependency |
| Token validation | `jose` | JWT / JWKS validation in Node.js |
| Monorepo tooling | pnpm workspaces + Turborepo | Efficient installs, build caching |
| Containerization | Docker + Docker Compose | Single-command local and production deployment |
| Testing | Vitest (unit), Playwright (E2E) | Vite-native test runner; modern E2E tooling |

---

## 5. Data Model

### 5.1 MongoDB Collections

| Collection | Description |
|------------|-------------|
| `boards` | Top-level boards |
| `columns` | Ordered columns belonging to a board |
| `cards` | Cards with fixed envelope + flexible `attributes` |
| `comments` | Comments attached to a card |
| `activity_log` | Immutable log of all card changes |
| `card_type_schemas` | Card type definitions (seeded from `config/card-types.yaml`) |

### 5.2 Document Structures

**Board**
```json
{
  "_id": "ObjectId",
  "name": "Project Alpha",
  "description": "## Overview\n\n...",
  "owner_id": "zitadel-user-id",
  "member_ids": ["zitadel-user-id", "..."],
  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-03T08:00:00Z"
}
```

**Column**
```json
{
  "_id": "ObjectId",
  "board_id": "ObjectId",
  "name": "In Progress",
  "position": 2,
  "created_at": "2026-04-01T10:00:00Z"
}
```

**Card**
```json
{
  "_id": "ObjectId",
  "board_id": "ObjectId",
  "column_id": "ObjectId",
  "type": "story",
  "title": "As a user I want to comment on cards",
  "description": "## Background\n\n...",
  "status": "in_progress",
  "position": 1,
  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-03T08:30:00Z",
  "created_by": "zitadel-user-id",
  "attributes": {
    "assignee": "zitadel-user-id",
    "priority": "high",
    "story_points": 5,
    "labels": ["ux", "backend"],
    "due_date": "2026-04-15",
    "acceptance_criteria": "## Criteria\n\n- [ ] Comment input visible\n- [ ] Markdown is rendered"
  }
}
```

**Comment**
```json
{
  "_id": "ObjectId",
  "card_id": "ObjectId",
  "author_id": "zitadel-user-id",
  "body": "Markdown-formatted text…",
  "created_at": "2026-04-02T17:05:00Z",
  "updated_at": null
}
```

**Card Type Schema**
```json
{
  "_id": "ObjectId",
  "type": "story",
  "label": "Story",
  "attributes": [
    { "key": "assignee",            "type": "reference",  "required": false },
    { "key": "priority",            "type": "enum",       "required": false, "values": ["low","medium","high","critical"] },
    { "key": "story_points",        "type": "number",     "required": false },
    { "key": "labels",              "type": "string[]",   "required": false },
    { "key": "due_date",            "type": "date",       "required": false },
    { "key": "acceptance_criteria", "type": "markdown",   "required": false },
    { "key": "epic",                "type": "reference",  "required": false },
    { "key": "sprint",              "type": "string",     "required": false }
  ]
}
```

### 5.3 Indexes

```
cards:  { board_id: 1 }
cards:  { column_id: 1, position: 1 }
cards:  { board_id: 1, type: 1 }
cards:  { board_id: 1, status: 1 }
cards:  { "attributes.assignee": 1 }
cards:  { "attributes.labels": 1 }
cards:  { board_id: 1, title: "text", description: "text" }  ← text index for search
columns: { board_id: 1, position: 1 }
comments: { card_id: 1, created_at: 1 }
activity_log: { card_id: 1, created_at: -1 }
```

---

## 6. REST API Design

Base path: `/api/v1`

All endpoints except authentication-related routes require a valid `Authorization: Bearer <access_token>` header. Token validation is performed by the backend against Zitadel's JWKS endpoint.

### 6.1 Endpoint Overview

| Method | Path | Description |
|--------|------|-------------|
| **Boards** | | |
| `GET` | `/boards` | List boards accessible to the authenticated user |
| `POST` | `/boards` | Create a new board |
| `GET` | `/boards/:id` | Get a single board with its columns |
| `PATCH` | `/boards/:id` | Update board name/description/members |
| `DELETE` | `/boards/:id` | Delete a board (and all its columns and cards) |
| **Columns** | | |
| `POST` | `/boards/:id/columns` | Add a column to a board |
| `PATCH` | `/boards/:id/columns/:colId` | Rename or reorder a column |
| `DELETE` | `/boards/:id/columns/:colId` | Delete a column |
| **Cards** | | |
| `GET` | `/boards/:id/cards` | List all cards in a board (supports filter params) |
| `POST` | `/boards/:id/cards` | Create a card |
| `GET` | `/cards/:id` | Get a single card with comments and activity |
| `PATCH` | `/cards/:id` | Update card fields or attributes |
| `DELETE` | `/cards/:id` | Delete a card |
| `PATCH` | `/cards/:id/move` | Move card to a different column / position |
| **Comments** | | |
| `GET` | `/cards/:id/comments` | List comments for a card |
| `POST` | `/cards/:id/comments` | Add a comment |
| `PATCH` | `/comments/:id` | Edit a comment |
| `DELETE` | `/comments/:id` | Delete a comment |
| **Search** | | |
| `GET` | `/search` | Full-text + attribute search across boards |
| **Schemas** | | |
| `GET` | `/card-types` | List all card type schemas |
| `GET` | `/card-types/:type` | Get schema for a specific card type |
| **Real-time** | | |
| `GET` | `/boards/:id/events` | SSE stream for board-scoped real-time events |

### 6.2 Filtering

`GET /boards/:id/cards` accepts query parameters:

| Parameter | Example | Description |
|-----------|---------|-------------|
| `type` | `?type=bug` | Filter by card type |
| `status` | `?status=in_progress` | Filter by status |
| `assignee` | `?assignee=user_id` | Filter by assignee |
| `label` | `?label=auth` | Filter by label (repeatable) |
| `q` | `?q=login+safari` | Full-text search |

### 6.3 Response Envelope

All responses follow a consistent envelope:

```json
{
  "data": { ... },
  "meta": { "page": 1, "total": 42 }
}
```

Errors:
```json
{
  "error": {
    "code": "CARD_NOT_FOUND",
    "message": "Card with id c_01j9x was not found.",
    "status": 404
  }
}
```

---

## 7. Authentication & Authorization

### 7.1 Authentication Flow

Flexboard uses **OAuth 2.0 Authorization Code Flow with PKCE**, delegated entirely to Zitadel. The backend never stores or processes passwords.

```
Browser                   Frontend (SPA)            Zitadel               Backend
   │                           │                       │                     │
   │  1. Open app              │                       │                     │
   │──────────────────────────▶│                       │                     │
   │                           │  2. No token found    │                     │
   │                           │  redirect to Zitadel  │                     │
   │                           │──────────────────────▶│                     │
   │  3. Show login page       │                       │                     │
   │◀──────────────────────────────────────────────────│                     │
   │  4. User submits credentials                      │                     │
   │──────────────────────────────────────────────────▶│                     │
   │                           │  5. Auth code         │                     │
   │                           │◀──────────────────────│                     │
   │                           │  6. Exchange code     │                     │
   │                           │  for tokens           │                     │
   │                           │──────────────────────▶│                     │
   │                           │  7. Access Token      │                     │
   │                           │  + Refresh Token      │                     │
   │                           │◀──────────────────────│                     │
   │                           │  8. API request       │                     │
   │                           │  + Bearer token       │                     │
   │                           │──────────────────────────────────────────▶ │
   │                           │                       │  9. Validate token  │
   │                           │                       │◀────────────────────│
   │                           │                       │  via JWKS endpoint  │
   │                           │  10. Response         │                     │
   │                           │◀──────────────────────────────────────────- │
```

**Token storage:** Access Tokens are kept in memory only (never in `localStorage` to avoid XSS exposure). The Refresh Token is stored in an `httpOnly` cookie managed by the frontend server or the SPA's token renewal logic.

### 7.2 Authorization Model

Board-level permissions are enforced by the backend on every request:

| Role | Capabilities |
|------|-------------|
| `owner` | Full CRUD on board, columns, cards; manage members |
| `editor` | Create, edit, move, and delete cards and columns |
| `viewer` | Read-only access to board, cards, and comments |

Permissions are stored as a `members` array on the board document:
```json
"members": [
  { "user_id": "zitadel-user-id", "role": "owner" },
  { "user_id": "zitadel-user-id", "role": "editor" }
]
```

The backend extracts the `sub` claim from the validated JWT and checks it against the board's member list on every request.

---

## 8. Real-time Updates (SSE)

### 8.1 Architecture

Each board has a dedicated SSE stream. When a client opens the board view, the frontend establishes a persistent HTTP connection to `GET /api/v1/boards/:id/events`. The backend maintains an in-memory registry of active SSE connections per board and broadcasts events to all connected clients when state changes.

```
Client A (browser)          Backend                        Client B (browser)
       │                       │                                  │
       │  GET /boards/1/events │                                  │
       │──────────────────────▶│  SSE connection registered       │
       │                       │◀─────────────────────────────────│
       │  ← keep-alive         │  GET /boards/1/events            │
       │                       │                                  │
       │  PATCH /cards/42/move │                                  │
       │──────────────────────▶│                                  │
       │  200 OK               │  Write to MongoDB                │
       │◀──────────────────────│                                  │
       │                       │  Broadcast to all board clients  │
       │  ← event: card.moved  │─────────────────────────────────▶│
       │  { cardId, colId, … } │  event: card.moved               │
```

### 8.2 Event Types

| Event | Payload |
|-------|---------|
| `card.created` | Full card document |
| `card.updated` | Card ID + changed fields |
| `card.moved` | Card ID, new `column_id`, new `position` |
| `card.deleted` | Card ID |
| `column.created` | Full column document |
| `column.updated` | Column ID + changed fields |
| `column.deleted` | Column ID |
| `comment.created` | Full comment document |

### 8.3 Reconnection

The browser's native `EventSource` API handles reconnection automatically. On reconnect, the frontend:

1. Re-fetches the full board state via `GET /boards/:id/cards` using TanStack Query.
2. Re-opens the SSE stream.

This ensures consistency even after a prolonged disconnect.

### 8.4 Scalability Note

The in-memory SSE broker works correctly for a single backend instance. If horizontal scaling is required in the future, a **Redis Pub/Sub** layer can be introduced between backend instances without changes to the client or the event contract.

---

## 9. Card Type Schema System

### 9.1 Flow

```
  config/card-types.yaml
          │
          │  read on startup
          ▼
  Backend seed service
          │
          │  upsert into DB
          ▼
  MongoDB: card_type_schemas collection
          │
          │  read at runtime
          ▼
  Backend validation middleware   Frontend schema API
  (validates card attributes)     GET /api/v1/card-types
                                          │
                                          ▼
                                  Dynamic form rendering
                                  (type-specific fields)
```

### 9.2 Schema Definition Format

`config/card-types.yaml`:

```yaml
- type: task
  label: Task
  attributes:
    - key: assignee
      type: reference
      required: false
    - key: priority
      type: enum
      required: false
      values: [low, medium, high, critical]
    - key: labels
      type: string[]
      required: false
    - key: due_date
      type: date
      required: false

- type: bug
  label: Bug
  attributes:
    - key: assignee
      type: reference
      required: false
    - key: priority
      type: enum
      required: true
      values: [low, medium, high, critical]
    - key: environment
      type: enum
      required: false
      values: [production, staging, local]
    - key: steps_to_reproduce
      type: markdown
      required: false

- type: story
  label: Story
  attributes:
    - key: assignee
      type: reference
      required: false
    - key: priority
      type: enum
      required: false
      values: [low, medium, high, critical]
    - key: story_points
      type: number
      required: false
    - key: labels
      type: string[]
      required: false
    - key: due_date
      type: date
      required: false
    - key: acceptance_criteria
      type: markdown
      required: false
    - key: epic
      type: reference
      required: false

- type: epic
  label: Epic
  attributes:
    - key: assignee
      type: reference
      required: false
    - key: priority
      type: enum
      required: false
      values: [low, medium, high, critical]
    - key: labels
      type: string[]
      required: false
    - key: due_date
      type: date
      required: false
    - key: description_long
      type: markdown
      required: false
```

### 9.3 Supported Attribute Types

| Type | Storage | Frontend rendering |
|------|---------|--------------------|
| `string` | string | Text input |
| `string[]` | array of strings | Tag input |
| `number` | number | Number input |
| `date` | ISO 8601 string | Date picker |
| `enum` | string | Select dropdown |
| `markdown` | string (Markdown) | Markdown editor with preview |
| `reference` | string (user ID) | User picker |

---

## 10. Frontend Architecture

### 10.1 Application Structure

```
src/
├── components/
│   ├── ui/                  # shadcn/ui primitives (auto-generated)
│   ├── board/               # BoardView, KanbanColumn, KanbanCard
│   ├── card/                # CardDetail, CardForm, AttributeField
│   ├── layout/              # NavBar, Sidebar
│   └── common/              # MarkdownRenderer, MarkdownEditor, Avatar, …
├── pages/
│   ├── DashboardPage.tsx
│   ├── BoardPage.tsx
│   ├── CardDetailPage.tsx   # or rendered as modal inside BoardPage
│   └── SearchPage.tsx
├── hooks/
│   ├── useBoard.ts          # TanStack Query wrapper
│   ├── useCards.ts
│   ├── useBoardSSE.ts       # SSE subscription + cache invalidation
│   └── useCardTypeSchema.ts
├── stores/
│   └── uiStore.ts           # Zustand: theme, sidebar state, active filters
├── lib/
│   ├── api.ts               # Typed fetch wrapper
│   ├── auth.ts              # Zitadel OIDC client (zitadel-oidc-client)
│   ├── sse.ts               # EventSource wrapper with reconnect logic
│   └── i18n.ts              # react-i18next initialisation
└── locales/
    └── en.json              # All UI strings
```

### 10.2 Data Flow

```
  REST (TanStack Query)
  ┌───────────────────────────────────────────────────────────┐
  │  useBoard / useCards / useCardTypeSchema                  │
  │  ┌─────────────┐  fetch   ┌─────────┐  query  ┌───────┐  │
  │  │  Component  │─────────▶│  Query  │────────▶│  API  │  │
  │  │             │◀─────────│  Cache  │         └───────┘  │
  │  └─────────────┘  data    └────┬────┘                    │
  └───────────────────────────────-│───────────────────────── ┘
                                   │ invalidate on SSE event
  SSE (useBoardSSE)                │
  ┌──────────────────────────────────────────────────────────┐
  │  EventSource → parse event → queryClient.invalidateQueries│
  └──────────────────────────────────────────────────────────┘

  UI State (Zustand: uiStore)
  ┌──────────────────────────────────────────────────────────┐
  │  activeTheme, activeFilters, draggingCardId, …           │
  └──────────────────────────────────────────────────────────┘
```

### 10.3 Theming

Themes are sets of CSS custom properties applied via a `data-theme` attribute on `<html>`. The active theme name is persisted in `localStorage` and applied synchronously in a `<script>` tag in `index.html` before React mounts, preventing FOUC.

```
localStorage["flexboard-theme"] = "dark"
         │
         │  read before React mount
         ▼
<html data-theme="dark">
         │
         ▼
:root[data-theme="dark"] {
  --background: #0f172a;
  --surface: #1e293b;
  --primary: #3b82f6;
  …
}
```

Minimum themes shipped: `light` (default), `dark`.

### 10.4 Internationalisation

`react-i18next` is initialised in `lib/i18n.ts`. All user-facing strings are externalized to `locales/<lang>.json`. The active locale is stored in `localStorage` and applied on startup. Adding a new language requires only a new JSON file — no code changes.

---

## 11. Deployment

### 11.1 Docker Compose (Production / Local Run)

```yaml
# docker-compose.yml (abbreviated)
services:

  frontend:
    build: ./apps/frontend
    ports: ["80:80"]
    depends_on: [backend]

  backend:
    build: ./apps/backend
    environment:
      MONGO_URI: mongodb://mongodb:27017/flexboard
      ZITADEL_DOMAIN: http://zitadel:8080
    depends_on: [mongodb, zitadel]

  mongodb:
    image: mongo:7
    volumes: [mongo-data:/data/db]

  zitadel:
    image: ghcr.io/zitadel/zitadel:latest
    command: start-from-init --masterkey ${ZITADEL_MASTERKEY}
    environment:
      ZITADEL_DATABASE_POSTGRES_HOST: zitadel-db
    depends_on: [zitadel-db]

  zitadel-db:
    image: postgres:16
    environment:
      POSTGRES_DB: zitadel
      POSTGRES_USER: zitadel
      POSTGRES_PASSWORD: ${ZITADEL_DB_PASSWORD}
    volumes: [zitadel-db-data:/var/lib/postgresql/data]

volumes:
  mongo-data:
  zitadel-db-data:
```

### 11.2 Multi-Stage Dockerfiles

Both `frontend` and `backend` use multi-stage builds to produce lean runtime images:

**Frontend:**
```
Stage 1 (node:22-alpine)  →  pnpm install + vite build
Stage 2 (nginx:alpine)    →  copy dist/ → /usr/share/nginx/html
```

**Backend:**
```
Stage 1 (node:22-alpine)  →  pnpm install + tsc build
Stage 2 (node:22-alpine)  →  copy dist/ + production node_modules only
```

### 11.3 Environment Variables

All runtime configuration is provided via environment variables. Secrets are never baked into images.

| Variable | Service | Description |
|----------|---------|-------------|
| `MONGO_URI` | backend | MongoDB connection string |
| `ZITADEL_DOMAIN` | backend | Base URL of the Zitadel instance |
| `ZITADEL_CLIENT_ID` | frontend | OIDC client ID for the SPA |
| `ZITADEL_MASTERKEY` | zitadel | 32-byte master encryption key |
| `ZITADEL_DB_PASSWORD` | zitadel-db | PostgreSQL password for Zitadel |
| `CORS_ORIGIN` | backend | Allowed origin for CORS |

---

## 12. Architectural Decision Records

| # | Decision | Choice | Key Reason |
|---|----------|--------|------------|
| ADR-01 | Database | **MongoDB** | Native JSON document model; flexible nested indexes; no migration overhead for new card types |
| ADR-02 | API paradigm | **REST** | Sufficient for CRUD; simpler than GraphQL for a single-client web app |
| ADR-03 | Frontend framework | **React + TypeScript** | Largest ecosystem; strong typing |
| ADR-04 | Authentication | **OAuth 2.0 / OIDC via Zitadel** (self-hosted) | No external dependency; supports future mobile clients; PKCE flow; token revocation via refresh token |
| ADR-05 | Card type schemas | **YAML config file, seeded into MongoDB** | Git-versioned source of truth; runtime extensibility without deployment |
| ADR-06 | Internationalisation | **react-i18next** from day one | Prevents costly retrofitting; English only for MVP |
| ADR-07 | Real-time updates | **Server-Sent Events (SSE)** | Sufficient for unidirectional board updates; simpler than WebSockets; no additional infrastructure |
| ADR-08 | Theming | **CSS custom properties** via `shadcn/ui` | Zero-JS theme switching; extensible without code changes; FOUC-safe |
| ADR-09 | Backend technology | **Node.js 22 + Fastify + TypeScript** | Same language as frontend enables shared Zod schemas and types via `packages/shared`; Fastify has lower memory footprint (~60–150 MB) and better performance than Spring Boot; preferred over Go to preserve monorepo code sharing |
