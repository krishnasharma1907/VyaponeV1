# VyapOne Database Migration Framework & Conventions

**Task ID:** VO-020  
**Phase:** P2 — Platform Identity, Authentication and Multi-Tenancy  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§4, §15.2, §16, §17)  
**Architecture:** ADR-002, ADR-003, ADR-004, `docs/DATABASE_ARCHITECTURE.md`  
**Status:** Canonical Database Migration Specification  

---

## 1. Architecture Reconciliation & Migration Strategy

VyapOne reconciles three core architecture decisions into **one single, authoritative database migration pipeline**:

1. **ADR-002 (Database & Migrations):** PostgreSQL 16+ engine with native Row-Level Security (RLS) enforcing sovereign multi-tenancy.
2. **ADR-003 (Backend Platform):** Supabase selected as the full backend platform (PostgreSQL 16+, Supabase Auth, Storage, PostgREST Data API).
3. **ADR-004 (Hosting & Edge Runtime):** Cloudflare Workers / Pages edge runtime, where runtime queries connect connectionlessly via PostgREST HTTPS, while DDL schema migrations run via dedicated migration runners.

### The Single Source of Truth
To prevent competing migration tools, schema drift, or dual-runner race conditions:
- **Migration Generator & Runner:** Supabase CLI native SQL migration framework (`supabase/migrations/`).
- **No Competing Runners:** DDL migrations are strictly defined and version-controlled as timestamped SQL files. No ORM migration engine (e.g. Prisma Migrate or Drizzle Kit) independently executes DDL against the database.
- **Client Types:** Strongly-typed TypeScript interfaces in `src/lib/supabase/types.ts` are generated directly from the PostgreSQL schema using `pnpm db:types`.

---

## 2. Directory Structure

```
supabase/
├── config.toml                 # Supabase local project configuration (ports, auth, storage, pooler)
├── migrations/                 # Linear, immutable, timestamped SQL migration scripts
│   └── 20261112000001_initial_schema.sql  # Core initial schema migration (all 14 canonical tables)
├── tests/                      # pgTAP SQL database regression tests
│   └── 00001_schema_test.sql   # pgTAP suite verifying tables, UUID PKs, minor units, and RLS
└── seed.sql                    # Deterministic, synthetic seed data for local dev & CI
```

---

## 3. Migration File Naming & Conventions

### Deterministic Ordering
Migration files follow the strict format:
```
<YYYYMMDDHHMMSS>_<descriptive_snake_case_name>.sql
```
Example: `20261112000001_initial_schema.sql`.

### Core Engineering Invariants
1. **Migration Immutability:** Once a migration has been applied to any shared, staging, or production environment, it is **IMMUTABLE**. Never edit historical migrations. Corrective changes must be applied via a new forward migration.
2. **UUID Primary Keys:** All tables use `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. Serial or incrementing integers are strictly prohibited for primary identifiers.
3. **Integer Minor Units:** All monetary amounts are stored as 64-bit integers (`BIGINT`) representing minor units (e.g. paisa for INR: `850000` = ₹8,500.00). Floating-point financial columns (`FLOAT`, `REAL`, `DOUBLE PRECISION`) are strictly prohibited.
4. **Row-Level Security (RLS) Mandatory:** Every tenant-owned table MUST execute `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`. The default posture is **DEFAULT DENY**; no query is allowed without explicit policies.
5. **Dual-Layer Tenancy:** The data model strictly reflects the sovereign ownership hierarchy:
   ```
   Platform -> Reseller Workspace -> Business (Sovereign Owner) -> Location
   ```
   Reseller workspaces have administrative management access, but the **Business** is the sovereign owner of customers, orders, inventory, bills, sites, and AI memory.
6. **Gap-Free Invoices:** Invoices use atomic `invoice_sequences` counters (`current_sequence_number BIGINT`) per business and financial year.
7. **Immutable Audit Logs:** `audit_logs` has no `updated_at` trigger and is append-only.

---

## 4. Local Development Workflow & Commands

VyapOne defines standard database management scripts in [`package.json`](file:///F:/VyaponeV2/package.json):

| Command | Action | Description |
|---|---|---|
| `pnpm db:start` | `supabase start` | Starts the local Supabase Docker stack (PostgreSQL, PostgREST, Auth, Storage, Studio). |
| `pnpm db:stop` | `supabase stop` | Stops the running local Supabase containers. |
| `pnpm db:reset` | `supabase db reset` | Recreates the local database from scratch, applies all migrations in order, and executes `seed.sql`. |
| `pnpm db:migration:new <name>` | `supabase migration new <name>` | Scaffolds a new timestamped migration file in `supabase/migrations/`. |
| `pnpm db:test` | `supabase test db` | Executes the pgTAP regression test suite (`supabase/tests/*.sql`). |
| `pnpm db:types` | `supabase gen types typescript --local > src/lib/supabase/types.ts` | Regenerates database TypeScript types from the local PostgreSQL schema. |

### Container Runtime Dependency
- The local Supabase stack requires a Docker-compatible container runtime (Docker Desktop or WSL2 Docker Engine).
- **Current Workstation Status:** Docker is not currently installed on this workstation. Live local PostgreSQL container execution is marked as **BLOCKED by local container runtime availability**.
- **Static Verification:** All migration syntax, table definitions, foreign keys, minor units, indexes, RLS commands, seed fixtures, and pgTAP tests are statically verified via automated Vitest test suites (`tests/unit/database/migrations.test.ts`).

---

## 5. Row-Level Security (RLS) Migration Rules

### Grants vs. Policies
PostgreSQL grants (`GRANT SELECT, INSERT ON ...`) and Row-Level Security policies (`CREATE POLICY ...`) are separate security boundaries:
1. `ENABLE ROW LEVEL SECURITY` activates the policy engine.
2. Without policies, table access evaluates to **DEFAULT DENY** for non-superusers.
3. Policies must use `auth.uid()` as the authenticated identity boundary.
4. Client-supplied `business_id` headers or parameters must NEVER be trusted as ownership proof; ownership is resolved by joining `business_members` or `workspace_members`.

> [!IMPORTANT]
> Initial migration `20261112000001_initial_schema.sql` enables RLS on all 14 tables. Specific operational RLS policies (`CREATE POLICY`) for business and workspace access are authored in task `VO-024` with dedicated penetration tests.

---

## 6. pgTAP Testing Framework

pgTAP tests in `supabase/tests/` validate database-level guarantees directly inside PostgreSQL:
- Extension presence (`pgcrypto`).
- Table existence across all 14 canonical entities.
- Column data types (UUID PKs, `BIGINT` minor units).
- Foreign key relationship integrity.
- Active RLS status across all tables.

Run tests using:
```bash
supabase test db
```

---

## 7. Seed Data Safety & Invariants

Local seed data is stored in [`supabase/seed.sql`](file:///F:/VyaponeV2/supabase/seed.sql).
- **Local / Test Only:** Seed files are NEVER applied to remote or production environments.
- **Valid RFC 4122 v4 UUIDs:** All IDs in seed files are valid v4 UUIDs (e.g. `20000000-0000-4000-a000-000000000001`), preventing PostgreSQL UUID casting errors.
- **Zero Real PII:** All customer and staff emails use the reserved RFC 2606 `.internal` domain (e.g. `demo.admin@example.vyapone.internal`).
- **No Production Secrets:** No real API keys, payment tokens, or production hashes are permitted in seed data.

---

## 8. Cloudflare Workers Runtime Boundaries

1. **Application Runtime (PostgREST over HTTPS):**
   - Next.js Server Components, Server Actions, and Route Handlers interact with Supabase via `@supabase/ssr` over HTTPS.
   - 100% compatible with Cloudflare Workers; holds zero persistent TCP sockets open.
2. **DDL Migrations (Direct Port 5432 / Supavisor):**
   - DDL schema migrations execute in CI runners or deployment pipelines via direct PostgreSQL connections (port 5432 or session pooler).
   - Migrations NEVER run during request handling or application startup.

---

## 9. Zero-Budget ($0) Free-Tier Constraints

- **Direct Connections:** Supabase free tier provides ~60 direct connections. Schema migrations use session pooler; web runtime uses PostgREST connectionless API.
- **Storage Limits:** 500 MB database storage limit. Large media files (images, PDFs) are stored in Supabase Storage (S3-compatible buckets) with signed URLs, never as `BYTEA` in PostgreSQL tables.

---

## 10. Production Migration Approval Process

Applying migrations to production requires:
1. Automated CI verification: clean replay on a fresh PostgreSQL instance, pgTAP test pass, zero type drift.
2. Code review sign-off by Technical Lead.
3. Execution through an authorized deployment pipeline using environment secrets (`DATABASE_DIRECT_URL`).
4. Developer workstations are strictly prohibited from applying direct migrations to production.
