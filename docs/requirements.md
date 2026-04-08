# Flexboard – Requirements Document

> **Name:** Flexboard  
> **Version:** 0.4  
> **Date:** 2026-04-08  
> **Status:** Updated — FR-09 refined: Excalidraw inline in Markdown added

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Functional Requirements](#functional-requirements)
3. [Architectural Requirements](#architectural-requirements)
4. [Technical Requirements](#technical-requirements)
5. [UI Mockups](#ui-mockups)
6. [Open Questions](#open-questions)

---

## Project Overview

Flexboard is a web-based project management application inspired by Jira and Trello. Its core concept is a flexible, JSON-based data model for cards/tasks that supports different card types with their own metadata and stores free-text fields in Markdown format. The application is designed to be operated as a containerized system.

---

## Functional Requirements

### FR-01 – Boards

- The system treats **boards** as the top-level organizational unit.
- Each board has a name, an optional description (Markdown), and belongs to a user or a team.
- Boards can contain **lists/columns** (e.g. "Backlog", "In Progress", "Done"). The order and names of columns are freely configurable.
- Boards, columns, and cards can be created, edited, moved, and deleted.

### FR-02 – Cards / Tasks

- Within a column there are **cards** (= tasks/tickets).
- Cards can be reordered within a column and moved between columns.
- Each card has a **card type** (e.g. `task`, `bug`, `story`, `epic`). Card types are extensible.
- The **description** of a card is stored in **Markdown format** and rendered accordingly.

### FR-03 – Metadata / Attributes

- Each card carries a set of **metadata/attributes** that may vary by card type.
- Standard attributes (present in all card types):
  - `title` – required field, short text
  - `status` – processing status (configurable per board or card type)
  - `created_at`, `updated_at` – timestamps (system-generated)
  - `created_by` – creator (user reference)
- Optional/type-specific attributes (selection):
  - `assignee` – person responsible (user reference or free text)
  - `priority` – priority level (e.g. `low`, `medium`, `high`, `critical`)
  - `category` / `labels` – categorization, multiple tags supported
  - `due_date` – due date
  - `story_points` – effort estimate
  - `acceptance_criteria` – acceptance criteria in **Markdown format**
  - `linked_cards` – references to other cards (list of references)
- The attribute schema of a card type can be stored and extended in the system without requiring database migrations.
- Certain attribute values may themselves be **Markdown text** (e.g. `description`, `acceptance_criteria`, `notes`).

### FR-04 – Users and Permissions

#### User management

- The system supports **user accounts** with authentication via OIDC (OpenID Connect).
- The identity provider is **Dex** (self-hosted, runs as a Docker container). User accounts are defined as **static passwords** in `config/dex.yaml` and managed by the administrator.
- Adding or removing a user requires editing `config/dex.yaml` and restarting the Dex container — no in-app registration UI is provided.
- Passwords are stored as **bcrypt hashes** in `config/dex.yaml`; the plaintext password is never persisted.
- A dedicated admin account (`admin@flexboard.localhost`) is created during initial setup via `scripts/init.sh`.

#### Board-level role model

Boards support **role-based access control** with three roles:

| Role | Who | Capabilities |
|------|-----|-------------|
| `owner` | The user who created the board (or a promoted member) | Full CRUD on board settings, columns, and cards; invite/remove members; change member roles; delete the board |
| `editor` | Invited collaborators with write access | Create, edit, move, and delete cards and columns; add and manage their own comments |
| `viewer` | Invited collaborators with read-only access | View all board content and comments; cannot create, edit, or delete anything |

- Every board has exactly one `owner` at creation time (the authenticated user who created it).
- The `owner` can invite other users by their registered email address and assign them a role.
- The `owner` can change the role of any member, including promoting another member to `owner`.
- A board always has at least one `owner`; the last owner cannot be removed.
- The dashboard distinguishes between **My Boards** (boards where the user is owner) and **Shared With Me** (boards where the user is editor or viewer).
- All board data — columns, cards, comments, activity — is scoped to users with at least `viewer` access. Unauthenticated or unauthorised requests are rejected with `401`/`403`.

### FR-05 – Search and Filtering

- Cards can be filtered by attributes across boards or within a single board (e.g. by assignee, status, label, card type).
- Full-text search across titles and descriptions is desirable.

### FR-06 – Comments and Activity Log

- Cards can receive **comments** (free text, Markdown-capable) associated with a user and a timestamp.
- Changes to cards are recorded in an **activity log** (who changed what, and when?).

### FR-07 – Confirmation Dialogs

To prevent accidental data loss, the UI shows a **confirmation dialog** before any of the following actions:

| Trigger | Dialog behaviour |
|---------|-----------------|
| Cancelling a card edit when changes have been made | "Discard changes?" — lists that unsaved edits will be lost; confirm button labelled **Discard** |
| Cancelling a comment edit when the text has been changed | Same "Discard changes?" pattern |
| Deleting a card | "Delete card?" — shows card title; confirm button labelled **Delete** |
| Deleting a comment | "Delete comment?" — warns action cannot be undone; confirm button labelled **Discard** |
| Removing a member from a board | "Remove member?" — names the member and states they will lose access; confirm button labelled **Remove** |

Dialogs are rendered as modal overlays (using the shared `ConfirmDialog` component). The confirm button is styled in red (`btn-danger`) for all destructive actions. Clicking the backdrop or the Cancel button always dismisses the dialog without taking action.

Edits with **no changes** (e.g. opening edit mode and immediately clicking Cancel) dismiss directly without a dialog.

#### Navigation guard

When a card is in edit mode **and** has unsaved changes, leaving the page is also blocked:

- **In-app navigation** (clicking a link, using browser Back/Forward) is intercepted by `useBlocker` (React Router data router). A "Discard changes?" confirmation dialog is shown before the navigation proceeds.
- **Browser-native navigation** (address-bar entry, tab close, page reload) triggers the browser's own `beforeunload` prompt, which prevents accidental loss without a custom dialog.

Both guards apply whenever the card is in dirty edit mode **or** a comment draft has been typed but not yet posted. They are cleared as soon as the card is saved, the edit is cancelled, or the comment is submitted.

### FR-09 – Diagrams and Drawings

Cards support two complementary ways to embed visual content:

#### Text-based diagrams (Mermaid)

- Any Markdown field — card description, attribute fields of type `markdown`, and comments — supports Mermaid diagram code blocks.
- Content fenced with ` ```mermaid ` is rendered as a diagram in view mode rather than as plain text.
- Supported diagram types include at minimum: flowcharts, sequence diagrams, class diagrams, entity-relationship diagrams, and Gantt charts (the standard Mermaid feature set).
- In edit mode the code block is displayed as editable text; the rendered diagram is visible in the live preview pane.
- Diagrams are stored as part of the Markdown text — no separate data model or API changes are required.

#### Freehand drawing canvas — inline in Markdown

- Any Markdown field (card description, `markdown`-typed attributes, comments) supports an Excalidraw fenced code block:
  ````
  ```excalidraw
  { "type": "excalidraw", "version": 2, "elements": [...], "appState": {...} }
  ```
  ````
- In **view mode** the code block is replaced by a static SVG rendering of the drawing. A small "Edit" affordance on hover opens the interactive canvas.
- In **edit mode** (inside the split-pane `MarkdownEditor`) the code block's content is displayed as raw JSON in the textarea pane; the preview pane renders the static SVG. Clicking the SVG opens an Excalidraw canvas in a modal overlay; saving the modal serialises the updated scene JSON back into the code block in the textarea.
- Multiple ```` ```excalidraw ```` blocks may appear in a single Markdown field, each independently editable.
- The drawing data (Excalidraw JSON) is stored as part of the Markdown string — no separate data model changes are required for this variant.

#### Freehand drawing canvas — as a card attribute

- Cards may carry one or more **freehand drawings** attached as a dedicated attribute field of the new type `drawing`.
- Card type schemas may include `drawing`-typed attributes (e.g. `{ key: "diagram", type: "drawing" }`); existing card types may gain them without migration.
- In **view mode** the drawing is rendered as a static SVG preview inline in the card detail.
- In **edit mode** the drawing opens in a full interactive Excalidraw canvas embedded in the page. Changes are discarded or saved with the rest of the card edit.
- `editor` and `owner` roles may create, modify, and delete drawings; `viewer` role has read-only access.
- Drawings are stored as structured JSON (Excalidraw open format) in the card's `attributes` map. An SVG export is cached alongside the JSON for fast view-mode rendering.
- The unsaved-changes guard (FR-07) extends to drawing edits: navigating away from an edited drawing triggers the same "Discard changes?" confirmation as other dirty fields.

Both embedding styles use the same rendering and editing library (Excalidraw); the difference is where the data lives (inline in the Markdown string vs. in the card attributes map).

### FR-08 – Real-time Updates

- Changes made by other users are reflected live in the UI without a page reload, using **Server-Sent Events (SSE)**.
- Events pushed in real time include: card moved, card created/deleted, card attribute changed, new comment added.
- Clients subscribe to a board-scoped SSE stream (`GET /api/v1/boards/:id/events`).
- On reconnect (e.g. after a network interruption), the client re-fetches current state via REST and reattaches to the stream.

---

## Architectural Requirements

### AR-01 – Monorepo Structure

- The project is maintained as a **monorepo**. All sub-projects (frontend, backend, and optionally shared types/schemas) reside in a single repository.
- Packages and applications are clearly separated (e.g. `apps/frontend`, `apps/backend`, `packages/shared`).

### AR-02 – Frontend / Backend Separation

- **Frontend** and **backend** are fully independent deployment units that communicate via a well-defined API.
- The frontend is a **Single-Page Application (SPA)** and communicates exclusively through the backend API.

### AR-03 – API Design

- The backend exposes a **REST API** with resource-oriented endpoints (e.g. `GET /api/v1/boards`, `POST /api/v1/cards`).
- The API is versioned via the URL path (`/api/v1/...`).
- Real-time board updates are delivered via **SSE** (`GET /api/v1/boards/:id/events`); all other operations use standard REST endpoints.
- Authentication is delegated to **Zitadel** (self-hosted, runs as a Docker container). The backend validates **JWT Access Tokens** issued by Zitadel; it never handles passwords directly. Zitadel exposes a standard OIDC discovery endpoint, enabling future mobile or third-party clients without backend changes.
- API responses are documented via **OpenAPI/Swagger**, generated automatically from code.

### AR-04 – Data Storage

- The persistence layer must support a **flexible, schemaless or schema-on-read data model** to accommodate different card types with different attributes without requiring migrations.
- At the same time, **performant searching and filtering** on individual attribute fields must be possible (indexing on nested fields).
- Primary candidates:
  - **MongoDB** – native JSON documents, flexible schemas, good index support for nested fields; well suited for this use case.
  - **PostgreSQL with JSONB** – relational integrity combined with flexible JSON columns; GIN indexes enable performant querying; well suited when relational strengths (transactions, foreign keys for user references) are desired.
- The database choice is an architectural decision still to be made; both options are valid.

### AR-05 – Data Model (JSON Structure)

Cards are stored as JSON documents with a fixed "envelope" and a flexible `attributes` object:

```json
{
  "id": "c_01j9x...",
  "board_id": "b_01j8y...",
  "column_id": "col_03...",
  "type": "story",
  "title": "As a user I want to be able to comment on cards",
  "description": "# Background\n\nThis feature request ...",
  "status": "in_progress",
  "created_at": "2026-04-01T10:00:00Z",
  "updated_at": "2026-04-03T08:30:00Z",
  "created_by": "user_42",
  "attributes": {
    "assignee": "user_17",
    "priority": "high",
    "story_points": 5,
    "labels": ["ux", "backend"],
    "due_date": "2026-04-15",
    "acceptance_criteria": "## Criteria\n\n- [ ] Comment field visible\n- [ ] Markdown is rendered"
  }
}
```

- Fields within `attributes` that contain Markdown are flagged as `"format": "markdown"` by the card type schema.
- Card type schemas define which attributes are present, required or optional, and what type they are (string, number, date, markdown, reference, …).

### AR-06 – Deployment / Containerization

- The build artifact is a **Docker Compose bundle** (at minimum: frontend container, backend container, database container).
- Alternatively or additionally: individual **Docker images** per service, consumable from a registry.
- Goal: `docker compose up` should start the entire application locally or on a server with no additional dependencies to install.

### AR-07 – Extensibility

- Card type schemas are defined in a **YAML/JSON configuration file** (versioned in the repository) and seeded into a dedicated MongoDB collection on startup. The backend reads schemas from the database at runtime, making them extensible without redeployment.
- New card types and attributes can therefore be introduced by updating the config file and restarting the backend container.
- An Admin UI for managing schemas at runtime is deferred to post-MVP.
- Integrations with external systems (e.g. webhooks, notifications) should be architecturally prepared for, but are not in scope for the MVP.

---

## Technical Requirements

### TR-01 – Monorepo Tooling

- Recommended: **Turborepo** or **Nx** as a monorepo build system for task orchestration, caching, and parallel builds.
- Alternative: plain **npm/yarn/pnpm workspaces** without an additional build system (lower complexity for the MVP).
- Package manager: **pnpm** (recommended for efficiency and workspace support).

### TR-02 – Frontend

- Framework: **React** with TypeScript.
- Markdown rendering: `react-markdown` with syntax highlighting via `rehype-highlight` / `highlight.js`; Mermaid diagrams via `rehype-mermaid` or equivalent.
- Markdown editing: editor component with live preview (e.g. `@uiw/react-md-editor`, `tiptap` with Markdown extension, or `CodeMirror`).
- Drawing canvas: **Excalidraw** (`@excalidraw/excalidraw`) embedded React component for freehand vector drawing; open JSON storage format with SVG export.
- State management: **Zustand** for local UI state; server state via **TanStack Query** (React Query).
- UI component library: **shadcn/ui** (built on Radix UI).
- Drag-and-drop for cards and columns: **dnd-kit**.
- Build tool: **Vite**.
- Internationalization: **react-i18next**; English (`en.json`) as the only locale in the MVP, structured for additional locales without code changes.
- Theming: see TR-08.

### TR-03 – Backend

- Runtime: **Node.js 22** with **TypeScript**.
- Framework: **Fastify** — chosen for its performance, schema-first design, and native SSE support.
- ORM / database access: **Mongoose**.
- API input validation: **Zod** (TypeScript-native).
- Authentication: JWT Access Token validation via `jose`; Zitadel acts as the OIDC issuer. No password handling in the backend.

### TR-04 – Database

- **MongoDB**, version ≥ 7.x; Atlas or self-hosted.
  - Indexes on `board_id`, `column_id`, `type`, `status`, `attributes.assignee`, `attributes.labels`, etc.
  - Atlas Search or `$text` index for full-text search.

### TR-05 – Containerization and Build

- One **Dockerfile** per service (multi-stage build: build stage → lean runtime image).
- `docker-compose.yml` in the monorepo root to start all services.
- Environment variables are configured via `.env` files (locally) and container environment variables (production); secrets are never baked into images.
- Optional: **GitHub Actions** or **GitLab CI** pipeline for automated builds and image publication to a container registry.

### TR-06 – Development Workflow

- **Linting and formatting**: ESLint + Prettier (TypeScript/JavaScript), configured at the monorepo root.
- **Type safety**: strict TypeScript mode (`strict: true`); shared type definitions in the `packages/shared` package.
- **Testing**:
  - Unit tests: **Vitest** (frontend and backend).
  - Integration tests: against a real database instance (Testcontainers or a dedicated test DB).
  - E2E tests: **Playwright** (optional, later stage).
- **API documentation**: OpenAPI/Swagger (for REST) or GraphQL Playground (for GraphQL), generated automatically from code.

### TR-07 – Security

- All API endpoints (except login/register) require authentication.
- Inputs are validated and sanitized server-side.
- Markdown rendering in the frontend uses a safe renderer with the equivalent of `dangerouslySetInnerHTML` disabled (no raw HTML from user input).
- CORS is configured restrictively (only permitted origins).
- Dependencies are regularly audited for known vulnerabilities (`npm audit` / `pnpm audit`).

### TR-08 – Theming

- The UI supports **user-selectable themes**, at minimum **light mode** and **dark mode**.
- Theming is implemented via **CSS custom properties** (design tokens). `shadcn/ui` uses this approach natively, making theme switching straightforward.
- A theme definition is a set of CSS variable overrides (primary colour, background, surface, border, text, etc.) applied to the `:root` element via a data attribute (e.g. `data-theme="dark"`).
- The active theme is persisted in `localStorage` and applied before first render to avoid a flash of unstyled content (FOUC).
- Additional community or user-defined themes can be added by providing a new CSS variable set — no code changes required.
- Theme selection is accessible from the user menu in the navigation bar.

---

## UI Mockups

The following wireframes sketch the key screens of the application. Each section links to an **interactive HTML mockup** ([overview of all mockups](mockups/index.html)) and includes an ASCII art reference for inline reading. The mockups are intentionally low-fidelity and focus on layout and information hierarchy rather than visual design details.

---

### M-01 – Dashboard (Board Overview)

**[→ Open interactive mockup](mockups/dashboard.html)**

The entry point after login. Shows all boards the user owns or has access to.

/

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ▦ Flexboard                                              ● Alex ▾          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  My Boards                                                [ + New Board ]  │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐  ┌────────────┐  │
│  │  Project Alpha          │  │  Marketing Q2           │  │            │  │
│  │                         │  │                         │  │  + New     │  │
│  │  12 open  ·  3 mine     │  │   5 open  ·  1 mine     │  │    Board   │  │
│  │  Last active: today     │  │  Last active: Apr 1     │  │            │  │
│  └─────────────────────────┘  └─────────────────────────┘  └────────────┘  │
│                                                                             │
│  Shared With Me                                                             │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                  │
│  │  Platform Ops           │  │  Design System          │                  │
│  │                         │  │                         │                  │
│  │   8 open  ·  0 mine     │  │   3 open  ·  0 mine     │                  │
│  │  Last active: Mar 30    │  │  Last active: Mar 28    │                  │
│  └─────────────────────────┘  └─────────────────────────┘                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### M-02 – Board View (Kanban)

**[→ Open interactive mockup](mockups/board.html)**

The main workspace. Columns are freely configurable; cards can be dragged between columns and reordered within a column. The toolbar offers filtering and search.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  ▦ Flexboard  /  Project Alpha                                    ● Alex ▾           │
├──────────────────────────────────────────────────────────────────────────────────────┤
│  [ Filter ▾ ]  [ Assignee ▾ ]  [ Type ▾ ]  [ Label ▾ ]     🔍 Search cards...       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  ┌──────────┐  │
│  │  BACKLOG      (4) │  │  IN PROGRESS  (2) │  │  IN REVIEW    (1) │  │ DONE (3) │  │
│  ├───────────────────┤  ├───────────────────┤  ├───────────────────┤  ├──────────┤  │
│  │ ┌───────────────┐ │  │ ┌───────────────┐ │  │ ┌───────────────┐ │  │ ┌──────┐ │  │
│  │ │ story  #42    │ │  │ │ bug    #38    │ │  │ │ task   #35    │ │  │ │  #31 │ │  │
│  │ │               │ │  │ │               │ │  │ │               │ │  │ │  ... │ │  │
│  │ │ Add comment   │ │  │ │ Login fails   │ │  │ │ Update API    │ │  │ └──────┘ │  │
│  │ │ feature       │ │  │ │ on Safari     │ │  │ │ docs          │ │  │ ┌──────┐ │  │
│  │ │               │ │  │ │               │ │  │ │               │ │  │ │  #29 │ │  │
│  │ │ # ux  # feat  │ │  │ │ # auth        │ │  │ │ @ Alex        │ │  │ │  ... │ │  │
│  │ │ @ Maria       │ │  │ │ ! critical    │ │  │ │ Apr 10        │ │  │ └──────┘ │  │
│  │ └───────────────┘ │  │ └───────────────┘ │  │ └───────────────┘ │  │ ┌──────┐ │  │
│  │ ┌───────────────┐ │  │ ┌───────────────┐ │  │                   │  │ │  #28 │ │  │
│  │ │ task   #41    │ │  │ │ story  #37    │ │  │  [ + Add card ]   │  │ │  ... │ │  │
│  │ │ ...           │ │  │ │ ...           │ │  │                   │  │ └──────┘ │  │
│  │ └───────────────┘ │  │ └───────────────┘ │  │                   │  │          │  │
│  │ ┌───────────────┐ │  │                   │  │                   │  │          │  │
│  │ │ bug    #39    │ │  │  [ + Add card ]   │  │                   │  │          │  │
│  │ │ ...           │ │  │                   │  │                   │  │          │  │
│  │ └───────────────┘ │  │                   │  │                   │  │          │  │
│  │                   │  │                   │  │                   │  │          │  │
│  │  [ + Add card ]   │  │                   │  │                   │  │          │  │
│  └───────────────────┘  └───────────────────┘  └───────────────────┘  └──────────┘  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

Card anatomy (inline legend):

```
  ┌──────────────────────┐
  │ type   #id           │  ← card type badge + ID
  │                      │
  │ Title text           │  ← title (truncated if needed)
  │                      │
  │ # label1  # label2   │  ← labels
  │ @ Assignee           │  ← assignee
  │ ! priority           │  ← priority (only if high/critical)
  │ due date             │  ← due date (only if set)
  └──────────────────────┘
```

---

### M-03 – Card Detail View

**[→ Open interactive mockup](mockups/card-detail.html)**

Opens as a modal overlay or a dedicated route when a card is clicked. The left panel holds the narrative content (description, comments); the right panel holds structured attributes.

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  ✕   story #42  ·  Project Alpha  /  In Progress                                    │
├────────────────────────────────────────────────────┬─────────────────────────────────┤
│                                                    │  Details                        │
│  Add comment feature                               │                                 │
│  ──────────────────────────────────────────────    │  Status       [ In Progress  ▾] │
│                                                    │  Assignee     [ Maria        ▾] │
│  Description                             [ Edit ]  │  Priority     [ High         ▾] │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄   │  Labels       [ ux ][ feat ]    │
│                                                    │  Due Date     [ 2026-04-20   ]  │
│  ## Background                                     │  Story Points [ 5            ]  │
│                                                    │                                 │
│  As a user I want to be able to add comments       │  ─────────────────────────────  │
│  to cards so that team members can discuss         │                                 │
│  tasks inline without leaving the board.           │  Acceptance Criteria  [ Edit ]  │
│                                                    │  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄  │
│  ## Notes                                          │                                 │
│                                                    │  - [ ] Comment input visible    │
│  Refer to Figma design v3 for interaction          │  - [ ] Markdown is rendered     │
│  details. Mobile layout still TBD.                 │  - [ ] Timestamps are shown     │
│                                                    │                                 │
│  ──────────────────────────────────────────────    │  ─────────────────────────────  │
│  Activity                                          │                                 │
│                                                    │  Linked Cards                   │
│  ┌──────────────────────────────────────────────┐  │                                 │
│  │ Alex  ·  Apr 3, 09:14                        │  │  #38  Login fails on Safari     │
│  │ Status changed: Backlog → In Progress        │  │  #31  Auth refactor             │
│  └──────────────────────────────────────────────┘  │                                 │
│  ┌──────────────────────────────────────────────┐  │  [ + Link card ]                │
│  │ Maria  ·  Apr 2, 17:05                       │  │                                 │
│  │ Assigned to: Maria                           │  └─────────────────────────────────┤
│  └──────────────────────────────────────────────┘                                    │
│                                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────────┐    │
│  │  Add a comment … (Markdown supported)                                        │    │
│  │                                                                              │    │
│  │                                                               [ Add Comment ]│    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

### M-04 – New / Edit Card Form

**[→ Open interactive mockup](mockups/card-form.html)**

Used both for creating a new card and editing an existing one. The attribute fields rendered below the description vary by card type.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✕   New Card  ·  Project Alpha                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Card Type   ( task )  ( bug )  (● story )  ( epic )                       │
│                                                                             │
│  Title *                                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  As a user I want to …                                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Description                                  [ Write ]  [ Preview ]        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ## Background                                                      │   │
│  │                                                                     │   │
│  │  …                                                                  │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────┐            │
│  │  Assignee       [ ──── ▾] │  │  Priority    [ Medium   ▾] │            │
│  └────────────────────────────┘  └────────────────────────────┘            │
│                                                                             │
│  ┌────────────────────────────┐  ┌────────────────────────────┐            │
│  │  Due Date       [        ] │  │  Story Points  [         ] │            │
│  └────────────────────────────┘  └────────────────────────────┘            │
│                                                                             │
│  Labels                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  [ ux  ✕ ]  [ frontend  ✕ ]  [ + Add label ]                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Acceptance Criteria                          [ Write ]  [ Preview ]        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  - [ ] …                                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                                          [ Cancel ]  [ Create Card ]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### M-05 – Search & Filter Panel

**[→ Open interactive mockup](mockups/search.html)**

Accessible from the board view toolbar. Filters apply immediately; results can span columns or be scoped to the current board.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ▦ Flexboard  /  Project Alpha                             ● Alex ▾         │
├─────────────────────────────────────────────────────────────────────────────┤
│  [ Filter ▾ ]  [ Assignee ▾ ]  [ Type ▾ ]  [ Label ▾ ]  🔍 login safari    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Filters active:  Type: bug  ·  Assignee: (any)  ·  Text: "login"    │  │
│  │  [ Clear all filters ]                                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  3 results in Project Alpha                                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  bug  #38  ·  IN PROGRESS                                           │   │
│  │  Login fails on Safari                                              │   │
│  │  @ Maria  ·  # auth  ·  ! critical                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  bug  #27  ·  DONE                                                  │   │
│  │  Login redirect loop on mobile                                      │   │
│  │  @ Alex  ·  # auth                                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  bug  #19  ·  DONE                                                  │   │
│  │  Login form loses state on back navigation                          │   │
│  │  @ Maria  ·  # auth  ·  # ux                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Open Questions

| # | Topic                | Description                                                                         |
|---|----------------------|-------------------------------------------------------------------------------------|
| 1 | Database choice      | ✅ **MongoDB** chosen.                                                              |
| 2 | API paradigm         | ✅ **REST** chosen.                                                                 |
| 3 | Frontend framework   | ✅ **React** (with TypeScript) chosen.                                              |
| 4 | Authentication       | ✅ **OAuth 2.0 / OIDC via Dex** (self-hosted, Docker); backend validates JWT Access Tokens. Static passwords managed in `config/dex.yaml`. |
| 5 | Card type schema     | ✅ **Config file (YAML/JSON) as source of truth, seeded into MongoDB on startup**; Admin UI deferred to post-MVP. |
| 6 | Internationalization | ✅ **react-i18next** from the start; English only for MVP, structured for additional locales. |
| 7 | Real-time updates    | ✅ **Server-Sent Events (SSE)**; board and card changes pushed unidirectionally from backend to connected clients. |
| 8 | Project name         | ✅ **Flexboard** confirmed as the final name.                                       |
| 9 | Multi-user model     | ✅ **Dex static passwords + role-based board membership** (owner / editor / viewer). User management via `config/dex.yaml`; no in-app registration. |
