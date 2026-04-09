# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- FR-09 (Diagrams and Drawings): Mermaid in Markdown fences; Excalidraw as named card attachments (`CardDrawing` sub-resource) referenced via `![[name.excalidraw]]` wikilink transclusion — Obsidian-style, no inline JSON blobs; SVG cached server-side; drawings panel in card edit view; `ExcalidrawModal` for creating and editing; updated in `docs/requirements.md`, `docs/planning.md`, `docs/architecture.md` (ADR-13, data model, API)
- `docker-compose.prod.yml` for deploying published Docker Hub images without building from source
- `config/dex.yaml.example` — tracked template with all test accounts (password `Test1234!`) and `${FLEXBOARD_BASE_URL}` placeholders; copy to `config/dex.yaml` for VM/CI deployments without running `init.sh`
- `docker-compose.tls.yml` — compose overlay that adds HTTPS via a self-signed cert (required for OIDC on non-localhost IPs; `crypto.subtle` is only available in secure contexts)
- `docker/nginx-tls.conf` — nginx config with TLS termination and HTTP→HTTPS redirect, used by the TLS overlay

### Changed
- Frontend OIDC authority now derived from `window.location.origin` at runtime — the same Docker image works under any hostname or IP without rebuild
- `FLEXBOARD_BASE_URL` env var now controls backend `CORS_ORIGIN` and `DEX_ISSUER` via Docker Compose substitution
- `config/dex.yaml.example` uses `${FLEXBOARD_BASE_URL}` placeholders; deployment generates `config/dex.yaml` via `sed "s|\${FLEXBOARD_BASE_URL}|$FLEXBOARD_BASE_URL|g" config/dex.yaml.example > config/dex.yaml` (Dex does not expand shell variables from its environment)
- `scripts/init.sh` generates `dex.yaml` with `${FLEXBOARD_BASE_URL}` placeholders (for subsequent `sed` substitution) instead of hardcoded localhost URLs

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
