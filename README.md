# QC Builder

An internal web application for the dev team to manage and track the status of projects, built with Angular and Tailwind CSS.

## Purpose

QC Builder provides a centralized dashboard for the team to monitor project health, track milestones, and maintain visibility across all active initiatives. It replaces scattered spreadsheets and ad-hoc status updates with a single source of truth.

## Tech Stack

- **Framework:** Angular 21 (standalone components)
- **Styling:** Tailwind CSS
- **Testing:** Vitest
- **Language:** TypeScript

## Project Structure

```
qc-builder/
├── src/
│   ├── app/
│   │   ├── core/            # Singleton services, guards, interceptors
│   │   ├── shared/          # Reusable components, directives, pipes
│   │   ├── features/        # Feature modules (lazy-loaded)
│   │   │   ├── dashboard/   # Main project overview
│   │   │   ├── projects/    # Project CRUD and detail views
│   │   │   └── settings/    # App and user settings
│   │   ├── models/          # TypeScript interfaces and types
│   │   ├── app.component.ts
│   │   ├── app.config.ts
│   │   └── app.routes.ts
│   ├── assets/
│   ├── environments/
│   ├── styles.css
│   └── main.ts
├── angular.json
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

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

## Roadmap

Development is broken into phases. Each phase builds on the last and is scoped to be deliverable independently.

### Phase 1 — Foundation

- Project scaffolding and repo setup
- Tailwind CSS configuration and base theme
- Core layout (shell, sidebar, navigation)
- Routing structure with lazy-loaded feature modules

### Phase 2 — Project Management

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
- **Styles:** Use Tailwind utility classes; avoid custom CSS unless absolutely necessary
- **Testing:** Write unit tests for services and non-trivial component logic

## License

Property of Sphere Entertainment Co. Internal use only. Not for external distribution.