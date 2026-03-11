# QC Builder

An internal web application for the dev team to manage and track the status of projects, built with Angular and Tailwind CSS.

## Purpose

QC Builder provides a centralized dashboard for the team to monitor project health, track milestones, and maintain visibility across all active initiatives. It replaces scattered spreadsheets and ad-hoc status updates with a single source of truth.

## Tech Stack

- **Framework:** Angular 21 (standalone components)
- **Styling:** Tailwind CSS
- **Testing:** Vitest
- **Language:** TypeScript
- **Auth:** Microsoft Entra ID (Azure AD) via MSAL

## Project Structure

```
qc-builder/
├── src/
│   ├── app/
│   │   ├── core/                        # Singleton services, guards, interceptors
│   │   │   ├── api/
│   │   │   │   ├── api.interceptor.ts       # HTTP interceptor (base URL, headers)
│   │   │   │   └── api.service.ts           # Low-level HTTP wrapper
│   │   │   ├── auth/
│   │   │   │   ├── auth.guard.ts            # Route guard (Entra ID roles)
│   │   │   │   ├── auth.interceptor.ts      # Bearer token injection
│   │   │   │   └── auth.service.ts          # MSAL authentication logic
│   │   │   └── core.module.ts
│   │   │
│   │   ├── services/                    # Domain API services & models
│   │   │   ├── project/
│   │   │   │   ├── project-api.model.ts     # Project & Component interfaces
│   │   │   │   ├── project-api.service.ts   # Projects + Components CRUD
│   │   │   │   └── index.ts
│   │   │   ├── task/
│   │   │   │   ├── task-api.model.ts        # Task, Comment, History interfaces
│   │   │   │   ├── task-api.service.ts      # Tasks + Comments + History CRUD
│   │   │   │   └── index.ts
│   │   │   ├── template/
│   │   │   │   ├── template-api.model.ts    # Template, Status, Category, Type interfaces
│   │   │   │   ├── template-api.service.ts  # Templates + Statuses + Categories + Types CRUD
│   │   │   │   └── index.ts
│   │   │   └── index.ts                     # Barrel re-export for all services
│   │   │
│   │   ├── features/                    # Feature modules (lazy-loaded)
│   │   │   ├── admin/                       # Admin panel
│   │   │   │   └── components/
│   │   │   │       ├── reference-values/
│   │   │   │       ├── team-management/
│   │   │   │       └── user-management/
│   │   │   ├── charts/                      # Data visualizations
│   │   │   │   └── components/
│   │   │   │       ├── gnatt-chart/
│   │   │   │       └── waterfall-chart/
│   │   │   ├── dashboard/                   # Main project overview
│   │   │   │   └── components/
│   │   │   │       ├── activity-feed/
│   │   │   │       └── project-summary-card/
│   │   │   ├── projects/                    # Project CRUD and detail views
│   │   │   │   └── components/
│   │   │   │       ├── project-detail/
│   │   │   │       ├── project-form/
│   │   │   │       └── project-list/
│   │   │   ├── tasks/                       # Task management
│   │   │   │   └── components/
│   │   │   │       ├── task-assignment/
│   │   │   │       ├── task-board/
│   │   │   │       ├── task-detail/
│   │   │   │       ├── task-form/
│   │   │   │       └── task-list/
│   │   │   └── workflows/                   # Workflow automation
│   │   │       └── components/
│   │   │           ├── node-palette/
│   │   │           ├── workflow-editor/
│   │   │           └── workflow-list/
│   │   │
│   │   ├── layout/                      # App shell, sidebar, navigation
│   │   │
│   │   ├── shared/                      # Reusable components, directives, pipes
│   │   │   ├── components/
│   │   │   │   ├── confirm-dialog/
│   │   │   │   ├── data-table/
│   │   │   │   ├── status-badge/
│   │   │   │   └── user-avatar/
│   │   │   ├── directives/
│   │   │   ├── models/
│   │   │   │   ├── project.model.ts         # UI-layer project types
│   │   │   │   ├── reference-data.model.ts
│   │   │   │   ├── task.model.ts            # UI-layer task types
│   │   │   │   └── user.model.ts
│   │   │   └── pipes/
│   │   │
│   │   ├── app.config.ts
│   │   ├── app.css
│   │   ├── app.html
│   │   ├── app.routes.ts
│   │   ├── app.spec.ts
│   │   └── app.ts
│   │
│   ├── assets/
│   │   ├── images/
│   │   └── styles/
│   │       ├── styles.css
│   │       └── themes/
│   ├── environments/
│   │   ├── environment.ts               # Dev config (mock auth, debug flags)
│   │   └── environment.prod.ts          # Prod config (CI/CD injected secrets)
│   ├── index.html
│   ├── main.ts
│   └── styles.css
│
├── angular.json
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

### Key Architecture Decisions

- **`core/`** holds singleton, app-wide infrastructure: HTTP interceptors, the base API service, and Entra ID authentication. These are provided once at the root level.
- **`services/`** contains domain-specific API services. Each subfolder groups a service with its corresponding TypeScript interfaces and a barrel `index.ts`. Components import from `@app/services` (or a specific domain like `@app/services/task`) rather than reaching into feature modules.
- **`shared/models/`** holds UI-layer interfaces used by components and templates. These may extend or differ from the API models in `services/` when the UI needs a different shape (e.g., computed display fields, joined data).
- **`features/`** are lazy-loaded route modules. Each feature owns its own components and route config but delegates all HTTP calls to `services/`.

## Getting Started

### Prerequisites

- Node.js (v18+)
- Angular CLI (`npm install -g @angular/cli`)

### Installation

```bash
git clone <repo-url>
cd qc-builder
npm install
```

### Development Server

```bash
ng serve
```

Navigate to `http://localhost:4200/`. The app reloads automatically on file changes.

### Build

```bash
ng build
```

Production artifacts output to `dist/`.

### Tests

```bash
ng test
```

### Environment Configuration

- **Dev:** `src/environments/environment.ts` — points at `localhost:8000`, mock auth available, debug logging enabled.
- **Prod:** `src/environments/environment.prod.ts` — relative API URLs, secrets injected at build time via CI/CD pipeline from Azure Key Vault.

Both files expose `environment.api.v1Url` as the base URL for all API services.

## API Services

All backend communication is centralized in `app/services/`. Each domain folder contains:

| File | Purpose |
|------|---------|
| `*-api.model.ts` | Request/response TypeScript interfaces matching the FastAPI backend schemas |
| `*-api.service.ts` | Injectable Angular service with typed `HttpClient` methods |
| `index.ts` | Barrel export for clean imports |

### Template Service (`services/template/`)

Manages workflow templates, status definitions, task categories, and task types. Endpoints include CRUD for each entity plus status reordering.

### Project Service (`services/project/`)

Manages projects and their components. Supports filtering by status, template, and owner. Delete performs a soft archive.

### Task Service (`services/task/`)

Manages tasks, comments, and history. Tasks require a `project_id` filter and support filtering by category, type, status, component, assignee, and priority.

## Roadmap

Development is broken into phases. Each phase builds on the last and is scoped to be deliverable independently.

### Phase 1 — Foundation ✅

- Project scaffolding and repo setup
- Tailwind CSS configuration and base theme
- Core layout (shell, sidebar, navigation)
- Routing structure with lazy-loaded feature modules

### Phase 2 — Project Management ✅

- Project list view with filtering and sorting
- Project detail view (description, owner, dates, links)
- Status tracking (Not Started, In Progress, In Review, Complete, Blocked)
- Create, edit, and archive projects

### Phase 3 — Dashboard & Visibility

- Dashboard with summary metrics (active, blocked, completed counts)
- Status breakdown charts
- Team workload overview
- Recent activity feed

### Phase 4 — Collaboration & History

- Status change history and audit log
- Notes and comments per project
- Tagging and categorization
- Notifications for status changes

### Phase 5 — Polish & Integrations

- Search across all projects
- Export to CSV / PDF
- Dark mode support
- Integration hooks (API endpoints for CI/CD pipelines, Slack, etc.)

## Contributing

This is an internal tool — all team members are encouraged to contribute. Follow these conventions:

- **Branching:** `feature/<name>`, `bugfix/<name>`, `chore/<name>`
- **Commits:** Use conventional commits (`feat:`, `fix:`, `chore:`, `docs:`)
- **Components:** Generate with `ng generate component features/<feature>/<component-name>`
- **Services:** Place in `app/services/<domain>/` with a model file, service file, and barrel `index.ts`
- **Styles:** Use Tailwind utility classes; avoid custom CSS unless absolutely necessary
- **Testing:** Write unit tests for services and non-trivial component logic

## License

Property of Sphere Entertainment Co. Internal use only. Not for external distribution.