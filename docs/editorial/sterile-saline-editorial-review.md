# Sterile Saline Cluster — Editorial Review Sprint 001

**Review date:** 2026-07-14  
**Reviewer stance:** Experienced medical / health editor preparing WordPress publication  
**Scope:** Hub + four product reviews (production drafts only)  
**Not in scope:** Evidence re-verification, rewrites, new content, social/fixture paths  

**Files reviewed:**

| Asset | Path |
|-------|------|
| Hub | `content-operations/production/drafts/sterile-saline-complete-guide.md` |
| NeilMed | `content-operations/production/drafts/neilmed-piercing-aftercare-fine-mist.md` |
| Steri-Wash | `content-operations/production/drafts/steri-wash-saline-spray.md` |
| Recovery | `content-operations/production/drafts/recovery-sterile-saline-wash.md` |
| H2Ocean | `content-operations/production/drafts/h2ocean-piercing-aftercare.md` |

---

## Executive summary

The cluster is **medically cautious and evidence-disciplined**—often to a fault. Safety boundaries, SKU-scoped concentration language, and APP vs manufacturer separation are sound. What blocks publication is less clinical accuracy than **editorial packaging**: the drafts still read like internal compliance documents, not finished PiercingConnect articles.

The hub guide is the strongest piece: problem-first, logically ordered, and appropriately educational before product names. The four reviews share a rigid template that creates **predictable repetition** and **link inconsistencies** that will confuse readers moving between articles.

**Editorial readiness (WordPress voice & UX):** ~62%  
**Clinical / safety framing (as written):** ~88%  

These scores are editorial, separate from the production-readiness audit (74%).

---

## Hub guide — editor notes

### What works

- Opens with a real reader problem (DIY salt vs packaged saline), not products.
- “What saline can and cannot do” is clear and appropriately bounded.
- Comparison section uses criteria, not rankings.
- Escalation language avoids diagnosis; symptom examples are reasonable.
- Product examples appear **after** literacy sections, as intended.

### Awkward wording

| Location | Issue |
|----------|--------|
| Title | “Packaged Rinse Literacy” is editorial jargon; readers search “sterile saline piercing aftercare,” not “rinse literacy.” |
| § What Sterile Saline Is | “Per that guidance, ingredients should list…” — stiff; reads like audit prose. |
| § Why 0.9% Matters | “Two evidence layers must stay separate” — correct but abstract; a piercee may not know what an “evidence layer” is. |
| § How to Compare | “Category examples vs comparison peers” — internal taxonomy, not reader language. |
| Throughout | Repeated `(`source_id`)` tags (e.g. `app-aftercare`) break reading flow on a consumer health site. |

### Repetitive sections

- DIY sea-salt caution appears in **§ Sterile Saline vs Homemade**, **§ Common Mistakes**, and implicitly in **§ How Often to Use Saline**.
- APP 0.9% ingredient guidance is restated in **§ What Sterile Saline Is**, **§ Why 0.9% Matters**, **§ How to Compare**, and product bullets.
- Non-diagnosis framing appears in **Editorial Summary**, **§ When to Seek Professional Guidance**, and the closing disclaimer.
- “Not a ranked best-of list” / “no winner” sentiment is stated multiple times.

### Readability issues

- Long compound sentences in the comparison bullets (NeilMed, Steri-Wash, Recovery) will fatigue mobile readers; each bullet is a dense evidence paragraph.
- Hub uses **mL** (NeilMed) and **oz** (Steri-Wash, Recovery) without a brief note that sizes are manufacturer-listed, not converted.
- Internal link syntax `[text](#related-guides-and-reviews) (`pc-card-id`)` is not publish-ready; anchors will not resolve on WordPress.
- **Recovery** and **H2Ocean** are discussed in the body but absent from **Related Guides and Reviews** table—readers hit a dead end after comparison copy.

### Disclaimers (necessary vs excessive)

| Element | Verdict |
|---------|---------|
| “Informational, not medical advice” (Editorial Summary) | **Keep** — one clear statement near top |
| “This section does not diagnose…” (Escalation) | **Keep** — clinically appropriate |
| Full disclaimer paragraph at end of escalation | **Merge** — redundant with opening; one escalation disclaimer is enough |
| Affiliate disclosure | **Keep** — required if links present; currently appropriate in tone |

### CTAs

- **Weak:** “Read reviews after the education and limitations sections” — passive; no named next step for a reader who just learned category basics.
- **Missing:** Direct links to Recovery and H2Ocean reviews (cards now exist: `pc-review-recovery-sterile-saline`, `pc-review-h2ocean-piercing-aftercare`).
- **Missing:** A single “Start here → then choose a review” path in Related Guides.

---

## Product reviews — cross-cluster consistency

### Structural consistency (intentional but heavy)

All four reviews follow the same skeleton: Editorial Summary → Overview table → Verified Formula → APP alignment table → Advantages → Limitations → Who May / Who Should → Alternatives → FAQ → Verdict → Related Guides → Source Notes → Affiliate → Excluded claims → Draft metadata.

**Editorial judgment:** Template consistency aids maintenance but makes the cluster feel **machine-generated**. A reader opening NeilMed after Steri-Wash will encounter near-identical APP intro paragraphs, escalation blocks, and FAQ patterns.

### Consistency gaps (must align before publish)

| Issue | Hub | NeilMed | Steri-Wash | Recovery | H2Ocean |
|-------|-----|---------|------------|----------|---------|
| Recovery review linked | Body only | “Category peer (no dedicated review card)” | “Category peer” | — | `pc-review-recovery-sterile-saline` |
| H2Ocean review linked | Body only | “Name-only comparison” | “Name-only comparison” | “Name-only comparison” | — |
| Related Guides includes Recovery/H2Ocean | **No** | **No** | **No** | Yes | Yes |
| NeilMed water naming | pharmaceutical-grade + Deionized on label | Same | — | — | — |
| APP table intro | N/A | Nearly identical block ×4 | Same | Same | Same |
| FAQ: DIY salt question | N/A | Yes | Yes | Yes | Yes |
| FAQ: irritation/infection | N/A | Yes | Yes | Yes | Yes |

### Concentration wording (evidence-consistent; editorially uneven)

- **Steri-Wash FAQ** opens with “**Yes** for the verified 4.25 oz back label”—accurate but bolder than NeilMed/Recovery hedging. Acceptable if SKU scoping stays visible in the same answer (it does).
- **Recovery** uses heavy technical shorthand (“SDS Section 1 synonym,” “Section 3,” “CoA”)—correct for evidence but **harder for general readers** than Steri-Wash “check the label.”
- **NeilMed Final Verdict** says “not reviewed here as a verified **0.9% isotonic** formulation”—“isotonic” is implied from APP context, not verified on NeilMed label; consider whether “0.9% concentration” alone is clearer for lay readers.

### APP vs manufacturer claims

**Consistent and appropriate** across the cluster:

- APP guidance cited as category standard, not brand endorsement.
- Manufacturer marketing labeled as such (Steri-Wash hospital-grade copy, H2Ocean 3–6× daily, Recovery healing-adjacent marketing).
- “Do not read this table as APP-approved product” appears in each review—**necessary once per review**, but the surrounding APP paragraph is copy-pasted verbatim.

### Affiliate neutrality

- No ranking-for-commission language detected.
- Disclosures are present and appropriately worded.
- **Issue:** Top **and** bottom affiliate notes on every review = duplicate disclosure; WordPress playbook prefers conspicuous disclosure without redundancy. Consolidate to one primary placement per page.

### Duplicate / contradictory statements

| Type | Detail |
|------|--------|
| Contradiction (links) | NeilMed/Steri-Wash say Recovery has no review card; Recovery and H2Ocean cards and drafts exist. |
| Contradiction (hub) | Compare section describes Recovery/H2Ocean; Related Guides omits them. |
| Internal-only content | “Explicitly excluded claims” and “Draft metadata” sections contradict publish-ready status if left on-page. |
| Minor naming | NeilMed: “pharmaceutical-grade water” (pages) vs “Deionized Water” (177 mL label)—both supported, but readers may think these conflict unless briefly explained. |

---

## Must fix before publish

Editorial line-edit / CMS prep—not evidence rewrites.

1. **Remove internal-only blocks from all WordPress-bound versions:** Card ID, draft status, evidence sync dates, `Explicitly excluded claims`, `Draft metadata`, repository file paths in Source Notes, and raw `source_id` parentheticals in body copy (retain in Source Notes for editors if needed).

2. **Fix interlink consistency now that cards exist:**
   - Hub **Related Guides:** add Recovery + H2Ocean review rows.
   - Hub comparison section: add “Deep dive” links for Recovery and H2Ocean (matching NeilMed/Steri-Wash pattern).
   - NeilMed + Steri-Wash **Alternatives** tables: replace “Category peer / Name-only” with `pc-review-recovery-sterile-saline` and `pc-review-h2ocean-piercing-aftercare`.
   - NeilMed + Steri-Wash **Related Guides:** add Recovery and H2Ocean where peer reviews are referenced in verdicts.

3. **Replace placeholder anchors** (`#related-guides`, `#related-guides-and-reviews`) with real WordPress URLs or CMS-internal links before go-live.

4. **Consolidate disclaimers per page:** One early “not medical advice” + one escalation non-diagnosis note; drop duplicate closing disclaimer where it repeats the opening.

5. **Single affiliate disclosure placement** per article (top or bottom—not both full paragraphs unless playbook requires both).

6. **Hub title / H1 for publication:** Replace or subtitle “Packaged Rinse Literacy” with searchable plain language (e.g. “Sterile Saline for Piercing Aftercare: What to Know Before You Buy”).

7. **Steri-Wash purchase clarity:** Any publish-facing copy must make **4.25 oz** the explicit SKU when discussing verified 0.9%; avoid reader assumption that any Steri-Wash can on shelf = 0.9%.

---

## Should improve

1. **Reduce template repetition across reviews:** Shorten the duplicated APP intro paragraph after the hub exists—reviews can say “See the Sterile Saline Complete Guide for APP category guidance” and focus the table on product-specific gaps.

2. **Hub repetition pass:** Merge overlapping DIY / over-cleaning / “saline is not a cure” points; keep one strong section plus a short Common Mistakes list.

3. **Plain-language pass on Recovery review:** Translate “SDS Section 1 synonym” into reader-facing phrasing first, technical detail second (e.g. “manufacturer safety sheet lists the product as ‘Sterile Saline Wound Wash 0.9%’”).

4. **NeilMed water naming:** One sentence reconciling pharmaceutical-grade (marketing) vs deionized (label)—not a contradiction, but readers will ask.

5. **FAQ de-duplication:** Hub should own DIY-vs-packaged and frequency deferral; reviews can link back instead of repeating full APP DIY answers.

6. **Escalation section variation:** Same clinical content, slightly varied prose across reviews to reduce “copy-paste medical site” feel.

7. **Stronger CTAs:** Replace passive “read reviews after education” with specific next steps (“Compare NeilMed, Steri-Wash, and Recovery reviews”).

8. **Related Guides parity:** All five articles should share the same core cross-link set (hub + four reviews + 2–3 safety spokes).

9. **H2Ocean “Who this review does not position it for”** — excellent clarity; consider a similar one-line negative positioning line on baseline saline reviews for symmetry.

---

## Nice to have

1. **Short glossary** (hub sidebar or footnote): isotonic, wound wash, bag-on-valve—one sentence each.

2. **Comparison table at hub level** (criteria-only, no scores)—optional visual aid after literacy sections.

3. **Merge Source Notes** into a cleaner “Sources & references” block without internal YAML paths.

4. **Trim assessment-criteria numbered lists** in reviews for web readers; keep criteria in editor workflow docs instead.

5. **Unit note** in hub product section: “Sizes listed as manufacturers publish them (mL or fl oz).”

6. **Verdict tone polish:** Slightly warmer closing lines while keeping “no healing guarantee.”

---

## Publish recommendation

### Verdict: **Conditional staged publish after editorial line-edit**

Do **not** paste these drafts into WordPress as-is. The clinical guardrails are largely in place, but publication requires a **CMS prep pass** (Must Fix items) before human sign-off.

### Recommended order (unchanged from production audit; editorial layer added)

| Wave | Assets | Editorial gate |
|------|--------|----------------|
| **1** | Hub guide | Line-edit + link table + title + disclaimer trim |
| **2** | NeilMed review | Strip internal blocks + fix alternatives/related links |
| **3** | Steri-Wash review | Same + emphasize 4.25 oz SKU in intro/verdict for shoppers |
| **4** | Recovery review | Plain-language SDS framing + full interlink sync |
| **5** | H2Ocean review | Already clearest on comparison role; sync links only |

### Do not publish until

- [ ] Must Fix items 1–7 complete on each asset in the wave  
- [ ] Medical/safety editor sign-off on escalation + concentration hedging  
- [ ] WordPress URLs assigned; no placeholder anchors  
- [ ] Fixture/social NeilMed paths quarantined from publish workflow (outside this sprint, but blocks adaptations)

### Staged subset acceptable

**Hub → NeilMed → Steri-Wash** may go first if Recovery/H2Ocean links are not promised in hub CTAs until Wave 4–5. If publishing the hub first, **remove or soften** Recovery/H2Ocean comparison bullets until their review URLs exist—or add links in the same release window.

---

## Reviewer sign-off block (for production log)

| Field | Value |
|-------|--------|
| Sprint | Editorial Review 001 |
| Cluster | Sterile Saline |
| Editorial readiness | ~62% (voice/UX) |
| Clinical framing | ~88% (as drafted) |
| Publish without line-edit? | **No** |
| Primary editor concern | Compliance tone overshadows reader experience; stale interlinks |

---

*This document is editorial guidance only. It does not modify draft text, evidence records, or content cards.*
