# VyapOne — Product Requirements Document v3.0

**Har business. One platform.**

| | |
|---|---|
| **Version** | 3.0 — full-scale launch specification (replaces v2.0 and v1.0) |
| **Date** | 30 October 2026 |
| **Product** | VyapOne |
| **AI assistant** | Vya |
| **Positioning** | GoHighLevel for Bharat's resellers: build, run and bill every local business from a phone |
| **Launch market** | India: resellers, freelancers, students and agencies who serve local businesses, plus business owners who build for themselves (DIY) |
| **Primary experience** | Mobile-first installable PWA (offline-tolerant), WhatsApp as the second interface, a staff counter mode and a web dashboard for agencies |
| **Launch target** | v1.0 General Availability (GA): a complete, polished, production-ready product, launched properly |
| **Status** | Pre-launch. Every price and numeric target in this document is a hypothesis to validate during beta |

---

## What changed from v2

v2 was written around a pilot MVP: one vertical first, most features phased. v3 is a **full-scale launch spec**. Everything a reseller, a business owner, their staff and their customers need ships at **v1.0 GA**, built to production standards for security, reliability, compliance and support. Only items that depend on outside ecosystems wait for **post-launch expansion**.

| Area | v2.0 (MVP-framed) | v3.0 (full-scale launch) |
|---|---|---|
| Scope model | MVP + Phase 2/3/4 | **One launch scope (v1.0 GA)** + a short post-launch expansion list for ecosystem-dependent items |
| Verticals | 1 fully operational vertical at MVP | **Every niche group has its operational module at GA** (orders, bookings, stay, classes, jobs, property, rentals, udhaar) |
| WhatsApp | Level 1 + confirmations; catalogue and inbox later | **Both levels at GA**: click-to-chat, Cloud API notifications, broadcasts, catalogue sync, shared inbox, Vya on WhatsApp |
| Payments | UPI QR only; gateway later | **UPI intent/QR + full payment gateway** (Razorpay / Cashfree / PhonePe PG), verified status, refunds, payment links, AutoPay |
| Billing | GST-ready bills; no e-invoice | GST bills + **e-invoice (IRN) for eligible businesses**, thermal printing, Tally/Zoho Books export |
| Automation | Manual broadcasts; reminders later | **Workflow engine** (triggers → conditions → actions), ready-made automations per niche, scheduled broadcasts, cart/booking nudges, payment reminders |
| Integrations | WhatsApp, UPI, split settlement | **Full integration layer**: Google Business Profile, Maps, Meta catalogue + posting, delivery partners, accounting, e-invoice, SMS/email, Zapier, webhooks, public API |
| Vya | Builder + daily summary | **Builder + daily assistant + reseller coach**, voice in and out, 8 Indian languages + English |
| Growth tools | GBP, reviews, social, loyalty phased | **All at GA**: GBP sync, reviews, loyalty, offers, auto social creatives, referral |
| Reseller toolkit | Client billing + basic earnings | Client billing, **full earnings dashboard, white-label, Academy + certification, referral, proposal kit, expert-help lead routing** |
| Onboarding | A short reseller signup | **Onboarding for every role**, activation checklists, in-app tour, import tools, assisted setup |
| Analytics | Basic owner metrics | **Owner, reseller portfolio and platform admin BI**: funnels, cohorts, retention, Vya insights, exports |
| Security & compliance | Principles | **Production controls**: DPDP Act 2023, RBI payment rules, GST, CERT-In, RBAC, audit logs, encryption, DR, pen tests, SOC 2-ready |
| Reliability | Draft SLOs | **SLOs, load targets, multi-region readiness, observability, incident response** |
| Quality | Playwright journeys | **QA strategy, device matrix, WCAG 2.2 AA, performance budgets** |
| Launch | Pilot in one city | **Private beta → public beta → GA**, readiness checklist, human support, help centre, in-app chat, GTM |
| Pricing | Plans + add-ons (hypotheses) | Same model, still hypotheses, plus a **feature-by-plan matrix** |

**Kept from v2:** the positioning, the market facts and their sources, Vya's controlled action model, the Platform → Reseller → Business → Location hierarchy, generation from approved components (never arbitrary code), client billing as the retention moat, the pricing model, the emerald design system and the brand line.

---

## 1. Executive Summary

VyapOne lets a reseller run a complete digital-services business from a phone, and lets every local business they serve run its day on one platform. A reseller signs up a business; Vya proposes and builds its website, operational module and go-live kit in minutes. From day one the business takes orders, bookings or enquiries on its site and on WhatsApp, collects money by UPI or a full payment gateway, issues GST bills, keeps a customer list, runs automated reminders and offers, stays in sync with Google and Instagram, and sees how the month is going. The reseller manages, white-labels and bills every client inside VyapOne and is paid automatically each month.

**Why a full-scale launch:**

1. **The site alone doesn't sell.** Hostinger sells unlimited AI-built sites in India from ₹199/mo (Hostinger India pricing page, read 30 Oct 2026). VyapOne has to win on what a business can *do* every day, and that needs the full operating layer at launch, not a builder with promises.
2. **Indian small businesses run on WhatsApp and UPI.** WhatsApp, payments, billing and automation are the product, so they ship complete and reliable.
3. **Resellers need a whole kit to sell.** GoHighLevel shows agencies pay for a toolkit that lets them run and bill clients ($97–$497/mo; gohighlevel.com/pricing, read 30 Oct 2026). A reseller can only sell VyapOne to a salon, a kirana and a coaching centre in the same week if every vertical works.
4. **Trust is earned once.** A polished, secure, supported launch protects resellers' reputations with their own clients. A shaky launch in this category is hard to recover from (see the Dukaan lesson, section 28).

**Product promise:** *Build it in minutes. Run it every day. Get paid every month.*

---

## 2. Market, Problem and Positioning

### 2.1 Market facts (from the research notes, 30 Oct 2026)

| Fact | Value | Source |
|---|---|---|
| Udyam-registered MSMEs | 9.16 crore (1.65 crore on 1 Apr 2023) | PIB press release, 7 Aug 2026 |
| MSMEs with their own website | 26.9% of 7,835 surveyed | India SME Forum, META Report Card 2025 (Dec 2025). A survey, not a census |
| MSMEs fully offline | 46.2% of the same sample | Same report |
| India website-builder market | USD 0.45 bn (2024), 27.7% CAGR | Market.us, Sep 2025. **Analyst estimate** |
| SMB SaaS churn | No credible India-specific study found. Generic SMB SaaS benchmark is 3–5% monthly | Mercury blog (search snippet). **Generic, not India** |

What this means: demand is not the limit. Getting small businesses to **pay** and **stay** is. The year-5 base case in the market note needs ~26,000 businesses, about 0.03% of Udyam MSMEs. The constraint is reseller acquisition and retention, not market size.

### 2.2 The problems we solve

| For | Problem today | What VyapOne does |
|---|---|---|
| Business owner | Orders and enquiries get lost in WhatsApp chats; bills are handwritten; no customer list; invisible on Google; no idea how the month went | One place for orders, bookings, bills and customers, wired into WhatsApp, UPI and Google |
| Reseller / freelancer | Can build a site, but has nothing to sell after launch, and chasing monthly payments from clients is painful | A recurring service to sell (site + ops), tools to run every client from a phone, and automatic monthly collection |
| End customer | Has to call or chat to ask "open today?", "price?", "where's my order?" | Browse, order or book, pay by UPI and get updates on WhatsApp |

### 2.3 Competitive position

| Player | Price (as researched) | Their strength | VyapOne's answer |
|---|---|---|---|
| Hostinger AI Builder | ₹139/mo for 3 sites; ₹199/mo unlimited (48-mo prepay; renews ₹449 / ₹649) | Brand, hosting, domains | No reseller workspace, ops modules or client billing |
| Shopify India | Basic ₹1,499/mo | Best-in-class commerce | Too costly and too e-commerce-only for a salon or kirana |
| Instamojo | Free; ₹3,999–₹9,999/yr; Starter adds 5% + ₹3 per transaction | Payments licence, free tier | VyapOne covers service niches and resellers |
| Dukaan | From ~₹299/mo + per-order fee (third party, **unverified**) | WhatsApp-style stores | **Lesson:** live stores fell to 2,084 from a 3,860 peak (Store Leads, Oct 2026) after support was cut for an AI bot (CNN, 12 Jul 2023) |
| Duda / 10Web | Duda White Label $199/mo; 10Web white-label demo-led | Mature agency white label | Desktop-first, USD-priced, no Indian ops modules |
| GoHighLevel | $97 / $297 / $497 per month | Full agency stack + SaaS mode | 20–100x VyapOne's price; English/US-centric; not built for a phone |
| Durable | Free; $25 / $49 per month | Instant AI site + CRM + invoicing | DIY for owners, not resellers; no Hindi or Indian niches |

Sources: vyapone-market.md and vyapone-positioning-global.md (vendor pricing pages read 30 Oct 2026 unless noted).

**What GA must close:** today VyapOne has no users, payment rails, templates, integrations or support team. Nothing stops a reseller using Hostinger at ₹199 and charging a client ₹1,000. The launch scope in this document exists to close those gaps on day one, so **VyapOne wins on the workflow (propose → build → run → bill), not on the site.**

### 2.4 Positioning statement

> For India's freelancers, students and small agencies who build digital presence for local businesses, **VyapOne** is the phone-first platform that lets them build, run and bill every client in one place. Unlike cheap AI site builders, VyapOne keeps working after launch: WhatsApp orders, UPI payments, GST bills and customer offers, with the reseller paid automatically every month.

---

## 3. Goals and North Star

### 3.1 North-star metric

**Weekly Operating Sites (WOS):** live sites where the business recorded at least one real action in the week: an order, booking, bill, payment, enquiry handled or broadcast. A published site nobody uses is not success.

### 3.2 Product goals at GA

1. A reseller creates a client business and publishes a working site with its operational module from a phone in under 15 minutes (target).
2. Every live business can take an order, booking or enquiry, collect payment (UPI or gateway) and send a GST bill on day one.
3. Every niche group in the catalogue has a complete operational module, not just a website.
4. The owner uses VyapOne daily through Vya's WhatsApp summary and automations, even without opening the app.
5. The reseller's client fees are collected automatically, with a full earnings view.
6. The whole product works in English and 8 Indian languages, by voice as well as by text.
7. The platform meets its SLOs, security controls and compliance obligations from the first public day.

### 3.3 Business goals in year 1 (hypotheses)

1. Resellers stay: monthly reseller logo churn under 5%, heading to under 3%.
2. Resellers earn: the median active reseller bills clients more than their VyapOne plan costs by their second month.
3. Per-site revenue: at least a third of live sites use a paid add-on, the Pro pack or client billing.
4. Support stays sustainable: support minutes per live site fall month on month.
5. Unit economics hold: positive messaging margin in every country table entry, AI cost per site within budget.

### 3.4 Out of scope at GA

- Arbitrary code generation or custom-coded sites (by design, permanently).
- GST return filing, payroll and full double-entry accounting (VyapOne exports to Tally and Zoho Books instead).
- Holding or pooling customer or client money (always through licensed providers).
- The ecosystem items in **Post-launch expansion** (section 30).

---

## 4. Users, Roles and Hierarchy

### 4.1 Tenant hierarchy (kept, extended)

`Platform → Reseller workspace → Business → Location`

- A **reseller workspace** owns many businesses and has team members.
- A **business** is one client brand. It has an owner, staff, one or more locations, one live site and its modules.
- A **location** is a physical outlet (timings, address, staff, stock, QR codes, Google profile). Multi-location ships at GA: per-location timings, staff, stock, bill series, QR codes and Google profiles, with a combined owner view.
- A **DIY workspace** is a reseller workspace of one, owned by the business owner directly.

### 4.2 Roles

| Role | Who | Can |
|---|---|---|
| Platform admin | VyapOne team (support, finance, trust & safety, ops) | Manage plans, templates, modules, moderation, support, payouts, audit, with least-privilege admin roles and every action logged |
| Reseller owner | Freelancer, student, agency founder | Create and manage businesses, set client fees, see earnings, white-label, manage team |
| Reseller team member | Agency staff | Work on assigned businesses only; no billing access unless granted |
| Business owner | Shop, salon, clinic owner | See and run their own business; pay the reseller; export their data |
| Business staff | Cashier, stylist, waiter, delivery person | Role-limited actions: take orders, make bills, manage bookings; no settings or exports |
| Customer | End buyer | Browse, order, book, pay, give feedback, opt in or out of messages |

### 4.3 Ownership and handover

- The **business owns its data**: customers, orders, bills and content. The reseller manages it on the owner's behalf.
- An owner can export their data at any time, and can move to another reseller or to a DIY plan through a controlled handover. This protects owners and builds trust in the reseller channel.
- A reseller cannot delete a business's customer data without the owner's confirmation.
- If a reseller stops paying, live sites get a grace period (open decision: length), then the owner is offered a DIY plan before anything goes offline.

### 4.4 Primary personas

| Persona | Snapshot | Wins when |
|---|---|---|
| **Rohit, student reseller** | 21, tier-2 city, good with phones, wants side income | He signs 3 shops in his first month and sees "₹3,000 collected" in his earnings dashboard |
| **Priya, small agency** | Runs a 3-person social-media agency | She adds websites + WhatsApp ordering to every retainer, white-labelled as her brand |
| **Sharma ji, café owner** | Speaks Hindi, lives on WhatsApp, distrusts apps | Orders arrive on WhatsApp in a clean format, payment is in by UPI, and a summary shows up every night |
| **Anjali, salon owner (DIY)** | Comfortable with Instagram | Clients book themselves, get reminders and stop no-showing |

---

## 5. Product Principles

1. **Phone first, always.** Every essential task is complete at a 390-pixel viewport, one-handed, on a slow connection. Agencies also get a full desktop dashboard.
2. **WhatsApp is a channel, not an integration.** Where the customer and owner already are, VyapOne shows up there.
3. **Value before setup.** UPI QR, click-to-chat and bills work in minutes; gateway KYC, Meta and Google connections run in the background with guided status.
4. **Structured, not freeform.** Sites and tools are assembled from approved components and modules, never from generated code.
5. **AI proposes, people confirm.** Vya never publishes, sends, charges or deletes without confirmation.
6. **Automate the routine, never the irreversible.** Workflows handle confirmations, reminders and stock; money, deletion and bulk marketing need a person.
7. **Truthful numbers.** A click is not an order; a review link opened is not a review. Metrics say exactly what happened.
8. **Secure and compliant by default.** Least privilege, encryption, consent and audit are built in, not added later.
9. **Global-ready, India-first.** No hardcoded currency, language, tax or phone format.
10. **Launch-grade or not shipped.** Every feature in the launch scope meets the quality bar in section 22 before GA.

---

## 6. Launch Scope (v1.0 GA)

Everything below ships at General Availability. There is no MVP subset: each item meets the acceptance bar in section 31.

| Area | Ships at GA |
|---|---|
| **Accounts & tenancy** | Phone OTP + email, passkeys optional, reseller and DIY workspaces, businesses, multi-location, roles and permissions, team seats, device sessions |
| **Builder** | Full niche catalogue, Vya onboarding by voice/text/photo/link, proposals, generation from presets, mobile editor, desktop editor, versions, rollback, custom domains with SSL, multi-language sites, SEO and LocalBusiness schema |
| **Operational modules** | Orders, appointments, table reservations, stays/rooms, classes and memberships, enquiries/quotes/job cards, property listings, rentals, inventory, udhaar (credit) ledger: every niche group covered (section 11) |
| **WhatsApp** | Level 1 (click-to-chat, order-to-WhatsApp, share) and Level 2 (Cloud API notifications, broadcasts, catalogue sync, shared inbox, Vya on WhatsApp) |
| **Payments** | UPI intent/QR, full payment gateway (UPI, cards, netbanking, wallets), payment links, refunds, deposits, partial payments, UPI AutoPay for subscriptions and client billing |
| **Billing & tax** | GST bills, bills of supply, credit notes, e-invoice (IRN) for eligible businesses, thermal printing, accountant exports (Tally, Zoho Books, CSV/Excel) |
| **CRM & marketing** | Customer list, consent, segments, broadcasts (manual and scheduled), offers and coupons, loyalty, reviews and feedback, referral |
| **Automation** | Workflow engine, ready-made automations per niche, abandoned cart/booking nudges, payment reminders, repeat-order reminders |
| **Growth surfaces** | QR Studio, Google Business Profile sync, Google Maps, Meta (Instagram/Facebook) catalogue + posting, auto social creatives, WhatsApp status creatives |
| **Vya** | Builder, daily business assistant, reseller coach; voice input and voice replies; 8 Indian languages + English |
| **Reseller toolkit** | Client billing with split settlement, earnings dashboard, white-label (brand-lite + full), team, Academy + certification, referral, proposal kit, expert-help lead routing |
| **Staff** | Staff app/counter mode with PIN, roles, attendance and commissions |
| **Analytics** | Owner dashboard, reseller portfolio analytics, platform admin BI, funnels, cohorts, retention, Vya insights, exports |
| **Integrations** | WhatsApp Cloud API, payment gateways, UPI intent, GBP, Maps, Meta, delivery partners, Tally/Zoho Books, e-invoice, SMS/email, Zapier, webhooks, public API |
| **Platform** | Offline-tolerant PWA, admin console, price book, cost tables, wallet and metering, help centre, in-app chat, status page |
| **Trust** | Security, privacy and compliance controls (section 20), SLOs and DR (section 21), QA and accessibility (section 22) |

**Post-launch expansion** (section 30) is reserved for items that depend on outside ecosystems or on a live user base: ONDC, the template/module marketplace, the open lead marketplace, branded native reseller apps, and global markets.

---

## 7. Onboarding and Activation

Onboarding is a product surface in its own right. Each role has a guided path, a visible activation checklist and help at every step. Progress is saved, so a user can stop on a weak connection and resume.

### 7.1 Reseller onboarding (target: first business started within 5 minutes)

1. Sign up with phone + OTP; choose an app language (any of the 9 supported).
2. **"How you earn" walkthrough:** what to sell, illustrative client fees, how client billing and payouts work.
3. Profile: name, city, languages spoken, niches of interest, optional business/GST details for their own invoices.
4. **Payout setup** (can be skipped until the first client pays): bank account via the gateway's linked-account KYC; VyapOne never stores bank credentials.
5. **Academy quick-start** (10 minutes) with an optional certification track.
6. **Demo business:** a sample café pre-built so they can explore every screen without risk.
7. Land on **Create business**, with the activation checklist pinned.

**Reseller activation checklist:** profile complete → first business published → first QR printed → client fee set → first client payment collected → second client added → certification earned. Each step has a "why this matters" line and a Vya shortcut.

### 7.2 Business owner onboarding

Two entry points: **invited by a reseller** (WhatsApp invite link) or **DIY signup**.

1. Accept the invite or sign up; set a PIN; choose an app language.
2. Confirm business facts Vya pre-filled ("to confirm" fields): name, address, timings, items and prices.
3. **Money setup:** UPI ID (or scan the existing shop QR) in under a minute; gateway KYC offered in the background with a status tracker.
4. **WhatsApp setup:** Level 1 works at once; Level 2 through Meta embedded signup with a progress card (number verification, display name, template approvals).
5. Connect Google Business Profile and Instagram/Facebook (optional, guided).
6. Add staff and print QR codes from the go-live pack.
7. Pay the reseller's first invoice (or mark "collected offline").

**Owner activation checklist:** facts confirmed → payment method live → first order/booking/bill → WhatsApp notifications on → first broadcast or automation → Google profile synced → first week's report opened.

### 7.3 Customer onboarding

Customers never "sign up". They scan a QR or open a link, browse in their language, and identify themselves with a name and WhatsApp number at checkout. Consent is asked plainly and separately for transactional and marketing messages. An optional OTP-verified profile keeps order history, saved addresses and loyalty balance across visits to the same business.

### 7.4 Staff onboarding

The owner adds staff by phone number and role. Staff get a WhatsApp invite, set a PIN, and see a role-limited home with a 60-second tour of their three most common tasks.

### 7.5 In-app tour and help

- **Contextual tours** per role on first visit to each major screen (skippable, replayable from Help).
- **Empty states that teach:** every empty list explains what goes there and offers the one action that fills it.
- **Ask Vya anywhere:** "how do I add a holiday closure?" opens the right screen with the field highlighted.
- **Help centre** articles and short videos in every supported language, linked from the screen they explain.
- **Assisted setup:** a "Book a setup call" option for Agency/Scale plans and for DIY owners who get stuck.

### 7.6 Import and migration

Bulk import from a photo of a menu or rate card (Vya extraction, every row "to confirm"), CSV/Excel, an existing WhatsApp Business catalogue, an Instagram profile, a Google Business Profile, or a phone's contacts (imported contacts get no marketing until they opt in).

> **Why this matters:** resellers sell what they can demo confidently, and owners stay when the first week works. Activation checklists turn "signed up" into "operating", which is what the north-star metric counts.

---

## 8. Core User Flows

### 8.1 Create a client business (target: published in under 15 minutes)

1. **Pick a niche** from the catalogue (search + icons), or "Other business".
2. **Tell Vya about it** by voice, text or photos: a shop board, a menu card, a rate list, an Instagram profile link, a Google Maps link.
3. Vya extracts name, address, timings, items and prices into a **draft**, marks every guessed field as "to confirm", and asks only the niche questions that are missing.
4. **Vya proposal:** pages, modules, design direction, the WhatsApp number, the UPI ID and the plan impact ("uses 1 of your 3 sites"). The reseller confirms or edits.
5. **Generate** from approved components. A versioned draft opens in the mobile editor.
6. **Edit** by tapping sections, or by asking Vya ("make the menu photos bigger", "add Diwali offer banner"). Every change shows a preview and can be undone.
7. **Publish** to `business.vyapone.app` (subdomain naming is an open decision) or a custom domain.
8. **Go-live pack** generated automatically: main QR poster, table/counter QR, WhatsApp click-to-chat link, Instagram bio link, Google Business Profile update, "We're online" WhatsApp status image.
9. **Set the client fee** (e.g. monthly amount + optional setup fee) and send the owner a WhatsApp invite with a payment link.
10. The owner joins, sets a PIN, pays (in-app or marked "collected offline") and sees their dashboard.

### 8.2 A business owner's day (the retention loop)

| Time | What happens |
|---|---|
| Morning | Vya's WhatsApp summary: "Yesterday: 14 orders, ₹6,240 in UPI, 2 unpaid bills. Send today's offer to 120 customers?" Owner replies "Yes" or edits it |
| During the day | New order → WhatsApp alert to the owner + confirmation to the customer. Owner taps Accept → status updates go out automatically |
| At the counter | Staff create a bill in 3 taps → the customer gets it on WhatsApp with a UPI link; the bill joins the customer's history |
| Evening | Repeat-order reminders go to customers due for a reorder (opt-in only) |
| Night | Day close: orders, bills, collected vs. pending, top items |

### 8.3 End-customer flow

Scan a QR or open the link (Google, Instagram, WhatsApp) → browse the menu/catalogue/services in their language → add to cart or pick a slot → enter a name and WhatsApp number → pay by UPI (or pay at counter) → confirmation on WhatsApp → status updates → optional feedback request → future offers only if they opted in.

### 8.4 Reseller's month

The earnings dashboard shows clients due, collected, failed and overdue; payouts on schedule; sites at risk (no activity in 7 days); upgrade prompts ("2 clients would benefit from Bookings"); new leads from the marketplace.

### 8.5 DIY owner flow

Same as 8.1, but the owner is the builder. A "Get expert help" button routes them to a certified local reseller (expert-help lead routing, section 13), so DIY feeds the channel instead of competing with it.

---

## 9. Vya — AI Assistant

### 9.1 Identity (kept)

**Name:** Vya · **UI label:** Vya · VyapOne AI · **Primary action:** Ask Vya

> Hi, I'm Vya. Tell me about your client's business, and I'll help you build it, run it and grow it.

### 9.2 Three jobs, all at GA

| Job | For | What Vya does |
|---|---|---|
| **Builder** | Reseller, DIY owner | Onboarding questions, extraction from photos/voice/links, proposal, copy, translations, design choices, missing-info check before publish |
| **Daily assistant** | Business owner | Morning summary, nudges ("3 bills unpaid", "Ramesh usually orders on Fridays"), offer and review-reply drafts, conversational Q&A ("how much did I sell this week?"), automation suggestions, AI insights (section 16) |
| **Reseller coach** | Reseller | Pitch scripts per niche, proposal PDFs for prospects, upsell suggestions, at-risk client alerts, weekly portfolio briefing |

### 9.3 Where Vya lives

- In-app panel for every role, permission-scoped.
- **On WhatsApp** for owners and resellers: summaries and one-tap replies ("Yes, send", "Edit", "Not today") through approved templates and the 24-hour service window.
- **By voice:** hold-to-talk in any supported language or Hinglish; Vya replies in text or voice.

### 9.4 Action model (kept)

`Request → intent + permission check → proposed tool action → preview/diff → confirmation when material → validated execution → logged result`

Low-risk reversible actions (drafting copy, rearranging sections) apply to the draft with undo. Material actions need explicit confirmation: publishing, sending any broadcast, changing prices, charging a client, deleting anything, changing payment or WhatsApp settings.

### 9.5 Safeguards (kept and extended)

- Never invent prices, stock, timings, qualifications, legal approvals, property status, reviews or payment success.
- Every AI-extracted fact stays "to confirm" until a person confirms it.
- Broadcast copy shows the exact message, the recipient count and the estimated cost before sending.
- No review gating, fake reviews or incentives for positive reviews.
- Strict tenant scoping: Vya sees only the business and role in the current session.
- Per-plan AI credits, rate limits and abuse controls; a manual path for every AI action when AI is down.
- No exposure of system prompts, keys or other tenants' data.


---

## 10. Core Modules

### 10.0 Module catalogue at a glance

Every module below ships at GA. "Base" is included with every live site; "Pro" is part of the per-site Pro pack; "Vertical" is the operational module included for the site's niche (section 11). Plan availability is in the feature matrix (section 17.3).

| Module | Included in |
|---|---|
| Website engine, catalogue/services, enquiries, QR Studio | Base |
| WhatsApp Level 1 (click-to-chat, share, order-to-WhatsApp) | Base |
| WhatsApp Level 2 (Cloud API notifications, inbox, catalogue sync) | Base set-up, metered messages |
| UPI intent/QR + payment gateway | Base (provider fees pass through) |
| GST bills, credit notes, exports | Base |
| E-invoice (IRN) | Base for eligible businesses (metered per IRN if the provider charges) |
| Customer list (CRM) + consent | Base |
| Broadcasts, scheduled broadcasts, segments | Pro |
| Automation engine | Base (ready-made automations), Pro (custom workflows) |
| Operational module for the niche | Vertical (one included; a second is an add-on) |
| Vya builder + daily summary | Base; Q&A, insights, voice replies use AI credits |
| Google Business Profile sync | Pro |
| Reviews & feedback | Base (request link), Pro (reply drafts, dashboard) |
| Offers & coupons | Base |
| Loyalty | Pro |
| Auto social creatives + Meta posting | Pro + AI credits |
| Staff app & roles | Base (2 staff), seats beyond are an add-on |
| Attendance & commissions | Pro |
| Inventory | Pro |
| Udhaar (credit) ledger | Base for retail; Pro elsewhere |
| Analytics | Base (owner dashboard), Pro (advanced reports, exports) |
| Offline PWA, thermal printing | Base |

### 10.1 Platform core

Authentication and recovery; workspaces, roles and permissions; businesses and locations; subscriptions, entitlements and usage metering; wallet; media library; notifications; audit logs; support inbox and in-app chat; module registry; feature flags; admin console.

### 10.2 Website engine

- Structured pages and sections from approved responsive components; theme tokens.
- Navigation, footer, SEO metadata, sitemap, structured data (LocalBusiness schema) for local search.
- Preview, publish, versioning, rollback.
- Custom domain connection with automatic SSL.
- Multi-language pages: the same structure with translated content per locale.
- Lightweight public pages: fast on a low-end Android phone on 3G/4G; no heavy effects on public sites.

### 10.3 Catalogue and services

Categories; products or services; photos; price, MRP and tax rate; variants and add-ons; availability; search and filters; featured items. Bulk import from a photo of a menu/rate card (Vya extraction, every row "to confirm"), a spreadsheet, a spreadsheet or a WhatsApp Business catalogue (section 7.6).

### 10.4 WhatsApp layer (both levels at GA)

**Level 1: zero setup**
- Click-to-chat buttons on every page (`wa.me` links with prefilled text).
- **Order-to-WhatsApp:** checkout sends a formatted order message to the business, and the order is saved in VyapOne.
- One-tap share of a bill, booking, offer or catalogue item; auto-generated WhatsApp status creatives.

**Level 2: WhatsApp Business Platform (Cloud API)**
- Business numbers onboarded through Meta's embedded signup, with VyapOne as a technology provider (direct Cloud API or a BSP; open decision).
- **Transactional messages:** order received/accepted/ready/out for delivery, booking confirmed, reminder before an appointment, bill with a payment link, payment received, refund issued.
- **Owner and staff alerts** and Vya's daily summary.
- **Marketing broadcasts** to opted-in customers (Pro), manual or scheduled.
- **Catalogue sync** to the WhatsApp Business catalogue, with in-chat ordering flowing back into VyapOne orders.
- **Shared inbox** per business: assignment to staff, quick replies, labels, Vya-suggested replies, conversation history on the customer record.
- **Interactive messages:** buttons and lists for confirm/reschedule/cancel and "reorder last time".

**Rules**
- Templates per niche and language, pre-approved where possible; owners never write raw templates.
- Opt-in recorded per customer and channel with timestamp and source; every marketing message has an opt-out.
- Meta's per-message charges vary by country and category. VyapOne keeps a **cost table per country and category**, updated from Meta's published rates, and prices metered messages at cost plus margin (section 17). India rates must be verified before launch pricing.
- If Level 2 fails or is not set up, VyapOne falls back to Level 1 (share link) and shows the owner what wasn't sent. Number-quality ratings are monitored and broadcasts throttle automatically when quality drops.

### 10.5 Payments: UPI + full gateway

- **UPI intent / dynamic QR** on every order and bill with the amount and reference prefilled; money goes straight to the business; 0% VyapOne fee. With a plain UPI ID, the status stays "Claimed by customer" until staff tap "Received". The UI never shows "Paid" on a claim alone.
- **Payment gateway** (Razorpay, Cashfree or PhonePe PG; adapter-based, more than one can be live): UPI, cards, netbanking and wallets; KYC done by the provider; verified status from signed webhooks; payment links; refunds (full and partial); deposits for bookings; partial payments; **UPI AutoPay** and card mandates for memberships and client billing.
- **Reconciliation:** gateway settlements matched to orders and bills automatically; UPI claims matched against an uploaded bank/UPI statement.
- **Udhaar ledger:** pay-later balances per customer with WhatsApp reminders and a running statement.
- Order status and payment status stay separate. Payment success comes only from server-side verification or explicit staff confirmation.

### 10.6 Bills, GST and e-invoicing

- Create a bill in 3 taps from an order, booking or from scratch (counter billing).
- Business details: name, address, GSTIN if registered, state for place of supply.
- Line items with HSN/SAC, quantity, rate, discount and tax rate; CGST + SGST or IGST computed by the system; round-off; bill of supply for unregistered businesses.
- Sequential, gap-free numbering per business, financial year and location/device series.
- **E-invoice (IRN + signed QR)** through a GSP/IRP integration for businesses above the notified turnover threshold (thresholds to be confirmed with a CA at launch).
- Share on WhatsApp with a PDF and payment link; print on 58/80 mm Bluetooth thermal printers; A4 PDF.
- Credit notes for returns and cancellations; nothing is ever silently deleted.
- Accountant exports: Tally-compatible XML, Zoho Books sync, CSV/Excel, monthly summary by tax rate.
- **Out of scope:** GST return filing. VyapOne gives the owner the data, not tax advice; bill formats are reviewed by a chartered accountant before GA.

### 10.7 Customer list (CRM) and broadcasts

- A customer record is created from every order, booking, bill, enquiry or WhatsApp chat: name, number, visits, total spend, last order, favourite items, tags, notes, loyalty balance, udhaar balance.
- Consent per channel and purpose (transactional vs marketing), recorded and auditable.
- Segments: "new this month", "not seen in 30 days", "top 20 customers", "ordered X", birthdays, custom tags and rules.
- **Broadcasts** (Pro): pick a segment and a template, Vya drafts it, the owner sees the exact text, recipient count and estimated cost, then sends now or **schedules** it. Quiet hours and frequency caps apply.
- Delivery, read and click reporting per broadcast; attributed orders where the link was tracked.

### 10.8 Orders

Cart; server-validated prices; dine-in table, pickup or delivery; delivery zones with distance pricing; order placement; WhatsApp confirmation; accept/reject with reason; status (accepted → preparing → ready → out for delivery → completed); kitchen/counter display; delivery-partner dispatch (section 14); cancellations and refunds; sound + WhatsApp alerts; payment status kept separate.

### 10.9 Appointments and reservations

Services with durations and prices; staff schedules and blocked times; double-booking prevention; instant or request-based confirmation; deposits; WhatsApp confirmation and reminders; reschedule/cancel links; no-show tracking; waitlists; table reservations for restaurants; recurring bookings and packages.

### 10.10 Enquiries, quotes and job cards

Configurable forms per niche; consent capture; source attribution (QR, Google, Instagram, WhatsApp, ads); pipeline stages; assignment; follow-up reminders; **quotation builder** with accept-and-pay links; **job cards** for repair and home services (issue, technician, parts, status, photos, sign-off); spam controls.

### 10.11 QR Studio

Permanent dynamic QR codes (main, table, counter, product, offer, booking, review, payment, campaign) whose destination can change without reprinting; printable posters and table tents in the brand style; scan analytics per placement; scan-safe contrast and quiet zones.

### 10.12 Google Business Profile and Maps

- Connect the owner's Google account (owner consent; API access approved by Google before GA).
- Push timings, special/holiday hours, website link, photos and posts from VyapOne; keep name, address and phone consistent.
- Pull reviews into the reviews module; Vya drafts replies; the owner approves.
- Profile health check: missing hours, no photos, unanswered reviews.
- Google Maps embeds, directions links and address autocomplete; delivery-zone drawing on a map.

### 10.13 Reviews and feedback

- A private feedback form plus a direct Google review link for **all** customers, whatever their rating. **No review gating**, no incentives for positive reviews, no fabricated or auto-posted reviews.
- Review requests on WhatsApp after a completed order or visit (opt-in, capped), usually via an automation.
- Vya drafts honest replies; the owner approves before posting. Ratings trend and themes in analytics.

### 10.14 Offers, coupons and loyalty

- Offers with validity windows, coupon codes, usage limits and visible terms; an offer banner on the site; a QR per offer.
- Loyalty: visit- or spend-based stamps or points ("10th chai free"), tracked by phone number, no separate app; balance shown on the WhatsApp bill; abuse controls and an audit trail.
- Referral codes for customers ("give ₹50, get ₹50") with per-customer caps.

### 10.15 Auto social creatives and Meta posting

- Turn a catalogue item, offer, festival or review into ready creatives: Instagram post (1:1, 4:5), story/WhatsApp status (9:16), with captions in the business's language.
- Built from brand templates (logo, colours, fonts), so output looks consistent.
- **Festival campaign calendar** with ready creatives a week ahead.
- Publish directly to Instagram and Facebook through Meta's APIs (business account + approval), or schedule, or share manually.
- Uses AI credits; every image and caption is a draft until approved.

### 10.16 Staff app and roles

- Staff mode on a shared counter phone or tablet: PIN login, large-tap UI, role-limited home.
- Roles: manager, cashier, service staff, kitchen, delivery, technician; custom roles on Agency/Scale.
- **Attendance** (clock-in with location check) and **commissions** per service or sale (Pro).
- Every action logged with the staff member's name and device.

### 10.17 Inventory

Stock per location, variants, availability, adjustments, low-stock alerts on WhatsApp, order-linked deductions, simple purchase entries and supplier list, stock reports, audit trail. Batch/expiry tracking for pharmacy-style retail. Full procurement and accounting stay out of scope.

### 10.18 Offline-tolerant PWA

- Installable PWA; the app shell and today's data are cached.
- Bills and counter orders can be created offline, queued locally and synced with server-side conflict checks. Each counter device gets its own bill series prefix (rules confirmed with a CA).
- Clear offline/online state; nothing is shown as "sent" until the server accepts it.

---

## 11. Niches and Operational Modules

Every niche in the catalogue launches with a website **and** its operational module. A **niche preset** = pages + component configuration + enabled modules + onboarding questions + dashboard navigation + WhatsApp templates + bill defaults (HSN/SAC suggestions) + social templates + ready-made automations + validation rules.

| Group | Niches | Operational module at GA |
|---|---|---|
| Food and hospitality | Café, restaurant, bakery/cake shop, sweet shop, cloud kitchen, food stall/truck, caterer | QR menu, orders (dine-in/pickup/delivery), kitchen display, table reservations, custom-cake/catering enquiries |
| Stays | Hotel, homestay, guest house, PG | Rooms and rates, availability calendar, booking with deposit, check-in details, PG rent ledger |
| Beauty, wellness, fitness | Salon, spa, barber, makeup artist, gym, yoga/dance studio, personal trainer | Appointments with staff calendars, packages, memberships with AutoPay, class schedules, attendance |
| Retail and local commerce | Kirana, general store, supermarket, boutique, footwear, jewellery, cosmetics, gifts, flowers, books, electronics, furniture, hardware, paint, sports, pet supplies, nursery | Catalogue + orders, WhatsApp catalogue sync, inventory, udhaar ledger, counter billing, home delivery |
| Professional and home services | Electrician, plumber, carpenter, appliance repair, cleaning, freelancer, consultant, photographer, event planner, travel agency, interior designer | Enquiry → quote → job card → invoice, technician assignment, booking slots, portfolio |
| Automotive and repair | Garage, car/bike wash, detailing, tyres/accessories, mobile/computer repair | Service bookings, job cards with parts and status updates on WhatsApp, pickup/drop |
| Education | Coaching centre, tuition, training institute, music/art class | Batches and classes, enquiries and demo bookings, fee plans with reminders/AutoPay, attendance |
| Real estate | Broker/agent, builder/developer, rental manager, commercial consultant | Property listings with filters, per-property QR, site-visit booking, lead pipeline, agent assignment |
| Operational services and rentals | Laundry, tailor, printing, equipment/clothing rental, party supplies | Order tickets with status, measurements (tailor), rental calendar with deposits and returns |
| Other business | Anything else | Vya maps it to existing modules; anything unsupported is labelled for review, never promised |

Navigation adapts to enabled modules: a salon never sees table orders; a broker never sees a kitchen view.

---

## 12. Automation Engine

### 12.1 How it works

`Trigger → conditions → actions (with delays and branches) → log`

- **Triggers:** order placed/accepted/completed, booking created/upcoming/missed, bill issued, payment received/failed/claimed, cart or booking abandoned, enquiry received, stock below threshold, customer inactive for N days, birthday, review received, schedule (daily/weekly/date), webhook received.
- **Conditions:** customer segment, order value, item, location, time window, consent state, channel available.
- **Actions:** send WhatsApp/SMS/email template, update stock, add tag, create task for staff, request review, issue coupon, add loyalty points, notify owner, call webhook, wait, branch.
- Built visually on a phone from templates; Pro plans can build custom workflows.

### 12.2 Example: order to review

`Order placed → WhatsApp confirmation to customer + alert to owner → stock deducted → order ready → "ready for pickup" message → payment verified → bill sent on WhatsApp → loyalty points added → 2 hours later: review request (opt-in, capped)`

### 12.3 Ready-made automations per niche (on by default where safe)

| Niche group | Automations |
|---|---|
| Food | Order confirmation and status updates, review request, "your usual?" repeat reminder, abandoned-cart nudge, low-stock alert |
| Beauty/wellness | Booking confirmation, 24 h and 2 h reminders, no-show follow-up, rebooking reminder after the service interval, membership renewal |
| Retail | Order and delivery updates, back-in-stock alert, udhaar payment reminder, festival offer |
| Services/automotive | Quote follow-up, job status updates, service-due reminder, payment reminder |
| Education | Demo-class reminder, fee due reminder, attendance alert to parents |
| Real estate | New-listing alert to matching leads, site-visit reminder, follow-up after visit |
| All | Payment reminders on unpaid bills, scheduled broadcasts, birthday offers, inactive-customer win-back, owner daily summary |

### 12.4 Guardrails

- Marketing actions only to opted-in customers, with quiet hours and per-customer caps.
- Every automation shows its expected monthly message count and cost; the wallet caps spend.
- Loop and duplicate protection (idempotency keys, one run per trigger event).
- Run history with each step's result; failed runs alert the owner and retry safely.
- Money, deletion and bulk changes are never automated without a person confirming.

> **Why this matters:** owners don't have time to remember reminders. Automations are what keep a business "operating" every week without the owner opening the app.

---

## 13. Reseller Toolkit (the moat)

### 13.1 Client billing inside VyapOne

The single most important retention feature. The reseller's income flows through VyapOne.

- Per client, the reseller sets: a setup fee (one-time), a monthly or annual fee, a due date and what's included.
- The owner receives a WhatsApp invoice with a payment link; recurring collection via UPI AutoPay or card mandate, with payment-link reminders as a fallback.
- Collection runs through a payment provider's **split-settlement / marketplace product** (e.g. Razorpay Route or Cashfree Easy Split, to be confirmed), so funds settle directly to the reseller's account minus VyapOne's platform fee. VyapOne does not pool or hold client money (legal review required before launch).
- **Platform fee:** a small percentage of the amount collected (hypothesis in section 17), plus the provider's own fees.
- The reseller gets automatic reminders, overdue tracking, receipts and GST invoices for their own services (if they're registered).
- **"Collected offline" mode** for clients who pay cash: free, tracked for the dashboard, no platform fee. This keeps VyapOne useful even when clients won't pay in-app, but in-app collection is the default the UI nudges towards.
- If a client stops paying the reseller, the reseller can pause premium modules for that client after a notice period. The site stays up for the grace period (section 4.3).

### 13.2 Earnings dashboard

Monthly recurring revenue from clients, collected vs due vs overdue, upcoming renewals, payouts, VyapOne costs, **net earnings**, per-client profitability, at-risk clients (no activity, failed payment, owner never logged in), and upsell opportunities.

### 13.3 White-label

| Level | Plan | Includes |
|---|---|---|
| Brand lite | Growth | Reseller logo and name in the owner's dashboard and emails; "Powered by VyapOne" stays in the footer |
| Full white-label | Agency | Custom dashboard domain, own colours, no VyapOne branding on client sites, WhatsApp invoices or emails; reseller support contact everywhere |
| Branded PWA | Scale | A branded installable app icon and splash on the owner's phone (native store apps are post-launch) |

### 13.4 Team

Invite team members, assign businesses, set permissions (build, run, billing), activity log per member, and transfer a client between team members.

### 13.5 VyapOne Academy and certification

- Short lessons in every supported language: finding clients, pitch scripts by niche, pricing services, setting up each vertical, automations, handling support.
- Certification after a practical test (publish a real site that passes a checklist). Certified resellers get a badge, a public directory profile and priority in expert-help routing.
- Partnerships with colleges and skilling programmes to recruit students as resellers.

### 13.6 Referral programme

- Reseller-to-reseller: both get a credit (e.g. a free month, hypothesis) when the referred reseller pays for their first month.
- Owner-to-owner: an owner who refers another business gets a credit through their reseller.
- Fraud controls: credit only on a real paid month; caps per referrer; self-referral detection.

### 13.7 Proposal kit

Vya creates a one-page proposal for a prospect with a live preview link of their draft site, built in 5 minutes during the pitch, plus suggested pricing and a "what you get" sheet in the prospect's language.

### 13.8 Expert-help lead routing

DIY owners who tap "Get expert help", and businesses that come in through VyapOne's own marketing, are routed to certified resellers by location, language, niche and rating. Owners rate resellers after 30 days; poor ratings reduce routing. (An open lead marketplace with paid leads is post-launch.)

---

## 14. Integrations

| Integration | Purpose | Notes |
|---|---|---|
| **WhatsApp Cloud API** | Notifications, broadcasts, inbox, catalogue, Vya on WhatsApp | Embedded signup; technology-provider route; per-country cost table |
| **Payment gateways:** Razorpay, Cashfree, PhonePe PG | Customer payments, refunds, links, AutoPay, split settlement for client billing | Adapter interface; provider-held KYC; no card data on VyapOne servers |
| **UPI intent / dynamic QR** | Zero-setup payments | Direct to the business's bank |
| **Google Business Profile** | Hours, posts, photos, reviews | Requires Google API approval before GA |
| **Google Maps Platform** | Maps, directions, address autocomplete, delivery zones | Usage-metered |
| **Meta (Instagram/Facebook)** | Catalogue sync, post and story publishing, link-in-bio, ad lead forms into enquiries | Business account + app review |
| **Delivery partners** (Shiprocket, Porter/Dunzo-style hyperlocal) | Courier and local delivery dispatch, tracking links on WhatsApp | Partner choice per city; owner's own riders also supported |
| **Accounting:** Tally, Zoho Books | Accountant handoff | Tally-compatible export; Zoho Books API sync |
| **GST e-invoice** (IRP via a GSP) | IRN and signed QR on eligible invoices | Thresholds confirmed with a CA |
| **SMS** (DLT-registered provider) | OTP and fallback messages | TRAI DLT templates and sender IDs |
| **Email** (transactional provider) | Receipts, invoices, reports | SPF/DKIM/DMARC on sending domains |
| **Thermal printers** | Counter bills | Web Bluetooth / ESC/POS where supported |
| **Zapier, Make, webhooks** | Connect anything else | Signed outgoing webhooks with retries |
| **Public REST API** | Agencies and partners | OAuth 2.0 / API keys per workspace, scopes, rate limits, versioning, sandbox |
| **ONDC** | Open-network selling | **Post-launch expansion**, through a seller-side network participant |

Every integration has an adapter, a health check, a status shown to the user and a fallback when it is down.

---

## 15. Languages and Voice

- **At GA:** English plus 8 Indian languages: Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada and Malayalam. This covers the app UI, Vya, WhatsApp templates, bills, public sites and the help centre.
- Each business picks its site languages separately from the owner's app language; customers switch language on the public site.
- Vya translations are drafts until confirmed; brand names, prices and addresses are never translated. Professional review of all UI strings before GA.
- Indic fonts (Noto family), extra line height for Indic scripts, and transliteration input.
- **Voice:** hold-to-talk on every input, in Hinglish and code-mixed speech, with an editable transcript ("Mera cafe Indore mein hai, subah 8 se raat 11 tak khula rehta hai…"). Voice commands for owners ("Aaj ka offer bhejo", "Kal ke orders dikhao"). Vya can reply by voice. Owners with low literacy can run the business by voice and WhatsApp.

---

## 16. Analytics and Reporting

| Audience | What they see |
|---|---|
| **Owner dashboard** | Today and trends: visits, QR scans by placement, enquiries, orders, bookings, bills, revenue (verified vs claimed), repeat customers, top items/services, staff performance, broadcast and automation results, review ratings, Google profile views |
| **Reseller portfolio** | All clients at a glance: activity health, WOS per client, at-risk clients, revenue collected, net earnings, plan usage, upsell opportunities, client churn |
| **Platform admin BI** | Signups → activation → paid funnels, cohort retention (resellers, businesses), WOS, MRR, ARPU, revenue per live site, churn and expansion, messaging and AI margin per country, support minutes per site, feature adoption |

- **Funnels and cohorts:** signup → first publish → first transaction → paid; monthly cohorts of resellers and businesses; retention curves.
- **AI insights from Vya:** plain-language observations with the numbers behind them ("Saturday orders are down 20% for three weeks; last time a weekend offer brought them back"). Insights never invent data and always link to the report.
- **Reports and exports:** daily close, monthly summary, GST summary, staff report, CSV/Excel/PDF export, scheduled reports by WhatsApp or email.
- **Truthful definitions:** a click is not a purchase; a review link opened is not a review; claimed UPI is not received money.
- Privacy: analytics are aggregated; customer-level data stays inside the business's tenant.

---

## 17. Pricing and Packaging

**Every price in this section is a hypothesis to validate in beta.** Prices are monthly, in INR, before GST.

### 17.1 Design principles

1. **Free to start, paid to grow.** A reseller can build and demo for free; money starts when a client goes live.
2. **Revenue grows with each reseller's book**, through extra sites, per-site add-ons, usage and client billing, not only through plan upgrades.
3. **Never undercut the channel.** The DIY owner price is always above what a reseller pays per site.
4. **Pass-through costs are metered.** WhatsApp, SMS and heavy AI use are paid per use, so a heavy user never makes a plan unprofitable.

### 17.2 Reseller plans

| Plan | Monthly | Annual (pay 10, get 12) | Live sites | Per site | Key extras |
|---|---:|---:|---:|---:|---|
| **Free** | ₹0 | — | 1 | — | VyapOne badge, subdomain only, base modules with fair-use caps, small AI allowance |
| **Starter** | ₹399 | ₹3,990 | 3 | ₹133 | Custom domains, client billing, earnings dashboard, 1 team seat |
| **Growth** | ₹999 | ₹9,990 | 8 | ₹125 | Brand-lite white label, 3 team seats, custom automations, larger AI allowance |
| **Agency** | ₹1,999 | ₹19,990 | 20 | ₹100 | Full white label, 10 team seats, public API, priority support |
| **Scale** | Custom | Custom | 20+ | — | Volume pricing, branded PWA, SSO, account manager, SLA |

A 14-day Starter trial unlocks when a Free user creates a second business. Annual prepay is about 17% off and cuts churn.

### 17.3 Feature-by-plan matrix

| Feature | Free | Starter | Growth | Agency | Scale |
|---|:-:|:-:|:-:|:-:|:-:|
| Live sites | 1 | 3 | 8 | 20 | 20+ |
| Custom domain + SSL | — | ✓ | ✓ | ✓ | ✓ |
| Operational module for the niche | ✓ | ✓ | ✓ | ✓ | ✓ |
| WhatsApp Level 1 | ✓ | ✓ | ✓ | ✓ | ✓ |
| WhatsApp Level 2 (metered) | — | ✓ | ✓ | ✓ | ✓ |
| UPI + payment gateway | ✓ | ✓ | ✓ | ✓ | ✓ |
| GST bills + exports | ✓ | ✓ | ✓ | ✓ | ✓ |
| Ready-made automations | Limited | ✓ | ✓ | ✓ | ✓ |
| Custom workflows | — | Pro pack | ✓ | ✓ | ✓ |
| Vya builder + daily summary | ✓ | ✓ | ✓ | ✓ | ✓ |
| Monthly AI credits | Small | Standard | 2× | 5× | Custom |
| Client billing (2% fee) | — | ✓ | ✓ | ✓ | ✓ |
| Earnings dashboard | — | ✓ | ✓ | ✓ | ✓ |
| White label | — | — | Brand lite | Full | Full + branded PWA |
| Team seats | 1 | 1 | 3 | 10 | Custom |
| Portfolio analytics | Basic | ✓ | ✓ | ✓ + exports | ✓ + BI export |
| Public API + webhooks | — | — | Webhooks | ✓ | ✓ |
| Academy + certification | ✓ | ✓ | ✓ | ✓ | ✓ |
| Support | Help centre + Vya | + in-app chat | + chat priority | Priority + phone | Account manager + SLA |

Pro pack features (broadcasts, GBP sync, review dashboard, auto social, loyalty, inventory, attendance/commissions, advanced analytics) are added per site on any paid plan.

### 17.4 Per-site add-ons

| Add-on | Price (hypothesis) | Notes |
|---|---:|---|
| Extra live site | ₹149 Starter / ₹119 Growth / ₹99 Agency per site/mo | Starter + 5 extra sites (₹1,144) costs more than Growth (₹999), keeping the upgrade path clear |
| **Pro pack** | ₹199 per site/mo | Broadcasts, scheduled broadcasts, custom workflows, GBP sync, review dashboard + reply drafts, auto social + Meta posting, loyalty, inventory, attendance/commissions, advanced analytics |
| Second operational module | ₹99 per site/mo | E.g. a café adding table bookings, a salon adding product orders |
| Extra staff seat | ₹49 per seat/mo | 2 staff seats included per business |
| Extra location | To be set | Locations don't use site slots; heavy multi-location use is priced separately |

The reseller decides whether to pass add-ons on to the client; the Academy suggests client prices, never enforced.

### 17.5 Metered usage (prepaid wallet per business or per reseller)

| Usage | How it's priced (hypothesis) |
|---|---|
| WhatsApp messages | Meta's rate for the country and message category + VyapOne margin (e.g. 15–25%), from the per-country cost table. Shown before every broadcast |
| AI credits | Monthly allowance per plan; top-up packs. One credit table for generation, images, voice and summaries |
| SMS | Cost + margin; used only as a fallback |
| Custom domain purchase | Connect your own domain free; buy via VyapOne at cost + small margin |
| Storage | Fair allowance per site; paid packs beyond it |

Wallet rules: low-balance alerts on WhatsApp, an optional auto top-up, hard caps the owner sets, and no message is ever sent on credit the wallet doesn't have. Transactional messages (order/booking confirmations) get priority over marketing when the balance is low.

### 17.6 Platform fees on money moving through VyapOne

| Flow | VyapOne fee (hypothesis) | Notes |
|---|---|---|
| Customer → business by UPI QR/intent | 0% | Straight to the business's account |
| Customer → business via gateway | 0% | Provider fees passed through; whether to add a platform fee later is an open decision |
| **Business → reseller (client billing)** | **2% of amount collected** | Plus provider fees; 0% for "collected offline". For reference, Instamojo's Starter charges 5% + ₹3 per transaction (pricing page, 30 Oct 2026) |

### 17.7 Direct business owner (DIY) plans

| Plan | Monthly | Annual | Includes |
|---|---:|---:|---|
| Solo | ₹299 | ₹2,990 | 1 site, base modules, operational module, custom domain |
| Solo Pro | ₹499 | ₹4,990 | Solo + Pro pack |

A reseller's cost for one site with Pro is about ₹332 on Starter (₹133 + ₹199), below Solo Pro's ₹499, so the reseller channel stays competitive once their service is included. Every DIY dashboard has "Get expert help".

### 17.8 Counting rules

- One live site = one live business (not one page). Locations under a business don't use extra slots; a second brand does.
- Drafts use a separate, capped allowance.
- A custom domain doesn't use another slot. Archiving doesn't delete data immediately.
- On downgrade, the reseller chooses which sites stay live. No site disappears without warning, a grace period and a fallback (DIY offer to the owner).
- Customer payments to a business always belong to that business and stay separate from VyapOne billing.

### 17.9 Unit economics notes

| Item | Figure | Basis |
|---|---|---|
| Starter ARPU | ₹4,788/yr (₹399 × 12) | Plan price |
| Blended reseller ARPU | ₹599–₹789/mo depending on plan mix | Market note, scenarios (assumed mixes) |
| Illustrative Starter reseller with 5 clients | ₹399 + 2 extra sites (₹298) + 3 Pro packs (₹597) + 2% of ₹5,000 client billing (₹100) = **₹1,394/mo (₹16,728/yr)** | Illustration only; client fee of ₹1,000/mo is an assumption |
| That reseller's net earnings | ₹5,000 collected − ₹1,394 = ₹3,606/mo before provider fees and their own costs | Illustration |
| Churn effect | At 5%/mo churn, about 46% of the base is lost in a year; holding 6,000 resellers would need about 300 new paying resellers every month | Market note (generic SMB SaaS benchmark, not India) |
| CAC ceiling | At a 70% gross margin (target, hypothesis), a 6-month payback allows about ₹1,675 CAC per Starter reseller (₹399 × 0.7 × 6) | Arithmetic on hypotheses |

**What this tells us:**
1. ₹399 alone needs volume and cheap acquisition. Paid ads will rarely fit under a ~₹1,675 CAC ceiling, so reseller acquisition must run on referral, the Academy, college partnerships and community.
2. Per-site revenue (extra sites, Pro packs, client billing, metered margin) is what turns a ₹4,788/yr reseller into a ₹15,000+/yr one. Track **revenue per live site** as closely as revenue per reseller.
3. Churn is the biggest risk to the model. Client billing, the daily Vya loop, automations and annual prepay are the retention levers, and all of them ship at GA.
4. Support cost can erase a Starter account's margin (the Dukaan lesson). Self-serve help, Vya and reseller-first support (the reseller is the first line for their clients) must keep support minutes per site falling.

### 17.10 Revenue outlook (from the market note, assumptions)

Base case on v1 prices, subscriptions + 20% add-ons: about **₹15 lakh in year 1, ₹1.66 crore in year 3, ₹5.18 crore in year 5**, with ~6,000 paying resellers by year 5. Strong case: ~₹21.5 crore in year 5 with ~20,000 resellers. These are scenario assumptions, not forecasts. The per-site add-ons, client-billing fee and DIY plans in this document are upside not included in those numbers.

---

## 18. Architecture and Scalability

### 18.1 Reference architecture

`Clients (PWA, staff mode, desktop dashboard, public sites, WhatsApp) → edge/CDN → API gateway (auth, rate limits) → core services (tenancy, builder, commerce, billing, CRM, automation, messaging, payments, analytics, Vya) → event bus + job queues → PostgreSQL, object storage, cache, search, analytics warehouse → adapters (WhatsApp, PGs, Google, Meta, delivery, GSP, SMS/email)`

| Layer | Direction (final choices are architecture decisions) |
|---|---|
| App | Next.js + TypeScript; installable PWA (service worker, IndexedDB offline queue) |
| UI | Tailwind + accessible primitives on VyapOne design tokens |
| Editor | Constrained component editor (Puck is a candidate), mobile-first |
| Services | Modular monolith at GA with clear service boundaries; split out messaging, automation and rendering as load requires |
| Database | PostgreSQL with row-level security; read replicas; partitioning for events and messages |
| Cache / search | Redis-class cache; full-text search for catalogues and customers |
| Events and jobs | Transactional outbox → managed event bus/queue; scheduled workers for reminders, summaries and broadcasts |
| Public sites | Rendered from published config at the edge, cached on a CDN, purged on publish |
| AI | Provider-neutral AI gateway with structured outputs, model routing and per-tenant budgets |
| Analytics | Event pipeline into a columnar warehouse for BI and cohorts |
| Validation | Shared schemas on client and server |
| Observability | OpenTelemetry traces, structured logs, metrics, error tracking, per-tenant cost metrics |

### 18.2 Multi-tenant model

- One shared platform; every row carries `workspace_id` and `business_id` (and `location_id` where relevant).
- Authorization from explicit membership + role, enforced on the server and again by database row-level policies.
- Public sites render per tenant from published config; no per-business deployments.
- **Per-tenant quotas and rate limits** on APIs, AI, messaging, media, automations and exports (noisy-neighbour protection).
- Data residency: primary data in an India region; regional cells possible later for global markets.

### 18.3 Structured site config

Sites are versioned JSON documents validated by schema: metadata, theme tokens, pages, ordered sections, component types, validated props, module bindings, locales. This enables mobile editing, Vya tool actions, safe rendering, diffs and rollback. **Generation selects and configures approved components; it never writes code.**

### 18.4 Module / plugin system

Each module ships a **manifest**:

- id, version, niches it suits, dependencies
- data schemas and migrations
- settings schema (rendered as forms automatically)
- UI surfaces: public components, dashboard screens, staff-mode screens
- events emitted and consumed (e.g. `order.created`, `bill.issued`, `payment.confirmed`)
- message templates per locale
- permissions it needs
- entitlement key and pricing key (Base, Pro, add-on)
- Vya tools it exposes, with schemas and confirmation level

First-party modules use the same SDK that marketplace creators will use after launch, so the plugin system is proven at GA.

### 18.5 Event-driven notifications and messaging

`Domain event → outbox → event bus → rules (who, which channel, which template, consent, quiet hours) → cost check against wallet → channel adapter (WhatsApp / SMS / email / push / in-app) → delivery status webhooks → message log`

- **Per-country cost table:** channel × country × message category → unit cost, currency and effective date. Pricing, wallet debits and margin reports all read this one table, so a new country is a data change, not a code change.
- Idempotent sends with dedupe keys; retries with backoff; dead-letter queue with alerts.
- Fallback rules (WhatsApp fails → share link to owner, or SMS where configured and paid).
- Quiet hours and per-customer frequency caps for marketing.

### 18.6 Global-ready, multi-currency and i18n

- **i18n:** every string in message catalogues (ICU format); locale per user, per business and per customer; RTL-capable layout tokens for Arabic later.
- **Money:** amounts stored as integer minor units + ISO currency code; plan prices per currency in a price book.
- **Tax:** a tax engine interface; GST is the first implementation (VAT for the Gulf later).
- **Payments and messaging:** adapter interfaces (UPI/Razorpay first; others later).
- **Phone, address, date and number formats** from locale data, never hardcoded.
- **Timezones** per business.

### 18.7 Cost controls (AI and WhatsApp)

- AI gateway: per-tenant credit ledger, per-plan budgets, model routing (small models for extraction and summaries, larger only where quality needs it), response caching for repeated content, and hard stops with a friendly manual fallback.
- Generation is mostly deterministic: presets and components do the heavy lifting; AI fills copy and choices. That keeps cost per generated site low and predictable.
- WhatsApp: estimated cost shown before every broadcast; wallet hard caps; transactional before marketing; daily spend anomaly alerts.
- Dashboards: AI cost per site, messaging margin per country, infra cost per live site, support minutes per site.

### 18.8 Scale targets (hypotheses to load-test before GA)

- Architecture sized for **tens of thousands of live sites** without redesign (the year-5 base case is ~26,000 businesses, per the market note) and horizontally scalable beyond.
- Load tests at **10× expected launch-month peak**, including festival spikes (Diwali-style broadcast bursts) and lunch/dinner order peaks.
- Public sites served from the CDN for most requests; origin load scales with publishes, not page views.
- Queues absorb broadcast bursts; per-business and per-number send rates respect Meta limits.
- **Multi-region readiness:** stateless services, infrastructure as code, cross-region backups and a documented failover runbook; active-active is post-launch.

---

## 19. Data Model (key entities)

Kept from v1/v2: User, Workspace, WorkspaceMember, Business, BusinessMember, Site, SiteVersion, ModuleInstallation, CatalogueItem, Lead, Order, Appointment, PaymentRecord, Subscription, QRCode, AnalyticsEvent, AIAction.

Added or extended for GA (v2 + v3):

| Entity | Purpose |
|---|---|
| Location | Outlet-level timings, address, staff, QR, Google profile |
| Customer | Per-business customer record: name, phone, tags, totals, last seen |
| Consent | Per customer × channel × purpose, with source and timestamp |
| Invoice / InvoiceLine | GST-ready bill, bill of supply, credit note; series per location/device |
| PaymentClaim | Customer-claimed UPI payment awaiting owner confirmation |
| ClientContract | Reseller ↔ business fee, schedule, included services |
| ClientInvoice / Payout | Reseller billing, collection status, split, payout |
| Wallet / CreditLedger | Prepaid balance and every debit/credit for messages, AI and SMS |
| CostTable | Channel × country × category unit costs with effective dates |
| MessageTemplate / MessageLog | Templates per locale and every send with status |
| Broadcast / Segment | Marketing sends and audiences |
| Integration | Connected WhatsApp number, GBP account, gateway account (secrets referenced, never stored in plain form) |
| ReviewRequest / Review | Feedback and synced reviews |
| LoyaltyAccount | Points/stamps per customer |
| SocialAsset | Generated creatives and captions, with approval state |
| ModuleManifest | Registered modules and versions |
| Translation | Confirmed translations per content field and locale |
| Referral / Lead | Referral credits; marketplace leads and routing |
| Workflow / WorkflowRun | Automation definitions, versions and every run with step results |
| Reservation / Room / ClassBatch / JobCard / RentalItem | Vertical operational records |
| StockItem / StockMovement | Inventory per location |
| CreditAccount | Udhaar balances and statements |
| EInvoice | IRN, signed QR and IRP status per eligible invoice |
| Delivery | Dispatch, partner, tracking and proof of delivery |
| ApiClient / WebhookSubscription | Public API access and outgoing webhooks |
| Attendance / Commission | Staff clock-ins and earnings |
| SupportTicket | Help requests with tenant context |
| AuditLog | Who did what, when, from which role and device |

---

## 20. Security, Privacy and Compliance

### 20.1 Compliance map

| Obligation | What VyapOne does |
|---|---|
| **DPDP Act 2023** (and its Rules) | VyapOne is a data processor for each business's customer data and a data fiduciary for its own users. Notice and purpose-specific consent, consent records, purpose limitation, data-principal rights (access, correction, erasure, grievance), breach notification, retention limits, a published grievance officer. Exact obligations and timelines confirmed by counsel before GA |
| **RBI payment rules** | No card data stored or processed by VyapOne; card-on-file tokenisation stays with licensed gateways/aggregators; KYC is done and held by the payment provider; no pooling of customer or client money; settlement only through licensed providers' split/route products |
| **GST** | CA-reviewed bill formats, gap-free series, HSN/SAC, place of supply, credit notes; e-invoice (IRN) through a GSP for eligible businesses; VyapOne's own invoices to resellers are GST-compliant |
| **CERT-In directions (2022)** | Incident response plan with reporting of specified cyber incidents to CERT-In within the required window (6 hours), synchronised clocks, and ICT logs retained in India for the required period (180 days) |
| **Messaging rules** | Meta WhatsApp Business policies and opt-in rules; TRAI DLT registration for SMS templates and sender IDs |
| **Consumer & e-commerce** | Clear refund, cancellation, grievance and pricing disclosures on every business's public site; seller details shown |

### 20.2 Security controls

- **RBAC:** roles at platform, workspace, business and location level; least privilege; separate admin roles for support, finance and trust & safety; just-in-time admin access with approval.
- **Authentication:** phone OTP, optional passkeys, device sessions with remote sign-out, PIN for staff mode, step-up verification for payouts, exports, domain and payment changes; SSO for Scale.
- **Audit logs:** immutable, tenant-scoped log of every material action (who, what, when, role, device, before/after); viewable by owners and resellers for their own scope.
- **Encryption:** TLS 1.2+ everywhere, HSTS on public sites; encryption at rest for databases, backups and media; field-level encryption for provider tokens and sensitive fields; keys in a managed KMS with rotation.
- **Secrets:** managed secret store; provider tokens per business encrypted; clients never see secrets.
- **Server-side authority:** prices, totals, entitlements and payment states computed and verified on the server; webhooks signature-verified, replay-resistant and idempotent.
- **Rate limits and abuse:** per-IP, per-user and per-tenant limits; bot protection on public forms and OTP; moderation for prohibited businesses and content; phishing and impersonation checks on new sites and domains.
- **Backups and DR:** point-in-time recovery, daily encrypted backups copied to a second region, restore drills every quarter; per-business export.
- **Secure SDLC:** code review, dependency and secret scanning, SAST/DAST in CI, infrastructure as code, signed builds.
- **Testing:** independent penetration test before GA and at least yearly after; a responsible-disclosure policy and bug bounty after GA.
- **SOC 2-ready controls:** access reviews, change management, vendor risk reviews, security training, incident and BCP documentation, evidence collection, so a SOC 2 audit can follow when enterprise/agency demand requires it.

### 20.3 Trust rules (kept)

- Vya never invents prices, stock, timings, qualifications, legal approvals, property status, reviews or payment success.
- AI-written content is labelled as a draft until approved; no fake reviews, stats or testimonials on generated sites.
- No review gating or incentives for positive reviews.
- The business owns its data; owners can export at any time and move resellers through a controlled handover.

---

## 21. Reliability, SLOs and Operations

| SLO (targets, hypotheses) | Target |
|---|---|
| Public sites availability | 99.9% monthly |
| Dashboard and API availability | 99.9% monthly |
| Order/booking event → WhatsApp send | p95 under 30 seconds |
| Publish | p95 under 60 seconds |
| API latency (core reads) | p95 under 300 ms |
| Payment webhook processing | p99 under 60 seconds |
| Recovery objectives | RPO ≤ 15 minutes, RTO ≤ 4 hours |

- **Observability:** tracing across web → API → jobs → providers; structured logs with tenant ids and no personal data; dashboards per service and per integration; error budgets per SLO.
- **Synthetic checks** for every critical journey (order, booking, payment, bill, publish, broadcast) every few minutes from Indian networks.
- **Incident response:** 24×7 on-call rotation, severity levels, a public status page, customer communication templates, post-incident reviews.
- **Degradation:** public sites keep working if AI, a messaging provider or a gateway is down; queued work replays safely.
- **Release safety:** feature flags, staged rollouts, canaries, instant rollback; database migrations backward-compatible.

---

## 22. Quality: QA, Devices, Accessibility, Performance

### 22.1 QA strategy

- Unit and integration tests on every module; contract tests on every provider adapter (with sandboxes).
- End-to-end journeys on mobile viewports for each niche preset (Playwright or equivalent), run on every release.
- GST calculation test suite reviewed by a CA; payment and refund tests against gateway sandboxes; idempotency and replay tests.
- Language QA in all 9 languages; RTL-readiness checks.
- Load, soak and chaos tests before GA; a security test cycle before each major release.
- Beta feedback loop with in-app bug reporting and session context.

### 22.2 Device and network matrix

| Dimension | Coverage at GA |
|---|---|
| Android | Low-end (2–3 GB RAM), mid-range and flagship devices; Android versions still common in India; Chrome and Samsung Internet |
| iOS | Recent and older supported iPhones; Safari; PWA install path |
| Desktop | Chrome, Edge, Safari, Firefox (agency dashboard) |
| Networks | 3G-like, patchy 4G, offline-to-online transitions |
| Peripherals | 58/80 mm Bluetooth thermal printers, tablets at counters |

### 22.3 Accessibility

**WCAG 2.2 AA** for the app and public sites: contrast, focus states, 44 px tap targets, screen-reader labels, captions on Academy videos, reduced motion, text scaling to 200%, and voice as an alternative to typing.

### 22.4 Performance budgets

| Surface | Budget |
|---|---|
| Public site on mid-range Android, 4G | LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1 |
| Public site JavaScript | ≤ 100 KB compressed on first load |
| Public site page weight | ≤ 500 KB on first load (images lazy-loaded, modern formats) |
| App shell (repeat visit) | Interactive in ≤ 2 s from cache |
| Counter bill | Created and shared in ≤ 3 taps, ≤ 5 s end to end |

---

## 23. Design System

### 23.1 Product UI (kept)

The emerald and pearl system: clarity, depth and restraint, Apple-inspired without copying Apple.

| Token | Value | Use |
|---|---|---|
| Background | `#F4FAF7` | Main canvas |
| Background mint | `#E7F5EE` | Ambient sections |
| Surface | `#FFFFFF` | Forms, tables, readable content |
| Glass surface | `rgba(255,255,255,0.80)` | Navigation and framing |
| Primary emerald | `#087A55` | Main actions and selection |
| Primary hover / pressed | `#066447` / `#054F39` | States |
| Primary soft | `#E5F4EC` | Selection background |
| Text / secondary | `#15251F` / `#50665C` | Copy |
| Border | `#D5E4DC` | Controls and cards |
| Error | `#B52B48` | Errors, destructive actions |

- Glass only for navigation, floating editor controls, the Vya panel and sheets; forms, tables, prices, bills and QR codes stay opaque (kept).
- Typography: Inter (or equivalent) for Latin, Noto Sans for Indic scripts, 16 px minimum input text, extra line height for Indic text.
- Motion: 120–180 ms controls, 200–240 ms sheets, reduced-motion alternatives; no animated QR codes.

### 23.2 Marketing look

Marketing and social use the dark emerald palette already used on @vyapone (`#010506`, `#054E31`, `#02BA64`, `#008549`, `#38EBA7`, `#72F9C0`) with Plus Jakarta Sans ExtraBold headlines. The logo is never recoloured. The liquid/3D logo stays optional and marketing-only, with a static fallback (kept).

### 23.3 Key UI patterns

- **Money states** are always explicit and colour-plus-text: "Claimed", "Received", "Pending", "Failed", "Refunded".
- **Cost before send:** every broadcast sheet shows recipients, the exact message and the estimated cost.
- **Offline banner** and per-item sync state.
- **Large-tap staff mode** for counters.
- **Voice button** on every text input.

---

## 24. Information Architecture

| Workspace | Sections |
|---|---|
| Public VyapOne site | Home, For resellers, For businesses (DIY), Solutions by niche, Pricing, Examples, Academy, Help, Contact, Legal |
| Reseller | Today, Clients (businesses), Create business, Earnings, Leads, Templates, Team, Plan & usage, Wallet, Academy, Support, Settings |
| Business owner | Today (Vya summary), Orders / Bookings, Bills, Customers, Broadcasts, Catalogue, Website, QR Studio, Reviews, Reports, Automations, Inbox, Payments & wallet, Staff, Settings |
| Staff mode | New order / bill, Today's orders or bookings, Customers lookup |
| Editor | Pages, Sections, Theme, Content, Modules, Languages, Vya, History, Preview, Publish |
| Platform admin | Resellers, Businesses, Plans & price book, Cost tables, Templates & modules, Moderation, Payments & payouts, AI and messaging usage, Support, Audit, Config |

Navigation adapts to enabled modules (kept): a salon never sees table orders; a broker never sees a kitchen view.

---

## 25. Support and Customer Success

- **Tiered support:** Vya and the help centre answer how-to questions first; **in-app chat with human agents** for everyone on paid plans; priority chat and phone for Agency; an account manager for Scale. Human escalation is never removed.
- **Reseller-first model:** resellers are the first line for their clients and get a dedicated reseller support queue, so their issues are solved fast.
- **Help centre:** searchable articles and short videos in all 9 languages, linked from each screen; a community forum for resellers.
- **Always human for money, publishing and outages:** payment, payout, billing and data-loss issues go straight to trained agents.
- **Support targets (hypotheses):** first response in chat under 15 minutes in business hours; urgent payment issues triaged within 1 hour.
- **Customer success:** onboarding check-ins for new resellers, health scores per reseller (activity, WOS, collections), proactive outreach to at-risk accounts.
- **Tooling:** support agents see tenant context (plan, recent errors, integration health) with audited, time-limited access to customer data.

---

## 26. Launch Plan

### 26.1 Build reality

A full-scale launch needs a larger team and a longer build than a pilot would. An indicative team shape: product and design (product lead, 2–3 designers incl. one for Indic content), engineering across the workstreams below (roughly 12–20 engineers incl. QA and SRE), a security/compliance owner with legal and CA advisers, a support and success team ready before public beta, Academy/content, and reseller partnerships. Actual size and dates depend on funding and hiring.

| Workstream | Owns |
|---|---|
| Platform & tenancy | Auth, RBAC, billing engine, wallet, admin console, audit |
| Builder & Vya | Editor, presets, generation, Vya (builder, assistant, coach), voice, languages |
| Commerce & verticals | Orders, bookings, stays, classes, jobs, property, rentals, inventory, udhaar |
| Money | Payments, client billing, split settlement, reconciliation, GST, e-invoice |
| Messaging & automation | WhatsApp, SMS/email, event bus, workflow engine, broadcasts |
| Growth & integrations | GBP, Maps, Meta, delivery, accounting, public API, webhooks, Zapier |
| Data | Analytics, BI, cohorts, Vya insights, exports |
| Reliability & security | Infra, SRE, observability, DR, security programme, compliance |
| Quality | QA automation, device lab, accessibility, performance |
| Go-to-market | Academy, reseller programme, help centre, support, marketing |

### 26.2 Stages

| Stage | Who | Exit criteria |
|---|---|---|
| **Readiness gates** | Internal | Meta technology-provider status, Google GBP API access, gateway split-settlement agreements, GSP partner, DLT registration, legal and CA sign-off |
| **Private beta** | Invited resellers and their clients across all niche groups, a few cities | Every vertical's core journey completed by real businesses; no P1 bugs open; SLOs met for 4 consecutive weeks |
| **Public beta** | Open reseller signup with waitlist | Support load per site within target; activation and retention trends healthy; pen-test findings closed |
| **GA (v1.0)** | Everyone in India | GA readiness checklist complete (26.3) |

### 26.3 GA readiness checklist

- [ ] All launch-scope features (section 6) pass acceptance (section 31) in all 9 languages
- [ ] Pen test complete, critical/high findings fixed; DPDP, RBI, GST and CERT-In obligations signed off
- [ ] SLOs met in beta; load test at 10× expected peak passed; DR restore drill passed
- [ ] Payment, refund, split settlement and reconciliation verified with real money in beta
- [ ] WhatsApp templates approved per niche and language; number-quality monitoring live
- [ ] Help centre, in-app chat, status page and on-call rotation live; support team trained
- [ ] Terms, privacy, refund, cancellation, grievance and data-retention policies published
- [ ] Price book, wallet and metering reconciled with provider invoices
- [ ] Academy and certification live; launch partners and case studies ready (real, with permission)

### 26.4 Go-to-market

- **Channel first:** recruit resellers through college clubs, freelancer communities, existing web/social freelancers, skilling programmes and referral. Message: "Earn every month by putting local businesses online and running their orders."
- **Show, don't tell:** a reseller builds a prospect's draft site in front of them in 5 minutes.
- **Launch moments:** a launch event per city with certified resellers; festival-season campaigns for owners.
- **Content:** practical tips for owners in the @vyapone style, shareable by resellers; DIY self-serve SEO pages by niche and city.
- **No fake proof:** no invented testimonials or stats; real beta stories only, with permission.

---

## 27. Success Metrics and KPIs

| Area | KPI | Year-1 target (hypothesis) |
|---|---|---|
| North star | Weekly Operating Sites (WOS) | ≥ 60% of live sites, growing weekly |
| Activation | Reseller signup → first published site | ≥ 50% within 7 days |
| Speed | Create business → publish | Median < 15 minutes |
| Mobile | Sites created entirely on a phone | ≥ 90% |
| Vya | Proposals accepted with light edits | ≥ 70% |
| Automation | Live sites with ≥ 1 active automation | ≥ 70% |
| Owner engagement | Owners acting on the daily summary weekly | ≥ 40% |
| Retention | Monthly reseller logo churn | < 5%, heading to < 3% |
| Expansion | Live sites per paying reseller | ≥ 4 after 3 months |
| Monetisation | Sites with Pro, add-ons or client billing | ≥ 33% |
| Reseller success | Median reseller net earnings | Positive by month 2 |
| Client billing | On-time collection rate | ≥ 90% |
| Reliability | SLO attainment | 99.9% availability, error budgets respected |
| Support | Support minutes per live site | Falling month on month |
| Trust | Opt-out rate per broadcast; WhatsApp quality rating | Low and stable |
| Cost | AI cost per site; messaging margin per country | Within budget; positive |

---

## 28. Risks and Mitigations

| # | Risk | Why it's real | Mitigation |
|---|---|---|---|
| 1 | **Crowded, cheap market** | Hostinger sells unlimited AI sites from ₹199/mo; Instamojo and Durable have free tiers | Compete on run + bill, not the site: every vertical, WhatsApp, payments, automation and client billing at launch; a free tier removes the price objection |
| 2 | **Low willingness to pay** | 46.2% of surveyed MSMEs are fully offline (India SME Forum); Khatabook lost ₹116 cr on ₹103 cr revenue in FY24 (YourStory) | Resellers sell and collect; low price per site, high value per day; validate prices in beta |
| 3 | **Churn** | Generic SMB SaaS churn is 3–5%/mo; at 5%, ~46% of the base goes in a year | Client billing, daily Vya loop, automations, annual prepay, at-risk alerts, owner handover instead of site loss |
| 4 | **Large launch scope** | A full-scale launch is a bigger build with more to go wrong | Workstream ownership, readiness gates, beta across all niches, feature flags, a hard quality bar for GA (section 31) |
| 5 | **Support load (the Dukaan lesson)** | Dukaan cut ~90% of support for an AI bot (CNN, Jul 2023); live stores later fell to 2,084 from a 3,860 peak (Store Leads, Oct 2026) | Human support from day one, reseller-first queue, Vya for how-to, support minutes tracked per site |
| 6 | **WhatsApp API costs and rules** | Per-message charges by country and category; template approvals; quality limits | Level 1 fallback; metered wallet with margin; cost shown before send; quality monitoring and throttling |
| 7 | **Platform dependency** | Meta, Google and payment providers can change rules, prices or access | Adapter interfaces, multiple gateways, fallbacks for every channel |
| 8 | **Payments and compliance** | Holding funds, GST formats and data protection carry legal risk | Licensed split settlement, no pooling, CA-reviewed bills, DPDP and CERT-In programme, pen tests |
| 9 | **Reseller quality** | Bad resellers create unhappy owners | Academy + certification, owner ratings, data portability and handover rights |
| 10 | **AI errors** | Wrong prices or timings on a live site damage trust | "To confirm" states, no auto-publish, version history, Vya never invents facts |
| 11 | **Channel conflict with DIY** | DIY could undercut resellers | DIY priced above reseller per-site cost; "Get expert help" routes to resellers |
| 12 | **Going global too early** | Splits the team across languages, payments and support | Global markets only after the India gate (section 30) |

---

## 29. Open Decisions

1. WhatsApp route: direct Cloud API as a technology provider or a BSP; number ownership on handover.
2. Payment gateways at GA (Razorpay, Cashfree, PhonePe PG) and the split-settlement provider; legal structure for the platform fee.
3. Final prices (all of section 17), including the client-billing fee %, Pro pack, extra-site prices and AI credit amounts.
4. Free-tier caps and whether it allows a custom domain.
5. Grace period after a reseller or client stops paying; what an "offline" site shows.
6. Subdomain and brand for client sites and white-label domain rules.
7. Data-ownership terms between reseller, owner and VyapOne; handover process.
8. Hosting, auth and database providers; India data region; DR region.
9. GSP partner for e-invoicing; bill series rules confirmed by a CA.
10. Delivery partners per city.
11. Support hours, channels and staffing model.
12. Academy content owner and certification criteria.
13. Beta cities and launch-partner resellers.
14. When to start Gulf groundwork (AED price book, VAT, Arabic).

---

## 30. Post-launch Expansion

Only ecosystem-dependent items wait for after GA:

| Item | Why it waits |
|---|---|
| **ONDC listing** | Needs a seller-side network participant partner, catalogue quality, order-status sync and grievance handling |
| **Template and module marketplace** | Needs a community of third-party designers/developers on the module SDK and a review process |
| **Open lead marketplace** with paid leads | Needs a volume of DIY and inbound leads and enough certified resellers per city |
| **Branded native reseller apps** (Play Store / App Store) | Store accounts per reseller and review cycles; the branded PWA covers GA |
| **Global markets** | After the India gate (a few hundred paying resellers who stay, monthly reseller churn clearly under 5%, resellers adding clients without hand-holding) |

| Order | Market | Why | Needs |
|---|---|---|---|
| 1 | UAE / Gulf | Indian-run SMBs and agencies; English + Hindi work; higher willingness to pay | AED pricing, VAT, card/Apple Pay, Arabic + RTL |
| 2 | Philippines | English, phone-first, many small businesses and freelancers | GCash/Maya, local templates |
| 3 | Indonesia | Biggest Asian prize; very WhatsApp-heavy (usage figure unverified) | Bahasa, QRIS/e-wallets, a local partner |

Source: positioning note, 30 Oct 2026. The architecture is global-ready at GA (section 18.6), so a new market is mostly data, adapters and go-to-market.

---

## 31. Definition of Launch-Ready

The product is launch-ready when every journey below works reliably, securely, in every supported language, on a low-end phone:

**A reseller signs up on a phone → completes onboarding and the Academy quick-start → creates a client business by voice → Vya proposes the site, operational module and automations → the reseller confirms and publishes, prints the QR and sets the client's monthly fee → the owner onboards, connects UPI, the gateway, WhatsApp and Google → a customer scans, orders or books, pays and gets a WhatsApp confirmation → stock updates, a GST bill (or e-invoice) goes out and the customer joins the CRM → an automation requests a review and a scheduled broadcast brings them back → Vya sends the owner a morning summary and an insight → the reseller sees the fee collected and net earnings in their dashboard.**

Acceptance criteria for GA:

1. Every niche group's operational journey passes end to end, on the device matrix, in all 9 languages.
2. Vya builds only from supplied information; every extracted fact is "to confirm" until confirmed.
3. Generation uses only approved components; sites are versioned and can be rolled back.
4. Plan limits, quotas and entitlements are enforced on the server.
5. Payment success is shown only from verified provider signals or explicit staff confirmation; refunds and split settlement reconcile with provider records.
6. Bills, credit notes and e-invoices are correct against the CA-reviewed test suite.
7. Broadcasts and automations reach only opted-in customers, show cost before sending and debit the wallet correctly.
8. No user can read or change another tenant's data via UI, API, webhooks or Vya (verified by the pen test).
9. SLOs, performance budgets and WCAG 2.2 AA are met.
10. Support, help centre, status page and all legal policies are live.

---

## Appendix A. Sources

All market and competitor figures come from two research notes prepared on 30 October 2026: *VyapOne: market potential and realistic revenue* and *VyapOne: where it stands vs competitors, and can it go global?* Primary sources cited there include:

- PIB press releases, 7 Aug 2026 (PRID 2296358) and 30 Mar 2026 (PRID 2246892): Udyam registrations.
- India SME Forum, META Report Card 2025 (Dec 2025): website ownership and offline share (survey of 7,835 MSMEs).
- Market.us, Sep 2025: India website-builder market (analyst estimate).
- Vendor pricing pages read 30 Oct 2026: Hostinger India, Shopify, Instamojo, Duda, 10Web, GoHighLevel, Durable.
- Store Leads (Oct 2026) and CNN (12 Jul 2023): Dukaan.
- YourStory: Khatabook FY24 (Nov 2024), OkCredit FY25 (Oct 2025), Bikayi pivot (May 2024).
- Churn benchmark: Mercury blog and NetSuite (search snippets; generic, not India-specific).

Everything else in this document (prices, targets, SLOs, illustrative economics) is a **hypothesis to validate in beta**.


---

*VyapOne PRD v3.0 · 30 October 2026 · Har business. One platform.*
