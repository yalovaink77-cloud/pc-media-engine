# Affiliate Intelligence — Architecture

**Version:** 0.4  
**Status:** Foundation document — ready for first records after disclosure stub  
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
│  networks · brands · programs · products · policies        │
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
| **Policy** | Disclosure templates, TOS summaries, commercial rules | `policy.schema.yaml` |

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
| `policy-` | `policy-disclosure-default` | `policies/` |

### Content crosswalk naming

All editorial crosswalks use **`content_card_ids`** (array of `pc-` prefixed IDs) and **`evidence_record_ids`** (array). Do not use singular `content_card_id` or alternate names like `card_id` in Affiliate Intelligence records.

| Record | Crosswalk location |
|--------|-------------------|
| Brand | `content_crosswalk.content_card_ids` |
| Product | `content_crosswalk.content_card_ids` |
| Policy | `content_crosswalk.content_card_ids` (when scoped to specific cards) |

Content cards reference products via existing `related_products` IDs; product records link back via `content_card_ids`.

---

## 5. Direct programs convention

**Direct brand programs have no intermediary network.** Represent this with:

```yaml
network_id: null
```

on `program`, `merchant` (when `channel_type: direct`), and `application`.

**Do not use** a synthetic `net-direct` network ID. There is no direct-network entity; `null` is the canonical value.

---

## 6. Authoritative relationships

Foreign keys on child records are **source of truth**. Reverse ID arrays on parent records are **denormalized indexes** for navigation and exports only.

### Authority matrix

| Record | Owns (authoritative) | Index-only fields (rebuild, never edit as truth) |
|--------|----------------------|--------------------------------------------------|
| **Program** | `brand_id`, `merchant_id`, `network_id` | `commission_ids`, `product_ids` |
| **Product** | `brand_id`, `merchant_ids`, `merchant_program_links[]` | — |
| **Merchant** | `brand_id`, `network_id` (null when direct) | `program_ids`, `product_ids` |
| **Brand** | — | `merchant_ids`, `program_ids` |
| **Network** | `default_payment_id` | inline `payout` (display-only) |
| **Payment** | exactly one of `network_id` **or** `program_id` | `brand_id`, `merchant_id` |
| **Commission** | `program_id` | `brand_id`, `merchant_id`, `network_id` |

### Multi-merchant products

A product may monetize through **multiple merchants** (e.g. network merchant + direct storefront). Rules:

1. **`merchant_ids`** lists every merchant the product maps to.
2. **`merchant_program_links`** holds one `{ merchant_id, program_id }` object per affiliate pairing—this is the only place program linkage lives on products.
3. **No top-level `program_id`** on product records—avoids ambiguity when multiple programs apply.
4. **`region_links`** must include `merchant_id` and `program_id` matching a `merchant_program_links` entry.
5. Each `program_id` in links must reference a program whose `merchant_id` matches the paired merchant.

### Synchronization expectations

When a child record is created, updated, or retired:

1. **Write the authoritative record first** (e.g. `programs/{id}.yaml`).
2. **Rebuild parent indexes** from a scan of child records—do not hand-edit index arrays in isolation.
3. **Validate consistency** before export: every ID in an index must resolve to a record whose authoritative FK points back.

Example: enrolling `prog-neilmed-shareasale` adds that ID to `brand-neilmed.program_ids` and `merchant-neilmed-shareasale.program_ids` only after the program file exists with matching `brand_id` and `merchant_id`.

Commission snapshots: after creating `comm-*`, optionally populate `brand_id`, `merchant_id`, `network_id` from the parent program for export convenience—these are index-only and must match the program if present.

---

## 7. Payment inheritance

Payout terms follow a **default + override** model:

```
┌─────────────────────────┐
│  Network                │
│  default_payment_id ────┼──► payments/ (scope_type: network)
│  payout { display-only }│
└──────────┬──────────────┘
           │ applies to all programs on network
           ▼
┌─────────────────────┐     program.payment_id set?
│  Program            │──── yes ──► Program payment override
│  (enrollment)       │             scope_type: program, program_id set
└─────────────────────┘
           │
           no override ──► inherit via network.default_payment_id
```

**Rules:**

1. Each active **network** should have **`default_payment_id`** pointing to a network-scoped payment record.
2. The network **`payout`** block is a **display-only** summary—sync from the payment record, never treat as authoritative when `default_payment_id` is set.
3. **Program-scoped** payment records are created **only** when payout terms explicitly differ from the network default.
4. A program with no `payment_id` inherits via its network’s `default_payment_id`.
5. Direct programs (`network_id: null`) cannot inherit from a network—require an explicit program-scoped payment record.
6. Payment schema enforces **exactly one** of `network_id` or `program_id` per record (mutually exclusive scope).

---

## 8. Policies and disclosure

- **`policies/`** holds disclosure templates, network compliance summaries, brand restrictions, and PiercingConnect commercial rules.
- Programs reference disclosure via `disclosure.template_id` → `policy-{slug}` ID.
- Policy records are operational guidance and copy—**not legal advice**. Use `official_source_url` for external TOS references.
- Network inline `policies.tos_url` is a quick link; formal compliance tracking may also use scoped `policy-*` records.

---

## 9. Trust and editorial gates

Aligned with `cluster-portfolio.md`:

| Gate | Affiliate Intelligence support |
|------|--------------------------------|
| G3 Hub-before-spoke | Programs linked only after hub canonical publish flag |
| G4 No invented claims | Product records require evidence record linkage via `evidence_record_ids` |
| Disclosure | Every active program requires `disclosure.template_id` → active `policy-*` record |
| Independence | Schema forbids `ranking_weight` or `commission_priority` on editorial fields |

---

## 10. Storage format

- **Human records:** YAML files, one record per file, named `{id}.yaml`
- **Schemas:** JSON Schema draft 2020-12 in `schemas/`
- **Templates:** Starters in `templates/` for each record type
- **Validation:** Manual plan in `validation.md` (no CI yet)
- **Exports:** Generated JSON/CSV in `exports/` (gitignored optional in future)
- **Reports:** Markdown in `reports/`

No database migration—filesystem source of truth until volume warrants automation.

---

## 11. Future integration (not built)

| Consumer | Integration |
|----------|-------------|
| WordPress MCP | Read-only link lookup by `content_card_ids` |
| `@pcme/publishing` | Optional affiliate URL validation before enqueue |
| Content cards | Validate `related_products` against `products/` |
| Dashboards | Read `exports/` for commission snapshots |

---

## 12. Out of scope

- Live API sync with networks
- Click tracking or attribution pixels
- Automated link insertion into WordPress
- Tax or legal advice fields beyond pointers to policies
- Automated schema validation in CI (deferred—see `validation.md`)

---

## Document control

| Field | Value |
|-------|-------|
| Version | 0.4 |
| Sprint | Affiliate Intelligence 004 |
