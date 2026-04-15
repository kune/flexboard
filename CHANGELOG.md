# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Marketing website (`website/`) — single-page landing site for flexboard.org with light/dark mode toggle, kanban board mockup, feature overview, getting-started code snippet, and tech stack section; ready for GitHub Pages hosting (includes `CNAME` file)
- SVG logo assets (`icons/`): cropped viewBoxes to remove excess whitespace on all four logos; added dark-background variants (`icon_dark.svg`, `logo_header_dark.svg`, `logo_promo_dark.svg`, `logo_v4_dark.svg`)

## [0.5.1] - 2026-04-15

### Changed
- Profile picture service switched from Gravatar to Libravatar (`seccdn.libravatar.org`); the "Set up / Change profile picture" link in the user menu now points to libravatar.org

## [0.5.0] - 2026-04-14

### Added
- Multi-URL deployment support: the app can now be accessed from two different URLs (e.g. internal LAN and external internet) pointing to the same deployment
  - Nginx injects the canonical Dex issuer URL into `/config.js` at container startup via `envsubst`; the frontend reads `window.__FLEXBOARD_DEX_ISSUER__` so that JWT `iss` validation works regardless of which URL the user accesses
  - Backend `CORS_ORIGIN` now accepts a comma-separated list of origins
  - `config/dex.yaml.example` documents how to add additional `redirectURIs`

## [0.4.1] - 2026-04-12

### Fixed
- Docker images: version no longer shows `-dirty` suffix on clean releases — the CI runner now pre-computes the version via `git describe` and passes it as `APP_VERSION_RAW` build-arg, so the build running inside the container never calls `git describe` after steps that could modify the working tree

## [0.4.0] - 2026-04-12

### Added
- Gravatar profile pictures throughout the app: nav bar avatar, board card assignees, comment avatars, and activity log entries — all use the new `UserAvatar` component with Gravatar fetch and deterministic coloured-initials fallback
- Gravatar link in profile dropdown: shows "Set up profile picture" when no Gravatar is found, "Change profile picture" when one exists
- Activity log enriched: each entry now shows the actor's avatar and name; column moves show real column names ("moved from Backlog to In Progress"); title renames show before/after values; attribute changes show field name, old value, and new value (dates formatted, user references resolved to names)
- Real-time dashboard update: the dashboard now refreshes automatically when another user adds, removes, or changes the current user's board membership — via a new user-level SSE stream (`GET /api/v1/events`)
- Board edit mode: toolbar overflow menu (⋯) replaces individual buttons for better mobile compatibility — view mode ⋯ contains "Edit board" (owner only); edit mode ⋯ contains "Members" and "Delete board"
- Inline column rename in board edit mode: the column title becomes an editable input; Enter or blur saves, Escape reverts
- Activity section in card detail is now collapsible (▲/▼ toggle), collapsed by default
- Version display: version string now derived from `git describe --tags --dirty`; shows a `-dirty` suffix when the working tree has uncommitted changes

### Fixed
- Activity log: fields sent unchanged by the client (title, description, attributes) are no longer recorded as changed — only fields whose value actually differs from the stored value create an activity entry
- Board toolbar: "Add Card" button hidden in edit mode to avoid confusion
- Board toolbar: "Add Column" button width matches the column width on mobile
- Card detail sidebar: accordion carets (▲/▼) for Attributes and Activity now visible on desktop
- New card creation: clicking Save now navigates back to the board view instead of staying on the card
- New card creation: the navigation blocker no longer triggers a "Discard changes?" dialog after a successful save

## [0.3.1] - 2026-04-12

### Added
- Version display in nav bar: current frontend version shown as small muted text on desktop (≥ 640 px); turns amber with a ⚠ indicator when the frontend and backend versions differ (useful after a partial image update)

### Fixed
- Board deletion no longer leaves the deleted board visible on the dashboard — the boards query is now invalidated before navigating back to `/`

## [0.3.0] - 2026-04-12

### Added
- Acceptance criteria checklist rendering: `- [ ]`/`- [x]` task list items in card description and markdown attribute fields render as interactive checkboxes in view mode; clicking a checkbox immediately toggles and saves via `PATCH`; edit mode shows the raw markdown as before
- Board title displayed in board toolbar: board name shown on the left side of the toolbar in view mode (same position becomes an editable input in edit mode)
- Board description in board header: Markdown description rendered below the board toolbar for all members; board owners see a pencil (✎) icon to edit inline, or an "Add a description…" placeholder when empty; saves via `PATCH /api/v1/boards/:id` (field already existed on the backend model)
- Board description preview in dashboard tiles: description shown as plain-text excerpt (markdown stripped) with 2-line clamp
- Board name editing in edit mode: editable input in the toolbar replaces the board name when edit mode is active; auto-saves on blur via `PATCH /api/v1/boards/:id`; reverts to previous name if left empty
- Add card moved to board toolbar: "+ Add card" button in toolbar opens a modal (column selector defaulting to first column, type selector, title input); on creation the card opens directly in edit mode; per-column inline form removed
- Column selector in card edit view: Column is now the first row in the Attributes sidebar section (view and edit); a `<select>` dropdown in edit mode moves the card to the chosen column without drag-and-drop (useful on touch interfaces); includes dirty-ring, ✎ indicator, and navigation-guard support consistent with all other attributes
- Board edit mode: board toolbar shows an "Edit board" button for owners only; board defaults to view mode where cards remain fully interactive but board structure is locked; activating edit mode reveals column ← → reorder buttons, column delete with confirmation (cascades to cards), add column, Members management, and Delete board with confirmation

### Fixed
- Development mode: `docker-compose.dev.yml` disabled the `frontend` service (the only nginx container), leaving nothing on port 80; added a dedicated lightweight nginx service with `docker/nginx-dev.conf` that proxies `/dex/*` → Dex container, `/api/*` → local backend dev server (`:3001`), and `/*` → Vite dev server (`:5173`) including HMR WebSocket
- Development mode: Vite dev server and Fastify both defaulted to binding on `127.0.0.1`; Docker's nginx reaches the host via `host.docker.internal` (a different IP), so both would refuse connections — fixed by adding `host: true` to `vite.config.ts` and `HOST=0.0.0.0` to the backend dev env
- Development mode: backend `dev` script did not load `.env.local`, so `PORT`, `MONGO_URI`, and `DEX_JWKS_URL` overrides were silently ignored — fixed by adding `--env-file-if-exists .env.local` to the `tsx watch` invocation (requires Node 22.13+)
- Development mode: README and `.env.local` template used `MONGODB_URI` but `db.ts` reads `MONGO_URI`; corrected to `MONGO_URI`
- Development mode: `seed.ts` resolved `config/card-types.yaml` relative to `process.cwd()`, which is `/app` in Docker but `apps/backend` when run via `pnpm --filter` — fixed by probing both paths and using whichever exists
- Development mode: Vite proxy targeted `http://localhost:3000` for `/api` but the backend dev env sets `PORT=3001`; corrected to `3001` and added a `/dex` proxy entry for OIDC flows when accessing via Vite directly
- OIDC login on deployments with self-signed certificates: pre-seed `UserManager` metadata so oidc-client-ts skips the discovery fetch (a JavaScript `fetch()` that fails before user interaction on untrusted certs); disable `automaticSilentRenew` to prevent the `prompt=none` redirect loop caused by Dex's local-password connector not returning `login_required`

## [0.2.0] - 2026-04-10

### Added
- FR-10 – Responsive Design and Touch Support: mobile-first CSS (breakpoints `< 640 px` / `640–1024 px` / `≥ 1024 px`); scroll-snap Kanban with column indicator dots; card detail single-column collapse with attributes accordion; Markdown editor Write/Preview tab toggle; fullscreen description editor (⛶ button, visible on mobile only); breadcrumb truncation with expand button; 44 × 44 px touch targets throughout; dnd-kit `PointerSensor` with `{ delay: 200, tolerance: 8 }` on mobile; `env(safe-area-inset-bottom)` on unsaved bar
- `docker-compose.prod.yml` — deploy from published Docker Hub images without building from source
- `config/dex.yaml.example` — tracked template with all test accounts (password `Test1234!`) and `${FLEXBOARD_BASE_URL}` placeholders for VM/CI deployments
- `docker-compose.tls.yml` — compose overlay that adds HTTPS via a self-signed cert (required for OIDC on non-localhost IPs; `crypto.subtle` is only available in secure contexts)
- `docker/nginx-tls.conf` — nginx config with TLS termination and HTTP → HTTPS redirect

### Changed
- Frontend OIDC authority now derived from `window.location.origin` at runtime — the same Docker image works under any hostname or IP without rebuild
- `FLEXBOARD_BASE_URL` env var controls backend `CORS_ORIGIN` and `DEX_ISSUER` via Docker Compose substitution
- `config/dex.yaml.example` uses `${FLEXBOARD_BASE_URL}` placeholders; deployment substitutes via `sed "s|\${FLEXBOARD_BASE_URL}|$FLEXBOARD_BASE_URL|g" config/dex.yaml.example > config/dex.yaml` (Dex does not expand shell variables from its config file)

### Fixed
- `scripts/init.sh`: single-quoted heredoc (`<<'EOF'`) wrote `${FLEXBOARD_BASE_URL}` literally into `config/dex.yaml`; Dex received an invalid issuer URL and failed its healthcheck — fixed by expanding the variable at generation time
- `scripts/init.sh`: re-running the script with an existing unhealthy Dex container caused an immediate dependency failure; added `--force-recreate` so containers are always replaced on every run (MongoDB volumes unaffected)
- Mobile: Write/Preview tab toggle did not work — `.md-pane-hidden` was declared before `.md-editor-pane` in the stylesheet; same specificity meant `display: flex` always won; fixed by swapping declaration order
- Mobile: iOS Safari zoomed on textarea focus — `.md-editor-textarea { font-size: 13px !important }` outranked the generic mobile override; added an explicit `.md-editor-textarea` rule in the mobile media block

## [0.1.0] - 2026-04-07

### Added
- Monorepo setup (pnpm workspaces + Turborepo), shared types package
- Backend: Fastify + MongoDB, full REST API (boards, columns, cards, comments, activity log, SSE)
- Backend: OIDC authentication via Dex (JWT validation with jose)
- Backend: Role-based access control (owner / editor / viewer) with permission helpers
- Backend: Board membership API (invite by email, role changes, remove member)
- Frontend: React SPA with TanStack Query, React Router v6 data router
- Frontend: Dashboard with "My Boards" / "Shared With Me" split
- Frontend: Kanban board view with drag-and-drop (dnd-kit), card number, priority dot, labels, assignee avatar
- Frontend: Card detail view — two-panel layout, inline edit, attribute fields, comments, activity log
- Frontend: Markdown editor with live split-pane preview (remark-gfm, rehype-highlight, extended syntax)
- Frontend: Confirmation dialogs for all destructive actions (ConfirmDialog component)
- Frontend: Navigation guard (useBlocker + beforeunload) when card or comment has unsaved changes
- Frontend: Unsaved-changes indicators — browser tab prefix, per-field dirty ring (✎), sticky bar
- Frontend: Board members management modal (invite, role change, remove)
- Docker: Multi-stage Dockerfiles for frontend (nginx) and backend (Node.js)
- CI: GitHub Actions workflow — builds and pushes kune/flexboard-frontend and kune/flexboard-backend to Docker Hub
