# PC Media Engine — Production resource recommendations (Sprint 48)

## Minimum (single-node, low traffic)

| Service    | CPU   | Memory | Notes                          |
|------------|-------|--------|--------------------------------|
| PostgreSQL | 1 vCPU| 1 GB   | SSD storage strongly recommended |
| Redis      | 0.5   | 256 MB | AOF enabled in production compose |
| API        | 1     | 512 MB | 1 replica                      |
| Worker     | 1     | 1 GB   | `WORKER_CONCURRENCY=3`         |
| Dashboard  | 0.5   | 256 MB | 1 replica                      |

**Total:** ~3 vCPU, ~3 GB RAM (+ OS overhead)

## Recommended (production)

| Service    | CPU   | Memory | Notes                          |
|------------|-------|--------|--------------------------------|
| PostgreSQL | 2     | 2 GB   | Dedicated volume, daily backups |
| Redis      | 1     | 512 MB | Persistent AOF volume          |
| API        | 2     | 1 GB   | Horizontal scale behind LB later |
| Worker     | 2     | 2 GB   | `WORKER_CONCURRENCY=5–10`      |
| Dashboard  | 1     | 512 MB |                                |

**Total:** ~8 vCPU, ~6 GB RAM

## Storage

| Volume        | Suggested size | Growth driver        |
|---------------|----------------|----------------------|
| PostgreSQL    | 20 GB+         | Publishing history   |
| Redis AOF     | 2 GB+          | Queue depth          |
| Media storage | 100 GB+        | Uploaded assets      |

## Health checks

| Service   | Liveness / Readiness | Endpoint / probe                    |
|-----------|----------------------|-------------------------------------|
| API       | Both                 | `GET /health` (200, database ok)    |
| Dashboard | Readiness            | `GET /` (200)                       |
| Worker    | Liveness             | Process probe (`pgrep` node worker) |
| PostgreSQL| Readiness            | `pg_isready`                        |
| Redis     | Readiness            | `redis-cli ping`                    |

## Network

- **Internal network** (`pcme_internal`): postgres, redis, api, worker — no public exposure
- **Edge network** (`pcme_edge`): api + dashboard public ports only
- Place a reverse proxy (nginx, Caddy, Traefik) in front of API/dashboard for TLS termination in real deployments
