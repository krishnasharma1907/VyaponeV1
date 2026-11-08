# VyapOne — Engineering Standards and Implementation Conventions

**Document Version:** 1.0  
**Date:** 8 November 2026  
**Status:** Canonical Engineering Standards  
**Task ID:** VO-006  
**Primary Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15, §16, §17)  
**Related Documents:** `docs/SOURCE_OF_TRUTH.md`, `docs/ADR_INDEX.md`, `docs/THREAT_MODEL.md`, `docs/DOMAIN_ARCHITECTURE.md`, `docs/PHASE_GATES.md`

---

## 1. Document Purpose and Authority Distinction

This document defines the mandatory engineering conventions, coding rules, and quality practices for all developers and AI agents working on the VyapOne platform.

### 1.1 Approved Invariants vs. Proposed Architecture Decisions
To maintain strict governance integrity, we explicitly distinguish between non-negotiable architectural invariants and proposed stack decisions:

| Area | Status | Authority / Decision Context |
|---|---|---|
| **Multi-Tenant Scoping & RLS** | **APPROVED INVARIANT** | PRD FINAL §4.7, §17.1. Database-enforced isolation via `business_id` is mandatory. |
| **Server-Side Validation & Truth** | **APPROVED INVARIANT** | PRD FINAL §15.2, §16. Taxes, totals, inventory, and permissions are server-owned facts. |
| **Mobile-First 390px Essential Workflow** | **APPROVED INVARIANT** | PRD FINAL §18. Complete store management workflows must work on 390px screens. |
| **WCAG 2.2 AA Accessibility** | **APPROVED INVARIANT** | PRD FINAL §18.2. Visible focus, contrast $\ge 4.5:1$, keyboard access, screen readers. |
| **Zero Secrets in Code or Logs** | **APPROVED INVARIANT** | PRD FINAL §17.3. No API keys, credentials, or customer PII in logs, prompts, or git. |
| **Sequential Gap-Free GST Invoicing** | **APPROVED INVARIANT** | PRD FINAL §8.15. CGST Rule 46 compliance via atomic database sequences. |
| **Application Framework (Next.js 15+ App Router)** | `PROPOSED` (PROVISIONAL) | Recommended in `ADR-001`. Final sign-off at Phase P1 gate. |
| **Database & ORM (PostgreSQL 16+ & Drizzle)** | `PROPOSED` | Recommended in `ADR-002`. Standard SQL migrations. |
| **Authentication & Storage (Supabase Auth / S3)** | `PROPOSED` | Recommended in `ADR-003`. Pluggable behind adapter interfaces. |
| **UI Library & CSS (Tailwind CSS & Radix Primitives)** | `PROPOSED` | Recommended in `ADR-001`. Fully accessible component tokens. |

---

## 2. TypeScript Strict Mode and Language Standards

All codebase files (frontend, backend, workers, scripts, and tests) must be written in TypeScript with the strictest compiler settings enabled.

### 2.1 Compiler Configuration (`tsconfig.json`)
The following flags are mandatory and must never be disabled or relaxed:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

### 2.2 Type System Invariants
1. **No `any` Ever:** The use of `any` is strictly prohibited. Use `unknown` with runtime type narrowing (e.g. Zod parsing or type guards).
2. **Explicit Function Return Types:** All exported functions, service methods, and API route handlers must declare explicit return types:
   ```typescript
   // Correct
   export async function getBusinessById(businessId: string): Promise<Result<Business, DomainError>> { ... }

   // Prohibited (Implicit return type)
   export async function getBusinessById(businessId: string) { ... }
   ```
3. **No Non-Null Assertions (`!`):** The non-null assertion operator (`object!.property`) is forbidden. Use proper null-checking, optional chaining (`?.`), or throw descriptive domain errors.
4. **Enums vs. Const Assertions:** Prefer `as const` object maps or TypeScript string union types over numeric enums for zero-runtime overhead and clean serializability:
   ```typescript
   export const OrderStatus = {
     PENDING: "PENDING",
     CONFIRMED: "CONFIRMED",
     READY: "READY",
     OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
     DELIVERED: "DELIVERED",
     CANCELLED: "CANCELLED",
   } as const;

   export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
   ```

---

## 3. React and Next.js Conventions

### 3.1 Server vs. Client Components (App Router)
1. **Server Components by Default:** Every page and layout in the Next.js App Router must be a React Server Component (RSC) unless interactivity is strictly required.
2. **Push State to the Leaves:** Keep `'use client'` at the lowest possible leaf component in the DOM tree (e.g., an interactive button, modal, or form input). Never mark an entire page or layout as `'use client'`.
3. **Zero Secrets in Client Bundles:** Client components must never import database clients, server env variables, private API secrets, or server services. Next.js `server-only` package must be imported in all server service files.

### 3.2 State Management and UI Lifecycle
1. **Mandatory UI State Coverage:** Every interactive component, data-fetching view, and counter screen must handle all five states explicitly:
   - **Loading:** Accessible skeleton loaders matching the layout dimensions.
   - **Empty:** Clean, helpful empty state with a clear call-to-action (CTA).
   - **Error:** Human-friendly, non-technical error message with a retry button.
   - **Success:** Optimistic updates or clear confirmation feedback.
   - **Permission Denied:** Clean 403 Forbidden state explaining why access is restricted.
2. **Server Actions vs. Route Handlers:**
   - Use **Server Actions** for form submissions, state transitions, and UI mutations within the main dashboard.
   - Use **Route Handlers (`app/api/**/route.ts`)** for external webhooks (Razorpay, Meta), mobile/POS API clients, and public website endpoints.

---

## 4. Frontend / Backend / Layered Organization

To ensure maintainability across thousands of businesses and multiple user portals, code must follow a strict three-tier architecture:

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Presentation Tier (Pages, Layouts, Client Components)    │
│    • Responsible for layout, UI states, accessible inputs   │
└──────────────────────────────┬──────────────────────────────┘
                               │ Calls Server Actions or Services
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Domain / Service Tier (Business Logic, Auth, Tax Rules)  │
│    • Validates inputs via Zod                               │
│    • Computes statutory taxes & server-side totals          │
│    • Enforces multi-tenant permissions & quiet hours        │
└──────────────────────────────┬──────────────────────────────┘
                               │ Calls Adapters or Data Access
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Data Access & Adapters (Database, Redis, 3rd-Party APIs) │
│    • Drizzle ORM queries scoped to transaction RLS context  │
│    • Payment gateway adapters (Razorpay, Cashfree)          │
│    • WhatsApp BSP adapter (Cloud API)                       │
└─────────────────────────────────────────────────────────────┘
```

- **Boundary Rule:** UI components must never execute raw SQL queries, directly instantiate database connection pools, or perform raw HTTP fetch calls to external providers. All data operations must flow through typed domain services.

---

## 5. Naming Conventions

Consistency across files, database tables, and code symbols prevents cognitive overhead and bugs:

| Element | Convention | Example |
|---|---|---|
| **Directories** | kebab-case | `src/app/reseller-portal/`, `src/shared-ui/` |
| **React Components** | PascalCase | `OrderSummaryCard.tsx`, `InvoiceReceipt.tsx` |
| **Service & Util Files** | kebab-case | `billing-service.ts`, `tax-calculator.ts` |
| **Database Tables** | snake_case (plural) | `businesses`, `orders`, `invoice_sequences` |
| **Database Columns** | snake_case | `business_id`, `amount_minor`, `currency_code` |
| **TypeScript Types & Interfaces** | PascalCase | `CatalogueItem`, `CreateOrderInput` |
| **TypeScript Variables & Functions** | camelCase | `calculateGstTotals`, `activeLocationId` |
| **Constants & Enums** | UPPER_SNAKE_CASE | `MAX_LOGIN_ATTEMPTS`, `DEFAULT_CURRENCY` |
| **API Endpoints** | kebab-case (RESTful) | `/api/v1/businesses/{id}/orders` |

---

## 6. Shared Zod Schemas and Validation Standards

Input validation is the primary security boundary against data corruption, injection, and invalid states.

### 6.1 Shared Schema Rules
1. **Single Source of Truth:** All DTOs (Data Transfer Objects), API payloads, form submissions, and database input types are derived from Zod schemas:
   ```typescript
   import { z } from "zod";

   export const CreateOrderSchema = z.object({
     businessId: z.string().uuid(),
     locationId: z.string().uuid().optional(),
     customerId: z.string().uuid().optional(),
     items: z.array(z.object({
       catalogueItemId: z.string().uuid(),
       quantity: z.number().int().positive(),
       selectedOptions: z.record(z.string()).default({}),
     })).min(1, "Order must contain at least one item"),
     fulfilmentType: z.enum(["PICKUP", "DELIVERY", "DINE_IN"]),
   });

   export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;
   ```
2. **Server-Side Validation Mandatory:** Client-side form validation is a UX enhancement only. Every Server Action and API Route handler **must** validate incoming payloads via `.parse()` or `.safeParse()` on the server before executing business logic.
3. **Strip Unknown Properties:** Use `.strict()` on sensitive Zod schemas (such as billing or role assignment) to reject unexpected payload parameters.

---

## 7. Database Migration and Schema Standards

### 7.1 Migration Workflow
1. **Strict SQL Migration Files:** Database schemas are defined declaratively in code, and migration files (`.sql`) are committed directly to version control.
2. **Zero Manual Production Edits:** Manual schema modifications in staging or production databases are strictly prohibited. All changes must execute through automated CI migration runners (`VO-020`).
3. **Reversible Migrations:** Every migration must be forward-compatible and include a documented rollback path.
4. **Non-Destructive Changes:**
   - Adding a column: Must be `NULL` or provide a safe `DEFAULT`.
   - Renaming a column: Use a multi-phase deploy (Add new column $\to$ dual write $\to$ backfill $\to$ cutover $\to$ drop old column). Never rename or drop columns in a single migration without coordination.

### 7.2 Transaction-Scoped RLS Context
In pooled PostgreSQL environments (PgBouncer in transaction mode or Supavisor), all database mutations must execute inside a transaction block with transaction-scoped tenant context:
```typescript
await db.transaction(async (tx) => {
  // SET LOCAL guarantees context resets on commit or rollback
  await tx.execute(sql`SELECT set_config('app.current_business_id', ${businessId}, true)`);
  
  // Queries execute under PostgreSQL RLS policy
  await tx.insert(orders).values(orderData);
});
```

---

## 8. Error Handling and API Response Formats

### 8.1 Unified API Response Format
All REST API endpoints and Server Actions must return a standardized, predictable JSON envelope:

#### Success Envelope (`200 OK`, `201 Created`):
```json
{
  "success": true,
  "data": {
    "orderId": "018e3a2b-8b5e-7a1a-9f8d-4e9f7d2a1b3c",
    "orderNumber": "ORD-2026-0042",
    "finalAmountMinor": 45000,
    "currencyCode": "INR",
    "status": "CONFIRMED"
  },
  "meta": {
    "requestId": "req_01h8x9j2k3l4m5n6p7q8",
    "timestamp": "2026-11-08T14:25:00.000Z"
  }
}
```

#### Error Envelope (`400`, `401`, `403`, `404`, `409`, `422`, `500`):
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_STOCK",
    "message": "Item 'Masala Chai 250g' only has 2 units remaining in stock.",
    "details": [
      {
        "field": "items[0].quantity",
        "issue": "Requested quantity (5) exceeds available on-hand stock (2)"
      }
    ]
  },
  "meta": {
    "requestId": "req_01h8x9j2k3l4m5n6p7q8",
    "timestamp": "2026-11-08T14:25:00.000Z"
  }
}
```

### 8.2 Error Classification Invariants
1. **User-Safe Messages:** Error messages returned to client browsers or WhatsApp chats must be clear, actionable, and non-technical.
2. **Zero Internal Leaks:** Raw database error stacks, SQL query strings, Redis connection errors, or third-party API keys must **never** be included in client error envelopes. All internal technical errors return generic code `INTERNAL_SERVER_ERROR` with a unique `requestId` for debugging in server logs.

---

## 9. Structured Logging and PII Sanitization

### 9.1 Logging Standards
1. **Structured JSON Logs:** All application logs must be emitted as machine-readable JSON strings to stdout/stderr:
   ```json
   {
     "level": "info",
     "timestamp": "2026-11-08T14:25:01.123Z",
     "requestId": "req_01h8x9j2k3l4m5n6p7q8",
     "businessId": "018e3a2b-8b5e-7a1a-9f8d-4e9f7d2a1b3c",
     "actorUserId": "018e3a2a-4f1e-7b2c-8a1d-3c2b1a0f9e8d",
     "action": "order:created",
     "metadata": {
       "orderNumber": "ORD-2026-0042",
       "amountMinor": 45000,
       "currencyCode": "INR"
     }
   }
   ```
2. **Request Traceability:** Every HTTP request and async job must generate or propagate a unique `requestId` (UUIDv7 or ULID) in the headers (`x-request-id`) and attach it to all downstream log statements.

### 9.2 PII Redaction Invariants (DPDP Act 2023)
- **Automatic Sanitization:** Customer phone numbers, email addresses, passwords, PINs, Aadhaar numbers, and credit card numbers must be redacted before logging:
  - Phone numbers $\to$ `+91 ******1234`
  - Email addresses $\to$ `r*****@example.com`
  - PINs / Passwords $\to$ `[REDACTED]`

---

## 10. Environment Configuration and Secrets Management

### 10.1 Configuration Validation (`src/config/env.ts`)
All environment variables must be validated at application startup using a strict Zod schema:
```typescript
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url("Valid PostgreSQL connection string required"),
  REDIS_URL: z.string().url("Valid Redis connection string required"),
  NEXTAUTH_SECRET: z.string().min(32, "Auth secret must be at least 32 characters"),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  META_WHATSAPP_TOKEN: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
```
If any required variable is missing or malformed, the application will fail fast on boot with a clear configuration error.

### 10.2 Secret Protection Rules
- **No Secrets in Source Control:** `.env`, `.env.local`, `.env.production` are strictly ignored in `.gitignore`.
- **Public vs. Private Variables:** Only variables explicitly prefixed with `NEXT_PUBLIC_` are bundled into client-side JavaScript. Never put server secrets in `NEXT_PUBLIC_` variables.
- **Example Template:** Maintain an up-to-date `.env.example` in the root repository containing placeholder dummy values and descriptive setup notes.

---

## 11. Git Workflow and Collaboration Standards

### 11.1 Repository and Branching Model
The repository will be initialized in task `VO-010`. The branching workflow follows a trunk-based model:
- `main`: **Protected branch.** Production-ready code. Direct pushes are disabled. All merges require an approved Pull Request (PR) and green CI checks.
- Feature Branches: Named according to backlog task IDs and scope:
  - `feat/VO-012-design-tokens`
  - `fix/VO-063-order-rounding`
  - `chore/VO-011-eslint-rules`

### 11.2 Conventional Commit Messages
Commits must follow the Conventional Commits specification:
```
<type>(<scope>): <short description> [TASK-ID]

[optional detailed body]
```
- **Allowed Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`, `revert`.
- **Example:** `feat(billing): add gap-free invoice sequence allocation [VO-081]`

### 11.3 Atomic Commits and Rollback
Each commit must represent a single, atomic logical change that compiles and passes tests independently. If a regression occurs in production, any single feature commit can be cleanly reverted using `git revert` without side effects.

---

## 12. Dependency Governance and Open Source Licensing

### 12.1 Approved Open Source Licenses
VyapOne is a proprietary commercial multi-tenant SaaS platform. Only packages with permissive open-source licenses are permitted in dependencies:
- **Approved:** `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`.
- **Strictly Prohibited (Copyleft):** `GPL-2.0`, `GPL-3.0`, `AGPL-3.0`, `LGPL`, `SSPL`. Including copyleft dependencies in the production bundle is a critical licensing violation.

### 12.2 Dependency Review Checklist
Before adding any new dependency to `package.json`:
1. **Audit Security:** Run `pnpm audit` (or `npm audit`) — zero critical or high vulnerabilities allowed.
2. **Bundle Size Impact:** Check bundle size via `bundlephobia.com`. Prefer native JavaScript/Web APIs over bloated libraries (e.g., use native `fetch` over `axios`).
3. **Maintenance Health:** Verify the package has active maintenance, recent commits within 6 months, and TypeScript definitions.

---

## 13. Definition of Done (DoD)

A backlog task is only marked `DONE` when all of the following criteria are verified:
1. **Scope Complete:** All acceptance criteria listed in `docs/TASK_BACKLOG.md` are fully met.
2. **TypeScript Clean:** Zero compiler errors (`tsc --noEmit` passes cleanly).
3. **Linter Clean:** Zero ESLint errors or warnings.
4. **Automated Tests:** Unit and integration tests written and passing; no skipped or weakened tests.
5. **Mobile Validated:** Workflow tested and confirmed functional at 390px mobile viewport width.
6. **Accessible:** Passes WCAG 2.2 AA standards (visible focus, readable contrast, keyboard navigable).
7. **Security Verified:** Multi-tenant RLS checks, Zod input validation, and zero leaked secrets confirmed.
8. **Documentation Updated:** `docs/PROGRESS.md`, `docs/CHANGELOG.md`, and task status in `docs/TASK_BACKLOG.md` updated with exact task report.
