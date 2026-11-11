# VyapOne — Application Route Architecture & Shell Specification

**Document Version:** 1.0  
**Date:** 11 November 2026  
**Task ID:** VO-014  
**Primary Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15, §16, §18)  
**Related Documents:** `docs/PROJECT_STRUCTURE.md`, `docs/ENGINEERING_STANDARDS.md`, `docs/DOMAIN_ARCHITECTURE.md`, `docs/DESIGN_TOKENS.md`

---

## 1. Executive Summary

This document specifies the routing architecture, layout hierarchy, and access-control boundaries for the VyapOne web application using the Next.js App Router.

In accordance with `docs/PROJECT_STRUCTURE.md`, routes are partitioned into isolated route groups using parentheses `(...)` to separate layout shells, authorization contexts, and navigation structures without introducing redundant or unapproved URL segments.

---

## 2. Route Map & Role Isolation Matrix

The table below documents every route shell created in `VO-014`, its route group, purpose, intended user category, applicable layout, and future access-control requirements:

| URL Path | Route Group | Purpose | Intended User Category | Applicable Layout | Future Access-Control Boundary |
|---|---|---|---|---|---|
| `/` | `src/app/page.tsx` | Root platform landing & portal navigator | Public visitors / All users | `src/app/layout.tsx` | Public (anonymous) |
| `/login` | `(auth)` | Phone OTP & magic link authentication | All users | `src/app/(auth)/layout.tsx` | Anonymous (unauthenticated) |
| `/register` | `(auth)` | Business owner / reseller onboarding entry | New merchants & agencies | `src/app/(auth)/layout.tsx` | Anonymous (unauthenticated) |
| `/s/[subdomain]` | `(public)` | Tenant public storefront home (`*.vyapone.in`) | Merchant customers | `src/app/(public)/layout.tsx` | Public (tenant-scoped) |
| `/privacy` | `(public)` | DPDP 2023 compliance & Grievance notice | All users & customers | `src/app/(public)/layout.tsx` | Public (anonymous) |
| `/workspace` | `(reseller)` | Reseller agency operations overview | Agency owners & staff | `src/app/(reseller)/workspace/layout.tsx` | Authenticated `reseller_owner` / `reseller_staff` |
| `/workspace/clients` | `(reseller)` | Managed merchant client business directory | Agency staff | `src/app/(reseller)/workspace/layout.tsx` | Authenticated reseller member |
| `/workspace/billing` | `(reseller)` | Wholesale platform billing & split payouts | Agency finance / owner | `src/app/(reseller)/workspace/layout.tsx` | Authenticated `reseller_owner` |
| `/workspace/team` | `(reseller)` | Agency team members & role management | Agency owner | `src/app/(reseller)/workspace/layout.tsx` | Authenticated `reseller_owner` |
| `/workspace/settings` | `(reseller)` | White-label custom domain & agency branding | Agency owner | `src/app/(reseller)/workspace/layout.tsx` | Authenticated `reseller_owner` |
| `/dashboard` | `(owner)` | Daily business pulse & Vya morning summary | Business Owner | `src/app/(owner)/dashboard/layout.tsx` | Authenticated `business_owner` |
| `/dashboard/catalogue` | `(owner)` | Products, services & HSN/SAC GST slabs | Business Owner / Manager | `src/app/(owner)/dashboard/layout.tsx` | Authenticated business member |
| `/dashboard/orders` | `(owner)` | Order fulfillment Kanban & tracking | Business Owner / Staff | `src/app/(owner)/dashboard/layout.tsx` | Authenticated business member |
| `/dashboard/billing` | `(owner)` | Gap-free sequential GST billing & invoices | Business Owner | `src/app/(owner)/dashboard/layout.tsx` | Authenticated `business_owner` |
| `/dashboard/customers` | `(owner)` | Customer directory, Udhaar & consent log | Business Owner | `src/app/(owner)/dashboard/layout.tsx` | Authenticated business member |
| `/dashboard/whatsapp` | `(owner)` | WhatsApp customer desk & broadcasts | Business Owner | `src/app/(owner)/dashboard/layout.tsx` | Authenticated `business_owner` |
| `/dashboard/website` | `(owner)` | Puck visual builder & published pages | Business Owner | `src/app/(owner)/dashboard/layout.tsx` | Authenticated `business_owner` |
| `/dashboard/analytics` | `(owner)` | Privacy-preserving aggregates & QR scans | Business Owner | `src/app/(owner)/dashboard/layout.tsx` | Authenticated `business_owner` |
| `/dashboard/settings` | `(owner)` | Profile, GSTIN, UPI VPAs & staff PINs | Business Owner | `src/app/(owner)/dashboard/layout.tsx` | Authenticated `business_owner` (sensitive) |
| `/counter` | `(staff)` | Station overview & cashier shift launch | Counter Staff / Waiter | `src/app/(staff)/counter/layout.tsx` | Authenticated business staff (PIN unlocked) |
| `/counter/pos` | `(staff)` | Rapid order punching & instant receipt print | Counter Staff | `src/app/(staff)/counter/layout.tsx` | Authenticated business staff (PIN unlocked) |
| `/counter/unlock` | `(staff)` | 4-to-6 digit station PIN unlock screen | Counter Staff | `src/app/(staff)/counter/layout.tsx` | Station session (PIN lock) |
| `/platform-admin` | `(admin)` | Global infrastructure health & tenant overview | Platform Super-Admin | `src/app/(admin)/platform-admin/layout.tsx` | Authenticated `platform_admin` |
| `/platform-admin/tenants` | `(admin)` | Multi-tenant hierarchy inspector | Platform Super-Admin | `src/app/(admin)/platform-admin/layout.tsx` | Authenticated `platform_admin` |
| `/platform-admin/plans` | `(admin)` | Master plan tiers, quotas & features | Platform Super-Admin | `src/app/(admin)/platform-admin/layout.tsx` | Authenticated `platform_admin` |
| `/platform-admin/taxes` | `(admin)` | Canonical statutory HSN/SAC GST master tables | Platform Super-Admin | `src/app/(admin)/platform-admin/layout.tsx` | Authenticated `platform_admin` |
| `/platform-admin/audit-logs`| `(admin)` | Tamper-evident append-only audit trail | Platform Super-Admin | `src/app/(admin)/platform-admin/layout.tsx` | Authenticated `platform_admin` |
| `/platform-admin/abuse` | `(admin)` | Spam defense & quiet-hour compliance | Platform Super-Admin | `src/app/(admin)/platform-admin/layout.tsx` | Authenticated `platform_admin` |

---

## 3. Layout Hierarchy & Composition

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

## 4. Role-Aware Navigation Enforcement

A fundamental security and acceptance requirement of `VO-014` is:
> **"No role sees navigation for a module it cannot access."**

1. **Storefront Shell (`(public)`):** Displays public product catalogue and merchant contacts. Zero back-office navigation items or management links are shown.
2. **Staff Counter Shell (`(staff)`):** Displays rapid order punch and instant billing. Sensitive owner areas—such as Business Settings, Bank VPAs, Profit/Loss Analytics, WhatsApp Marketing, and Website Builder—are omitted from the navigation model.
3. **Business Owner Shell (`(owner)`):** Provides complete sovereign merchant control. Wholesale agency margins and platform governance tools are omitted.
4. **Reseller Agency Shell (`(reseller)`):** Displays managed client lists, wholesale subscription billing, and white-label agency branding. Private merchant operational data (such as a customer's specific credit ledger) and super-admin master tax tables are omitted.
5. **Platform Super-Admin Shell (`(admin)`):** Dedicated exclusively to global system health, statutory tax tables, and compliance monitoring.

---

## 5. Security & Access-Control Boundary Notice

> [!WARNING]
> **Route grouping in Next.js is not an authorization mechanism.**  
> The shells implemented in `VO-014` establish structural layouts and user-facing landmarks. Actual authorization enforcement—including cookie/session verification, JWT validation, role-based access control (RBAC), and PostgreSQL Row-Level Security (RLS) tenant isolation—will be enforced at the server and database layer in Phase P2 (`VO-021` to `VO-024`).

---

## 6. Deferred Route Responsibilities

The following capabilities are explicitly documented and reserved for future tasks:
- **`VO-015`:** Mobile-first responsive touch target verification and viewport audits across 320, 390, 768, 1024, and 1440 px.
- **`VO-021`:** Full authentication lifecycle, OTP generation/verification, SMS delivery, and session management.
- **`VO-023` & `VO-024`:** Database-driven tenant resolution, location switching, and RLS policy enforcement.
- **`VO-040`+:** Puck interactive block editor execution, storefront rendering engine, and dynamic domain routing.
