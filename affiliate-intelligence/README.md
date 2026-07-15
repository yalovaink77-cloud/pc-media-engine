# Affiliate Intelligence

**Version:** 0.1 (foundation)  
**Status:** Scaffold — no data populated  
**Owner:** editorial-lead / revenue-ops

Affiliate Intelligence is PiercingConnect’s **internal knowledge layer** for affiliate networks, merchant programs, brand relationships, commission terms, and commercial policy boundaries. It supports informed editorial decisions—it does not drive rankings or product verdicts.

This layer is subordinate to:

- `docs/editorial/piercingconnect-editorial-style-guide.md` (commercial independence)
- `docs/revenue/cluster-portfolio.md` (trust-first gates)
- `content-operations/` (content cards and publication packages)

---

## Purpose

- Record **what we know** about affiliate programs and merchants—not live API sync
- Link commercial entities to **content cards** and **evidence records** without conflating them
- Gate affiliate link placement behind disclosure and editorial review
- Provide export-ready structures for future tooling (link builders, dashboards, audits)

---

## Directory map

| Path | Holds |
|------|--------|
| `networks/` | Affiliate network records (ShareASale, Amazon Associates, etc.) |
| `brands/` | Consumer-facing brand entities (NeilMed, H2Ocean, …) |
| `merchants/` | Merchant / advertiser accounts as enrolled in networks |
| `applications/` | Program application and approval lifecycle |
| `programs/` | Active affiliate program enrollments and terms snapshots |
| `products/` | SKU-level affiliate link targets mapped to content |
| `commissions/` | Commission rate snapshots and change history |
| `countries/` | Geo availability and program restrictions |
| `payments/` | Payout thresholds, methods, tax notes (no secrets) |
| `policies/` | Network TOS, brand restrictions, PiercingConnect commercial rules |
| `reports/` | Generated audit and performance reports (future) |
| `templates/` | YAML/MD templates for new records |
| `schemas/` | JSON Schema definitions for record types |
| `exports/` | Machine exports (CSV/JSON) for external tools |

---

## Schemas (Sprint 001)

| Schema | Record type |
|--------|-------------|
| `schemas/network.schema.yaml` | Affiliate network |
| `schemas/brand.schema.yaml` | Brand |
| `schemas/application.schema.yaml` | Program application |

Additional schemas (future sprints): `program`, `merchant`, `product`, `commission`, `payment`.

---

## Conventions

- **IDs:** lowercase kebab-case slugs prefixed by type (`net-`, `brand-`, `app-`)
- **No secrets:** API keys, passwords, and full payment account numbers never stored here
- **Snapshots:** Commission and terms fields are point-in-time; use `effective_date` and `supersedes`
- **Editorial firewall:** `affiliate_relevance` on content cards is independent of commission rate

---

## Related documents

- `architecture.md` — system boundaries and data flow
- `workflow.md` — operational lifecycle
- `docs/audits/sterile-saline-cluster-audit.md` — commerce knowledge example

---

## Document control

| Field | Value |
|-------|-------|
| Sprint | Affiliate Intelligence 001 |
| Created | 2026-07-15 |
| Next review | After Sprint 002 schema expansion |
