# AI Governance Console Frontend

This Angular workspace is the enterprise frontend migration for the AI Governance project. It replaces the legacy single-file HTML and JavaScript UI with a routed, component-driven application that can integrate with the in-progress `.NET` backend without frontend churn.

## What changed

- Standalone Angular pages for login, dashboard, regulations, audit configuration, results, and admin
- A routed shell with role-aware navigation
- Shared UI primitives such as page headers, stat cards, surface cards, score rings, and blocked-state cards
- Typed domain models and DI-backed services instead of page-level script state
- Capability-aware frontend services so each feature can be integrated or explicitly blocked without pretending backend support exists

## Runtime modes

The app supports two runtime modes in `src/environments/environment.ts`:

- `integration`
  - default mode
  - calls only the real `.NET` capabilities that exist today
  - shows blocked states for unfinished backend APIs
- `mock`
  - optional frontend-only development mode
  - uses local mock data intentionally

## Current backend integration status

Integrated now:
- `POST /api/Audit/run-audit`

Blocked by backend readiness:
- auth
- dashboard
- regulation upload/list
- audit history
- report download
- admin users/policies

Because SPA auth is not available yet in `.NET`, the login page currently uses a clearly labeled temporary frontend access mode for route testing.

## Tracking

Migration progress tracking lives in:

- `MIGRATION_PLAN.md`

## Development

```bash
cd new_frontend
npm start
```

## Build

```bash
cd new_frontend
npm run build
```

## Test

```bash
cd new_frontend
npm test
```
