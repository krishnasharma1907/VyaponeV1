# VyapOne — Business and Location Core Architecture

**Document Version:** 1.0.0  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§4, §7, §8, §9, §15, §16, §17, §23)  
**Related Task:** `VO-023`  
**Related ADRs:** ADR-002, ADR-003, ADR-021  

---

## 1. Tenancy Architecture & Sovereign Ownership Model

VyapOne enforces a four-level tenancy hierarchy engineered to guarantee sovereign merchant data ownership while enabling high-efficiency reseller agency and DIY operations:

```
Platform (Global Governance, Plans, Tax Slabs, Abuse Suspension)
   └── Reseller Workspace (Agency Management Scope, Split Payouts, Slotted Capacity)
         └── Business (Sovereign Merchant Entity — sovereign_owner_id)
               └── Location (Physical Storefront / Fulfillment Point)
                     └── Modules & Records (Catalogue, Orders, Invoices, Customers)
```

### Sovereign Ownership Invariants
1. **The Business is the Sovereign Data Entity:** Customer records, WhatsApp consent, bills, sequential invoices, catalogue items, and orders belong 100% to the Business tenant, anchored by `public.businesses.sovereign_owner_id`.
2. **Workspace Administration Does Not Confer Sovereign Ownership:**
   - A `workspace_owner` or `workspace_admin` holds administrative tooling to create client businesses, publish websites, and view usage under their reseller contract.
   - However, holding a `workspace_members` role does **never** confer sovereign ownership (`sovereign_owner_id`) or operational business membership (`business_members`) over client merchant data.
3. **Client-Supplied Ownership is Untrusted:**
   - Server Actions and database functions derive identity strictly through verified Supabase Auth session tokens (`auth.uid()`).
   - Browser-supplied `sovereign_owner_id` parameters are rejected to prevent identity hijacking and privilege escalation.
4. **Data Survives Agency Departure:**
   - In the event of reseller departure, contract termination, or client handover, the business retains all operational history, GST invoices, and customer khata records intact.

---

## 2. Business Creation & Workspace Relationships

VyapOne natively supports two core commercial flows:

### A. DIY Business Flow (Independent Merchant)
- A merchant directly registers with VyapOne without an agency or reseller intermediary.
- The business is created with `workspace_id = NULL`, establishing a sovereign direct business entity.
- The authenticated creator becomes both `sovereign_owner_id` and the initial `owner` in `public.business_members`.
- Database support: Migration `20261113000001_business_location_core.sql` drops the `NOT NULL` constraint on `public.businesses.workspace_id`.

### B. Reseller-Managed Business Flow (Agency Provisioning)
- A reseller agency provisions a digital business system for a merchant client.
- The business is created with `workspace_id = <reseller_workspace_id>`.
- The caller must hold an active `workspace_owner`, `workspace_admin`, or `reseller_admin` role within that workspace.
- The reseller acts as an administrative custodian during setup and onboarding. When client onboarding is complete, the client owner is formally linked as sovereign owner and invited as `business_owner`.
- Agency members without business roles cannot access day-to-day merchant khata or customer records without explicit authorization.

---

## 3. Primary Location Core & Scope Boundaries

### Primary Location Invariant
- Every business operates from at least one physical or operational storefront.
- When a business is created, its primary location (`locations` record with `is_primary = true`) is generated atomically alongside the business.
- Invariant enforcement: Migration `20261113000001_business_location_core.sql` adds a partial unique index:
  ```sql
  CREATE UNIQUE INDEX idx_locations_primary_per_business
      ON public.locations (business_id)
      WHERE is_primary = true;
  ```
  This guarantees at the PostgreSQL engine level that a business cannot have more than one primary location at any time.

### Multi-Location Scope Boundaries
- **In-Scope for VO-023:** Core primary location creation, retrieval, profile editing, and setting the active primary location.
- **Deferred to Later Phases:** Advanced multi-location features (cross-location inventory transfers, per-location staff shifts, multi-branch POS routing, and distributed billing) are reserved for Phase P8/P11 and are not implemented here.

---

## 4. Business Roles & Operational Membership

Business operational roles in `public.business_members` are completely distinct from reseller workspace roles:

| Business Role | Rank | Description | Permissions |
| :--- | :---: | :--- | :--- |
| `owner` | 40 | Sovereign business owner or legal proprietor. Full authority over profile, statutory GST, locations, staff access, and business deletion. | All permissions (`business:*`) |
| `manager` | 30 | Store manager / operations lead. Can manage catalogue, orders, locations, and cashier/staff roles. | Profile, locations, members, billing, reports |
| `cashier` | 20 | POS counter operator. Handles billing, payments, and customer registration. | View, billing |
| `staff` | 10 | General operational worker (kitchen, delivery dispatch, appointment attendee). | View assigned orders/tasks |

### Role Hierarchy & Last-Owner Protection
1. **Downward Authority:** An actor can only manage or invite members with a strictly lower role rank (`actorRank > targetRank`).
2. **Escalation Prevention:** Managers cannot create or promote other managers or owners.
3. **Last-Owner Protection:** A business must retain at least one active `owner`. Any attempt to demote, deactivate, or delete the sole remaining owner is rejected with `LAST_OWNER_PROTECTION` (status 400).

---

## 5. Input Validation & Regulatory Standards

All inputs are validated server-side using strict Zod schemas in `src/lib/businesses/schemas.ts`:

- **Business Slug:** Lowercase alphanumeric words separated by single hyphens (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, 3–60 chars).
- **Location Slug:** Alphanumeric hyphenated slug (`^[a-z0-9]+(?:-[a-z0-9]+)*$`, 2–60 chars).
- **Postal Code:** Validated against 6-digit Indian PIN code format (`^\d{6}$`).
- **GSTIN:** Validated against statutory 15-character alphanumeric format (`^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`).
- **PAN:** Validated against 10-character Indian tax identifier format (`^[A-Z]{5}[0-9]{4}[A-Z]{1}$`).
- **Sanitized Errors:** Error messages are mapped to user-safe strings to prevent leaking database structure or internal exceptions.

---

## 6. Database Migrations & Search Path Hardening

### Migration `20261113000001_business_location_core.sql`
1. **Nullable Workspace:** `ALTER TABLE public.businesses ALTER COLUMN workspace_id DROP NOT NULL;`
2. **Primary Location Invariant:** `CREATE UNIQUE INDEX idx_locations_primary_per_business ON public.locations (business_id) WHERE is_primary = true;`
3. **Atomic Bootstrap Stored Procedure:**
   `public.create_business_with_primary_location(...)`
   - Hardened with `SECURITY DEFINER SET search_path = ''`.
   - Uses fully qualified schema references (`auth.uid()`, `public.businesses`, `public.locations`, `public.business_members`, `public.audit_logs`, `pg_catalog.jsonb_build_object`).
   - Executes inside a single transaction: rolls back completely if any step fails.
   - Restricts execution rights strictly to `authenticated` users (`REVOKE FROM PUBLIC; GRANT TO authenticated;`).

---

## 7. Audit Logging

Security-sensitive lifecycle events are recorded in append-only `public.audit_logs`:

| Action | Resource | Triggered When | Metadata Recorded |
| :--- | :--- | :--- | :--- |
| `business.created` | `businesses` | New business and primary location established | `trade_name`, `slug`, `primary_location_id`, `workspace_id` |
| `business.profile_updated` | `businesses` | Trade name, legal name, GSTIN, PAN, or status modified | `updated_fields` |
| `location.created` | `locations` | Additional storefront or branch added | `location_id`, `name`, `is_primary` |
| `location.updated` | `locations` | Location details or primary status changed | `location_id`, `updated_fields` |
| `business_member.added` | `business_members` | New operational staff added | `added_user_id`, `role` |
| `business_member.role_changed` | `business_members` | Staff role promoted, demoted, or deactivated | `target_user_id`, `previous_role`, `new_role`, `status` |
| `business_member.removed` | `business_members` | Member removed from business | `removed_user_id`, `role` |

---

## 8. UI Primitives & Responsive Layout

The business domain primitives in `src/components/businesses/` adhere to WCAG 2.2 AA and mobile-first responsive constraints:

- [`BusinessCreateForm`](file:///F:/VyaponeV2/src/components/businesses/business-create-form.tsx): Mobile-first form (tested at 390px) for establishing store identity and primary location in a single pass.
- [`BusinessProfileForm`](file:///F:/VyaponeV2/src/components/businesses/business-profile-form.tsx): Statutory editor for legal trade name, GSTIN, PAN, and status.
- [`LocationCard`](file:///F:/VyaponeV2/src/components/businesses/location-card.tsx): Card component displaying location address, primary store badge, and edit triggers.
- [`LocationForm`](file:///F:/VyaponeV2/src/components/businesses/location-form.tsx): Form for adding and updating storefront addresses with primary location toggle.
- [`BusinessSwitcher`](file:///F:/VyaponeV2/src/components/businesses/business-switcher.tsx): Accessible dropdown selector with keyboard navigation (`Enter`, `Space`) and role badges.

---

## 9. Quality Gates & Local Verification Status

- **Static Validation:** All SQL statements, constraint definitions, search_path restrictions, and indexes are statically validated.
- **Local PostgreSQL Execution:** Docker/Podman is not installed on this Windows workstation. As mandated by project protocol, database execution is recorded as **NOT EXECUTED LOCALLY**; full verification is performed via comprehensive unit tests and mocked integration suites.
- **Quality Gates:**
  - `pnpm format:check`: Clean Prettier formatting across all files.
  - `pnpm lint`: 0 ESLint errors and 0 warnings.
  - `pnpm typecheck`: 0 TypeScript compilation errors in strict mode.
  - Vitest test suites: 100% pass rate.
