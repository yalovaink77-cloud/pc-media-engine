# Contributing to PC Media Engine

Thank you for contributing. This project follows strict engineering standards to remain maintainable across multiple sites and long-term operation.

## Before You Start

1. Read the [Engineering Principles](docs/engineering/engineering-principles.md) — they are mandatory for all contributions.
2. Review the [Sprint 1 Plan](docs/sprints/sprint-1-plan.md) and [ROADMAP](ROADMAP.md) to understand current scope and phase.
3. Check [Architecture Decision Records](docs/decisions/) before proposing structural changes.

## Development Setup

```bash
corepack enable
pnpm install
pnpm prepare
pnpm build
pnpm lint
pnpm typecheck
pnpm test
```

Git hooks (via Husky) run automatically after `pnpm install`:

- **pre-commit** — `lint-staged` on staged files (ESLint fix + Prettier)
- **commit-msg** — Conventional Commits validation via commitlint

## Commit Messages

This project uses [Conventional Commits](https://www.conventionalcommits.org/). Messages are validated on every commit.

### Format

```
<type>(<optional scope>): <short description>

[optional body]

[optional footer]
```

### Types

| Type | Use for |
|------|---------|
| `feat` | New feature or capability |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `chore` | Tooling, deps, repo maintenance |
| `refactor` | Code change without feature/fix |
| `test` | Tests only |
| `ci` | CI/CD changes |
| `build` | Build system changes |
| `perf` | Performance improvement |

### Examples (valid)

```
chore: add husky and lint-staged
feat(content): add lifecycle revision field
fix(publishing): prevent duplicate outbox enqueue
docs: update sprint 1 plan
ci: add GitHub Actions workflow
refactor(media): extract MediaUrlResolver interface
test(core): add project context unit tests
```

### Examples (invalid)

```
bad commit
Fixed stuff
WIP
feat:added something
```

### Manual validation

```bash
echo "bad commit" | pnpm commitlint          # should fail
echo "chore: test commit message" | pnpm commitlint   # should pass
```

## Pull Request Expectations

Every PR must follow the **Before Opening a Pull Request** checklist in [Engineering Principles](docs/engineering/engineering-principles.md#before-opening-a-pull-request):

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

## Architectural Changes

Significant design changes require a new ADR in `docs/decisions/` before merge. Update related architecture docs in the same PR when behavior changes.

## Questions

Open a discussion or issue describing the problem, proposed approach, and which sprint/phase it belongs to.
