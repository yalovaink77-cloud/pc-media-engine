# Piercing Merchant Discovery 001

**Sprint:** 007 — Merchant and Program Discovery  
**Date:** 2026-07-15  
**Scope:** Ten priority piercing merchants / affiliate programs  
**Rules:** Official merchant and network sources only; no applications submitted; commission/cookie terms not invented.

---

## Verified programs

Programs with affiliate availability confirmed on official merchant pages and/or network profiles.

| Merchant | Program ID | Network / direct | Commission (official) | Cookie | Application URL | TR publisher | TR payout path |
|----------|------------|------------------|---------------------|--------|-----------------|--------------|----------------|
| **OUFER Body Jewelry** | `prog-oufer-awin-global` | Awin (91941) | **15%** CPS | **45 days** | [Awin join](https://ui.awin.com/publisher-signup/us/awin?advertiser=91941) | Yes (via Awin) | Awin → Payoneer (`pay-awin-default`) |
| **BODYJEWELRY.COM** | `prog-bodyjewelry-awin-us` | Awin (63864) | **15%** standard / **20%** VIP | **45 days** | [Awin join](https://ui.awin.com/publisher-signup/us/awin?advertiser=63864) | Yes (via Awin) | Awin → Payoneer |
| **Piercingline** | `prog-piercingline-awin-de` | Awin (18471) | **12%** standard / **8%** voucher | **30 days** | [Awin join DE](https://ui.awin.com/publisher-signup/de/awin?advertiser=18471) | Yes (via Awin) | Awin → Payoneer |
| **Painful Pleasures** | `prog-painful-pleasures-direct-us` | Direct (promo code) | **Up to 10%** (product-dependent) | **Unresolved** | [Affiliate page](https://www.painfulpleasures.com/pages/affiliate) | Open to apply | **PayPal only — unusable TR** |
| **Amazon Associates (TR)** | `prog-amazon-associates-tr` | Amazon Türkiye Gelir Ortaklığı | **Per-product (unresolved)** | **Per-product (unresolved)** | [gelirortakligi.amazon.com.tr](https://gelirortakligi.amazon.com.tr/) | Yes (TR tax registered) | TRY DD / gift card (`pay-amazon-associates-tr-default`) |

### Official source URLs (verified)

- OUFER Awin: https://ui.awin.com/merchant-profile/91941  
- BODYJEWELRY Awin: https://ui.awin.com/merchant-profile/63864 · terms: https://ui.awin.com/merchant-profile-terms/63864  
- Piercingline merchant: https://piercingline.com/en/service/affiliate-partner-program/ · Awin: https://ui.awin.com/merchant-profile/18471  
- Painful Pleasures: https://www.painfulpleasures.com/pages/affiliate  
- Amazon TR: https://gelirortakligi.amazon.com.tr/ · agreement: https://gelirortakligi.amazon.com.tr/help/operating/agreement  

### Social / platform restrictions (where officially documented)

| Program | WordPress | YouTube | Instagram | Facebook | Pinterest | X |
|---------|-----------|---------|-----------|----------|-----------|---|
| OUFER (Awin) | Welcomed (Awin) | Brand page mentions — re-verify | Brand page mentions — re-verify | Unresolved | Brand page mentions — re-verify | Unresolved |
| BODYJEWELRY (Awin) | Allowed; PPC/trademark restrictions on search | Unresolved | Unresolved | Unresolved | Unresolved | Unresolved |
| Piercingline | Website-focused; thematic fit required | Not on merchant page | Unresolved | Unresolved | Unresolved | Unresolved |
| Painful Pleasures | Allowed | Reels (not YouTube explicit) | Reels, DMs, stories | Unresolved | Unresolved | Unresolved |
| Amazon TR | Allowed (content gates) | ≥500 followers | ≥500 followers | Public pages/groups ≥500 | **Unresolved** | ≥500 followers |

---

## Conditional / unverified programs

| Merchant | Status | Finding | Blocker |
|----------|--------|---------|---------|
| **FreshTrends** | `partially_verified` / low | UpPromote register URL exists ([af.uppromote.com/freshtrends/register](https://af.uppromote.com/freshtrends/register)); FlexOffers listing states program **not currently offered**; brand `/pages/affiliates` returned **403** | Active terms, commission, cookie, payout path unresolved |
| **AliExpress Portals** | `partially_verified` / high (legal terms) | Program at [portals.aliexpress.com](https://portals.aliexpress.com/); agreement confirms bank remittance min **USD 15** (§7.5); rates on portal only (§7.2) | TR bank remittance eligibility unconfirmed; rates not extracted without portal login |
| **BodyArtForms** | No program | Official FAQ documents customer review-points only; `/affiliate.asp` **404** | Not revenue-capable via affiliate |
| **Urban Body Jewelry** | No traditional affiliate | Rep-card / refer-a-friend customer programs only ([rep cards](https://www.urbanbodyjewelry.com/products/rep-cards), [refer](https://www.urbanbodyjewelry.com/pages/refer)); `/pages/affiliate-program` **404** | Gift-card rewards, not CPS publisher program |
| **Tulsa Body Jewelry** | No affiliate on official site | [TBJ Rewards](https://tulsabodyjewelry.com/pages/loyalty-program) customer loyalty only | Third-party aggregator listings excluded per research rules |

### Historical (not current) — FreshTrends via FlexOffers

FlexOffers program page (updated Feb 2025) historically cited **12%** payout and **60-day** cookie but explicitly states the program is **not currently offered** in their system. Those terms are **not** recorded in commission files.

---

## Turkey-usable opportunities

Ranked for a **Turkey-resident, TR tax-registered** PiercingConnect publisher (Sprint 006-B payout constraints applied).

| Priority | Program | Why usable | Confidence |
|----------|---------|------------|------------|
| 1 | **Amazon Associates TR** | Only confirmed TRY-native marketplace payout; direct deposit / gift card | High |
| 2 | **OUFER via Awin** | 15% CPS, 45-day cookie, worldwide shipping; Awin TR Payoneer workflow confirmed Sprint 006-B | High |
| 3 | **BODYJEWELRY.COM via Awin** | 15–20% tier, 45-day cookie; same Awin TR payout path | High |
| 4 | **Piercingline via Awin** | 12% CPS, 30-day cookie; website thematic fit may affect approval | High (payout) / Medium (approval) |
| 5 | **AliExpress Portals** | Bank remittance in agreement; no PayPal dependency | **Conditional** — TR bank support unconfirmed |

### Not Turkey-usable (verified program, blocked payout)

- **Painful Pleasures** — PayPal-only monthly payout ([official FAQ](https://www.painfulpleasures.com/pages/affiliate)); PayPal suspended for Turkey-resident personal/business accounts per Sprint 006-B.

### Not revenue-capable (no official affiliate program)

- BodyArtForms, Urban Body Jewelry, Tulsa Body Jewelry

---

## Top 3 application priorities

Ready-to-apply **draft stubs** created (`status: draft` — **not submitted**).

1. **Amazon Associates Türkiye** (`app-amazon-associates-tr-2026-07`)  
   - **Why first:** Only verified TRY payout path for marketplace piercing SKUs.  
   - **Blockers:** TR tax registration, ~10 site posts / 60 days, 3 qualifying sales / 180 days, live disclosure.  
   - **URL:** https://gelirortakligi.amazon.com.tr/

2. **OUFER Body Jewelry via Awin** (`app-oufer-awin-2026-07`)  
   - **Why second:** Highest verified CPS among piercing specialists (15%), 45-day cookie, global shipping.  
   - **Prerequisite:** Awin publisher account ([network signup](https://ui.awin.com/publisher-signup/en/awin/step1)).  
   - **URL:** https://ui.awin.com/publisher-signup/us/awin?advertiser=91941

3. **BODYJEWELRY.COM via Awin** (`app-bodyjewelry-awin-2026-07`)  
   - **Why third:** Established catalog, 15% (20% VIP), 45-day cookie, dedicated affiliate contact.  
   - **Prerequisite:** Same Awin publisher account.  
   - **URL:** https://ui.awin.com/publisher-signup/us/awin?advertiser=63864  

**Alternate #3:** Piercingline (`app-piercingline-awin-2026-07`) if DE merchant prefers EU catalog — 12% / 30-day cookie; registration subject to thematic review.

---

## Files created / updated

### Created — brands (FK dependency; required by merchant schema)

- `affiliate-intelligence/brands/brand-oufer.yaml`
- `affiliate-intelligence/brands/brand-bodyjewelry.yaml`
- `affiliate-intelligence/brands/brand-piercingline.yaml`
- `affiliate-intelligence/brands/brand-freshtrends.yaml`
- `affiliate-intelligence/brands/brand-painful-pleasures.yaml`
- `affiliate-intelligence/brands/brand-bodyartforms.yaml`
- `affiliate-intelligence/brands/brand-urban-body-jewelry.yaml`
- `affiliate-intelligence/brands/brand-tulsa-body-jewelry.yaml`
- `affiliate-intelligence/brands/brand-aliexpress.yaml`
- `affiliate-intelligence/brands/brand-amazon.yaml`

### Created — merchants

- `affiliate-intelligence/merchants/merchant-oufer-awin.yaml`
- `affiliate-intelligence/merchants/merchant-bodyjewelry-awin.yaml`
- `affiliate-intelligence/merchants/merchant-piercingline-awin.yaml`
- `affiliate-intelligence/merchants/merchant-freshtrends-direct.yaml`
- `affiliate-intelligence/merchants/merchant-painful-pleasures-direct.yaml`
- `affiliate-intelligence/merchants/merchant-bodyartforms-direct.yaml`
- `affiliate-intelligence/merchants/merchant-urban-body-jewelry-direct.yaml`
- `affiliate-intelligence/merchants/merchant-tulsa-body-jewelry-direct.yaml`
- `affiliate-intelligence/merchants/merchant-aliexpress-direct.yaml`
- `affiliate-intelligence/merchants/merchant-amazon-associates-tr.yaml`

### Created — programs

- `affiliate-intelligence/programs/prog-oufer-awin-global.yaml`
- `affiliate-intelligence/programs/prog-bodyjewelry-awin-us.yaml`
- `affiliate-intelligence/programs/prog-piercingline-awin-de.yaml`
- `affiliate-intelligence/programs/prog-freshtrends-direct-us.yaml`
- `affiliate-intelligence/programs/prog-painful-pleasures-direct-us.yaml`
- `affiliate-intelligence/programs/prog-aliexpress-direct-global.yaml`
- `affiliate-intelligence/programs/prog-amazon-associates-tr.yaml`

### Created — commissions

- `affiliate-intelligence/commissions/comm-prog-oufer-awin-global-2026-07-15.yaml`
- `affiliate-intelligence/commissions/comm-prog-bodyjewelry-awin-us-2026-07-15.yaml`
- `affiliate-intelligence/commissions/comm-prog-piercingline-awin-de-2026-07-15.yaml`
- `affiliate-intelligence/commissions/comm-prog-painful-pleasures-direct-us-2026-07-15.yaml`

*(No commission files for Amazon TR or AliExpress — rates not officially documented without portal/category proof.)*

### Created — payments

- `affiliate-intelligence/payments/pay-aliexpress-direct-default.yaml`
- `affiliate-intelligence/payments/pay-painful-pleasures-direct-default.yaml`

*(Awin merchants inherit `pay-awin-default`; Amazon TR inherits `pay-amazon-associates-tr-default` from Sprint 006.)*

### Created — applications (draft stubs only)

- `affiliate-intelligence/applications/app-amazon-associates-tr-2026-07.yaml`
- `affiliate-intelligence/applications/app-oufer-awin-2026-07.yaml`
- `affiliate-intelligence/applications/app-bodyjewelry-awin-2026-07.yaml`
- `affiliate-intelligence/applications/app-piercingline-awin-2026-07.yaml`

### Updated

- `affiliate-intelligence/countries/country-tr.yaml` — `related_program_ids` indexed

### Report

- `affiliate-intelligence/reports/piercing-merchant-discovery-001.md` (this file)

---

**Review due:** 2026-10-15 · **Checked by:** revenue-ops · **No commit / no push / no applications submitted.**
