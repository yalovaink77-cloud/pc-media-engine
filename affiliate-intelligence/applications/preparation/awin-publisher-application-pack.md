# Awin Publisher — Application Pack

**Sprint:** Application 001  
**Prepared:** 2026-07-15  
**Status:** Preparation only — **not submitted**  
**Source records:** `net-awin`, `pay-awin-default`, `country-tr`, `policy-disclosure-default`, plus Sprint 007 merchant stubs (`app-oufer-awin-2026-07`, `app-bodyjewelry-awin-2026-07`, `app-piercingline-awin-2026-07`)

This pack covers **Awin publisher (network) account** enrollment. Individual advertiser programs (OUFER, BODYJEWELRY.COM, Piercingline) are joined **after** publisher approval.

---

## Official application URL

| Item | Value |
|------|--------|
| **Publisher signup (step 1)** | [ui.awin.com/publisher-signup/en/awin/step1](https://ui.awin.com/publisher-signup/en/awin/step1) |
| **Publisher terms** | [awin.com/gb/legal/publisher-terms-and-conditions](https://www.awin.com/gb/legal/publisher-terms-and-conditions) |
| **Payment thresholds** | [success.awin.com — Payment thresholds](https://success.awin.com/articles/en_US/Knowledge/What-are-the-payment-thresholds) |
| **TR tax residency payments** | [success.awin.com — Turkish Tax Residency](https://success.awin.com/articles/en_US/Knowledge/Payments-for-publishers-with-Turkish-Tax-Residency) |
| **Network record** | `net-awin` |

**Account cost:** USD **1 refundable security deposit** per Awin publisher marketing pages (invitation code may waive — **unverified for PiercingConnect**).

---

## Eligibility requirements

From verified `net-awin` and `country-tr` records:

| Requirement | Detail | Owner action |
|-------------|--------|--------------|
| **Tax residency** | Turkey tax residency explicitly supported; dedicated Payoneer + invoice workflow | Confirm TR tax residency country selectable in Awin Tax Details |
| **Tax Details gate** | If tax residency country **not listed**, services unavailable (per network FAQ) | Verify Turkey appears before paying deposit |
| **Promotional property** | Promotional space **URL + description** required | Provide piercingconnect.com + description (draft below) |
| **Social profiles** | May be listed in signup | Optional; provide only if owner chooses |
| **Security deposit** | USD 1 refundable (unless invitation waives) | Owner payment method for deposit |
| **PayPal** | **Not** required for TR workflow | Payoneer path confirmed Sprint 006-B |
| **Piercing content** | No network-level piercing ban found | Per-advertiser terms still apply before placing links |

---

## Required business / tax information checklist

Complete in Awin portal at submission. **Do not paste secrets into this pack.**

- [ ] **Publisher / business name** — legal or trading name owner will use on invoices
- [ ] **Tax residency country** — Turkey (must be selectable in Tax Details)
- [ ] **Tax identification** — as required by Awin Tax Details form (**owner enters in portal only**)
- [ ] **Business address** — as required by signup
- [ ] **Contact email and phone** — owner-provided
- [ ] **Promotional website URL** — `https://piercingconnect.com`
- [ ] **Payoneer account** — required for TR tax-resident payout workflow (invoice Awin Ltd → Payoneer within ~14 days per `pay-awin-default`)
- [ ] **USD 1 security deposit** — payment for account activation (refundable per Awin marketing)

**Missing from repo (owner must supply):** legal/trading name, tax ID, address, contact details, Payoneer account status, deposit payment.

---

## Required website information

| Field | Suggested value | Notes |
|-------|-----------------|-------|
| **Primary promotional URL** | `https://piercingconnect.com` | From application stubs |
| **Site status** | Launch / publishing phase | Hubs not yet published (`editorial_gate.hub_published: false`) |
| **Content focus** | Piercing aftercare editorial, body jewelry guides, product comparisons | Consistent with Sprint 007 merchant pitches |
| **Disclosure** | Affiliate disclosure on commercial pages | `policy-disclosure-default`; TR/EU variant unresolved |
| **Example URLs** | *Owner to list published posts when available* | Empty on all Awin application stubs |
| **Site language** | Owner to confirm primary locale(s) | Not specified in repo |

Awin does **not** document the same ~10-post / 3-sale gates as Amazon TR in our records — website URL and description are the primary documented signup requirements.

---

## Suggested PiercingConnect business description

*For Awin “describe your promotional space / website” fields.*

> PiercingConnect is an editorial website in launch phase covering body piercing aftercare and jewelry. We publish original guides and comparisons to help readers research safe care products and jewelry options. Content is independent of affiliate relationships: we disclose commissions clearly and do not let payment influence rankings or evidence boundaries. Our primary promotional property is piercingconnect.com (WordPress). We intend to join relevant Awin advertiser programs for piercing jewelry and aftercare-adjacent products where editorially appropriate, starting with documented body-jewelry merchants after publisher approval.

---

## Suggested traffic and promotion methods description

*No traffic volumes stated.*

> We drive traffic through organic search and editorial discovery on our WordPress site. Promotion methods include in-article text links and banners where permitted by advertiser program terms, embedded only in contextually relevant aftercare and jewelry content. We do not use trademark PPC, misleading health claims, or undisclosed social promotion. Social channels may be added later with full disclosure where advertiser and Awin terms allow; follower counts and profile URLs will be provided only when accounts are active and compliant. The site is in launch/publishing phase while we expand our original article library.

---

## Supported channels

Network-level (`net-awin`): promotional space URL required; social may be listed. **Per-advertiser restrictions apply** after joining programs.

| Channel | Network signup | Post-approval (Sprint 007 merchants) | PiercingConnect plan |
|---------|----------------|--------------------------------------|----------------------|
| **WordPress** | Primary documented property | OUFER: welcomed (Awin). BODYJEWELRY: allowed; PPC/trademark restrictions on search. Piercingline: website-focused; thematic fit required. | **Primary channel** |
| **YouTube** | May list in signup | OUFER: brand mentions YouTube — re-verify. Others: unresolved on public terms. | Defer until profile URLs and advertiser terms confirmed |
| **Instagram** | May list in signup | OUFER: brand mentions — re-verify. Painful Pleasures (not prioritized): Reels allowed. | Defer; disclose if used |
| **Facebook** | May list in signup | BODYJEWELRY: merchant social linked on Awin; affiliate rules unresolved. | Defer |
| **Pinterest** | May list in signup | OUFER: brand mentions — re-verify. Others: unresolved. | Defer |
| **X** | May list in signup | Unresolved for Sprint 007 Awin merchants. | Defer |

**Note:** Awin publisher signup does not document Amazon-style ≥500 follower gates. Individual advertisers may impose channel rules in program terms — check each program before linking.

---

## Disclosure commitment

Reference: `policy-disclosure-default`

**Template text:**

> We may earn a commission from qualifying purchases made through links on this page. Product inclusion, limitations, and editorial verdicts are independent of commission. Affiliate relationships do not create a ranking and do not remove documented evidence gaps on reviewed products.

**Commitments for Awin application and post-approval:**

- [ ] Disclosure on every WordPress page with Awin tracking links
- [ ] Per-advertiser terms reviewed before first link (medical/health claim prohibitions common)
- [ ] Social disclosure if/when social promotion is used
- [ ] `disclosure.template_id: policy-disclosure-default` on joined programs unless custom addendum required
- [ ] TR/EU legal copy — owner/legal review pending

---

## Payment setup checklist

From `pay-awin-default` and TR tax residency article:

| Step | Detail |
|------|--------|
| [ ] **Open Payoneer account** | Required workflow for TR tax-resident publishers |
| [ ] **Complete Awin Tax Details** | Turkey must be selectable |
| [ ] **Set payment threshold** | Publisher-set minimum; **USD/EUR/GBP 20** documented; default if unset **50 GBP/EUR/USD**; TRY equivalent unresolved — set in account |
| [ ] **Supported methods** | Payoneer (TR path), SEPA, BACS, ACH, domestic transfer, international wire |
| [ ] **Payout schedule** | Payable balance on **1st or 15th** when threshold met by prior 15th or month-end |
| [ ] **TR invoicing** | Issue invoice to **Awin Ltd** referencing payment notification PDF |
| [ ] **Payoneer receipt** | Typically within **14 days** of invoice receipt (per payment record) |
| [ ] **PayPal** | Not used for TR Awin workflow; PayPal unavailable to TR-resident publishers |

**Owner actions:** Payoneer linkage and bank details entered in Awin/Payoneer portals only — never in repo.

---

## Approval risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Turkey not listed in Tax Details** | High — blocks services | Verify before deposit |
| **Payoneer not ready** | Medium — blocks payout not signup | Set up Payoneer in parallel |
| **Thin / pre-launch site** | Medium | Site in launch phase — publish core disclosure + initial editorial before submit |
| **Promotional URL offline or placeholder** | High | Confirm piercingconnect.com resolves with real content |
| **Security deposit payment failure** | Low | Have USD 1 payment method ready |
| **Advertiser rejection post-approval** | Medium | Piercingline reviews thematic fit; off-topic sites may be rejected |
| **PPC/trademark violations (BODYJEWELRY)** | Medium post-join | Read Awin program terms before search ads |
| **Health/medical overclaims** | Medium | Editorial firewall per `country-tr` |

---

## Post-approval activation steps

### A. Network account

1. **Confirm publisher account active** in Awin dashboard.
2. **Complete Tax Details** and **Payoneer** linkage for TR tax residency workflow.
3. **Set payment threshold** and currency preferences.
4. **Update `net-awin`** — `publisher_account.enrolled_at` when ID known (secure ops only).

### B. Join priority advertiser programs (Sprint 007 — draft stubs ready)

Apply to each program **separately** after publisher approval:

| Priority | Program | Join URL | Application stub |
|----------|---------|----------|------------------|
| 1 | OUFER Body Jewelry (91941) | [Awin join US/advertiser=91941](https://ui.awin.com/publisher-signup/us/awin?advertiser=91941) | `app-oufer-awin-2026-07` |
| 2 | BODYJEWELRY.COM (63864) | [Awin join US/advertiser=63864](https://ui.awin.com/publisher-signup/us/awin?advertiser=63864) | `app-bodyjewelry-awin-2026-07` |
| 3 | Piercingline (18471) | [Awin join DE/advertiser=18471](https://ui.awin.com/publisher-signup/de/awin?advertiser=18471) | `app-piercingline-awin-2026-07` |

**Verified terms (commission snapshots on file):**

- OUFER: **15%** CPS, **45-day** cookie — `comm-prog-oufer-awin-global-2026-07-15`
- BODYJEWELRY: **15% / 20% VIP**, **45-day** cookie — `comm-prog-bodyjewelry-awin-us-2026-07-15`
- Piercingline: **12% / 8% voucher**, **30-day** cookie — `comm-prog-piercingline-awin-de-2026-07-15`

### C. Editorial and records

5. **Place links** only on editorially approved pages (`editorial_approved: false` until editorial lead sign-off).
6. **Apply disclosure** on every commercial page.
7. **Update application stubs** — `submitted` / `approved` with dates when human completes each step.
8. **Activate program records** — set `prog-*-awin-*` to `active` when approved.

---

## Related records

| Record | ID |
|--------|-----|
| Network | `net-awin` |
| Payment | `pay-awin-default` |
| Country | `country-tr` |
| Disclosure | `policy-disclosure-default` |
| Merchant apps (post-approval) | `app-oufer-awin-2026-07`, `app-bodyjewelry-awin-2026-07`, `app-piercingline-awin-2026-07` |

**Do not submit via this document.** Human operator uses official Awin portal only.
