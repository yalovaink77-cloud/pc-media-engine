# Steri-Wash Review — WordPress Pilot Import Report

**Sprint:** WordPress Pilot 003  
**Validated:** 2026-07-15  
**Source:** `content-operations/production/wordpress/sterile-saline/import/steri-wash.html`  
**Package:** `steri-wash-saline-spray.yaml`  
**Rule:** Validation only — no edits performed  

---

## Overall verdict

| Result | Meaning |
|--------|---------|
| **CONDITIONAL PASS** | Safe to import as a **WordPress draft** via block editor paste. **Two SEO field failures** and **one Alternatives-table link gap** should be corrected before publish. Minor Gutenberg polish recommended. |

---

## Validation results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Gutenberg block compatibility | **PASS** | 74 blocks; types `heading`, `paragraph`, `list`, `table`, `separator`, `html`. All blocks open/close correctly. |
| 2 | Heading hierarchy | **PASS** | No H1 in body (post title holds H1). 14× H2, 2× H3 under Evidence section; no skipped levels. |
| 3 | FAQ JSON-LD | **PASS** | Valid `FAQPage` with 5 questions in final `wp:html` block after Affiliate Disclosure. Matches package `faq_schema`. Visible FAQ section also present (5 Q&A pairs). |
| 4 | SEO title length | **FAIL** | 69 characters (recommended ≤60). |
| 5 | Meta description length | **FAIL** | 183 characters (recommended ≤160). |
| 6 | CTA placement | **FAIL** | Hub links, verdict copy, and escalation ordering present. **NeilMed Alternatives row lacks inline anchor** (Recovery and H2Ocean linked). |
| 7 | Affiliate disclosure placement | **PASS** | Single bottom disclosure after Sources & References; no top-of-page duplicate. Copy matches package YAML. |
| 8 | Source notes placement | **PASS** | `Sources & References` H2 precedes Affiliate Disclosure; intro and six source records present. |
| 9 | Internal links | **FAIL** | All four cluster URLs appear, but NeilMed is **plain text** in Alternatives table (`/reviews/neilmed-piercing-aftercare-fine-mist/`) while peer rows use `<a href>`. Hub, Recovery, H2Ocean linked elsewhere. Spokes remain “guide forthcoming” (intentional). |
| 10 | Canonical slug consistency | **PASS** | `post_name`, comment `canonical`, and YAML `slug`/`canonical_url` align on `/reviews/steri-wash-saline-spray/`. |

**Score: 7 / 10 pass · 3 fail · 0 blocking import parse errors**

---

## Detail by check

### 1. Gutenberg block compatibility — PASS

- Block delimiters follow WordPress block editor format.
- Four tables use `wp:table` + `figure.wp-block-table`.
- Seven lists use `wp:list` + `wp-block-list` class.
- FAQ schema uses `wp:html` wrapper.

**Advisory (non-blocking):** One ordered list (Product Overview assessment criteria) uses `<!-- wp:list -->` with `<ol>` but omits `{"ordered":true}`. Gutenberg may render it as unordered on paste — confirm in editor after import.

### 2. Heading hierarchy — PASS

```
H2 Editorial Summary
H2 Product Overview
H2 Verified Formula
H2 Evidence and Guideline Alignment
  H3 Professional guidance (category layer)
  H3 Steri-Wash product layer
H2 Potential Advantages
H2 Limitations and Uncertainties
H2 Who May Consider It
H2 Who Should Seek Professional Guidance
H2 Alternatives
H2 FAQ
H2 Final Verdict
H2 Related Guides
H2 Sources & References
H2 Affiliate Disclosure
```

### 3. FAQ JSON-LD — PASS

- Location: end of file, after Affiliate Disclosure, inside `<!-- wp:html -->`.
- JSON parses cleanly; `@type: FAQPage`; 5 `Question` entities.
- Question text and answers align with package `faq_schema` and visible FAQ section.
- Section order: FAQ (visible) → Final Verdict → Related Guides → Sources → Affiliate → JSON-LD.

**Advisory:** Confirm theme/security plugins do not strip `wp:html` script blocks after paste; fallback is SEO plugin schema injection.

### 4. SEO title length — FAIL

```
Steri-Wash Saline Spray Review: 4.25 oz Label Facts | PiercingConnect
```

**Length: 69 characters** (recommended ≤60 for SERP display).

### 5. Meta description length — FAIL

```
Independent Steri-Wash review: water + sodium chloride spray, no drugs or preservatives, and SKU-scoped 0.9% USP NaCl verified on the 4.25 oz label only—not extrapolated to all sizes.
```

**Length: 183 characters** (recommended ≤160).

### 6. CTA placement — FAIL

| CTA (package spec) | Present in steri-wash.html |
|--------------------|----------------------------|
| Hub link — Editorial Summary (after SKU-scoped evidence boundary) | Yes (line ~25) |
| Hub link — Who May Consider It (closing line) | Yes (line ~293) |
| Peer links — Alternatives table (NeilMed, Recovery, H2Ocean) | **Partial** — Recovery and H2Ocean linked; **NeilMed plain text only** |
| Informed decision — Final Verdict | Yes (“Use with piercer guidance. No healing guarantee.”) |
| Commercial affiliate link (if enabled) | Not present (acceptable for draft without affiliate URLs) |
| Escalation before shopping framing | Yes — “Who Should Seek Professional Guidance” precedes Alternatives |

### 7. Affiliate disclosure placement — PASS

- Single disclosure at article end; consolidated per `cms_strip_before_import` (no duplicate top note).
- Position: after Sources & References, before FAQ JSON-LD.
- Copy matches package `affiliate_disclosure_placement.copy`.

### 8. Source notes placement — PASS

- Heading: `Sources & References`.
- Intro paragraph matches package `source_notes.intro`.
- Six evidence records listed (Steri-Wash, APP, NeilMed, Recovery, H2Ocean, Base Labs).
- Positioned immediately before Affiliate Disclosure.

**Advisory:** External URLs are plain list text, not `<a href>` — acceptable for draft import; optional CMS polish.

### 9. Internal links — FAIL

| Target | Slug in HTML | Linked? |
|--------|--------------|---------|
| Hub guide | `/guides/sterile-saline-for-piercing-aftercare/` | Yes (Editorial Summary, Who May Consider, Related Guides) |
| NeilMed review | `/reviews/neilmed-piercing-aftercare-fine-mist/` | Yes in Related Guides; **plain text in Alternatives table** |
| Recovery review | `/reviews/recovery-sterile-saline-wash/` | Yes (Alternatives + Related Guides) |
| H2Ocean review | `/reviews/h2ocean-piercing-aftercare-spray/` | Yes (Alternatives + Related Guides) |
| Spoke guides | Plain “guide forthcoming” | No href (correct until spokes publish) |

No placeholder anchors or broken internal paths detected.

### 10. Canonical slug consistency — PASS

| Field | Value |
|-------|-------|
| HTML comment `post_name` | `steri-wash-saline-spray` |
| HTML comment `canonical` | `https://piercingconnect.com/reviews/steri-wash-saline-spray/` |
| YAML `slug` | `/reviews/steri-wash-saline-spray/` |
| YAML `canonical_url` | `https://piercingconnect.com/reviews/steri-wash-saline-spray/` |

---

## Required fixes

### Before publish (blocking)

1. **Shorten SEO title to ≤60 characters** in CMS/SEO plugin — e.g. trim “4.25 oz Label Facts” subtitle or brand suffix while keeping product identification and SKU-scoping signal.
2. **Shorten meta description to ≤160 characters** — preserve water + sodium chloride, no drugs/preservatives, and 4.25 oz–only 0.9% USP NaCl boundary; do not add new claims or imply line-wide concentration.
3. **Wrap NeilMed Alternatives table link** — change `/reviews/neilmed-piercing-aftercare-fine-mist/` cell to `<a href="/reviews/neilmed-piercing-aftercare-fine-mist/">` matching Recovery and H2Ocean rows (fixes CTA #6 and internal links #9).

### After WordPress paste (verify in editor)

4. **Confirm ordered list renders as numbered** in Product Overview — if not, change to `<!-- wp:list {"ordered":true} -->`.
5. **Confirm FAQ JSON-LD survives paste** — validate with Rich Results Test; re-inject via SEO plugin if `wp:html` script is stripped.
6. **Convert source note URLs to hyperlinks** (optional UX polish).

### Not required for draft import

- Human fact-check / safety review approval (workflow gate).
- WordPress draft post not yet created in CMS.
- Featured image not produced.
- Commercial affiliate product link (deferred until affiliate URLs enabled; package notes 4.25 oz SKU context when concentration is material).
- Spoke guide links (deferred until spokes publish).
- Evidence boundary `<code>` tags in body (e.g. `app-aftercare`, `official-steri-wash`) — editorial artifact; optional CMS cleanup, not an import blocker.

---

## Draft import recommendation

**Proceed with WordPress draft import** using `steri-wash.html` body content (paste from first `<!-- wp:heading -->` through final `<!-- /wp:html -->`).

Set title, slug, excerpt, and SEO fields from the HTML comment header — **apply shortened SEO title and meta description at entry time** even though the comment block still contains the longer originals.

Fix NeilMed Alternatives anchor in HTML before paste or immediately after import in the block editor.

---

*WordPress Pilot Sprint 003 — Steri-Wash import validation only.*
