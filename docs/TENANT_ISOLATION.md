# VyapOne — Tenant Isolation Architecture & Enforcement [VO-024]

This document establishes the dual-layer tenant isolation specification for VyapOne, enforced across both the database engine (PostgreSQL Row-Level Security with `FORCE ROW LEVEL SECURITY`) and the API/service domain layer.

---

## 1. Ownership & Tenancy Hierarchy

VyapOne models real-world Indian multi-location commerce and agency workflows using a sovereign four-tier hierarchy:

$$\text{Platform} \longrightarrow \text{Reseller Workspace} \longrightarrow \text{Business} \longrightarrow \text{Location} \longrightarrow \text{Operational Records}$$

```
+-----------------------------------------------------------------+
|                       Platform Administrator                    |
|          (Global plans, modules, security & abuse review)       |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                   Reseller Workspace (Optional)                 |
|       (Agency operations, client onboarding, web publishing)    |
|       Tables: workspaces, workspace_members, invitations        |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                   Sovereign Business Entity                     |
|           (Independent legal business & data owner)             |
|       Anchored strictly by: businesses.sovereign_owner_id       |
|       Tables: businesses, business_members, sites               |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                    Operational Store Locations                  |
|          (Physical stores, fulfillment branches, counters)      |
|       Tables: locations                                         |
+-----------------------------------------------------------------+
                                |
                                v
+-----------------------------------------------------------------+
|                       Operational Records                       |
|       (Orders, bills, customers, catalogue, audit logs)         |
+-----------------------------------------------------------------+
```

### Sovereign Ownership Separation Invariant
In VyapOne, **a reseller workspace membership never confers sovereign business ownership**.
1. Reseller workspace members may assist client businesses with operational setup (e.g. creating storefronts, configuring catalogues, viewing analytics).
2. However, sovereign business ownership is anchored strictly to `businesses.sovereign_owner_id`.
3. Only the sovereign business owner can:
   - Delete the business.
   - Transfer sovereign ownership.
   - Manage core statutory tax records (PAN, GSTIN) and legal company identity.
4. If a client separates from a reseller agency, business records remain intact and sovereign data ownership is preserved.

---

## 2. Dual-Layer Isolation Architecture

Tenant isolation is enforced through two mandatory layers of defense:

1. **Database Layer (PostgreSQL Row-Level Security)**:
   - All tenant-owned tables have `ENABLE ROW LEVEL SECURITY` and `FORCE ROW LEVEL SECURITY`.
   - `FORCE ROW LEVEL SECURITY` guarantees that table owners (non-superusers) are strictly subject to RLS policies.
   - All 15 tenant tables implement explicit fail-closed `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies (60 policies total).
   - Zero permissive `USING (true)` policies exist on tenant data.
   - Immutable tables (`audit_logs`, `orders`, `bills`, `invoice_sequences`) enforce `USING (false)` on forbidden mutation operations.

2. **API & Service Layer (Centralized Authorization)**:
   - Server Actions and services never trust tenant identifiers (`business_id`, `workspace_id`, `location_id`) or user roles supplied by client request payloads or URL parameters.
   - Caller identity is derived strictly from the authenticated server session (`supabase.auth.getUser()`).
   - Authorization is asserted using centralized helpers (`assertBusinessAccess`, `assertWorkspaceAccess`, `assertSovereignOwner`).
   - Unauthorized requests fail closed with `404 NOT_FOUND` (anti-enumeration) or `403 FORBIDDEN`.

---

## 3. Database RLS Helper Functions

To prevent infinite policy recursion in PostgreSQL (which occurs when a policy on `workspace_members` queries `workspace_members`), VyapOne uses hardened `SECURITY DEFINER` helper functions defined with `SET search_path = ''`:

| Function | Return Type | Purpose | Recursion Guard |
| :--- | :--- | :--- | :--- |
| `public.is_workspace_member(UUID, UUID)` | `BOOLEAN` | Checks active membership in `workspace_members` | `SECURITY DEFINER SET search_path = ''` |
| `public.is_workspace_admin_or_owner(UUID, UUID)` | `BOOLEAN` | Checks workspace owner or admin role | `SECURITY DEFINER SET search_path = ''` |
| `public.is_business_sovereign_owner(UUID, UUID)` | `BOOLEAN` | Evaluates `businesses.sovereign_owner_id` | `SECURITY DEFINER SET search_path = ''` |
| `public.is_business_member(UUID, UUID)` | `BOOLEAN` | Checks sovereign owner or active business member | `SECURITY DEFINER SET search_path = ''` |
| `public.is_business_owner_or_manager(UUID, UUID)` | `BOOLEAN` | Checks business owner or manager rank | `SECURITY DEFINER SET search_path = ''` |
| `public.can_access_business(UUID, UUID)` | `BOOLEAN` | Checks sovereign owner, member, or assigned workspace | `SECURITY DEFINER SET search_path = ''` |
| `public.can_manage_business(UUID, UUID)` | `BOOLEAN` | Checks sovereign owner, manager, or workspace admin | `SECURITY DEFINER SET search_path = ''` |
| `public.can_access_location(UUID, UUID)` | `BOOLEAN` | Enforces staff location scoping | `SECURITY DEFINER SET search_path = ''` |

All helper functions have `REVOKE EXECUTE ... FROM PUBLIC` and explicit grants to `authenticated, anon`. Anonymous queries safely fail closed (return `false`).

---

## 4. Protected Tables & Policy Inventory

| Table | SELECT Policy | INSERT Policy | UPDATE Policy | DELETE Policy |
| :--- | :--- | :--- | :--- | :--- |
| `public.users` | Self or shared workspace/business colleagues | Self `id = auth.uid()` | Self `id = auth.uid()` | Self `id = auth.uid()` |
| `public.user_auth_identities` | Self `user_id = auth.uid()` | Self `user_id = auth.uid()` | Self `user_id = auth.uid()` | Self `user_id = auth.uid()` |
| `public.workspaces` | Workspace owner or active member | Owner `owner_user_id = auth.uid()` | Workspace admin or owner | Workspace creator only |
| `public.workspace_members` | Fellow workspace members | Workspace admin or owner | Workspace admin or owner | Admin removal or self departure |
| `public.workspace_invitations` | Workspace admin or invitee email | Workspace admin with `invited_by = auth.uid()` | Workspace admin or invitee | Workspace admin |
| `public.businesses` | Sovereign owner, member, or assigned workspace | Sovereign owner (+ admin if workspace assigned) | Sovereign owner or business manager/owner | Sovereign owner strictly (`auth.uid()`) |
| `public.locations` | Business team or assigned workspace | Business manager or owner | Business manager or owner | Sovereign owner |
| `public.business_members` | Fellow business members or workspace admin | Business manager or owner | Business manager or owner | Manager removal or self departure |
| `public.sites` | Published storefront (public) or business team | Business manager or owner | Business manager or owner | Sovereign owner |
| `public.catalogue_items` | Available items (public) or business team | Authorized business team (+ location check) | Authorized business team (+ location check) | Business manager or owner |
| `public.customers` | Business team | Authenticated staff or checkout | Authorized business team | Business manager or owner |
| `public.orders` | Authorized team (+ location scoping) | Authorized team (+ location scoping) | Authorized team (+ location scoping) | Forbidden (`USING (false)`) |
| `public.invoice_sequences` | Business team | Business manager or owner | Scoped strictly to business | Forbidden (`USING (false)`) |
| `public.bills` | Authorized team (+ location scoping) | Authorized team (+ location scoping) | Scoped strictly to business & location | Forbidden (`USING (false)`) |
| `public.audit_logs` | Business owner/manager or workspace admin | Authenticated caller (`user_id = auth.uid()`) | Forbidden (`USING (false)`) | Forbidden (`USING (false)`) |

---

## 5. Centralized API Authorization Helpers

Defined in `src/lib/auth/tenant-access.ts`:

- `assertAuthenticatedUser(supabase)`: Verifies active session via `supabase.auth.getUser()`. Throws `TenantAccessError("Authentication required", "UNAUTHENTICATED", 401)`.
- `assertWorkspaceAccess(supabase, workspaceId, options)`: Validates workspace existence and caller's active membership. Returns `404 NOT_FOUND` for non-members to prevent tenant enumeration.
- `assertBusinessAccess(supabase, businessId, options)`: Evaluates sovereign ownership, operational membership, and workspace delegation. Enforces location scoping when `requiredLocationId` is specified.
- `assertSovereignOwner(supabase, businessId)`: Rejects reseller admins and operational managers; strictly validates caller equals `businesses.sovereign_owner_id`.
- `assertRecordBelongsToBusiness(recordBusinessId, expectedBusinessId)`: Rejects moving records across tenants (`CROSS_TENANT_VIOLATION`, 403).
- `assertLocationBelongsToBusiness(supabase, businessId, locationId)`: Verifies location ownership. Throws 404 on cross-tenant location references.
- `sanitizeTenantError(error)`: Masks internal database error details before returning responses to the browser.

---

## 6. Automated Cross-Tenant Attack Verification

Automated integration tests in `tests/integration/cross-tenant-isolation.test.ts` verify 12 cross-tenant attack vectors:

1. **Scenario 1 (Cross-User Business Read)**: User A cannot read User B's private business; returns `404 NOT_FOUND`.
2. **Scenario 2 (Cross-Workspace Read)**: Workspace A member cannot access Workspace B records; returns `404 NOT_FOUND`.
3. **Scenario 3 (Foreign Business via Workspace)**: Workspace admin cannot access businesses assigned to other workspaces or independent DIY businesses.
4. **Scenario 4 (Sovereign Ownership Separation)**: Reseller workspace membership alone does NOT confer sovereign ownership; sovereign actions reject reseller admins.
5. **Scenario 5 (Cross-Business Member Access)**: Business A member cannot access Business B records.
6. **Scenario 6 (Location Scoping)**: Operational staff assigned to Location A cannot access Location B records (`LOCATION_RESTRICTED`, 403); managers retain multi-location access.
7. **Scenario 7 (Moving Records Across Tenants)**: Modifying `business_id` or referencing foreign `location_id` in member creation is rejected.
8. **Scenario 8 (ID/UUID Guessing)**: Attacker guessing valid UUIDs of another tenant is rejected with `NOT_FOUND` / `FORBIDDEN`.
9. **Scenario 9 (Unauthenticated Access)**: Unauthenticated requests are rejected immediately (`UNAUTHENTICATED`, 401).
10. **Scenario 10 (Invalid Invitations)**: Expired, revoked, or pending invitations cannot grant active access (`NOT_FOUND`, 404).
11. **Scenario 11 (Deactivated/Removed Members)**: Removed members immediately lose access on subsequent requests (`NOT_FOUND`, 404).
12. **Scenario 12 (Privilege Escalation in Payloads)**: Submitting higher roles in request payloads (e.g. manager promoting to owner) is blocked by downward authority enforcement.

---

## 7. Migration Details

- **Migration File**: `supabase/migrations/20261113000002_enforce_tenant_isolation.sql`
- **Helper Functions Created**: 8 functions (`is_workspace_member`, `is_workspace_admin_or_owner`, `is_business_sovereign_owner`, `is_business_member`, `is_business_owner_or_manager`, `can_access_business`, `can_manage_business`, `can_access_location`).
- **Tables Protected with FORCE RLS**: 15 tables.
- **Policies Defined**: 60 explicit policies.
- **Supporting Indexes Created**: 7 composite lookup indexes (`idx_business_members_lookup`, `idx_workspace_members_lookup`, `idx_businesses_owner_ws`, `idx_locations_business_lookup`, `idx_orders_business_location`, `idx_bills_business_location`, `idx_catalogue_items_business_location`).

---

## 8. Known Limitations & Verification Status

- **Static & Integration Tests**: 483 automated tests passed across 44 test files with 100% test pass rate.
- **Live PostgreSQL Verification**: Because Docker is not installed on the local Windows workstation, live PostgreSQL container execution (`supabase test db`) remains pending environment availability. Full schema, migration AST, and RLS structure are validated via static migration tests and TypeScript integration mock suites.
