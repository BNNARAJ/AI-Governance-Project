# Frontend Migration Plan Tracker

Last updated: 2026-05-14

Architecture target: `Angular -> .NET -> Python + SQL Server`

## Status legend
- `[x]` Complete
- `[~]` In progress
- `[ ]` Not started
- `Blocked` Waiting on teammate-owned backend/API contract work

## Current completion snapshot
- Angular foundation: `[x]`
- Screen migration: `[~]` (UI complete, backend-state messaging refined)
- Backend integration: `[~]` (audit run integrated, most other features still `Blocked`)
- Enterprise hardening: `[ ]`

## Current delivery state
### Integrated now
- Audit run uses the existing `.NET` endpoint: `POST /api/Audit/run-audit`
- Results page renders only the fields the current backend actually returns
- Environment-based runtime mode and backend capability map are active

### Frontend complete, waiting for API
- Dashboard layout and navigation
- Regulations upload workflow shell
- Admin page shell
- Results extras for history and report download

### Blocked by backend
- Auth API for SPA login/logout/session check
- Dashboard JSON API
- Angular-compatible regulation upload/list API
- Persistent audit configuration save API
- Audit history API
- Report download API
- Admin users/policies API

## Phase tracking
### Phase 1: Angular foundation
- `[x]` Routed shell with role-based guards
- `[x]` Standalone feature-page architecture
- `[x]` Shared UI primitives and typed frontend models
- `[x]` Capability-aware frontend services

### Phase 2: Screen migration from legacy frontend
- `[x]` Login page migrated
- `[x]` Dashboard page migrated
- `[x]` Regulation upload page migrated
- `[x]` Audit configuration page migrated
- `[x]` Results page migrated
- `[x]` Admin page migrated
- `[~]` Legacy behavior parity validation

### Phase 3: Backend integration (`Angular -> .NET`)
- `[x]` Environment-based backend URL configuration added
- `[x]` Integration mode added as the default runtime mode
- `[x]` Temporary frontend access mode added for auth-unavailable environments
- `[x]` Real `.NET` audit run integration added
- `[x]` Hidden mock fallback removed from integration mode
- `Blocked` Auth contract for Angular SPA
- `Blocked` Dashboard contract
- `Blocked` Regulation upload/list contract
- `Blocked` Admin users/policies contract
- `Blocked` Audit history contract
- `Blocked` Report download contract

### Phase 4: Enterprise hardening
- `[ ]` Unit coverage for capability-aware services
- `[ ]` Integration/e2e coverage for login preview and audit run
- `[ ]` Centralized retry/error taxonomy
- `[ ]` Observability and diagnostics hooks

## Screen-by-screen migration status
- Login: `[~]`
  - Frontend access mode is active
  - Real backend auth is `Blocked`
- Dashboard: `Blocked`
  - Screen shell is complete
  - Backend dashboard API pending
- Regulations: `Blocked`
  - Screen shell is complete
  - Upload is disabled in integration mode until backend API is ready
- Audit Studio: `[~]`
  - Local draft save works in Angular
  - Real audit run is integrated
  - Backend draft persistence is `Blocked`
- Results: `[~]`
  - Current backend audit response is rendered
  - History/report features remain `Blocked`
- Admin: `Blocked`
  - Screen shell is complete
  - Backend admin API pending

## Backend dependency map (tracked, not implemented by frontend team)
### Auth API
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Dashboard API
- `GET /api/dashboard/snapshot`
  - or equivalent split JSON endpoints for stats, history, and health

### Regulation API
- `POST /api/regulations/upload`
- `GET /api/regulations`

### Audit API
- `POST /api/audit/configure`
- `POST /api/Audit/run-audit`
- `GET /api/audit/history`
- `GET /api/audit/report/{id}`

### Admin API
- `GET /api/admin/users`
- `GET /api/admin/policies`

## Database and platform notes
- SQL Server stays backend-owned
- Existing backend connection target:
  - Server: `SIDDACER\\SQLEXPRESS`
  - Database: `GovUser`
- SSMS is available for backend-side verification only

## Frontend next actions
- Replace temporary frontend auth with real `.NET` SPA auth once available
- Swap blocked dashboard state for live dashboard data when JSON contract lands
- Re-enable regulations upload against the real Angular-compatible backend API
- Add integration tests for the current audit run mapping
- Remove mock mode from shared environments once all major APIs are available

## Technical debt register
- Temporary frontend access mode is active because backend SPA auth does not exist yet
- Mock mode still exists for isolated frontend-only development, but it is no longer the default runtime path
- Results currently reflect the backend placeholder audit shape rather than the final enterprise audit report contract

## Change log
- 2026-05-14
  - Switched to explicit integration mode with capability-driven blocked states
  - Removed silent mock fallback from integrated runtime behavior
  - Added temporary frontend access mode for auth-unavailable environments
  - Integrated Angular audit run to the existing `.NET` audit endpoint
  - Reduced results rendering to the exact current backend response shape
- 2026-05-13
  - Added Angular migration baseline and phase tracker
