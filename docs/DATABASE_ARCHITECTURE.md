# VyapOne Database & Supabase Client Architecture

**Task ID:** VO-017  
**Phase:** P2 — Database Architecture, RLS and Sovereign Tenant Isolation  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§4, §15.2, §16, §17.1, §17.3)  
**Status:** Canonical Database & Client Specification  

---

## 1. Executive Summary & Infrastructure Reconciliation

VyapOne reconciles three core architectural directions:
1. **Hosting Platform (ADR-004):** Cloudflare Pages / Workers edge runtime (India-first low latency, dense POPs in Mumbai, Delhi, Bengaluru, Chennai).
2. **Backend Platform (ADR-003):** Full Supabase platform (PostgreSQL 16+, Supabase Auth, Storage, PostgREST Data API).
3. **Database & Multi-Tenancy (ADR-002):** Dual-layer tenant isolation enforcing PostgreSQL Row-Level Security (RLS) on all tenant-owned entities in the four-level hierarchy: `Platform → Reseller Workspace → Business → Location`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Client Tier (Browser / Mobile PWA)                    │
│   • Client Components ("use client")                                        │
│   • Uses `createBrowserSupabaseClient()` via `@supabase/ssr`                 │
│   • Credentials: `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` │
│   • Security: Browser requests strictly bound by PostgreSQL RLS              │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS (JWT in Cookie)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Cloudflare Workers / Next.js Server Tier                    │
│   • Server Components, Server Actions, Route Handlers                       │
│   • Guarded by `import "server-only"`                                       │
│                                                                             │
│   ┌───────────────────────────────────┐ ┌─────────────────────────────────┐ │
│   │ `createServerSupabaseClient()`    │ │ `createAdminSupabaseClient()`   │ │
│   │  • Request-scoped cookies         │ │  • `SUPABASE_SERVICE_ROLE_KEY`  │ │
│   │  • Operates as requesting user    │ │  • Bypasses RLS (Admin Only)    │ │
│   │  • Strictly enforces RLS          │ │  • Platform provisioning/cron   │ │
│   └─────────────────┬─────────────────┘ └─────────────────┬───────────────┘ │
└─────────────────────┼─────────────────────────────────────┼─────────────────┘
                      │ PostgREST over HTTPS                │ PostgREST over HTTPS
                      ▼                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Supabase Backend Tier                             │
│   • Supavisor Connection Pooler (Port 6543 Transaction / 5432 Session)      │
│   • PostgreSQL 16+ Engine with Native Row-Level Security (RLS)              │
│   • Sovereign Business Data Ownership & Isolated Workspaces                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Client Architecture & Execution Boundaries

| Client Module | Import Path | Execution Context | Key / Credential Used | RLS Enforcement | Primary Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Browser Client** | `@/lib/supabase/client` or `@/lib/supabase` | React Client Components (`"use client"`), Browser DOM | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Enforced** | Client-side reactive UI, auth state change subscriptions, real-time channels |
| **Server Client** | `@/lib/supabase/server` | Server Components, Server Actions, Route Handlers | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + Request Cookies | **Enforced** | Request-scoped authenticated server operations acting on behalf of the logged-in user |
| **Middleware Helper** | `@/lib/supabase/middleware` | Next.js Edge Middleware (`middleware.ts`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` + Request Cookies | **Enforced** | Refreshes auth tokens via `supabase.auth.getUser()`, updates response cookies |
| **Administrative Client** | `@/lib/supabase/admin` | Server-Only privileged operations | `SUPABASE_SERVICE_ROLE_KEY` | **BYPASSED** | Platform tenant provisioning, webhook signature verification, cron jobs, audit log ingestion |

### Boundary Security Invariants
1. **Never Import Privileged Modules in Client Components:** `src/lib/supabase/server.ts` and `src/lib/supabase/admin.ts` explicitly import `"server-only"`. Any inadvertent import into a Client Component fails the build immediately.
2. **Never Use Admin Client for Routine Tenant Operations:** The service-role client bypasses all RLS checks. Routine queries for orders, customers, catalogue, bills, and settings MUST use `createServerSupabaseClient()`.
3. **Request Isolation:** Server clients are instantiated per request with the request's individual cookie store. No mutable authenticated user state is shared in global singletons.

---

## 3. Cloudflare Workers Runtime & PostgreSQL Connection Pooling

### The Serverless Connection Problem
Traditional Node.js applications maintain long-lived connection pools (10–50 persistent TCP sockets). In serverless edge environments (Cloudflare Workers / Pages Functions):
- Workers execute in stateless, ephemeral micro-containers.
- Opening persistent TCP sockets on every request quickly exhausts PostgreSQL connection limits (Supabase free tier allows ~60 direct connections).
- Standard Node.js TCP drivers (`pg`) require Node socket polyfills (`cloudflare:sockets`) which can add latency.

### The VyapOne Solution
1. **Primary Runtime Queries (Connectionless PostgREST):**
   Normal application data operations in Server Components and Server Actions use the Supabase Data API (`@supabase/ssr` / `@supabase/supabase-js`) over HTTPS.
   - 100% compatible with Cloudflare Workers.
   - Zero persistent TCP sockets held open.
   - Automatic connection pooling handled inside Supabase's edge proxy infrastructure.
2. **Direct SQL Migrations & Analytical Queries (Supavisor Pooler):**
   When direct PostgreSQL connectivity is needed (e.g. running schema migrations in CI in `VO-020` or executing heavy batch analytics):
   - **Port 6543 (Transaction Pooler):** Required for serverless database connections (`?pgbouncer=true`). Clients check out a connection only for the duration of a transaction.
   - **Port 5432 (Session Pooler / Direct):** Used exclusively for DDL migrations that execute non-transactional statements (`CREATE TABLE`, `ALTER TABLE`).
3. **Lazy Driver Evaluation:**
   `src/lib/database/index.ts` never connects to the database on module import. Connections are created on demand and closed immediately upon completion.

---

## 4. Environment Variables Matrix

| Variable | Classification | Required In Prod? | Consumed In Runtime | Purpose |
| :--- | :--- | :---: | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | **YES** | Browser + Server | Canonical Supabase project URL (`https://<project-ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | **YES** | Browser + Server | Anon public API key. Used with user JWT to enforce PostgreSQL RLS. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-Only | **YES** | Server Only | Privileged service key. Bypasses RLS. Used exclusively in `admin.ts`. |
| `DATABASE_URL` | Server-Only | Optional for web; Required for migrations | Server Only | Direct PostgreSQL URL via Supavisor pooler (port 6543 for transaction pooling). |
| `DATABASE_DIRECT_URL` | Server-Only | Optional | Server Only | Direct connection string on port 5432 for running DDL schema migrations. |
| `SESSION_SECRET` | Server-Only | **YES** | Server Only | 32+ character secret for application-level state signing and CSRF tokens. |

---

## 5. Database Types & Regeneration Workflow

Database types are version-controlled in `src/lib/supabase/types.ts`. They represent the full canonical domain model defined in `docs/diagrams/core-erd.mmd`:
- Tenancy & Workspaces: `workspaces`, `workspace_members`, `businesses`, `locations`, `business_members`
- User & Auth: `users`, `user_auth_identities`
- Commerce & Operations: `sites`, `catalogue_items`, `orders`, `customers`, `bills`
- Compliance & System: `audit_logs`

### Regeneration Command
When connected to a live or local Supabase project:
```bash
pnpm dlx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/types.ts
```

---

## 6. RLS & Tenant Isolation Protection Boundaries

### What is Established in VO-017
- Client infrastructure enforcing RLS via the anon key and user auth cookies.
- Strict isolation preventing the service-role key from leaking into client bundles or routine user operations.
- Version-controlled schema definitions supporting tenant foreign keys (`workspace_id`, `business_id`, `location_id`).

### What is Reserved for Later Tasks
- SQL migration scripts creating physical tables and foreign keys: **VO-020**.
- Signup, login, and OTP authentication flows: **VO-021**.
- Workspace and membership role definitions: **VO-022**.
- PostgreSQL RLS policy scripts (`CREATE POLICY`) and automated penetration tests proving tenant isolation: **VO-024**.

---

## 7. Zero-Budget ($0) Free-Tier Constraints & Mitigations

| Provider / Feature | Free Tier Limitation | VyapOne Mitigation |
| :--- | :--- | :--- |
| **Supabase Database Connections** | Max ~60 direct connections on free plan. | Primary web traffic uses HTTPS Data API (`@supabase/ssr`). Direct SQL uses Supavisor transaction pooler (port 6543). |
| **Supabase Project Inactivity** | Free projects pause after 7 days of inactivity. | Automated health endpoint ping or scheduled cron job maintains activity during staging/preview phases. |
| **Cloudflare Workers Free Tier** | 100,000 requests/day, 10ms CPU time limit per request. | Static route caching, aggressive ISR for public store pages, and sub-5ms client bundle execution. |
| **Supabase Storage Egress** | 2 GB free egress/month. | WebP image optimization, CDN caching at Cloudflare edge, and direct client uploads via presigned URLs. |
