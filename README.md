# PC Media Engine

A reusable media and content operating system. PiercingConnect is the first project; the engine is designed to support additional sites and brands over time.

**Status:** Sprint 2 — database foundation

## Documentation

- [ROADMAP](ROADMAP.md) — sprint plan and milestones
- [Engineering Principles](docs/engineering/engineering-principles.md) — mandatory standards for all contributors
- [Sprint 1 Plan](docs/sprints/sprint-1-plan.md) — repository foundation scope and definition of done
- [Sprint 2 Database Setup](docs/sprints/sprint-2-database-setup.md) — local PostgreSQL and Prisma workflow

## Prerequisites

- Node.js 20 LTS
- pnpm 9+ (via Corepack)
- Docker (for local PostgreSQL and Redis)

## Database (Sprint 2)

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
pnpm db:health
```

See [Sprint 2 Database Setup](docs/sprints/sprint-2-database-setup.md) for details.

Database scripts load environment variables from the repo root `.env` file.

## Local Development Validation

Run these commands to verify the repository foundation:

```bash
# Setup
corepack enable
cp .env.example .env
pnpm install

# Quality checks
pnpm build
pnpm lint
pnpm typecheck
pnpm test
pnpm format:check

# Local infrastructure (PostgreSQL + Redis)
docker compose up -d
docker compose ps
```

Verify services are healthy:

```bash
docker compose ps
# postgres and redis should show "healthy"
```

Stop infrastructure when finished:

```bash
docker compose down
```

## Quick Reference

```bash
pnpm install          # install dependencies
pnpm build            # compile all workspaces
pnpm lint             # ESLint across monorepo
pnpm typecheck        # TypeScript validation
pnpm test             # run tests (no-op stubs in Sprint 1)
pnpm format           # Prettier write
pnpm format:check     # Prettier + EditorConfig check
```

## Repository Structure

```txt
apps/        → dashboard, api, worker
packages/    → core, database, ai, media, content, seo, publishing, analytics, shared
plugins/     → wordpress, buy-me-a-coffee, amazon-affiliate, social (future)
providers/   → ai and storage provider implementations
docs/        → architecture, decisions, engineering, sprints
```

## License

[MIT](LICENSE)
