# Content Cluster — Production Checklist

**Template version:** 1.0  
**Use:** Copy this checklist for each new cluster. Check items as completed. Do not skip gates marked **blocking**.

**Cluster metadata** *(fill in when starting)*

| Field | Value |
|-------|-------|
| Cluster name | `{cluster-name}` |
| Cluster ID / slug | `{cluster-slug}` |
| Revenue roadmap phase | `{phase}` |
| Cluster owner | `{owner}` |
| Target publish window | `{YYYY-MM-DD}` |
| Canonical platform | WordPress |

**Reference docs**

- Workflow: `content-operations/docs/workflow.md`
- Content card schema: `content-operations/schemas/content-card.schema.yaml`
- Editorial style guide: `docs/editorial/piercingconnect-editorial-style-guide.md`
- WordPress playbook: `docs/platforms/wordpress-playbook.md`
- Evidence layer: `references/evidence/README.md`

---

## Evidence

Foundation work before drafting. No article claims beyond what evidence records support.

- [ ] Cluster scope defined (products, problem topics, comparison peers, exclusions)
- [ ] Required evidence records identified (APP, manufacturer, clinical, regulatory as applicable)
- [ ] Evidence YAML files created or updated in `references/evidence/`
- [ ] Each record lists only verified claims with source URLs and capture dates
- [ ] `unsupported_claims` documented for every manufacturer / product with gaps
- [ ] SKU-specific claims scoped to verified SKUs (not line-wide unless verified)
- [ ] APP / professional guidance separated from manufacturer marketing in records
- [ ] Concentration, sterility, and ingredient claims verified per label / SDS / official page
- [ ] Comparison peers classified (category baseline vs non-equivalent peer)
- [ ] Evidence readiness score estimated and recorded in evidence README or cluster notes
- [ ] Evidence sprint complete — no blocking unresolved claims for publish-bound assets
- [ ] Content cards reference correct `source_id` values for fact-check traceability

---

## Knowledge

Verified knowledge layer that drafts must draw from — not invented during production.

- [ ] Commerce product records exist for all affiliate-bearing SKUs in cluster
- [ ] Product IDs mapped to evidence records (`related_products` on cards)
- [ ] Category definitions and terminology agreed (hub vocabulary, reader-facing names)
- [ ] Claim boundaries documented (what the cluster may and may not assert)
- [ ] Escalation / red-flag guidance aligned with APP or clinical sources
- [ ] FAQ seed list derived from verified sources, not search-keyword stuffing
- [ ] Alternatives list defined (in-cluster reviews + out-of-cluster spokes)
- [ ] Stale or contradictory reference paths identified (fixtures, gold-standard, legacy drafts)
- [ ] Knowledge conflicts resolved before Production stage begins
- [ ] Cluster brief written (`content-operations/production/briefs/{cluster-slug}.md`)

---

## Hub Guide

Problem-first canonical hub — produced before product reviews unless parallel production is explicitly documented.

- [ ] Hub content card created (`content_type: hub-category` or `hub-problem`)
- [ ] Card status set to `backlog` then moved to `production` when work starts
- [ ] Hub draft written in `content-operations/production/drafts/`
- [ ] Opens with reader problem, not product names
- [ ] Teaches category literacy before commercial examples
- [ ] “What it can and cannot do” section present with bounded claims
- [ ] Professional guidance cited as category standard, not product endorsement
- [ ] Comparison section uses criteria, not commission-driven rankings
- [ ] Escalation section present — non-diagnostic language verified
- [ ] Limitations and common mistakes included
- [ ] Product examples appear after education sections
- [ ] Affiliate disclosure drafted if commercial links appear
- [ ] Hub brief synced with evidence boundaries
- [ ] Self-check against hub content-type template complete
- [ ] Card `related_articles` updated to match draft intent

---

## Product Reviews

Commercial review articles — one card and draft per product (or comparison unit).

- [ ] Review content card created for each product (`content_type: product-review`)
- [ ] Cards include `affiliate_relevance`, `related_products`, and hub in `related_articles`
- [ ] Each review draft complete per WordPress product-review template
- [ ] Editorial Summary states scope, evidence boundaries, and non-diagnosis framing
- [ ] Product Overview table populated from verified source only
- [ ] Verified Formula section reflects label / SDS / official page — SKU-scoped where required
- [ ] APP alignment table separates guideline context from product approval
- [ ] Potential Advantages grounded in verified attributes, not marketing copy
- [ ] Limitations and Uncertainties section present and honest
- [ ] “Who May Consider It” aligned with “Who Should Seek Professional Guidance” (no contradiction)
- [ ] Alternatives table lists fair in-cluster peers with correct card IDs
- [ ] FAQ answers bounded; no universal schedules or healing guarantees
- [ ] Final Verdict states editorial independence and evidence limits
- [ ] Source Notes cite evidence records; no placeholder URLs
- [ ] Affiliate disclosure drafted (single conspicuous placement planned)
- [ ] Internal-only blocks flagged for CMS strip (card IDs, draft metadata, excluded-claims lists)
- [ ] Card `related_articles` and `related_products` match final draft

---

## Problem Guides

Educational spokes that support the cluster (symptoms, mistakes, decision support).

- [ ] Problem-guide inventory defined for cluster (minimum inbound links for commercial pages)
- [ ] Content card created for each spoke (`content_type: spoke-problem` or `educational-guide`)
- [ ] Each spoke serves a distinct search intent (no duplicate hub coverage)
- [ ] Problem-first framing — no product-first openings on non-commercial spokes
- [ ] Claims limited to verified evidence; escalation paths link to hub or trust pages
- [ ] Spokes link back to hub and relevant reviews where appropriate
- [ ] `related_articles` on hub and reviews include planned spokes
- [ ] Spoke drafts complete or explicitly deferred with documented publish dependency
- [ ] Deferred spokes do not block hub publish if hub does not promise live spoke URLs

---

## Internal Linking

Link graph planned, drafted, verified, and maintained across the cluster.

- [ ] Cluster link map documented (hub ↔ reviews ↔ spokes ↔ trust pages)
- [ ] All target cards exist in backlog or production before draft links are written
- [ ] Hub Related Guides table lists every in-cluster review and key spoke
- [ ] Each review Related Guides lists hub + peer reviews + relevant spokes
- [ ] Alternatives tables use live card IDs — no “category peer (no review card)” stale text
- [ ] Deep-dive links consistent across hub comparison section and review cross-links
- [ ] Minimum inbound non-commercial links planned for each commercial page
- [ ] Orphan check passed — no publish-bound page without hub or spoke inbound path
- [ ] Placeholder anchors (`#related-guides`) replaced with WordPress URLs before publish
- [ ] External links verified (APP, NHS, manufacturer official pages)
- [ ] Link graph re-verified after any card merge, retirement, or URL change

---

## Editorial Review

Human editorial pass — voice, readability, consistency — separate from fact-check.

- [ ] Editorial review sprint scheduled after production drafts complete
- [ ] Review document created (`docs/editorial/{cluster-slug}-editorial-review.md`)
- [ ] Hub reviewed for awkward wording, repetition, and readability
- [ ] All product reviews reviewed for template fatigue and voice consistency
- [ ] Cross-cluster consistency checked (terminology, hedging, CTA parity)
- [ ] Disclaimer stacking assessed — consolidate where redundant
- [ ] CTA strength assessed — passive language flagged
- [ ] Internal metadata strip list confirmed (Must Fix before WordPress)
- [ ] Must Fix / Should Improve / Nice to Have triage recorded
- [ ] Publish recommendation recorded (staged order if applicable)
- [ ] Production readiness audit completed (`docs/audits/{cluster-slug}-production-readiness.md`)
- [ ] Must Fix editorial items resolved or explicitly waived by editorial lead

---

## WordPress Draft

CMS preparation of approved canonical copy — not a substitute for Human Review.

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
- [ ] Staged publish order documented (hub → reviews → spokes if staggered)

---

## Social Packs

Platform adaptations — always downstream of approved canonical WordPress content.

- [ ] Canonical WordPress article approved before social production begins (**blocking**)
- [ ] Social content cards created with `parent_id` pointing to canonical card
- [ ] Platform list confirmed (`instagram`, `x`, `facebook`, `pinterest`, `youtube` as applicable)
- [ ] Each platform draft follows its playbook (`docs/platforms/*-playbook.md`)
- [ ] Social copy contains no claims beyond approved canonical
- [ ] Unsupported canonical hedges preserved (e.g., SKU-scoped concentration language)
- [ ] CTAs point to live or scheduled `canonical_url` — not placeholder paths
- [ ] Affiliate / commercial disclosure included where platform playbook requires
- [ ] Each post/slide accurate if read alone (Human Review platform track)
- [ ] Fixture and seed paths checked for stale claims before any distribution (**blocking**)
- [ ] Social cards moved through Production → Human Review → Scheduled

---

## Human Approval

Required review tracks before scheduling — no public distribution without sign-off.

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

---

## Publish

Execution gates for going live on WordPress and linked platforms.

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

---

## Analytics

Measurement setup at launch — KPIs tied to `business_purpose` on each card.

- [ ] `business_purpose` set on every card (`discover`, `educate`, `compare`, `convert`, `retain`, `maintain-trust`)
- [ ] Primary KPI defined per asset (traffic, engagement, affiliate click, scroll depth, etc.)
- [ ] UTM convention documented for social → canonical attribution
- [ ] Search Console / analytics property confirmed for new URLs
- [ ] Baseline snapshot captured within 7 days of publish
- [ ] Affiliate link tracking verified if commercial content
- [ ] Cluster dashboard or portfolio note updated (`docs/revenue/` or equivalent)
- [ ] Owner assigned for 30-day post-publish review

---

## Quarterly Review

Ongoing maintenance — cluster enters Update Queue on cadence or trigger.

- [ ] `update_frequency` set on all evergreen cards (`semiannual` default for commercial)
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

Complete when the cluster is live and on maintenance cadence.

| Gate | Status | Date | Owner |
|------|--------|------|-------|
| Evidence complete | ☐ | | |
| Knowledge layer ready | ☐ | | |
| Hub guide published | ☐ | | |
| Product reviews published | ☐ | | |
| Problem guides published (or deferred) | ☐ | | |
| Internal linking verified | ☐ | | |
| Editorial review closed | ☐ | | |
| Social packs published (or N/A) | ☐ | | |
| Human approval on file | ☐ | | |
| Analytics baseline captured | ☐ | | |
| Quarterly review scheduled | ☐ | | |

---

*PiercingConnect Content Operations — Cluster Checklist v1.0*
