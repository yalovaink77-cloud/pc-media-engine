# Hub Article — WordPress Pilot Import Report

**Sprint:** WordPress Pilot 001  
**Validated:** 2026-07-15  
**Source:** `content-operations/production/wordpress/sterile-saline/import/hub.html`  
**Package:** `hub-sterile-saline-complete-guide.yaml`  
**Rule:** Validation only — no edits performed  

---

## Overall verdict

| Result | Meaning |
|--------|---------|
| **CONDITIONAL PASS** | Safe to import as a **WordPress draft** via block editor paste. **Two SEO field failures** should be corrected in CMS before publish. Minor CTA and Gutenberg polish recommended. |

---

## Validation results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Gutenberg block compatibility | **PASS** | 91 blocks; types `heading`, `paragraph`, `list`, `table`, `separator`, `html`. All blocks open/close correctly. |
| 2 | Heading hierarchy | **PASS** | No H1 in body (post title holds H1). 12× H2, 6× H3; no skipped levels. |
| 3 | FAQ JSON-LD placement | **PASS** | Valid `FAQPage` with 6 questions in final `wp:html` block. Schema-only (no visible FAQ section in hub body — intentional). |
| 4 | CTA placement | **FAIL** | Secondary CTA present in Related Guides. Deep-dive CTAs missing for **Recovery** (NeilMed, Steri-Wash, H2Ocean present). |
| 5 | Affiliate disclosure placement | **PASS** | Single disclosure after Sources & References; no top-of-page duplicate. Matches package spec. |
| 6 | Source notes placement | **PASS** | `Sources & References` H2 precedes Affiliate Disclosure. |
| 7 | Internal links | **PASS** | All four review slugs used with canonical paths. Spokes remain plain “guide forthcoming” (intentional). |
| 8 | SEO title length | **FAIL** | 71 characters (recommended ≤60). |
| 9 | Meta description length | **FAIL** | 204 characters (recommended ≤160). |
| 10 | Canonical slug consistency | **PASS** | `post_name`, comment `canonical`, and YAML `slug`/`canonical_url` all align on `/guides/sterile-saline-for-piercing-aftercare/`. |

**Score: 8 / 10 pass · 2 fail · 0 blocking import parse errors**

---

## Detail by check

### 1. Gutenberg block compatibility — PASS

- Block delimiters follow WordPress block editor format.
- Tables use `wp:table` + `figure.wp-block-table`.
- Lists use `wp:list` + `wp-block-list` class.
- FAQ schema uses `wp:html` wrapper.

**Advisory (non-blocking):** Two ordered lists (`Common Mistakes`, concentration/sterility list) use `<!-- wp:list -->` with `<ol>` but omit `{"ordered":true}`. Gutenberg may render them as unordered on paste — confirm in editor after import.

### 2. Heading hierarchy — PASS

```
H2 Editorial Summary
H2 What Sterile Saline Is
H2 Why 0.9% Sodium Chloride Matters
H2 Sterile Saline vs. Homemade Salt Water
H2 How Saline Fits Routine Piercing Aftercare
H2 What Saline Can and Cannot Do
  H3 What it may help with
  H3 What it cannot do
H2 How Often to Use Saline
H2 Common Mistakes
H2 When to Seek Professional Guidance
H2 How to Compare Packaged Sterile Saline Products
  H3 Criteria grounded in category guidance
  H3 Criteria for reading product labels
  H3 Category examples vs comparison peers
H2 Related Guides and Reviews
H2 Sources & References
H2 Affiliate Disclosure
```

### 3. FAQ JSON-LD placement — PASS

- Location: end of file, after Affiliate Disclosure, inside `<!-- wp:html -->`.
- JSON parses cleanly; `@type: FAQPage`; 6 `Question` entities.
- Hub has no on-page FAQ accordion (schema-only) — matches package design.

**Advisory:** Confirm theme/security plugins do not strip `wp:html` script blocks after paste; fallback is SEO plugin schema injection using same JSON.

### 4. CTA placement — FAIL

| CTA (package spec) | Present in hub.html |
|--------------------|---------------------|
| Escalation before shopping (`When to Seek Professional Guidance`) | Yes |
| Deep dive — NeilMed | Yes (line ~384) |
| Deep dive — Steri-Wash | Yes (line ~401) |
| Deep dive — Recovery | **No** (Recovery section ends without deep-dive link) |
| Deep dive — H2Ocean | Yes (line ~438) |
| Secondary — Related Guides closing copy | Yes (line ~511) |

Recovery is linked only in the Related Guides table, not inline after the Recovery 7.4 oz comparison block.

### 5. Affiliate disclosure placement — PASS

- Section order: … → Sources & References → Affiliate Disclosure → FAQ JSON-LD.
- Copy matches package YAML.
- Category-context hub: no commercial CTA above education/escalation sections.

### 6. Source notes placement — PASS

- Heading: `Sources & References`.
- Intro paragraph + bulleted source list with external URLs.
- Positioned immediately before Affiliate Disclosure.

**Advisory:** External URLs are plain list text, not `<a href>` — acceptable for draft import; optional CMS polish.

### 7. Internal links — PASS

| Target | Slug in HTML | Status |
|--------|--------------|--------|
| NeilMed review | `/reviews/neilmed-piercing-aftercare-fine-mist/` | Linked (deep dive + table) |
| Steri-Wash review | `/reviews/steri-wash-saline-spray/` | Linked (deep dive + table) |
| Recovery review | `/reviews/recovery-sterile-saline-wash/` | Linked (table only) |
| H2Ocean review | `/reviews/h2ocean-piercing-aftercare-spray/` | Linked (deep dive + table) |
| Spoke guides | Plain “guide forthcoming” | No href (correct until spokes publish) |

No placeholder anchors (`#related-guides`) or internal metadata links.

### 8. SEO title length — FAIL

```
Sterile Saline for Piercing Aftercare: Complete Guide | PiercingConnect
```

**Length: 71 characters** (recommended ≤60 for SERP display).

### 9. Meta description length — FAIL

```
Learn what packaged sterile saline is, why 0.9% sodium chloride matters in professional guidance, how it compares to DIY salt mixes, what saline cannot do, and when to seek help—before choosing a product.
```

**Length: 204 characters** (recommended ≤160).

### 10. Canonical slug consistency — PASS

| Field | Value |
|-------|-------|
| HTML comment `post_name` | `sterile-saline-for-piercing-aftercare` |
| HTML comment `canonical` | `https://piercingconnect.com/guides/sterile-saline-for-piercing-aftercare/` |
| YAML `slug` | `/guides/sterile-saline-for-piercing-aftercare/` |
| YAML `canonical_url` | `https://piercingconnect.com/guides/sterile-saline-for-piercing-aftercare/` |

All internal review links use matching `/reviews/…` cluster slugs from the same package registry.

---

## Required fixes

### Before publish (blocking)

1. **Shorten SEO title to ≤60 characters** in CMS/SEO plugin — e.g. trim brand suffix or subtitle while keeping accuracy.
2. **Shorten meta description to ≤160 characters** — preserve core claims (category literacy, 0.9% guidance context, DIY caution, no healing guarantee); do not add new claims.

### Before publish (recommended — CTA fail)

3. **Add Recovery deep-dive CTA** after the Recovery 7.4 oz comparison block — link to `/reviews/recovery-sterile-saline-wash/` to match NeilMed/Steri-Wash/H2Ocean pattern and package YAML `cta_placement`.

### After WordPress paste (verify in editor)

4. **Confirm ordered lists render as numbered** — if not, change to `<!-- wp:list {"ordered":true} -->` for the two `<ol>` sections.
5. **Confirm FAQ JSON-LD survives paste** — validate with Rich Results Test; re-inject via SEO plugin if `wp:html` script is stripped.
6. **Convert source note URLs to hyperlinks** (optional UX polish).

### Not required for draft import

- Human fact-check / safety approval (workflow gate, not HTML defect).
- Featured image (separate asset task).
- Spoke guide links (deferred until spokes publish).

---

## Draft import recommendation

**Proceed with WordPress draft import** using `hub.html` body content (paste from first `<!-- wp:heading -->` through final `<!-- /wp:html -->`).

Set title, slug, excerpt, and SEO fields from the HTML comment header — **apply shortened SEO title and meta description at entry time** even though the comment block still contains the longer originals.

---

*WordPress Pilot Sprint 001 — hub import validation only.*
