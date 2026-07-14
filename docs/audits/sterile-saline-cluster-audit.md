# Sterile Saline Cluster Audit

**Repository audited:** PiercingConnect Commerce Blueprint (`piercingconnect-commerce`)  
**Scope:** Sterile saline commercial and editorial cluster only  
**Audit date:** 2026-07-14  
**Auditor context:** Supports `pc-hub-sterile-saline-complete-guide` and related P1 content cards in pc-media-engine

---

## Executive summary

The Commerce Blueprint provides a **strong taxonomy skeleton** for the Sterile Saline ecosystem: category records, six saline-class products, core ingredients, nineteen problem records with saline aftercare framing, fifteen keyword clusters (six directly saline-focused), platform templates, and affiliate program taxonomy. However, **no structured knowledge asset is marked `active`**, and **resolved source records do not exist** for any cited authority ID (`app-aftercare`, `nhs-wound-care`, `official-neilmed`, etc.). Several product records are incomplete, ingredient references are broken in places, and comparison data exists only as keyword clusters—not as structured comparison entities.

**Readiness score: 58%**

The cluster is suitable for **internal drafting and PCME scaffolding** but **not production-ready** for published hub guides, product reviews, or affiliate-backed recommendations until evidence resolution and record completion work is done.

---

## 1. Existing knowledge assets

### Product categories (4 saline-adjacent)

| ID | Path | Role |
|----|------|------|
| `sterile-saline-spray` | `data/product-categories/sterile-saline-spray.yaml` | Primary APP-aligned cluster category |
| `saline-spray` | `data/product-categories/saline-spray.yaml` | Parent category including non-sterile peers |
| `wound-wash` | `data/product-categories/wound-wash.yaml` | Pharmacy/US-style labeling overlap |
| `healing-soak` | `data/product-categories/healing-soak.yaml` | DIY vs packaged contrast context |

All four records: `review.status: draft`. Research mirrors exist under `research/product-categories/`.

### Products (6 in saline cluster)

| Product ID | Category | Trust | Affiliate flag | Record depth |
|------------|----------|-------|----------------|--------------|
| `neilmed-piercing-aftercare-fine-mist` | `sterile-saline-spray` | 92 / high | `available: true` | **Strong** — ingredients, sizes, healing stages, recommended_for |
| `steri-wash-saline-spray` | `sterile-saline-spray` | 89 / high | **Missing** | **Thin** — no sizes, healing_stages, recommended_for, affiliate block |
| `recovery-sterile-saline-wash-7-4oz` | `sterile-saline-spray` | 87 / high | `available: unknown` | **Moderate** — sizes present; ingredient uses non-canonical ID |
| `easypiercing-saline-solution-50ml` | `saline-spray` | 80 / high | `available: false` | **Partial** — sterility unknown; propellant listed |
| `h2ocean-piercing-aftercare-spray` | `saline-spray` | 82 / high | `available: true` | **Good for comparison peer** — sea-salt/lysozyme; `sterile: false` |
| `base-laboratories-piercing-aftercare-spray` | `saline-spray` | 72 / medium | `available: false` | **Incomplete** — many unknown fields; additive-heavy formula |

All products: `status: draft`, `review.status: draft`.

### Brands (6 cluster-relevant)

`neilmed`, `steri-wash`, `recovery-aftercare`, `easypiercing-care-lab`, `h2ocean`, `base-laboratories` — brand YAML exists with trust scores and peer links. NeilMed brand record includes `source_notes`; Steri-Wash brand record is minimal.

### Ingredients (2 core + 4 comparison-adjacent)

**Core (APP-aligned):**

- `sterile-water` — `data/ingredients/sterile-water.yaml`
- `sodium-chloride-0.9-percent` — `data/ingredients/sodium-chloride-0.9-percent.yaml` (strong APP/NHS framing)

**Comparison-adjacent (present):**

- `sea-salt`, `purified-water`, `lysozyme`, `tea-tree-oil`

### Problems (19 with saline product links)

Every major aftercare problem record links to the same three Tier-1 sterile saline products (`neilmed`, `recovery`, `steri-wash`). Notable saline-relevant records:

- `undercleaning`, `overcleaning` — direct saline routine framing
- `infection-concern`, `irritation-bump` — high-caution escalation language
- `crusting`, `dryness`, `swelling`, `moisture-irritation` — routine rinse context

Problem records are among the **richest assets** in the cluster (symptoms, causes, when_to_seek_professional_help). All: `review.status: draft`.

### Keyword / SEO clusters (6 directly saline-focused)

| Cluster ID | Primary keyword | Intent |
|------------|-----------------|--------|
| `best-saline-spray-for-piercings` | best saline spray for piercings | commercial |
| `sterile-saline-vs-sea-salt` | sterile saline vs sea salt | comparison |
| `neilmed-vs-h2ocean` | NeilMed vs H2Ocean | comparison |
| `piercing-aftercare-mist` | piercing aftercare mist | commercial |

**Adjacent clusters** (saline mentioned in safety_notes or related_products): `piercing-bump`, `infected-piercing`, `piercing-crust`, `piercing-swelling`, plus location aftercare clusters (`helix`, `nose`, `navel`, `nipple`, `septum`).

Research mirrors: `research/seo-clusters/*_research.md` with APP URL links (markdown only, not resolved records).

### Templates and content assets (platform adaptation scaffolding)

| Template | Publishing targets | Cluster relevance |
|----------|-------------------|-------------------|
| `pillar-page` | WordPress, Facebook, Pinterest, email, YouTube, PDF | Hub guide |
| `aftercare-guide` | WordPress, Facebook, Pinterest, email, YouTube, PDF | Category literacy |
| `buying-guide` | WordPress, PDF, email | Commercial consideration |
| `product-comparison` | WordPress, Facebook, Pinterest, email, PDF | Peer comparisons |
| `product-review` | WordPress (+ social via content assets) | Individual reviews |
| `problem-guide` | WordPress (+ social) | Problem spokes |
| `youtube-script`, `facebook-post`, `pinterest-pin`, `email-sequence` | Respective channels | Platform adaptation |

Matching content-asset taxonomy records exist under `data/content-assets/`. All templates and assets: `review.status: draft`.

### Affiliate taxonomy

- `amazon-associates` — links NeilMed, H2Ocean, Recovery; Steri-Wash at brand level only
- `brand-direct` — links NeilMed, H2Ocean, Steri-Wash, Recovery, EasyPiercing, Base Labs

### Standards (governing policies)

- `standards/evidence-policy.md` — active; requires evidence for safety claims
- `standards/affiliate-policy.md`, `standards/editorial-guidelines.md`, `standards/seo-guidelines.md`

### Books / editorial architecture (reference layer)

`books/01-aftercare-bible/` documents SEO cluster intent for sterile saline vs sea salt, best saline spray, and location aftercare clusters — aligned with structured data but not itself publishable evidence.

---

## 2. Missing product records

Products **expected for a complete Sterile Saline ecosystem** but **absent or insufficient** in Commerce Blueprint:

### Tier-1 peers — incomplete records (exist but not review-ready)

| Product | Gap |
|---------|-----|
| `steri-wash-saline-spray` | No `available_sizes`, `healing_stages`, `recommended_for`, `affiliate` block; no `source_notes` |
| `recovery-sterile-saline-wash-7-4oz` | Affiliate unknown; uses broken ingredient ID `sterile-saline`; no official source notes |
| `easypiercing-saline-solution-50ml` | `sterile: unknown`; concentration not verified as 0.9%; affiliate false |

### Comparison peers — present but weak for sterile cluster hub

| Product | Gap |
|---------|-----|
| `base-laboratories-piercing-aftercare-spray` | Additive formula; many `unknown` fields; not APP-aligned sterile baseline |
| `h2ocean-piercing-aftercare-spray` | Correctly flagged non-sterile; useful for contrast only |

### Missing product categories entirely

| Expected record | Why needed |
|-----------------|------------|
| Pharmacy generic wound wash (e.g., Arm & Hammer Simply Saline, CVS/Walgreens sterile saline) | APP guidance references wound-wash shelf products; `wound-wash` category has **zero generic SKUs** |
| NeilMed Wound Wash (non-piercing-branded variant) | Category literacy: piercing-branded vs pharmacy labeling |
| Steri-Wash size variants as separate SKUs (if sold as distinct ASINs) | Review depth and affiliate mapping |
| Recovery additional sizes beyond 7.4oz / 1.5oz | Completeness for buying-guide cluster |
| Dedicated `sterile-saline-spray` review card peer: **Recovery** and **EasyPiercing** standalone review records at editorial depth | P1 cards only cover NeilMed + Steri-Wash reviews |

### Missing dedicated review content assets

No content-asset or keyword cluster specifically bound to `steri-wash-saline-spray` or `recovery-sterile-saline-wash-7-4oz` as primary subjects (only listed in `best-saline-spray-for-piercings` aggregate).

---

## 3. Missing evidence

**Critical blocker:** Source IDs are cited across the cluster but **no resolved source entity files exist** under `data/` and `references/` is **empty**.

### Unresolved source IDs referenced in sterile saline cluster

| Source ID (cited) | Referenced by | Resolved record? |
|-------------------|---------------|------------------|
| `app-aftercare` | Categories, keywords, ingredients, problems | **No** |
| `app-troubleshooting` | Categories, keywords, problems | **No** |
| `app-piercing-faq` | Categories, keywords | **No** |
| `nhs-wound-care` | `sodium-chloride-0.9-percent` | **No** |
| `nhs-infected-piercings` | `infection-concern` | **No** |
| `mayo-clinic-piercings` | `infection-concern`, ingredients | **No** |
| `cleveland-clinic-infected-ear-piercing` | `infection-concern` | **No** |
| `official-neilmed` | NeilMed product, brand | **No** |
| `official-steri-wash` | Steri-Wash product | **No** |
| `official-recovery-aftercare` | Recovery product | **No** |
| `official-h2ocean` | H2Ocean product | **No** |
| `official-base-laboratories` | Base Labs product | **No** |
| `official-otzi` | EasyPiercing product | **No** |

Research markdown files link to APP URLs but do **not** constitute resolved, quotable source records per `standards/evidence-policy.md`.

### Evidence gaps by use case

| Use case | Gap |
|----------|-----|
| Hub guide — APP preference for packaged sterile saline | No primary APP text record; cannot fact-check quotes or frequency guidance |
| Hub guide — DIY vs packaged | Ingredient record summarizes APP alignment but cites unresolved `app-aftercare` |
| Product reviews — official claims | No manufacturer documentation records with verifiable ingredient labels, SDS, or marketing claim text |
| Problem guides — infection escalation | Medical source IDs cited but not resolved; high-risk per evidence policy |
| Trust scores | Present (72–92) but brand records note "requires deeper source validation" |

### Review status gap

**Zero** cluster records have `review.status: active`. Entire cluster remains at `draft`, including high-risk `infection-concern`.

---

## 4. Missing ingredients

### Referenced by products but no ingredient record

| Ingredient ID (in product YAML) | Used by | Status |
|--------------------------------|---------|--------|
| `sterile-saline` | `recovery-sterile-saline-wash-7-4oz` | **Missing file** — should decompose to `sterile-water` + `sodium-chloride-0.9-percent` or alias |
| `water` | `easypiercing-saline-solution-50ml` | **Missing** (distinct from `sterile-water` / `purified-water`) |
| `sodium-chloride` | EasyPiercing, Base Labs | **Missing** (only `sodium-chloride-0.9-percent` exists) |
| `nitrogen` | EasyPiercing (propellant) | **Missing** |
| `usp-grade-water` | Base Labs | **Missing** |
| `allantoin` | Base Labs | **Missing** |
| `aloe-vera` | Base Labs | **Missing** |
| `rosemary-leaf-oil` | Base Labs | **Missing** |
| `panthenol` | Base Labs | **Missing** |

### Ingredient records present and cluster-ready

`sterile-water`, `sodium-chloride-0.9-percent`, `sea-salt`, `purified-water`, `lysozyme`, `tea-tree-oil` — adequate for NeilMed vs H2Ocean vs sea-salt comparison framing.

### Taxonomy inconsistency

Recovery product lists composite `sterile-saline` while category and peer products use atomic ingredient IDs. This breaks ingredient-union logic in `templates/product-comparison.md`.

---

## 5. Missing comparison data

### What exists

- Keyword clusters: `best-saline-spray-for-piercings`, `sterile-saline-vs-sea-salt`, `neilmed-vs-h2ocean`, `piercing-aftercare-mist`
- Template: `templates/product-comparison.md` + `data/templates/product-comparison.yaml`
- Content asset: `comparison-article` bound to NeilMed vs H2Ocean and sterile saline vs sea salt

### What is missing

| Gap | Impact |
|-----|--------|
| **No structured comparison entity** (e.g., `data/comparisons/sterile-saline-tier1.yaml`) with declared criteria matrix | PCME cannot generate criteria-first hub comparison section from structured data alone |
| **No NeilMed vs Steri-Wash cluster** | P1 editorial plan includes both reviews; commerce has no dedicated comparison keyword |
| **No sterile saline vs pharmacy wound wash cluster** | Hub brief expects wound-wash literacy; category exists, comparison cluster does not |
| **No multi-product ranking criteria record** | `best-saline-spray-for-piercings` lists six products but provides no weighted comparison dimensions (sterility, NaCl %, preservative, mist vs stream, size, price tier) |
| **Trust scores without evidence backing** | Comparison template requires trust scores + ingredients; scores are draft without validated source notes |
| **Broken keyword cross-refs in problems** | `undercleaning` / `overcleaning` reference `sterile-saline-aftercare`; `dryness` references `sterile-saline-piercing-care` — **neither keyword file exists** |

---

## 6. Missing affiliate opportunities

### Present

- `amazon-associates` and `brand-direct` program taxonomy
- Product-level `affiliate.available` on NeilMed (true) and H2Ocean (true)
- Brand-level `has_affiliate_opportunity: true` on Steri-Wash
- Keyword clusters tag `affiliate_opportunity: high` where appropriate
- Disclosure requirements documented in affiliate program records

### Missing or incomplete

| Gap | Detail |
|-----|--------|
| **No affiliate link records** | No ASINs, deep links, or regional availability per product (intentionally omitted but blocks publish) |
| **Steri-Wash product record** | No `affiliate` block despite brand-level opportunity |
| **Recovery** | `affiliate.available: unknown` |
| **EasyPiercing / Base Labs** | Explicitly `false` — limits comparison affiliate coverage |
| **Pharmacy generics** | No products = no affiliate mapping for high-intent wound-wash searches |
| **Commission verification** | All programs note "verify from official documentation" — none marked reviewed |
| **Steri-Wash absent from amazon-associates `related_products`** | Brand listed, product not — inconsistent mapping |
| **Hub-safe affiliate pattern** | No content-asset record defining category-context (review links only) affiliate pattern for hub guides |

---

## 7. Missing SEO entities

### Present (saline-direct)

- `best-saline-spray-for-piercings`
- `sterile-saline-vs-sea-salt`
- `neilmed-vs-h2ocean`
- `piercing-aftercare-mist`

### Missing hub and spoke SEO entities

| Expected cluster | Why missing matters |
|------------------|---------------------|
| `sterile-saline-complete-guide` / `what-is-sterile-saline-for-piercings` | No keyword record maps to `pc-hub-sterile-saline-complete-guide` |
| `sterile-saline-aftercare` | Referenced by problem records but **file does not exist** |
| `sterile-saline-piercing-care` | Referenced by `dryness` but **file does not exist** |
| `how-often-saline-piercing-aftercare` | Hub brief requires frequency deferral content; no cluster |
| `sterile-saline-vs-wound-wash` | Wound-wash category without SEO cluster |
| `neilmed-vs-steri-wash` | Direct P1 review pair without comparison cluster |
| `wound-wash-for-piercings` | Pharmacy-intent queries unmapped |

### Broken SEO cross-references

`infection-concern` references five keyword IDs that **do not exist** as files:

- `infected-piercing-signs` (only `infected-piercing` exists)
- `piercing-infection-vs-irritation`
- `when-to-see-doctor-piercing`
- `piercing-discharge-concern`
- `piercing-redness-swelling`

### Status gap

All fifteen keyword files: `review.status: draft`, notes say "Requires keyword research validation before being marked active."

---

## 8. Missing internal linking opportunities

### Present (within Commerce Blueprint)

- `sterile-saline-spray` → 3 products, 2 ingredients, 5 problems
- `saline-spray` → 6 products (includes comparison peers)
- `best-saline-spray-for-piercings` → 6 products, 6 brands, 4 content types
- Problems → consistent trio of saline products (19 records)
- Brands → peer brand lists (NeilMed ↔ H2Ocean ↔ Steri-Wash ↔ Recovery)

### Missing (cross-system and cluster-specific)

| Link type | Gap |
|-----------|-----|
| **Commerce → pc-media-engine content cards** | No mapping from keyword/product IDs to `pc-hub-sterile-saline-complete-guide`, `pc-review-neilmed-fine-mist`, `pc-review-steri-wash-saline` |
| **Hub → comparison articles** | No content-asset linking hub category to `sterile-saline-vs-sea-salt` or `best-saline-spray` clusters |
| **Product review → problem guides** | Product YAML has empty `related_products: []` — no cross-link to `overcleaning`, `undercleaning`, etc. |
| **Recovery / EasyPiercing → hub** | Products exist but not in hub card's primary product list in pc-media-engine (only NeilMed + Steri-Wash on production card) |
| **Wound-wash category → products** | Category lists 3 products; pharmacy generics absent |
| **Published URL slugs** | No canonical URL field on any commerce entity for WordPress internal linking |
| **Broken keyword refs** | Problem records point to non-existent keyword IDs (see §5, §7) — breaks automated link graph |

---

## 9. Missing medical guidance references

### Present (editorial framing in structured data)

- Problem records include `when_to_seek_professional_help`, high-caution language, and diagnosis avoidance
- `infection-concern` cites intended medical sources (IDs only)
- `sodium-chloride-0.9-percent` includes NHS reference ID and APP alignment field
- `standards/evidence-policy.md` defines medical referral and diagnosis rules
- Research markdown links to APP aftercare, troubleshooting, FAQ pages

### Missing (production blockers)

| Reference need | Status |
|----------------|--------|
| **Resolved APP aftercare primary source** | Not stored; hub cannot cite verified APP text |
| **Resolved APP troubleshooting source** | Not stored; problem guides rely on unresolved ID |
| **NHS wound care / infected piercings** | Cited on ingredients and `infection-concern`; no resolved record |
| **Mayo Clinic / Cleveland Clinic** | Cited on `infection-concern`; no resolved record |
| **Usage frequency guidance** | No authoritative record; NeilMed official source unresolved — hub must defer to piercer |
| **Oral piercing saline guidance** | Mentioned in `undercleaning`; no dedicated oral-aftercare + saline cross-record |
| **Pediatric / high-risk piercing medical boundaries** | Evidence policy lists topics; no sterile-saline-specific medical boundary record |
| **Active review on high-risk records** | `infection-concern`, `irritation-bump` remain `draft` despite medical sensitivity |

---

## 10. Readiness score

| Dimension | Weight | Score | Weighted |
|-----------|--------|-------|----------|
| Hub guide support (categories, templates, taxonomy) | 15% | 55% | 8.3% |
| Product review records | 20% | 68% | 13.6% |
| Problem guide records | 15% | 72% | 10.8% |
| Evidence / source resolution | 15% | 25% | 3.8% |
| Comparison data | 5% | 40% | 2.0% |
| Affiliate readiness | 10% | 48% | 4.8% |
| Platform adaptation scaffolding | 10% | 68% | 6.8% |
| SEO entities | 5% | 58% | 2.9% |
| Internal linking graph | 5% | 52% | 2.6% |
| Medical guidance references | 10% | 42% | 4.2% |
| **Total** | **100%** | — | **58%** |

### Score interpretation

| Score band | Meaning |
|------------|---------|
| 0–40% | Skeleton only |
| **41–65%** | **Structured draft — not production-ready** ← current |
| 66–85% | Publishable with targeted gaps |
| 86–100% | Production-ready ecosystem |

### Support matrix vs editorial goals

| Goal | Ready? | Notes |
|------|--------|-------|
| One hub guide | **Partial** | Taxonomy + templates yes; APP source + hub keyword + comparison matrix no |
| Multiple product reviews | **Partial** | NeilMed strong; Steri-Wash thin; Recovery/EasyPiercing incomplete |
| Problem guides | **Mostly** | Rich problem YAML; medical sources unresolved; broken keyword refs |
| Affiliate recommendations | **No** | Taxonomy only; no verified links; several products blocked |
| Platform adaptation | **Partial** | All channel templates exist; all draft; depend on resolved hub/review content |

---

## Minimum work required before the Sterile Saline ecosystem is production-ready.

1. **Create resolved source records** for `app-aftercare`, `app-troubleshooting`, and `app-piercing-faq` with quotable excerpts and URLs; add NHS/Mayo/Cleveland records for `infection-concern` and ingredient evidence — move high-risk records to `review.status: reviewed` or `active`.

2. **Complete Tier-1 product records** for `steri-wash-saline-spray` and `recovery-sterile-saline-wash-7-4oz` (sizes, healing stages, recommended_for, official source notes, affiliate status); fix Recovery ingredient ID to canonical `sterile-water` + `sodium-chloride-0.9-percent`.

3. **Add missing ingredient files** or normalize product YAML to existing ingredient IDs (`water`, `sodium-chloride`, `nitrogen`, Base Labs additives, or alias `sterile-saline`).

4. **Create a structured comparison entity** for Tier-1 sterile saline peers with declared criteria (sterility, NaCl concentration, preservative-free, format, sizes) — unranked, per hub brief; bind to `best-saline-spray-for-piercings` and hub content.

5. **Add hub SEO keyword record** (`sterile-saline-complete-guide` or equivalent) and fix broken keyword references (`sterile-saline-aftercare`, `sterile-saline-piercing-care`, infection-concern related_keywords).

6. **Verify and mark active** at minimum: `sterile-saline-spray` category, `sodium-chloride-0.9-percent` + `sterile-water` ingredients, NeilMed product, and priority problem records (`undercleaning`, `overcleaning`, `infection-concern`).

7. **Map affiliate availability** with verified program status and publishable link placeholders for NeilMed, Steri-Wash, and Recovery; document EasyPiercing/Base Labs exclusion rationale.

8. **Add pharmacy wound-wash product records** (at least one generic sterile saline) to support wound-wash category literacy and comparison content.

9. **Wire internal link graph** from products to problem records, keyword clusters to pc-media-engine content card IDs, and comparison content assets to hub + review cards.

10. **Human review pass** on trust scores and all sterile-saline cluster records before first publish — no cluster record should remain `draft` on go-live paths.

Until items 1, 2, 4, and 6 are complete, the Sterile Saline hub and affiliate-backed reviews should remain in **production brief / draft** status only.
