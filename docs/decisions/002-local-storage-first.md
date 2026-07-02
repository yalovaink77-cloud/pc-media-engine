# ADR 002: Local Storage First

## Status

Accepted — Sprint 0

## Context

MVP needs media upload and serving without cloud account setup, cost, or credential management. Production will require durable object storage (S3, Cloudflare R2).

## Decision

1. Implement `StorageProvider` interface in `packages/media`.
2. Ship **local filesystem** provider as the only MVP implementation.
3. Store files under configurable root (`STORAGE_LOCAL_ROOT`, default `./data/media`).
4. Implement `MediaUrlResolver` from day one — business logic never uses raw paths.
5. Design keys, metadata, and migration job for future cloud providers.

## Consequences

### Positive

- Fastest path to working media library
- No cloud vendor lock-in at MVP
- MediaUrlResolver forces clean abstraction before cloud complexity

### Negative

- Not horizontally scalable without shared volume
- Operator must backup local `data/media`
- WordPress publish must upload media to WP (extra step vs CDN URL)

## Migration Trigger

Move to Cloudflare R2 or S3 when:

- Deploying API to more than one instance, OR
- Media volume exceeds local disk comfort threshold, OR
- Need CDN-backed public URLs

## Alternatives Considered

| Alternative            | Rejected because                                      |
| ---------------------- | ----------------------------------------------------- |
| S3 from day one        | Slows early sprints; requires credentials and billing |
| Database bytea storage | Poor performance for images/PDFs                      |
| WordPress-only media   | Loses engine-level asset catalog and reuse            |
