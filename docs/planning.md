# Flexboard – Project Planning

> **Last updated:** 2026-04-21 (v0.5.2: default columns on board creation)  
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
| ✅ | Configure OIDC provider | Originally Zitadel; replaced by **Dex** (static passwords, no external DB). `scripts/init.sh` generates `config/dex.yaml` with bcrypt-hashed admin password. |
| ✅ | Integrate OIDC into frontend (OIDC client, login redirect) | `lib/auth.ts` — `oidc-client-ts`, PKCE. Authority: `http://localhost/dex`. |
| ✅ | Validate JWT in backend (`jose` + Dex JWKS) | `lib/auth.ts` — `createRemoteJWKSet`; `requireAuth` preHandler on all routes. `DEX_ISSUER` / `DEX_JWKS_URL` env vars. |
| ✅ | Verify full auth round-trip via `docker compose up` | Login → Dex → `/auth/callback` → token → `/api/v1/me` ✓ |

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
| ✅ | SSE broker + endpoint (`/api/v1/boards/:id/events`) | `lib/sse.ts` — in-memory registry; `routes/sse.ts` — token via `?token=` (EventSource header limitation); keepalive every 25 s |
| ⬜ | Input validation via Zod on all endpoints | Currently inline type checks; Zod integration from `packages/shared` deferred |
| ✅ | Board-level permission checks | Role-based (`owner`/`editor`/`viewer`) via `lib/permissions.ts` helpers; enforced on every route handler |
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
| ✅ | Implement SSE hook (`useBoardSSE`) | `hooks/useBoardSSE.ts` — opens EventSource, invalidates queries on events, exponential-backoff reconnect (3 retries) |
| ✅ | Dashboard page | `pages/Dashboard.tsx` — board grid; "New Board" modal; accent colours per board |
| ✅ | Board page (Kanban view) | `pages/Board.tsx` — board title in toolbar; columns + cards; add-card modal in toolbar (column + type + title, opens card in edit mode); add-column modal (edit mode only); card shows number (last 5 hex of ObjectId), labels, priority dot, assignee avatar initials |
| ✅ | Drag-and-drop (dnd-kit) | `@dnd-kit/core` + `@dnd-kit/sortable`; card reorder within column and move between columns; optimistic local state |
| ✅ | Card detail view | `pages/CardDetail.tsx` — two-panel layout; Markdown rendering; inline edit with dynamic attribute fields; comments; activity log in sidebar; Save/Cancel/Delete in one action row; cancel resets all edit state |
| ✅ | Card form (create / edit) | Edit form includes all schema-driven attribute fields (`AttributeInput`); inline create in Board for quick add (type + title) |
| ⬜ | Search page | Deferred to Phase 4 |
| ✅ | Comment input | Comments section in card detail — post, edit own, delete own; Cmd+Enter to submit; confirmation dialog on edit cancel with changes and on delete |
| ✅ | Confirmation dialogs | `ConfirmDialog` component; guards on: cancel dirty card edit, cancel dirty comment edit, delete card, delete comment, remove board member (FR-07) |
| ✅ | Navigation guard | `useBlocker` (React Router data router) + `beforeunload` block in-app and browser-native navigation when card has unsaved changes (FR-07) |
| ✅ | React Router data router migration | `createBrowserRouter` + `RouterProvider`; `AuthGate` uses `<Outlet />`; required for `useBlocker` |
| ✅ | User menu (nav bar) | `components/Nav.tsx` — logo, breadcrumb, avatar, sign-out dropdown |
| ✅ | Version display in nav bar | Frontend version injected at build time via Vite `define` (`__APP_VERSION__`); backend exposes `GET /api/v1/version`; both shown as small muted text on desktop; amber ⚠ indicator when versions differ |
| ⬜ | Frontend unit tests (Vitest + React Testing Library) | Deferred to Phase 5 |

---

## Phase 4 – Features

> Goal: Complete the full feature set as specified in the requirements.

| Status | Task | Notes |
|--------|------|-------|
| ✅ | Board membership — data model | `members: [{ userId, role }]` on Board; creator auto-assigned `owner` role; `users` collection populated on every auth request |
| ✅ | Board membership — backend enforcement | `lib/permissions.ts` helpers (`canRead`, `canWrite`, `isOwner`); enforced on all board/column/card/comment/activity/SSE routes |
| ✅ | Board membership — invite API | `POST /api/v1/boards/:id/members` (owner only); lookup by email from `users` collection |
| ✅ | Board membership — manage API | `PATCH /api/v1/boards/:id/members/:userId` (role change); `DELETE` (remove); last-owner guard on both |
| ✅ | Dashboard — "My Boards" / "Shared With Me" split | `Dashboard.tsx` splits boards by whether current user's role is `owner` vs `editor`/`viewer` |
| ✅ | Board settings panel | `BoardMembers.tsx` modal: list members with enriched profiles, invite by email + role, change role dropdown, remove button |
| ⬜ | User management (Dex config) | Document admin workflow for adding/removing users in `config/dex.yaml` |
| ✅ | Column selector in card edit view | Column is the first row in the Attributes sidebar section; `<select>` dropdown in edit mode saves `columnId` via existing PATCH endpoint; dirty-ring, ✎ indicator, and navigation-guard consistent with other attributes (touch-friendly alternative to drag-and-drop) |
| ✅ | Board edit mode | Owner-only toggle in board toolbar; board starts in view mode (cards remain fully interactive); edit mode unlocks: board name inline editing (auto-saves on blur), column ← → reorder buttons, column delete (cascade-deletes cards, confirmation required), add column modal, Members modal, Delete board (confirmation required); non-owners and editors never see the edit toggle |
| ⬜ | Card linking | Link cards to each other; display in sidebar |
| ✅ | Acceptance criteria checklist rendering | `- [ ]`/`- [x]` task list items rendered as interactive checkboxes in view mode; clicking toggles state and saves immediately via PATCH; applies to card description and all `markdown` attribute fields |
| ⬜ | Full-text search with highlighted matches | `$text` index or Atlas Search |
| ✅ | Activity log display in card detail | `ActivitySection` component at the bottom of the sidebar; fetches via `GET /api/v1/.../activity`; renders event label + relative timestamp; hidden when empty |
| ✅ | Real-time: live card moves reflected without reload | Via SSE + TanStack Query invalidation |
| ✅ | Real-time: live comments | New comments appear without reload |
| ✅ | Board description (Markdown) | Rendered below board toolbar for all members; owners can edit inline (pencil icon or "Add a description…" placeholder); saves via PATCH `/api/v1/boards/:id`; full `.prose` Markdown rendering |
| ⬜ | Additional themes | At least one additional theme beyond light/dark |
| ⬜ | Error states & loading skeletons | All data-fetching surfaces |
| ⬜ | Empty states | New board, empty column, no search results |
| ⬜ | Mermaid diagrams in Markdown | Add `rehype-mermaid` (or equivalent) to the markdown plugin pipeline in `lib/markdown.ts`; render `\`\`\`mermaid` fences as diagrams in all Markdown fields (FR-09) |
| ⬜ | Drawings — shared types | Add `CardDrawing` type to `packages/shared` (`id`, `name`, `svg`, `excalidraw`, `createdAt`, `updatedAt`); no `AttributeType` change needed |
| ⬜ | Drawings — `CardDrawing` Mongoose model + routes | `drawings` collection; CRUD routes under `/api/v1/boards/:boardId/cards/:cardId/drawings`; backend generates SVG cache on create/update using `excalidraw-to-svg`; unique index on `(cardId, name)` (FR-09) |
| ⬜ | Drawings — remark transclusion plugin | Custom remark plugin that parses `![[name.excalidraw]]` wikilink syntax and emits a placeholder node; `react-markdown` component override resolves the name against a `DrawingsContext` and renders the cached SVG inline (FR-09) |
| ⬜ | Drawings — `ExcalidrawModal` component | Full-screen modal wrapping `<Excalidraw initialData={...}>` from `@excalidraw/excalidraw`; Save calls the drawings API and refreshes the drawings list; Cancel discards; lazy-loaded (code-split) due to bundle size (~1 MB) |
| ⬜ | Drawings — attachment panel in card edit view | "Drawings" section in card detail listing attached drawings with name, SVG thumbnail, Edit and Delete actions; "Add drawing" button creates a new attachment and opens `ExcalidrawModal`; opening editor counts as a dirty state for the navigation guard (FR-09) |
| ⬜ | Drawings — transclusion click-to-edit | Clicking a rendered `![[name.excalidraw]]` SVG in edit mode opens `ExcalidrawModal` for that drawing |
| ✅ | Responsive CSS — mobile-first base styles | `src/index.css` converted to mobile-first; `@media (min-width: 640px)` and `(min-width: 1024px)` blocks restore desktop layout (FR-10) |
| ✅ | Responsive CSS — touch targets | `nav-icon-btn`, `nav-avatar`, `modal-close`, `kanban-add-btn`, `comment-action-btn` all ≥ 44×44 px; `btn-sm` boosted on mobile (FR-10) |
| ✅ | Board — horizontal scroll snap on mobile | `scroll-snap-type: x mandatory`; full-viewport-width columns; `IntersectionObserver` drives indicator dots; dots hidden at ≥ 640 px (FR-10) |
| ✅ | Card detail — single-column layout on mobile | `flex-direction: column` on mobile; grid restored at ≥ 1024 px; attributes section accordion with `attrOpen` state (FR-10) |
| ✅ | Markdown editor — tab toggle on mobile | Write/Preview tab bar on mobile; `md-pane-hidden` hides inactive pane (display:none preserves value); split-pane restored at ≥ 640 px (FR-10) |
| ✅ | Navigation — breadcrumb truncation | `…` expand button shows/hides ancestor crumb segments via `data-expanded`; button hidden at ≥ 640 px (FR-10) |
| ✅ | Touch drag-and-drop validation | dnd-kit `PointerSensor` uses `{ delay:200, tolerance:8 }` on mobile (prevents scroll-swipe triggering drag), `{ distance:5 }` on desktop; `isMobile` state reactive to resize (FR-10) |
| ✅ | Fullscreen description editor on mobile | ⛶ button next to Description label (hidden at ≥640 px); opens `position:fixed` overlay (z-index 400) with MarkdownEditor filling viewport below a header bar; "Done" button exits; hides all other card content while editing (FR-10) |
| ⬜ | Excalidraw — mobile touch support | Confirm `@excalidraw/excalidraw` supports pinch-to-zoom and touch drawing in `ExcalidrawModal`; drawing previews render full-width on mobile (FR-10) |

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
