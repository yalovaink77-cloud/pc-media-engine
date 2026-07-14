# Draft Brief: Sterile Saline Complete Guide

**Card ID:** `pc-hub-sterile-saline-complete-guide`  
**Status:** production  
**Content type:** hub-category (problem-first evergreen guide—not a product review)  
**Pillar:** product-education  
**Owner:** editorial-lead  
**WordPress role:** Canonical category hub for sterile saline literacy

---

## Reader problem

Readers starting piercing aftercare often confuse homemade salt water with packaged sterile saline. They need clear category literacy—what sterile saline is, why concentration and sterility matter, how it fits routine care, what it cannot do, and when to seek professional help—before comparing or purchasing any product.

---

## Primary search intent

**discover-category** — understand packaged sterile saline as a piercing aftercare rinse category.

## Secondary search intents

- Learn sterile saline vs. homemade salt water / DIY mixes.
- Understand why 0.9% sodium chloride (isotonic) is relevant to wound-care rinse guidance.
- Learn how saline fits routine aftercare without guaranteed outcomes.
- Find frequency guidance framed as “follow your piercer,” not universal medical instructions.
- Avoid common aftercare mistakes involving cleaning products and DIY mixes.
- Know when to seek professional guidance.
- Compare packaged sterile saline products neutrally before reading individual reviews.

---

## Article promise

Within the first sections, the reader will know:

1. What packaged sterile saline is (and is not).
2. Why professional aftercare guidance prefers packaged sterile saline over DIY salt mixes—where that preference is evidenced.
3. What saline may help with (cleanliness/moisture context) versus what it cannot guarantee (healing speed, infection prevention, universal suitability).
4. How to use frequency language safely (defer to piercer/healthcare provider; do not invent schedules).
5. How to compare category peers without a promotional ranking.
6. Where to go next among PiercingConnect P1 guides and reviews.

This is informational guidance, not medical advice or individualized treatment.

---

## Evidence boundaries

Separate these layers clearly in the finished article:

| Layer | May state | Must not imply |
|-------|-----------|----------------|
| **Professional guidance (APP-aligned)** | Preference for packaged sterile saline with 0.9% sodium chloride for piercing wound-care rinse context; avoid hypertonic / DIY salt mixes that may irritate—**only where supported by verified APP-aligned source records at production time** | That APP endorses any brand; that guidance guarantees healing |
| **Manufacturer information** | That sterile saline sprays *may* help maintain cleanliness and moisture—labeled as manufacturer-facing language | Independent clinical proof of faster healing or fewer complications |
| **Verified product category facts** | Product examples as category members only when source records exist; attribute only supported claims (e.g., NeilMed: water + sodium chloride, preservative-free, sterile fine mist—**not** verified 0.9%; Steri-Wash 0.9% USP NaCl **4.25 oz only**; Recovery 7.4 oz 0.9% **from SDS synonym only**) | Superiority claims, invented sizes, frequencies, prices, or cross-SKU concentration inference |
| **Editorial synthesis** | Plain-language explanation of isotonic rinse purpose and DIY control problems (sterility + concentration) | New medical claims or unattributed “studies show” language |

**Source inventory available in-repo today (Evidence Sprint 2, 2026-07-14 — do not invent beyond this without new verified records):**

| source_id | File | Production role |
|-----------|------|-----------------|
| `app-aftercare` | `references/evidence/app-aftercare.yaml` | Primary professional aftercare guidance (wound-wash saline, 0.9% ingredient framing, DIY/harsh-product caution) |
| `official-neilmed` | `references/evidence/official-neilmed.yaml` | NeilMed Piercing Aftercare official claims; **0.9% unresolved** |
| `official-steri-wash` | `references/evidence/official-steri-wash.yaml` | Steri-Wash official claims; **0.9% verified for 4.25 oz label only** |
| `official-recovery-aftercare` | `references/evidence/official-recovery-aftercare.yaml` | Recovery 7.4 oz official claims; **0.9% supported via SDS synonym** |
| `official-h2ocean` | `references/evidence/official-h2ocean.yaml` | Comparison peer (sea salt + lysozyme + citrate)—**not** APP-baseline equivalent |
| `official-base-laboratories` | `references/evidence/official-base-laboratories.yaml` | Comparison peer (multi-additive)—**not** APP-baseline equivalent; **0.9% unresolved** |

Secondary / do-not-override notes: gold-standard and fixture NeilMed drafts under `packages/pilot-piercingconnect/` may still state NeilMed 0.9% NaCl; **evidence YAML controls production claims**—do not reintroduce unverified NeilMed concentration from those files.

**Unresolved at brief time:** see “Unresolved evidence or source gaps” below. Production draft must not fill gaps with invented citations.

---

## Required sections (WordPress H2 outline)

Problem-first guide structure (WordPress playbook: problem → context → safe boundaries → escalation → sources → disclosure if commercial links):

1. **Editorial Summary** — why the reader is here; scope; not medical advice.
2. **What Sterile Saline Is** — packaged sterile isotonic rinse category; plain definition.
3. **Why 0.9% Sodium Chloride Matters** — isotonic concept; professional guidance for wound washing (evidence-tiered).
4. **Sterile Saline vs. Homemade Salt Water** — sterility + concentration control; DIY irritation risk framing.
5. **How Saline Fits Routine Piercing Aftercare** — rinse role within aftercare; location/stage variation acknowledgment.
6. **What Saline Can and Cannot Do** — manufacturer “may” benefits vs. non-guarantees (no compensation for poor placement, jewelry, hygiene, incorrect practice).
7. **How Often to Use Saline** — **no universal medical schedule**; defer to piercer/label/provider; note when frequency is unspecified on product materials.
8. **Common Mistakes** — DIY mixes, harsh cleaners, over-cleaning, treating saline as a cure.
9. **When to Seek Professional Guidance** — escalation triggers; normal early signs vs. concerning (informational, non-diagnostic).
10. **How to Compare Packaged Sterile Saline Products** — declared criteria only (sterility labeling, NaCl %, format spray/wash, preservatives, piercer advice)—**no ranked “winner.”**
11. **Related Guides and Reviews** — internal links to P1 cards (below).
12. **Source Notes** — named verified records only.
13. **Affiliate Disclosure** — if any affiliate links appear on the published page.

Optional FAQ only if answers stay substantive and within evidence (e.g., DIY vs. packaged; frequency deferral).

---

## Medical and safety limits

- Publish **information and general guidance**, not diagnosis or treatment plans.
- Do **not** invent usage frequency (e.g., “1–2 times daily”) unless a verified source record states it.
- Do **not** claim saline prevents infection, shortens healing, or suits every piercing/person.
- Do **not** instruct readers to ignore worsening redness, swelling, discharge, pain, fever, or jewelry problems.
- Include clear **escalation**: when to contact a professional piercer or healthcare provider.
- State that content is **not a substitute for professional medical advice**.
- Keep terminology precise (irritation ≠ infection); link out to dedicated distinction content rather than overloading this hub.

---

## Internal links to other P1 cards

Link using card IDs / eventual canonical URLs when published. Relationships required by this brief:

| Link to | Card ID | Why |
|---------|---------|-----|
| NeilMed Fine Mist Review | `pc-review-neilmed-fine-mist` | Category peer example / deep dive after literacy |
| Steri-Wash Saline Review | `pc-review-steri-wash-saline` | Category peer example / deep dive after literacy |
| Common Aftercare Mistakes | `pc-guide-common-aftercare-mistakes` | DIY/over-cleaning mistake cluster |
| Piercing Healing Timeline | `pc-guide-piercing-healing-timeline` | Stage context without false timelines |
| Sleeping With a New Piercing | `pc-spoke-sleeping-with-new-piercing` | Practical aftercare spoke (pressure vs. rinse) |

**Recommended additional P1 links (safety depth; not on current card `related_articles` but editorial-compatible):**

| Link to | Card ID | Why |
|---------|---------|-----|
| Infection vs. Irritation | `pc-guide-infection-vs-irritation` | Symptom literacy; non-diagnostic |
| Piercing Bump Safe Care | `pc-spoke-piercing-bump-safe-care` | Complication anxiety without product pitch |

Do not invent URLs. Use placeholders in draft until WordPress paths exist.

---

## Natural affiliate opportunities

Affiliate remains **secondary** (`affiliate_relevance: category-context`):

- After education + limitations + comparison criteria, offer optional links to **canonical PiercingConnect product reviews** (not “buy now”).
- Disclose plainly if commission may be earned from qualifying purchases via links on the page; editorial independence stated.
- Never interrupt safety/escalation sections with commercial CTAs.
- No urgency, scarcity, or ranking-for-commission.

---

## Products that may be mentioned without forcing a recommendation

Mention only as **category examples**, not winners:

| Product | Mention allowed when | Condition |
|---------|----------------------|-----------|
| NeilMed Piercing Aftercare Fine Mist | Illustrate packaged sterile mist (water + sodium chloride; preservative-free / sterile / vegan per `official-neilmed`) | **Do not state 0.9% NaCl** — unresolved on official piercing SKU label/pages. Point to review card for depth. |
| Steri-Wash Saline Spray / Wash | Named peer in sterile saline spray category (`official-steri-wash`) | State **0.9% USP NaCl / isotonic only for the verified 4.25 oz SKU label**. Do not extrapolate 0.9% to 3 oz or 8 oz. Do not use “.09%” wholesale page copy as concentration evidence. |
| Recovery Sterile Saline Wash | Named peer; 7.4 oz (MED-637) specs from `official-recovery-aftercare` | State **0.9% only from verified 7.4 oz SDS synonym** (“Sterile Saline Wound Wash 0.9%”). Do not invent CoA composition or attribute Purified Saline Wash 1.5 oz/4 oz MSDS to the 7.4 oz SKU. |
| H2Ocean Piercing Aftercare Spray | Comparison peer only (`official-h2ocean`) | Sea salt + lysozyme + sodium citrate formula. **Not** APP-aligned sterile 0.9% NaCl baseline equivalent. |
| Base Laboratories Piercing Aftercare Spray | Comparison peer only (`official-base-laboratories`) | USP water + NaCl plus additives. **Not** APP-aligned two-ingredient baseline; **0.9% unresolved**. |
| EasyPiercing Saline Solution | Name-only peer (optional) | **Unresolved** — no dedicated verified evidence record in-repo; **no formula, size, concentration, or stage claims**. |

No recommendation hierarchy. Criteria-first comparison language only.

---

## Required source types

Before publishing, Source Notes must cite consulted records of these types:

1. **Professional association / APP-aligned aftercare guidance** on packaged sterile saline and DIY caution (primary or verified resolved APP-aligned record).
2. **Ingredient / concentration evidence** supporting 0.9% sodium chloride isotonic wound-wash framing.
3. **Product official records** for any product named with formula, size, or use-stage claims.
4. Clear labeling of **manufacturer materials** vs. **professional guidance** when both appear.

Do not invent URLs, study citations, or quote primary APP pages that were not consulted.

---

## Human review checklist

- [ ] Problem-first opening; category literacy before product mentions.
- [ ] Evidence layers separated (guidance vs. manufacturer vs. verified product facts).
- [ ] No guaranteed healing, infection prevention, or universal suitability claims.
- [ ] No invented frequency, prices, URLs, or citations.
- [ ] Escalation guidance present; not medical advice disclaimer present.
- [ ] Comparison section unranked; declared criteria only.
- [ ] Internal links to required P1 cards present (or documented if target unpublished).
- [ ] Affiliate disclosure present if and only if commission links exist; disclosure plain and conspicuous.
- [ ] Limitations and “cannot do” section not contradicted by earlier benefit language.
- [ ] Safety review completed (health-adjacent).
- [ ] Fact-check against verified source inventory; gaps unresolved → revise, do not invent.
- [ ] Final human approval recorded before publish (WordPress remains draft until approved).

---

## WordPress-specific content requirements

Per WordPress Editorial Playbook + Editorial Style Guide:

- One canonical, undated evergreen URL for this topic.
- Accurate, non-clickbait title and meta description matching scope.
- H1 = page title; H2s match required sections above.
- Editorial Summary + early sections establish trust within first ~30 seconds of reading.
- Teach category context before any product specifications or affiliate links.
- Source Notes and Affiliate Disclosure (if needed) visible; no placeholder sources.
- Publish status stays **draft** until human approval.
- Primary CTA: informed understanding and links to related guides/reviews—not purchase-first.
- Platform adaptations deferred until this canonical article is approved (out of scope for this brief).

---

## Out of scope for this production pass

- Full article draft body.
- Social, YouTube, Pinterest, Facebook, or X adaptations.
- Ranked product lists or “best saline” framing.
- New product SKUs without commerce source records.

---

## Unresolved evidence or source gaps

Synced to Evidence Sprint 2 (2026-07-14). Items below remain **explicitly unresolved** for production claims. (APP aftercare, Steri-Wash official record, and Recovery 7.4 oz technical docs are **resolved** at source-record level—see Source inventory above—and must not be re-listed as missing.)

Still unresolved / blocked for attribution:

1. **NeilMed Piercing Aftercare 0.9% NaCl** — unresolved (`neilmed-nacl-0.9-percent`). Official pages and 177 mL back label show water + sodium chloride without concentration; do not attribute WoundWash 9 mg/mL to this SKU.
2. **NeilMed explicit “drug-free” label** — unresolved (`neilmed-drug-free-label`) on pages/label consulted.
3. **Steri-Wash 0.9% across 3 oz / 8 oz / full line** — unresolved (`steri-wash-nacl-0.9-percent`). Verified 0.9% USP NaCl applies to **4.25 oz label only**.
4. **Steri-Wash “.09%” wholesale marketing copy as 0.9% proof** — unresolved (`steri-wash-4-25-page-dot-09-text`); use back label evidence instead.
5. **Recovery 7.4 oz SDS Section 3 ingredient % table** — unresolved (`recovery-ingredient-decomposition`); 0.9% is supported via SDS synonym only.
6. **Recovery 7.4 oz Certificate of Analysis composition text** — unresolved (`recovery-coa-composition-text`); CoA PDF linked but composition text not verified.
7. **Base Laboratories 0.9% NaCl** — unresolved (`base-labs-nacl-0.9-percent`).
8. **EasyPiercing Saline Solution** — unresolved; no dedicated verified evidence YAML in-repo—**name only**, no specs.
9. **Universal usage frequency** (e.g., exactly 1–2 times daily for all piercings) — unresolved across `app-aftercare` and manufacturer IFUs consulted; defer to piercer/label/provider; do not invent schedules.
10. **Sibling commerce repo product files** — not available inside this monorepo inspection scope; expand commercial peer claims only when additional verified records exist.

Until remaining gaps close: write the educational hub using only verified, evidence-tiered language from the Source inventory; keep concentration and formula claims SKU-scoped as documented above.
