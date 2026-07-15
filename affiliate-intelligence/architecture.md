# Affiliate Intelligence — Architecture

**Version:** 0.1  
**Status:** Foundation document  
**Scope:** Repository layout, boundaries, and integration points

---

## 1. Problem statement

PiercingConnect publishes product reviews and category hubs with **editorial independence**. Affiliate relationships must be:

- **Traceable** — which network, program, and link applies to which content
- **Bounded** — terms, geo limits, and brand restrictions visible before link placement
- **Separate from evidence** — manufacturer facts live in `references/evidence/`; commission facts live here

Affiliate Intelligence is not a link shortener, not a live sync engine, and not a ranking input.

---

## 2. Layer model

```
┌─────────────────────────────────────────────────────────────┐
│  content-operations/ (content cards, WordPress packages)   │
│  affiliate_relevance · related_products · disclosure copy    │
└───────────────────────────┬─────────────────────────────────┘
                            │ references (by ID)
┌───────────────────────────▼─────────────────────────────────┐
│  affiliate-intelligence/ (this layer)                      │
│  networks · brands · programs · products · commissions     │
└───────────────────────────┬─────────────────────────────────┘
                            │ does not override
┌───────────────────────────▼─────────────────────────────────┐
│  references/evidence/ (verified product & APP facts)         │
└─────────────────────────────────────────────────────────────┘
```

**Rule:** Evidence answers “what is true about the product?” Affiliate Intelligence answers “how may we monetize responsibly?”

---

## 3. Core entities

| Entity | Role | Primary schema (Sprint 001) |
|--------|------|-----------------------------|
| **Network** | Platform connecting publishers and merchants | `network.schema.yaml` |
| **Brand** | Market-facing name readers recognize | `brand.schema.yaml` |
| **Merchant** | Advertiser account within a network | _(Sprint 002)_ |
| **Application** | Request/join workflow for a program | `application.schema.yaml` |
| **Program** | Approved enrollment + terms snapshot | _(Sprint 002)_ |
| **Product** | Linkable SKU / URL mapped to content cards | _(Sprint 003)_ |
| **Commission** | Rate and structure history | _(Sprint 003)_ |
| **Country** | Geo eligibility matrix | _(Sprint 003)_ |
| **Payment** | Payout configuration (non-secret) | _(Sprint 004)_ |
| **Policy** | Restrictions and compliance notes | _(Sprint 004)_ |

---

## 4. ID and referencing

| Prefix | Example | Used in |
|--------|---------|---------|
| `net-` | `net-shareasale` | `networks/` |
| `brand-` | `brand-neilmed` | `brands/` |
| `merchant-` | `merchant-neilmed-shareasale` | `merchants/` |
| `app-` | `app-neilmed-2026-01` | `applications/` |
| `prog-` | `prog-neilmed-shareasale` | `programs/` |
| `prod-` | `prod-neilmed-fine-mist-177ml` | `products/` |

Content cards reference products via existing `related_products` IDs—Affiliate Intelligence `products/` records should declare a `content_product_id` or `card_id` crosswalk in Sprint 003.

---

## 5. Trust and editorial gates

Aligned with `cluster-portfolio.md`:

| Gate | Affiliate Intelligence support |
|------|--------------------------------|
| G3 Hub-before-spoke | Programs linked only after hub canonical publish flag |
| G4 No invented claims | Product records require evidence record linkage |
| Disclosure | Every `program` with active links requires `disclosure_template_id` |
| Independence | Schema forbids `ranking_weight` or `commission_priority` on editorial fields |

---

## 6. Storage format

- **Human records:** YAML files, one record per file, named `{id}.yaml`
- **Schemas:** JSON Schema draft 2020-12 in `schemas/`
- **Exports:** Generated JSON/CSV in `exports/` (gitignored optional in future)
- **Reports:** Markdown in `reports/`

No database migration in Sprint 001—filesystem source of truth until volume warrants automation.

---

## 7. Future integration (not built)

| Consumer | Integration |
|----------|-------------|
| WordPress MCP | Read-only link lookup by `card_id` |
| `@pcme/publishing` | Optional affiliate URL validation before enqueue |
| Content cards | Validate `related_products` against `products/` |
| Dashboards | Read `exports/` for commission snapshots |

---

## 8. Out of scope (Sprint 001)

- Live API sync with networks
- Click tracking or attribution pixels
- Automated link insertion into WordPress
- Tax or legal advice fields beyond pointers to policies

---

## Document control

| Field | Value |
|-------|-------|
| Version | 0.1 |
| Sprint | Affiliate Intelligence 001 |
