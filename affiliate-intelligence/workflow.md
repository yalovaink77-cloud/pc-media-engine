# Affiliate Intelligence — Workflow

**Version:** 0.3  
**Status:** Operational playbook  
**Scope:** Lifecycle from discovery to link placement, index sync, and payment resolution

No automation yet—this documents the intended human process.

---

## 1. Principles

1. **Editorial first** — content card and evidence record exist before affiliate enrollment
2. **Document before link** — program record approved before URL goes live
3. **Snapshot terms** — commission changes create new records; do not overwrite history
4. **Disclose always** — no link without matching disclosure on canonical URL
5. **Authoritative FKs first** — write child records, then rebuild parent index arrays
6. **Payment defaults** — network payment is default; program payment only when terms differ

---

## 2. Lifecycle stages

```
Discover → Apply → Enroll → Map → Review → Place → Audit → Refresh
```

| Stage | Actor | Output location |
|-------|-------|-----------------|
| **Discover** | revenue-ops | notes in `brands/` or backlog issue |
| **Apply** | revenue-ops | `applications/{app-id}.yaml` |
| **Enroll** | revenue-ops | `programs/{prog-id}.yaml` |
| **Map** | editorial + revenue | `products/{prod-id}.yaml` |
| **Review** | editorial-lead | approval flag on program + content card |
| **Place** | publishing | link in WordPress package only after review |
| **Audit** | revenue-ops | `reports/` quarterly |
| **Refresh** | revenue-ops | new commission snapshot when terms change |

---

## 3. Stage detail

### Discover

- Identify brand from **content cluster** or **evidence record**
- Check `brands/` for existing entity; create stub from `templates/brand.template.yaml` if missing
- Log network options (direct vs network) in application notes
- For direct programs, plan for `network_id: null`—never `net-direct`

### Apply

- Create `applications/` record from `templates/application.template.yaml` with status `draft` → `submitted`
- Set `network_id` to the target network, or **`null` for direct brand programs**
- Attach: site URL, traffic notes, content examples (URLs only—no analytics secrets)
- Track approval in `status` and `decision_date`

### Enroll

- On approval, create `programs/` record with authoritative FKs:
  - `brand_id`, `merchant_id`, `network_id` (null when direct)
- Capture **terms snapshot**: commission type, rate band, cookie window, geo
- Set `editorial_approved: false` until editorial sign-off
- **Sync indexes:** rebuild `brand.merchant_ids`, `brand.program_ids`, `merchant.program_ids` from child records
- **Payment:** if network program and terms match network default, leave `payment_id` empty; create program-scoped payment only when terms differ (see §5)

### Map

- Create `products/` entry per SKU with authoritative FKs:
  - `brand_id`, `merchant_ids` (one or more)
- Optional denormalized indexes: `program_id`, `network_id`
- Include:
  - `affiliate_url` or link template (no credentials)
  - `content_card_id` / `evidence_record_id` crosswalk
  - `countries` allowed
- **Sync indexes:** rebuild `merchant.product_ids`, `brand.merchant_ids`, `program.product_ids`

### Review (editorial gate)

Checklist before `editorial_approved: true`:

- [ ] Content card published or publish-approved as draft
- [ ] Evidence record exists for product claims
- [ ] Limitations section present on review
- [ ] Disclosure copy matches `policies/` template
- [ ] No ranking language tied to commission

### Place

- Add link to WordPress package YAML only—not inline during drafting
- Prefer **one primary CTA** after verdict section (per WordPress playbook)
- MCP/manual publish respects draft-until-human-approval rule

### Audit

Quarterly:

- Verify links resolve (HTTP 200/301)
- Compare live commission to last snapshot
- Retire programs with status `paused` or `terminated`
- Rebuild all index arrays and validate FK consistency
- Export summary to `reports/` and `exports/`

### Refresh

- New commission → new file in `commissions/` with `supersedes` pointer
- Update `programs/` `current_commission_id`
- Notify editorial if terms materially affect disclosure

---

## 4. Index synchronization

Reverse ID lists (`brand.merchant_ids`, `brand.program_ids`, `merchant.program_ids`, `merchant.product_ids`, `program.product_ids`, `program.commission_ids`) are **never edited as source of truth**.

**When to rebuild:**

| Trigger | Rebuild on |
|---------|------------|
| Merchant created/updated/retired | `brand.merchant_ids` |
| Program enrolled/terminated | `brand.program_ids`, `merchant.program_ids` |
| Product mapped/retired | `merchant.product_ids`, `program.product_ids`, `brand.merchant_ids` |
| Commission snapshot added | `program.commission_ids` |

**Procedure:**

1. Scan authoritative child records for matching FK values.
2. Replace the parent index array with the computed set (sorted for diff stability).
3. Update parent `updated_at`.
4. Log rebuild in commit message or `reports/` audit note.

---

## 5. Payment resolution

When answering “what are the payout terms for program X?”:

```
1. If program.payment_id is set → load that payment record (must be program-scoped).
2. Else if program.network_id is set → load network default payment
   (payments/ where scope_type: network and network_id matches).
3. Else (direct program) → load program-scoped payment for program_id,
   or treat as unmodeled until explicit payment record exists.
```

**Creating payment records:**

| Situation | Action |
|-----------|--------|
| New network enrollment | Create one network-scoped payment (`network_id` only) |
| Program terms = network default | Do not create program payment; omit `program.payment_id` |
| Program terms differ | Create program-scoped payment (`program_id` only); set `program.payment_id` |
| Direct program | Create program-scoped payment (no network default to inherit) |

Schema validation requires **exactly one** of `network_id` or `program_id` on each payment record.

---

## 6. Status enums (cross-schema)

### Application (`application.schema.yaml`)

`draft` → `submitted` → `pending` → `approved` | `rejected` | `withdrawn`

### Program (`program.schema.yaml`)

`pending` → `active` → `paused` → `terminated`

### Product (`product.schema.yaml`)

`inactive` → `active` → `broken` → `retired`

---

## 7. Roles

| Role | Responsibilities |
|------|------------------|
| **revenue-ops** | networks, applications, programs, commissions, payments, exports, index sync |
| **editorial-lead** | editorial_approved gate, disclosure alignment |
| **content producer** | content card `related_products`, no raw affiliate URLs in drafts |
| **publisher** | WordPress placement after gates pass |

---

## 8. Sprint exit criteria

### Sprint 001 ✓

- [x] Directory structure created
- [x] Core schemas: network, brand, application
- [x] Architecture and workflow documented

### Sprint 002 ✓

- [x] Schemas: merchant, program, product, commission, country, payment
- [x] Templates for Sprint 002 record types

### Sprint 003 ✓

- [x] Direct programs: `network_id: null` (no `net-direct`)
- [x] Payment inheritance documented; scope validation in schema
- [x] Authoritative FK direction and index sync documented
- [x] Templates: network, brand, application
- [ ] First sterile-saline brand stubs (deferred)
- [ ] Schema validation tooling wired in CI (future)

---

## Document control

| Field | Value |
|-------|-------|
| Version | 0.3 |
| Sprint | Affiliate Intelligence 003 |
