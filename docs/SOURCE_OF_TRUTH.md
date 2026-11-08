# VyapOne — Source of Truth and Conflict Register

**Document Version:** 2.0 (Authoritative)  
**Date:** 8 November 2026  
**Status:** Approved Canonical Baseline  
**Task ID:** VO-002  
**Backlog Reference:** `docs/TASK_BACKLOG.md`  
**Traceability Reference:** `docs/REQUIREMENTS_TRACEABILITY.md`  
**Decision Register:** `docs/DECISION_REGISTER.md`  

---

## 1. Document Authority Hierarchy

To eliminate ambiguity across development, testing, and automated agent workflows, requirements authority is governed by a strict four-tier hierarchy:

```
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 1: PRIMARY REQUIREMENTS AUTHORITY                                  │
│ reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md                      │
│ (Latest by document date; explicitly supersedes v1.0, v2.0, and v3.0)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ informs & bounds
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 2: SUPPLEMENTARY PRODUCTION & GA GUIDANCE                         │
│ reference/PRD_VERSIONS/PRD_v3_full_scale_2026-10-30.md                 │
│ (Engineering SLOs, DPDP/CERT-In controls, load targets, runbooks)       │
│ *Applies ONLY where compatible with and non-conflicting with FINAL*   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ informs
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 3: ARCHITECTURE DECISION RECORDS (ADRs)                           │
│ docs/DECISION_REGISTER.md & Approved ADR Documents                     │
│ (Vendor selections, provider adapters, legal/tax sign-offs)             │
│ *Must never guess; unapproved options stay Provisional or Pending*    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ provides context
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ TIER 4: HISTORICAL REFERENCES (NON-AUTHORITATIVE)                      │
│ reference/PRD_VERSIONS/PRD_v2_2026-10-30.md (MVP pilot draft)          │
│ reference/PRD_VERSIONS/PRD_v1_original_2026-10-16.md (Initial base)    │
│ *Must NEVER silently override, modify, or dilute Tier 1 requirements*   │
└────────────────────────────────────────────────────────────────────────┘
```

### Governing Authority Rules
1. **Supremacy of FINAL v2.0:** On any point where earlier PRD versions diverge in branding, scope, color tokens, AI behavior, operational workflows, or acceptance criteria, `PRD_FINAL_v2_2026-11-03.md` governs unconditionally.
2. **Subordination of Supplementary v3:** Engineering guidance from `PRD_v3_full_scale_2026-10-30.md` (e.g., target concurrency of 10,000 users, 99.9% uptime SLO, DPDP consent mechanisms, disaster recovery RTO/RPO) is binding *only* when it reinforces or details the architecture of FINAL v2.0. Any obsolete v3 assumptions (such as the earlier emerald/pearl palette or the earlier tagline) are invalid.
3. **Historical Isolation:** v1 and v2 are preserved strictly for historical lineage and design rationale. No historical statement can be cited to countermand FINAL v2.0.
4. **No Silent Assumptions:** Third-party providers (payment gateways, WhatsApp BSPs, hosting providers, AI model vendors) and statutory rules (GST rates, tax slabs, data retention holds) remain provisional until formally approved via ADRs.

---

## 2. Canonical Product Requirements Baseline

The authoritative product requirements for VyapOne at General Availability (GA) are:

- **Product Name & Brand Line:** **VyapOne** — *"Every business. One platform."* (FINAL §1, §11.4).
- **Core Market & Persona:** Resellers, freelancers, students, and agencies who onboard and run operations for Indian local businesses from a mobile phone (FINAL §2, §4).
- **Launch Approach:** **Single full-scale public launch** (FINAL §10, §21). No phased MVP or public beta with partial modules; internal private beta testing is permitted prior to public GA.
- **Tenancy Hierarchy:** `Platform → Reseller Workspace → Business → Location` (FINAL §15.2). Multi-tenancy enforced on server APIs and via PostgreSQL Row-Level Security (RLS).
- **Design System:** **Emerald + Marigold** (FINAL §12.1).
  - Primary Green: `#0B6E4F` | Primary Hover: `#095C42` | Deep Green: `#0A3D2E`
  - Accent Marigold: `#F5A524` (Reserved for high-priority CTAs, badge highlights, dark text)
  - Warm Canvas: `#FAF8F3` | Surface Cards: `#FFFFFF` | Core Text: `#10201A` | Secondary Text: `#5B6B63` | Borders: `#E7E2D6`
- **Vya AI Assistant & Mascot:**
  - Mascot Character: **"H1"** — floating green speech-bubble robot with a marigold kurta collar, bobbing/blinking/talking animations, respecting `prefers-reduced-motion` (FINAL §6.21, §11.5).
  - Voice Direction: Original English confident-playful male with a light robotic sheen, tap-to-play only with persistent captions (FINAL §6.21).
  - Model Routing: Primary = Claude Sonnet 5.5, Fallback = Gemini Flash, Fast/Small Tasks = Claude Haiku 5.5 / Gemini Flash-Lite, Indian Speech = Sarvam (FINAL §6.8).
  - Safety & Code Generation: Vya configures **approved structured JSON component blocks only**; Vya **never writes or executes arbitrary code** in production (FINAL §6.14, §15.3).
  - Confirm-Before-Act: All mutations (pricing, catalog edits, billing, bulk messaging, publishing) require structured `PendingAction` confirmation tokens (FINAL §6.13).
- **Operations & Launch Modules:** All 8 supported niche groups (Food/Hospitality, Beauty/Wellness, Retail, Professional Services, Automotive, Education, Real Estate, Rentals/Services) possess functional operational modules at launch (FINAL §7, §8, §21.2).
- **WhatsApp Integration:** Dual-tier architecture (FINAL §8.13).
  - Level 1: Zero-setup `wa.me` click-to-chat links and order sharing.
  - Level 2: WhatsApp Business Platform (Cloud API) via an approved BSP for automated notifications, bills with UPI links, shared inbox, and segmented marketing broadcasts with explicit opt-in, quiet hours (9 PM–9 AM), and recipient count/cost previews.
- **Payments & Billing:**
  - UPI-First: Zero-setup dynamic UPI QR and intent links (`upi://pay`) on every order and bill (FINAL §10.5).
  - Strict Payment States: `Claimed by customer` vs `Received (staff confirmed)` vs `Paid (gateway verified)`. A customer claim alone is **never** proof of payment (FINAL §10.5, AC-19).
  - GST Invoicing: Server-computed tax rates from validated tax tables (never AI); sequential gap-free numbering; PDF and thermal receipt formatting (FINAL §8.15).
  - Reseller Client Billing: In-app recurring client billing executing exclusively via licensed payment provider split settlements. **VyapOne never holds or pools client funds** (FINAL §9.5, §10.1).

---

## 3. Version Conflict Register (v1, v2, v3 vs. FINAL)

The following matrix records all substantive differences across the four PRD versions:

| Topic | PRD v1.0 (2026-10-16) | PRD v2.0 (2026-10-30) | PRD v3.0 (2026-10-30) | PRD FINAL v2.0 (2026-11-03) | Conflict Classification & Canonical Truth |
|---|---|---|---|---|---|
| **Brand Tagline** | *"Har business. One platform."* | *"Har business. One platform."* | *"Har business. One platform."* | *"Every business. One platform."* | **RESOLVED:** FINAL v2.0 governs. Canonical brand line is *"Every business. One platform."* |
| **Launch Scope Model** | Large phased MVP with subsequent phases | Tight MVP (1 vertical pilot in 1 city, food or salon) | Single full-scale launch (GA v1.0) | One complete, full-scale launch; all launch niches ready at GA | **RESOLVED:** FINAL v2.0 governs. All launch operational modules ship at GA. |
| **Color Palette** | Emerald + Pearl (`#087A55`, `#F4FAF7`) | Emerald + Pearl | Emerald + Pearl | **Emerald + Marigold** (Primary `#0B6E4F`, Accent `#F5A524`, BG `#FAF8F3`) | **RESOLVED:** FINAL v2.0 governs. The active landing page and tokens use Emerald + Marigold. |
| **Vya Mascot** | Abstract concept | Abstract concept | Conceptual assistant | Mascot **"H1"** (green speech-bubble robot with marigold collar, bob/blink/talk states) | **RESOLVED:** FINAL v2.0 governs. Mascot H1 with specified animation states is mandatory. |
| **Vya Model Routing** | Single unspecified model | General routing idea | Primary / fallback concept | Explicit routing: Sonnet 5.5 (main), Flash (fallback), Haiku/Flash-Lite (fast), Sarvam (speech) | **RESOLVED:** FINAL v2.0 governs. Router architecture must support this multi-tier model stack. |
| **Vya Voice Persona** | Unspecified | General TTS | General TTS | Confident-playful male with light robotic sheen, 11labs config, tap-to-play with captions | **RESOLVED:** FINAL v2.0 governs. Audio never autoplays; always captioned. |
| **WhatsApp Scope** | External contact links | Level 1 click-to-chat + Level 2 order updates | Both levels at GA, shared inbox, broadcasts | Level 1 share links + Level 2 BSP Cloud API, templates, STOP opt-out, quiet hours, cost previews | **RESOLVED:** FINAL v2.0 governs. Both levels, consent ledger, and cost previews are launch scope. |
| **Payment Status Logic** | Generic paid status | UPI QR first, gateway later | UPI + Payment Gateway | UPI-first zero setup + Gateway adapter; strict `Claimed` vs `Received` vs `Paid` separation | **RESOLVED:** FINAL v2.0 governs. Customer UPI claim alone never sets status to `Paid`. |
| **Statutory Tax (GST)** | Generic invoicing | GST-ready bills | GST bills + e-invoicing | Gap-free sequential numbering, tax tables server-controlled (never AI), CA review required | **RESOLVED:** FINAL v2.0 governs. Deterministic server calculation only. |
| **Reseller Client Billing** | None (plan slots only) | In-app billing concept | Client billing & earnings | In-app billing with split settlement (no fund pooling), earnings dashboard, Academy, lead routing | **RESOLVED:** FINAL v2.0 governs. Funds must settle directly via provider split API. |
| **Delivery Integration** | Dunzo mentioned as example | Dunzo mentioned as example | Hyperlocal partners | Dunzo is noted as defunct (Jan 2025). Candidate partners: Porter, Borzo, Rapido, Shadowfax | **RESOLVED:** FINAL v2.0 governs. Dunzo is removed; city-specific partner adapters utilized. |
| **Direct DIY Owner Plan** | General self-serve audience | Added DIY owner plan | Core launch tier alongside resellers | Kept as an **Open Decision (ADR-021)**; launch priority is reseller-first | **UNRESOLVED (Pending Owner Decision):** Held as ADR-021. Core architecture supports both, but marketing/billing prioritizes resellers. |
| **Pricing & Plan Fees** | Starter/Growth/Agency | Added Free tier, add-ons | Hypotheses for beta | Explicitly hypotheses to validate; unconfirmed | **UNRESOLVED (Pending Validation):** Prices in PRD are hypotheses; must remain configurable in DB. |
| **Custom Subdomain Domain** | `vyapone.com` / unspecified | Unspecified | `vyapone.in` candidate | Free subdomain domain (e.g. `*.vyapone.in`) is an open choice | **UNRESOLVED (Pending Domain Decision):** Tracked in ADR-012. |

---

## 4. Status of Conflicts: Resolved vs. Unresolved

### 4.1 Resolved Conflicts
1. **Brand Line & Logo:** Canonical brand line is *"Every business. One platform."*. Logo concept is the unified V-1 vector mark.
2. **Design Palette:** Emerald + Marigold is the official color system. Earlier references to Emerald + Pearl in v1, v2, and v3 are deprecated.
3. **Launch Strategy:** Full-scale launch model (FINAL §21) replaces the single-vertical MVP pilot of v2. All 8 niche group operational modules must be complete prior to public GA.
4. **Vya AI Architecture:** Vya's persona, mascot H1, animation states, voice profile, multi-model routing, and confirm-before-act safeguards are canonically fixed per FINAL §6.
5. **Code Generation Boundary:** Vya generates structured JSON configurations for approved blocks only. AI-generated arbitrary runtime code is strictly prohibited.
6. **Payment Status Semantics:** The tripartite state machine (`Claimed` vs `Received` vs `Paid`) is canonical.
7. **Statutory Tax Rule:** GST is calculated exclusively by server-side tax tables. AI is strictly barred from computing or modifying taxes.
8. **Delivery Partner Deprecation:** Dunzo is officially recognized as defunct and removed from active architecture.

### 4.2 Unresolved Conflicts & Product-Owner Decisions
1. **ADR-021: Direct DIY Business Owner Plan at GA:** PRD v3 assumed direct self-serve onboarding at launch; PRD FINAL §25 keeps this open to prevent reseller channel conflict.
2. **ADR-011: Subscription Pricing & Add-On Fee Structure:** Plan fees (e.g., ₹399/mo, ₹999/mo) and add-on rates (WhatsApp wallet credits, AI overages) are commercial hypotheses that require formal unit-economics sign-off.
3. **ADR-012: Platform Root Domain & Subdomain Structure:** Acquisition and DNS configuration for `vyapone.in` (or alternative) for client subdomains (`<slug>.vyapone.in`).
4. **ADR-016: Final Launch Language List:** FINAL specifies English plus up to 8 Indian languages (Hindi, Marathi, Tamil, Telugu, Bengali, Gujarati, Kannada, Malayalam) and Hinglish for Vya; final rollout batching requires translation review sign-off.

---

## 5. Separation: Confirmed Requirements vs. Supplementary Recommendations

To prevent treating aspirational engineering notes as immutable functional scope, guidance is categorized into two distinct buckets:

### 5.1 Confirmed Product Requirements (Tier 1 Authority: FINAL v2.0)
- Functional Requirements FR-01 through FR-23.
- All 24 Reusable Product Modules (MOD-01 through MOD-24).
- All 8 Supported Niche Groups + "Other Business" flow (NICHE-01 through NICHE-09).
- Vya mascot H1 and dual-mode assistant/helper capabilities.
- Zero-setup UPI QR and payment state verification.
- Server-side GST invoicing with sequential numbering.
- Reseller white-label and split-settlement client billing.
- All 26 Launch Acceptance Criteria (AC-01 through AC-26).

### 5.2 Supplementary Engineering & Operational Recommendations (Tier 2 Authority: v3.0)
The following specifications from `PRD_v3_full_scale_2026-10-30.md` provide operational benchmarks and architectural targets, subject to technical validation during implementation:
- **Service Level Objectives (SLOs):** 99.9% uptime for public sites, 99.5% for operations dashboard/builder.
- **Performance Budgets:** Public site page load p95 < 800ms; Vya AI streaming first token p95 < 2.0s; voice reply start p95 < 4.0s.
- **Concurrency Targets:** System design capable of supporting 10,000 concurrent active users and 500 orders/sec burst throughput.
- **Disaster Recovery Targets:** Automated database snapshots; Recovery Point Objective (RPO) < 1 hour; Recovery Time Objective (RTO) < 4 hours.
- **Regulatory Controls:**
  - DPDP Act 2023: Consent management records, Data Principal access/correction/erasure workflows, Grievance Officer routing.
  - CERT-In: 6-hour cybersecurity incident reporting readiness.
  - RBI PA/PG: Zero pooling of client funds; compliant escrow/split settlement provider architecture.

---

## 6. Decisions Requiring Formal Product-Owner / Legal Approval

The following items from [DECISION_REGISTER.md](file:///f:/VyaponeV2/docs/DECISION_REGISTER.md) are hard dependencies for production operation and require explicit approval before live execution:

| ADR ID | Decision Title | Decision Question | Status | Impact / Blocker Level |
|---|---|---|---|---|
| **ADR-010** | Reseller Split Settlement Provider | Selection of licensed split-settlement partner (e.g., Razorpay Route / Cashfree Marketplace) | `BLOCKING_FOR_LIVE_CLIENT_BILLING` | Live client billing cannot activate without provider contract; VyapOne cannot pool funds. |
| **ADR-014** | GST Rules, Slabs & e-Invoicing | Validation of HSN/SAC mappings, tax slabs, and thermal/PDF formats by a Chartered Accountant | `BLOCKING_FOR_LIVE_GST` | Live tax invoice generation cannot ship without CA sign-off. |
| **ADR-015** | DPDP Compliance & Retention Policies | Legal review of privacy policy, consent records, and data retention/deletion periods | `BLOCKING_FOR_GA` | Mandatory legal sign-off under DPDP Act 2023 prior to public launch. |
| **ADR-008** | WhatsApp BSP Selection | Selection of official WhatsApp Business Solution Provider and per-message recharge rates | `PENDING` | Live WhatsApp Level 2 broadcasts and Cloud API notifications. |
| **ADR-009** | Primary Merchant Payment Gateway | Selection of primary PG (Razorpay, Cashfree, or PhonePe PG) for business-to-customer checkout | `PENDING` | Live card/netbanking merchant onboarding. |
| **ADR-011** | Subscription Plans & Add-On Pricing | Formal sign-off on reseller plan pricing, live-site quotas, and add-on price points | `PENDING` | Production subscription billing. |
| **ADR-017** | Google Business Profile API Access | Google Project app verification and OAuth quota approval | `PENDING_EXTERNAL_APPROVAL` | Live GBP sync cannot connect without Google approval. |
| **ADR-018** | Meta App & WhatsApp Template Approvals | Meta business verification and transactional/marketing template approvals | `PENDING_EXTERNAL_APPROVAL` | Live WhatsApp templates and Instagram auto-posting. |
| **ADR-021** | Direct DIY Owner Plan at GA | Product decision whether self-serve business owner signups are active at GA | `PENDING` | Determines self-serve onboarding marketing and routes. |

---

## 7. Traceability Map Cross-Check & Reference Verification

The requirements traceability matrix in [REQUIREMENTS_TRACEABILITY.md](file:///f:/VyaponeV2/docs/REQUIREMENTS_TRACEABILITY.md) was audited against `PRD_FINAL_v2_2026-11-03.md`:

1. **FR Mapping Verification:** All 23 Functional Requirements (FR-01 to FR-23) match Section 14 line items verbatim.
2. **Module Verification:** All 24 Reusable Modules (MOD-01 to MOD-24) match Section 8 line items.
3. **Niche Group Verification:** All 8 industry verticals + "Other Business" (NICHE-01 to NICHE-09) match Section 7.
4. **Vya AI Verification:** VYA-01 through VYA-13 accurately reflect Section 6 (Mascot H1, prompt templates, 6 tool schemas, model routing, safety).
5. **Acceptance Criteria Verification:** AC-01 through AC-26 trace directly to Section 23 of FINAL v2.0 without omission.
6. **Task Linkage Integrity:** All task IDs referenced (`VO-000` through `VO-145`) match valid, sequential backlog tasks in `docs/TASK_BACKLOG.md`. Zero invalid task IDs exist.

---

## 8. Unsupported, Outdated, or Incorrect Claims Register

The following claims found in earlier drafts, marketing discussions, or generic AI patterns are explicitly cataloged as **unsupported or incorrect**:

| Item | Unsupported or Incorrect Claim | Authoritative Canonical Truth | Source Reference |
|---|---|---|---|
| **Claim-01** | *"Dunzo can be used for hyperlocal delivery dispatch."* | **False.** Dunzo ceased operations in January 2025. Supported candidates are Porter, Borzo, Rapido, Shadowfax, and ONDC logistics. | FINAL §8.20 |
| **Claim-02** | *"AI can calculate GST and apply correct tax slabs to bills."* | **False.** AI must **never** calculate or predict statutory taxes. All tax math is performed by deterministic server logic using approved tax tables. | FINAL §8.15, AC-18 |
| **Claim-03** | *"A customer providing a UPI UTR number or claim means the order is Paid."* | **False.** UPI claims are strictly recorded as `Claimed by customer`. The status remains unverified until staff confirm `Received` or a bank webhook confirms `Paid`. | FINAL §10.5, AC-19 |
| **Claim-04** | *"VyapOne collects subscription fees from clients and pays resellers their cut."* | **False.** VyapOne is not a licensed payment aggregator and must never pool funds. Payouts must execute via a provider's automated split settlement (e.g., Razorpay Route). | FINAL §9.5, §10.1, ADR-010 |
| **Claim-05** | *"Vya writes and deploys arbitrary React or HTML code for websites."* | **False.** Vya only generates structured JSON configuration referencing approved, sandboxed component blocks. No dynamic code execution is permitted. | FINAL §6.14, §15.3 |
| **Claim-06** | *"Subscription prices in the PRD (₹399, ₹999) are final commercial commitments."* | **False.** All pricing figures in the PRD are provisional hypotheses to be tested during beta. The platform configuration must treat pricing as dynamic database values. | FINAL §25, ADR-011 |
| **Claim-07** | *"Direct business owners (DIY) are a guaranteed launch cohort."* | **False.** Direct DIY onboarding is an unresolved product decision (ADR-021). The platform launch prioritizes resellers, freelancers, and agencies. | FINAL §25, ADR-021 |
| **Claim-08** | *"WhatsApp Level 2 messages can be sent without templates or opt-in."* | **False.** Meta rules mandate pre-approved templates outside the 24-hour window, explicit recorded consent, STOP unsubscribe handling, and quiet hours. | FINAL §8.13, §17.2 |

---

## 9. Repository & Git Initialization Strategy

### Backlog Task Assignment
- In accordance with `docs/TASK_BACKLOG.md`, the existing development task designated for establishing, configuring, and initializing the application workspace is:
  👉 **`VO-010 — Initialize or normalize application workspace`**
  *(Scope: Set up the project using the stack accepted in ADRs. If a project already exists, adapt it instead of replacing it. Keep web/PWA first and TypeScript end-to-end where practical).*
- **Developer Local Action:** As documented in `ANTIGRAVITY_START_PROMPT.md` (§Before opening Antigravity), the human developer may execute `git init` and commit the starter documentation in the workspace root at any point to establish local source control history. Automated agents must not execute destructive git commands.

---

## 10. Non-Negotiable Architecture and Security Invariants

All future code implementation must conform to these platform invariants:

1. **Multi-Tenant Scoping:** Every business record (orders, bookings, bills, inventory, customers, media) is explicitly scoped to `business_id` (and `location_id` where applicable). Row-level tenant isolation is enforced at both the API and database levels.
2. **Business Data Sovereignty:** Business data belongs to the business. Resellers access data via workspace membership; business ownership transfers must preserve all operational history.
3. **Deterministic Financial Logic:** Prices, discounts, tax rates, inventory deductions, and order totals are calculated exclusively on the server. Browser calculations are never trusted.
4. **Idempotency & Replay Resistance:** All payment webhooks, WhatsApp callbacks, and mutation APIs must enforce idempotency keys to prevent duplicate billing or ghost actions.
5. **Untrusted Data Isolation:** Customer-generated messages, review inputs, and file uploads are untrusted data. They must never be injected as instructions into AI prompts.
6. **Mobile-First 390 px Usability:** Every essential user journey (creation, editing, publishing, operating, billing) must be fully functional at a 390 px viewport without horizontal overflow.
7. **Accessibility Baseline:** All shared UI primitives and templates must adhere to WCAG 2.2 AA standards, visible focus states, and respect `prefers-reduced-motion`.
