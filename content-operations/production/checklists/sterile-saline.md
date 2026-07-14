# Sterile Saline Cluster — Production Checklist

**Template version:** 1.0 (applied)  
**Assessed:** 2026-07-14  
**Based on:** Evidence Sprint 2, production drafts, P1 cards, editorial review Sprint 001, production-readiness audit (74%)

**Cluster metadata**

| Field | Value |
|-------|-------|
| Cluster name | Sterile Saline |
| Cluster ID / slug | `saline-category-literacy` (hub) / `sterile-saline-sprays` (reviews) |
| Revenue roadmap phase | Category hub + Tier-1 reviews (Roadmap M2 / weeks 13–20) |
| Cluster owner | editorial-lead |
| Target publish window | Not assigned |
| Canonical platform | WordPress |
| Portfolio status | in-production (`docs/revenue/cluster-portfolio.md`) |

**Reference artifacts**

| Artifact | Path |
|----------|------|
| Hub card | `content-operations/production/sterile-saline-complete-guide.yaml` |
| Hub brief | `content-operations/production/briefs/sterile-saline-complete-guide.md` |
| Production drafts | `content-operations/production/drafts/` (hub + 4 reviews) |
| Review cards | `content-operations/backlog/P1/*` (NeilMed, Steri-Wash, Recovery, H2Ocean) |
| Evidence | `references/evidence/` (readiness **84%**) |
| Editorial review | `docs/editorial/sterile-saline-editorial-review.md` |
| Production audit | `docs/audits/sterile-saline-production-readiness.md` (**74%**) |

---

## Evidence

- [x] Cluster scope defined (products, problem topics, comparison peers, exclusions)
- [x] Required evidence records identified (APP, manufacturer, clinical, regulatory as applicable)
- [x] Evidence YAML files created or updated in `references/evidence/`
- [x] Each record lists only verified claims with source URLs and capture dates
- [x] `unsupported_claims` documented for every manufacturer / product with gaps
- [x] SKU-specific claims scoped to verified SKUs (not line-wide unless verified)
- [x] APP / professional guidance separated from manufacturer marketing in records
- [x] Concentration, sterility, and ingredient claims verified per label / SDS / official page
- [x] Comparison peers classified (category baseline vs non-equivalent peer)
- [x] Evidence readiness score estimated and recorded in evidence README or cluster notes
- [x] Evidence sprint complete — no blocking unresolved claims for publish-bound assets
- [ ] Content cards reference correct `source_id` values for fact-check traceability

*Note: Drafts cite `source_id` thoroughly. Hub + NeilMed/Steri-Wash cards do not yet list evidence `source_id`s in card notes (Recovery/H2Ocean notes do).*

---

## Knowledge

- [x] Commerce product records exist for all affiliate-bearing SKUs in cluster
- [x] Product IDs mapped to evidence records (`related_products` on cards)
- [x] Category definitions and terminology agreed (hub vocabulary, reader-facing names)
- [x] Claim boundaries documented (what the cluster may and may not assert)
- [x] Escalation / red-flag guidance aligned with APP or clinical sources
- [x] FAQ seed list derived from verified sources, not search-keyword stuffing
- [x] Alternatives list defined (in-cluster reviews + out-of-cluster spokes)
- [x] Stale or contradictory reference paths identified (fixtures, gold-standard, legacy drafts)
- [ ] Knowledge conflicts resolved before Production stage begins
- [x] Cluster brief written (`content-operations/production/briefs/sterile-saline-complete-guide.md`)

*Note: Gold-standard NeilMed synced; fixture + social NeilMed still assert unsupported 0.9% / drug-free / isotonic product claims. Commerce Steri-Wash/Recovery records remain thin per cluster audit.*

---

## Hub Guide

- [x] Hub content card created (`content_type: hub-category` or `hub-problem`)
- [x] Card status set to `backlog` then moved to `production` when work starts
- [x] Hub draft written in `content-operations/production/drafts/`
- [x] Opens with reader problem, not product names
- [x] Teaches category literacy before commercial examples
- [x] “What it can and cannot do” section present with bounded claims
- [x] Professional guidance cited as category standard, not product endorsement
- [x] Comparison section uses criteria, not commission-driven rankings
- [x] Escalation section present — non-diagnostic language verified
- [x] Limitations and common mistakes included
- [x] Product examples appear after education sections
- [x] Affiliate disclosure drafted if commercial links appear
- [x] Hub brief synced with evidence boundaries
- [ ] Self-check against hub content-type template complete
- [ ] Card `related_articles` updated to match draft intent

*Note: Hub draft discusses Recovery + H2Ocean; card `related_articles` and Related Guides table omit `pc-review-recovery-sterile-saline` and `pc-review-h2ocean-piercing-aftercare`. Editorial Must Fix (title/jargon, metadata strip) still open.*

---

## Product Reviews

- [x] Review content card created for each product (`content_type: product-review`)
- [x] Cards include `affiliate_relevance`, `related_products`, and hub in `related_articles`
- [x] Each review draft complete per WordPress product-review template
- [x] Editorial Summary states scope, evidence boundaries, and non-diagnosis framing
- [x] Product Overview table populated from verified source only
- [x] Verified Formula section reflects label / SDS / official page — SKU-scoped where required
- [x] APP alignment table separates guideline context from product approval
- [x] Potential Advantages grounded in verified attributes, not marketing copy
- [x] Limitations and Uncertainties section present and honest
- [x] “Who May Consider It” aligned with “Who Should Seek Professional Guidance” (no contradiction)
- [ ] Alternatives table lists fair in-cluster peers with correct card IDs
- [x] FAQ answers bounded; no universal schedules or healing guarantees
- [x] Final Verdict states editorial independence and evidence limits
- [x] Source Notes cite evidence records; no placeholder URLs
- [ ] Affiliate disclosure drafted (single conspicuous placement planned)
- [x] Internal-only blocks flagged for CMS strip (card IDs, draft metadata, excluded-claims lists)
- [ ] Card `related_articles` and `related_products` match final draft

*Note: NeilMed/Steri-Wash (and Recovery→H2Ocean) alternatives still say “Category peer (no dedicated review card)” / “Name-only comparison” despite live cards. Disclosures appear top + bottom. Review cards remain `status: backlog`.*

---

## Problem Guides

- [x] Problem-guide inventory defined for cluster (minimum inbound links for commercial pages)
- [x] Content card created for each spoke (`content_type: spoke-problem` or `educational-guide`)
- [x] Each spoke serves a distinct search intent (no duplicate hub coverage)
- [ ] Problem-first framing — no product-first openings on non-commercial spokes
- [ ] Claims limited to verified evidence; escalation paths link to hub or trust pages
- [ ] Spokes link back to hub and relevant reviews where appropriate
- [x] `related_articles` on hub and reviews include planned spokes
- [x] Spoke drafts complete or explicitly deferred with documented publish dependency
- [x] Deferred spokes do not block hub publish if hub does not promise live spoke URLs

*Note: Spoke cards in backlog (e.g. common aftercare mistakes, healing timeline, infection vs irritation, sleeping, piercing bump). No spoke production drafts under `content-operations/production/drafts/`. Deferral documented in production-readiness audit.*

---

## Internal Linking

- [x] Cluster link map documented (hub ↔ reviews ↔ spokes ↔ trust pages)
- [x] All target cards exist in backlog or production before draft links are written
- [ ] Hub Related Guides table lists every in-cluster review and key spoke
- [ ] Each review Related Guides lists hub + peer reviews + relevant spokes
- [ ] Alternatives tables use live card IDs — no “category peer (no review card)” stale text
- [ ] Deep-dive links consistent across hub comparison section and review cross-links
- [x] Minimum inbound non-commercial links planned for each commercial page
- [ ] Orphan check passed — no publish-bound page without hub or spoke inbound path
- [ ] Placeholder anchors (`#related-guides`) replaced with WordPress URLs before publish
- [x] External links verified (APP, NHS, manufacturer official pages)
- [ ] Link graph re-verified after any card merge, retirement, or URL change

*Note: Cards exist for Recovery/H2Ocean; draft link tables not synced after card creation. WordPress URLs not assigned.*

---

## Editorial Review

- [x] Editorial review sprint scheduled after production drafts complete
- [x] Review document created (`docs/editorial/sterile-saline-editorial-review.md`)
- [x] Hub reviewed for awkward wording, repetition, and readability
- [x] All product reviews reviewed for template fatigue and voice consistency
- [x] Cross-cluster consistency checked (terminology, hedging, CTA parity)
- [x] Disclaimer stacking assessed — consolidate where redundant
- [x] CTA strength assessed — passive language flagged
- [x] Internal metadata strip list confirmed (Must Fix before WordPress)
- [x] Must Fix / Should Improve / Nice to Have triage recorded
- [x] Publish recommendation recorded (staged order if applicable)
- [x] Production readiness audit completed (`docs/audits/sterile-saline-production-readiness.md`)
- [ ] Must Fix editorial items resolved or explicitly waived by editorial lead

---

## WordPress Draft

- [ ] Publish-facing title and H1 confirmed (search-friendly, accurate, not internal jargon)
- [ ] Meta description drafted per WordPress playbook
- [ ] Internal-only blocks removed (card IDs, draft status, excluded-claims, repo paths, raw `source_id` tags in body)
- [ ] Heading hierarchy validated (single H1, logical H2/H3)
- [ ] Affiliate disclosure placed once, conspicuous per playbook
- [ ] Source Notes formatted for reader-facing “Sources & references”
- [ ] Featured image selected or placeholder assigned
- [ ] Categories / tags assigned per site taxonomy
- [ ] Slug assigned and recorded on content card (`canonical_url` path segment)
- [ ] WordPress draft post created — status remains **draft**
- [ ] Preview link shared with reviewers
- [x] Staged publish order documented (hub → reviews → spokes if staggered)

*Note: Staging order documented in editorial review + production-readiness audit. No CMS packaging started.*

---

## Social Packs

- [ ] Canonical WordPress article approved before social production begins (**blocking**)
- [ ] Social content cards created with `parent_id` pointing to canonical card
- [ ] Platform list confirmed (`instagram`, `x`, `facebook`, `pinterest`, `youtube` as applicable)
- [ ] Each platform draft follows its playbook (`docs/platforms/*-playbook.md`)
- [ ] Social copy contains no claims beyond approved canonical
- [ ] Unsupported canonical hedges preserved (e.g., SKU-scoped concentration language)
- [ ] CTAs point to live or scheduled `canonical_url` — not placeholder paths
- [ ] Affiliate / commercial disclosure included where platform playbook requires
- [ ] Each post/slide accurate if read alone (Human Review platform track)
- [x] Fixture and seed paths checked for stale claims before any distribution (**blocking**)
- [ ] Social cards moved through Production → Human Review → Scheduled

*Note: NeilMed social seeds exist under `packages/pilot-piercingconnect/content/social/neilmed/` and still assert unsupported 0.9% / drug-free / isotonic product claims. Checked and flagged; not quarantined/synced. No social content cards. Do not distribute.*

---

## Human Approval

- [ ] Structural review complete (template, sections, heading order)
- [ ] Editorial review complete (voice, readability, CTAs)
- [ ] Fact-check complete (every factual claim traced to evidence record)
- [ ] Safety review complete for health-adjacent content (**blocking**)
- [ ] Commercial review complete for affiliate-bearing content (independence, suitability)
- [ ] Platform review complete for each social adaptation
- [ ] All review tracks recorded with reviewer name and date on card `notes`
- [ ] Revisions returned to Production if any track fails — no partial approval
- [ ] Hard blocks cleared: no placeholders, no missing disclosure, no healing guarantees
- [ ] Cards moved to `human-review` then approved to `scheduled`
- [ ] `last_reviewed_date` set on each approved card

*Note: Editorial Review Sprint 001 is an AI editorial diagnosis document — not human sign-off. Card statuses remain `production` (hub) / `backlog` (reviews).*

---

## Publish

- [ ] `scheduled_publish_date` set on all cards in release wave
- [ ] Pre-publish checklist complete per `content-operations/docs/workflow.md`
- [ ] Internal links verified against live or same-day scheduled targets
- [ ] Disclosure visible on all commercial pages in preview
- [ ] Hub published first when staged release applies
- [ ] Product reviews published per staged order — no promised links to unpublished URLs
- [ ] Problem guides published or hub copy adjusted to match live link graph
- [ ] `canonical_url` populated on each published card
- [ ] Card status updated to `published`
- [ ] Social adaptations published within operational week of canonical (or stagger documented)
- [ ] Gold-standard / reference paths synced to published canonical if applicable
- [ ] Post-publish smoke check: links, disclosure, title, and escalation sections render correctly

*Note: Gold-standard NeilMed path synchronized to production draft for claim safety; not yet synced to a published canonical.*

---

## Analytics

- [x] `business_purpose` set on every card (`discover`, `educate`, `compare`, `convert`, `retain`, `maintain-trust`)
- [ ] Primary KPI defined per asset (traffic, engagement, affiliate click, scroll depth, etc.)
- [ ] UTM convention documented for social → canonical attribution
- [ ] Search Console / analytics property confirmed for new URLs
- [ ] Baseline snapshot captured within 7 days of publish
- [ ] Affiliate link tracking verified if commercial content
- [x] Cluster dashboard or portfolio note updated (`docs/revenue/` or equivalent)
- [ ] Owner assigned for 30-day post-publish review

---

## Quarterly Review

- [x] `update_frequency` set on all evergreen cards (`semiannual` default for commercial)
- [ ] `next_review_due` calculated from `last_reviewed_date`
- [ ] Quarterly cluster review scheduled on content operations calendar
- [ ] Evidence records re-checked for label, formulation, or guidance changes
- [ ] Manufacturer marketing copy changes assessed for draft impact
- [ ] Broken internal and external links audited
- [ ] Card status vs live site reconciled (no drift between repo and WordPress)
- [ ] Social adaptations checked for parent canonical drift
- [ ] KPI anomalies investigated (traffic drop, affiliate conversion change)
- [ ] Update Queue items prioritized: safety → formulation → guidance → commercial → SEO
- [ ] Material updates returned through Human Review before re-publish
- [ ] Quarterly review outcome recorded (no change / update scoped / retirement candidate)
- [ ] Retirement or merge path documented if asset is obsolete

---

## Cluster sign-off

| Gate | Status | Date | Owner |
|------|--------|------|-------|
| Evidence complete | ☑ (layer ready with documented gaps) | 2026-07-14 | editorial-lead |
| Knowledge layer ready | ☐ (fixture/social conflict open) | | |
| Hub guide published | ☐ | | |
| Product reviews published | ☐ | | |
| Problem guides published (or deferred) | ☑ deferred documented | 2026-07-14 | editorial-lead |
| Internal linking verified | ☐ | | |
| Editorial review closed | ☐ (Must Fix open) | | |
| Social packs published (or N/A) | ☐ blocked | | |
| Human approval on file | ☐ | | |
| Analytics baseline captured | ☐ | | |
| Quarterly review scheduled | ☐ | | |

---

## Completion summary

### Completion percentage

| Section | Done | Total | % |
|---------|-----:|------:|--:|
| Evidence | 11 | 12 | 92% |
| Knowledge | 9 | 10 | 90% |
| Hub Guide | 13 | 15 | 87% |
| Product Reviews | 14 | 17 | 82% |
| Problem Guides | 6 | 9 | 67% |
| Internal Linking | 4 | 11 | 36% |
| Editorial Review | 11 | 12 | 92% |
| WordPress Draft | 1 | 12 | 8% |
| Social Packs | 1 | 11 | 9% |
| Human Approval | 0 | 11 | 0% |
| Publish | 0 | 12 | 0% |
| Analytics | 2 | 8 | 25% |
| Quarterly Review | 1 | 13 | 8% |
| **Cluster total** | **73** | **153** | **48%** |

### Remaining work

**Blocking (before any WordPress publish):**

1. Sync interlinks — hub Related Guides + NeilMed/Steri-Wash/Recovery alternatives to Recovery/H2Ocean card IDs; update card `related_articles`.
2. Resolve editorial Must Fix — strip internal metadata; retitle hub; consolidate disclosures/disclaimers; replace placeholder anchors with WordPress paths when assigned.
3. Human approval tracks — structural, editorial sign-off, fact-check, safety (**blocking**), commercial for affiliate assets.
4. Promote review cards from `backlog` → `human-review` → `scheduled` after approval; assign `canonical_url` path segments.
5. Create WordPress drafts (CMS) for Hub → NeilMed → Steri-Wash (minimum staged wave).

**Blocking (before any social / adaptation distribute):**

6. Quarantine or rematch NeilMed social seeds + fixture (`packages/pilot-piercingconnect/content/social/neilmed/*`, fixture review) to Evidence Layer / approved canonical.
7. Create social content cards with `parent_id` only after canonical WordPress approval.

**Deferred / non-blocking for staged hub wave:**

8. Spoke production drafts (mistakes, timeline, infection vs irritation, etc.) — deferred with placeholders.
9. Evidence cards `source_id` notes on hub/NeilMed/Steri-Wash cards.
10. Analytics KPIs, UTM, Search Console, 30-day owner — pre-launch setup after URLs exist.
11. `next_review_due` + quarterly calendar after `last_reviewed_date` is set.

### Publish recommendation

**Do not publish.** Cluster checklist **48%** complete; production packaging audit **74%**; evidence layer **84%**.

**Next gate:** Complete interlink sync + CMS/editorial Must Fix, then enter Human Review.

**Staged path (after remaining blocking items):**

1. Hub guide  
2. NeilMed review  
3. Steri-Wash review  
4. Recovery review  
5. H2Ocean review  
6. Spokes as drafted  

**Social:** Hold until canonical approval and seed quarantine.  
**Verdict:** Ready for human review preparation — **not** ready for WordPress go-live.

---

*Applied from `content-operations/templates/cluster-checklist.md` v1.0 — Sterile Saline cluster only.*
