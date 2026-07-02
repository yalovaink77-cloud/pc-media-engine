# PC Media Engine Engineering Principles

**Status:** Active  
**Audience:** All contributors  
**Scope:** Entire PC Media Engine monorepo — apps, packages, plugins, and providers

This document defines mandatory engineering standards for the PC Media Engine project. It is an internal policy, not a tutorial. When principles conflict with convenience, principles win unless an ADR explicitly records an accepted exception.

---

## 1. General Philosophy

PC Media Engine is a long-lived platform intended to support multiple projects, hundreds of sites, and millions of media assets over time. Engineering decisions must reflect that horizon.

- **Long-term maintainability over short-term speed.** A correct, boring solution that survives three years beats a fast hack that blocks the next sprint. Speed matters, but not at the cost of structural damage.
- **Simplicity over cleverness.** Prefer readable, predictable code over abstractions that impress but obscure. If a junior engineer cannot follow the flow in one sitting, simplify.
- **Build for extensibility.** New projects (Lumora, GagBox, Barber SaaS), AI providers, storage backends, and publishing channels must be addable without rewriting core domain logic.
- **Prefer composition over inheritance.** Assemble behavior from small, injectable units. Deep inheritance hierarchies are discouraged.
- **Architecture decisions should minimize future refactoring.** When a choice locks in direction — schema shape, public interfaces, job contracts — invest time upfront or document the tradeoff in an ADR.

---

## 2. Architecture Rules

PC Media Engine follows Clean Architecture and SOLID. The goal is a testable domain core surrounded by replaceable infrastructure.

- **Follow Clean Architecture principles.** Domain and application logic sit at the center. Frameworks, databases, AI SDKs, and WordPress clients are outer layers.
- **Follow SOLID principles.** Single responsibility, open/closed, Liskov substitution, interface segregation, and dependency inversion apply to all packages.
- **Use Dependency Inversion.** High-level modules define interfaces; low-level modules implement them. Domain packages import abstractions, not concrete providers.
- **Feature modules must be loosely coupled.** Packages communicate through published interfaces and domain events — not through shared internal types or cross-package deep imports.
- **Avoid circular dependencies.** If two packages need each other, extract shared contracts to `packages/core` or `packages/shared`. Circular imports are build failures, not warnings.
- **Business logic must never depend on infrastructure.** Content lifecycle rules, SEO scoring, and publish eligibility must not import Prisma clients, Redis, S3 SDKs, or WordPress HTTP clients.
- **Infrastructure depends on abstractions.** Repositories, AI providers, storage providers, URL resolvers, and publishing channels implement ports defined by domain or application layers.

**Composition root:** `apps/api` and `apps/worker` wire concrete implementations at bootstrap. Nowhere else.

---

## 3. Repository Standards

The monorepo exists to share types and enforce boundaries — not to become a single undifferentiated codebase.

- **Monorepo using pnpm workspaces.** All packages resolve via workspace protocol. Lockfile is authoritative; no duplicate installs across apps.
- **Shared code belongs in packages.** If two apps need it, it lives in `packages/*`. If only one app needs it and it has no domain meaning, it may stay in that app — but domain logic never stays in apps.
- **Applications only compose packages.** `apps/dashboard`, `apps/api`, and `apps/worker` are thin: routing, auth middleware, UI, job registration. No business rules embedded in controllers or React components beyond presentation validation.
- **Plugins communicate through public interfaces.** WordPress, Buy Me a Coffee, affiliate, and future social plugins implement interfaces from `packages/publishing` or `packages/core`. Plugins must not import each other.
- **No duplicated business logic.** Lifecycle transitions, idempotency rules, revision checks, and audit requirements exist in one place. Copy-paste across apps or packages is a review blocker.

**Import rule:** Depend on package public exports (`index.ts`) only. Deep imports into another package's internals are forbidden.

---

## 4. Code Quality

Readable, predictable code is a security and reliability feature.

- **Small focused classes.** One reason to change. If a class handles orchestration, rendering, and persistence, split it.
- **Small focused functions.** Prefer functions that do one thing and fit on one screen. Extract when branching depth exceeds two levels without clear purpose.
- **Prefer explicit naming.** Names describe intent: `enqueuePublishOutboxEntry`, not `handlePublish`. Abbreviations are allowed only when universally understood in this codebase (`SEO`, `API`, `DTO`).
- **No magic numbers.** Use named constants or configuration. Retry counts, TTLs, size limits, and token caps belong in config or well-named constants — not inline literals.
- **No hidden side effects.** A function named `validate` must not write to the database. Side effects are explicit in orchestrators and workers.
- **No global mutable state.** No module-level caches that mutate without injection. Use DI, request context, or explicit service instances.
- **Fail fast.** Invalid state, missing project context, or revision mismatch throws immediately — never silently continues or returns partial success.
- **Validate inputs early.** API boundaries, job payloads, and service entry points validate before touching the database or external systems.

---

## 5. API Design

The HTTP API is a contract with the dashboard and future integrations. Treat it as a long-lived public surface even when internal-only.

- **Consistent naming.** REST resources use plural nouns; actions use verbs on sub-resources (`POST /content/:id/publish`). Query parameters follow snake_case or camelCase consistently — one convention project-wide.
- **Versioned public APIs.** Prefix public routes with version (`/v1/`). Breaking changes require a new version, not silent mutation.
- **Idempotent write operations whenever possible.** Publish, upload confirmations, and outbox enqueue accept idempotency keys. Duplicate requests return the same result, not duplicate side effects.
- **Explicit DTOs.** Request and response shapes are defined types — not raw Prisma entities returned to clients.
- **No leaking internal models.** Database column names, storage keys, provider response bodies, and revision internals stay server-side unless intentionally exposed.

**Async operations:** Long-running work returns `202 Accepted` with a job or outbox reference — not a blocking response.

---

## 6. Data Principles

Data outlives code. Schema and access patterns must enforce isolation, traceability, and recoverability.

- **Every entity belongs to a Project.** All tenant-scoped records carry `projectId`. Organization-scoped records carry `organizationId`. Queries without project scope are forbidden in repositories.
- **Soft delete where appropriate.** Assets, content items, and deactivated projects use `deletedAt` — not hard delete by default. Hard delete is a background job with a grace period.
- **Immutable audit logs.** Audit entries are append-only. Corrections are new entries, not edits. Secrets and full prompt text never appear in audit metadata.
- **Optimistic concurrency where required.** Content items use revision-based locking. Transitions and publishes that ignore revision are rejected.
- **Every external operation must be traceable.** Publish attempts, AI jobs, and integration changes link to audit entries, outbox records, or job IDs. An operator must reconstruct what happened from logs and database records alone.

Refer to `docs/architecture/data-retention-policy.md` for growth and archival rules.

---

## 7. AI Integration

AI is infrastructure, not domain truth. Treat providers as interchangeable utilities.

- **AI providers must be replaceable.** Business logic calls `AiProvider` through `packages/ai` — never a vendor SDK directly.
- **Never hardcode provider SDKs into business logic.** SDK imports exist only in `providers/ai/*` implementations.
- **Prompt templates separated from orchestration.** Prompts live in the prompt registry; orchestrators supply variables and interpret results. Prompt text does not live inside service methods.
- **Every AI execution logged.** Token usage, task type, project, content reference, duration, and outcome are recorded in `AiJob` and audit log.
- **Provider failures must not crash workflows.** Rate limits and transient errors retry via job queue. Permanent failures mark the job failed, audit the outcome, and leave content in a recoverable state — never corrupt or partially overwrite.

---

## 8. Background Jobs

Workers handle latency, retries, and external delivery. They orchestrate — they do not redefine rules.

- **Jobs must be idempotent.** Reprocessing the same job ID or idempotency key produces the same outcome or safely no-ops.
- **Retries must be safe.** Only retry errors classified as transient. Never retry auth failures or validation errors without human intervention.
- **Long-running work belongs in workers.** AI generation, rendering, publishing, thumbnail generation, and bulk operations never block API request threads.
- **Workers must never contain business rules that bypass domain services.** Workers call the same domain services and orchestrators as the API. Lifecycle transitions, revision checks, and outbox rules are not reimplemented in job handlers.

**Publishing rule:** External publish always flows through `PublishingOutbox`. Workers consume outbox entries — they do not call WordPress directly from ad hoc job code.

---

## 9. Media Handling

Media identity is separate from media delivery. Storage migration must not require content rewrites.

- **Never expose raw storage paths.** Filesystem paths, S3 keys, and bucket names are infrastructure details — not API fields, not HTML embeds, not log output at info level.
- **Use MediaUrlResolver.** All URL generation for embed, preview, publish, and download goes through the resolver with an explicit purpose (`public`, `private`, `signed`, `temporary`).
- **Metadata first.** The `Asset` record in PostgreSQL is the source of truth for tags, alt text, usage rights, and project ownership. Blobs are referenced by asset ID.
- **Original assets immutable.** Corrections upload a new asset or version — originals are not overwritten in place.
- **Derived assets reproducible.** Thumbnails and previews can be regenerated from originals. Deleting derivatives and re-running the job must be safe.

---

## 10. Security

Security is built in, not bolted on before launch.

- **Principle of least privilege.** Services, API keys, and WordPress credentials access only what they need. Production credentials do not exist in development configs.
- **Secrets never committed.** No API keys, passwords, or tokens in git — including test fixtures. Use `.env.example` with placeholder names only.
- **Environment-driven configuration.** Behavior differences across dev, staging, and production come from environment variables or injected config — not commented-out code branches.
- **Input validation by default.** All external input is untrusted: uploads, API bodies, webhook payloads, WordPress responses used in logic.
- **Audit important actions.** Content lifecycle changes, publish attempts, media uploads, and integration config changes produce audit log entries with actor and project context.

Known deferred items (RLS, RBAC, secrets vault) are recorded in `docs/decisions/004-known-risks-before-sprint-1.md`. They are not permission to skip security thinking — only to defer specific implementations.

---

## 11. Testing Philosophy

Tests protect refactorability. They are required, not optional decoration.

- **Unit tests for domain logic.** State machines, SEO scoring, idempotency key generation, revision validation, and render input assembly are tested without database or network.
- **Integration tests for infrastructure.** Repositories, storage providers, AI provider adapters, and WordPress plugin against staging fixtures or test containers.
- **End-to-end tests for workflows.** Critical paths: upload asset → create content → AI draft → approve → outbox publish → verify audit trail. Run against staging, not production.
- **Test behavior, not implementation.** Assert outcomes and contracts — not internal call order or private method invocation unless testing a pure unit with no alternative observable surface.

**Mock at boundaries.** Mock `AiProvider`, `StorageProvider`, and `PublishingChannel` — not domain services under test.

---

## 12. Documentation

Documentation is part of the deliverable, not a post-merge afterthought.

- **Every architectural change requires an ADR.** New patterns, deferred risks, provider choices, and breaking boundary changes get a numbered record in `docs/decisions/`.
- **Public interfaces documented.** Exported types, service contracts, and plugin interfaces include JSDoc or adjacent markdown describing purpose, inputs, and failure modes.
- **Complex modules require diagrams.** Lifecycle flows, outbox pipeline, and multi-package interactions include sequence or component diagrams in `docs/architecture/`.
- **Keep documentation synchronized with implementation.** If code changes behavior, the same PR updates the relevant doc or ADR. Stale docs are treated as bugs.

---

## 13. Performance

Performance matters at scale, but premature optimization wastes time and adds complexity.

- **Optimize only after measuring.** Profile or instrument before rewriting hot paths. Log slow queries and job durations in staging first.
- **Cache behind abstractions.** Caching is an infrastructure concern injected via interfaces — not scattered `redis.get` calls in domain code.
- **Prefer streaming for large media.** Upload and download use streams where the stack allows; do not load multi-megabyte files entirely into memory on API workers.
- **Design for horizontal scalability.** Stateless API and worker processes; shared Postgres and Redis; blob storage external to app instances. No design that requires a single server's local disk for production media.

---

## 14. Engineering Mindset

Culture is the enforcement layer when linters and reviewers are not in the room.

Every contribution should leave the codebase cleaner than it was found. Fix adjacent small problems — unclear names, missing types, orphaned imports — when the cost is minutes, not hours.

If a shortcut creates long-term technical debt, document it with an ADR before merging. Undocumented debt becomes invisible risk. Documented debt has an owner and a revisit trigger.

When in doubt, ask: _Would this still be correct with ten projects, three AI providers, and a new storage backend?_ If not, introduce an abstraction or record why the limitation is acceptable.

---

## Before Opening a Pull Request

Every author verifies the following before requesting review:

- [ ] Changes respect package boundaries — no circular deps, no deep cross-package imports, no business logic added to apps
- [ ] All queries and writes are scoped by `projectId` (and `organizationId` where applicable)
- [ ] External operations (AI, publish, upload) are async/idempotent where required; no direct WordPress calls outside Publisher
- [ ] Media URLs use `MediaUrlResolver` — no raw storage paths in API responses or rendered output
- [ ] Lifecycle transitions and content updates enforce revision checks; conflicts fail clearly
- [ ] Audit log entries added for significant actions (create, update, transition, publish, upload, integration change)
- [ ] No secrets, credentials, or real API keys in code, tests, or committed config
- [ ] Unit tests cover new domain logic; integration tests updated if infrastructure contracts changed
- [ ] Public interfaces and architectural impact documented; ADR added if decision-worthy
- [ ] PR description explains _why_, lists revisit triggers for any accepted shortcuts, and confirms lint/typecheck pass
