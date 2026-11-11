# VyapOne — Application Route Architecture & Shell Specification

**Document Version:** 1.1  
**Date:** 11 November 2026  
**Task ID:** VO-014 (Post-Audit Reconciled)  
**Primary Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15, §16, §18)  
**Related Documents:** `docs/PROJECT_STRUCTURE.md`, `docs/ENGINEERING_STANDARDS.md`, `docs/DOMAIN_ARCHITECTURE.md`, `docs/DESIGN_TOKENS.md`, `docs/DECISION_REGISTER.md`

---

## 1. Executive Summary

This document specifies the routing architecture, layout hierarchy, and access-control boundaries for the VyapOne web application using the Next.js App Router.

In accordance with `docs/PROJECT_STRUCTURE.md`, routes are partitioned into isolated route groups using parentheses `(...)` to separate layout shells, authorization contexts, and navigation structures without introducing redundant or unapproved URL segments.

---

## 2. Reconciled Application Route Inventory (28 Total Routes)

The application defines exactly **28 application page routes** (27 static page files + 1 dynamic page route `/s/[subdomain]`).

### Route Reconciliation: 28 Application Routes vs 30 Next.js Prerender Units

When `pnpm build` executes, Next.js logs:
```
✓ Generating static pages (30/30)
```
The count of 30 generated static units is resolved as follows:
- **27 static application page routes** (`src/app/**/page.tsx`)
- **1 internal Next.js static not-found page** (`/_not-found`)
- **2 internal framework prerender units** (Next.js root document envelope and error boundary prerenders)
- *(Note: The 1 dynamic route `src/app/(public)/s/[subdomain]/page.tsx` is server-rendered on demand `ƒ Dynamic` and is therefore not included in the static page total).*

**Total Authored Application Routes:** **28**

### Full Route Inventory Matrix

| # | Route File Path | Resolved URL Path | Route Group | Page Purpose | Layout Used | Prerender Status | Future Access Boundary |
|---|---|---|---|---|---|---|---|
| 1 | `src/app/page.tsx` | `/` | Root (None) | Developer route shell showcase & portal navigator | `src/app/layout.tsx` | `○ Static` | Public (anonymous) |
| 2 | `src/app/(auth)/login/page.tsx` | `/login` | `(auth)` | Phone OTP authentication entry shell | `src/app/(auth)/layout.tsx` | `○ Static` | Anonymous (unauthenticated) |
| 3 | `src/app/(auth)/register/page.tsx` | `/register` | `(auth)` | Merchant / Reseller onboarding registration shell | `src/app/(auth)/layout.tsx` | `○ Static` | Anonymous (unauthenticated) |
| 4 | `src/app/(public)/s/[subdomain]/page.tsx` | `/s/[subdomain]` | `(public)` | Tenant public storefront home (`*.vyapone.in`) | `src/app/(public)/layout.tsx` | `ƒ Dynamic` | Public (tenant-scoped) |
| 5 | `src/app/(public)/privacy/page.tsx` | `/privacy` | `(public)` | Draft DPDP 2023 compliance & Grievance notice | `src/app/(public)/layout.tsx` | `○ Static` | Public (anonymous) |
| 6 | `src/app/(reseller)/workspace/page.tsx` | `/workspace` | `(reseller)` | Reseller agency workspace operations overview | `src/app/(reseller)/workspace/layout.tsx` | `○ Static` | `reseller_owner` / `reseller_staff` |
| 7 | `src/app/(reseller)/workspace/clients/page.tsx` | `/workspace/clients` | `(reseller)` | Managed merchant client business directory | `src/app/(reseller)/workspace/layout.tsx` | `○ Static` | Reseller staff / owner |
| 8 | `src/app/(reseller)/workspace/billing/page.tsx` | `/workspace/billing` | `(reseller)` | Wholesale platform billing & split payouts | `src/app/(reseller)/workspace/layout.tsx` | `○ Static` | `reseller_owner` only |
| 9 | `src/app/(reseller)/workspace/team/page.tsx` | `/workspace/team` | `(reseller)` | Agency team members & role management | `src/app/(reseller)/workspace/layout.tsx` | `○ Static` | `reseller_owner` only |
| 10 | `src/app/(reseller)/workspace/settings/page.tsx` | `/workspace/settings` | `(reseller)` | White-label custom domain & agency branding | `src/app/(reseller)/workspace/layout.tsx` | `○ Static` | `reseller_owner` only |
| 11 | `src/app/(owner)/dashboard/page.tsx` | `/dashboard` | `(owner)` | Daily business pulse & Vya morning summary | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | `business_owner` |
| 12 | `src/app/(owner)/dashboard/catalogue/page.tsx` | `/dashboard/catalogue` | `(owner)` | Products, services & HSN/SAC GST slabs | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | Business member |
| 13 | `src/app/(owner)/dashboard/orders/page.tsx` | `/dashboard/orders` | `(owner)` | Order fulfillment Kanban & tracking | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | Business member |
| 14 | `src/app/(owner)/dashboard/billing/page.tsx` | `/dashboard/billing` | `(owner)` | Gap-free sequential GST billing & invoices | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | `business_owner` |
| 15 | `src/app/(owner)/dashboard/customers/page.tsx` | `/dashboard/customers` | `(owner)` | Customer directory, Udhaar & consent log | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | Business member |
| 16 | `src/app/(owner)/dashboard/whatsapp/page.tsx` | `/dashboard/whatsapp` | `(owner)` | WhatsApp customer desk & broadcasts | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | `business_owner` |
| 17 | `src/app/(owner)/dashboard/website/page.tsx` | `/dashboard/website` | `(owner)` | Puck visual builder & published pages | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | `business_owner` |
| 18 | `src/app/(owner)/dashboard/analytics/page.tsx` | `/dashboard/analytics` | `(owner)` | Privacy-preserving aggregates & QR scans | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | `business_owner` |
| 19 | `src/app/(owner)/dashboard/settings/page.tsx` | `/dashboard/settings` | `(owner)` | Profile, GSTIN, UPI VPAs & staff PINs | `src/app/(owner)/dashboard/layout.tsx` | `○ Static` | `business_owner` (sensitive) |
| 20 | `src/app/(staff)/counter/page.tsx` | `/counter` | `(staff)` | Station overview & cashier shift launch | `src/app/(staff)/counter/layout.tsx` | `○ Static` | Business staff (PIN unlocked) |
| 21 | `src/app/(staff)/counter/pos/page.tsx` | `/counter/pos` | `(staff)` | Rapid order punching & instant receipt print | `src/app/(staff)/counter/layout.tsx` | `○ Static` | Business staff (PIN unlocked) |
| 22 | `src/app/(staff)/counter/unlock/page.tsx` | `/counter/unlock` | `(staff)` | 4-to-6 digit station PIN unlock screen | `src/app/(staff)/counter/layout.tsx` | `○ Static` | Station session (PIN lock) |
| 23 | `src/app/(admin)/platform-admin/page.tsx` | `/platform-admin` | `(admin)` | Global infrastructure health & tenant overview | `src/app/(admin)/platform-admin/layout.tsx` | `○ Static` | `platform_admin` |
| 24 | `src/app/(admin)/platform-admin/tenants/page.tsx` | `/platform-admin/tenants` | `(admin)` | Multi-tenant hierarchy inspector | `src/app/(admin)/platform-admin/layout.tsx` | `○ Static` | `platform_admin` |
| 25 | `src/app/(admin)/platform-admin/plans/page.tsx` | `/platform-admin/plans` | `(admin)` | Master plan tiers, quotas & features | `src/app/(admin)/platform-admin/layout.tsx` | `○ Static` | `platform_admin` |
| 26 | `src/app/(admin)/platform-admin/taxes/page.tsx` | `/platform-admin/taxes` | `(admin)` | Canonical statutory HSN/SAC GST master tables | `src/app/(admin)/platform-admin/layout.tsx` | `○ Static` | `platform_admin` |
| 27 | `src/app/(admin)/platform-admin/audit-logs/page.tsx` | `/platform-admin/audit-logs` | `(admin)` | Tamper-evident append-only audit trail | `src/app/(admin)/platform-admin/layout.tsx` | `○ Static` | `platform_admin` |
| 28 | `src/app/(admin)/platform-admin/abuse/page.tsx` | `/platform-admin/abuse` | `(admin)` | Spam defense & quiet-hour compliance | `src/app/(admin)/platform-admin/layout.tsx` | `○ Static` | `platform_admin` |

---

## 3. Root Discovery Portal Status (`/`)

The root page (`src/app/page.tsx`) serves exclusively as a **Developer Route Shell Showcase** during Phase P1.

- **Purpose:** Allows internal developers, reviewers, and automated test runners to navigate, inspect, and audit role-aware layouts, WCAG 2.2 AA accessibility landmarks, and visual tokens across all 5 operational route groups.
- **Not a Production Landing Page:** This view is strictly developmental. It is not the final consumer/merchant public marketing website. The final public-facing marketing homepage will be implemented in Phase P4 / P13 following the completion of business engines.
- **No Inherent Security:** The links on the discovery portal provide structural navigation into shells. Real protection of private shells is enforced via server middleware and database RLS (Phase P2 / VO-021, VO-024).

---

## 4. Role Navigation vs Authorization Distinction

A critical architectural distinction must be maintained:
> [!IMPORTANT]
> **Navigation separation is a UI convenience feature, NOT an authentication or security boundary.**

- **Navigation Isolation:** Route-specific navigation menus (e.g. hiding business settings from counter staff, hiding reseller wholesale controls from store owners) provide a clutter-free, role-appropriate user experience.
- **Hard Security Enforcement:** True tenant isolation, identity verification, role-based access control (RBAC), and session timeouts are strictly server-side and database concerns:
  - **HTTP Layer:** Next.js middleware inspecting signed session cookies (`VO-021`).
  - **Data Layer:** PostgreSQL Row-Level Security (RLS) enforcing `tenant_id` isolation via transaction-scoped `SET LOCAL vyapone.current_tenant_id` (`VO-024`).
- **Placeholder Notice:** In VO-014, placeholder controls that require backend mutations (such as OTP dispatch, bill printing, plan creation, or settings saving) are marked as `disabled` to prevent false expectations of operational readiness.

---

## 5. Privacy, DPDP, and Legal Disclaimer

The `/privacy` route shell outlines the technical architecture required by the Digital Personal Data Protection (DPDP) Act 2023 (e.g., data fiduciary vs processor separation, sovereign merchant tenant isolation, and DPDP marketing consent logging).

- **Legal Entity Status:** All company names, physical registered offices, DPO contact channels, and grievance escalation timelines are **Draft Placeholders** subject to formal legal counsel review upon corporate incorporation.
- **No Certifications Claimed:** The application does not claim official DPDP or statutory audit certifications until formal audits are conducted in Phase P13.
- **Unresolved Decisions:** Pending corporate entity incorporation and official DPO channel decisions are tracked in `docs/DECISION_REGISTER.md`.

---

## 6. Layout Hierarchy & Composition

```
RootLayout (src/app/layout.tsx)
  ├── <html>
  │     ├── <head> (Metadata, Viewport, ThemeColor #0F5132)
  │     └── <body> (globals.css, Font Variables)
  │
  ├── [Public Route Group: (public)]
  │     └── PublicStorefrontLayout (header glass nav, main#main-content, footer)
  │           └── SubdomainStorefrontPage / PrivacyPolicyPage
  │
  ├── [Auth Route Group: (auth)]
  │     └── AuthLayout (centered responsive card, brand mark, main#main-content)
  │           └── LoginPage / RegisterPage
  │
  ├── [Reseller Route Group: (reseller)]
  │     └── ResellerWorkspaceLayout (agency header, NavList, main#main-content)
  │           └── Overview / Clients / Billing / Team / Settings
  │
  ├── [Business Owner Route Group: (owner)]
  │     └── BusinessOwnerLayout (store header, desktop NavList, mobile bottom-bar, main#main-content)
  │           └── Pulse / Catalogue / Orders / Billing / Customers / WhatsApp / Website / Analytics / Settings
  │
  ├── [Staff Counter Route Group: (staff)]
  │     └── StaffCounterLayout (high-contrast POS bar, NavList, main#main-content)
  │           └── CounterHome / FastPOS / PINUnlock
  │
  └── [Platform Admin Route Group: (admin)]
        └── PlatformAdminLayout (danger-bordered governance header, NavList, main#main-content)
              └── Overview / Tenants / Plans / GSTMaster / AuditLogs / AbuseDefense
```

---

## 7. Deferred Route Responsibilities

The following capabilities are explicitly documented and reserved for future tasks:
- **`VO-015`:** Mobile-first responsive touch target verification and viewport audits across 320, 390, 768, 1024, and 1440 px.
- **`VO-021`:** Full authentication lifecycle, OTP generation/verification, SMS delivery, and session management.
- **`VO-023` & `VO-024`:** Database-driven tenant resolution, location switching, and RLS policy enforcement.
- **`VO-040`+:** Puck interactive block editor execution, storefront rendering engine, and dynamic domain routing.
- **`VO-081`:** Statutory GST sequence generator and gap-free sequential invoice counter.
- **`VO-110`:** Staff counter PIN shift sessions and cashier terminal assignment.
