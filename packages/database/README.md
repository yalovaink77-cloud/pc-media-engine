# @pcme/database

Prisma schema, migrations, client lifecycle, repositories, and seed scripts for PC Media Engine.

See [Sprint 2 Database Setup](../../docs/sprints/sprint-2-database-setup.md).

## Scripts

All database scripts load environment from the repo root `.env` via `dotenv-cli`.

```bash
cp .env.example .env
docker compose up -d
pnpm db:generate
pnpm db:migrate:dev
pnpm db:seed
pnpm db:health
```
