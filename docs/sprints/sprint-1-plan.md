# Sprint 1 — Repository Foundation

**Sprint:** 1  
**Version target:** v0.1.0-alpha (foundation)  
**Status:** In progress — Sprint 1.7 infrastructure complete; formal closeout pending  
**Prerequisite:** Sprint 0 complete (architecture, ADRs, engineering principles)

---

## Hard Gate — Before Sprint 1 Implementation Begins

Sprint 1 **implementation must not start** until the following Sprint 0 artifacts are committed to the repository:

- `docs/architecture/` — system overview, module map, content lifecycle, and related specs
- `docs/decisions/` — ADRs 001–006 and known-risks record
- `docs/engineering/engineering-principles.md`
- `ROADMAP.md`

Scaffolding against an undocumented architecture risks package boundary drift that blocks Sprint 2 and beyond. Planning documents (including this file) may exist before the gate is satisfied; **code and configuration work begins only after the gate is met.**

---

## 1. Sprint Goal

Establish the PC Media Engine monorepo as a buildable, lintable, type-safe workspace with clear package boundaries — **without implementing domain features**.

Sprint 1 delivers the structural skeleton that all future sprints depend on: workspace layout, shared tooling, empty package stubs, application shells, local development infrastructure, and CI validation. A new contributor must be able to clone the repo, install dependencies, and run `build`, `lint`, and `typecheck` successfully on day one.

This sprint implements **repository foundation only**. No database schema, no AI calls, no media upload, no content lifecycle, no publishing.

---

## 2. Scope

### In scope

- Monorepo initialization (pnpm workspaces + Turborepo)
- Directory scaffold matching Sprint 0 architecture
- Empty package and app stubs with correct `@pcme/*` naming
- Shared TypeScript, ESLint, Prettier, and EditorConfig configuration
- Root-level scripts for build, lint, typecheck, and format
- Docker Compose for local Postgres and Redis (dev dependencies for Sprint 2+)
- `.env.example` documenting required environment variables (no real secrets)
- CI pipeline: install, lint, typecheck, build (no tests yet)
- README, CONTRIBUTING.md, and LICENSE (MIT unless otherwise specified)
- Dependency boundary rules enforced via documentation and review
- Plugin dependency rules documented (see Section 6.1)

### Explicitly excluded

- Prisma schema or migrations (Sprint 2)
- Domain interfaces with business logic (minimal type exports only where required for compile)
- AI provider implementations
- Storage or media handling
- API routes beyond health check stubs
- Dashboard UI beyond placeholder shell
- Worker job processors
- Plugin or provider implementations beyond empty stubs
- Production deployment configuration
- E2E or integration tests
- **`pnpm dev` at root** — parallel multi-app dev orchestration is out of scope; apps may expose individual `dev` scripts, but a root-level `pnpm dev` turbo task is not required (see Section 12)

---

## Sprint 1 Phased Delivery

Sprint 1 is delivered in phases. Core tooling and infrastructure are tracked separately for closeout.

| Phase | Focus | Status |
| ----- | ----- | ------ |
| 1.2 | Repository bootstrap (`package.json`, pnpm, turbo) | ✅ Complete |
| 1.3 | Workspace folder scaffold (26 packages) | ✅ Complete |
| 1.4 | TypeScript foundation (`tsconfig.base.json`, `tsc` builds) | ✅ Complete |
| 1.5 | Code quality (ESLint, Prettier, EditorConfig) | ✅ Complete |
| 1.6 | Git quality (Husky, lint-staged, commitlint) | ✅ Complete |
| **1.7** | **Infrastructure foundation (Docker Compose, `.env.example`, CI)** | **✅ Complete** |

### Sprint 1.7 — Infrastructure Foundation

Deliverables completed in Sprint 1.7 (required for Definition of Done infrastructure items):

- **`docker-compose.yml`** — PostgreSQL 16 and Redis 7 for local development; named volumes; health checks; reads credentials from `.env` (aligned with `.env.example`)
- **`.env.example`** — placeholder variables for `NODE_ENV`, `DATABASE_URL`, `POSTGRES_*`, `REDIS_URL`, `API_PORT`, `WORKER_CONCURRENCY`, `LOG_LEVEL`; no real secrets
- **`.github/workflows/ci.yml`** — GitHub Actions: `pnpm install --frozen-lockfile`, lint, typecheck, build, test, format:check
- **`README.md`** — local development validation section including `docker compose up -d`

These items complete deliverables **#8**, **#9**, and **#14** from Section 3 and satisfy the infrastructure-related Definition of Done checks (CI, Docker, env template).

---

## 3. Deliverables

| #   | Deliverable              | Location                                          | Notes                                                                  |
| --- | ------------------------ | ------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | Root workspace manifest  | `package.json`, `pnpm-workspace.yaml`             | Defines workspace packages; pin `packageManager` for Corepack          |
| 2   | Turborepo pipeline       | `turbo.json`                                      | build, lint, typecheck tasks; packages before apps                     |
| 3   | Shared TypeScript config | `tsconfig.base.json`, per-package `tsconfig.json` | Strict mode; path aliases reserved                                     |
| 4   | Shared ESLint config     | `eslint.config.js` (or `.eslintrc`)               | Flat config preferred                                                  |
| 5   | Prettier config          | `.prettierrc`, `.prettierignore`                  | Consistent formatting                                                  |
| 6   | EditorConfig             | `.editorconfig`                                   | Indent, charset, end-of-line consistency                               |
| 7   | Git ignore rules         | `.gitignore`                                      | node_modules, dist, .env, data/                                        |
| 8   | Environment template     | `.env.example`                                    | ✅ Sprint 1.7 — placeholders aligned with Docker Compose               |
| 9   | Local infra              | `docker-compose.yml`                              | ✅ Sprint 1.7 — Postgres 16, Redis 7, named volumes, health checks      |
| 10  | App stubs                | `apps/dashboard`, `apps/api`, `apps/worker`       | Compile-only shells                                                    |
| 11  | Package stubs            | `packages/*` (9 packages)                         | Export placeholder from `index.ts`                                     |
| 12  | Plugin stubs             | `plugins/*` (7 plugins)                           | Package.json + empty export; zero internal deps except `@pcme/shared`  |
| 13  | Provider stubs           | `providers/ai/*`, `providers/storage/*`           | Package.json + empty export; zero internal deps except `@pcme/shared`  |
| 14  | CI workflow              | `.github/workflows/ci.yml`                        | ✅ Sprint 1.7 — lint, typecheck, build, test, format:check              |
| 15  | Bootstrap README         | `README.md`                                       | Prerequisites, install, build, lint, infra commands                    |
| 16  | Contributing guide       | `CONTRIBUTING.md`                                 | Links to engineering principles and PR expectations                    |
| 17  | License                  | `LICENSE`                                         | MIT (default) unless project owner specifies otherwise                 |
| 18  | Sprint 1 completion note | `docs/sprints/sprint-1-notes.md`                  | Filled at sprint close                                                 |

### Optional helper (not required for Definition of Done)

| Helper                 | Location                                        | Notes                                                                                              |
| ---------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Package stub generator | `scripts/generate-package-stub.sh` (or similar) | Non-production scaffolding aid only; reduces boilerplate across ~30 packages; not application code |

---

## 4. Repository Structure

Sprint 1 creates the following tree. All leaf packages contain `package.json`, `tsconfig.json`, and `src/index.ts` (or equivalent entry) unless noted.

```txt
pc-media-engine/
├── .github/
│   └── workflows/
│       └── ci.yml
├── apps/
│   ├── dashboard/          # Next.js shell
│   ├── api/                # NestJS shell
│   └── worker/             # Node worker shell
├── packages/
│   ├── core/
│   ├── database/
│   ├── ai/
│   ├── media/
│   ├── content/
│   ├── seo/
│   ├── publishing/
│   ├── analytics/
│   └── shared/
├── plugins/
│   ├── wordpress/
│   ├── buy-me-a-coffee/
│   ├── amazon-affiliate/
│   ├── pinterest/
│   ├── instagram/
│   ├── x-twitter/
│   └── youtube/
├── providers/
│   ├── ai/
│   │   ├── claude/
│   │   ├── openai/
│   │   ├── gemini/
│   │   └── openrouter/
│   └── storage/
│       ├── local/
│       ├── s3/
│       └── cloudflare-r2/
├── docs/
│   ├── architecture/
│   ├── decisions/
│   ├── engineering/
│   └── sprints/
├── scripts/                # optional stub generator only
├── docker-compose.yml
├── .env.example
├── .editorconfig
├── .gitignore
├── .prettierrc
├── .prettierignore
├── CONTRIBUTING.md
├── LICENSE
├── eslint.config.js
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── turbo.json
└── README.md
```

**Naming convention:** All internal packages use scope `@pcme/<name>` (e.g. `@pcme/core`, `@pcme/plugin-wordpress`, `@pcme/provider-ai-claude`).

**Dependency direction (enforced in Sprint 1 via documentation and review; automated checks — see Stretch Goals):**

```txt
apps → packages, plugins, providers
plugins → packages (public interfaces only)
providers → packages (public interfaces only)
packages/core, packages/shared → no domain package deps
packages/* → may depend on core, shared (and database when added in Sprint 2)
```

Circular dependencies between domain packages are forbidden. Turborepo task graph must reflect build order (see Section 8.1).

---

## 5. Workspace Configuration

### Package manager

- **pnpm** (v9+) with `pnpm-workspace.yaml`
- Single lockfile at repo root
- `packageManager` field in root `package.json` for Corepack consistency
- `.nvmrc` or `.node-version` pinning Node.js 20 LTS

### Workspaces included

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "plugins/*"
  - "providers/ai/*"
  - "providers/storage/*"
```

### Turborepo

- **turbo.json** defines pipeline tasks:
  - `build` — depends on `^build` (upstream packages first; apps last)
  - `lint` — no upstream dependency
  - `typecheck` — depends on `^build` where types are emitted
- **`dev` task is not configured at root for Sprint 1** (see Out of Scope)
- Remote caching disabled for MVP; local cache enabled

### TypeScript

- **Strict mode** enabled repo-wide via `tsconfig.base.json`
- Each package extends base config
- Apps may add framework-specific compiler options (Next.js, NestJS)
- Path aliases reserved for future use; Sprint 1 uses workspace package names only
- Output: `dist/` per package; apps follow framework defaults (`.next/`, etc.)

### Node version

- **Node.js 20 LTS** (document in README, `.nvmrc` / `.node-version`, and CI)

---

## 6. Package Responsibilities

Sprint 1 creates **empty stubs only**. Each stub exports a placeholder (e.g. package name constant or empty object) so the dependency graph compiles. Responsibilities below define what each package **will own** — implementation begins Sprint 2+.

| Package            | Future responsibility                                                     | Sprint 1 stub               |
| ------------------ | ------------------------------------------------------------------------- | --------------------------- |
| `@pcme/core`       | Organization/Project context, plugin registry, domain events, error types | Empty export                |
| `@pcme/shared`     | Utilities, constants, shared types                                        | Empty export                |
| `@pcme/database`   | Prisma schema, repositories, migrations                                   | Empty export; no Prisma yet |
| `@pcme/ai`         | AiProvider interface, pipeline, prompt registry                           | Empty export                |
| `@pcme/media`      | Asset service, StorageProvider, MediaUrlResolver                          | Empty export                |
| `@pcme/content`    | Content types, lifecycle, orchestrator                                    | Empty export                |
| `@pcme/seo`        | SEO analysis, meta, schema                                                | Empty export                |
| `@pcme/publishing` | Outbox, Renderer, Publisher, channel interfaces                           | Empty export                |
| `@pcme/analytics`  | Performance tracking, stale content                                       | Empty export                |

### Plugin stubs

| Plugin           | Package name                    | Future responsibility             |
| ---------------- | ------------------------------- | --------------------------------- |
| WordPress        | `@pcme/plugin-wordpress`        | WordPress REST API publish/update |
| Buy Me a Coffee  | `@pcme/plugin-buy-me-a-coffee`  | BMC block rendering               |
| Amazon Affiliate | `@pcme/plugin-amazon-affiliate` | Affiliate product blocks          |
| Pinterest        | `@pcme/plugin-pinterest`        | Pinterest publish (future)        |
| Instagram        | `@pcme/plugin-instagram`        | Instagram publish (future)        |
| X / Twitter      | `@pcme/plugin-x-twitter`        | X publish (future)                |
| YouTube          | `@pcme/plugin-youtube`          | YouTube publish (future)          |

### Provider stubs

| Provider      | Package name                   | Future responsibility        |
| ------------- | ------------------------------ | ---------------------------- |
| Claude        | `@pcme/provider-ai-claude`     | Claude SDK adapter           |
| OpenAI        | `@pcme/provider-ai-openai`     | OpenAI adapter (stub)        |
| Gemini        | `@pcme/provider-ai-gemini`     | Gemini adapter (stub)        |
| OpenRouter    | `@pcme/provider-ai-openrouter` | OpenRouter adapter (stub)    |
| Local storage | `@pcme/provider-storage-local` | Local filesystem storage     |
| S3            | `@pcme/provider-storage-s3`    | AWS S3 adapter (stub)        |
| Cloudflare R2 | `@pcme/provider-storage-r2`    | Cloudflare R2 adapter (stub) |

### 6.1 Plugin and Provider Dependency Rules

These rules apply in Sprint 1 and all future sprints:

1. **Plugins may depend on public package interfaces** — imports from published exports (`index.ts`) of `@pcme/publishing`, `@pcme/core`, `@pcme/shared`, etc. Deep imports into package internals are forbidden.
2. **Core packages must not depend on plugins** — nothing under `packages/*` may import from `plugins/*` or `providers/*`. Dependency inversion: packages define interfaces; plugins implement them.
3. **Apps compose plugins** — only `apps/api` and `apps/worker` (and eventually `apps/dashboard` for client-side embeds if needed) wire concrete plugin and provider implementations at bootstrap.

**Sprint 1 stub rule:** Plugin and provider stubs declare **no internal `@pcme/*` dependencies** except optionally `@pcme/shared`. Real dependencies on `@pcme/publishing`, `@pcme/ai`, or `@pcme/media` are added in the sprint that implements each plugin or provider — not before.

---

## 7. Applications

Sprint 1 creates **shell applications** that start and compile. No feature routes or business logic.

### apps/dashboard (Next.js)

- **Framework:** Next.js 14+ (App Router)
- **Purpose:** Operator UI (Sprint 7)
- **Sprint 1 scope:**
  - Default app layout and single placeholder page ("PC Media Engine — Dashboard")
  - Depends on `@pcme/shared` only (proves workspace linking)
  - Individual `dev`, `build`, `lint`, `typecheck` scripts work
- **Port:** 3000 (document in README)

### apps/api (NestJS)

- **Framework:** NestJS 10+
- **Purpose:** HTTP API, auth, job enqueue (Sprint 2+)
- **Sprint 1 scope:**
  - Bootstrap module with health controller: `GET /health` → `{ status: "ok" }`
  - Depends on `@pcme/core`, `@pcme/shared`
  - No database module, no Prisma
  - Individual `dev`, `build`, `lint`, `typecheck` scripts work
- **Port:** 3001 (document in README)

### apps/worker (Node + BullMQ placeholder)

- **Purpose:** Background job processor (Sprint 3+)
- **Sprint 1 scope:**
  - Entry point that logs startup and exits cleanly, OR idle process with graceful shutdown
  - Depends on `@pcme/core`, `@pcme/shared`
  - BullMQ dependency declared but no queue connection required yet
  - Individual `dev`, `build`, `lint`, `typecheck` scripts work
- **Note:** Full Redis connection and job registration deferred to Sprint 3

---

## 8. Build Pipeline

### 8.1 Build Pattern Decision

Sprint 1 establishes a fixed build order enforced by Turborepo:

1. **Packages build first** — `packages/shared` and `packages/core`, then remaining `packages/*`, then `plugins/*` and `providers/*`
2. **Apps build after packages** — `apps/api`, `apps/worker`, and `apps/dashboard` depend on upstream `^build` completing before app build tasks run
3. **Turbo pipeline reflects this** — every app `build` task declares `"dependsOn": ["^build"]`; library packages emit `dist/` with declaration files before consumers typecheck or build

This pattern carries forward to Sprint 2+ when `@pcme/database` and other packages gain real compilation steps (e.g. Prisma generate).

### Local commands (root `package.json` scripts)

| Script              | Action                                                 |
| ------------------- | ------------------------------------------------------ |
| `pnpm install`      | Install all workspace dependencies                     |
| `pnpm build`        | Turborepo build all packages and apps (packages first) |
| `pnpm lint`         | ESLint all TypeScript sources                          |
| `pnpm typecheck`    | `tsc --noEmit` across workspace                        |
| `pnpm format`       | Prettier write                                         |
| `pnpm format:check` | Prettier check (CI)                                    |
| `pnpm infra:up`     | `docker compose up -d`                                 |
| `pnpm infra:down`   | `docker compose down`                                  |

Root-level `pnpm dev` is **not** included in Sprint 1 (see Section 12). Contributors run per-app dev scripts directly (e.g. `pnpm --filter @pcme/api dev`).

### Output artifacts

- Libraries: `dist/` with declaration files (`.d.ts`)
- Next.js: `.next/`
- NestJS: `dist/`
- Worker: `dist/`

All build outputs listed in `.gitignore`.

---

## 9. Development Tooling

### Required tools

| Tool    | Version       | Purpose                |
| ------- | ------------- | ---------------------- |
| Node.js | 20 LTS        | Runtime                |
| pnpm    | 9+            | Package manager        |
| Docker  | Latest stable | Local Postgres + Redis |
| Git     | 2.x           | Version control        |

### Code quality

- **ESLint** — TypeScript-aware; shared config at root; apps extend as needed
- **Prettier** — Single formatting standard; integrate with ESLint (eslint-config-prettier)
- **EditorConfig** — `.editorconfig` at repo root for indent, charset, and end-of-line consistency across editors

### Git hooks (optional stretch)

- **Husky + lint-staged** — Run lint and format on staged files
- Not required for Sprint 1 Definition of Done; document as Sprint 1.1 or early Sprint 2 improvement

### 9.1 Environment File Alignment

Sprint 1 ships **`.env.example` only**. No `.env` file is committed. No real secrets, credentials, or API keys appear anywhere in the repository.

| Rule                      | Detail                                                                                                       |
| ------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Single template           | Root `.env.example`; apps read from env at runtime (Sprint 2+ may add app-specific examples)                 |
| Placeholder values only   | Use obvious non-production placeholders (e.g. `pcme_dev`, `changeme`)                                        |
| Align with Docker Compose | `DATABASE_URL` and `REDIS_URL` must match `docker-compose.yml` service names, ports, and default credentials |
| Forward-compatible naming | Variable names must work for `apps/api` and `apps/worker` without rename in later sprints                    |

**Required variables in `.env.example`:**

| Variable         | Purpose             | Sprint 1 usage                    | Example placeholder                              |
| ---------------- | ------------------- | --------------------------------- | ------------------------------------------------ |
| `DATABASE_URL`   | Postgres connection | Documented; unused until Sprint 2 | `postgresql://pcme:pcme@localhost:5432/pcme_dev` |
| `REDIS_URL`      | Redis connection    | Documented; unused until Sprint 3 | `redis://localhost:6379`                         |
| `API_PORT`       | API listen port     | Used by `apps/api`                | `3001`                                           |
| `DASHBOARD_PORT` | Next.js port        | Used by `apps/dashboard`          | `3000`                                           |
| `NODE_ENV`       | Environment         | All apps                          | `development`                                    |

No AI keys, WordPress credentials, or cloud storage secrets in Sprint 1.

### Docker Compose services

| Service    | Image              | Port | Purpose           |
| ---------- | ------------------ | ---- | ----------------- |
| `postgres` | postgres:16-alpine | 5432 | Sprint 2 database |
| `redis`    | redis:7-alpine     | 6379 | Sprint 3 queues   |

Credentials in Compose must match `DATABASE_URL` in `.env.example`. Volumes for data persistence. Health checks enabled. Services start independently of apps.

---

## 10. CI/CD Foundation

### Platform

- **GitHub Actions** (`.github/workflows/ci.yml`)
- Triggers: push to `main`, pull requests to `main`

### CI pipeline steps

1. Checkout repository
2. Setup Node.js 20 with Corepack enabled
3. Install pnpm
4. `pnpm install --frozen-lockfile`
5. `pnpm format:check`
6. `pnpm lint`
7. `pnpm typecheck`
8. `pnpm build`

### CI constraints

- No secrets required for Sprint 1 CI
- No Docker services in CI (build does not need Postgres/Redis yet)
- No test step (added Sprint 2+)
- Fail fast on any step error
- **Sprint 2 note:** CI will gain a Postgres service container; leave room in workflow structure for this addition

### CD

- **Not in Sprint 1 scope.** Production deploy pipeline deferred to Sprint 9.
- Document in README that CD will be added later.

### Branch protection (manual, post-merge)

- Require CI pass before merge to `main`
- No force push to `main`

---

## 11. Definition of Done

Sprint 1 is complete when **all** of the following are true:

- [ ] Sprint 0 hard gate satisfied (Section: Hard Gate)
- [ ] Monorepo structure matches Section 4
- [ ] `pnpm install` succeeds from clean clone
- [ ] `pnpm-lock.yaml` committed; `pnpm install --frozen-lockfile` succeeds
- [ ] Node 20 and pnpm version pinned (`.nvmrc` / `.node-version` and `packageManager` field)
- [ ] `pnpm build` succeeds with zero errors — packages before apps
- [ ] `pnpm lint` passes with zero errors
- [ ] `pnpm typecheck` passes with zero errors
- [ ] `pnpm format:check` passes
- [ ] CI workflow passes on `main`
- [ ] `docker compose up -d` starts Postgres and Redis; both services healthy
- [ ] `.env.example` documents all variables with placeholders; `.env` is gitignored
- [ ] `DATABASE_URL` in `.env.example` matches Docker Compose credentials
- [ ] README includes: prerequisites, install, build, lint, infra commands
- [ ] `CONTRIBUTING.md` links to engineering principles
- [ ] `LICENSE` present (MIT unless otherwise specified)
- [ ] `.editorconfig` present at repo root
- [ ] All `@pcme/*` packages resolve via workspace protocol (no published npm deps for internal packages)
- [ ] Apps start locally via per-app dev scripts: dashboard (placeholder page), api (`GET /health` → 200), worker (startup log)
- [ ] Plugin/provider stubs follow Section 6.1 dependency rules
- [ ] No domain logic, database schema, or external API integrations exist
- [ ] No secrets committed to repository
- [ ] Engineering principles checklist considered for any interface stubs added
- [ ] Sprint 1 completion documented in `docs/sprints/sprint-1-notes.md` (brief)

### Smoke verification (recommended commands)

Document these in README or sprint notes when closing the sprint:

```bash
pnpm --filter @pcme/api dev          # then: curl -sf http://localhost:3001/health
pnpm --filter @pcme/dashboard dev    # then: verify placeholder page loads
pnpm --filter @pcme/worker dev       # verify startup log appears
```

---

## 12. Out of Scope

The following are explicitly **not** part of Sprint 1. Attempting them creates scope creep and delays the foundation.

| Item                                           | Target sprint                                                       |
| ---------------------------------------------- | ------------------------------------------------------------------- |
| Prisma schema, migrations, seed data           | Sprint 2                                                            |
| Repository layer and database queries          | Sprint 2                                                            |
| Organization / Project entities                | Sprint 2                                                            |
| AiProvider interface and Claude implementation | Sprint 3                                                            |
| BullMQ job processors                          | Sprint 3                                                            |
| StorageProvider and MediaUrlResolver           | Sprint 4                                                            |
| Content lifecycle state machine                | Sprint 5                                                            |
| PublishingOutbox, Renderer, Publisher          | Sprint 6                                                            |
| WordPress plugin implementation                | Sprint 6                                                            |
| Dashboard feature UI                           | Sprint 7                                                            |
| PiercingConnect content and config             | Sprint 8                                                            |
| Production deploy, monitoring, backups         | Sprint 9                                                            |
| Postgres RLS, RBAC, secrets vault              | v1.0 / ADR revisit triggers                                         |
| **Root-level `pnpm dev`**                      | Sprint 2+ (optional); per-app `dev` scripts sufficient for Sprint 1 |
| Husky pre-commit hooks                         | Optional; Sprint 1.1 or early Sprint 2                              |
| Turborepo remote cache                         | Optional; not blocking                                              |

---

## 13. Stretch Goals

Not required for Definition of Done. Pursue if core deliverables are complete early.

| Stretch goal                           | Purpose                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| **dependency-cruiser** (or equivalent) | Automated package boundary validation; enforce Section 6.1 rules in CI   |
| Husky + lint-staged                    | Pre-commit lint and format                                               |
| Package stub generator script          | Reduce manual errors across ~30 packages (see Section 3 optional helper) |

If dependency-cruiser is added, it should fail CI on: `packages/*` importing `plugins/*` or `providers/*`, and circular dependencies between domain packages.

---

## References

- [Engineering Principles](../engineering/engineering-principles.md)
- [ROADMAP](../../ROADMAP.md) — required before implementation (Hard Gate)
- Sprint 0 architecture docs — required before implementation (Hard Gate)
- [ADR 001 — Monorepo](../decisions/001-monorepo.md) — required before implementation (Hard Gate)

---

## Sprint 1 Execution Order (recommended)

**Pre-step:** Verify Sprint 0 hard gate (all architecture docs, ADRs, ROADMAP committed).

1. Root workspace + Turborepo + shared TS/ESLint/Prettier + EditorConfig
2. LICENSE, CONTRIBUTING.md
3. `packages/shared` and `packages/core` stubs
4. Remaining `packages/*` stubs (parallelizable)
5. `plugins/*` and `providers/*` stubs (parallelizable; no internal deps except `@pcme/shared`)
6. `apps/api` shell (health check)
7. `apps/worker` shell
8. `apps/dashboard` shell (parallelizable with steps 6–7 after step 3)
9. Docker Compose + `.env.example` (aligned credentials)
10. CI workflow
11. README and sprint notes
12. Optional: stub generator script, dependency-cruiser (stretch)
13. Verify Definition of Done checklist

### Parallel workstreams (after step 3)

| Stream A               | Stream B           | Stream C              |
| ---------------------- | ------------------ | --------------------- |
| Remaining `packages/*` | `plugins/*` stubs  | `providers/*` stubs   |
| then `apps/api`        | then `apps/worker` | then `apps/dashboard` |

---

_This document is the Sprint 1 implementation plan. It defines what to build during Sprint 1 execution. It is not itself a deliverable that satisfies the Definition of Done — the scaffold and tooling it describes are._
