# ADR 001: Monorepo Structure

## Status

Accepted — Sprint 0

## Context

PC Media Engine must support multiple projects (PiercingConnect, Lumora, GagBox, Barber SaaS) and multiple integration surfaces (dashboard, API, worker, plugins, providers). We need clear module boundaries without publishing dozens of npm packages prematurely.

## Decision

Use a **monorepo** with:

- `apps/` — deployable applications (dashboard, api, worker)
- `packages/` — shared domain libraries
- `plugins/` — optional channel and monetization integrations
- `providers/` — swappable AI and storage implementations

Tooling: **pnpm workspaces** + **Turborepo** for build orchestration.

## Consequences

### Positive

- Atomic changes across API + worker + packages
- Shared types without version drift
- Clear dependency graph enforced by package boundaries
- Single CI pipeline

### Negative

- Initial tooling setup cost
- Must discipline imports to avoid circular dependencies
- Larger clone size over time

## Alternatives Considered

| Alternative                  | Rejected because                                     |
| ---------------------------- | ---------------------------------------------------- |
| Multi-repo per package       | Overhead for small team; slows cross-cutting changes |
| Single flat app              | Cannot reuse engine across projects cleanly          |
| Nx only (no pnpm workspaces) | pnpm + turbo is simpler for MVP                      |

## Compliance

All new code must live in the defined folders. Domain logic never in `apps/` except thin controllers/UI.
