# ADR-011: Subscription Pricing, Quotas and Add-On Metering Model

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Commercial/Finance Lead  
**Related PRD Requirements:** FR-10, RES-02, AC-02  
**Affected Tasks:** `VO-003`, `VO-026`, `VO-087`, `VO-099`  

---

## 1. Context and Problem Statement
VyapOne charges resellers a platform subscription fee plus usage-based charges for add-ons (WhatsApp message recharges, extra website slots, AI token overages). The PRDs present provisional pricing plans (e.g. Starter: ₹399/mo for 3 sites; Growth: ₹999/mo for 10 sites; Agency: ₹2,499/mo for unlimited sites), but explicitly note:
> *"Every price and numeric target in this document is a hypothesis to validate during beta."* (PRD FINAL §9.3, §25).

We must establish the technical architecture for plan management, quota enforcement, and metered add-ons without hardcoding unverified commercial prices into code.

---

## 2. Options Considered

### Option 1: Configurable Database-Driven Plan & Entitlement Service (Recommended)
- **Architecture:** Plans, prices, live website limits, AI token allowances, and add-on unit costs are stored in versioned PostgreSQL tables (`subscription_plans`, `plan_entitlements`, `usage_quotas`).
- **Enforcement:** A centralized `CapacityService` (`VO-026`) checks quotas on the server before permitting a site publish, AI request, or WhatsApp broadcast.
- **Hypothesis Isolation:** Initial database seed uses the PRD hypothesis numbers, but all UI views and billing engines query the database dynamically.

### Option 2: Hardcoded Application Plan Constants
- **Architecture:** Plans and site limits defined as static TypeScript enums and constants in the codebase.

---

## 3. Comparison of Options

| Criterion | Option 1: DB-Driven Entitlement Service | Option 2: Hardcoded Constants |
|---|---|---|
| **Commercial Flexibility** | **Highest:** Marketing/Product Owner can adjust prices, launch promo tiers, or tune site slots in minutes without a code deployment. | **Very Low:** Price adjustments require code edits, Git commits, and full redeployment. |
| **Server-Side Enforcement (AC-02)** | **Robust:** Server queries real-time plan capacity in transactional queries. | **Moderate:** Prone to desynchronization between billing records and code flags. |
| **Metered Add-On Tracking** | **Unified:** Easily accommodates prepaid WhatsApp credits, extra site packs, and custom add-ons. | **Rigid:** Adding a new add-on requires schema and code refactoring. |

---

## 4. Architectural Implications

- **Server-Controlled Fact (Invariable):** In accordance with architecture invariants, plan quotas and website limits are server-owned facts. The client never determines whether a reseller has capacity to publish a new business site.
- **Metered Add-On Wallet (`VO-099`):** Resellers and businesses maintain a prepaid credit ledger for WhatsApp messages and AI overages. Every debit is linked to a specific message delivery ID or AI request ID. Overdrafts are prohibited.

---

## 5. Recommendation and Rationale
**Adopt Option 1: Configurable Database-Driven Plan & Entitlement Service.**
- Exactly satisfies the requirement to treat PRD pricing as provisional hypotheses while providing strict server-side capacity enforcement (`VO-026`).

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** PostgreSQL migration framework (`VO-020`), Capacity service (`VO-026`).
- **Approval Requirement:** **Product Owner Commercial Sign-off on final plan price points and unit economics.** Marked `NEEDS APPROVAL`.
