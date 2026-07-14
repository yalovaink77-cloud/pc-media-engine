# Recovery Review — WordPress Pilot Import Report

**Sprint:** WordPress Pilot 004  
**Validated:** 2026-07-15  
**Source:** `content-operations/production/wordpress/sterile-saline/import/recovery.html`  
**Package:** `recovery-sterile-saline-wash.yaml`  
**Rule:** Validation only — no edits performed  

---

## Overall verdict

| Result | Meaning |
|--------|---------|
| **CONDITIONAL PASS** | Safe to import as a **WordPress draft** via block editor paste. **One SEO field failure** and **two missing Alternatives-table anchors** should be corrected before publish. Minor Gutenberg polish recommended. |

---

## Validation results

| # | Check | Result | Notes |
|---|-------|--------|-------|
| 1 | Gutenberg block compatibility | **PASS** | 75 blocks; types `heading`, `paragraph`, `list`, `table`, `separator`, `html`. All blocks open/close correctly. |
| 2 | Heading hierarchy | **PASS** | No H1 in body (post title holds H1). 14× H2, 2× H3 under Evidence section; no skipped levels. |
| 3 | FAQ JSON-LD | **PASS** | Valid `FAQPage` with 6 questions in final `wp:html` block after Affiliate Disclosure. Matches package `faq_schema`. Visible FAQ section also present (6 Q&A pairs). |
| 4 | SEO title length | **PASS** | 60 characters (at recommended ≤60 limit). |
| 5 | Meta description length | **FAIL** | 204 characters (recommended ≤160). |
| 6 | CTA placement | **FAIL** | Hub links, verdict copy, and escalation ordering present. **NeilMed and Steri-Wash Alternatives rows lack inline anchors** (H2Ocean linked). |
| 7 | Affiliate disclosure placement | **PASS** | Single bottom disclosure after Sources & References; no top-of-page duplicate. Copy matches package YAML. |
| 8 | Source notes placement | **PASS** | `Sources & References` H2 precedes Affiliate Disclosure; intro and six source records present. |
| 9 | Internal links | **FAIL** | All four cluster URLs appear, but NeilMed and Steri-Wash are **plain text** in Alternatives table while H2Ocean uses `<a href>`. All three peers linked in Related Guides table. Hub linked in Editorial Summary and Who May Consider. Spokes remain “guide forthcoming” (intentional). |
| 10 | Canonical slug consistency | **PASS** | `post_name`, comment `canonical`, and YAML `slug`/`canonical_url` align on `/reviews/recovery-sterile-saline-wash/`. |

**Score: 8 / 10 pass · 2 fail · 0 blocking import parse errors**

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
  H3 Recovery 7.4 oz product layer
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
- JSON parses cleanly; `@type: FAQPage`; 6 `Question` entities.
- Question text and answers align with package `faq_schema` and visible FAQ section (includes MED-637 SDS synonym vs Purified Saline MSDS distinction).
- Section order: FAQ (visible) → Final Verdict → Related Guides → Sources → Affiliate → JSON-LD.

**Advisory:** Confirm theme/security plugins do not strip `wp:html` script blocks after paste; fallback is SEO plugin schema injection.

### 4. SEO title length — PASS

```
Recovery Sterile Saline Wash 7.4 oz Review | PiercingConnect
```

**Length: 60 characters** (at recommended ≤60 limit — no trim required, but monitor SERP truncation).

### 5. Meta description length — FAIL

```
Independent Recovery Sterile Saline Wash 7.4 oz review: drug-free/preservative-free claims, bag-on-valve spray, linked SDS/CoA/gamma docs, and 0.9% evidence via SDS synonym only—not Section 3 or CoA text.
```

**Length: 204 characters** (recommended ≤160).

### 6. CTA placement — FAIL

| CTA (package spec) | Present in recovery.html |
|--------------------|--------------------------|
| Hub link — Editorial Summary (after evidence boundary) | Yes (line ~29) |
| Hub link — Who May Consider It (closing line) | Yes |
| Peer links — Alternatives table (NeilMed, Steri-Wash, H2Ocean) | **Partial** — H2Ocean linked; **NeilMed and Steri-Wash plain text only** |
| Informed decision — Final Verdict | Yes (“Use with piercer guidance. No healing guarantee.”) |
| Commercial affiliate link (if enabled) | Not present (acceptable for draft without affiliate URLs) |
| Escalation before shopping framing | Yes — “Who Should Seek Professional Guidance” precedes Alternatives |

### 7. Affiliate disclosure placement — PASS

- Single disclosure at article end; consolidated per `cms_strip_before_import` (no duplicate top note).
- Position: after Sources & References, before FAQ JSON-LD.
- Copy matches package `affiliate_disclosure_placement.copy` (CoA / Section 3 evidence gaps noted).

### 8. Source notes placement — PASS

- Heading: `Sources & References`.
- Intro paragraph matches package `source_notes.intro` (MED-637 / SDS synonym scope).
- Six evidence records listed (Recovery 7.4 oz, APP, NeilMed, Steri-Wash, H2Ocean, Base Labs).
- Positioned immediately before Affiliate Disclosure.

**Advisory:** External URLs are plain list text, not `<a href>` — acceptable for draft import; optional CMS polish.

### 9. Internal links — FAIL

| Target | Slug in HTML | Linked? |
|--------|--------------|---------|
| Hub guide | `/guides/sterile-saline-for-piercing-aftercare/` | Yes (Editorial Summary, Who May Consider, Related Guides) |
| NeilMed review | `/reviews/neilmed-piercing-aftercare-fine-mist/` | Yes in Related Guides; **plain text in Alternatives table** |
| Steri-Wash review | `/reviews/steri-wash-saline-spray/` | Yes in Related Guides; **plain text in Alternatives table** |
| H2Ocean review | `/reviews/h2ocean-piercing-aftercare-spray/` | Yes (Alternatives + Related Guides) |
| Spoke guides | Plain “guide forthcoming” | No href (correct until spokes publish) |

No placeholder anchors or broken internal paths detected.

### 10. Canonical slug consistency — PASS

| Field | Value |
|-------|-------|
| HTML comment `post_name` | `recovery-sterile-saline-wash` |
| HTML comment `canonical` | `https://piercingconnect.com/reviews/recovery-sterile-saline-wash/` |
| YAML `slug` | `/reviews/recovery-sterile-saline-wash/` |
| YAML `canonical_url` | `https://piercingconnect.com/reviews/recovery-sterile-saline-wash/` |

---

## Required fixes

### Before publish (blocking)

1. **Shorten meta description to ≤160 characters** — preserve MED-637 / 7.4 oz scope, drug-free/preservative-free framing, SDS/CoA/gamma documentation, and **0.9% via SDS synonym only** boundary (not Section 3 or CoA text); do not add new claims.
2. **Wrap NeilMed Alternatives table link** — change `/reviews/neilmed-piercing-aftercare-fine-mist/` cell to `<a href="/reviews/neilmed-piercing-aftercare-fine-mist/">`.
3. **Wrap Steri-Wash Alternatives table link** — change `/reviews/steri-wash-saline-spray/` cell to `<a href="/reviews/steri-wash-saline-spray/">` (fixes CTA #6 and internal links #9).

### After WordPress paste (verify in editor)

4. **Confirm ordered list renders as numbered** in Product Overview — if not, change to `<!-- wp:list {"ordered":true} -->`.
5. **Confirm FAQ JSON-LD survives paste** — validate with Rich Results Test; re-inject via SEO plugin if `wp:html` script is stripped.
6. **Convert source note URLs to hyperlinks** (optional UX polish).

### Not required for draft import

- SEO title trim (already at 60-character limit).
- Human fact-check / safety review approval (workflow gate).
- WordPress draft post not yet created in CMS.
- Featured image not produced.
- Commercial affiliate product link (deferred until affiliate URLs enabled; package notes 7.4 oz SKU specifically).
- Spoke guide links (deferred until spokes publish).
- Evidence boundary `<code>` tags in body — editorial artifact; optional CMS cleanup, not an import blocker.

---

## Draft import recommendation

**Proceed with WordPress draft import** using `recovery.html` body content (paste from first `<!-- wp:heading -->` through final `<!-- /wp:html -->`).

Set title, slug, excerpt, and SEO fields from the HTML comment header — **apply shortened meta description at entry time** even though the comment block still contains the longer original.

Fix NeilMed and Steri-Wash Alternatives anchors in HTML before paste or immediately after import in the block editor.

---

*WordPress Pilot Sprint 004 — Recovery import validation only.*
