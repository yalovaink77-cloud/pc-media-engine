# Affiliate Intelligence — Architecture

**Version:** 0.3  
**Status:** Foundation document  
**Scope:** Repository layout, boundaries, relationship authority, and integration points

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

| Entity | Role | Schema |
|--------|------|--------|
| **Network** | Platform connecting publishers and merchants | `network.schema.yaml` |
| **Brand** | Market-facing name readers recognize | `brand.schema.yaml` |
| **Merchant** | Advertiser account within a network or direct channel | `merchant.schema.yaml` |
| **Application** | Request/join workflow for a program | `application.schema.yaml` |
| **Program** | Approved enrollment + terms snapshot | `program.schema.yaml` |
| **Product** | Linkable SKU / URL mapped to content cards | `product.schema.yaml` |
| **Commission** | Rate and structure history | `commission.schema.yaml` |
| **Country** | Geo eligibility matrix | `country.schema.yaml` |
| **Payment** | Payout configuration (non-secret) | `payment.schema.yaml` |
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
| `pay-` | `pay-shareasale-default` | `payments/` |
| `comm-` | `comm-neilmed-shareasale-2026-07` | `commissions/` |

Content cards reference products via existing `related_products` IDs—Affiliate Intelligence `products/` records should declare a `content_product_id` or `card_id` crosswalk in a future sprint.

---

## 5. Direct programs convention

**Direct brand programs have no intermediary network.** Represent this with:

```yaml
network_id: null
```

on `program`, `merchant` (when `channel_type: direct`), `application`, and denormalized `product.network_id` when applicable.

**Do not use** a synthetic `net-direct` network ID. There is no direct-network entity; `null` is the canonical value.

---

## 6. Authoritative relationships

Foreign keys on child records are **source of truth**. Reverse ID arrays on parent records are **denormalized indexes** for navigation and exports only.

### Authority matrix

| Record | Owns (authoritative) | Index-only fields (rebuild, never edit as truth) |
|--------|----------------------|--------------------------------------------------|
| **Program** | `brand_id`, `merchant_id`, `network_id` | — |
| **Product** | `brand_id`, `merchant_ids` | `program_id`, `network_id` |
| **Merchant** | `brand_id`, `network_id` (null when direct) | `program_ids`, `product_ids` |
| **Brand** | — | `merchant_ids`, `program_ids` |
| **Payment** | exactly one of `network_id` **or** `program_id` | `brand_id`, `merchant_id` |

### Synchronization expectations

When a child record is created, updated, or retired:

1. **Write the authoritative record first** (e.g. `programs/{id}.yaml`).
2. **Rebuild parent indexes** from a scan of child records—do not hand-edit index arrays in isolation.
3. **Validate consistency** before export: every ID in an index must resolve to a record whose authoritative FK points back.

Example: enrolling `prog-neilmed-shareasale` adds that ID to `brand-neilmed.program_ids` and `merchant-neilmed-shareasale.program_ids` only after the program file exists with matching `brand_id` and `merchant_id`.

---

## 7. Payment inheritance

Payout terms follow a **default + override** model:

```
┌─────────────────────┐
│  Network payment    │  scope_type: network, network_id set
│  (default terms)    │
└──────────┬──────────┘
           │ applies to all programs on network
           ▼
┌─────────────────────┐     program.payment_id set?
│  Program            │──── yes ──► Program payment override
│  (enrollment)       │             scope_type: program, program_id set
└─────────────────────┘
           │
           no override ──► inherit network default payment
```

**Rules:**

1. Each active **network** should have one **network-scoped** payment record (`payments/` with `scope_type: network`).
2. **Program-scoped** payment records are created **only** when payout terms explicitly differ from the network default.
3. A program with no `payment_id` inherits resolved terms from its network’s default payment record.
4. Direct programs (`network_id: null`) cannot inherit from a network—require an explicit program-scoped payment record or document terms inline in program notes until modeled.
5. Payment schema enforces **exactly one** of `network_id` or `program_id` per record (mutually exclusive scope).

---

## 8. Trust and editorial gates

Aligned with `cluster-portfolio.md`:

| Gate | Affiliate Intelligence support |
|------|--------------------------------|
| G3 Hub-before-spoke | Programs linked only after hub canonical publish flag |
| G4 No invented claims | Product records require evidence record linkage |
| Disclosure | Every `program` with active links requires `disclosure_template_id` |
| Independence | Schema forbids `ranking_weight` or `commission_priority` on editorial fields |

---

## 9. Storage format

- **Human records:** YAML files, one record per file, named `{id}.yaml`
- **Schemas:** JSON Schema draft 2020-12 in `schemas/`
- **Templates:** Starters in `templates/` for each record type
- **Exports:** Generated JSON/CSV in `exports/` (gitignored optional in future)
- **Reports:** Markdown in `reports/`

No database migration—filesystem source of truth until volume warrants automation.

---

## 10. Future integration (not built)

| Consumer | Integration |
|----------|-------------|
| WordPress MCP | Read-only link lookup by `card_id` |
| `@pcme/publishing` | Optional affiliate URL validation before enqueue |
| Content cards | Validate `related_products` against `products/` |
| Dashboards | Read `exports/` for commission snapshots |

---

## 11. Out of scope

- Live API sync with networks
- Click tracking or attribution pixels
- Automated link insertion into WordPress
- Tax or legal advice fields beyond pointers to policies

---

## Document control

| Field | Value |
|-------|-------|
| Version | 0.3 |
| Sprint | Affiliate Intelligence 003 |
