# Affiliate Intelligence — Workflow

**Version:** 0.1  
**Status:** Operational playbook (foundation)  
**Scope:** Lifecycle from discovery to link placement

No automation in Sprint 001—this documents the intended human process.

---

## 1. Principles

1. **Editorial first** — content card and evidence record exist before affiliate enrollment
2. **Document before link** — program record approved before URL goes live
3. **Snapshot terms** — commission changes create new records; do not overwrite history
4. **Disclose always** — no link without matching disclosure on canonical URL

---

## 2. Lifecycle stages

```
Discover → Apply → Enroll → Map → Review → Place → Audit → Refresh
```

| Stage | Actor | Output location |
|-------|-------|-----------------|
| **Discover** | revenue-ops | notes in `brands/` or backlog issue |
| **Apply** | revenue-ops | `applications/{app-id}.yaml` |
| **Enroll** | revenue-ops | `programs/{prog-id}.yaml` (Sprint 002) |
| **Map** | editorial + revenue | `products/{prod-id}.yaml` (Sprint 003) |
| **Review** | editorial-lead | approval flag on program + content card |
| **Place** | publishing | link in WordPress package only after review |
| **Audit** | revenue-ops | `reports/` quarterly |
| **Refresh** | revenue-ops | new commission snapshot when terms change |

---

## 3. Stage detail

### Discover

- Identify brand from **content cluster** or **evidence record**
- Check `brands/` for existing entity; create stub if missing (Sprint 002 template)
- Log network options (direct vs network) in application notes

### Apply

- Create `applications/` record with status `draft` → `submitted`
- Attach: site URL, traffic notes, content examples (URLs only—no analytics secrets)
- Track approval in `status` and `decision_date`

### Enroll

- On approval, create `programs/` record linking `network_id`, `merchant_id`, `brand_id`
- Capture **terms snapshot**: commission type, rate band, cookie window, geo
- Set `editorial_approved: false` until editorial sign-off

### Map

- Create `products/` entry per SKU with:
  - `affiliate_url` or link template (no credentials)
  - `content_card_id` / `evidence_record_id` crosswalk
  - `countries` allowed

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
- Export summary to `reports/` and `exports/`

### Refresh

- New commission → new file in `commissions/` with `supersedes` pointer
- Update `programs/` `current_commission_id`
- Notify editorial if terms materially affect disclosure

---

## 4. Status enums (cross-schema)

### Application (`application.schema.yaml`)

`draft` → `submitted` → `pending` → `approved` | `rejected` | `withdrawn`

### Program (Sprint 002)

`pending` → `active` → `paused` → `terminated`

### Product link (Sprint 003)

`inactive` → `active` → `broken` → `retired`

---

## 5. Roles

| Role | Responsibilities |
|------|------------------|
| **revenue-ops** | networks, applications, programs, commissions, exports |
| **editorial-lead** | editorial_approved gate, disclosure alignment |
| **content producer** | content card `related_products`, no raw affiliate URLs in drafts |
| **publisher** | WordPress placement after gates pass |

---

## 6. Sprint 001 exit criteria

- [x] Directory structure created
- [x] Core schemas: network, brand, application
- [x] Architecture and workflow documented
- [ ] Templates for first record types (Sprint 002)
- [ ] First sterile-saline brand stubs (Sprint 002)

---

## Document control

| Field | Value |
|-------|-------|
| Version | 0.1 |
| Sprint | Affiliate Intelligence 001 |
