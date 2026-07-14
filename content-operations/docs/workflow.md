# PiercingConnect Content Operations Workflow

**Version:** 1.0  
**Status:** Operational workflow standard  
**Scope:** Lifecycle management for evergreen, commercial, news, and social content

This document defines status stages, transition rules, roles, and gates for content cards. It is subordinate to the PiercingConnect Editorial Style Guide and Revenue Roadmap v1.

---

## Overview

Every PiercingConnect asset is tracked by one **content card** (`schemas/content-card.schema.yaml`). Cards move through seven lifecycle stages. Transitions are forward-only except for explicit returns to **Production** or **Update Queue**.

```
Backlog → Production → Human Review → Scheduled → Published
                                              ↓
                                        Update Queue → Production (revision)
                                              ↓
                                          Retirement
```

Social and video adaptations follow the same stages but may not enter **Scheduled** until their parent canonical card is **Published**.

---

## Lifecycle stages

### 1. Backlog

**Definition:** The asset is approved for production but not yet started.

**Entry criteria:**
- Problem statement or business purpose documented in `notes`.
- `pillar`, `search_intent`, and `content_class` assigned.
- `priority` set relative to Revenue Roadmap phase.
- `owner` assigned.

**Exit criteria (→ Production):**
- Verified source record available (commerce product, guidance reference, or canonical parent for adaptations).
- Required `related_articles` hub dependencies identified.
- For commercial content: parent category hub or problem hub exists or is in parallel production with explicit note.

**Owner actions:**
- Confirm cluster fit against Evergreen Content Master Plan.
- Confirm affiliate relevance classification is accurate.
- Link upstream roadmap milestone if applicable.

---

### 2. Production

**Definition:** Drafting the canonical article or platform adaptation from verified sources.

**Entry criteria:**
- Card moved from Backlog with source availability confirmed.
- For adaptations: `parent_id` set to published or in-review canonical card.

**Production rules:**
- Canonical WordPress content is produced first; adaptations second.
- No new evidence, prices, links, or medical claims beyond verified source.
- Internal link targets from `related_articles` must exist or have cards in Backlog/Production with coordinated publish dates.
- Commercial content must include limitations and escalation sections before review.

**Exit criteria (→ Human Review):**
- Draft complete per content type template (Editorial Style Guide).
- Self-check against Publishing Checklist (canonical) or platform playbook (adaptations).
- `related_products` and `related_articles` fields updated to match draft.

**Return to Backlog:** Source record unavailable or cluster reassignment—document reason in `notes`.

---

### 3. Human Review

**Definition:** Awaiting editorial, safety, and commercial approval before scheduling.

**Review tracks (as applicable):**

| Track | Required for |
|-------|----------------|
| Structural review | All content |
| Editorial review | All content |
| Fact-check | All factual claims |
| Safety review | Health-adjacent content |
| Commercial review | Affiliate-bearing or product verdict content |
| Platform review | Social, video, pin adaptations |

**Exit criteria (→ Scheduled):**
- All required tracks approved.
- Affiliate disclosure confirmed for commercial content.
- Limitations aligned with advantages (no contradictory suitability).
- For adaptations: claims match parent canonical; CTA points to canonical URL.

**Exit criteria (→ Production):** Revisions required—document specific fixes in `notes`; do not partial-approve.

**Hard blocks (cannot approve):**
- Placeholder or unresolved source references.
- Missing affiliate disclosure on commission-bearing content.
- Guaranteed healing or universal suitability claims.
- Adaptation published without approved canonical parent.

---

### 4. Scheduled

**Definition:** Approved content with an assigned publish date.

**Entry criteria:**
- Human Review complete.
- `scheduled_publish_date` set.
- For WordPress: draft prepared; publish status remains draft until final release gate.
- For adaptations: `canonical_url` on parent card populated or scheduled concurrently.

**Pre-publish checklist:**
- [ ] Internal links verified against live or same-day scheduled targets.
- [ ] Disclosure visible on commercial pages.
- [ ] Platform format matches playbook (carousel count, thread length, pin description standalone).
- [ ] `evergreen` flag and `update_frequency` confirmed.
- [ ] KPI / `business_purpose` noted for post-publish measurement.

**Exit criteria (→ Published):** Publish executed on all listed `platforms`.

**Return to Human Review:** Material change discovered between scheduling and publish.

---

### 5. Published

**Definition:** Live on assigned platform(s).

**Entry criteria:**
- Content live at `canonical_url` (WordPress) or platform equivalent.
- Adaptation cards link to parent canonical URL in production.

**Ongoing obligations:**
- Monitor for source record changes affecting accuracy.
- Track KPIs aligned with `business_purpose` (discover, educate, compare, convert, retain, maintain-trust).
- Respond to material errors immediately via **Update Queue**—do not edit silently without review when claims change.

**Exit criteria (→ Update Queue):**
- `next_review_due` reached per `update_frequency`.
- Triggered update: formulation change, guidance revision, broken links, KPI anomaly, or editorial standard change.
- Parent canonical updated requiring adaptation refresh.

**Exit criteria (→ Retirement):** Content inaccurate beyond repair, duplicate topic consolidated, or product discontinued with no editorial value retained.

---

### 6. Update Queue

**Definition:** Published content due for scheduled or triggered refresh.

**Entry criteria:**
- Scheduled review date elapsed.
- Verified change in source record, product, or guidance.
- Editorial correction required.
- Parent/child drift detected (adaptation contradicts canonical).

**Update priority order:**
1. Factual safety errors.
2. Formulation or labeling changes.
3. Professional guidance changes.
4. Commercial freshness (affiliate product status).
5. Internal link and SEO structural maintenance.

**Exit criteria (→ Production):** Update scope defined in `notes`; owner assigned.

**Exit criteria (→ Retirement):** Content should be merged, redirected, or archived rather than revised.

**After update:** Return through **Human Review** before re-publish. Minor typographic fixes may be exempt per editorial leadership policy but never for factual, commercial, or safety content.

---

### 7. Retirement

**Definition:** Content removed from active catalog, merged, or redirected.

**Entry criteria:**
- Consolidation into hub or successor article.
- Product discontinued and review no longer maintainable.
- Duplicate URL policy enforcement.
- Persistent accuracy failure.

**Retirement requirements:**
- `retirement_target_id` or redirect URL documented.
- Platform adaptations retired or updated to point to successor.
- Internal links from other cards updated (related cards enter **Update Queue**).
- Significant public corrections noted when reader decisions were affected.

**Terminal state:** No forward transition. Successor card carries forward evergreen value.

---

## Content class workflows

### Evergreen (hubs, spokes, educational guides)

| Stage | Notes |
|-------|-------|
| Backlog | Cluster and hub relationship required |
| Production | Problem-first; no product-first framing |
| Published | `evergreen: true`; semiannual or annual review |
| Update Queue | Merge news teaching into hub when durable |

### Commercial (reviews, comparisons, decision guides)

| Stage | Notes |
|-------|-------|
| Backlog | `affiliate_relevance` set; source record required |
| Production | Limitations section mandatory before review |
| Human Review | Commercial independence check required |
| Published | Minimum inbound non-commercial links verified at launch |
| Update Queue | Semiannual product review default |

### News (updates, advisories)

| Stage | Notes |
|-------|-------|
| Backlog | `evergreen: false`; verified change documented |
| Production | State what changed and what did not |
| Published | Link to evergreen successor; sunset review at 60–90 days |
| Retirement | Merge into evergreen or archive |

### Social (adaptations)

| Stage | Notes |
|-------|-------|
| Backlog | `parent_id` required |
| Production | Platform playbook compliance |
| Human Review | Each post/slide accurate if read alone |
| Published | CTA to canonical URL; disclosure if affiliate path |
| Update Queue | Refresh within 14 days of parent canonical update |
| Retirement | Remove or archive when parent retires |

---

## Roles and accountability

| Role | Responsibility |
|------|----------------|
| **Owner** (`owner` field) | Drives card through lifecycle; accountable for dates and updates |
| **Editorial lead** | Cluster fit, backlog priority, approval authority |
| **Editor** | Draft quality, checklist compliance |
| **Fact-checker** | Source verification |
| **Safety reviewer** | Health-adjacent escalation content |
| **Commercial reviewer** | Disclosure, independence, suitability alignment |

One person may hold multiple roles; roles must still be explicitly recorded in approval notes.

---

## Multi-platform coordination

When `platforms` lists more than one surface:

1. **WordPress** card reaches **Published** first (canonical).
2. Adaptation cards created with `parent_id` linking to canonical card.
3. Adaptations move through Production → Human Review → Scheduled independently.
4. All adaptations must publish within the same operational week as canonical unless `notes` document intentional stagger.
5. KPI measurement attributes social traffic to parent canonical card via UTM or platform analytics convention (documented in `notes`; not implemented here).

---

## Affiliate integration gates

| Stage | Gate |
|-------|------|
| Backlog | `affiliate_relevance` classified—not decided by commission |
| Production | Disclosure draft present on commercial content |
| Human Review | Independence and suitability alignment verified |
| Published | Disclosure live and visible |
| Update Queue | Re-check commission status and disclosure if product or links change |

Affiliate relevance never overrides editorial verdict.

---

## Internal linking gates

| Stage | Gate |
|-------|------|
| Backlog | `related_articles` lists intended hub and spokes |
| Production | Draft contains agreed internal links |
| Human Review | Orphan check: minimum inbound links for commercial pages |
| Published | Links functional |
| Update Queue | Link graph refreshed on merge or retirement |

---

## Monthly operating rhythm

Aligns with Revenue Roadmap v1 §13.

| Week | Card operations |
|------|-----------------|
| **1** | Audit **Update Queue**; reprioritize **Backlog**; review cards past `next_review_due` |
| **2** | Move selected cards through **Production** → **Human Review** |
| **3** | **Scheduled** canonical publishes; adaptation cards to **Production** |
| **4** | **Published** KPI review; flag cards for **Update Queue** or **Retirement** |

---

## Card status summary

| Status | Meaning | Typical next step |
|--------|---------|-------------------|
| `backlog` | Approved, not started | Production |
| `production` | Drafting | Human Review |
| `human-review` | Awaiting approval | Scheduled or Production |
| `scheduled` | Publish date set | Published |
| `published` | Live | Update Queue (cadence) |
| `update-queue` | Needs refresh | Production or Retirement |
| `retirement` | End of life | Successor maintenance |

---

## Governance

- Cards may not skip **Human Review** for public distribution.
- Status transitions must be reflected on the card before work begins in the next stage.
- Automation may enforce schema and transitions in the future; it must not weaken approval gates.
- When workflow conflicts with the Editorial Style Guide, **the Style Guide prevails**.

---

*PiercingConnect Content Operations Workflow v1.0*
