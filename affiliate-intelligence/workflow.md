# Affiliate Intelligence — Workflow

**Version:** 0.4  
**Status:** Operational playbook  
**Scope:** Lifecycle from discovery to link placement, index sync, payment resolution, and validation

No automation yet—this documents the intended human process.

---

## 1. Principles

1. **Editorial first** — content card and evidence record exist before affiliate enrollment
2. **Document before link** — program record approved before URL goes live
3. **Snapshot terms** — commission changes create new records; do not overwrite history
4. **Disclose always** — no link without matching disclosure on canonical URL
5. **Authoritative FKs first** — write child records, then rebuild parent index arrays
6. **Payment defaults** — network `default_payment_id` is authoritative; program payment only when terms differ
7. **Per-pairing program links** — product program linkage only via `merchant_program_links`, never a single top-level `program_id`

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
- Ensure a global disclosure policy exists in `policies/` before first enrollment (`policy-disclosure-default`)

### Apply

- Create `applications/` record from `templates/application.template.yaml` with status `draft` → `submitted`
- Set `network_id` to the target network, or **`null` for direct brand programs**
- Attach: site URL, traffic notes, content examples (URLs only—no analytics secrets)
- Track approval in `status` and `decision_date`

### Enroll

- On approval, create `programs/` record with authoritative FKs:
  - `brand_id`, `merchant_id`, `network_id` (null when direct)
- Capture **terms snapshot**: commission type, rate band, cookie window, geo
- Set `disclosure.template_id` to an active `policy-*` record
- Set `editorial_approved: false` until editorial sign-off
- **Sync indexes:** rebuild `brand.merchant_ids`, `brand.program_ids`, `merchant.program_ids` from child records
- **Payment:** if network program and terms match network default, leave `payment_id` empty; create program-scoped payment only when terms differ (see §5)
- **Commission:** create `commissions/` snapshot with authoritative `program_id`; index fields optional

### Map

- Create `products/` entry per SKU with authoritative FKs:
  - `brand_id`, `merchant_ids` (one or more)
  - `merchant_program_links[]` — one `{ merchant_id, program_id }` per affiliate pairing
- **Do not** set a top-level `program_id`
- Include in `content_crosswalk`:
  - `content_card_ids[]` (not singular `content_card_id`)
  - `evidence_record_ids[]`
- **`region_links`:** each link must specify `merchant_id` + `program_id` matching a `merchant_program_links` entry
- **Sync indexes:** rebuild `merchant.product_ids`, `brand.merchant_ids`, `program.product_ids`

### Review (editorial gate)

Checklist before `editorial_approved: true`:

- [ ] Content card published or publish-approved as draft
- [ ] Evidence record exists for product claims (`evidence_record_ids`)
- [ ] Limitations section present on review
- [ ] Disclosure copy matches `policies/{disclosure.template_id}.yaml`
- [ ] No ranking language tied to commission
- [ ] Product `merchant_program_links` validated per `validation.md` §5

### Place

- Add link to WordPress package YAML only—not inline during drafting
- Prefer **one primary CTA** after verdict section (per WordPress playbook)
- MCP/manual publish respects draft-until-human-approval rule

### Audit

Quarterly:

- Verify links resolve (HTTP 200/301)
- Compare live commission to last snapshot
- Retire programs with status `paused` or `terminated`
- Rebuild all index arrays and validate FK consistency (`validation.md`)
- Sync network inline `payout` from `default_payment_id` if drifted
- Export summary to `reports/` and `exports/`

### Refresh

- New commission → new file in `commissions/` with `supersedes` pointer
- Update `programs/` `current_commission_id`
- Rebuild commission index fields from program if populated
- Notify editorial if terms materially affect disclosure or policy records

---

## 4. Index synchronization

Reverse ID lists (`brand.merchant_ids`, `brand.program_ids`, `merchant.program_ids`, `merchant.product_ids`, `program.product_ids`, `program.commission_ids`) are **never edited as source of truth**.

**When to rebuild:**

| Trigger | Rebuild on |
|---------|------------|
| Merchant created/updated/retired | `brand.merchant_ids` |
| Program enrolled/terminated | `brand.program_ids`, `merchant.program_ids` |
| Product mapped/retired | `merchant.product_ids`, `program.product_ids`, `brand.merchant_ids` |
| Commission snapshot added | `program.commission_ids`; optional comm index FKs from program |

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
2. Else if program.network_id is set → load network.default_payment_id payment record.
3. Else (direct program) → load program-scoped payment for program_id,
   or treat as unmodeled until explicit payment record exists.
```

**Creating payment records:**

| Situation | Action |
|-----------|--------|
| New network enrollment | Create network-scoped payment; set `network.default_payment_id`; sync inline `payout` summary |
| Program terms = network default | Do not create program payment; omit `program.payment_id` |
| Program terms differ | Create program-scoped payment (`program_id` only); set `program.payment_id` |
| Direct program | Create program-scoped payment (no network default to inherit) |

Schema validation requires **exactly one** of `network_id` or `program_id` on each payment record.

---

## 6. Local validation

Before creating records or starting live research, follow **`validation.md`**:

- YAML syntax check
- ID prefix spot-check
- Cross-reference checklist (§5)
- Pre–live-research readiness gate (§7)

No CI automation in Sprint 004—manual and optional user-local JSON Schema only.

---

## 7. Status enums (cross-schema)

### Application (`application.schema.yaml`)

`draft` → `submitted` → `pending` → `approved` | `rejected` | `withdrawn`

### Program (`program.schema.yaml`)

`pending` → `active` → `paused` → `terminated`

### Product (`product.schema.yaml`)

`inactive` → `active` → `broken` → `retired`

### Policy (`policy.schema.yaml`)

`draft` → `active` → `retired`

---

## 8. Roles

| Role | Responsibilities |
|------|------------------|
| **revenue-ops** | networks, applications, programs, commissions, payments, policies, exports, index sync |
| **editorial-lead** | editorial_approved gate, disclosure alignment, policy review |
| **content producer** | content card `related_products`, no raw affiliate URLs in drafts |
| **publisher** | WordPress placement after gates pass |

---

## 9. Sprint exit criteria

### Sprint 001–003 ✓

_(See prior sprint notes in git history.)_

### Sprint 004 ✓

- [x] Policy entity schema and template
- [x] `content_card_ids` standardized across schemas/templates/docs
- [x] Multi-merchant product rules; removed ambiguous top-level `program_id`
- [x] Network `default_payment_id`; inline `payout` display-only
- [x] Commission index fields documented
- [x] Local validation plan (`validation.md`)
- [ ] Global disclosure policy stub record (pre-research)
- [ ] First sterile-saline brand stubs (deferred)
- [ ] CI schema validation (future)

---

## Document control

| Field | Value |
|-------|-------|
| Version | 0.4 |
| Sprint | Affiliate Intelligence 004 |
