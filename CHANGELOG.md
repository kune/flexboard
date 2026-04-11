# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Column selector in card edit view: Column is now the first row in the Attributes sidebar section (view and edit); a `<select>` dropdown in edit mode moves the card to the chosen column without drag-and-drop (useful on touch interfaces); includes dirty-ring, ✎ indicator, and navigation-guard support consistent with all other attributes

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
