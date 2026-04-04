# Flexboard – Project Planning

> **Last updated:** 2026-04-04 (Track B complete: comments, activity log, attribute fields)  
> **Legend:** ✅ Done · 🔄 In Progress · ⬜ Pending

---

## Table of Contents

1. [Phase 0 – Project Foundation](#phase-0--project-foundation)
2. [Phase 1 – Scaffolding & Infrastructure](#phase-1--scaffolding--infrastructure)
3. [Phase 2 – Backend Core](#phase-2--backend-core)
4. [Phase 3 – Frontend Core](#phase-3--frontend-core)
5. [Phase 4 – Features](#phase-4--features)
6. [Phase 5 – Quality & Delivery](#phase-5--quality--delivery)

---

## Phase 0 – Project Foundation

> Goal: Establish shared understanding before writing any code.

| Status | Task | Notes |
|--------|------|-------|
| ✅ | Write requirements document | `docs/requirements.md` |
| ✅ | Create UI mockups (HTML) | `docs/mockups/` — 5 interactive screens |
| ✅ | Resolve all architectural decisions | MongoDB, REST, React, Zitadel, SSE, i18n, theming, schemas |
| ✅ | Write architecture document | `docs/architecture.md` |
| ✅ | Write planning document | `docs/planning.md` (this file) |

---

## Phase 1 – Scaffolding & Infrastructure

> Goal: A runnable skeleton — all containers start, services can reach each other, auth works end-to-end.

| Status | Task | Notes |
|--------|------|-------|
| ✅ | Initialise monorepo (pnpm workspaces + Turborepo) | `pnpm-workspace.yaml`, `turbo.json`, root `package.json` |
| ✅ | Create `apps/frontend` skeleton (Vite + React + TypeScript) | Bare app, no features yet |
| ✅ | Create `apps/backend` skeleton (Fastify + TypeScript) | Health-check endpoint only |
| ✅ | Create `packages/shared` skeleton | Shared types + Zod schemas |
| ✅ | Configure ESLint + Prettier across monorepo | Root-level config, per-package overrides |
| ✅ | Configure TypeScript (`tsconfig.json`) per package | Strict mode; path aliases |
| ✅ | Write `backend.Dockerfile` (multi-stage) | Build → lean Node.js runtime image |
| ✅ | Write `frontend.Dockerfile` (multi-stage) | Build → Nginx serving SPA |
| ✅ | Write `docker-compose.yml` | All 5 containers; internal network |
| ✅ | Write `docker-compose.dev.yml` | Dev overrides: infrastructure only, apps run locally |
| ✅ | Configure Zitadel (initial setup) | `scripts/setup-zitadel.sh` — idempotent; creates OIDC app, grants IAM_OWNER; outputs IDs |
| ✅ | Integrate Zitadel into frontend (OIDC client, login redirect) | `lib/auth.ts` — `oidc-client-ts`, PKCE, Login V1 |
| ✅ | Validate JWT in backend (`jose` + Zitadel JWKS) | `lib/auth.ts` — `createRemoteJWKSet`; `requireAuth` preHandler on all routes |
| ✅ | Verify full auth round-trip via `docker compose up` | Login → Zitadel Login V1 → `/auth/callback` → token → `/api/v1/me` ✓ |

---

## Phase 2 – Backend Core

> Goal: All REST endpoints implemented, tested, and documented.

| Status | Task | Notes |
|--------|------|-------|
| ✅ | Connect to MongoDB via Mongoose | `lib/db.ts` — `connectDb()` called on startup |
| ✅ | Define Mongoose models | `Board`, `Column`, `Card`, `CardTypeSchema`, `Comment`, `ActivityLog` — all with `toJSON` transforms (`_id` → `id`) |
| ✅ | Implement card type schema seeding | `lib/seed.ts` — reads `config/card-types.yaml`, upserts on every startup |
| ✅ | Boards API (`/api/v1/boards`) | Full CRUD; cascade-delete columns + cards on board delete |
| ✅ | Columns API (`/api/v1/boards/:boardId/columns`) | GET list + POST + PATCH + DELETE; cascade-delete cards on column delete |
| ✅ | Cards API (`/api/v1/boards/:boardId/cards/:id`) | Full CRUD; move = PATCH with `columnId`/`position` |
| ✅ | Comments API (`/api/v1/boards/:boardId/cards/:cardId/comments`) | Full CRUD; edit/delete restricted to comment author; writes `comment.added` activity entry |
| ✅ | Activity log — write on card mutations | `card.created`, `card.updated` (with `fields` list), `card.moved` written in card route handlers |
| ✅ | Activity log API (`/api/v1/boards/:boardId/cards/:cardId/activity`) | Read-only; last 100 entries newest-first |
| ✅ | Card type schemas API (`/api/v1/card-types`) | Read-only, sorted by type |
| ⬜ | Search endpoint (`/api/v1/search`) | Deferred to Phase 4 |
| ⬜ | SSE broker + endpoint (`/api/v1/boards/:id/events`) | Deferred to Phase 4 |
| ⬜ | Input validation via Zod on all endpoints | Currently inline type checks; Zod integration from `packages/shared` deferred |
| ✅ | Board-level permission checks | `ownerId`/`memberIds` enforced on every route handler |
| ⬜ | OpenAPI spec generation | Deferred to Phase 5 |
| ⬜ | Backend unit tests (Vitest) | Deferred to Phase 5 |
| ⬜ | Backend integration tests | Deferred to Phase 5 |

---

## Phase 3 – Frontend Core

> Goal: All five screens functional, connected to the real API.

| Status | Task | Notes |
|--------|------|-------|
| ✅ | Set up TanStack Query | Global `QueryClient` in `main.tsx`; devtools mounted in dev |
| ✅ | Set up Zustand store (`uiStore`) | `store/uiStore.ts` — breadcrumb board name; expandable for future state |
| ⬜ | Set up react-i18next | Deferred — dependency present, initialisation not yet wired |
| ⬜ | Implement theming (light/dark) | Deferred to Phase 4; single light theme shipped |
| ✅ | Implement typed API client | `lib/api.ts` — typed fetch wrapper; Bearer token injected from `getAccessToken()` |
| ⬜ | Implement SSE hook (`useBoardSSE`) | Deferred to Phase 4 |
| ✅ | Dashboard page | `pages/Dashboard.tsx` — board grid; "New Board" modal; accent colours per board |
| ✅ | Board page (Kanban view) | `pages/Board.tsx` — columns + cards; add-card inline form; add-column modal; delete card |
| ✅ | Drag-and-drop (dnd-kit) | `@dnd-kit/core` + `@dnd-kit/sortable`; card reorder within column and move between columns; optimistic local state |
| ✅ | Card detail view | `pages/CardDetail.tsx` — two-panel layout; Markdown rendering; inline edit with dynamic attribute fields; comments; activity log in sidebar |
| ✅ | Card form (create / edit) | Edit form includes all schema-driven attribute fields (`AttributeInput`); inline create in Board for quick add (type + title) |
| ⬜ | Search page | Deferred to Phase 4 |
| ✅ | Comment input | Comments section in card detail — post, edit own, delete own; Cmd+Enter to submit |
| ✅ | User menu (nav bar) | `components/Nav.tsx` — logo, breadcrumb, avatar, sign-out dropdown |
| ⬜ | Frontend unit tests (Vitest + React Testing Library) | Deferred to Phase 5 |

---

## Phase 4 – Features

> Goal: Complete the full feature set as specified in the requirements.

| Status | Task | Notes |
|--------|------|-------|
| ⬜ | Board membership management | Invite users; assign roles (owner/editor/viewer) |
| ⬜ | Card linking | Link cards to each other; display in sidebar |
| ⬜ | Acceptance criteria checklist rendering | Interactive checkboxes in card detail |
| ⬜ | Full-text search with highlighted matches | `$text` index or Atlas Search |
| ⬜ | Activity log display in card detail | Chronological event list |
| ⬜ | Real-time: live card moves reflected without reload | Via SSE + TanStack Query invalidation |
| ⬜ | Real-time: live comments | New comments appear without reload |
| ⬜ | Board description (Markdown) | Rendered in board header or info panel |
| ⬜ | Additional themes | At least one additional theme beyond light/dark |
| ⬜ | Error states & loading skeletons | All data-fetching surfaces |
| ⬜ | Empty states | New board, empty column, no search results |

---

## Phase 5 – Quality & Delivery

> Goal: Production-ready, tested, and documented.

| Status | Task | Notes |
|--------|------|-------|
| ⬜ | E2E tests (Playwright) | Critical user flows: login, create board, create card, move card |
| ⬜ | Security review | CORS config; Markdown sanitization; JWT validation; input validation |
| ⬜ | Dependency audit | `pnpm audit`; address all high/critical findings |
| ⬜ | Performance review | MongoDB query plans; frontend bundle size |
| ⬜ | Accessibility audit | Keyboard navigation; screen reader labels; focus management |
| ⬜ | CI pipeline (GitHub Actions or GitLab CI) | Lint → test → build → push Docker images |
| ⬜ | Environment configuration guide | `.env.example`; deployment checklist |
| ⬜ | Update architecture document | Reflect any deviations made during implementation |
