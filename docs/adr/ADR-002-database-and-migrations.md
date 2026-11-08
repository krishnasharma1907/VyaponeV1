# ADR-002: Database, Schema Migrations and Multi-Tenancy Isolation

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-01, FR-02, FR-09, SEC-02, AC-10, AC-13  
**Affected Tasks:** `VO-003`, `VO-020`, `VO-023`, `VO-024`  

---

## 1. Context and Problem Statement
VyapOne hosts thousands of client businesses managed by resellers across India. The data model follows a four-level hierarchy: `Platform → Reseller Workspace → Business → Location`. Every business-owned record (orders, bookings, bills, inventory, customers, conversations) must be strictly isolated to prevent any cross-tenant data leaks. 

We require an enterprise-grade relational database, an automated schema migration workflow, and a robust multi-tenancy enforcement strategy at both the API and database levels.

---

## 2. Options Considered

### Option 1: PostgreSQL 16+ with Native Row-Level Security (RLS) + Drizzle ORM (Recommended)
- **Database:** PostgreSQL 16+ hosted on Supabase, AWS Aurora PostgreSQL, or Neon (India / Mumbai region).
- **ORM / Migrations:** Drizzle ORM for lightweight, SQL-like type safety, zero runtime overhead, and explicit SQL migration files executed in CI.
- **Tenancy Isolation:** Application sets current tenant context (`SET LOCAL app.current_business_id = '...'`) in database transactions; PostgreSQL native RLS policies enforce `USING (business_id = current_setting('app.current_business_id'))`. Dual-layer defense: server API checks + DB RLS.

### Option 2: PostgreSQL 16+ with Prisma ORM and Application-Only Scoping
- **Database:** PostgreSQL.
- **ORM / Migrations:** Prisma ORM using client-side middleware or extension to auto-inject `where: { business_id }`.
- **Tenancy Isolation:** Enforced strictly in application code; no database-level RLS policies.

### Option 3: Separate Database / Schema-per-Tenant
- **Architecture:** Physical database or PostgreSQL schema created dynamically per business.

---

## 3. Comparison of Options

| Criterion | Option 1: PostgreSQL + RLS + Drizzle | Option 2: PostgreSQL + Prisma (App-only) | Option 3: Schema-per-Tenant |
|---|---|---|---|
| **Tenant Isolation Strength** | **Highest:** Database engine denies queries even if application code has a bug or injection. | **Moderate:** Bug in application query leaks data across tenants. | **High:** Strong physical boundary, but operationally complex. |
| **Performance & Cold Starts** | **Excellent:** Drizzle is thin, fast, and serverless-friendly (<5ms overhead). | **Moderate:** Prisma query engine binary adds cold-start latency. | **Poor:** Connection pool explosion across thousands of schemas. |
| **Schema Migrations at Scale** | **High:** Single schema migration script runs deterministically in CI. | **High:** Prisma migrate works well for single schema. | **Very Low:** Running migrations across 10,000 schemas is prone to partial failure. |
| **Cross-Tenant Reporting (Platform Admin)** | **High:** Admin role bypasses RLS cleanly with audit trail. | **High:** Simple admin queries. | **Very Complex:** Cross-schema union queries are slow and fragile. |

---

## 4. Architectural Implications

- **Security:** In accordance with SEC-02 and AC-10, dual-layer tenant isolation is mandatory. Relying on application code alone violates the threat model. Native PostgreSQL RLS ensures unauthorized records cannot be fetched even if an ID is guessed.
- **Performance:** Multi-tenant shared tables require composite B-tree indices on `(business_id, created_at)` and foreign keys to ensure sub-millisecond query execution.
- **Data Sovereignty:** Business records carry `business_id` and optional `location_id`. Reseller access is mediated by membership tables, enabling seamless business handover without physical table migration.

---

## 5. Vendor Lock-in & Portability
PostgreSQL is the global relational database standard. Drizzle ORM generates standard SQL migration files (`.sql`). The database can be hosted on AWS RDS (Mumbai), Supabase, Neon, or self-hosted Docker PostgreSQL without modifying application schema or migrations.

---

## 6. Recommendation and Rationale
**Adopt Option 1: PostgreSQL 16+ with Drizzle ORM and native PostgreSQL Row-Level Security (RLS).**
- Provides the strongest defense-in-depth security model required by PRD FINAL §15.2 and §17.1.
- Drizzle delivers superior cold-start performance in edge/serverless environments.
- Migration scripts remain standard SQL files committed to source control and verified in CI.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** PostgreSQL 16+, migration runner in CI (`VO-020`).
- **Reversal Strategy:** Drizzle operates on raw SQL schemas; switching to Kysely or Prisma requires only re-generating client bindings without database restructuring.
- **Approval Requirement:** Technical Lead. Marked `PROPOSED`.
