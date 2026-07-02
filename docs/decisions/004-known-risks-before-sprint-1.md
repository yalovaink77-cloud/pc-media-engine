# ADR 004: Known Risks Before Sprint 1

## Status

Accepted — Sprint 0 (final)

## Context

Sprint 0 established the PC Media Engine architecture with deliberate deferrals to keep Sprint 1 focused on repository foundation. A Staff Architect review identified risks acceptable during early development but **must not reach production multi-tenant deployment** without remediation.

This ADR records accepted risks, severity, why deferral is justified for Sprint 1, when to revisit, and suggested future solutions.

---

## Risk Register

### 1. Postgres Row-Level Security (RLS) deferred

| Field                           | Value                                                                                                                                                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Severity**                    | High                                                                                                                                                                                                   |
| **Why acceptable for Sprint 1** | MVP operates as single operator with one Organization and one Project. Isolation enforced at application layer via `projectId` filtering. No external users or cross-tenant access during development. |
| **When to revisit**             | Before deployment with more than one Organization or untrusted users — end of Sprint 3 or first staging deploy with multiple orgs, whichever comes first.                                              |
| **Suggested solution**          | Enable Postgres RLS on tenant-scoped tables. Set session variables in API middleware. Keep application-level filters as defense-in-depth. Integration tests assert cross-tenant denial.                |

### 2. RBAC deferred

| Field                           | Value                                                                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | High                                                                                                                                  |
| **Why acceptable for Sprint 1** | Single operator team with implicit full access. Audit log schema defined but role enforcement not yet needed.                         |
| **When to revisit**             | Before second person or external collaborator needs dashboard access. Sprint 4 or first team invite feature.                          |
| **Suggested solution**          | Roles scoped to Organization/Project: `owner`, `admin`, `editor`, `publisher`, `viewer`. Enforce via API middleware and dashboard UI. |

### 3. Secrets vault abstraction deferred

| Field                           | Value                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | Medium                                                                                                                                                           |
| **Why acceptable for Sprint 1** | Development uses local `.env` files and single WordPress staging site. Encrypted-at-rest or env injection sufficient for local/staging.                          |
| **When to revisit**             | Before production deploy with real credentials or more than three project integrations. Sprint 5 or first production deploy prep.                                |
| **Suggested solution**          | `SecretsProvider` interface. Adapters: env (dev), encrypted DB (staging), AWS Secrets Manager / Vault / Doppler (production). Support rotation without redeploy. |

### 4. SearchProvider deferred; Postgres FTS acceptable for MVP

| Field                           | Value                                                                                                                                                 |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | Medium                                                                                                                                                |
| **Why acceptable for Sprint 1** | PiercingConnect MVP has hundreds—not millions—of assets. Postgres FTS adequate for dashboard search during early development.                         |
| **When to revisit**             | When any Project exceeds ~50k assets or search p95 exceeds 500ms. Sprint 6 or first performance benchmark failure.                                    |
| **Suggested solution**          | `SearchProvider` interface. `PostgresSearchProvider` (MVP) and `MeilisearchProvider` / `OpenSearchProvider` (scale). Async indexing on create/update. |

### 5. DB-polled outbox acceptable for MVP

| Field                           | Value                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | Low                                                                                                                                             |
| **Why acceptable for Sprint 1** | Publish volume during development is low. `PublishingOutboxEntry` table polled by BullMQ worker is simple and transactional.                    |
| **When to revisit**             | When publish throughput exceeds ~10 concurrent processes or polling latency causes >30s operator delay. Sprint 7 or first bulk-publish feature. |
| **Suggested solution**          | Keep outbox as source of truth. Add `LISTEN/NOTIFY` or CDC for near-real-time wake-up. Optional fan-out queue per channel.                      |

### 6. Renderer block schema migration tooling deferred

| Field                           | Value                                                                                                                                              |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | Medium                                                                                                                                             |
| **Why acceptable for Sprint 1** | Initial block types are v1 and controlled by operator. `blockSchemaVersion` documented; no legacy content exists.                                  |
| **When to revisit**             | Before changing block structure on Projects with published content. First block schema change PR.                                                  |
| **Suggested solution**          | `BlockMigrator` registry with `{ fromVersion, toVersion, blockType, migrate }`. Lazy on read or batch before publish. Golden fixtures per version. |

### 7. WordPress Gutenberg rendering path deferred

| Field                           | Value                                                                                                                                           |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | Medium                                                                                                                                          |
| **Why acceptable for Sprint 1** | PiercingConnect theme accepts classic HTML. Raw HTML via Renderer → Publisher is fastest path to first publish.                                 |
| **When to revisit**             | When any Project switches to block-only theme or HTML causes layout/SEO regressions. Sprint 8 or first WP theme migration.                      |
| **Suggested solution**          | `GutenbergRenderer` output mode. Map engine blocks to WP block equivalents. Dual output: `html` (default) and `gutenberg` (per project config). |

### 8. AI data governance deferred

| Field                           | Value                                                                                                                                                                  |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | Medium                                                                                                                                                                 |
| **Why acceptable for Sprint 1** | Single operator controls all content. PiercingConnect content is publicly intended educational material, not user PII. One AI provider with operator-reviewed prompts. |
| **When to revisit**             | Before processing user-submitted content, PII at scale, or enabling multiple AI providers per org. Sprint 5 or first multi-provider config.                            |
| **Suggested solution**          | Per-Organization `aiGovernance`: allowed providers, data classification, pre-send redaction, DPA tracking. Optional EU-region provider routing.                        |

### 9. Cross-region disaster recovery deferred

| Field                           | Value                                                                                                                             |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | Low                                                                                                                               |
| **Why acceptable for Sprint 1** | Development and early staging are single-region. No paying customers depend on uptime.                                            |
| **When to revisit**             | Before production deploy with SLA commitments. Production launch checklist (Sprint 9).                                            |
| **Suggested solution**          | Define RPO/RTO. Postgres continuous archiving + cross-region replica. Object storage replication. Quarterly restore runbook test. |

### 10. Quota enforcement deferred

| Field                           | Value                                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Severity**                    | Medium                                                                                                                                            |
| **Why acceptable for Sprint 1** | Single operator, single org — no noisy-neighbor risk. Usage manually monitored.                                                                   |
| **When to revisit**             | Before onboarding second Organization or AI/storage costs exceed ~$100/month. Sprint 6 or first multi-org onboarding.                             |
| **Suggested solution**          | `QuotaService`: storage bytes, AI tokens/month, publish requests/hour. Soft warning at 80%; hard block at 100%. Dashboard usage per Organization. |

---

## Decision

We **consciously accept** all ten risks for Sprint 1 development. None block monorepo scaffolding, Prisma schema design, interface definitions, local storage MVP, or PiercingConnect single-project workflows.

We **reject** proceeding to production multi-tenant deployment without addressing at minimum:

1. Postgres RLS (Risk 1)
2. RBAC (Risk 2)
3. Secrets vault abstraction (Risk 3)
4. AI data governance (Risk 8)

## Related Documents

- [../architecture/system-overview.md](../architecture/system-overview.md)
- [../architecture/module-map.md](../architecture/module-map.md)
- [../engineering/engineering-principles.md](../engineering/engineering-principles.md)
- [001-monorepo.md](./001-monorepo.md)
- [002-local-storage-first.md](./002-local-storage-first.md)
- [003-provider-abstraction.md](./003-provider-abstraction.md)
