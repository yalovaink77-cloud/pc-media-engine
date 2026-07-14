# Sterile Saline — WordPress Import Checklist

**Sprint:** WordPress Import 001  
**Date:** 2026-07-15  
**Source package:** `content-operations/production/wordpress/sterile-saline/`  
**Import bodies:** `content-operations/production/wordpress/sterile-saline/import/`  

---

## Import files

| File | Card ID | Canonical slug | Post type |
|------|---------|----------------|-----------|
| [hub.html](./hub.html) | `pc-hub-sterile-saline-complete-guide` | `/guides/sterile-saline-for-piercing-aftercare/` | Page or post (hub guide) |
| [neilmed.html](./neilmed.html) | `pc-review-neilmed-fine-mist` | `/reviews/neilmed-piercing-aftercare-fine-mist/` | Review |
| [steri-wash.html](./steri-wash.html) | `pc-review-steri-wash-saline` | `/reviews/steri-wash-saline-spray/` | Review |
| [recovery.html](./recovery.html) | `pc-review-recovery-sterile-saline` | `/reviews/recovery-sterile-saline-wash/` | Review |
| [h2ocean.html](./h2ocean.html) | `pc-review-h2ocean-piercing-aftercare` | `/reviews/h2ocean-piercing-aftercare-spray/` | Review |

Each `.html` file includes:

- HTML comment header with `post_title`, `post_name`, `canonical`, `seo_title`, `meta_description`, `excerpt`
- Gutenberg block markup (`wp:heading`, `wp:paragraph`, `wp:list`, `wp:table`, `wp:separator`)
- Visible article body (headings through Affiliate Disclosure)
- FAQ JSON-LD in `wp:html` + `<script type="application/ld+json">` block (after body content)

---

## Pre-import verification (completed in Sprint 001)

- [x] Five import HTML files generated from package `.md` + `.yaml`
- [x] H1 removed from post content (WordPress title field holds H1)
- [x] No internal metadata in HTML bodies (`Card ID`, `pc-*` card IDs, `source_id`, draft metadata)
- [x] Internal cluster links use canonical slugs (`/guides/…`, `/reviews/…`)
- [x] Spoke references remain plain text (“guide forthcoming”) — no dead links
- [x] FAQ schema JSON-LD appended per article
- [x] Sources & References and Affiliate Disclosure sections preserved
- [x] Gutenberg block comments present for core blocks

---

## WordPress import steps

### 1. Create draft posts (staged order)

1. Hub → 2. NeilMed → 3. Steri-Wash → 4. Recovery → 5. H2Ocean  

**Status:** Draft only — do not publish until human approval.

### 2. Per-article CMS setup

For each `.html` file:

1. Read metadata from the leading HTML comment block.
2. Create new WordPress draft.
3. Set **Title** from `post_title`.
4. Set **Slug** from `post_name`.
5. Set **Excerpt** from package YAML/`post excerpt` comment.
6. Configure SEO plugin (Yoast/Rank Math):
   - SEO title ← `seo_title`
   - Meta description ← `meta_description`
   - Canonical URL ← `canonical`
7. Open block editor → **Code editor** (or paste into empty post).
8. Paste everything **after** the closing `-->` of the metadata comment (from first `<!-- wp:heading -->` through FAQ JSON-LD block).
9. Switch to visual editor — confirm blocks parse correctly (headings, tables, lists, separators).
10. Assign categories/tags from package YAML (`wordpress_categories`, `wordpress_tags`).
11. Set featured image per package `featured_image_brief` (asset production separate).
12. Save as **Draft**.

### 3. Gutenberg compatibility notes

- Content uses native block delimiter comments compatible with WordPress block editor import.
- Tables use `wp:table` + `figure.wp-block-table`.
- Lists use `wp:list` + `wp-block-list` class.
- FAQ schema uses `wp:html` block — verify theme/plugin does not strip `<script type="application/ld+json">`; if stripped, inject via SEO plugin schema tool using same JSON from file tail.
- Horizontal rules (`wp:separator`) separate major sections.

### 4. Post-import link check

- [ ] Hub links resolve to four review drafts (same slug paths).
- [ ] Each review links back to hub `/guides/sterile-saline-for-piercing-aftercare/`.
- [ ] Peer review cross-links resolve within cluster.
- [ ] External manufacturer URLs in Sources & References open correctly.
- [ ] Spoke “guide forthcoming” items have no hyperlink (intentional until spokes publish).

### 5. Post-import content check

- [ ] FAQ visible section renders (reviews only).
- [ ] FAQ JSON-LD validates ([Google Rich Results Test](https://search.google.com/test/rich-results) or equivalent).
- [ ] Affiliate Disclosure visible at bottom of each commercial page.
- [ ] No duplicate affiliate disclosure at top (reviews).
- [ ] Source notes readable; optionally convert bare URLs to `<a href>` in a follow-up pass.

---

## Publish order gate

| Wave | Slug | Prerequisite |
|------|------|--------------|
| 1 | `/guides/sterile-saline-for-piercing-aftercare/` | Human approval |
| 2 | `/reviews/neilmed-piercing-aftercare-fine-mist/` | Hub live or same-day scheduled |
| 3 | `/reviews/steri-wash-saline-spray/` | Hub live or same-day scheduled |
| 4 | `/reviews/recovery-sterile-saline-wash/` | Hub live; interlinks verified |
| 5 | `/reviews/h2ocean-piercing-aftercare-spray/` | Hub live; interlinks verified |

---

## Import blockers

| Blocker | Severity | Owner |
|---------|----------|-------|
| Human fact-check + safety review not complete | **Blocking** | Editorial |
| WordPress draft posts not yet created in CMS | **Blocking** | Publisher |
| Featured images not produced | **Blocking** for publish (not draft import) | Design |
| SEO plugin title/meta/canonical not configured manually | **Blocking** for publish | Publisher |
| Spoke guides unpublished — five “guide forthcoming” references | **Advisory** | Content ops |
| Source note URLs are plain text in lists (not `<a>` tags) | **Advisory** | Publisher optional fix |
| Hub Recovery comparison section has no inline deep-dive link (Related Guides table only) | **Advisory** | Accept or add link in CMS |
| Meta descriptions exceed ~160 characters | **Advisory** | SEO |
| JSON-LD script block may be stripped by some security plugins | **Advisory** | Verify after paste |
| `content-operations/production/drafts/` unchanged — do not import from that path | **Process** | Publisher |

---

## Do not import

- `content-operations/production/drafts/*.md` (unstripped source drafts)
- Package `.md` metadata wrappers (use `import/*.html` instead)
- Social/fixture NeilMed paths (unsupported claims — separate quarantine)

---

*WordPress Import Sprint 001 — checklist only; no CMS changes performed in repository.*
