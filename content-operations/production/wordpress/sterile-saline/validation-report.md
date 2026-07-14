# Sterile Saline WordPress Package — Validation Report

**Sprint:** WordPress Draft Sprint 001  
**Validated:** 2026-07-14  
**Scope:** `content-operations/production/wordpress/sterile-saline/`  
**Rule:** Validation only — no evidence edits, no article rewrites, no CMS import performed  

---

## Validation status

| Overall | Result |
|---------|--------|
| **Package validation** | **FAIL** — 4 of 5 YAML packages are not machine-parseable |
| **Publish-ready WordPress drafts** | **NOT READY** — body copy not converted; CMS placeholders remain in source drafts |
| **Blocking errors** | 12 |
| **Warnings** | 14 |

**Verdict:** Do not import to WordPress until YAML syntax is repaired, slug/title conflicts resolved, and production draft bodies pass CMS strip + link replacement per package `cms_strip_before_import` lists.

---

## Package inventory

| Asset | Card ID | File | YAML parse | WordPress `.md` draft |
|-------|---------|------|------------|------------------------|
| Hub | `pc-hub-sterile-saline-complete-guide` | `hub-sterile-saline-complete-guide.yaml` | **PASS** | `hub-sterile-saline-complete-guide.md` (conflicts with YAML) |
| NeilMed | `pc-review-neilmed-fine-mist` | `neilmed-piercing-aftercare-fine-mist.yaml` | **FAIL** | Missing |
| Steri-Wash | `pc-review-steri-wash-saline` | `steri-wash-saline-spray.yaml` | **FAIL** | Missing |
| Recovery | `pc-review-recovery-sterile-saline` | `recovery-sterile-saline-wash.yaml` | **FAIL** | Missing |
| H2Ocean | `pc-review-h2ocean-piercing-aftercare` | `h2ocean-piercing-aftercare-spray.yaml` | **FAIL** | Missing |

Only the hub has a companion WordPress draft markdown file. Four review packages exist as YAML metadata only; no publish-ready review `.md` bodies were produced in this sprint folder.

---

## Errors

### E1 — YAML syntax failures (blocking)

Four packages fail `yaml.safe_load()` due to unquoted scalars containing colons, em dashes, or embedded double quotes in `featured_image_brief` fields:

| File | Line | Cause |
|------|------|--------|
| `neilmed-piercing-aftercare-fine-mist.yaml` | 23 | `text_overlay: "Review" badge only—no star ratings or "Best" labels` — nested quotes / em dash break scalar |
| `steri-wash-saline-spray.yaml` | 23–24 | `text_overlay: Optional "4.25 oz label verified" sublabel—must not imply...` |
| `recovery-sterile-saline-wash.yaml` | 24 | `text_overlay: "7.4 oz (MED-637)" SKU callout; no healing promises` — semicolon/colon |
| `h2ocean-piercing-aftercare-spray.yaml` | 25 | `text_overlay: "Comparison peer" — not "vs winner"` |

**Impact:** Packages cannot be consumed by automation, CI validation, or CMS import tooling until fixed (quote or block-scalar the affected values).

---

### E2 — Hub slug / canonical conflict (blocking)

Two hub publication artifacts disagree:

| Field | `hub-sterile-saline-complete-guide.yaml` | `hub-sterile-saline-complete-guide.md` |
|-------|------------------------------------------|----------------------------------------|
| Slug | `/guides/sterile-saline-for-piercing-aftercare/` | `/guides/sterile-saline-piercing-aftercare/` |
| WordPress title | Sterile Saline for Piercing Aftercare: Complete Guide | Sterile Saline for Piercing Aftercare: What to Know Before You Buy |
| SEO title | Sterile Saline for Piercing Aftercare: Complete Guide \| PiercingConnect | Sterile Saline Piercing Aftercare Guide \| PiercingConnect |
| Meta description | 204 chars (long) | 152 chars (different copy) |

All four review YAML packages link to the **yaml** hub slug (`…for-piercing-aftercare`). The hub `.md` file uses a different path. Internal links will break if both artifacts are used without reconciliation.

---

### E3 — Production draft bodies not publish-ready (blocking)

Source drafts under `content-operations/production/drafts/` still contain CMS placeholders and internal-only blocks listed in package `cms_strip_before_import` but **not yet stripped**:

| Placeholder / internal block | Hub | NeilMed | Steri-Wash | Recovery | H2Ocean |
|------------------------------|:---:|:-------:|:----------:|:--------:|:-------:|
| Card ID header | ✓ | ✓ | ✓ | ✓ | ✓ |
| Draft metadata section | ✓ | ✓ | ✓ | ✓ | ✓ |
| Explicitly excluded claims (reviews) | — | ✓ | ✓ | ✓ | ✓ |
| Raw `(`source_id`)` in body prose | ✓ | ✓ | ✓ | ✓ | ✓ |
| `#related-guides` / `#related-guides-and-reviews` anchors | ✓ | ✓ | ✓ | ✓ | ✓ |
| `Canonical WordPress paths: insert when published` | ✓ | ✓ | ✓ | ✓ | ✓ |
| Card-ID-only Related Guides tables | ✓ | ✓ | ✓ | ✓ | ✓ |
| Top affiliate note (reviews) | — | ✓ | ✓ | ✓ | ✓ |

**Impact:** Importing draft markdown as-is would publish internal metadata and broken anchors.

---

### E4 — Body vs package internal-link drift (blocking)

YAML `internal_links.in_cluster` is synchronized across the cluster, but **production draft bodies** still diverge:

| Issue | Affected drafts |
|-------|-----------------|
| Hub Related Guides table omits Recovery + H2Ocean | `sterile-saline-complete-guide.md` |
| NeilMed alternatives: Recovery = “Category peer (no dedicated review card)”; H2Ocean = “Name-only comparison” | `neilmed-piercing-aftercare-fine-mist.md` |
| Steri-Wash alternatives: Recovery = “Category peer”; H2Ocean = “Name-only comparison” | `steri-wash-saline-spray.md` |
| Recovery alternatives: H2Ocean = “Name-only comparison” | `recovery-sterile-saline-wash.md` |
| NeilMed Related Guides omits Recovery + H2Ocean | `neilmed-piercing-aftercare-fine-mist.md` |
| Steri-Wash Related Guides omits Recovery + H2Ocean | `steri-wash-saline-spray.md` |

Packages specify correct URLs; bodies were not converted to match.

---

### E5 — Missing review WordPress draft files (blocking)

Sprint goal requires five publish-ready drafts. Only **one** `.md` WordPress draft exists (hub). NeilMed, Steri-Wash, Recovery, and H2Ocean have YAML metadata only — no assembled WordPress draft markdown in `content-operations/production/wordpress/sterile-saline/`.

---

### E6 — Hub duplicate FAQ / metadata definitions (blocking)

Hub has two publication definitions with different FAQ schema:

| Source | FAQ count | Notes |
|--------|-----------|-------|
| `hub-sterile-saline-complete-guide.yaml` | 6 questions | Includes “Does sterile saline prevent infection or guarantee faster healing?” |
| `hub-sterile-saline-complete-guide.md` | 5 questions | Different wording; omits infection/healing FAQ |

Only one definition should drive CMS import.

---

## Warnings

### W1 — SEO title length (>60 chars recommended)

| Package | SEO title length |
|---------|------------------:|
| Hub (yaml) | 71 |
| NeilMed | 68 |
| Steri-Wash | 69 |
| Recovery | 60 |
| H2Ocean | 75 |

Recovery is within range; others may truncate in SERPs.

---

### W2 — Meta description length (>160 chars recommended)

| Package | Meta description length |
|---------|------------------------:|
| Hub (yaml) | 204 |
| NeilMed | 208 |
| Steri-Wash | 183 |
| Recovery | 204 |
| H2Ocean | 184 |

All yaml meta descriptions exceed the common 155–160 character SERP display limit.

---

### W3 — FAQ JSON-LD internal jargon (NeilMed, H2Ocean)

NeilMed FAQ answer for APP alignment includes **“in the evidence layer”** — editorial/internal language unsuitable for reader-facing schema markup.

H2Ocean FAQ answer for sterile 0.9% includes **“unsupported in the evidence layer”** — same issue.

Hub and Steri-Wash FAQ schema text is reader-facing.

---

### W4 — Hub CTA deep-dive incomplete vs internal_links

`hub-sterile-saline-complete-guide.yaml` `cta_placement` deep-dive targets only NeilMed and Steri-Wash. `internal_links.in_cluster` also lists Recovery and H2Ocean. Comparison section in the hub draft discusses Recovery and H2Ocean without deep-dive CTA parity.

---

### W5 — Spoke links intentionally pending

All five packages mark spoke URLs as `pending` (5 spokes per hub/reviews). Acceptable for staged cluster publish **if** body copy does not link to dead URLs at import. Draft bodies currently use `#related-guides` placeholders — must not resolve to 404s.

---

### W6 — Hub source notes format split

- **YAML packages (all):** Reader-facing `Sources & References` with named sources — **PASS**
- **hub-sterile-saline-complete-guide.md:** Still uses internal `source_id` table — **FAIL** for publish-facing strip rules

Review `.md` drafts do not exist; source notes live only in YAML until bodies are assembled.

---

### W7 — Affiliate disclosure placement (package spec OK; body not converted)

| Asset | Package spec | Draft body state |
|-------|--------------|------------------|
| Hub | Single end disclosure | End disclosure present; acceptable after strip |
| Reviews (×4) | Single end disclosure | **Duplicate** top + bottom affiliate notes still in draft |

Package notes correctly say consolidate to bottom on import — not yet applied.

---

### W8 — H2Ocean meta description typography

Meta description contains `limits— not` (space after em dash). Minor SERP/display inconsistency.

---

### W9 — README references broken YAML for 4 packages

`README.md` links to all five `.yaml` files. Four are not parseable; README status “Draft — pending human approval” understates the YAML syntax blocker.

---

## Per-package validation summary

| Check | Hub YAML | Hub MD | NeilMed YAML | Steri-Wash YAML | Recovery YAML | H2Ocean YAML |
|-------|:--------:|:------:|:------------:|:---------------:|:-------------:|:------------:|
| YAML parses | ✓ | n/a | ✗ | ✗ | ✗ | ✗ |
| Required fields present | ✓ | partial | unknown | unknown | unknown | unknown |
| Slug ↔ canonical aligned | ✓ | ✓ (own slug) | — | — | — | — |
| In-cluster links consistent | ✓ | ✓* | — | — | — | — |
| FAQ JSON-LD serializable | ✓ | ✓ | — | — | — | — |
| FAQ matches draft FAQ | partial† | partial† | — | — | — | — |
| SEO metadata within limits | ✗ | ✓ meta | — | — | — | — |
| Affiliate disclosure spec | ✓ | ✓ | — | — | — | — |
| Source notes reader-facing | ✓ | ✗ | — | — | — | — |
| CMS placeholders removed | n/a | partial | n/a | n/a | n/a | n/a |
| Publish-ready `.md` body | n/a | partial | ✗ | ✗ | ✗ | ✗ |

\* Hub MD uses a different hub slug than cluster YAML registry.  
† Hub YAML FAQ (6) vs hub MD FAQ (5) vs no standalone FAQ section in production draft body.

---

## Required fixes

### Blocking (before CMS import)

1. **Fix YAML syntax** in NeilMed, Steri-Wash, Recovery, and H2Ocean packages — quote or block-scalar all `featured_image_brief` string values containing `:`, `—`, or embedded `"`.
2. **Reconcile hub slug and titles** — pick one canonical path (`sterile-saline-for-piercing-aftercare` vs `sterile-saline-piercing-aftercare`) and align `hub-sterile-saline-complete-guide.yaml`, `hub-sterile-saline-complete-guide.md`, README, and all review `internal_links`.
3. **Reconcile hub FAQ schema** — single FAQPage definition (yaml or md); match production draft claims exactly.
4. **Produce four review WordPress draft `.md` files** (or complete CMS import pipeline) assembling body from production drafts + package metadata.
5. **Apply CMS strip to all five bodies:** remove Card ID blocks, draft metadata, excluded-claims sections, raw `source_id` parentheticals, placeholder anchors, and “insert when published” lines.
6. **Replace internal links in bodies** with package slug URLs; sync Related Guides and Alternatives tables to Recovery/H2Ocean review paths.
7. **Consolidate review affiliate disclosure** to single bottom placement per package spec.
8. **Re-run YAML validation** — all five packages must parse cleanly.

### Should fix (before publish)

9. Trim SEO titles to ≤60 characters where possible without changing factual claims.
10. Trim meta descriptions to ≤160 characters (hub yaml currently 204 chars).
11. Replace “evidence layer” phrasing in NeilMed and H2Ocean FAQ schema answers with reader-facing language (same factual content).
12. Add Recovery + H2Ocean to hub CTA deep-dive targets to match comparison section and `internal_links`.
13. Convert hub `.md` Source Notes from `source_id` table to reader-facing format (match YAML `source_notes` block).
14. Assign spoke slugs or keep spoke references as plain text until spokes publish — do not link `pending` URLs live.

### Human gates (unchanged)

15. Human fact-check, safety review, and editorial sign-off remain open per cluster checklist.
16. WordPress draft posts not created in CMS; `wordpress_status: draft` in packages only.

---

## Publish recommendation

**Do not import.** WordPress Draft Sprint 001 did not produce five validated, publish-ready drafts. One hub YAML parses; four review YAML packages are syntactically invalid; hub metadata is duplicated and conflicting; production draft bodies still contain CMS placeholders and stale interlinks.

**Next step:** Repair YAML syntax → reconcile hub slug/title/FAQ → generate review `.md` drafts → apply CMS strip and link replacement → re-run this validation.

---

*Validation performed against package files and `content-operations/production/drafts/` source bodies. No files were modified during this sprint.*
