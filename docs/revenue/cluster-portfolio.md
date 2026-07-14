# PiercingConnect Cluster Portfolio

**Version:** 1.0  
**Status:** Revenue evaluation framework  
**Scope:** How every content cluster is scored and gated before entering production

This document defines the cluster portfolio model for PiercingConnect. It is subordinate to the Revenue Roadmap v1, Evergreen Content Master Plan, and Editorial Style Guide. It is not an implementation specification, workflow automation, or content generation prompt.

---

## 1. Purpose

A **content cluster** is a problem- or category-led group of hub and spoke articles that share evidence boundaries, internal linking logic, and commercial rules. Before any cluster enters production, it is evaluated as a portfolio unit—not article by article in isolation.

The cluster portfolio exists to:

- Prioritize **long-term trust** over short-term affiliate revenue.
- Gate production until evidence and safety boundaries are sufficient.
- Make trade-offs visible when search demand and affiliate opportunity conflict with editorial risk.
- Provide a single scoreboard for editorial, revenue, and operations decisions.

---

## 2. Cluster evaluation dimensions

Each cluster is tracked on ten dimensions. All numeric scores use a **0–100** scale unless noted otherwise.

| Dimension | What it measures | Score guidance |
|-----------|------------------|----------------|
| **Business priority** | Strategic importance to Phase A–D roadmap and pillar balance | 90–100 = launch-critical; 70–89 = growth priority; 50–69 = depth/authority; below 50 = defer |
| **Expected search demand** | Sustained informational/commercial query volume (not trend spikes) | Based on intent breadth, seasonality, and problem persistence |
| **Evergreen score** | Likely useful life without rewrite; low news dependency | High = years; low = product-cycle or trend tied |
| **Affiliate opportunity score** | Realistic, policy-compliant monetization depth | High ≠ production priority; scored for visibility only |
| **Trust impact score** | Effect on reader safety perception and brand credibility | High = wrong advice causes harm or lasting distrust |
| **Evidence readiness** | Resolved source records + commerce knowledge completeness | See `references/evidence/` and commerce audit status |
| **Content readiness** | Cards, briefs, templates, and canonical hub path defined | Production card + brief = higher than backlog idea alone |
| **Estimated maintenance effort** | Ongoing fact-check, refresh, and dispute risk | **Scored inversely for portfolio math:** 100 = low effort, 0 = high effort |
| **Internal link value** | Hub/spoke anchor potential across site architecture | High = many clusters depend on it |
| **Production status** | Current lifecycle state | See §5 |

Dimensions are assessed independently, then combined via the weighted model in §4.

---

## 3. Trust-first production gates

No cluster enters **production** unless all applicable gates pass. Composite score alone does not override gates.

| Gate | Rule | Rationale |
|------|------|-----------|
| **G1 — Evidence floor** | Evidence readiness ≥ **60** for any cluster; ≥ **70** if trust impact ≥ **80** | Prevents publishing with unresolved source IDs |
| **G2 — High-caution review** | Trust impact ≥ **85** requires human safety review checklist before first publish | Bump, infection, and escalation clusters |
| **G3 — Hub-before-spoke (commercial)** | Affiliate opportunity ≥ **70** requires category hub published first | Education before conversion |
| **G4 — No invented claims** | Any product-named cluster requires manufacturer evidence records for formula/spec claims | Evidence policy |
| **G5 — Composite threshold** | Portfolio composite ≥ **70** for production entry; ≥ **75** for affiliate-forward distribution | Trust-weighted bar |
| **G6 — Maintenance capacity** | Maintenance effort score below **40** (high effort) requires assigned owner and refresh calendar | Avoid stale high-risk content |

Clusters that fail a gate remain in **backlog**, **evidence build**, or **blocked** regardless of search demand or affiliate potential.

---

## 4. Weighted scoring model (0–100)

### 4.1 Formula

```
Portfolio Score =
  (Trust impact           × 0.22) +
  (Evidence readiness     × 0.20) +
  (Evergreen score        × 0.15) +
  (Content readiness      × 0.12) +
  (Internal link value    × 0.10) +
  (Expected search demand × 0.08) +
  (Maintenance effort     × 0.08) +
  (Business priority      × 0.05) +
  (Affiliate opportunity  × 0.05)
```

### 4.2 Weight rationale

| Factor | Weight | Why |
|--------|--------|-----|
| Trust impact | **22%** | Primary asset; harm or exaggeration destroys compounding traffic |
| Evidence readiness | **20%** | Unsourced clusters cannot be made trustworthy at publish time |
| Evergreen score | **15%** | Long-lived accuracy aligns with trust and SEO compound interest |
| Content readiness | **12%** | Operational readiness without substituting for evidence |
| Internal link value | **10%** | Coherent architecture reinforces authority and safe reader paths |
| Expected search demand | **8%** | Demand informs sequencing, not safety shortcuts |
| Maintenance effort (inverted) | **8%** | High-maintenance clusters need capacity before scale |
| Business priority | **5%** | Roadmap alignment, subordinate to trust |
| Affiliate opportunity | **5%** | **Lowest weight by design** — visible but never decisive |

### 4.3 Score bands

| Band | Range | Meaning |
|------|-------|---------|
| **Production-ready** | 75–100 | Gates passed; hub/spoke publishing may proceed |
| **Near-ready** | 65–74 | Evidence or content gaps closable in one focused pass |
| **Build phase** | 50–64 | Taxonomy or evidence layer incomplete |
| **Defer** | 0–49 | Insufficient trust foundation or low strategic fit |

Affiliate opportunity **never** moves a cluster more than one band without corresponding trust and evidence scores.

---

## 5. Production status definitions

| Status | Definition |
|--------|------------|
| **planned** | Named in master plan; no content card |
| **backlog** | Content card exists; not production-gated |
| **evidence-build** | Active work on source records / commerce knowledge |
| **brief-ready** | Production brief approved; canonical article not drafted |
| **in-production** | Canonical hub or priority spoke in active editorial production |
| **published** | Canonical WordPress URL live and interlinked |
| **maintain** | Published; on refresh calendar |
| **blocked** | Gate failure or unresolved safety/evidence blocker documented |

---

## 6. Initial cluster portfolio

Scores reflect repository state as of **2026-07-14**, including Sterile Saline evidence layer (`references/evidence/`) and commerce audit (`docs/audits/sterile-saline-cluster-audit.md`). Scores are planning estimates—not analytics guarantees.

### 6.1 Summary table

| Cluster | Business priority | Search demand | Evergreen | Affiliate opp. | Trust impact | Evidence | Content | Maint. effort † | Link value | **Portfolio score** | Status |
|---------|------------------:|--------------:|----------:|---------------:|-------------:|---------:|--------:|----------------:|-----------:|--------------------:|--------|
| **Sterile Saline** | 95 | 88 | 92 | 85 | 88 | 72 | 75 | 65 | 90 | **82** | in-production |
| **Aftercare Mistakes** | 88 | 82 | 92 | 15 | 90 | 68 | 55 | 72 | 85 | **76** | backlog |
| **Healing Timeline** | 82 | 85 | 90 | 10 | 88 | 55 | 40 | 75 | 82 | **72** | backlog |
| **Piercing Bump** | 85 | 90 | 85 | 15 | 95 | 50 | 40 | 70 | 78 | **71** | blocked |
| **Titanium Jewelry** | 80 | 72 | 88 | 25 | 85 | 45 | 35 | 80 | 65 | **67** | backlog |
| **Jewelry Materials** | 78 | 75 | 90 | 40 | 90 | 40 | 30 | 70 | 75 | **66** | planned |
| **Travel Accessories** | 55 | 50 | 70 | 60 | 70 | 35 | 35 | 65 | 55 | **58** | backlog |

† **Maintenance effort** column shows the **inverted score** used in the formula (higher = easier to maintain).

### 6.2 Cluster notes

#### Sterile Saline

- **Role:** Active commercial + editorial cluster; category literacy gateway before product reviews.
- **Evidence:** APP + manufacturer + medical records in `references/evidence/`; product-level 0.9% labels and H2Ocean comparison still unresolved.
- **Gate status:** G1 pass (72); G3 applies to review spokes; hub `pc-hub-sterile-saline-complete-guide` in production.
- **Sequencing:** Hub → mistakes/healing spokes → NeilMed/Steri-Wash reviews → comparisons.

#### Aftercare Mistakes

- **Role:** High-trust discover cluster; myth correction (DIY salt, harsh cleaners, over-cleaning).
- **Dependency:** Should interlink from Sterile Saline hub; benefits from APP evidence records now available.
- **Gate status:** Composite near-ready; publish after Sterile Saline hub canonical approval.

#### Healing Timeline

- **Role:** Sets realistic expectations; reduces panic traffic to bump/infection clusters.
- **Risk:** Timeline generalizations without location/stage caveats hurt trust.
- **Gate status:** Evidence readiness below high-caution threshold; APP FAQ + troubleshooting excerpts needed as dedicated evidence bundle.

#### Piercing Bump

- **Role:** High-anxiety symptom cluster; informational only.
- **Gate status:** **Blocked** — G2 (trust impact 95) with evidence readiness 50; requires APP troubleshooting + medical escalation records and explicit non-diagnosis framing before production.

#### Titanium Jewelry

- **Role:** Spoke within jewelry-irritation cluster; titanium vs. surgical steel during healing.
- **Gate status:** Evidence build needed for implant-grade titanium, surgical steel, and APP initial-jewelry guidance before material claims.

#### Jewelry Materials

- **Role:** Broader category hub (titanium, steel, gold, glass, niobium, mystery metal warnings).
- **Gate status:** Planned; lower content readiness than Titanium spoke; should not launch before Titanium evidence subset validated.

#### Travel Accessories

- **Role:** Practical spoke (travel pillows, sleeping pressure); low medical risk, moderate commercial temptation.
- **Gate status:** Defer until core aftercare clusters published; affiliate score must not accelerate ahead of trust foundation.

---

## 7. Portfolio sequencing (trust-first)

Recommended production order based on portfolio score **and** gates—not affiliate opportunity alone:

1. **Sterile Saline** (in-production → published hub)
2. **Aftercare Mistakes** (after saline hub)
3. **Healing Timeline** (evidence build parallel)
4. **Titanium Jewelry** → **Jewelry Materials** (material evidence bundle)
5. **Piercing Bump** (only after evidence ≥ 70 and safety review)
6. **Travel Accessories** (after core aftercare graph live)

---

## 8. Review cadence

| Activity | Frequency |
|----------|-----------|
| Re-score evidence readiness after evidence-layer updates | Per cluster completion |
| Full portfolio table refresh | Quarterly |
| Gate exception documentation | Ad hoc; requires editorial-lead sign-off |
| Post-publish trust review (high-caution clusters) | Annual minimum |

---

## 9. Related documents

| Document | Relationship |
|----------|--------------|
| `docs/revenue/revenue-roadmap-v1.md` | Phase sequencing and commercial philosophy |
| `docs/editorial/evergreen-content-master-plan.md` | Problem cluster taxonomy |
| `docs/audits/sterile-saline-cluster-audit.md` | Commerce knowledge audit (Sterile Saline) |
| `references/evidence/` | Resolved source records for attribution |
| `content-operations/` | Content cards and production status |

---

## 10. Document control

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2026-07-14 |
| Owner | editorial-lead |
| Next review | 2026-10-14 |

This portfolio model prioritizes **trust, evidence, and evergreen accuracy** over short-term revenue. Affiliate opportunity is tracked for planning transparency and weighted at **5%** so it cannot override safety gates or evidence floors.
