# Sprint 45 — User & Role-Based Access Control (RBAC)

## Objective

Introduce multi-user authorization with Role-Based Access Control on top of the
Sprint 31 authentication foundation. Authentication remains optional and backward
compatible.

---

## Roles

| Role | Description |
|---|---|
| **Admin** | Full access to all permissions |
| **Operator** | Queue ops, composer, scheduling, assets, jobs |
| **Publisher** | Publishing, composer, publishers |
| **Viewer** | Read-only dashboard, jobs, assets, publishers |

Role metadata is exposed at `GET /auth/rbac`.

---

## Permission Model

Colon-namespaced permissions (e.g. `queue:write`, `publishing:write`) are mapped
to roles in `apps/api/src/auth/permissions.ts`.

When `PCME_AUTH_ENABLED=false`, all permission checks are skipped — behaviour is
identical to pre–Sprint 45.

When auth is enabled:

1. `requireAuth` — valid JWT or API key (401 if missing)
2. `requirePermission` — role must grant permission (403 if denied)

### Role resolution

- **JWT** — `claims.role` (`admin` | `operator` | `publisher` | `viewer`);
  falls back to `PCME_DEFAULT_JWT_ROLE` (default: `operator`)
- **API key** — `PCME_API_KEY_ROLES=key:role,...` mapping;
  falls back to `PCME_DEFAULT_API_KEY_ROLE` (default: `admin`)

---

## Route Protection

Protected routes use `authMiddleware.requirePermission(permission)`:

| Permission | Example routes |
|---|---|
| `queue:read` | `GET /queue/status` |
| `queue:write` | `POST /queue/pause`, job retry/remove |
| `jobs:read` | `GET /jobs` |
| `calendar:read` | `GET /calendar/*` |
| `composer:read` | `GET /composer/assets*` |
| `composer:write` | `POST /composer/validate` |
| `publishing:write` | `POST /composer/publish`, `/bulk-publish` |
| `scheduling:write` | `POST /composer/schedule` |
| `assets:read` | `GET /assets/*` |
| `publishers:read` | `GET /publishers/*` |
| `providers:read` | `GET /providers/config*` |
| `providers:write` | `POST validate`, `PUT update` |

403 responses include `permission` and `role` fields.

---

## Dashboard UI Adaptation

Set `DASHBOARD_RBAC_ENABLED=true` and `DASHBOARD_ROLE=<role>` to adapt the UI:

- Navigation links hidden when the role lacks read permission
- Queue ops panel, publish forms, and provider config edit hidden with
  "Permission denied" messages
- `POST /ops/*` handlers enforce permissions server-side before calling the API

When RBAC is disabled on the dashboard, all actions remain visible (current behaviour).

---

## Future Custom Roles

Sprint 45 uses a static in-code permission registry. Future work:

1. Database-backed roles and user assignments
2. Custom permission sets per organization/project
3. JWT issued by an identity service with embedded permissions
4. Dashboard login with per-user JWT instead of shared API key

The `requirePermission` middleware and `Permission` type are designed to accept
dynamic permission sets without route changes.

---

## Verification

```bash
pnpm test
pnpm build
pnpm rbac:smoke
```

---

## Sprint 45 Complete

RBAC extends Sprint 31 auth without redesigning authentication, queue, scheduler,
or Publisher SDK.
