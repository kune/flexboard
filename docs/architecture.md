# Flexboard – Architecture Document

> **Version:** 0.6  
> **Date:** 2026-04-08  
> **Status:** Updated — diagrams and drawings (FR-09): Mermaid + Excalidraw; ADR-13 added

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
                        │  │  Dex (Identity Provider) │     ▼        │
                        │  │  static passwords        │  ┌────────┐  │
                        │  │  memory storage          │  │MongoDB │  │
                        │  └──────────────────────────┘  └────────┘  │
                        └─────────────────────────────────────────────┘
```

**Actors:**
- **User** – accesses the application via browser; authenticated through Dex.
- **Admin** – manages users by editing `config/dex.yaml` and restarting the Dex container.

**External systems:** none. All components are self-hosted.

---

## 2. Container Architecture

The Docker Compose stack consists of four containers:

```
┌─────────────────────────────────────────────────────────────────┐
│  Docker Compose: flexboard                                       │
│                                                                  │
│  ┌─────────────┐   ┌─────────────┐   ┌────────────────────┐    │
│  │  frontend   │   │   backend   │   │       dex          │    │
│  │             │   │             │   │                    │    │
│  │  Nginx      │   │  Node.js    │   │  Identity Provider │    │
│  │  serving    │──▶│  Fastify    │   │  (OAuth 2.0/OIDC)  │    │
│  │  React SPA  │   │  REST API   │   │  static passwords  │    │
│  └─────────────┘   └──────┬──────┘   └────────────────────┘    │
│                           │                                     │
│                    ┌──────▼──────┐                              │
│                    │   mongodb   │                              │
│                    │             │                              │
│                    │  MongoDB    │                              │
│                    │  (app data) │                              │
│                    └─────────────┘                              │
└─────────────────────────────────────────────────────────────────┘
```

| Container | Image | Purpose | Exposes |
|-----------|-------|---------|---------|
| `frontend` | custom (nginx + SPA build) | Serves the compiled React app; proxies `/api` to backend, `/dex` to Dex | `80` |
| `backend` | custom (Node.js) | REST API + SSE; validates JWT; reads/writes MongoDB | `3000` (internal) |
| `mongodb` | `mongo:7` | Application data store | `27017` (internal) |
| `dex` | `ghcr.io/dexidp/dex` | OIDC identity provider; static passwords via `config/dex.yaml`; memory storage | `5556` (internal) |

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
| UI components | Plain CSS (`src/index.css`) | No component library; hand-crafted stylesheet derived from HTML mockups (see ADR-10) |
| Styling | Plain CSS custom stylesheet | Design tokens expressed as CSS classes matching the mockup; dark theme deferred |
| State – UI | Zustand | Minimal, unopinionated |
| State – server | TanStack Query | Caching, refetching, SSE integration |
| Drag and drop | dnd-kit | Modern, accessible |
| Markdown rendering | react-markdown | Safe renderer, no raw HTML |
| Markdown editing | Plain `<textarea>` (Phase 3) | Full Markdown editor (tiptap or @uiw/react-md-editor) deferred to Phase 4 |
| i18n | react-i18next | Dependency installed; initialisation deferred — English strings are inline for now |
| Backend runtime | Node.js 22 + TypeScript | Shared language with frontend; enables shared types and Zod schemas via `packages/shared` |
| Backend framework | Fastify | Fast, schema-first, native SSE support; lower memory footprint than alternatives |
| Validation | Zod | TypeScript-native; schemas shared via `packages/shared` |
| ODM | Mongoose | Schema definitions on top of MongoDB driver |
| Database | MongoDB 7 | Flexible document model; nested field indexes |
| Identity provider | Dex (self-hosted) | OAuth 2.0 / OIDC; single binary; memory storage; bcrypt static passwords; no external database |
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
  "members": [
    { "user_id": "dex-sub-claim", "role": "owner" },
    { "user_id": "dex-sub-claim", "role": "editor" }
  ],
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
  "created_by": "dex-sub-claim",
  "attributes": {
    "assignee": "dex-sub-claim",
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
  "author_id": "dex-sub-claim",
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

All endpoints except authentication-related routes require a valid `Authorization: Bearer <access_token>` header. Token validation is performed by the backend against Dex's JWKS endpoint (`DEX_JWKS_URL`, default `http://dex:5556/dex/keys`).

### 6.1 Endpoint Overview

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| **Boards** | | | |
| `GET` | `/boards` | ✅ | List boards accessible to the authenticated user |
| `POST` | `/boards` | ✅ | Create a new board |
| `GET` | `/boards/:id` | ✅ | Get a single board |
| `PATCH` | `/boards/:id` | ✅ | Update board name / description |
| `DELETE` | `/boards/:id` | ✅ | Delete a board (cascades to columns and cards) |
| **Columns** | | | |
| `GET` | `/boards/:boardId/columns` | ✅ | List columns for a board, sorted by position |
| `POST` | `/boards/:boardId/columns` | ✅ | Add a column; auto-assigns next position |
| `PATCH` | `/boards/:boardId/columns/:id` | ✅ | Rename or reorder a column |
| `DELETE` | `/boards/:boardId/columns/:id` | ✅ | Delete a column (cascades to cards in that column) |
| **Cards** | | | |
| `GET` | `/boards/:boardId/cards` | ✅ | List all cards in a board, sorted by position |
| `POST` | `/boards/:boardId/cards` | ✅ | Create a card; auto-assigns next position in column |
| `GET` | `/boards/:boardId/cards/:id` | ✅ | Get a single card |
| `PATCH` | `/boards/:boardId/cards/:id` | ✅ | Update fields or move (pass `columnId` and/or `position`) |
| `DELETE` | `/boards/:boardId/cards/:id` | ✅ | Delete a card |
| **Comments** | | | |
| `GET` | `/boards/:boardId/cards/:cardId/comments` | ✅ | List comments for a card, sorted oldest-first |
| `POST` | `/boards/:boardId/cards/:cardId/comments` | ✅ | Add a comment; writes `comment.added` activity entry |
| `PATCH` | `/boards/:boardId/cards/:cardId/comments/:id` | ✅ | Edit own comment (author-only) |
| `DELETE` | `/boards/:boardId/cards/:cardId/comments/:id` | ✅ | Delete own comment (author-only) |
| **Activity** | | | |
| `GET` | `/boards/:boardId/cards/:cardId/activity` | ✅ | Last 100 activity entries for a card, newest-first |
| **Search** | | | |
| `GET` | `/search` | ⬜ | Full-text + attribute search — Phase 4 |
| **Schemas** | | | |
| `GET` | `/card-types` | ✅ | List all card type schemas, sorted by type |
| `GET` | `/card-types/:type` | ⬜ | Get schema for a specific type — Phase 4 |
| **Real-time** | | | |
| `GET` | `/boards/:boardId/events?token=` | ✅ | SSE stream for board-scoped events; token passed as query param |

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

Flexboard uses **OAuth 2.0 Authorization Code Flow with PKCE**, delegated entirely to Dex. The backend never stores or processes passwords.

```
Browser                   Frontend (SPA)             Dex                Backend
   │                           │                       │                     │
   │  1. Open app              │                       │                     │
   │──────────────────────────▶│                       │                     │
   │                           │  2. No token found    │                     │
   │                           │  redirect to Dex      │                     │
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
   │                           │  + ID Token           │                     │
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

**Token storage:** `oidc-client-ts` is configured with `WebStorageStateStore` backed by `localStorage`. This was chosen for simplicity in Phase 1; migration to memory-only storage (with refresh token in an `httpOnly` cookie) is tracked as a Phase 5 security hardening item.

**Sign-out:** Dex does not implement RP-initiated logout (no `end_session_endpoint`). Sign-out clears the local OIDC session (`userManager.removeUser()`) and redirects to `/`, which triggers a fresh login redirect via `AuthGate`.

**Stale session handling:** If the backend returns `401` (e.g. after an app reset when Dex is restarted with new signing keys), the API client calls `signOut()` automatically, clearing the stale token and redirecting the user to the login page.

**Nginx routing:** All Dex traffic is proxied through the nginx `frontend` container at `/dex/`. The Dex issuer is `http://localhost/dex`, so all OIDC discovery, token, and JWKS URLs are valid from both the browser and backend perspectives.

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
  { "user_id": "<dex sub claim>", "role": "owner" },
  { "user_id": "<dex sub claim>", "role": "editor" }
]
```

The backend extracts the `sub` claim from the validated JWT and checks it against the board's member list on every request. The `sub` claim is Dex's stable user identifier (derived from the static password `userID` field in `config/dex.yaml`).

**Invariants enforced by the backend:**
- A board always has at least one `owner`.
- Only the `owner` can invite members, change roles, or delete the board.
- The `editor` role grants full write access to columns and cards but not board settings or membership.
- The `viewer` role is read-only across all board content.
- Requests from users not in the `members` list receive `403 Forbidden`.

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
| `markdown` | string (Markdown) | Markdown editor with live preview; Mermaid fences rendered as diagrams |
| `reference` | string (user ID) | User picker |
| `drawing` | object (`DrawingData`) | Static SVG preview (view mode); embedded Excalidraw canvas (edit mode) |

`DrawingData` is defined in `packages/shared`:

```ts
interface DrawingData {
  /** Excalidraw scene JSON (elements, appState, files) */
  excalidraw: object
  /** Cached SVG string for fast view-mode rendering; regenerated on save */
  svg?: string
}
```

---

## 10. Frontend Architecture

### 10.1 Application Structure

```
src/
├── components/
│   ├── Nav.tsx              # Sticky nav — logo, breadcrumb, user avatar + sign-out dropdown
│   └── AttributeField.tsx   # Three exports: AttributeValue (read), AttributeInput (edit), AttributeRow (sidebar)
├── hooks/
│   └── useBoardSSE.ts       # Opens EventSource with ?token=; invalidates queries on events; reconnects with backoff
├── pages/
│   ├── AuthCallback.tsx     # OIDC redirect handler → completes code exchange
│   ├── Dashboard.tsx        # Board grid + "New Board" modal
│   ├── Board.tsx            # Kanban view — columns, cards, dnd-kit drag-and-drop; SSE wired
│   └── CardDetail.tsx       # Two-panel detail — dynamic attribute fields, comments, activity log; SSE wired
├── store/
│   └── uiStore.ts           # Zustand: breadcrumb board name (expandable)
├── lib/
│   ├── api.ts               # Typed fetch wrapper; boards, columns, cards, card-types, comments, activity
│   └── auth.ts              # oidc-client-ts UserManager; signIn / signOut / getAccessToken
├── index.css                # Full design system — nav, kanban, cards, modals, forms, comments, activity
├── App.tsx                  # BrowserRouter; AuthGate; route tree
└── main.tsx                 # ReactDOM.render; QueryClientProvider; CSS import
```

> **Planned directories not yet created:** `hooks/` (TanStack Query wrappers), `locales/` (i18n strings). These will be added in Phase 4.

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
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile
    ports: ["${FRONTEND_PORT:-80}:80"]
    depends_on: [backend]

  backend:
    build: ./apps/backend
    environment:
      MONGO_URI: mongodb://mongodb:27017/flexboard
      DEX_ISSUER: http://localhost/dex
      DEX_JWKS_URL: http://dex:5556/dex/keys   # ← container-to-container, bypasses nginx
      CORS_ORIGIN: http://localhost
    depends_on: [mongodb, dex]

  mongodb:
    image: mongo:7
    volumes: [mongo-data:/data/db]

  dex:
    image: ghcr.io/dexidp/dex:v2.41.1
    command: dex serve /etc/dex/config.yaml
    volumes:
      - ./config/dex.yaml:/etc/dex/config.yaml:ro   # ← generated by scripts/init.sh
    ports: ["${DEX_PORT:-5556}:5556"]

volumes:
  mongo-data:
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
| `MONGO_URI` | backend | MongoDB connection string (default: `mongodb://mongodb:27017/flexboard`) |
| `DEX_ISSUER` | backend | OIDC issuer claim to validate (default: `http://localhost/dex`) |
| `DEX_JWKS_URL` | backend | Internal JWKS URL for token validation (default: `http://dex:5556/dex/keys`) |
| `CORS_ORIGIN` | backend | Allowed CORS origin (default: `http://localhost`) |
| `FRONTEND_PORT` | host | Host port for the nginx frontend (default: `80`) |
| `DEX_PORT` | host | Host port for the Dex container (default: `5556`) |

No build-time environment variables are required. All OIDC configuration (`authority`, `client_id`) is hardcoded to the Dex defaults and requires no `.env` file for a standard local setup. The Dex admin password is stored as a bcrypt hash in `config/dex.yaml` (generated by `scripts/init.sh`; gitignored).

---

## 12. Architectural Decision Records

| # | Decision | Choice | Key Reason |
|---|----------|--------|------------|
| ADR-01 | Database | **MongoDB** | Native JSON document model; flexible nested indexes; no migration overhead for new card types |
| ADR-02 | API paradigm | **REST** | Sufficient for CRUD; simpler than GraphQL for a single-client web app |
| ADR-03 | Frontend framework | **React + TypeScript** | Largest ecosystem; strong typing |
| ADR-04 | Authentication | **OAuth 2.0 / OIDC via Dex** (self-hosted) | No external dependency; single binary; no database; bcrypt static passwords; PKCE flow. Replaced Zitadel (v4.13.x required PostgreSQL, had fragile PAT-based initialisation, and enforced password complexity at DB migration time making reproducible setup unreliable). |
| ADR-05 | Card type schemas | **YAML config file, seeded into MongoDB** | Git-versioned source of truth; runtime extensibility without deployment |
| ADR-06 | Internationalisation | **react-i18next** from day one | Prevents costly retrofitting; English only for MVP |
| ADR-07 | Real-time updates | **Server-Sent Events (SSE)** | Sufficient for unidirectional board updates; simpler than WebSockets; no additional infrastructure |
| ADR-08 | Theming | **CSS custom properties** via `shadcn/ui` | Zero-JS theme switching; extensible without code changes; FOUC-safe |
| ADR-09 | Backend technology | **Node.js 22 + Fastify + TypeScript** | Same language as frontend enables shared Zod schemas and types via `packages/shared`; Fastify has lower memory footprint (~60–150 MB) and better performance than Spring Boot; preferred over Go to preserve monorepo code sharing |
| ADR-10 | Frontend styling | **Plain CSS (`src/index.css`)** | shadcn/ui + Tailwind were the original plan, but the HTML mockups already defined a complete, consistent design system. Transcribing that directly to a single CSS file was faster, removed a large dependency chain, and produced pixel-faithful results. May revisit if component reuse demands grow. |
| ADR-11 | User management | **Dex static passwords (`config/dex.yaml`)** | Chosen over in-app registration (too much custom work) and external OAuth connectors (GitHub/Google — complicates fully local setup). Static passwords suit a small, known user group managed by an admin. Adding a user requires editing `config/dex.yaml` and restarting the Dex container. Passwords stored as bcrypt hashes. |
| ADR-12 | SSE authentication | **Access token in `?token=` query param** | The browser's `EventSource` API does not support custom request headers, making the standard `Authorization: Bearer` pattern impossible. Alternatives considered: (1) short-lived SSE-specific tokens — adds complexity; (2) cookies — requires changing the OIDC token storage strategy. Query-param token is the established pattern for SSE auth in single-page apps. The exposure risk is low in a self-hosted deployment over localhost/private network. |
| ADR-13 | Diagram rendering | **Mermaid (text-based) + Excalidraw (freehand)** | Two distinct needs: structured diagrams (flowcharts, sequence, ER) are best expressed as text so they remain version-control-friendly and fit naturally in Markdown fields; freehand sketches cannot be expressed as text and need a canvas. Mermaid integrates as a rehype plugin with zero new data model. Excalidraw stores open JSON, exports clean SVG, and its React package embeds without an iframe. Alternatives considered for freehand: tldraw (larger bundle, less stable API), draw.io (iframe-only embedding, poor UX integration). |
