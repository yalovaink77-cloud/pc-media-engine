# PC Media Engine — Release Readiness Review v1.0

**Date:** 2026-07-11  
**Branch under review:** `feature/commerce-knowledge-loader`  
**HEAD:** `6773a61` — `test(platform): add end-to-end pipeline dry run`  
**Repository:** `pc-media-engine`  
**Root version:** `0.50.0-beta-rc` (`package.json`)  
**Review mode:** Read-only architecture and release audit — no code changes  
**External constraint verified:** `piercingconnect-commerce` is read-only input; PCME does not modify it (`packages/content/src/commerce/paths.ts`, `packages/content/src/knowledge/adapters/commerce-adapter.ts`)

---

## 1. Executive Summary

`feature/commerce-knowledge-loader` delivers a **complete offline-first content pipeline** from read-only commerce knowledge loading through orchestration, AI generation, human review, publishing handoff, durable outbox enqueue, and single-cycle worker execution. Sprint 040 (`packages/publishing/src/pipeline/run-content-pipeline-dry-run.ts`) validates the full chain end-to-end in fake/in-memory mode with safe metadata-only results.

The branch is **architecturally coherent** for its stated scope: knowledge → generation → review → handoff → outbox → worker. Package runtime dependencies form an **acyclic graph** (verified across all workspace `package.json` `dependencies` fields). Critical paths have dedicated unit tests and smoke scripts. Production TypeScript contains **no TODO/FIXME markers** and **no hardcoded secrets**.

The branch does **not** complete v1.0 production operations on its own. Two publishing stacks coexist (legacy BullMQ + new durable handoff). The main worker entry point (`apps/worker/src/index.ts`) still boots only BullMQ processing and the legacy publishing queue — durable handoff publishing is opt-in via `apps/worker/src/durable-publishing/bootstrap.ts` and `apps/worker/scripts/publishing-worker-run-once.ts`. Production deployment documentation contains **incorrect WordPress environment variable names** relative to the runtime loader in `plugins/wordpress/src/config.ts`.

**Merge into `main` is recommended.** The three release conditions from §3 (WordPress env template, production auth guard, durable worker documentation) were remediated on 2026-07-11. Remaining HIGH items (H-3, H-6–H-8) are post-merge hardening, not merge gates.

---

## 2. Release Score

**76 / 100**

| Dimension | Score | Evidence |
| --------- | ----- | -------- |
| Architecture integrity | 82 | Acyclic deps; strong `@pcme/content` isolation; dual-stack publishing |
| Test confidence | 78 | 55 real vitest files on critical packages; 15 no-op test packages |
| Security & safety | 74 | Wired WordPress paths draft-only; auth off by default; good dry-run redaction |
| Operational readiness | 68 | Durable worker not in main loop; no CI smoke; retry/outbox implemented in library |
| Documentation accuracy | 62 | README/architecture docs stale vs `0.50.0-beta-rc` |
| Repository cleanliness | 80 | Clean commits; lint-staged; CI pipeline; scaffold packages documented |
| Public API stability | 75 | Intentional re-exports; some duplicate types across packages |

---

## 3. Merge Recommendation

### **GO**

Merge `feature/commerce-knowledge-loader` into `main` when:

1. CI passes on the PR (`lint`, `typecheck`, `build`, `test`, `format:check` — `.github/workflows/ci.yml`).
2. The three release conditions in §3.1 are verified (remediated 2026-07-11).
3. `docs/architecture/architecture-review-v1.md` is treated as **partially superseded** by Sprints 037–040 (durable outbox, enqueue, worker, pipeline dry run).

### 3.1 Release conditions — resolved (2026-07-11)

| Condition | Status | Remediation |
| --------- | ------ | ----------- |
| **H-1** WordPress production env var names | **Resolved** | `deploy/env/.env.production.example` aligned to `plugins/wordpress/src/config.ts` (`WORDPRESS_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APP_PASSWORD`); `docs/releases/beta-checklist.md` updated |
| **H-4 / H-5** Production API auth disabled silently | **Resolved** | `apps/api/src/auth/config.ts` — `validateAuthConfig(..., { production: true })` errors when auth disabled or incomplete; `apps/api/src/server.ts` calls `assertNoFatalErrors` in production; tests in `apps/api/src/__tests__/auth.test.ts` |
| **H-2** Durable worker entry unclear | **Resolved** | `docs/deployment/durable-publishing-worker.md`; `apps/worker/src/index.ts` header comment; `docs/deployment/production-checklist.md` link; optional vars in `deploy/env/.env.production.example` |

---

## 4. Release Blockers

> Only findings classified **BLOCKER** prevent merge. This section lists merge-blocking issues.

**None identified for code merge.**

All wired production call sites of `createWordPressPublishingTargetAdapter` pass `{ forceDraft: true }` (`apps/worker/src/durable-publishing/bootstrap.ts:30`, `packages/publishing/src/pipeline/run-content-pipeline-dry-run.ts:240`). Legacy `WordPressMediaPublisher` hardcodes `status: 'draft'` (`plugins/wordpress/src/wordpress-media.publisher.ts:151`). The branch does not enable public auto-publishing on any integrated path.

> **Note:** Incorrect WordPress variable names in `deploy/env/.env.production.example:66–68` are classified **HIGH** (§5), not BLOCKER for merge, because the runtime loader (`plugins/wordpress/src/config.ts:5–9, 94–96`) is correct and the mismatch is a documentation/template defect predating this branch's core deliverables.

---

## 5. High Priority Findings

| ID | Finding | Evidence |
| -- | ------- | -------- |
| H-1 | ~~Production deployment template uses wrong WordPress env var names~~ **Resolved** | Was: `deploy/env/.env.production.example` documented `WORDPRESS_API_URL`, `WORDPRESS_PASSWORD`. Fixed: `WORDPRESS_URL`, `WORDPRESS_USERNAME`, `WORDPRESS_APP_PASSWORD` per `plugins/wordpress/src/config.ts` |
| H-2 | **Dual publishing stacks without unified worker entry** (documented, not unified) | Legacy: `apps/worker/src/index.ts:36–37`. Durable: `docs/deployment/durable-publishing-worker.md`, `pnpm publishing-worker:run-once` |
| H-3 | **Dual WordPress integrations in one plugin** | `plugins/wordpress/src/wordpress-media.publisher.ts` (legacy `Publisher` / publisher-sdk) and `plugins/wordpress/src/wordpress-publishing-target.adapter.ts` (handoff `PublishingTargetAdapter`). Both exported from `plugins/wordpress/src/index.ts`. |
| H-4 | ~~API authentication disabled by default in production~~ **Resolved** | `apps/api/src/auth/config.ts` production guard; `deploy/env/.env.production.example:41–46` unchanged (already recommends auth) |
| H-5 | ~~Auth misconfiguration does not abort API startup~~ **Resolved** | `apps/api/src/server.ts` — production auth validation is fatal via `assertNoFatalErrors` |
| H-6 | **Smoke suites not executed in CI** | `.github/workflows/ci.yml` runs `pnpm test` only; 43 root `*:smoke` commands (`package.json:29–71`) and `pipeline:dry-run` are manual. |
| H-7 | **`architecture-review-v1.md` partially stale** | Dated 2026-07-10; states handoff path does not use PublishingOutbox/worker (`docs/architecture/architecture-review-v1.md:15–16, 84–92`). Sprints 037–040 added `packages/database` outbox repos, `packages/publishing/src/enqueue/`, `packages/publishing/src/worker/`, and `packages/publishing/src/pipeline/`. |
| H-8 | **15 workspace packages use no-op test scripts** | `"test": "node -e \"process.exit(0)\""` in `@pcme/shared`, `@pcme/core`, `@pcme/analytics`, stub providers/plugins. Inflates `pnpm test` / turbo pass rate without assertions. |

---

## 6. Medium Findings

| ID | Finding | Evidence |
| -- | ------- | -------- |
| M-1 | **`@pcme/publishing` dynamically imports plugins/providers** | `packages/publishing/src/pipeline/run-content-pipeline-dry-run.ts:199, 214, 283` imports `@pcme/provider-ai-openrouter`, `@pcme/plugin-wordpress`, `@pcme/database` at runtime. Violates documented rule in `docs/architecture/module-map.md` ("Core packages must not depend on plugins or providers"). |
| M-2 | **`@pcme/plugin-wordpress` not declared in publishing `package.json`** | Dynamic import via variable specifier `WORDPRESS_PLUGIN_MODULE` (`run-content-pipeline-dry-run.ts:205–216`). Turbo `^build` does not order `@pcme/plugin-wordpress` before `@pcme/publishing` for `pipeline:dry-run` WordPress-draft mode. |
| M-3 | **Duplicate `PublishingMetadataPublishStatus` type** | Identical union in `packages/shared/src/publish/handoff-package.ts:5–6` and `packages/publishing/src/handoff/types.ts:21–22`. |
| M-4 | **Duplicate `buildDeterministicOutboxId` implementations** | `packages/database/src/repositories/publishing-outbox.repository.ts` and `packages/publishing/src/worker/in-memory-outbox.repository.ts:26–28`; both exported (`packages/database/src/index.ts`, `packages/publishing/src/index.ts`). |
| M-5 | **In-memory test repositories exported on public surfaces** | `InMemoryPublishingOutboxRepository`, `InMemoryPublishingIdempotencyRepository` in `packages/publishing/src/index.ts`; `InMemoryContentReviewStore`, `InMemoryGeneratedContentArtifactStore` in `packages/ai/src/index.ts`. |
| M-6 | **Broad barrel exports (`export *`)** | `packages/content/src/index.ts` re-exports commerce, knowledge, orchestrator, prompt wholesale. `packages/ai/src/index.ts` re-exports entire generation module. |
| M-7 | **README and ROADMAP materially stale** | `README.md:5` — "Sprint 2 — database foundation"; `README.md:78` — tests described as "no-op stubs in Sprint 1"; omits `publisher-sdk`, `ghost`, release docs. `ROADMAP.md` references `v0.1.0-alpha`. |
| M-8 | **Architecture docs describe unimplemented or superseded layout** | `docs/architecture/system-overview.md` — NestJS/Next.js (actual: Fastify in `apps/api/package.json`, `apps/dashboard/package.json`). `docs/architecture/module-map.md` — `packages/publishing/rendering`, `packages/core` registry (actual: `packages/core/src/index.ts` is `export {}`; no rendering directory under publishing). |
| M-9 | **WordPress handoff adapter defaults `forceDraft: false`** | `plugins/wordpress/src/wordpress-publishing-target.adapter.ts:80`. `mapPublishStatus` can return `'publish'` when metadata says so (`plugins/wordpress/src/handoff-mapper.ts:85–86`). Mitigated: all current call sites pass `forceDraft: true` (grep confirms two production call sites only). |
| M-10 | **Legacy worker logs unredacted provider error messages** | `apps/worker/src/processors/publishing.processor.ts:84–89`, `apps/worker/src/publishing-worker.ts:64–66` log `result.message`. Handoff path sanitizes via `packages/publishing/src/worker/payload.ts:66–72`. |
| M-11 | **Apps/worker integration layer lacks dedicated unit tests** | Modules without dedicated test files: `apps/worker/src/publishing-worker.ts`, `apps/worker/src/worker.ts`, `apps/worker/src/config.ts`, `apps/worker/src/queue/publishing-enqueue.ts` (per static inventory vs `apps/worker/src/__tests__/`). |
| M-12 | **Smoke suite count inconsistency in release docs** | `docs/releases/beta-release-candidate.md:30` — "27 suites"; `release/metadata.json:20` and `scripts/beta-rc-smoke.ts:261–289` — 28 entries. |

---

## 7. Low Findings

| ID | Finding | Evidence |
| -- | ------- | -------- |
| L-1 | **Scaffold packages with zero importers** | `@pcme/core`, `@pcme/analytics` — `export {}`; grep `from '@pcme/core'` / `from '@pcme/analytics'` → 0 matches. |
| L-2 | **Stub plugins/providers** | `plugins/youtube/src/index.ts`, `providers/ai/claude/src/index.ts`, and similar — empty exports; included in workspace. |
| L-3 | **`@pcme/plugin-wordpress` redundant dual dependency** | Depends on both `@pcme/publisher-sdk` and `@pcme/publishing` (`plugins/wordpress/package.json`); publisher-sdk already re-exports publishing types (`packages/publisher-sdk/src/index.ts:13–20`). |
| L-4 | **Deprecated types retained** | `@deprecated` aliases in `packages/publishing/src/handoff/types.ts:85, 142`; `MediaRepository` deprecated in `packages/database/src/repositories/media.repository.ts:358`. |
| L-5 | **Workspace package versions all `0.0.0`** | All 28 workspace children; only root `0.50.0-beta-rc` (`release/metadata.json`). |
| L-6 | **No root `CHANGELOG.md`** | Version history at `docs/releases/changelog-v0.50.md` only. |
| L-7 | **Sprint documentation gap** | `docs/sprints/` has sprints 1–29, 31–49; no sprint-30 or sprint-50 doc files. |
| L-8 | **Dashboard isolated from `@pcme/*` workspace packages** | `apps/dashboard/package.json` — Fastify only; no PCME package imports. |

---

## 8. Technical Debt Register

### Acceptable (can ship with v1.0 merge)

| Item | Rationale | Location |
| ---- | --------- | -------- |
| Scaffold packages (`core`, `analytics`, stub plugins) | Placeholder workspace slots; zero runtime importers | `packages/core/src/index.ts`, plugin stubs |
| In-memory stores exported for offline/smoke | Required for `pipeline:dry-run`, unit tests, smoke scripts | `packages/publishing/src/worker/in-memory-*.ts`, `packages/ai` review stores |
| Legacy BullMQ publishing path retained | Backward compatibility for existing worker deployments | `apps/worker/src/publishing-worker.ts`, `apps/worker/src/processors/publishing.processor.ts` |
| Commerce repo sibling-path default | Explicit `COMMERCE_KNOWLEDGE_PATH` override available | `packages/content/src/commerce/paths.ts:10, 30–31` |
| Workspace packages at version `0.0.0` | Private monorepo; root version is release identifier | `release/metadata.json` |

### Merge blockers (must not defer past v1.0 production)

| Item | Severity | Location | Status |
| ---- | -------- | -------- | ------ |
| WordPress production env template mismatch | HIGH | `deploy/env/.env.production.example` | **Resolved** |
| Production API without `PCME_AUTH_ENABLED=true` | HIGH | `apps/api/src/auth/config.ts`, `apps/api/src/server.ts` | **Resolved** |
| Expecting durable handoff from default worker process | HIGH | `docs/deployment/durable-publishing-worker.md` | **Resolved** (documented) |

---

## 9. Strengths

1. **Clean knowledge layer boundary** — `@pcme/content` runtime dependency is `yaml` only (`packages/content/package.json`). No `@pcme/*` imports in content source.

2. **Read-only commerce loading with path containment** — `packages/content/src/commerce/path-security.ts`, `packages/content/src/commerce/collection-loader.ts`; write APIs appear in tests only.

3. **End-to-end offline pipeline validation** — `runContentPipelineDryRun` (`packages/publishing/src/pipeline/run-content-pipeline-dry-run.ts`) with 16 tests (`packages/publishing/src/pipeline/__tests__/pipeline-dry-run.test.ts`) and `pnpm pipeline:dry-run` smoke.

4. **Defense-in-depth leakage controls** — blocked fields in projection (`packages/content/src/knowledge/context/projection.ts`), prompt serialization, handoff validation (`packages/publishing/src/handoff/validate.ts:14–18, 77–95`), worker error sanitization (`packages/publishing/src/worker/payload.ts`).

5. **Deterministic IDs across pipeline stages** — orchestrator, job, artifact, review, handoff, outbox ID builders (documented in `docs/architecture/architecture-review-v1.md:118`).

6. **Durable publishing primitives implemented** — Prisma outbox/idempotency repos (`packages/database/src/repositories/publishing-outbox.repository.ts`, `publishing-idempotency.repository.ts`); generic worker (`packages/publishing/src/worker/publishing-worker.ts`); enqueue service (`packages/publishing/src/enqueue/publishing-enqueue.service.ts`).

7. **WordPress draft-only on all integrated handoff paths** — `forceDraft: true` in worker bootstrap and pipeline dry-run; legacy media publisher hardcodes draft status.

8. **Strong test coverage on critical packages** — 79 content, 51 AI, 89 publishing, 167 worker, 113 database, 175 WordPress tests (vitest inventories).

9. **No production TODO/FIXME** — verified by `scripts/beta-rc-smoke.ts:249–257` pattern and repository grep.

10. **CI quality gate** — lint, typecheck, build (28 packages), test, format check on `main` PRs (`.github/workflows/ci.yml`).

---

## 10. Recommended Merge Procedure

1. Open PR from `feature/commerce-knowledge-loader` → `main`.
2. Confirm CI green: `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm format:check`.
3. Run manual pre-merge smoke battery on the PR branch:
   - `pnpm pipeline:dry-run`
   - `pnpm commerce:smoke`, `pnpm knowledge:smoke`, `pnpm orchestrator:smoke`
   - `pnpm publishing-handoff:smoke`, `pnpm publishing-enqueue:smoke`, `pnpm publishing-worker:smoke`
   - `pnpm beta-rc:smoke` (aggregates 28 offline suites per `release/metadata.json`)
4. Merge with squash or merge commit per team policy; tag **not** required at merge time.
5. Update `docs/architecture/architecture-review-v1.md` or add addendum noting Sprints 037–040 outbox/worker/dry-run delivery (post-merge doc task).

---

## 11. Immediate Post-Merge Tasks

| Priority | Task | Owner hint | Status |
| -------- | ---- | ---------- | ------ |
| ~~P0~~ | ~~Fix WordPress env var names in `deploy/env/.env.production.example` and `docs/releases/beta-checklist.md`~~ | Platform / DevOps | **Done** |
| ~~P0~~ | ~~Document required production env: `PCME_AUTH_ENABLED=true`, JWT/API keys~~ | Platform | **Done** (template + production auth guard) |
| ~~P1~~ | ~~Document durable handoff operation: `pnpm publishing-worker:run-once` vs legacy BullMQ worker~~ | Operations | **Done** |
| P1 | Update `README.md` status, test description, module list, links to `docs/releases/` | Docs |
| P1 | Add architecture addendum for durable publishing path (supersedes §2.2 of architecture-review-v1) | Architecture |
| P2 | Align smoke suite count in `beta-release-candidate.md` (27 vs 28) | Release |
| P2 | Consider adding `pnpm beta-rc:smoke` or subset to CI (nightly) | CI |

---

## 12. Deferred Future Work

| Item | Reference |
| ---- | --------- |
| Unify legacy BullMQ and durable handoff publishing under one worker entry | `apps/worker/src/index.ts`, H-2 |
| Consolidate WordPress `WordPressMediaPublisher` and `WordPressPublishingTargetAdapter` | H-3 |
| Move `PublishingMetadataPublishStatus` to single `@pcme/shared` export consumed by publishing | M-3 |
| Declare optional peer dependencies for pipeline opt-in modes or extract pipeline to `@pcme/pipeline` package | M-1, M-2 |
| Implement `packages/core` plugin registry (currently scaffold) | `docs/architecture/module-map.md`, L-1 |
| Replace 15 no-op test packages with real tests or exclude from turbo test | H-8 |
| Add dedicated tests for `apps/worker/src/worker.ts`, config, queue wiring | M-11 |
| Root `CHANGELOG.md` synchronized with `docs/releases/changelog-v*.md` | L-6 |
| Production scheduler / polling for durable worker (explicitly out of scope for this branch) | — |

---

## 13. Final Verdict

`feature/commerce-knowledge-loader` successfully delivers the **commerce knowledge loader and full offline content pipeline** with durable publishing primitives, validated by unit tests, integration tests, and `pipeline:dry-run`. The three release conditions (H-1, H-4/H-5, H-2 documentation) were remediated on 2026-07-11.

The branch represents a **major capability increment** over `main` with **no identified merge blockers** in application code, **zero critical security regressions** on wired paths, and **acceptable technical debt** documented above.

**Recommendation: GO**

---

## 14. Merge-check remediation (2026-07-11)

Pull-request validation blockers addressed on this branch:

| Blocker | Fix |
| ------- | --- |
| GitHub Actions could not locate `pnpm` during `setup-node` cache init | Reordered `.github/workflows/ci.yml`: `pnpm/action-setup@v4` (pinned `9.15.0` from `packageManager`) before `actions/setup-node@v4` with `cache: pnpm` and `cache-dependency-path: pnpm-lock.yaml`; kept Node 20 and `pnpm install --frozen-lockfile` |
| Content collection test depended on local sibling `piercingconnect-commerce` | `collection.test.ts` now builds an isolated temp fixture covering every registry collection; no fallback to `resolveCommerceRepositoryPath` |
| WordPress idempotency unit test timed out under load | Removed dynamic adapter import; use static import, explicit in-memory idempotency store, and mocked repository only (no network/DB) |
| Full `pnpm test` segfault/bus error on modest hardware | Added root `pnpm test:ci` → `turbo test --concurrency=2`; CI uses bounded parallelism while package-level `test` scripts stay unchanged |

---

## Appendix A — Branch delta summary

Commits on `feature/commerce-knowledge-loader` not on `main` (20 commits, abbreviated):

- Knowledge service, graph traversal, context builder, prompt builder, orchestrator
- Generation job, artifact, review gate, OpenRouter/fake providers
- Publishing handoff, WordPress handoff adapter
- Shared publish contract refactor, durable content workflow persistence
- Durable publishing outbox, worker, enqueue wiring, end-to-end pipeline dry run

## Appendix B — Test inventory (packages with real vitest)

| Package | Test files |
| ------- | ---------- |
| `@pcme/content` | 9 |
| `@pcme/ai` | 4 |
| `@pcme/publishing` | 7 |
| `@pcme/worker` | 16 |
| `@pcme/database` | 12 |
| `@pcme/plugin-wordpress` | 7 |
| **Total** | **55** |

## Appendix C — Critical path coverage

| Stage | Module | Test |
| ----- | ------ | ---- |
| Orchestrator | `packages/content/src/orchestrator/` | `orchestrator.test.ts` |
| Generation job | `packages/ai/src/generation/` | `generation-job.test.ts` |
| Artifact | `packages/ai/src/generation/artifact/` | `generated-content-artifact.test.ts` |
| Review | `packages/ai/src/generation/review/` | `content-review.test.ts` |
| Handoff | `packages/publishing/src/handoff/` | `publishing-handoff.test.ts` |
| Enqueue | `packages/publishing/src/enqueue/` | `publishing-enqueue.test.ts` |
| Worker | `packages/publishing/src/worker/` | `publishing-worker.test.ts` |
| Full dry run | `packages/publishing/src/pipeline/` | `pipeline-dry-run.test.ts` |
| Durable cycle | `packages/publishing/src/orchestration/` | `durable-handoff-publishing.test.ts` |
| Worker app wiring | `apps/worker/src/durable-publishing/` | `durable-publishing.test.ts` |
