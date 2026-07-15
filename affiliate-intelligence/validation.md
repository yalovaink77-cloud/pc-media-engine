# Affiliate Intelligence — Local Schema Validation Plan

**Version:** 0.3  
**Status:** Documentation only — no CI, no repo dependencies  
**Scope:** Manual and optional local checks before creating or exporting records

---

## 1. Goals

- Catch YAML syntax errors and obvious ID/cross-reference mistakes before live research
- Stay dependency-free in the repository
- Provide a path to automated CI later without blocking current work

---

## 2. When to validate

| Trigger | Minimum checks |
|---------|----------------|
| New record file | §3 syntax + §4 ID patterns + §5 crosswalk |
| Schema change | §6 schema review + spot-check one template |
| Pre-export / audit | Full §5 cross-reference pass on affected entities |
| Before live research | Complete §7 readiness checklist |

---

## 3. YAML syntax (stdlib-friendly)

**Option A — Ruby (often preinstalled):**

```bash
ruby -ryaml -e "YAML.load_file('affiliate-intelligence/products/prod-example.yaml')"
```

**Option B — Python with user-local PyYAML (optional, not a repo dependency):**

```bash
python3 -c "import yaml; yaml.safe_load(open('affiliate-intelligence/products/prod-example.yaml'))"
```

**Option C — Editor:** Use IDE YAML validation on save.

If syntax fails, fix before any cross-reference checks.

---

## 4. ID pattern spot-check (grep)

From repo root, confirm record `id` matches its schema prefix:

```bash
grep -E '^id:' affiliate-intelligence/networks/*.yaml    # expect net-
grep -E '^id:' affiliate-intelligence/brands/*.yaml      # expect brand-
grep -E '^id:' affiliate-intelligence/merchants/*.yaml   # expect merchant-
grep -E '^id:' affiliate-intelligence/applications/*.yaml # expect app-
grep -E '^id:' affiliate-intelligence/programs/*.yaml    # expect prog-
grep -E '^id:' affiliate-intelligence/products/*.yaml    # expect prod-
grep -E '^id:' affiliate-intelligence/commissions/*.yaml # expect comm-
grep -E '^id:' affiliate-intelligence/payments/*.yaml    # expect pay-
grep -E '^id:' affiliate-intelligence/policies/*.yaml    # expect policy-
```

---

## 5. Cross-reference checklist (manual)

For each record, verify:

### Program

- [ ] `brand_id`, `merchant_id`, `network_id` (or `null` for direct) resolve to existing files
- [ ] `disclosure.template_id` resolves to `policies/{id}.yaml` when set
- [ ] `payment_id` points to program-scoped payment, or is omitted to inherit network default

### Product

- [ ] `brand_id` matches brand file
- [ ] Every `merchant_ids[]` entry has a merchant file with matching `brand_id`
- [ ] Every `merchant_program_links[]` entry has `merchant_id` ∈ `merchant_ids` and `program_id` resolving to a program whose `merchant_id` matches
- [ ] No top-level `program_id` — linkage only via `merchant_program_links`
- [ ] `content_crosswalk.content_card_ids[]` use `pc-` prefix

### Network

- [ ] `default_payment_id` resolves to `payments/` with `scope_type: network` and matching `network_id`
- [ ] Inline `payout` block matches payment record (display-only; fix payment record if they diverge)

### Payment

- [ ] Exactly one of `network_id` or `program_id` present (never both)
- [ ] `scope_type` matches the set field

### Verification block

Shared schema: `schemas/verification.schema.yaml`. Embedded on records—not a standalone directory.

#### Required fields (when `verification` is present)

- `status`, `confidence`, `last_checked`

#### Entity requirements

| Entity | Required on record? | Typical `source_type` |
|--------|----------------------|------------------------|
| Network | Optional (backfill pending) | `official_network` |
| Brand | Optional (backfill pending) | `official_brand` |
| Program | **Yes** | `official_program` |
| Merchant | **Yes** | `official_network` or `official_brand` |
| Product | **Yes** | `official_program` |
| Commission | **Yes** | `official_program` or `legal_terms` |
| Payment | **Yes** | `official_network` or `legal_terms` |
| Application | Optional | `official_program` or `support_confirmation` |
| Policy | Optional (legacy fields allowed) | `legal_terms` or `public_documentation` |
| Country | **Yes** | `public_documentation` or `official_network` |

#### Checklist (when `verification:` is present)

- [ ] `status` is one of: `verified`, `partially_verified`, `unverified`, `deprecated`
- [ ] `confidence` is one of: `high`, `medium`, `low`
- [ ] `last_checked` is ISO date (YYYY-MM-DD)—not `last_checked_at`
- [ ] `source_type` set when `status` is `verified` or `partially_verified`
- [ ] `official_source_url` is a public, non-login URL when present
- [ ] `evidence_urls[]` lists additional supporting official URLs only
- [ ] `review_due` is set for researched records (recommended: 90 days after `last_checked`)
- [ ] No credentials, banking details, tax IDs, or API secrets in `notes`

#### Legacy migration (invalid field names)

| Legacy | Replacement |
|--------|-------------|
| `last_checked_at` | `last_checked` |
| `evidence_confidence` | `confidence` |
| `partial` | `partially_verified` |
| `disputed`, `stale` | Remap to `partially_verified`, `verified`, or `deprecated` with notes |

Policy records may still use top-level `official_source_url` and `last_reviewed` without `verification` until backfilled.

### Commission

- [ ] `program_id` is authoritative; `brand_id` / `merchant_id` / `network_id` match program if present (index-only)

### Policy

- [ ] `scope_level` FK present when not `global`
- [ ] `template_text` populated when `policy_type: disclosure` and status is `active`

### Index arrays (brand, merchant, program)

- [ ] Rebuilt from child records—never hand-edited without updating authoritative child FKs

---

## 6. JSON Schema validation (optional local)

The repo does **not** ship a validator. For local deep validation, install tools in your user environment only:

```bash
pip install --user jsonschema pyyaml
```

Example one-record check (adjust paths):

```bash
python3 <<'PY'
import yaml, json
from jsonschema import Draft202012Validator

schema = yaml.safe_load(open("affiliate-intelligence/schemas/product.schema.yaml"))
record = yaml.safe_load(open("affiliate-intelligence/products/prod-example.yaml"))
Draft202012Validator(schema).validate(record)
print("OK")
PY
```

**Not in scope for Sprint 004:** wiring this into CI, pre-commit hooks, or `package.json` / `requirements.txt`.

---

## 7. Pre–live-research readiness gate

Before revenue-ops begins live program research:

- [ ] All schemas in `schemas/` have matching templates in `templates/`
- [ ] At least one global disclosure policy stub exists (`policy-disclosure-default` or equivalent)
- [ ] Validation plan reviewed by revenue-ops and editorial-lead
- [ ] Architecture authority matrix (§6) understood—FKs before indexes
- [ ] Payment inheritance and network `default_payment_id` workflow understood
- [ ] `verification.schema.yaml` reviewed; templates include verification block

---

## 9. Verification backfill (deferred)

Records without `verification` blocks remain schema-valid where optional:

| Directory | Backfill status |
|-----------|-----------------|
| `networks/` | Pending — research lives in `notes` / `policies.last_reviewed` |
| `brands/` | Pending |
| `policies/` | Legacy `official_source_url` + `last_reviewed` only |
| `countries/` | Migrated (Sprint 006-B) |
| `payments/` | Migrated (Sprint 006-B) |

When backfilling a network, prefer moving payout evidence to `payments/` verification and linking via `default_payment_id`.

---

## 10. Future CI (deferred)

When record volume justifies automation:

1. Add `jsonschema` + `pyyaml` to a dev-only requirements file or CI job image
2. Glob all `*/*.yaml` record files (exclude `schemas/` and `templates/`)
3. Map directory → schema file
4. Fail on validation errors and orphan FK references
5. Optional: script to rebuild index arrays and diff

---

## Document control

| Field | Value |
|-------|-------|
| Version | 0.3 |
| Sprint | Affiliate Intelligence — verification standard |
