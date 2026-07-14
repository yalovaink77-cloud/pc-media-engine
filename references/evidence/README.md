# Sterile Saline Cluster — Evidence Layer

Structured evidence records for sources cited by the Sterile Saline commercial/editorial cluster in PiercingConnect Commerce Blueprint (`piercingconnect-commerce`).

**Scope:** Sterile saline cluster only.  
**Status:** Evidence Completion Sprint 2 (2026-07-14).  
**Rule:** Records contain only verified claims from consulted official pages. Unverified items are listed under `unsupported_claims` or marked unresolved in `notes`.

## Evidence readiness estimate

| Metric | Pre–Sprint 1 | Post–Sprint 1 | Post–Sprint 2 |
|--------|--------------|---------------|---------------|
| **Sterile Saline evidence readiness** | **72%** | **79%** | **84%** |

Sprint 2 ingested Recovery 7.4 oz official SDS (0.9% wound-wash synonym + SKU-linked documentation), captured Steri-Wash 4.25 oz back label (0.9% USP NaCl), reviewed NeilMed official 177 mL back label (water + NaCl, no %), and documented APP vs manufacturer claim cross-check in `app-aftercare.yaml`. Readiness remains below 85% because **NeilMed 0.9% NaCl** is still unverified on official label/pages and **Steri-Wash 0.9%** is confirmed for the 4.25 oz SKU only (3 oz / 8 oz label concentration not captured).

### Manufacturer coverage (Sprint 2)

| source_id | Confidence | Sprint 2 outcome |
|-----------|------------|------------------|
| `official-neilmed` | medium | Official 177 mL back label captured (Deionized Water & NaCl); **0.9% still unresolved**; aap-pac PDF confirmed as APP brochure not product spec |
| `official-steri-wash` | medium | Frontpage ingredients + 4.25 oz label **0.9% USP NaCl** verified; 3 oz hospital-grade + 8 oz vegan supported; **line-wide 0.9% unresolved** |
| `official-recovery-aftercare` | **high** | 7.4 oz SDS/CoA/gamma links verified; **0.9% supported** via SDS synonym; SKU mapping resolved |
| `official-h2ocean` | medium | Unchanged (Sprint 1) — comparison peer |
| `official-base-laboratories` | medium | Unchanged (Sprint 1) — comparison peer; 0.9% still unresolved |

## Records

| Priority | source_id | File |
|----------|-----------|------|
| 1 | `app-aftercare` | [app-aftercare.yaml](./app-aftercare.yaml) |
| 1 | `app-troubleshooting` | [app-troubleshooting.yaml](./app-troubleshooting.yaml) |
| 1 | `app-piercing-faq` | [app-piercing-faq.yaml](./app-piercing-faq.yaml) |
| 2 | `official-neilmed` | [official-neilmed.yaml](./official-neilmed.yaml) |
| 3 | `official-steri-wash` | [official-steri-wash.yaml](./official-steri-wash.yaml) |
| 4 | `official-recovery-aftercare` | [official-recovery-aftercare.yaml](./official-recovery-aftercare.yaml) |
| 5 | `official-otzi` | [official-otzi.yaml](./official-otzi.yaml) |
| — | `nhs-wound-care` | [nhs-wound-care.yaml](./nhs-wound-care.yaml) |
| — | `nhs-infected-piercings` | [nhs-infected-piercings.yaml](./nhs-infected-piercings.yaml) |
| — | `mayo-clinic-piercings` | [mayo-clinic-piercings.yaml](./mayo-clinic-piercings.yaml) |
| — | `cleveland-clinic-infected-ear-piercing` | [cleveland-clinic-infected-ear-piercing.yaml](./cleveland-clinic-infected-ear-piercing.yaml) |
| — | `usp-saline-guidance` | [usp-saline-guidance.yaml](./usp-saline-guidance.yaml) |
| — | `official-h2ocean` | [official-h2ocean.yaml](./official-h2ocean.yaml) |
| — | `official-base-laboratories` | [official-base-laboratories.yaml](./official-base-laboratories.yaml) |

## Usage

Articles and product records should cite `source_id` values from these files. Do not attribute claims listed under `unsupported_claims` until a record is updated with verified evidence.
