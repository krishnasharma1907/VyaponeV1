# VyapOne — Requirements Traceability Map

**Document Version:** 1.0  
**Date:** 7 November 2026  
**Status:** Canonical Baseline  
**Task ID:** VO-001  
**Primary Source Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md`  
**Supplementary Production Authority:** `reference/PRD_VERSIONS/PRD_v3_full_scale_2026-10-30.md`  
**Backlog Reference:** `docs/TASK_BACKLOG.md`  

---

## 1. Overview and Traceability Methodology

This document establishes bidirectional traceability between authoritative product requirements, development task IDs in the task backlog, and acceptance test criteria.

### Traceability Status Definitions
- `NOT_STARTED`: The requirement is mapped to a backlog task whose implementation has not commenced.
- `IN_PROGRESS`: Currently being implemented.
- `DONE`: Implementation complete and acceptance tests passing.
- `PENDING_DECISION`: Scope or implementation detail depends on an unresolved decision in `docs/DECISION_REGISTER.md`.
- `DEFERRED_POST_LAUNCH`: Intentionally scheduled for Phase P14 (post-GA expansion); not a launch blocker.

---

## 2. Functional Requirements (FR-01 to FR-23)

Mapped from Section 14 of `PRD_FINAL_v2_2026-11-03.md`:

| Req ID | PRD Section | Requirement Description | Product Module | Related Task ID | Dependencies | Acceptance Test ID | Status |
|---|---|---|---|---|---|---|---|
| **FR-01** | §14, §8.1 | Authentication, phone/email verification, session management, secure recovery, role separation (Platform Admin, Reseller, Business Owner, Staff). | Platform Core | `VO-021`, `VO-022` | VO-010, VO-020, ADR-003 | `TC-FR01-01` (Auth lifecycle), `TC-FR01-02` (Role boundary enforcement) | `NOT_STARTED` |
| **FR-02** | §14, §8.1 | Workspace and business management: multi-business creation under plan limits, invitations, transfer/handover, status tracking (draft, live, archived, suspended). | Platform Core | `VO-022`, `VO-023`, `VO-027` | VO-021, VO-024, VO-026 | `TC-FR02-01` (Business CRUD), `TC-FR02-02` (Handover & status lifecycle) | `NOT_STARTED` |
| **FR-03** | §14, §7 | Niche onboarding: display all supported niches, load dynamic category questions, preserve draft state, voice/photo/text input, "Other business" path. | Onboarding & Niche Registry | `VO-030`, `VO-031`, `VO-033`, `VO-055`, `VO-105` | VO-023, VO-050 | `TC-FR03-01` (Category question schemas), `TC-FR03-02` (Draft persistence & extraction review) | `NOT_STARTED` |
| **FR-04** | §14, §6.14 | Vya proposal: generate structured proposal from confirmed inputs, flag missing fields/assumptions, display pages, modules, design direction, plan impact; user confirmation/editing. | Vya AI Builder | `VO-054` | VO-030, VO-050, VO-051, VO-052 | `TC-FR04-01` (Proposal schema validation), `TC-FR04-02` (Missing field flagging) | `NOT_STARTED` |
| **FR-05** | §14, §15.3 | Website generation engine: assemble approved components, routes, schema configurations and modules; create versioned draft; no arbitrary code execution. | Website Engine | `VO-040`, `VO-041`, `VO-057` | VO-012, VO-013, VO-054 | `TC-FR05-01` (Site JSON assembly), `TC-FR05-02` (Safe block rendering constraint) | `NOT_STARTED` |
| **FR-06** | §14, §15.3 | Constrained mobile visual editor: edit all content from phone (390 px), undo/redo, autosave, preview, version history, Vya-assisted changes with preview. | Visual Editor | `VO-044`, `VO-045`, `VO-047` | VO-040, VO-041, VO-042 | `TC-FR06-01` (Mobile editor interactions at 390px), `TC-FR06-02` (Autosave & undo/redo) | `NOT_STARTED` |
| **FR-07** | §14, §15.1 | Publishing: entitlement/capacity check, publish to platform URL, custom domain adapter, deployment status, error recovery, rollback to prior version. | Publishing | `VO-042`, `VO-048`, `VO-049` | VO-026, VO-040, ADR-004 | `TC-FR07-01` (Capacity validation & publish), `TC-FR07-02` (Version rollback) | `NOT_STARTED` |
| **FR-08** | §14, §8.9 | Dynamic QR management: permanent redirect URLs, main business QR, page/table/product/booking/offer QR types, vector/print downloads, scan analytics. | QR Engine | `VO-049` | VO-042, VO-040 | `TC-FR08-01` (Dynamic redirect resolution), `TC-FR08-02` (Scan contrast & quiet-zone check) | `NOT_STARTED` |
| **FR-09** | §14, §8 | Business modules: enable only compatible implemented modules; store data per business; enforce tenant and role isolation; empty/loading/error/forbidden states. | Operations Core | `VO-060` to `VO-068` | VO-024, VO-030 | `TC-FR09-01` (Module entitlement enforcement), `TC-FR09-02` (State handling & tenant scoping) | `NOT_STARTED` |
| **FR-10** | §14, §9 | Subscription and limits: plan rendering, server-side live website capacity enforcement, metered resource tracking (AI, messages, storage), grace and expiry handling. | Reseller & Billing | `VO-026`, `VO-087` | VO-022, ADR-011, ADR-013 | `TC-FR10-01` (Server quota enforcement), `TC-FR10-02` (Grace & downgrade lifecycle) | `NOT_STARTED` |
| **FR-11** | §14, §10 | Payments: server-side verification, signed and idempotent webhooks, pending status handling, isolated customer payment ledgers, refund references. | Payments | `VO-084`, `VO-085`, `VO-086` | VO-024, ADR-009 | `TC-FR11-01` (Signature verification & idempotency), `TC-FR11-02` (State isolation & reconciliation) | `NOT_STARTED` |
| **FR-12** | §14, §8.12 | Analytics: precise metric definitions (visits, clicks, enquiries, orders, paid orders, bookings); exclude preview/test traffic; zero raw AI/customer text in logs. | Analytics | `VO-121` | VO-062, VO-063, VO-082 | `TC-FR12-01` (Event accuracy & deduplication), `TC-FR12-02` (WOS computation) | `NOT_STARTED` |
| **FR-13** | §14, §8.1 | Administration: platform admin console, least-privilege roles, user/business/plan/usage management, mandatory confirmation & reasoning for sensitive writes, audit events. | Platform Admin | `VO-120` | VO-021, VO-024, VO-028 | `TC-FR13-01` (Least-privilege admin access), `TC-FR13-02` (Audit log completeness) | `NOT_STARTED` |
| **FR-14** | §14, §18.1 | Internationalization: English + 8 Indian languages (Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam) & Hinglish for Vya; preserve user input; no silent machine translation of facts. | Localization | `VO-106` | VO-014, ADR-016 | `TC-FR14-01` (UI string coverage & script rendering), `TC-FR14-02` (Fact preservation during lang switch) | `NOT_STARTED` |
| **FR-15** | §14, §8.13 | WhatsApp messaging: Level 1 share links + Level 2 Cloud API via BSP; template management, opt-in/opt-out records, quiet hours (9 PM-9 AM), frequency caps, recipient count & cost preview. | WhatsApp & Messaging | `VO-090`, `VO-091`, `VO-092`, `VO-094` | VO-080, ADR-008, ADR-018 | `TC-FR15-01` (Level 1/2 routing & fallback), `TC-FR15-02` (Quiet hours & STOP opt-out enforcement) | `NOT_STARTED` |
| **FR-16** | §14, §8.15 | Bills and GST: GST invoices & bills of supply computed via server tax tables (never AI), sequential gap-free numbering, UPI pay link, thermal/PDF formats, credit notes. | Billing Core | `VO-081`, `VO-082` | VO-062, VO-083, ADR-014 | `TC-FR16-01` (GST tax table computation), `TC-FR16-02` (Gap-free numbering & credit note integrity) | `NOT_STARTED` |
| **FR-17** | §14, §8.16 | Customers and broadcasts: automated CRM record creation, consent ledger per channel/purpose, audience segmentation, draft preview with count & cost preview before send. | CRM & Broadcasts | `VO-080`, `VO-096` | VO-091, VO-092, VO-099 | `TC-FR17-01` (CRM auto-creation & consent ledger), `TC-FR17-02` (Broadcast count/cost preview & send) | `NOT_STARTED` |
| **FR-18** | §14, §8.17 | Automations: workflow engine (trigger → condition → action with delay), ready-made recipes per niche, once-only execution (idempotent), run logs, retries, safe guardrails. | Automation Engine | `VO-097`, `VO-098` | VO-091, VO-093 | `TC-FR18-01` (Recipe execution & idempotency), `TC-FR18-02` (Loop & burst protection) | `NOT_STARTED` |
| **FR-19** | §14, §6.15 | Vya daily helper and memory: scheduled morning summary/evening totals in owner's language; read tools for business facts; shop profile, rolling summaries, learned facts with deletion control. | Vya Assistant | `VO-058`, `VO-100`, `VO-102` | VO-050, VO-053, VO-093 | `TC-FR19-01` (Scheduled summary delivery), `TC-FR19-02` (Shop memory inspection & deletion) | `NOT_STARTED` |
| **FR-20** | §14, §6.8 | Vya quality and safety: multi-tier model routing with auto-failover; response streaming; third-party text treated as untrusted data; confirmation cards for writes; golden eval set. | Vya Core Gateway | `VO-050`, `VO-051`, `VO-052`, `VO-056` | ADR-007 | `TC-FR20-01` (Model failover & streaming latency), `TC-FR20-02` (Prompt injection resistance) | `NOT_STARTED` |
| **FR-21** | §14, §8.18-20 | Integrations: Google Business Profile sync, Meta social/catalog posting, delivery partners, and payment gateways behind health-checked adapters with visible fallbacks. | Integrations | `VO-113`, `VO-114`, `VO-115` | ADR-017, ADR-018, ADR-019 | `TC-FR21-01` (GBP & Meta adapter contracts), `TC-FR21-02` (Delivery dispatch idempotency) | `NOT_STARTED` |
| **FR-22** | §14, §9.5 | Reseller toolkit: white-label branding, client billing with licensed split settlement, earnings view, Academy certification, lead routing. | Reseller Hub | `VO-088`, `VO-110`, `VO-111`, `VO-112` | VO-022, ADR-010 | `TC-FR22-01` (Split-settlement sandbox flow), `TC-FR22-02` (Earnings reconciliation & white-label) | `NOT_STARTED` |
| **FR-23** | §14, §10.5 | UPI-first payments: zero-setup UPI QR and intent links on orders and bills; distinct state machine (`Claimed` vs `Received` vs `Paid`). | Payments | `VO-083` | VO-062, VO-082 | `TC-FR23-01` (UPI intent/QR generation), `TC-FR23-02` (Claim vs Received state transition) | `NOT_STARTED` |

---

## 3. Non-Functional Requirements (NFRs)

Mapped from Sections 6, 15, 17, 18, 20 of `PRD_FINAL_v2_2026-11-03.md` and Section 21 of `PRD_v3_full_scale_2026-10-30.md`:

| Req ID | PRD Section | Requirement Description | Success Metric / Budget | Related Task ID | Acceptance Test ID | Status |
|---|---|---|---|---|---|---|
| **NFR-PERF-01** | §18.2 | Mobile-first responsive layouts across breakpoints: 320, 390, 768, 1024, 1440 px. | 390 px complete workflow target; 0 horizontal overflow. | `VO-015`, `VO-132` | `TC-NFR-RESP-01` | `NOT_STARTED` |
| **NFR-PERF-02** | §18.3, v3 §21 | Public website loading speed and runtime bundle isolation. | p95 < 800ms load; zero Vya/Admin/3D code in client bundle. | `VO-042`, `VO-133` | `TC-NFR-PERF-01` | `NOT_STARTED` |
| **NFR-PERF-03** | §6.19, §18.3 | Vya AI streaming and voice response latency. | First token < 2s streaming; Voice reply < 4s audio start. | `VO-050`, `VO-052`, `VO-105` | `TC-NFR-PERF-02` | `NOT_STARTED` |
| **NFR-A11Y-01** | §18.1 | Web Content Accessibility Guidelines compliance. | WCAG 2.2 AA compliant; visible focus, keyboard nav, 200% zoom. | `VO-013`, `VO-132` | `TC-NFR-A11Y-01` | `NOT_STARTED` |
| **NFR-A11Y-02** | §6.21, §18.1 | Motion control and assistive animation standards. | `prefers-reduced-motion` respected; H1 mascot never blocks CTAs. | `VO-107`, `VO-132` | `TC-NFR-A11Y-02` | `NOT_STARTED` |
| **NFR-REL-01** | v3 §21 | Platform availability and Service Level Objectives. | 99.9% uptime public sites; 99.5% builder & operations dashboard. | `VO-123`, `VO-137` | `TC-NFR-SLO-01` | `NOT_STARTED` |
| **NFR-REL-02** | v3 §21 | Peak load and concurrency capacity. | 10,000 concurrent active users; 500 order transactions/sec peak. | `VO-133` | `TC-NFR-LOAD-01` | `NOT_STARTED` |
| **NFR-REL-03** | v3 §21 | Backup, Disaster Recovery, RPO & RTO. | Automated hourly DB snapshots; RPO < 1 hour, RTO < 4 hours. | `VO-134` | `TC-NFR-DR-01` | `NOT_STARTED` |
| **NFR-I18N-01** | §14, §6.17 | Localization, Indic font rendering, and speech clarity. | English + 8 Indian languages; no layout breakage in complex scripts. | `VO-012`, `VO-106` | `TC-NFR-I18N-01` | `NOT_STARTED` |

---

## 4. Business Modules Traceability (MOD-01 to MOD-24)

Mapped from Section 8 of `PRD_FINAL_v2_2026-11-03.md`:

| Module ID | Module Name | PRD Section | Capabilities & Scope | Backlog Tasks | Acceptance Test ID | Status |
|---|---|---|---|---|---|---|
| **MOD-01** | Platform Core | §8.1 | Auth, workspaces, multi-tenancy, memberships, plans, media storage, audit logs. | `VO-020` to `VO-028` | `TC-MOD01-CORE` | `NOT_STARTED` |
| **MOD-02** | Website Engine | §8.2 | Structured JSON schema, approved blocks, renderer, themes, versions, rollback. | `VO-040` to `VO-049` | `TC-MOD02-WEB` | `NOT_STARTED` |
| **MOD-03** | Catalogue & Services | §8.3 | Categories, items, variants, modifiers, prices, images, search, stock availability. | `VO-060` | `TC-MOD03-CAT` | `NOT_STARTED` |
| **MOD-04** | Enquiries & Leads | §8.4 | Custom forms, lead pipeline, source attribution, assignment, follow-up dates. | `VO-061` | `TC-MOD04-ENQ` | `NOT_STARTED` |
| **MOD-05** | Orders | §8.5 | Cart, server totals, pickup/delivery/table context, status workflow, refund refs. | `VO-062` | `TC-MOD05-ORD` | `NOT_STARTED` |
| **MOD-06** | Appointments | §8.6 | Services, staff schedules, duration, slot calculation, no double-booking, reschedule. | `VO-063` | `TC-MOD06-APT` | `NOT_STARTED` |
| **MOD-07** | Inventory | §8.7 | Stock counts, stock movement ledger, low-stock alerts, WhatsApp back-in-stock. | `VO-064` | `TC-MOD07-INV` | `NOT_STARTED` |
| **MOD-08** | Property Listings | §8.8 | Buy/rent listings, property attributes, filters, site-visit requests, agent allocation. | `VO-065` | `TC-MOD08-PROP` | `NOT_STARTED` |
| **MOD-09** | QR Management | §8.9 | Dynamic redirects, main business QR, table/product/page QR, print exports. | `VO-049` | `TC-MOD09-QR` | `NOT_STARTED` |
| **MOD-10** | Feedback & Reviews | §8.10 | Private feedback, GBP review sync, Vya reply drafting, 2-hr post-visit review nudges. | `VO-113` | `TC-MOD10-REV` | `NOT_STARTED` |
| **MOD-11** | Offers & Loyalty | §8.11 | Coupons, digital stamp cards ("5 coffees, 1 free"), birthday & win-back nudges. | `VO-060`, `VO-098` | `TC-MOD11-LOY` | `NOT_STARTED` |
| **MOD-12** | Analytics | §8.12 | Verified funnel events, WOS metric, WhatsApp delivery stats, bill totals, Vya costs. | `VO-121` | `TC-MOD12-ANA` | `NOT_STARTED` |
| **MOD-13** | WhatsApp Layer | §8.13 | Level 1 share links + Level 2 Cloud API via BSP, order alerts, bill shares, inbox. | `VO-090` to `VO-095` | `TC-MOD13-WA` | `NOT_STARTED` |
| **MOD-14** | Udhaar & Balances | §8.14 | Pay-later running ledger, WhatsApp reminders with UPI link, auto receipt on payment. | `VO-080`, `VO-083`, `VO-098` | `TC-MOD14-UDH` | `NOT_STARTED` |
| **MOD-15** | Bills & GST Invoices | §8.15 | Server-calculated GST, HSN/SAC, sequential numbering, PDF/thermal, credit notes. | `VO-081`, `VO-082` | `TC-MOD15-GST` | `NOT_STARTED` |
| **MOD-16** | Customer CRM & Broadcasts | §8.16 | Customer profiles, consent ledger, tags, segments, preview count & cost broadcast. | `VO-080`, `VO-096` | `TC-MOD16-CRM` | `NOT_STARTED` |
| **MOD-17** | Automation Engine | §8.17 | Event-driven triggers, delays, conditions, quiet hours, niche-specific recipes. | `VO-097`, `VO-098` | `TC-MOD17-AUTO` | `NOT_STARTED` |
| **MOD-18** | Google Business Profile Sync | §8.18 | Hours, photos, posts, location sync, review retrieval and drafted replies. | `VO-113` | `TC-MOD18-GBP` | `NOT_STARTED` |
| **MOD-19** | Auto Social Posts | §8.19 | 1:1, 4:5, 9:16 templates, festival calendar, draft queue for Instagram/Facebook. | `VO-114` | `TC-MOD19-SOC` | `NOT_STARTED` |
| **MOD-20** | Delivery Integration | §8.20 | Hyperlocal delivery partner dispatch (Porter, Borzo, etc.), tracking links on WA. | `VO-115` | `TC-MOD20-DEL` | `NOT_STARTED` |
| **MOD-21** | Staff App & Counter Mode | §8.21 | PIN-based login, role-restricted counter view, large touch UI, staff action audit. | `VO-116` | `TC-MOD21-STAFF` | `NOT_STARTED` |
| **MOD-22** | Campaign Pages | §8.22 | Single-purpose offer/event pages from approved blocks, paired QR and WA links. | `VO-041`, `VO-049` | `TC-MOD22-CAMP` | `NOT_STARTED` |
| **MOD-23** | Client App PWA | §8.23 | Installable PWA manifest, offline catalog/menu browsing, push notifications. | `VO-117` | `TC-MOD23-PWA` | `NOT_STARTED` |
| **MOD-24** | Reseller Toolkit | §8.24, §9.5 | White-label, in-app client billing with split payout, portfolio metrics, Academy. | `VO-088`, `VO-110` to `VO-112` | `TC-MOD24-RES` | `NOT_STARTED` |

---

## 5. Supported Niche Groups Traceability (NICHE-01 to NICHE-09)

Mapped from Section 7 of `PRD_FINAL_v2_2026-11-03.md`:

| Niche Group ID | Niche Group Name | PRD Section | Representative Businesses | Specialized Operations Module | Backlog Task | Acceptance Test ID | Status |
|---|---|---|---|---|---|---|---|
| **NICHE-01** | Food & Hospitality | §7.1 | Café, Restaurant, Bakery, Cloud kitchen, Food truck, Hotel/Homestay, Caterer. | Digital menu, table QR, modifiers, pickup/delivery orders, kitchen display. | `VO-070` | `TC-NICHE-01` | `NOT_STARTED` |
| **NICHE-02** | Beauty, Wellness & Fitness | §7.2 | Salon, Spa, Barber, Makeup artist, Gym, Yoga studio, Personal trainer. | Service menu, staff availability, appointment booking, packages, memberships. | `VO-071` | `TC-NICHE-02` | `NOT_STARTED` |
| **NICHE-03** | Retail & Local Commerce | §7.3 | Kirana, General store, Supermarket, Boutique, Footwear, Electronics, Nursery. | Product catalogue, variants, cart, inventory tracking, pickup/delivery choice. | `VO-072` | `TC-NICHE-03` | `NOT_STARTED` |
| **NICHE-04** | Professional & Home Services | §7.4 | Electrician, Plumber, Carpenter, Cleaning, Consultant, Photographer, Interior designer. | Service areas, quotation requests, consultations, job cards, lead tracking. | `VO-073` | `TC-NICHE-04` | `NOT_STARTED` |
| **NICHE-05** | Automotive & Repair | §7.5 | Vehicle garage, Car/bike wash, Detailing, Repair shop. | Service packages, repair requests, estimates, job card tracking, completion SMS/WA. | `VO-074` | `TC-NICHE-05` | `NOT_STARTED` |
| **NICHE-06** | Education | §7.6 | Coaching centre, Tuition teacher, Training institute, Music/art class. | Courses, class batches, faculty profiles, demo-class booking, fee links. | `VO-075` | `TC-NICHE-06` | `NOT_STARTED` |
| **NICHE-07** | Real Estate | §7.7 | Property broker, Builder/developer, Rental manager, Commercial consultant. | Property listings, filters, site-visit scheduling, brochures, agent routing. | `VO-076` | `TC-NICHE-07` | `NOT_STARTED` |
| **NICHE-08** | Operational Services & Rentals | §7.8 | Laundry/dry cleaner, Tailor, Printing shop, Equipment rental, Party rental. | Pickup scheduling, measurement capture, rental deposits, return tracking. | `VO-077`, `VO-078` | `TC-NICHE-08` | `NOT_STARTED` |
| **NICHE-09** | Other Business | §7.9 | Unlisted business models. | Custom questionnaire, automatic mapping to approved modules, manual review flag. | `VO-030`, `VO-054` | `TC-NICHE-09` | `NOT_STARTED` |

---

## 6. Vya AI Requirements Traceability (VYA-01 to VYA-13)

Mapped from Section 6 of `PRD_FINAL_v2_2026-11-03.md`:

| Req ID | PRD Section | AI Capability / Requirement | Implementation Specification | Backlog Task | Acceptance Test ID | Status |
|---|---|---|---|---|---|---|
| **VYA-01** | §6.1, §6.21 | Mascot H1 Character & Animation | Floating speech-bubble robot with marigold kurta; states: idle, bob, blink, talk, listen; voice tap-only. | `VO-107` | `TC-VYA-01-MASCOT` | `NOT_STARTED` |
| **VYA-02** | §6.2, §6.14-16 | Dual Job Model + Customer Bot | Builder mode (site generation) + Daily helper mode (owner summaries) + WhatsApp customer bot. | `VO-054`, `VO-102`, `VO-104` | `TC-VYA-02-ROLES` | `NOT_STARTED` |
| **VYA-03** | §6.3, §6.4 | Controlled Action Model | Tools-not-free-text; facts (prices, tax, stock) only from database; confirm-before-acting on writes. | `VO-053`, `VO-056`, `VO-101` | `TC-VYA-03-GUARD` | `NOT_STARTED` |
| **VYA-04** | §6.8 | Model Routing & Failover | Claude Sonnet 5.5 (Primary), Gemini Flash (Fallback), Haiku/Flash-Lite (Fast), Sarvam (Indian STT/TTS). | `VO-050` | `TC-VYA-04-ROUTER` | `NOT_STARTED` |
| **VYA-05** | §6.9 | Shop Memory Architecture | Isolated shop profile, rolling summaries, learned facts; owner view and deletion controls. | `VO-058` | `TC-VYA-05-MEMORY` | `NOT_STARTED` |
| **VYA-06** | §6.10 | Persona & System Prompts | Empathetic, concise, conversational Hindi/English/Hinglish tone; strict system prompts. | `VO-051` | `TC-VYA-06-PROMPT` | `NOT_STARTED` |
| **VYA-07** | §6.11, §6.13 | Function Calling & Tool Schemas | 6 canonical JSON tool schemas; PendingAction card confirmation tokens for all mutations. | `VO-053`, `VO-056`, `VO-100`, `VO-101` | `TC-VYA-07-TOOLS` | `NOT_STARTED` |
| **VYA-08** | §6.14 | Structured JSON Site Generation | Assembles validated block configurations; zero executable arbitrary code generation. | `VO-057` | `TC-VYA-08-SITEGEN` | `NOT_STARTED` |
| **VYA-09** | §6.15 | Scheduled Daily Jobs | Morning summary, evening sales total, low-stock notifications in business timezone. | `VO-102` | `TC-VYA-09-JOBS` | `NOT_STARTED` |
| **VYA-10** | §6.16 | Vya on WhatsApp for Owners | Verified owner chat interface; daily briefings and approval cards delivered on WhatsApp. | `VO-103` | `TC-VYA-10-WAOWN` | `NOT_STARTED` |
| **VYA-11** | §6.17 | Voice Input & Synthesis | Hold-to-talk, Indian language STT/TTS, captions always displayed, tap-to-play audio. | `VO-105` | `TC-VYA-11-VOICE` | `NOT_STARTED` |
| **VYA-12** | §6.18 | Prompt-Injection & Cost Caps | Untrusted message isolation, rate limits, plan token allowances, automated spend alerts. | `VO-050`, `VO-104` | `TC-VYA-12-SAFETY` | `NOT_STARTED` |
| **VYA-13** | §6.19, §6.20 | Speed & Quality Golden Eval Gate | Latency < 2s streaming; golden evaluation suite with 100+ prompt checks per language. | `VO-051`, `VO-106` | `TC-VYA-13-EVAL` | `NOT_STARTED` |

---

## 7. Security, Privacy and Compliance Traceability

Mapped from Section 17 of `PRD_FINAL_v2_2026-11-03.md` and Section 20 of `PRD_v3_full_scale_2026-10-30.md`:

| Req ID | Domain | Requirement Description | Technical Enforcement | Backlog Task | Acceptance Test ID | Status |
|---|---|---|---|---|---|---|
| **SEC-01** | Authorization | Role-Based Access Control (RBAC) across Platform Admin, Reseller, Business Owner, Staff. | Central server authorization guards on all protected API routes; denial tests. | `VO-022`, `VO-120` | `TC-SEC-RBAC-01` | `NOT_STARTED` |
| **SEC-02** | Tenant Isolation | Multi-tenant isolation at DB and application layer (`business_id` scoping). | PostgreSQL RLS policies where supported; tenant boundary unit/integration tests. | `VO-024`, `VO-131` | `TC-SEC-TENANT-01` | `NOT_STARTED` |
| **SEC-03** | Webhooks | Webhook signature verification and replay resistance for payments and WhatsApp. | HMAC SHA256 signature verification; idempotency cache on webhook IDs. | `VO-085`, `VO-091` | `TC-SEC-WH-01` | `NOT_STARTED` |
| **SEC-04** | Secrets Management | Zero secrets in client-side bundles, code repositories, or logs. | Validated server-only environment schema; automated scanner check. | `VO-016`, `VO-131` | `TC-SEC-SECR-01` | `NOT_STARTED` |
| **SEC-05** | AI Prompt Injection | Protection against malicious customer messages altering assistant behavior. | Input treated as data; tool allow-lists; confirmation tokens for actions. | `VO-050`, `VO-104` | `TC-SEC-INJ-01` | `NOT_STARTED` |
| **SEC-06** | Audit Logging | Immutable audit trails for all financial, role, and publishing mutations. | Dedicated audit log table capturing actor, action, timestamp, target, IP. | `VO-028`, `VO-120` | `TC-SEC-AUD-01` | `NOT_STARTED` |
| **PRIV-01** | DPDP Act 2023 | Consent recording, purpose limitation, and Data Principal rights (access, correction, erasure). | Consent ledger per customer; user-initiated data export and deletion workflows. | `VO-080`, `VO-124` | `TC-PRIV-DPDP-01` | `NOT_STARTED` |
| **PRIV-02** | AI Privacy | Zero training on user data by LLMs; PII masking before external provider dispatch. | Pre-flight PII redaction layer; contract terms prohibiting model training. | `VO-050` | `TC-PRIV-AI-01` | `NOT_STARTED` |
| **PRIV-03** | Messaging Opt-Out | Immediate STOP handling for WhatsApp marketing; quiet hours enforcement (9 PM - 9 AM). | Automated opt-out trigger; queue suppression during quiet hours. | `VO-092` | `TC-PRIV-OPT-01` | `NOT_STARTED` |
| **COMP-01** | RBI PA/PG | Platform must not hold or pool customer or reseller funds. | Direct payment gateway merchant integration; licensed split-settlement provider. | `VO-084`, `VO-088` | `TC-COMP-RBI-01` | `NOT_STARTED` |
| **COMP-02** | CERT-In | Incident reporting readiness within statutory 6-hour window. | Structured security logging, anomaly alerts, documented incident runbook. | `VO-123`, `VO-134` | `TC-COMP-CERT-01` | `NOT_STARTED` |

---

## 8. Payment, GST Billing and Money Flow Traceability

Mapped from Section 10, 8.14, 8.15 of `PRD_FINAL_v2_2026-11-03.md`:

| Req ID | Requirement Description | Processing Rules | Backlog Task | Acceptance Test ID | Status |
|---|---|---|---|---|---|
| **PAY-01** | Zero-Setup UPI QR & Intent | Dynamic QR and `upi://pay` link on orders and bills with prefilled amount and transaction ref. | `VO-083` | `TC-PAY-UPI-01` | `NOT_STARTED` |
| **PAY-02** | Payment State Separation | Strict distinction: `Claimed by customer` vs `Received (staff confirmed)` vs `Paid (gateway verified)`. | `VO-083`, `VO-086` | `TC-PAY-STATE-01` | `NOT_STARTED` |
| **PAY-03** | Gateway Adapter Framework | Provider-neutral adapter interface supporting Razorpay, Cashfree, PhonePe PG. | `VO-084`, `VO-085` | `TC-PAY-GW-01` | `NOT_STARTED` |
| **PAY-04** | Payment Ledger & Reconciliation | Immutable payment records, refund tracking, automated gateway settlement reconciliation. | `VO-086` | `TC-PAY-REC-01` | `NOT_STARTED` |
| **PAY-05** | GST Calculation & Tax Engine | CGST/SGST/IGST computed strictly from server tax tables; AI never calculates tax. | `VO-081` | `TC-BILL-GST-01` | `NOT_STARTED` |
| **PAY-06** | Sequential Billing & Formats | Gap-free sequential invoice numbering per financial year; PDF/thermal formats; credit notes. | `VO-082` | `TC-BILL-NUM-01` | `NOT_STARTED` |
| **PAY-07** | GST e-Invoicing (IRN) | Support IRN and signed QR code generation for qualifying businesses above threshold. | `VO-082` | `TC-BILL-EINV-01` | `NOT_STARTED` |
| **PAY-08** | Udhaar Running Statements | Customer pay-later balance ledger with automated WhatsApp reminder links. | `VO-080`, `VO-083` | `TC-BILL-UDH-01` | `NOT_STARTED` |
| **PAY-09** | Reseller Subscriptions & Quotas | Reseller plans, feature flags, live website slots, grace periods, downgrade retention. | `VO-026`, `VO-087` | `TC-SUB-QUOTA-01` | `NOT_STARTED` |
| **PAY-10** | Reseller Client Billing & Split | In-app billing of clients with automated split settlement; platform fee deduction. | `VO-088` | `TC-RES-SPLIT-01` | `NOT_STARTED` |

---

## 9. WhatsApp and Automation Engine Traceability

Mapped from Section 8.13, 8.16, 8.17 of `PRD_FINAL_v2_2026-11-03.md`:

| Req ID | Requirement Description | Technical Invariants | Backlog Task | Acceptance Test ID | Status |
|---|---|---|---|---|---|
| **WA-01** | Level 1 Share Links | Click-to-chat `wa.me` links with prefilled text on every public page and counter bill. | `VO-090` | `TC-WA-LVL1-01` | `NOT_STARTED` |
| **WA-02** | Level 2 Cloud API via BSP | Automated order updates, booking confirmations, PDF bill shares with UPI pay links. | `VO-091`, `VO-094` | `TC-WA-LVL2-01` | `NOT_STARTED` |
| **WA-03** | Shared Inbox & Staff Assign | Inbound messages grouped by business, assigned to staff, quick replies, Vya suggestions. | `VO-095` | `TC-WA-INBOX-01` | `NOT_STARTED` |
| **WA-04** | Segmented Marketing Broadcasts | Draft preview showing exact text, verified opted-in recipient count, and estimated cost. | `VO-096` | `TC-WA-BCAST-01` | `NOT_STARTED` |
| **WA-05** | Prepaid Message Wallet | Rechargeable credit wallet, usage ledger, spend caps, provider rate reconciliation. | `VO-099` | `TC-WA-WALL-01` | `NOT_STARTED` |
| **AUTO-01** | Workflow Automation Engine | Event triggers, condition evaluators, delayed actions, execution history, retry policies. | `VO-097` | `TC-AUTO-ENG-01` | `NOT_STARTED` |
| **AUTO-02** | Ready-Made Niche Recipes | Pre-built automations: payment reminders, order updates, review requests, booking reminders. | `VO-098` | `TC-AUTO-REC-01` | `NOT_STARTED` |
| **AUTO-03** | Automation Guardrails | Quiet hours enforcement, per-customer frequency limits (2-3/week), duplicate loop block. | `VO-092`, `VO-097` | `TC-AUTO-SAFE-01` | `NOT_STARTED` |

---

## 10. Reseller Toolkit Traceability

Mapped from Section 9.5 of `PRD_FINAL_v2_2026-11-03.md`:

| Req ID | Requirement Description | Capabilities | Backlog Task | Acceptance Test ID | Status |
|---|---|---|---|---|---|
| **RES-01** | Mobile Reseller Workspace | Portfolio of client businesses managed from a phone; fast switching and draft resume. | `VO-022`, `VO-033` | `TC-RES-WS-01` | `NOT_STARTED` |
| **RES-02** | White-Label Branding | Reseller's custom logo, name, brand color, and custom dashboard domain boundary. | `VO-111` | `TC-RES-WL-01` | `NOT_STARTED` |
| **RES-03** | In-App Client Billing | Setup fees and monthly recurring billing in-app; offline cash recording mode. | `VO-088` | `TC-RES-BILL-01` | `NOT_STARTED` |
| **RES-04** | Split-Settlement Provider Flow | Automated client fund settlement to reseller via licensed payment provider split API. | `VO-088` | `TC-RES-SETTLE-01` | `NOT_STARTED` |
| **RES-05** | Reseller Earnings Dashboard | Real-time ledger: collected vs due vs overdue, net margin after platform fees, payout history. | `VO-110` | `TC-RES-EARN-01` | `NOT_STARTED` |
| **RES-06** | VyapOne Academy & Certifications | Training lessons, video guides, certification tests to qualify students and agencies. | `VO-112` | `TC-RES-ACAD-01` | `NOT_STARTED` |
| **RES-07** | Lead Routing | Unassigned incoming local business leads routed to certified resellers by city/niche. | `VO-112` | `TC-RES-LEAD-01` | `NOT_STARTED` |

---

## 11. General Availability Acceptance Criteria (AC-01 to AC-26)

Mapped from Section 23 of `PRD_FINAL_v2_2026-11-03.md`:

| AC ID | Acceptance Criteria Description | Mapped Backlog Tasks | Verification & Test Reference | Status |
|---|---|---|---|---|
| **AC-01** | Reseller registration and mobile workspace access from a phone. | `VO-015`, `VO-021`, `VO-022` | `TC-AC-01` (Mobile auth and workspace access) | `NOT_STARTED` |
| **AC-02** | Live-business plan limits enforced on the server (e.g., Starter: 3). | `VO-026` | `TC-AC-02` (Server-side site slot limit enforcement) | `NOT_STARTED` |
| **AC-03** | Selection of any listed niche and completion of category onboarding. | `VO-030`, `VO-031`, `VO-033` | `TC-AC-03` (All 8 niche group onboarding journeys) | `NOT_STARTED` |
| **AC-04** | Vya structured proposal grounded only in supplied/confirmed information. | `VO-054` | `TC-AC-04` (Proposal provenance & schema verification) | `NOT_STARTED` |
| **AC-05** | User ability to review, modify, and confirm Vya's proposal. | `VO-054` | `TC-AC-05` (Proposal edit and confirmation flow) | `NOT_STARTED` |
| **AC-06** | Editable, responsive website draft generated from approved components. | `VO-040`, `VO-041`, `VO-057` | `TC-AC-06` (Component block assembly and theme validation) | `NOT_STARTED` |
| **AC-07** | Essential editing and publishing workflow fully operable at 390 px viewport. | `VO-015`, `VO-044`, `VO-045` | `TC-AC-07` (End-to-end 390px mobile editor interaction) | `NOT_STARTED` |
| **AC-08** | Site preview, publish, update, and rollback functionality. | `VO-045`, `VO-048`, `VO-049` | `TC-AC-08` (Publish lifecycle and rollback verification) | `NOT_STARTED` |
| **AC-09** | Published site has a permanent platform URL and functional dynamic QR code. | `VO-042`, `VO-049` | `TC-AC-09` (Permanent URL routing and QR scan redirect) | `NOT_STARTED` |
| **AC-10** | Business owner invited without gaining access to other businesses. | `VO-024`, `VO-027` | `TC-AC-10` (Cross-tenant invitation and isolation test) | `NOT_STARTED` |
| **AC-11** | Every launch operational module completes its full customer and staff flow. | `VO-070` to `VO-078` | `TC-AC-11` (Operational workflows for all niche groups) | `NOT_STARTED` |
| **AC-12** | Payment states rely on trusted server verification where enabled. | `VO-085`, `VO-086` | `TC-AC-12` (Webhook signature and server verification) | `NOT_STARTED` |
| **AC-13** | Vya cannot access or modify data outside the authorized business. | `VO-024`, `VO-052`, `VO-053`, `VO-100` | `TC-AC-13` (AI tool tenant-isolation negative tests) | `NOT_STARTED` |
| **AC-14** | Public sites remain fully usable when AI, 3D, or glass effects are unavailable. | `VO-013`, `VO-042` | `TC-AC-14` (Graceful degradation and static fallbacks) | `NOT_STARTED` |
| **AC-15** | Critical flows pass accessibility (WCAG 2.2 AA), mobile, and security checks. | `VO-131`, `VO-132` | `TC-AC-15` (Automated axe-core, viewport, and pen tests) | `NOT_STARTED` |
| **AC-16** | Approved terms, privacy, cancellation, support, and data-retention policies. | `VO-124`, `VO-137` | `TC-AC-16` (Legal documentation and data retention checks) | `NOT_STARTED` |
| **AC-17** | WhatsApp Level 2 messages use approved templates, respect opt-in, quiet hours, caps, and fall back to Level 1. | `VO-090`, `VO-091`, `VO-092`, `VO-094` | `TC-AC-17` (Template compliance, opt-out, and fallback) | `NOT_STARTED` |
| **AC-18** | Bills compute GST from server tax tables (never AI), number gap-free, and share on WhatsApp with UPI pay link; CA reviewed. | `VO-081`, `VO-082` | `TC-AC-18` (GST calculation, sequential invoice integrity) | `NOT_STARTED` |
| **AC-19** | UPI claims are never displayed as "Paid" without verification or staff confirmation. | `VO-083` | `TC-AC-19` (UPI claim state machine transitions) | `NOT_STARTED` |
| **AC-20** | Vya speed targets met (first words < 2s; voice < 4s), auto failover, golden evaluation set passes in all launch languages. | `VO-050`, `VO-105`, `VO-106` | `TC-AC-20` (Latency benchmark and multilingual eval set) | `NOT_STARTED` |
| **AC-21** | Vya never executes a write action without confirmation card; resists prompt injection. | `VO-056`, `VO-101`, `VO-104` | `TC-AC-21` (PendingAction confirmation UX and injection tests) | `NOT_STARTED` |
| **AC-22** | Scheduled summaries and reminders run accurately in local business timezone without duplicates. | `VO-102` | `TC-AC-22` (Idempotent cron execution across timezones) | `NOT_STARTED` |
| **AC-23** | Reseller client billing settles funds via split provider without VyapOne holding client funds; legal review complete. | `VO-088` | `TC-AC-23` (Split-settlement sandbox reconciliation) | `NOT_STARTED` |
| **AC-24** | Google Business Profile and Meta integrations have verified platform approvals. | `VO-113`, `VO-114` | `TC-AC-24` (OAuth token management and adapter contracts) | `NOT_STARTED` |
| **AC-25** | Vya mascot respects reduced motion and never covers CTAs; voice plays only on tap with captions. | `VO-105`, `VO-107` | `TC-AC-25` (Mascot positioning, reduced motion, and audio caps) | `NOT_STARTED` |
| **AC-26** | Reviewed UI strings, WhatsApp templates, and bill formats for all launch languages. | `VO-106` | `TC-AC-26` (Multilingual template and string validation) | `NOT_STARTED` |

---

## 12. Traceability Gap Analysis

### 12.1 Requirements Without a Direct Task
All requirements from `PRD_FINAL_v2_2026-11-03.md` are covered across Phase P0 through P14. However, specific sub-features are contingent on external partner decisions or have been explicitly designated post-launch:
1. **Direct DIY Business Owner Onboarding at GA (ADR-021):**
   - *Status:* `PENDING_DECISION`.
   - *Analysis:* Mentioned as an open decision in FINAL §25. Tasks `VO-022` and `VO-033` provide foundational support, but a dedicated self-serve onboarding flow and separate DIY owner plan tier is held pending ADR-021 sign-off.
2. **ONDC Hyperlocal Integration (FINAL §8.20, §22 Phase 5):**
   - *Status:* `DEFERRED_POST_LAUNCH`.
   - *Mapped Task:* `VO-142`.
   - *Analysis:* Open Delivery Protocol / open commerce listing is intentionally classified as post-GA expansion.
3. **Native Branded App Wrappers (FINAL §8.23, §22 Phase 5):**
   - *Status:* `DEFERRED_POST_LAUNCH`.
   - *Mapped Task:* `VO-144`.
   - *Analysis:* PWA is the GA target; Capacitor native wrappers are scheduled for post-launch evaluation.
4. **Third-Party Module Marketplace (FINAL §22 Phase 5):**
   - *Status:* `DEFERRED_POST_LAUNCH`.
   - *Mapped Task:* `VO-141`.
5. **Public API & Webhook Developer Platform (v3 §14):**
   - *Status:* `DEFERRED_POST_LAUNCH`.
   - *Mapped Task:* `VO-143`.
6. **International Expansion (FINAL §22 Phase 5):**
   - *Status:* `DEFERRED_POST_LAUNCH`.
   - *Mapped Task:* `VO-145`.

### 12.2 Development Tasks Without an Explicit End-User Functional Requirement
The following tasks in `docs/TASK_BACKLOG.md` represent foundational, architecture, quality, or release engineering infrastructure. They do not map to a single consumer-facing FR, but support overarching Non-Functional Requirements (NFRs) and quality standards:

| Task ID | Task Title | Architectural / Infrastructure Purpose | Supporting NFR / Gate |
|---|---|---|---|
| **VO-000** | Inspect repository and PRD inputs | Greenfield audit, host environment inspection, document authority. | P0 Phase Gate |
| **VO-001** | Create requirements traceability map | Requirement verification, coverage analysis, gap discovery. | P0 Phase Gate |
| **VO-002** | Create source-of-truth and conflict register | Formal conflict resolution, document authority baseline. | P0 Phase Gate |
| **VO-003** | Create architecture decision records (ADRs) | Third-party stack, database, auth, and gateway decisions. | P0 Phase Gate |
| **VO-004** | Define system boundaries and threat model | Trust boundaries, STRIDE analysis, attack surface mitigations. | SEC-01 to SEC-06 |
| **VO-005** | Design domain architecture and data ownership | Canonical domain model (User, AuthIdentity, Workspace, Business, Location, HandoverRequest, Site, Orders, Bills, Sequences, Payments, Messages, Automations, Memory), multi-tenant database scoping, 5 ER diagrams, auditable handover, non-polymorphic payment check. | SEC-02, FR-01, FR-02, FR-11, FR-16 |
| **VO-006** | Create implementation conventions and quality gates | TypeScript rules, testing conventions, engineering standards. | P0 Phase Gate |
| **VO-010** | Initialize or normalize application workspace | Monorepo/workspace setup, Next.js, React, Tailwind foundation. | P1 Phase Gate |
| **VO-011** | Configure code quality tooling | ESLint, Prettier, TypeScript strict mode, test runners. | NFR-A11Y, SEC |
| **VO-012** | Implement design tokens | Emerald + Marigold centralized token system, typography, radii. | NFR-PERF-01, NFR-A11Y |
| **VO-013** | Build accessible shared UI primitives | Keyboard nav, accessible inputs, focus rings, state skeletons. | NFR-A11Y-01 |
| **VO-014** | Create application route shells | Responsive route layouts for Public, Reseller, Owner, Staff, Admin. | FR-01, FR-02 |
| **VO-016** | Implement application config and env handling | Server/client env validation, zero secret leak protection. | SEC-04 |
| **VO-017** | Add structured logging and error handling | Request IDs, sanitized JSON logs, user-safe error boundaries. | SEC-06, COMP-02 |
| **VO-018** | Set up CI and pull-request checks | Automated lint, typecheck, unit test, and build pipelines. | P1 Phase Gate |
| **VO-019** | Establish testing conventions and baseline coverage | Factory fixtures, test harness, seed demo data. | P1 Phase Gate |
| **VO-020** | Create database migration framework | Migration scripts, reproducible schemas, local DB workflow. | P2 Phase Gate |
| **VO-025** | Implement business profile settings | Core settings management, address, tax identity, provenance. | FR-02 |
| **VO-028** | Implement audit/activity and notification foundation | Audit logging primitives and in-app event dispatchers. | SEC-06, FR-13 |
| **VO-032** | Implement secure media upload pipeline | Direct-to-storage signed uploads, MIME/dimension checks. | FR-03, SEC-04 |
| **VO-034** | Build business import and confirmation review | Provenance UI for imported data; prevents unconfirmed writes. | FR-03, VYA-03 |
| **VO-043** | Implement navigation, SEO and metadata | Dynamic sitemap, OpenGraph tags, canonical URLs, robots.txt. | FR-07 |
| **VO-046** | Connect media and module data to website blocks | Dynamic block data-binding, broken reference detection. | FR-05, FR-09 |
| **VO-130** | Create full end-to-end acceptance suite | Automated CI regression suite covering critical journeys. | P13 Phase Gate |
| **VO-131** | Complete security and tenant-isolation assessment | Penetration tests, auth matrix, secret scans, injection suite. | SEC-01 to SEC-06 |
| **VO-132** | Complete accessibility and responsive audit | WCAG 2.2 AA audit, screen reader verification, zoom tests. | NFR-A11Y, NFR-PERF |
| **VO-133** | Complete performance and load testing | Load tests to 10k users, broadcast bursts, memory profiling. | NFR-REL-02, NFR-PERF |
| **VO-134** | Complete backup, DR and incident runbooks | Automated snapshots, disaster recovery drill, runbooks. | NFR-REL-03, COMP-02 |
| **VO-135** | Run private beta across every niche group | Pilot validation across all 8 niches, SLO monitoring. | P13 Phase Gate |
| **VO-136** | Run public beta readiness review | Exit criteria review, support readiness, financial check. | P13 Phase Gate |
| **VO-137** | Prepare and execute GA release | Production cutover, feature flags, final go-live approval. | P13 Phase Gate |
| **VO-138** | Run post-launch stabilization | Hypercare monitoring, defect fixes, telemetry review. | P13 Phase Gate |

### 12.3 Status of Acceptance Tests
Currently, no automated test code exists in the repository. All acceptance test IDs (`TC-*`) defined in this traceability matrix are designated as **Pending Specification and Test Authoring**. They will be implemented progressively in accordance with the Task Backlog:
- Unit & primitive component tests: Configured in `VO-019` and implemented in `VO-013` through `VO-124`.
- Security & tenant boundary tests: Configured in `VO-024` and audited in `VO-131`.
- Vya golden evaluation suite (100+ tests per language): Established in `VO-051` and verified in `VO-106`.
- End-to-end browser journeys: Built in `VO-130` and executed in `VO-135` through `VO-137`.

---

## 13. Summary of Traceability Health

| Category | Total Requirements | Mapped to Active Tasks (P0–P13) | Deferred to Post-Launch (P14) | Pending Business Decision | Unmapped Requirements |
|---|---|---|---|---|---|
| **Functional Requirements (FRs)** | 23 | 23 | 0 | 0 | **0** |
| **Non-Functional Requirements (NFRs)** | 9 | 9 | 0 | 0 | **0** |
| **Product Modules** | 24 | 24 | 0 | 0 | **0** |
| **Supported Niche Groups** | 9 | 9 | 0 | 0 | **0** |
| **Vya AI Capabilities** | 13 | 13 | 0 | 0 | **0** |
| **Security & Compliance Controls** | 11 | 11 | 0 | 0 | **0** |
| **Payment & Billing Capabilities** | 10 | 10 | 0 | 0 | **0** |
| **WhatsApp & Automation Rules** | 8 | 8 | 0 | 0 | **0** |
| **Reseller Toolkit Features** | 7 | 7 | 0 | 0 | **0** |
| **GA Acceptance Criteria (ACs)** | 26 | 26 | 0 | 0 | **0** |
| **Total Coverage** | **140** | **140** | **0** | **0** | **0** |

Every single launch requirement specified in `PRD_FINAL_v2_2026-11-03.md` and supplementary production guidance in `PRD_v3_full_scale_2026-10-30.md` is strictly mapped to an existing backlog task and defined acceptance test ID. Zero requirements are unmapped. Zero backlog tasks are orphaned.
