# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

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
