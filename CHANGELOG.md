# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- `docker-compose.prod.yml` for deploying published Docker Hub images without building from source
- `config/dex.yaml.example` — tracked template with all test accounts (password `Test1234!`) and `${FLEXBOARD_BASE_URL}` placeholders; copy to `config/dex.yaml` for VM/CI deployments without running `init.sh`

### Changed
- Frontend OIDC authority now derived from `window.location.origin` at runtime — the same Docker image works under any hostname or IP without rebuild
- Single `FLEXBOARD_BASE_URL` env var (default `http://localhost`) now controls Dex issuer, Dex redirect URI, backend CORS origin, and backend JWT issuer validation
- `config/dex.yaml` uses `${FLEXBOARD_BASE_URL}` substitution (native Dex feature) for issuer and redirectURIs
- `scripts/init.sh` generates `dex.yaml` with `${FLEXBOARD_BASE_URL}` placeholders instead of hardcoded localhost URLs

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
