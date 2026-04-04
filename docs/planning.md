# Flexboard – Project Planning

> **Last updated:** 2026-04-04 (full stack running; Zitadel OIDC integration next)  
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
| ⬜ | Configure Zitadel (initial setup) | OIDC application, client ID, redirect URIs |
| ⬜ | Integrate Zitadel into frontend (OIDC client, login redirect) | `lib/auth.ts` |
| ⬜ | Validate JWT in backend (`jose` + Zitadel JWKS) | Auth middleware on all protected routes |
| ⬜ | Verify full auth round-trip via `docker compose up` | Login → token → protected API call |

---

## Phase 2 – Backend Core

> Goal: All REST endpoints implemented, tested, and documented.

| Status | Task | Notes |
|--------|------|-------|
| ⬜ | Connect to MongoDB via Mongoose | Connection pooling, error handling on startup |
| ⬜ | Define Mongoose models | `Board`, `Column`, `Card`, `Comment`, `ActivityLog`, `CardTypeSchema` |
| ⬜ | Implement card type schema seeding | Read `config/card-types.yaml` → upsert into MongoDB on startup |
| ⬜ | Boards API (`/api/v1/boards`) | Full CRUD |
| ⬜ | Columns API (`/api/v1/boards/:id/columns`) | CRUD + reorder |
| ⬜ | Cards API (`/api/v1/boards/:id/cards`, `/api/v1/cards/:id`) | CRUD + move |
| ⬜ | Comments API (`/api/v1/cards/:id/comments`) | CRUD |
| ⬜ | Activity log — write on card mutations | Middleware or service layer hook |
| ⬜ | Card type schemas API (`/api/v1/card-types`) | Read-only |
| ⬜ | Search endpoint (`/api/v1/search`) | Full-text + attribute filters |
| ⬜ | SSE broker implementation | In-memory per-board subscriber registry |
| ⬜ | SSE endpoint (`/api/v1/boards/:id/events`) | Auth-guarded; emit on all card/column mutations |
| ⬜ | Input validation via Zod on all endpoints | Use schemas from `packages/shared` |
| ⬜ | Board-level permission checks | Owner / editor / viewer enforced per route |
| ⬜ | OpenAPI spec generation | Auto-generated from Fastify route schemas |
| ⬜ | Backend unit tests (Vitest) | Services and validation logic |
| ⬜ | Backend integration tests | Against real MongoDB (Testcontainers) |

---

## Phase 3 – Frontend Core

> Goal: All five screens functional, connected to the real API.

| Status | Task | Notes |
|--------|------|-------|
| ⬜ | Set up TanStack Query | Global `QueryClient`, devtools in dev |
| ⬜ | Set up Zustand store (`uiStore`) | Theme, active filters, sidebar state |
| ⬜ | Set up react-i18next | `lib/i18n.ts`; load `locales/en.json` |
| ⬜ | Implement theming (light/dark) | CSS custom properties; FOUC prevention; `localStorage` persistence |
| ⬜ | Implement typed API client | `lib/api.ts` — fetch wrapper with auth header injection |
| ⬜ | Implement SSE hook (`useBoardSSE`) | `EventSource` wrapper → `queryClient.invalidateQueries` |
| ⬜ | Dashboard page | List boards; create board button |
| ⬜ | Board page (Kanban view) | Columns + cards; filter toolbar |
| ⬜ | Drag-and-drop (dnd-kit) | Card reorder within column; card move between columns |
| ⬜ | Card detail view | Two-panel layout; Markdown rendering; activity log |
| ⬜ | Card form (create / edit) | Type selector; dynamic attribute fields from schema; Markdown editor |
| ⬜ | Search page | Filter chips; live results with highlighted matches |
| ⬜ | Comment input | Markdown editor; submit; edit/delete own comments |
| ⬜ | User menu (nav bar) | Theme switcher; logout |
| ⬜ | Frontend unit tests (Vitest + React Testing Library) | Key components and hooks |

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
