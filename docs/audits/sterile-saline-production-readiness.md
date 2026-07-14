# Sterile Saline Cluster — Production Readiness Audit

**Audit date:** 2026-07-14 (re-score after card + gold-standard remediation)  
**Prior score:** 64% (initial packaging audit, same day)  
**Scope:** Production drafts, production brief, evidence layer, P1 content cards, NeilMed reference path  
**Inspector rule:** Audit file update only; no article/code changes, CI, commit, or push  

**Inspected production drafts:**

| Draft | Path |
|-------|------|
| Hub guide | `content-operations/production/drafts/sterile-saline-complete-guide.md` |
| NeilMed review | `content-operations/production/drafts/neilmed-piercing-aftercare-fine-mist.md` |
| Steri-Wash review | `content-operations/production/drafts/steri-wash-saline-spray.md` |
| Recovery review | `content-operations/production/drafts/recovery-sterile-saline-wash.md` |
| H2Ocean review | `content-operations/production/drafts/h2ocean-piercing-aftercare.md` |

**Also inspected:** production brief; `references/evidence/` (Sprint 2); P1 cards including new Recovery + H2Ocean; synchronized NeilMed gold-standard reference; fixture + social seed paths (contamination residual).

---

## Executive verdict

**Production-ready: No — but packaging readiness improved.**

**Resolved since prior audit:**

1. Recovery and H2Ocean **P1 content cards created** (`pc-review-recovery-sterile-saline`, `pc-review-h2ocean-piercing-aftercare`).  
2. NeilMed **gold-standard synchronized** to the evidence-aligned production draft (`status: reference`; Evidence Layer as source of truth). Unsupported NeilMed 0.9% / drug-free / healing-guarantee **assertions removed** from that path.

**Still not production-ready** because human approval gates, draft↔card interlink sync, backlog card promotion, and residual fixture/social NeilMed contamination remain open.

**Cluster content production readiness score: 74%** (was **64%**)  
*(Evidence-layer readiness unchanged at **84%** per `references/evidence/README.md`.)*

| Band | Meaning |
|------|---------|
| 0–40% | Skeleton only |
| 41–65% | Structured draft — not production-ready |
| **66–85%** | **Publishable with targeted fixes** ← current |
| 86–100% | Production-ready ecosystem |

---

## Readiness score breakdown

| Dimension | Weight | Prior | Now | Notes |
|-----------|--------|------:|----:|-------|
| Evidence consistency across production drafts | 18% | 90 | 90 | Unchanged — Sprint 2 concentration rules still hold |
| Unsupported-claim containment (production drafts) | 18% | 92 | 94 | Gold-standard no longer contradicts production NeilMed |
| SKU-specific concentration wording | 12% | 95 | 95 | Unchanged |
| APP vs manufacturer claim separation | 12% | 93 | 93 | Unchanged |
| Internal-link / card-ID consistency | 12% | 48 | 58 | Cards exist; hub Related Guides + peer tables still stale |
| Affiliate neutrality | 8% | 95 | 95 | Unchanged |
| Registry / card completeness | 10% | 45 | 90 | Hub + NeilMed + Steri-Wash + Recovery + H2Ocean cards present |
| Stale-artifact isolation | 10% | 30 | 65 | Gold-standard fixed; fixture + social still leak unsupported NeilMed 0.9% |

**Weighted total: ~74%**

---

## Evidence consistency (production drafts)

Unchanged — still **consistent** across hub and four reviews for:

- NeilMed 0.9% excluded  
- Steri-Wash 0.9% = 4.25 oz only  
- Recovery 0.9% = 7.4 oz SDS synonym only  
- H2Ocean not APP baseline / no inferred sterility or isotonic NaCl  
- No universal schedule; no healing guarantees  

---

## Unsupported claim leakage

### Production drafts + gold-standard reference

**No high-severity NeilMed 0.9% assertion leakage** in:

- production NeilMed draft  
- gold-standard reference (synchronized 2026-07-14)

### Residual contamination paths (not production drafts)

| Artifact | Status |
|----------|--------|
| `packages/pilot-piercingconnect/content/gold-standard/neilmed-piercing-aftercare-fine-mist.md` | **Remediated** — reference mirror of production draft |
| `packages/pilot-piercingconnect/src/__fixtures__/neilmed-generated-review.md` | **Still asserts** unsupported NeilMed 0.9% / drug-free / APP align |
| `packages/pilot-piercingconnect/content/social/neilmed/*` | **Still asserts** unsupported NeilMed 0.9% / drug-free / isotonic product claims |

---

## SKU / APP / affiliate checks

| Check | Result |
|-------|--------|
| SKU-scoped concentration wording in drafts | Pass |
| APP vs manufacturer separation | Pass |
| Affiliate neutrality in drafts | Pass |

---

## Internal-link & card registry status

| Item | Status |
|------|--------|
| `pc-hub-sterile-saline-complete-guide` | Registered (`production/`) |
| `pc-review-neilmed-fine-mist` | Registered (backlog) |
| `pc-review-steri-wash-saline` | Registered (backlog) |
| `pc-review-recovery-sterile-saline` | **Registered** (backlog) — **blocker cleared** |
| `pc-review-h2ocean-piercing-aftercare` | **Registered** (backlog) — **blocker cleared** |
| Hub Related Guides includes Recovery/H2Ocean | **Still missing** |
| NeilMed/Steri-Wash/Recovery alternatives still say “Name-only” / “no dedicated card” for peers that now have cards | **Still stale** |

---

## Blocking issues

1. **Human review gates open** — fact-check, safety review, final approval, and WordPress path assignment not completed for hub or product reviews.  
2. **Draft interlink sync incomplete** — hub Related Guides omits Recovery/H2Ocean; NeilMed/Steri-Wash (and Recovery→H2Ocean) alternative tables still use “Name-only” / “no dedicated review card” wording despite registered cards.  
3. **Review cards remain `backlog`** — NeilMed, Steri-Wash, Recovery, H2Ocean must promote only after human approval (hub card already `production` for queue role, but draft still unapproved).  
4. **Residual NeilMed contamination outside gold-standard** — fixture + social packs still assert unsupported 0.9% / drug-free / isotonic product claims. **Blocks any distribution path that can load those files**; does not re-open the remediated gold-standard path.

**Cleared blockers (removed from prior list):**

- ~~Missing Recovery/H2Ocean P1 cards~~  
- ~~Gold-standard NeilMed asserting unsupported 0.9% as active source of truth~~  

---

## Advisory issues

1. Base Laboratories remains hub comparison-only (no review draft/card) — acceptable if intentional.  
2. EasyPiercing remains name-only / unresolved — correctly excluded from specs.  
3. Brief “Out of scope: Full article draft body” still stale.  
4. NeilMed/Steri-Wash card notes still mention gold-standard seeding / commerce-source blockers superseded by drafts + evidence.  
5. Hub `related_products` lists only NeilMed + Steri-Wash — fine for staged launch if Recovery/H2Ocean stay later.  
6. Evidence readiness still 84% (NeilMed 0.9% gap; Steri-Wash non-4.25 sizes) — OK if exclusions hold.  
7. Destination safety spokes may remain unpublished — keep card-ID placeholders until live.  
8. Gold-standard still mirrors production “draft pending approval” and stale peer-link wording — harmless for claim safety; refresh when drafts interlink.

---

## Required fixes (updated)

| # | Fix | Priority |
|---|-----|----------|
| R1 | Complete human fact-check + safety + approval on each asset to publish | Blocking |
| R2 | Sync hub Related Guides + peer alternative tables to Recovery/H2Ocean card IDs | Blocking for full cluster |
| R3 | Promote review cards from `backlog` after approval; assign WordPress paths | Blocking |
| R4 | Quarantine or sync fixture + social NeilMed assets before any non-WordPress distribution | Blocking for those channels; advisory for WP-only staged publish |
| O1 | Leave Base Labs comparison-only until scoped | Optional |
| O2 | Refresh brief/card notes for documentation accuracy | Optional |
| O3 | Later evidence sprint for NeilMed 0.9% label | Optional |

---

## Publish order

1. **`pc-hub-sterile-saline-complete-guide`**  
2. **`pc-review-neilmed-fine-mist`** (production draft / synced gold-standard reference — not fixture/social)  
3. **`pc-review-steri-wash-saline`**  
4. **`pc-review-recovery-sterile-saline`** (after R2 interlink sync)  
5. **`pc-review-h2ocean-piercing-aftercare`**  
6. Safety spokes as available  

**Staged subset:** Hub → NeilMed → Steri-Wash is acceptable **after R1 + R3 for that subset**, with Recovery/H2Ocean deferred — provided publish packaging does not promise their URLs and fixture/social are not shipped.

**Do not** publish platform adaptations until matching canonical WordPress articles are approved, and not while social seeds still assert unsupported NeilMed 0.9%.

---

## Remaining human-review blockers (checklist)

- [ ] Fact-check drafts against `references/evidence/*.yaml` unsupported lists  
- [ ] Safety review: escalation + disclaimer  
- [ ] Confirm NeilMed 0.9% never asserted as product fact (including meta)  
- [ ] Confirm Steri-Wash / Recovery concentration scoping  
- [ ] Confirm H2Ocean non-inference (sterility / isotonic / APP equivalence)  
- [ ] Affiliate disclosure final pass if commission links enabled  
- [ ] Sync internal links / related_articles to new Recovery + H2Ocean cards  
- [ ] Quarantine fixture + social before adaptations  
- [ ] Final human approval; WordPress stays draft until then  

---

## Production-ready verdict

| Question | Answer |
|----------|--------|
| Did packaging improve after card + gold-standard remediation? | **Yes** (64% → **74%**) |
| Are production drafts still evidence-consistent? | **Yes** |
| Is the Sterile Saline cluster production-ready to publish? | **No** |
| Primary remaining blockers | Human approval; interlink sync; backlog→approved promotion; fixture/social contamination |
| Score | **74%** content packaging readiness (**84%** evidence-layer readiness) |

**Publish recommendation:** Proceed to **human review** on Hub → NeilMed → Steri-Wash as a staged first wave after interlink decisions; keep Recovery/H2Ocean ready but gated on card-link sync; do **not** ship NeilMed fixture/social until rematched to Evidence Layer. Re-score after R1–R4.
