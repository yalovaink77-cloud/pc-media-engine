# Amazon Türkiye Gelir Ortaklığı — Application Pack

**Sprint:** Application 001  
**Prepared:** 2026-07-15  
**Status:** Preparation only — **not submitted**  
**Source records:** `net-amazon-associates`, `prog-amazon-associates-tr`, `merchant-amazon-associates-tr`, `app-amazon-associates-tr-2026-07`, `pay-amazon-associates-tr-default`, `policy-disclosure-default`, `country-tr`

---

## Official application URL

| Item | Value |
|------|--------|
| **Portal** | [Amazon Türkiye Gelir Ortaklığı](https://gelirortakligi.amazon.com.tr/) |
| **Operating agreement** | [gelirortakligi.amazon.com.tr/help/operating/agreement](https://gelirortakligi.amazon.com.tr/help/operating/agreement) |
| **Payment help (TR)** | [gelirortakligi.amazon.com.tr/help/node/topic/GJCKWFEECYW25FGJ](https://gelirortakligi.amazon.com.tr/help/node/topic/GJCKWFEECYW25FGJ) |
| **Application stub** | `app-amazon-associates-tr-2026-07` (`status: draft`) |

**Publisher path:** TR tax residents enroll via the **Amazon Türkiye** portal, not the generic US Associates path (`affiliate-program.amazon.com` is documented as an alternate only).

---

## Eligibility requirements

From verified network and merchant records (Sprint 006 / 007):

| Requirement | Detail | Owner action |
|-------------|--------|--------------|
| **Tax registration** | TR tax-registered **individual**, **sole proprietor**, or **business** required. Non-tax-exempt individuals cannot participate. | Confirm entity type and active TR tax registration before applying. |
| **Tax interview** | Required before payout; manual or automatic invoicing per TR tax status; withholding rules in TR billing help. | Complete Amazon tax interview in portal after enrollment — **do not store tax IDs in this repo**. |
| **Original public content** | Site must host original, public content meeting Amazon participation requirements. | PiercingConnect is in **launch/publishing phase** — publish original editorial before or during review window. |
| **Website content gate** | Websites need **~10 posts within 60 days** (per Sprint 006 research). | Owner must confirm current published post count and URLs — **not documented in repo**. |
| **Sales gate** | **3 qualifying sales within 180 days** trigger application review (per Sprint 006 research). | Plan compliant link placement; owner tracks qualifying sales — **no traffic numbers invented here**. |
| **Unsuitable content** | Violence, illegal activity, IP violations, misleading content (per operating agreement mirror). | Avoid medical cure/treatment claims beyond product facts on aftercare content. |
| **Account cost** | Free (per eligibility report). | — |

---

## Required business / tax information checklist

Complete in the Amazon portal at submission time. **Do not paste values into this pack.**

- [ ] **Entity type** — individual / sole proprietor / registered business (must match TR tax status)
- [ ] **Legal name** — as registered for TR tax purposes
- [ ] **TR tax registration** — active and verifiable (hard prerequisite per `net-amazon-associates`)
- [ ] **Tax interview** — completed in Associates account before first payout
- [ ] **Invoicing mode** — manual vs automatic per TR tax status (per network notes)
- [ ] **Contact details** — email and phone as required by portal (owner-provided only)
- [ ] **Withholding / billing** — review TR billing help in portal; rules documented officially — legal review unresolved for PC

**Missing from repo (owner must supply at submission):** entity type, legal name, tax registration proof status, contact details, tax interview completion.

---

## Required website information

| Field | Suggested value | Notes |
|-------|-----------------|-------|
| **Primary site URL** | `https://piercingconnect.com` | From `app-amazon-associates-tr-2026-07` |
| **Site status** | Launch / publishing phase | `editorial_gate.hub_published: false` on application stub |
| **Content type** | Original editorial — piercing aftercare, jewelry guidance, product comparisons | Aligns with `pitch_summary` on application stub |
| **Disclosure** | Live affiliate disclosure on commercial pages | Use `policy-disclosure-default` template text; TR/EU legal variant **unresolved** — owner/legal review pending |
| **Privacy / terms** | Standard site policies if required by portal | **Not verified in repo** — confirm before submit |
| **Example content URLs** | *Owner to list 2–3 published URLs* | `content_examples: []` on stub — empty |

**Amazon content gate reminder:** ~10 posts within 60 days — owner must verify count before relying on website-only enrollment.

---

## Suggested PiercingConnect business description

*Copy-ready draft for portal “about your site/business” fields. Adjust only for factual accuracy at submit time.*

> PiercingConnect is an editorial website in launch phase, focused on body piercing aftercare and jewelry guidance. We publish original, evidence-informed articles and product comparisons for people researching safe piercing care and jewelry choices. Our content is independent of commercial relationships: affiliate links are disclosed clearly, and commission does not determine product verdicts or rankings. Primary audience: readers researching aftercare products and piercing jewelry via Amazon.com.tr and related editorial context. Site language and market focus include Turkey and English-speaking readers interested in piercing care.

---

## Suggested traffic and promotion methods description

*No traffic volumes stated — owner must not invent metrics.*

> PiercingConnect promotes Amazon.com.tr products through editorial articles and guides embedded on our WordPress site. We link only where editorially relevant (aftercare, saline solutions, jewelry accessories available on Amazon TR). We do not use paid search on trademark terms, coupon-only sites, or misleading claims. Social promotion (where profile gates are met) will use fully disclosed affiliate links in post captions or descriptions. The site is currently in launch/publishing phase; we are building a library of original posts to meet program content requirements. We comply with Amazon’s operating agreement and clearly disclose affiliate relationships on every page containing commercial links.

---

## Supported channels

From `merchant-amazon-associates-tr` and `prog-amazon-associates-tr` records:

| Channel | Supported | Requirements / restrictions | PiercingConnect plan |
|---------|-----------|----------------------------|----------------------|
| **WordPress** | Yes | ~10 posts within 60 days for websites | **Primary channel** — editorial hub at piercingconnect.com |
| **YouTube** | Yes | Full channel URL; typically **≥500 organic followers** | Use only if owner confirms gate met — **follower count not in repo** |
| **Instagram** | Yes | Full profile URL; typically **≥500 organic followers** | Same — disclose in captions; gate unverified |
| **Facebook** | Yes | Public pages/groups only; typically **≥500 followers** | Same — gate unverified |
| **Pinterest** | **Unresolved** | Not listed in Sprint 006 Amazon social list | Verify in current Amazon TR policy before using |
| **X (Twitter)** | Yes | Full profile URL; typically **≥500 organic followers** | Same — gate unverified |

**Also documented for Amazon TR social (Sprint 006):** Twitch — not in user channel list; omitted unless owner adds.

**Per-advertiser note:** Amazon Associates is marketplace-wide; piercing-specific bans not found in official participation requirements (`net-amazon-associates`).

---

## Disclosure commitment

Reference: `policy-disclosure-default`

**Template text (default):**

> We may earn a commission from qualifying purchases made through links on this page. Product inclusion, limitations, and editorial verdicts are independent of commission. Affiliate relationships do not create a ranking and do not remove documented evidence gaps on reviewed products.

**Commitments for Amazon application:**

- [ ] Disclosure appears on **every page** containing Amazon affiliate links
- [ ] Disclosure placed **end of article**, not in safety/escalation/medical-advice sections (`policy-disclosure-default` usage rules)
- [ ] Social posts with affiliate links include clear disclosure (FTC-style; Amazon TR TOS)
- [ ] No medical cure/treatment claims beyond documented product facts (`country-tr` piercing content caution)
- [ ] TR/EU locale-specific disclosure copy — **legal review unresolved**; owner to confirm before launch

---

## Payment setup checklist

From `pay-amazon-associates-tr-default`:

| Step | Detail |
|------|--------|
| [ ] **Choose payout method** | Direct deposit (default path), Amazon.com gift card, or cheque |
| [ ] **Minimum threshold** | **TRY 100** for direct deposit or gift card |
| [ ] **Cheque threshold** | **TRY 1000** — not default path for PC |
| [ ] **Payout timing** | Monthly when threshold met; paid ~**60 days after month-end** |
| [ ] **Tax information** | Must be complete before payout |
| [ ] **Currency** | TRY |
| [ ] **PayPal** | **Not** an Amazon TR payout method; unusable for TR-resident publishers (Sprint 006-B) |

**Owner actions (not stored here):** enter bank details for direct deposit in Amazon portal only; confirm gift-card preference if chosen.

---

## Approval risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **TR tax registration missing or wrong entity type** | High — hard block | Confirm registration before apply |
| **Insufficient published content (~10 posts / 60 days)** | High | Site in launch phase — publish original posts first |
| **Fewer than 3 qualifying sales in 180 days** | High | Plan compliant links; track qualifying orders |
| **Social enrollment below ~500 followers** | Medium (if using social) | Apply via website channel first if gate not met |
| **Missing or weak affiliate disclosure** | Medium | Publish `policy-disclosure-default` on site before links go live |
| **Medical/overclaim language on aftercare** | Medium | Editorial firewall; product facts only |
| **Pinterest / unlisted channels** | Low | Verify current Amazon TR policy before use |
| **Application during pre-launch with empty content** | High | Delay submit until minimum viable editorial library exists |

---

## Post-approval activation steps

1. **Complete tax interview** in Gelir Ortaklığı account before expecting payout.
2. **Configure payout method** — direct deposit or gift card; confirm TRY 100 threshold understanding.
3. **Generate links** only for Amazon.com.tr SKUs editorially relevant to published content (piercing aftercare, jewelry — per PC cluster).
4. **Apply disclosure** using `policy-disclosure-default` on every commercial page.
5. **Track content and sales gates** — ~10 posts / 60 days; 3 qualifying sales / 180 days (owner monitoring).
6. **Update application record** — set `app-amazon-associates-tr-2026-07` to `submitted` then `approved` with dates when human completes steps (no auto-submit).
7. **Set `prog-amazon-associates-tr`** to `active` and populate `publisher_account` on `net-amazon-associates` when credentials exist — **store IDs only in secure ops, not in repo**.
8. **Review operating agreement** periodically; `review_due: 2026-10-15` on verification blocks.

---

## Related records

| Record | ID |
|--------|-----|
| Network | `net-amazon-associates` |
| Program | `prog-amazon-associates-tr` |
| Merchant | `merchant-amazon-associates-tr` |
| Payment | `pay-amazon-associates-tr-default` |
| Application stub | `app-amazon-associates-tr-2026-07` |
| Disclosure policy | `policy-disclosure-default` |

**Do not submit via this document.** Human operator uses official portal only.
