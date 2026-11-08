# VyapOne — Scalable Project Structure Specification

**Document Version:** 1.0  
**Date:** 8 November 2026  
**Status:** Architectural Specification (DOCUMENTATION ONLY — No Folders or Code Created at P0)  
**Task ID:** VO-006  
**Primary Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15, §16, §18)  
**Related Documents:** `docs/ENGINEERING_STANDARDS.md`, `docs/ADR_INDEX.md`, `docs/DOMAIN_ARCHITECTURE.md`

---

## 1. Overview and Architectural Layout

The VyapOne application codebase is designed to scale from early MVP pilots to tens of thousands of active Indian merchant businesses, multi-member reseller agencies, and high-frequency counter operations.

> [!IMPORTANT]
> **PHASE P0 GOVERNANCE RULE:**  
> This document specifies the target project structure for Phase P1 (`VO-010`). In strict compliance with AGENTS.md, **no application folders or source files are created during this planning task**.

```
vyapone/
├── .agents/                    # Agent skills, prompts, and automation configurations
│   └── skills/
│       └── vyapone-build/      # VyapOne task execution skill
├── docs/                       # Project documentation, specifications, and architecture
│   ├── adr/                    # Architecture Decision Records (ADR-001 to ADR-025)
│   ├── diagrams/               # Mermaid architectural and ER diagrams
│   ├── SOURCE_OF_TRUTH.md      # Canonical document authority hierarchy
│   ├── REQUIREMENTS_TRACEABILITY.md # Bidirectional requirement-to-task matrix
│   ├── TASK_BACKLOG.md         # Master task backlog (VO-000 to VO-138)
│   ├── THREAT_MODEL.md         # STRIDE threat analysis and security test plan
│   ├── DOMAIN_ARCHITECTURE.md  # Multi-tenant domain model and data ownership
│   ├── ENGINEERING_STANDARDS.md# TypeScript, React, database, and API rules
│   ├── PROJECT_STRUCTURE.md    # This file: directory layout specification
│   ├── TEST_STRATEGY.md        # Comprehensive multi-layer test strategy
│   ├── QUALITY_GATES.md        # Measurable development, phase, and GA gates
│   └── CODE_REVIEW_CHECKLIST.md# Systematic code review checklist
├── drizzle/                    # Raw SQL schema migrations (automated CI runner)
│   ├── 0000_initial_schema.sql
│   ├── 0001_add_invoice_sequences.sql
│   └── meta/
├── public/                     # Static public assets (favicons, PWA manifest, fallback icons)
│   ├── manifest.json
│   ├── icons/
│   └── offline.html
├── src/                        # Main application source code
│   ├── app/                    # Next.js App Router (routes, layouts, API endpoints)
│   ├── components/             # Reusable UI components, design tokens, module blocks
│   ├── config/                 # Typed configuration and environment validation
│   ├── db/                     # Database client, Drizzle schema, RLS helpers
│   ├── lib/                    # Core business logic, services, adapters, utilities
│   ├── types/                  # Global shared TypeScript interfaces and DTOs
│   └── workers/                # Background BullMQ queue workers (messaging, automations)
├── tests/                      # Automated test suites
│   ├── ai-evals/               # Vya golden eval dataset and prompt injection tests
│   ├── e2e/                    # Playwright mobile-first end-to-end tests
│   ├── fixtures/               # Test data generators, mock factories
│   ├── integration/            # API route handler and database RLS integration tests
│   └── unit/                   # Vitest unit tests for services and algorithms
├── .env.example                # Sanitized template of required environment variables
├── .eslintrc.json              # Strict ESLint configuration
├── .gitignore                  # Git ignore rules (secrets, build outputs, node_modules)
├── .prettierrc                 # Code formatting rules
├── package.json                # Project dependencies, scripts, and engine constraints
├── pnpm-lock.yaml              # Deterministic package lockfile
├── tailwind.config.ts          # Tailwind CSS design token configuration (Emerald + Marigold)
└── tsconfig.json               # Strict TypeScript compiler configuration
```

---

## 2. Next.js App Router Organization (`src/app/`)

Routes are organized into isolated route groups using parentheses `(...)` to separate layouts, authorization guards, and client contexts without affecting URL paths:

### 2.1 Route Groups and Portals

```
src/app/
├── (auth)/                     # Authentication and Account Recovery
│   ├── login/                  # Mobile OTP / Email magic link login
│   ├── register/               # Reseller and direct business registration
│   ├── verify-otp/             # OTP verification screen
│   └── reset-password/
│
├── (public)/                   # Public Storefronts & Customer Touchpoints
│   ├── s/[subdomain]/          # Tenant storefront (*.vyapone.in or custom domain)
│   │   ├── page.tsx            # Published website home page
│   │   ├── [slug]/             # Published sub-pages (menu, about, contact)
│   │   ├── cart/               # Mobile-optimized shopping cart
│   │   ├── checkout/           # Server-validated checkout and UPI payment
│   │   └── track/[orderId]/    # Live order status and tracking
│   ├── qr/[slug]/              # Dynamic QR redirect resolver
│   ├── b/[businessSlug]/       # Direct business link redirect
│   └── privacy/                # Public privacy policy and grievance redressal
│
├── (reseller)/                 # Reseller Agency Workspace Portal
│   ├── workspace/
│   │   ├── layout.tsx          # Reseller sidebar layout (agency white-label branding)
│   │   ├── page.tsx            # Agency overview dashboard
│   │   ├── clients/            # Managed business roster and client onboarding
│   │   │   ├── page.tsx
│   │   │   ├── new/            # Provision new business tenant
│   │   │   └── [businessId]/   # Delegated admin access to specific business
│   │   ├── billing/            # Reseller wholesale billing and split payouts
│   │   ├── team/               # Agency team member roles and permissions
│   │   └── settings/           # White-label domain, logo, and theme settings
│
├── (owner)/                    # Sovereign Business Owner Dashboard
│   ├── dashboard/
│   │   ├── layout.tsx          # Business owner navigation (mobile-first 390px navbar)
│   │   ├── page.tsx            # Daily pulse: GMV, orders, Vya morning summary
│   │   ├── catalogue/          # Products, services, price configuration
│   │   ├── orders/             # Order fulfillment Kanban and status management
│   │   ├── billing/            # GST tax invoice generation, sequence counters, bills
│   │   ├── customers/          # CRM list, tags, udhaar balances, consent records
│   │   ├── whatsapp/           # WhatsApp inbox, templates, broadcasts, automations
│   │   ├── website/            # Constrained Puck visual editor, theme tokens, preview
│   │   ├── analytics/          # Privacy-coarse metrics, QR scan rates, sales trends
│   │   └── settings/           # Profile, GSTIN, UPI VPAs, staff management, handover
│
├── (staff)/                    # Staff Counter Mode (PIN-Unlocked Station)
│   ├── counter/
│   │   ├── layout.tsx          # Minimal, high-contrast POS counter layout
│   │   ├── unlock/             # 4-to-6 digit PIN entry screen
│   │   ├── pos/                # Fast order punching and instant bill generation
│   │   ├── kot/                # Kitchen Order Ticket live display (restaurant)
│   │   └── queue/              # Live appointment queue (salon/clinic)
│
├── (admin)/                    # Platform Super-Admin Governance Console
│   ├── platform-admin/
│   │   ├── layout.tsx          # Platform admin navigation layout
│   │   ├── page.tsx            # Global system health, active tenant counts
│   │   ├── tenants/            # Global business and workspace inspector
│   │   ├── plans/              # Master plan tiers and add-on pricing configuration
│   │   ├── taxes/              # Master HSN/SAC GST rate tables
│   │   ├── audit-logs/         # Tamper-evident global audit trail
│   │   └── abuse/              # Spam defense, WhatsApp quiet-hour compliance
│
└── api/                        # REST API Route Handlers & External Webhooks
    ├── v1/
    │   ├── auth/               # Auth callbacks, session checks
    │   ├── businesses/         # Tenant CRUD, profile, and settings
    │   ├── orders/             # Order creation, status progression
    │   ├── bills/              # Sequential GST invoice generation
    │   ├── catalogue/          # Public catalogue search and filtering
    │   └── vya/                # AI streaming route and confirmation handling
    └── webhooks/
        ├── razorpay/           # Razorpay payment & split settlement webhook
        ├── cashfree/           # Cashfree payment webhook
        ├── whatsapp/           # Meta Cloud API message/delivery status webhook
        └── google/             # Google Business Profile sync notifications
```

---

## 3. Component Architecture (`src/components/`)

Components are partitioned by responsibility and reusability:

```
src/components/
├── ui/                         # Design System Primitives (Radix UI + Tailwind)
│   ├── button.tsx              # Accessible button (variants: primary, secondary, danger)
│   ├── input.tsx               # Touch-friendly accessible form input with focus ring
│   ├── dialog.tsx              # WAI-ARIA accessible modal dialog
│   ├── dropdown-menu.tsx
│   ├── table.tsx               # Responsive data table with mobile card fallback
│   ├── badge.tsx               # Status badges (PAID, PENDING, DRAFT, LIVE)
│   ├── skeleton.tsx            # Layout-matching shimmer loading states
│   └── toast.tsx               # Non-intrusive accessible notification toasts
│
├── modules/                    # Niche Reusable Product Modules
│   ├── catalogue/              # Product cards, variant selectors, price tags
│   ├── orders/                 # Order summary cards, status badges, pickup timers
│   ├── billing/                # Invoice preview, thermal receipt print layout, A4 PDF
│   ├── appointments/           # Time slot picker, staff selector, calendar grid
│   ├── inventory/              # Stock adjustment modal, low-stock alert pill
│   ├── property/               # Real estate property card, floor plan viewer
│   ├── restaurant/             # Table grid, KOT ticket layout, dining bill split
│   ├── service/                # Service repair ticket status, condition checklist
│   └── loyalty/                # Digital stamp card, coupon code input
│
├── editor/                     # Constrained Visual Website Editor
│   ├── canvas.tsx              # Mobile/desktop responsive preview canvas
│   ├── block-palette.tsx       # Approved component library (Hero, Menu, Contact, etc.)
│   ├── property-inspector.tsx  # Constrained form controls for block customization
│   └── history-toolbar.tsx     # Undo, redo, autosave status, and publish button
│
└── layout/                     # Shells, Headers, Footers, and Navbars
    ├── public-navbar.tsx       # Storefront navigation bar
    ├── owner-navbar.tsx        # Mobile-first (390px) merchant bottom navigation
    ├── reseller-sidebar.tsx    # Desktop agency sidebar
    └── empty-state.tsx         # Unified empty state view with illustration and CTA
```

---

## 4. Business Logic and Library Organization (`src/lib/`)

Domain logic is cleanly isolated from the presentation layer:

```
src/lib/
├── server/                     # Server-Only Domain Services
│   ├── auth-service.ts         # User auth identity lookup, PIN validation
│   ├── business-service.ts     # Business onboarding, profile management
│   ├── handover-service.ts     # Auditable business transfer workflow & OTP
│   ├── order-service.ts        # Order calculation, status progression
│   ├── billing-service.ts      # Gap-free invoice sequence allocation, CGST/SGST math
│   ├── whatsapp-service.ts     # Template hydration, consent validation, quiet hours
│   └── audit-service.ts        # Immutable audit log emitter
│
├── db/                         # Database Access Layer
│   ├── index.ts                # PostgreSQL connection pool with connection pooling safety
│   ├── schema/                 # Drizzle relational schema definitions
│   │   ├── iam.ts              # Users, UserAuthIdentities, Workspaces, BusinessMembers
│   │   ├── businesses.ts       # Businesses, Locations, Sites, SiteVersions
│   │   ├── commerce.ts         # Orders, OrderItems, Bills, InvoiceSequences, TaxRates
│   │   ├── customers.ts        # Customers, ConsentRecords, LoyaltyLedgers
│   │   ├── messaging.ts        # Messages, Templates, Broadcasts, Automations
│   │   ├── ai.ts               # BusinessMemory, Conversations, AIActions, PendingActions
│   │   └── integrations.ts     # Integrations, AuditLogs, AnalyticsEvents
│   └── rls.ts                  # Transaction-scoped `SET LOCAL` tenant context helpers
│
├── ai/                         # Vya AI Gateway & Tooling
│   ├── router.ts               # Multi-model router (Claude Sonnet 3.5, Gemini Flash)
│   ├── context.ts              # Pre-flight PII redaction and shop memory injection
│   ├── tools/                  # Allow-listed Vya tool definitions
│   │   ├── catalogue-tools.ts  # Search products, check price
│   │   ├── order-tools.ts      # Query order status, look up customer bills
│   │   └── write-actions.ts    # Staged write proposals returning PendingAction tokens
│   └── streaming.ts            # SSE streaming response pipeline
│
├── queue/                      # BullMQ Redis Queue Layer
│   ├── connection.ts           # Redis connection configuration
│   ├── queues.ts               # Defined queues (whatsapp, automations, billing, ai)
│   └── producers.ts            # Typed job dispatch functions
│
├── integrations/               # External Provider Adapters
│   ├── whatsapp/               # WhatsApp Cloud API / BSP adapter interface
│   ├── payments/               # Payment gateway adapters (Razorpay, Cashfree, UPI)
│   ├── google/                 # Google Business Profile API adapter
│   ├── meta/                   # Meta Graph API adapter for Facebook/Instagram
│   └── logistics/              # Hyperlocal delivery adapters (Porter, Borzo, ONDC)
│
└── utils/                      # Pure Helper Functions
    ├── currency.ts             # amount_minor to formatted INR string (₹150.50)
    ├── date.ts                 # Indian Standard Time (IST) formatting
    ├── slug.ts                 # Safe URL slug generator
    └── crypto.ts               # HMAC-SHA256 signature verification & Peppered hashing
```

---

## 5. Background Workers (`src/workers/`)

Long-running and asynchronous tasks execute independently in dedicated Node.js worker processes:

```
src/workers/
├── whatsapp-worker.ts          # Dispatches WhatsApp messages with quiet-hour rate limiting
├── automation-worker.ts        # Evaluates trigger-condition-action workflow events
├── billing-worker.ts           # Batch generates PDF receipts, exports GSTR-1 summaries
└── cleanup-worker.ts           # Cleans expired pending actions, stale draft previews
```

---

## 6. Automated Test Suites (`tests/`)

Tests are organized into distinct test harnesses:

```
tests/
├── unit/                       # Fast In-Memory Unit Tests (Vitest)
│   ├── tax-calculator.test.ts  # Exact CGST/SGST/IGST math validation
│   ├── currency.test.ts        # ISO 4217 minor unit conversions
│   └── permissions.test.ts     # Role-based access control matrix
│
├── integration/                # Database & API Integration Tests (Vitest + Test DB)
│   ├── rls-isolation.test.ts   # Verifies cross-tenant data query denial
│   ├── sequence-locking.test.ts# Concurrent bill creation produces zero sequence gaps
│   ├── handover.test.ts        # Full business handover workflow verification
│   └── webhook-sig.test.ts     # Razorpay and WhatsApp HMAC signature verification
│
├── e2e/                        # End-to-End User Journey Tests (Playwright)
│   ├── mobile/                 # 390px mobile viewport tests (mobile-first)
│   │   ├── counter-punch.spec.ts # Cashier punches order and prints bill in <15s
│   │   ├── storefront-buy.spec.ts# Customer browses menu, adds to cart, checks out
│   │   └── vya-chat.spec.ts    # Merchant interacts with Vya daily assistant
│   └── desktop/                # 1440px desktop viewport tests
│       └── agency-portal.spec.ts # Reseller manages clients and inspects payouts
│
├── ai-evals/                   # Vya Quality and Safety Golden Evaluation Suite
│   ├── golden-dataset.json     # 100+ vetted business queries in English and Hinglish
│   ├── prompt-injection.test.ts# Evaluates resistance to DAN, jailbreaks, leak prompts
│   └── fact-recall.test.ts     # Verifies zero hallucination of prices or tax rules
│
└── fixtures/                   # Test Factories and Seed Data
    ├── business-factory.ts
    ├── customer-factory.ts
    └── order-factory.ts
```

---

## 7. Configuration and Shared Types

- `src/config/env.ts`: Centralized runtime environment validator using strict Zod parsing.
- `src/config/constants.ts`: System constants (platform plan IDs, quiet-hour boundaries, tax slabs).
- `src/types/`: Shared TypeScript definitions across frontend and backend boundaries.
