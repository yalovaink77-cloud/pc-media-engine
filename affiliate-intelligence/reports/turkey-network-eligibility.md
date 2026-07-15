# Turkey Network Eligibility — Sprint 006 / 006-B

**Research date:** 2026-07-15  
**Correction date (006-B):** 2026-07-15  
**Publisher context:** PiercingConnect — Turkey-resident publisher candidate  
**Sources:** Official network documentation and PayPal Turkey notice only. Commission rates, cookie periods, and approval likelihood not documented.

### Sprint 006-B correction (PayPal)

Per PayPal’s official Turkey notice ([paypal.com/tr/webapps/mpp/country-worldwide](https://www.paypal.com/tr/webapps/mpp/country-worldwide)): operations in Turkey suspended since June 2016; customers in Turkey **cannot send or receive money** via PayPal, cannot access accounts, and cannot withdraw to linked bank accounts. Users must open PayPal accounts in their country of residence.

**Consequence for this matrix:** PayPal is **unavailable** as a payout method for Turkey-resident publishers. Any network whose only documented TR payout path is PayPal is **unusable**. Networks with alternate methods are usable only when official docs confirm a **non-PayPal** method for Turkey (or TR tax-resident) publishers.

---

## Usable networks from Turkey

Enrollment and a non-PayPal payout path are both supported by official documentation.

| Network | TR eligibility | Non-PayPal payout | Currencies / min | Payment record |
|---------|----------------|-------------------|------------------|----------------|
| **Amazon Associates** | Yes — Amazon Türkiye Gelir Ortaklığı for **TR tax-registered** publishers; US portal also lists Turkey | Direct deposit, Amazon gift card, cheque (TRY marketplace terms) | TRY 100 (DD/gift card); TRY 1000 (cheque) | `pay-amazon-associates-tr-default` |
| **Awin** | Yes — official Turkish tax residency payment workflow | **Payoneer** + invoice to Awin Ltd | GBP/EUR/USD 20 (publisher-set; default 50); TRY equivalent unresolved | `pay-awin-default` |
| **Impact** | Yes — Turkey in partner signup country lists | **International wire / EFT** — official docs list **TRY** and **Turkey** as supported bank location for wire | Min USD 10 equivalent; TRY wire supported | `pay-impact-default` |
| **Partnerize** | Yes — Türkiye in signup country lists | Electronic transfer (not PayPal) | £20 / $30 / €30 monthly; other currencies on request | `pay-partnerize-default` |

### Per-network detail (usable)

#### Amazon Associates
- **Marketplace path:** Default for PC is **Amazon Türkiye** (`gelirortakligi.amazon.com.tr`), not a generic US Associates enrollment assumption.
- **Tax verification:** TR tax-registered individual, sole proprietor, or business required; non-tax-exempt individuals cannot participate. Tax interview required; manual or automatic invoicing per TR tax status; withholding rules in TR billing help. Do not store tax IDs in records.
- **Traffic:** Original public content; websites ~10 posts within 60 days; 3 qualifying sales within 180 days; social requires full profile URL and typically ≥500 organic followers (Facebook public pages/groups, Instagram, Twitter/X, YouTube, Twitch).
- **Account cost:** Free.
- **Official sources:** [TR payment help](https://gelirortakligi.amazon.com.tr/help/node/topic/GJCKWFEECYW25FGJ) · [Operating agreement](https://gelirortakligi.amazon.com.tr/help/operating/agreement)

#### Awin
- **Confirmed TR payout path:** Invoice Awin Ltd + Payoneer per official “Payments for publishers with Turkish Tax Residency.”
- **Tax/forms:** Tax details in account; if tax residency country not listed, services unavailable.
- **Account cost:** USD 1 refundable security deposit (invitation waiver unverified).
- **Official sources:** [Payment thresholds](https://success.awin.com/articles/en_US/Knowledge/What-are-the-payment-thresholds) · [Turkish tax residency payments](https://success.awin.com/articles/en_US/Knowledge/Payments-for-publishers-with-Turkish-Tax-Residency)

#### Impact
- **Non-PayPal for Turkey:** Official [Supported Currencies](https://help.impact.com/other/reference-documentation/supported-currencies-and-timezones) lists **Turkish Lira (TRY)** with supported bank account location **Turkey**, and **TRY** under wire-supported currencies. Bank setup doc describes international EFT/wire when impact.com does not hold a local account.
- **PayPal:** Listed as a platform method but **unusable for TR-resident publishers** (PayPal Turkey suspension). Use wire/bank path only.
- **Tax/forms:** Tax and payment requirements must be complete before payout.
- **Account cost:** Free.
- **Official sources:** [How partners get paid](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/finance/payments-withdrawals-and-balance/how-do-partners-get-paid) · [Bank details](https://help.impact.com/partner/what-would-you-like-to-learn-about/platform-features/finance/payments-withdrawals-and-balance/withdraw-funds-to-your-bank-account) · [Currencies](https://help.impact.com/other/reference-documentation/supported-currencies-and-timezones)

#### Partnerize
- **Payout:** Electronic transfer per publisher terms; not PayPal-only. Exact TRY threshold matrix unresolved (on request).
- **Tax/forms:** Payment and tax details required before commission release.
- **Account cost:** Free.
- **Official source:** [Publisher Terms v1.8 (PDF)](https://partnerize.com/wp-content/uploads/2025/04/20250331-Partnerize-Publisher-Terms-and-Conditions-1.8.-UK-Entity-min.pdf)

---

## Conditional networks

Non-PayPal methods appear in network docs, and/or TR enrollment is unsettled, but **official confirmation that a non-PayPal method pays Turkey-resident publishers is missing**. Not classified as usable.

| Network | Why conditional | Methods noted (network-wide) | Payment record |
|---------|-----------------|------------------------------|----------------|
| **FlexOffers** | Global signup; TR eligibility not named in terms. Wire/eCheck/check exist for Non-US in terms, but **no official confirmation that those methods are available for Turkey** | PayPal (unavailable to TR), eCheck, check, wire | `pay-flexoffers-default` |
| **Sovrn Commerce** | Signup appears global; TR not explicit. Commerce KB lists ACH/check/PayPal setup; wire referenced in thresholds. **No official confirmation wire/check pays Turkey-resident publishers**. PayPal unavailable to TR | ACH (typically US), check, eCheck, PayPal, wire | `pay-sovrn-commerce-default` |
| **CJ Affiliate** | TR enrollment not confirmed; signup pages errored during research; payment help often login-walled | Unresolved for TR | **Not created** |
| **Rakuten Advertising** | Turkey only confirmed on Brazil Network country list; TR → regional network payout mapping unresolved. Methods include PayPal (unavailable to TR) plus regional deposit/check | PayPal, direct deposit, check (regional) | **Not created** |

---

## Unusable networks

| Network | Reason | Official basis |
|---------|--------|----------------|
| **Skimlinks** | Outside US/EU/UK bank regions, Skimlinks offers **PayPal only**. Turkey is outside those bank regions. PayPal cannot send/receive money for Turkey customers. **No alternate TR payout path documented.** | [Skimlinks payment options](https://support.skimlinks.com/hc/en-us/articles/223835488-What-are-my-payment-options) · [PayPal Turkey notice](https://www.paypal.com/tr/webapps/mpp/country-worldwide) |

Enrollment may still be open; classification is **unusable for TR-resident payout**, not a judgment on signup mechanics.

---

## Payout options summary (Turkey-resident, PayPal unavailable)

| Method | Usable networks |
|--------|-----------------|
| **TRY direct deposit / gift card / cheque** | Amazon TR |
| **Payoneer** | Awin (TR tax residency workflow) |
| **International wire / bank EFT** | Impact (TRY/Turkey wire documented); Partnerize (electronic transfer) |
| **PayPal** | **None** — unavailable for Turkey-resident publishers |

---

## Crosswalk flag (Sprint 006)

**EasyPiercing → official-otzi:** Removed from `brand-easypiercing.yaml`. Evidence remains on `brand-otzi` only.

---

## Files touched (Sprint 006-B)

| File | Change |
|------|--------|
| `affiliate-intelligence/reports/turkey-network-eligibility.md` | PayPal correction; Skimlinks unusable; Impact wire/TRY; priority recalculated |
| `affiliate-intelligence/networks/net-skimlinks.yaml` | Status evaluating; TR payout unusable |
| `affiliate-intelligence/networks/net-impact.yaml` | Wire/TRY for Turkey; PayPal marked unavailable for TR |
| `affiliate-intelligence/networks/net-flexoffers.yaml` | Conditional; non-PayPal TR path unconfirmed |
| `affiliate-intelligence/networks/net-sovrn-commerce.yaml` | Conditional; non-PayPal TR path unconfirmed |
| `affiliate-intelligence/networks/net-amazon-associates.yaml` | Marketplace + tax verification emphasis (006-B) |
| `affiliate-intelligence/payments/pay-skimlinks-default.yaml` | TR unusable (PayPal-only + PayPal suspended) |
| `affiliate-intelligence/payments/pay-impact-default.yaml` | TRY wire; PayPal unavailable for TR |
| `affiliate-intelligence/payments/pay-flexoffers-default.yaml` | PayPal unavailable; TR non-PayPal unconfirmed |
| `affiliate-intelligence/payments/pay-sovrn-commerce-default.yaml` | PayPal unavailable; TR non-PayPal unconfirmed |
| `affiliate-intelligence/countries/country-tr.yaml` | Corrected usable/conditional/unusable availability |

---

## Next application priority (recalculated)

1. **Amazon Associates (TR portal)** — First application once TR tax registration and site/sales gates are ready. Only confirmed TRY-native marketplace payout path.
2. **Awin** — Confirmed TR tax residency / Payoneer; after or parallel once invoice/Payoneer readiness exists.
3. **Impact** — Confirmed Turkey signup + TRY wire; use bank wire only (not PayPal).
4. **Partnerize** — When target advertiser campaigns are identified.
5. **FlexOffers / Sovrn** — Conditional only; do not prioritize until official non-PayPal TR payout confirmation.
6. **CJ / Rakuten** — Enrollment path unresolved; defer.
7. **Skimlinks** — Do not apply for TR-resident payout use (PayPal-only path, PayPal unavailable).

**Recommended first application:** Amazon Associates via **Amazon Türkiye Gelir Ortaklığı** (`gelirortakligi.amazon.com.tr`), after TR tax registration and content/traffic requirements are met.

**Blockers before first application:** TR tax registration (Amazon marketplace eligibility), live site with disclosure (`policy-disclosure-default`), original aftercare content meeting Amazon gates. Payoneer for Awin (no credentials in repo). PayPal is not a viable TR publisher payout setup.

---

*Last checked: 2026-07-15 · Sprint 006-B payment correction · Checked by: revenue-ops · No commits or applications performed.*
