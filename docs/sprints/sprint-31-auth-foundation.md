# Sprint 31 — Authentication Foundation

## Goal

Introduce a security layer for PC Media Engine without touching the publishing pipeline, worker, queue, scheduler, retry engine, or any existing behavior. Sprint 31 delivers the infrastructure that future sprints (login, RBAC, OAuth) will build on.

---

## Architecture

All authentication code lives in `apps/api/src/auth/`. No new top-level package was created — the auth module is internal to the API app for Sprint 31.

```
apps/api/src/
  auth/
    config.ts       — AuthConfig type, loadAuthConfig(), validateAuthConfig()
    jwt.ts          — signJwt(), verifyJwt()  (HS256, Node crypto, zero deps)
    password.ts     — hashPassword(), verifyPassword()  (scrypt, Node crypto)
    api-key.ts      — generateApiKey(), hashApiKey(), compareRawApiKeys()
    middleware.ts   — createAuthMiddleware() → { authenticateRequest, requireAuth }
    index.ts        — barrel re-exports
  routes/
    auth.ts         — GET /auth/health
```

The API app wires auth at startup:

1. `server.ts` calls `loadAuthConfig()` and `validateAuthConfig()`.
2. `app.ts` calls `createAuthMiddleware(authConfig)` and registers `authenticateRequest` as a global `onRequest` Fastify hook.
3. Individual routes can add `requireAuth` as a `preHandler` to demand a valid credential.
4. `GET /auth/health` is always public (no preHandler) so monitoring tools can check status without credentials.

---

## Configuration

| Environment variable    | Default  | Description                                         |
|-------------------------|----------|-----------------------------------------------------|
| `PCME_AUTH_ENABLED`     | `false`  | Master switch — `"true"` to enable the auth layer   |
| `PCME_JWT_SECRET`       | (none)   | HMAC-SHA256 secret; required for JWT auth           |
| `PCME_JWT_EXPIRES_IN`   | `3600`   | JWT lifetime in seconds                             |
| `PCME_API_KEYS`         | (none)   | Comma-separated raw API keys; enables API-key auth  |

When `PCME_AUTH_ENABLED` is not `"true"` all requests pass through the middleware without any credential check. This preserves backward compatibility with all existing integrations.

---

## JWT

Implementation: `apps/api/src/auth/jwt.ts`

- Algorithm: **HS256** (HMAC-SHA256).
- No external library — uses Node.js built-in `crypto.createHmac`.
- Timing-safe signature comparison via `crypto.timingSafeEqual`.
- Auto-inserts `iat` and `exp` claims on sign.
- Detects token expiry on verify.

```ts
const token = signJwt({ sub: 'user-123' }, secret, 3600);
const result = verifyJwt(token, secret);
// result.valid === true, result.claims.sub === 'user-123'
```

**Credential scheme:** `Authorization: Bearer <token>`

**Future:** Replace with `jose` or `@fastify/jwt` when RS256/asymmetric keys or JWKS are needed.

---

## API Keys

Implementation: `apps/api/src/auth/api-key.ts`

- Format: `pcme_<43-char base64url>` (~258 bits of entropy).
- Generation: `generateApiKey()` via `crypto.randomBytes(32)`.
- Hashing: `hashApiKey()` → SHA-256 hex digest (for DB storage).
- Comparison: `compareApiKeyToHash()` and `compareRawApiKeys()` — both timing-safe.

**Sprint 31 workflow:** Raw keys are supplied in `PCME_API_KEYS` (env var). The middleware compares the incoming key against each configured key using `compareRawApiKeys` (timing-safe).

**Credential scheme (either header accepted):**
- `Authorization: ApiKey <key>`
- `X-API-Key: <key>`

**Future (Sprint 32+):** Migrate to DB-backed hashed key table with revocation and per-key labels.

---

## Password Hashing

Implementation: `apps/api/src/auth/password.ts`

- Algorithm: **scrypt** (Node.js built-in `crypto.scryptSync`).
- Cost parameters: `N=16384, r=8, p=1` — conservative for a beta service.
- Output format: `<hex-salt>:<hex-key>` — self-describing, storable as a VARCHAR.
- Verification always uses `crypto.timingSafeEqual`.

```ts
const hash = await hashPassword('my-password');
await verifyPassword('my-password', hash); // true
await verifyPassword('wrong', hash);        // false
```

**Note:** `scryptSync` blocks the event loop. For high-QPS login endpoints wrap in `worker_threads`. In Sprint 31 this is only infrastructure — no login endpoint exists yet.

**Future:** Swap for argon2 once native binaries are acceptable in the deploy target.

---

## Middleware

Implementation: `apps/api/src/auth/middleware.ts`

### `authenticateRequest` (optional auth hook)

Registered globally via `app.addHook('onRequest', ...)`. Inspects headers and populates `request.auth` if valid credentials are present. Does **not** reject requests — unauthenticated requests pass through.

### `requireAuth` (required auth preHandler)

Calls `authenticateRequest` first, then returns `401 Unauthorized` if `request.auth` is still unset.

Usage:

```ts
app.get('/protected', { preHandler: [requireAuth] }, handler);
```

### `request.auth` shape

```ts
// JWT
{ type: 'jwt'; sub: string; claims: Record<string, unknown> }

// API key
{ type: 'api-key'; keyPrefix: string }  // keyPrefix = first 8 chars + '…'
```

### Credential resolution order

1. If `Authorization: Bearer …` header present → try JWT.
2. Else if `Authorization: ApiKey …` or `X-API-Key` header present → try API key.
3. No credential → `request.auth` remains `undefined`.

Invalid JWTs do **not** fall through to API key check — they leave `request.auth` unset.

---

## GET /auth/health

Always public. Returns authentication configuration status for monitoring tools.

```http
GET /auth/health
```

```json
{
  "status": "ok",
  "authEnabled": false,
  "jwtEnabled": false,
  "apiKeyEnabled": false,
  "version": "0.31.0"
}
```

Fields:

| Field            | Type    | Description                                        |
|------------------|---------|----------------------------------------------------|
| `status`         | `"ok"`  | Always `ok`                                        |
| `authEnabled`    | boolean | Reflects `PCME_AUTH_ENABLED`                       |
| `jwtEnabled`     | boolean | True when JWT secret is configured and auth enabled |
| `apiKeyEnabled`  | boolean | True when API keys are configured and auth enabled  |
| `version`        | string  | API version from `config.version`                  |

---

## Testing

170 tests pass (41 new auth tests):

| Suite                                   | Tests |
|-----------------------------------------|-------|
| JWT sign / verify                       | 8     |
| Password hash / verify                  | 5     |
| API key generation and hashing          | 8     |
| Auth config validation                  | 5     |
| Middleware — disabled auth              | 2     |
| Middleware — JWT auth                   | 3     |
| Middleware — API key auth               | 4     |
| GET /auth/health                        | 5     |
| loadAuthConfig (env loading)            | 1     |

Smoke: `pnpm auth:smoke` — 14 offline checks covering all modules.

---

## Future login flow (Sprint 32+)

1. Add `User` and `Session` Prisma models.
2. Create `POST /auth/login` endpoint — validate password, issue JWT.
3. Create `POST /auth/logout` — invalidate session.
4. Create `POST /auth/refresh` — issue new JWT from refresh token.
5. Migrate API keys from env vars to DB-backed table with revocation.
6. Add `PCME_AUTH_REQUIRED=true` to enforce auth on all routes by default.

---

## Future RBAC (Sprint 33+)

1. Add `Role` and `Permission` models.
2. Attach roles to `User` via a join table.
3. Add `checkPermission(request.auth, 'publishing:write')` helper.
4. Protect mutation routes with permission checks.
5. Dashboard routes require `dashboard:read` permission.

---

## Known limitations (Sprint 31)

- API keys are stored in plaintext in an environment variable — acceptable for beta, must migrate to DB before GA.
- Password hashing uses `scryptSync` (blocking) — wrap in worker thread before enabling a login endpoint.
- No user model, no session, no refresh tokens — this sprint is infrastructure only.
- `GET /auth/health` is always public — add protection in Sprint 32 if needed.
