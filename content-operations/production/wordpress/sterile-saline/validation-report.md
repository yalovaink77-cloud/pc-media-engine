# Sterile Saline WordPress Package — Validation Report

**Sprint:** WordPress Package Re-validation (post Pilot 001–005 fixes)  
**Validated:** 2026-07-15  
**Scope:** `content-operations/production/wordpress/sterile-saline/`  
**Rule:** Validation only — no evidence edits, no article rewrites, no commit/push  

---

## Final verdict

| Overall | Result |
|---------|--------|
| **Package validation** | **PASS** — all five YAML packages parse; all five import HTML files pass structural CMS checks |
| **CMS draft import** | **READY** — proceed with WordPress draft paste for Hub → NeilMed → Steri-Wash → Recovery → H2Ocean |
| **Public publish** | **NOT YET** — process gates remain (human fact-check, featured images, CMS posts, claim-ID polish) |

**Score:** 5/5 articles structurally pass · 0 blocking import failures · claim-ID leakage = warning (non-blocking for draft import)

---

## Per-article checklist

| Check | Hub | NeilMed | Steri-Wash | Recovery | H2Ocean |
|-------|:---:|:-------:|:----------:|:--------:|:-------:|
| YAML parsing | PASS | PASS | PASS | PASS | PASS |
| Gutenberg block compatibility | PASS (92) | PASS (74) | PASS (74) | PASS (75) | PASS (74) |
| Heading hierarchy | PASS | PASS | PASS | PASS | PASS |
| Canonical slug | PASS | PASS | PASS | PASS | PASS |
| SEO title ≤60 | PASS (55) | PASS (54) | PASS (58) | PASS (60) | PASS (57) |
| Meta description ≤160 | PASS (154) | PASS (150) | PASS (152) | PASS (149) | PASS (139) |
| FAQ JSON-LD | PASS (6Q) | PASS (5Q) | PASS (5Q) | PASS (6Q) | PASS (5Q) |
| CTA placement | PASS | PASS | PASS | PASS | PASS |
| Affiliate disclosure | PASS | PASS | PASS | PASS | PASS |
| Source notes | PASS | PASS | PASS | PASS | PASS |
| Internal links | PASS | PASS | PASS | PASS | PASS |
| No internal metadata leakage | PASS | **WARN** | **WARN** | **WARN** | **WARN** |
| No unsupported claim leakage | PASS | **WARN** | PASS* | **WARN** | **WARN** |

\*Steri-Wash uses the word “unsupported” in plain editorial prose (SKU boundary) without claim-tracking IDs — acceptable.

YAML `seo_title` / `meta_description` / `slug` / `canonical_url` match each article’s HTML comment header.

---

## Canonical slugs (verified)

| Article | Slug |
|---------|------|
| Hub | `/guides/sterile-saline-for-piercing-aftercare/` |
| NeilMed | `/reviews/neilmed-piercing-aftercare-fine-mist/` |
| Steri-Wash | `/reviews/steri-wash-saline-spray/` |
| Recovery | `/reviews/recovery-sterile-saline-wash/` |
| H2Ocean | `/reviews/h2ocean-piercing-aftercare-spray/` |

Prior hub slug conflict (`…for-piercing-aftercare` vs `…piercing-aftercare`) is resolved. Ordered lists include `{"ordered":true}` on all five import files.

---

## Warnings (non-blocking for draft import)

### W1 — Evidence claim IDs still visible in review HTML bodies

Import HTML for NeilMed, Recovery, and H2Ocean (and source-layer labels in Steri-Wash headings) still expose internal claim/source IDs such as:

- NeilMed: `neilmed-nacl-0.9-percent`, `neilmed-drug-free-label`, `neilmed-healing-guarantee`, `app-aftercare`, `official-neilmed`
- Recovery: `recovery-ingredient-decomposition`, `recovery-coa-composition-text`, `recovery-healing-guarantee`
- H2Ocean: `h2ocean-sterile-0-9-nacl`, `h2ocean-app-equivalence`, `h2ocean-healing-infection-prevention`
- Steri-Wash / Recovery / H2Ocean / NeilMed: heading `<code>app-aftercare</code>` / `official-*` labels

Editorial substance of the gaps is correct; the **machine claim IDs** are internal metadata that should be stripped or rewritten in CMS before public publish. Hub body is clean.

### W2 — Source note URLs are plain text

External URLs under Sources & References are not wrapped in `<a href>` (advisory UX polish).

### W3 — FAQ JSON-LD post-paste survival

All five keep FAQPage JSON-LD in a final `wp:html` block after Affiliate Disclosure. Confirm theme/security plugins do not strip scripts after paste (Rich Results Test).

---

## Remaining blockers

### Blocking public publish (process — not HTML structural defects)

1. Human fact-check / safety review approval  
2. WordPress draft posts not yet created in CMS  
3. Featured images not produced (briefs exist in YAML)  
4. Spoke guides still “guide forthcoming” (intentional until spokes publish)  
5. Commercial affiliate product URLs not enabled (disclosures present; buy links deferred)  
6. **Recommended before public publish:** strip internal claim/source IDs (`… — unsupported)` patterns and heading `<code>official-*</code>` labels) from NeilMed / Steri-Wash / Recovery / H2Ocean import bodies without changing medical claims  

### Not blocking draft import

- Claim-ID polish (W1)  
- Source URL hyperlinking (W2)  
- FAQ script survival verification (W3)  

---

## CMS import recommendation

**Proceed with WordPress draft import** for the full cluster, in order:

1. Hub — `import/hub.html`  
2. NeilMed — `import/neilmed.html`  
3. Steri-Wash — `import/steri-wash.html`  
4. Recovery — `import/recovery.html`  
5. H2Ocean — `import/h2ocean.html`  

**At CMS entry for each article:** paste body from first `<!-- wp:heading -->` through final `<!-- /wp:html -->`; set title, slug, excerpt, SEO title, and meta description from the HTML comment header (already length-compliant and YAML-synced).

**Do not publish live** until process blockers above are cleared and claim-ID cleanup (W1) is applied or explicitly accepted.

Pilot import reports remain available under `import/*-import-report.md` for per-article audit trails.

---

*Package re-validation after WordPress Pilot Sprints 001–005 fixes. Evidence and article claims unchanged.*
