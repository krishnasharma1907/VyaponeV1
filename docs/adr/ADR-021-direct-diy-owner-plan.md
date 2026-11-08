# ADR-021: Direct DIY Business Owner Plan at GA

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Marketing Lead  
**Related PRD Requirements:** FR-02, FR-10, RES-01  
**Affected Tasks:** `VO-003`, `VO-022`, `VO-026`, `VO-033`, `VO-137`  

---

## 1. Context and Problem Statement
In PRD v3, direct business owners who build for themselves ("DIY Owners", e.g., a café owner signing up directly without an agency or freelancer) were treated as a co-equal launch cohort alongside resellers.

However, in `PRD_FINAL_v2_2026-11-03.md` (§2.1, §25):
> *"Positioning: Reseller-first... Whether direct business-owner (DIY) plans are part of launch remains an open decision."*

Launching direct consumer-facing DIY plans simultaneously with a reseller platform introduces risks:
1. Resellers may feel VyapOne is competing directly with them for local merchant clients.
2. Direct owners require extensive, low-margin customer onboarding and manual support.
3. Reseller distribution is VyapOne's primary growth moat.

We must define the technical and product strategy regarding direct DIY owner onboarding at General Availability.

---

## 2. Options Considered

### Option 1: Reseller-First GTM with Technical Support for DIY in Architecture (Recommended)
- **Product & Marketing Strategy:** 100% of public marketing, landing pages, and messaging target resellers, agencies, freelancers, and students.
- **Data Model & Technical Architecture:** The workspace schema (`workspaces`, `workspace_memberships`) supports both `RESELLER` and `DIRECT_OWNER` workspace types.
- **Lead Routing Advantage:** Direct business owners who sign up via the public landing page or waitlist are routed to certified local resellers via the **Reseller Lead Marketplace** (`VO-112`, FINAL §9.5), turning DIY signups into reseller incentives rather than competition.

### Option 2: Full Public Direct DIY Self-Serve Plan at GA
- **Product Strategy:** Launching a ₹499/mo direct single-business plan on the homepage alongside agency plans.
- **Analysis:** Causes immediate reseller channel conflict; support tickets overwhelm early operations teams.

---

## 3. Comparison of Options

| Criterion | Option 1: Reseller-First + Lead Routing | Option 2: Co-Equal DIY Public Launch |
|---|---|---|
| **Reseller Trust & Channel Alignment** | **Highest:** Resellers see VyapOne as their partner that feeds them client leads. | **Poor:** Resellers see VyapOne as an aggressive direct competitor. |
| **Support Efficiency** | **High:** Reseller acts as Level-1 support for their own merchant clients. | **Low:** Platform must provide hand-holding support to non-technical merchants. |
| **Technical Extensibility** | **High:** Shared codebase handles both workspace types without refactoring. | **High:** Same. |

---

## 4. Architectural Implications

- The database schema (`VO-022`) must implement `workspace_type ENUM ('RESELLER', 'DIRECT_OWNER')`.
- Permissions, business limits, and dashboard navigation use the identical underlying multi-tenant services.
- If the Product Owner approves activating a direct DIY plan in the future, it requires only a feature flag and billing configuration change in `subscription_plans`, with zero schema or UI redesign.

---

## 5. Recommendation and Rationale
**Adopt Option 1: Architect the platform to support both workspace types, but focus General Availability (GA) marketing 100% on resellers.**
- Protects the reseller distribution moat.
- Directly satisfies the strategic directive in PRD FINAL §2.1 and §25.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Workspace & Membership service (`VO-022`), Capacity service (`VO-026`).
- **Approval Requirement:** **Product Owner strategic decision on launch cohort.** Marked `NEEDS APPROVAL`.
