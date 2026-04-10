# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
