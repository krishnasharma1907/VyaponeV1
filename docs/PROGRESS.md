# VyapOne Build Progress

**Current phase:** P2 — Platform identity, authentication and multi-tenancy (`IN_PROGRESS`)  
**Completed tasks:** VO-000, VO-001, VO-002, VO-003, VO-004, VO-005, VO-006, VO-010, VO-011, VO-012, VO-013, VO-014, VO-015, VO-016, VO-017, VO-018, VO-019, VO-020, VO-021, VO-022, VO-023, VO-024  
**Next task:** VO-025 — Implement business profile settings  
**Project status:** DUAL-LAYER TENANT ISOLATION ENFORCED & VERIFIED / IN PHASE P2  

## Phase status

| Phase | Status | Notes |
|---|---|---|
| P0 — Project audit, decisions and architecture | COMPLETE | All tasks VO-000 to VO-006 verified and done; Phase P0 gate passed |
| P1 — Repository, design system and application shell | COMPLETE | All tasks VO-010 to VO-019 verified and done; Phase P1 gate passed |
| P2 — Platform identity, authentication and multi-tenancy | IN_PROGRESS | VO-020, VO-021, VO-022, VO-023, and VO-024 done; VO-025 is next |

## Task report: VO-024

- **Task ID:** VO-024
- **Title:** Enforce tenant isolation at database and API layers
- **Status:** DONE
- **Summary:** Implemented comprehensive, dual-layer tenant isolation enforced both at the database layer (PostgreSQL Row-Level Security with `FORCE ROW LEVEL SECURITY`) and at the server/API layer according to PRD FINAL v2 (§4, §15.2, §16, §17):
  1. **Dual-Layer Multi-Tenant Architecture:**
     - Enforced sovereign hierarchy: `Platform → Reseller Workspace → Business → Location → Operational Records`.
     - Invariant: Workspace membership (`public.workspace_members`) never confers sovereign business ownership (`public.businesses.sovereign_owner_id`).
  2. **PostgreSQL RLS Hardening (`20261113000002_enforce_tenant_isolation.sql`):**
     - Enforced `ALTER TABLE ... FORCE ROW LEVEL SECURITY;` across all 15 tenant tables (`users`, `user_auth_identities`, `workspaces`, `workspace_members`, `workspace_invitations`, `businesses`, `locations`, `business_members`, `sites`, `catalogue_items`, `customers`, `orders`, `invoice_sequences`, `bills`, `audit_logs`).
     - Created 8 hardened `SECURITY DEFINER` helper functions with explicit `SET search_path = ''` to prevent infinite policy recursion (`is_workspace_member`, `is_workspace_admin_or_owner`, `is_business_sovereign_owner`, `is_business_member`, `is_business_owner_or_manager`, `can_access_business`, `can_manage_business`, `can_access_location`).
     - Defined 60 explicit fail-closed policies covering `SELECT`, `INSERT`, `UPDATE`, and `DELETE` on all 15 tables.
     - Implemented append-only and immutable table guardrails (`audit_logs`, `orders`, `bills`, `invoice_sequences` prohibit deletion via `USING (false)`).
     - Restricted business deletion strictly to sovereign owner (`sovereign_owner_id = auth.uid()`).
     - Added 7 composite performance indexes for policy lookup paths.
  3. **Centralized Server Authorization Domain (`src/lib/auth/tenant-access.ts`):**
     - Implemented `assertAuthenticatedUser`, `assertWorkspaceAccess`, `assertBusinessAccess`, `assertSovereignOwner`, `assertRecordBelongsToBusiness`, `assertLocationBelongsToBusiness`, and `sanitizeTenantError`.
     - Derives caller identity strictly from authenticated server session (`supabase.auth.getUser()`).
     - Rejects unauthorized requests with sanitized anti-enumeration `404 NOT_FOUND` or `403 FORBIDDEN` errors.
     - Enforces operational location scoping: staff assigned to a location cannot access or mutate foreign locations.
  4. **Cross-Tenant Attack Verification Suite:**
     - Verified 12 cross-tenant attack vectors in `tests/integration/cross-tenant-isolation.test.ts`.
     - Verified RLS policies, helper functions, and FORCE RLS in `tests/unit/database/migration-isolation.test.ts`.
     - Verified authorization helpers in `tests/unit/security/tenant-isolation.test.ts`.
     - All 483 tests pass across 44 test files with 100% pass rate.
     - Code coverage meets all required thresholds: Statements 85.08%, Branches 70.09%, Lines 85.08%, Functions 88.89%.
  5. **Documentation:**
     - Created `docs/TENANT_ISOLATION.md` documenting ownership hierarchy, RLS policy inventory, authorization helper design, and attack verification.
- **Files added/modified:**
  - Added: `supabase/migrations/20261113000002_enforce_tenant_isolation.sql`
  - Added: `src/lib/auth/tenant-access.ts`
  - Added: `src/lib/auth/index.ts`
  - Added: `docs/TENANT_ISOLATION.md`
  - Added: `tests/unit/database/migration-isolation.test.ts`
  - Added: `tests/unit/security/tenant-isolation.test.ts`
  - Added: `tests/integration/cross-tenant-isolation.test.ts`
  - Modified: `src/lib/supabase/types.ts`
  - Modified: `src/lib/businesses/service.ts`
  - Modified: `src/lib/businesses/actions.ts`
  - Modified: `tests/unit/businesses/service.test.ts`
  - Modified: `tests/unit/businesses/actions.test.ts`
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Verification Commands & Results:**
  - `pnpm format:check` -> Exit code 0 (All files formatted cleanly)
  - `pnpm lint` -> Exit code 0 (0 warnings, 0 errors)
  - `pnpm typecheck` -> Exit code 0 (0 type errors)
  - `pnpm test` -> Exit code 0 (483 tests passed across 44 test files)
  - `pnpm test:coverage` -> Exit code 0 (Statements: 85.08%, Branches: 70.09%, Lines: 85.08%, Functions: 88.89%)
  - `pnpm build` -> Exit code 0 (Compiled Next.js production build cleanly)

## Task report: VO-023

- **Task ID:** VO-023
- **Status:** DONE
- **Summary:** Implemented sovereign business entity and primary store location core according to canonical PRD FINAL v2 (§4, §7, §8, §9, §15, §16, §17):
  1. **Sovereign Business Ownership Boundary:**
     - Enforced sovereign merchant ownership (`sovereign_owner_id`) anchored strictly to the authenticated merchant user.
     - Supported both DIY businesses (`workspace_id IS NULL`) and Reseller-managed businesses (`workspace_id` present, but sovereign data ownership anchored to merchant).
     - Separated agency reseller workspace operations (`public.workspace_members`) from sovereign business data ownership.
  2. **Primary Location Invariant:**
     - Enforced invariant that each business must have exactly one primary location (`is_primary = true`).
     - Backed by partial PostgreSQL unique index `idx_locations_primary_per_business ON public.locations (business_id) WHERE is_primary = true`.
     - When a new or updated location is designated as primary, other business locations are automatically unset atomically.
  3. **Operational Business Roles & Last-Owner Protection (`src/lib/businesses/permissions.ts`):**
     - Defined business operational role hierarchy: `owner` (rank 40) > `manager` (rank 30) > `cashier` (rank 20) > `staff` (rank 10) in `public.business_members`.
     - Completely separated from reseller workspace roles.
     - Implemented Last-Owner Protection: Prohibits demoting, removing, or deactivating the sole remaining `owner` of a business.
  4. **Business & Location Service Layer (`src/lib/businesses/service.ts`):**
     - Implemented `createBusiness()`, `getBusiness()`, `getUserBusinesses()`, `updateBusinessProfile()`, `createLocation()`, `updateLocation()`, `getBusinessLocations()`, `getBusinessMembers()`, `addBusinessMember()`, `updateBusinessMemberRole()`, and `removeBusinessMember()`.
     - Atomic creation of business, primary location, owner membership record, and audit log.
     - Immutable audit trail generation (`business.created`, `business.profile_updated`, `location.created`, `location.updated`, `business.member_added`, `business.member_role_updated`, `business.member_removed`).
  5. **Next.js Server Actions (`src/lib/businesses/actions.ts`):**
     - Implemented `"use server"` actions with structured results (`BusinessActionResult<T>`): `createBusinessAction`, `updateBusinessProfileAction`, `createLocationAction`, `updateLocationAction`, `addBusinessMemberAction`, `updateBusinessMemberRoleAction`, `removeBusinessMemberAction`.
     - Automatic `revalidatePath` across `/dashboard`, `/dashboard/settings`, and `/workspace/clients`.
  6. **Accessible Mobile-First UI Components (`src/components/businesses/`):**
     - Built `BusinessCreateForm`: Comprehensive store onboarding form capturing name, handle/slug, category, legal entity, tax ID (GSTIN), and primary store address.
     - Built `BusinessProfileForm`: Settings management form for store identity and operational configuration.
     - Built `LocationCard`: Address and contact display card with primary store location badge.
     - Built `LocationForm`: Modal/inline form for adding and updating location records.
     - Built `BusinessSwitcher`: Dropdown selector with active business badges, category tags, and creation trigger.
  7. **Database Migration (`supabase/migrations/20261113000001_business_location_core.sql`):**
     - Made `public.businesses.workspace_id` nullable to natively support direct DIY merchant onboarding.
     - Added partial unique index `idx_locations_primary_per_business`.
     - Created atomic RPC `public.create_business_with_primary_location(...)` with `SECURITY DEFINER SET search_path = ''` using fully qualified schema references.
  8. **Comprehensive Testing & Quality Gates:**
     - Added 85 passing tests across 7 test files in `tests/unit/businesses/` and `tests/integration/` (permissions, schemas, service, actions, components, migration, integration lifecycle).
     - Full Vitest suite contains 41 test files, 425 passing tests with 100% pass rate.
     - Formatter (`pnpm format:check`), linter (`pnpm lint`), and TypeScript typechecker (`pnpm typecheck`) all clean with 0 errors.
     - Next.js production build (`pnpm build`) compiled 34 static and dynamic routes cleanly.
  9. **Architecture Documentation:**
     - Created `docs/BUSINESSES_AND_LOCATIONS.md` documenting business hierarchy, ownership models, primary location invariants, operational roles, and component APIs.
- **Files added/modified:**
  - Added: `supabase/migrations/20261113000001_business_location_core.sql`
  - Added: `docs/BUSINESSES_AND_LOCATIONS.md`
  - Added: `src/lib/businesses/types.ts`
  - Added: `src/lib/businesses/permissions.ts`
  - Added: `src/lib/businesses/schemas.ts`
  - Added: `src/lib/businesses/service.ts`
  - Added: `src/lib/businesses/actions.ts`
  - Added: `src/lib/businesses/index.ts`
  - Added: `src/components/businesses/business-create-form.tsx`
  - Added: `src/components/businesses/business-profile-form.tsx`
  - Added: `src/components/businesses/location-card.tsx`
  - Added: `src/components/businesses/location-form.tsx`
  - Added: `src/components/businesses/business-switcher.tsx`
  - Added: `src/components/businesses/index.ts`
  - Added: `tests/unit/businesses/permissions.test.ts`
  - Added: `tests/unit/businesses/schemas.test.ts`
  - Added: `tests/unit/businesses/service.test.ts`
  - Added: `tests/unit/businesses/actions.test.ts`
  - Added: `tests/unit/businesses/components.test.tsx`
  - Added: `tests/unit/businesses/migration.test.ts`
  - Added: `tests/integration/business-lifecycle.test.ts`
  - Modified: `src/app/(owner)/dashboard/settings/page.tsx`
  - Modified: `src/lib/supabase/types.ts`
  - Modified: `tests/factories/businesses.ts`
  - Modified: `vitest.config.ts`
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`

## Task report: VO-022

- **Task ID:** VO-022
- **Status:** DONE
- **Summary:** Implemented workspace creation, multi-tiered membership roles, cryptographic invitations, and role-based permissions for reseller agency and DIY workspaces:
  1. **Workspace Management Service (`src/lib/workspaces/service.ts`):**
     - Implemented `createWorkspace()`, `getUserWorkspaces()`, `getWorkspace()`, `updateWorkspaceProfile()`, `inviteWorkspaceMember()`, `acceptWorkspaceInvitation()`, `updateMemberRole()`, `removeMember()`, and `leaveWorkspace()`.
     - Automatically creates workspace and initial `workspace_owner` membership record in a single transaction/flow.
     - Strictly enforces **Last-Owner Protection**: Prohibits demoting or removing the sole remaining owner of a workspace.
     - Writes immutable audit events for all sensitive lifecycle actions (`workspace.created`, `workspace.profile_updated`, `workspace.member_invited`, `workspace.invitation_accepted`, `workspace.member_role_changed`, `workspace.member_removed`, `workspace.member_left`).
  2. **Hierarchical Roles & Sovereign Ownership Boundary (`src/lib/workspaces/permissions.ts`):**
     - Defined explicit role hierarchy: `workspace_owner` (rank 30) > `workspace_admin` / `reseller_admin` (rank 20) > `workspace_member` / `reseller_staff` (rank 10).
     - Centralized permission evaluation via `hasWorkspacePermission()`, `canManageTargetRole()`, and `canAssignRole()`.
     - Architecturally enforced the **Sovereign Business Ownership Boundary Invariant**: Workspace administrative access (`public.workspace_members`) does **not** confer sovereign business data rights (`public.businesses.sovereign_owner_id`), strictly separating agency reseller operations from merchant data sovereignty.
  3. **Cryptographically Secure Invitation Lifecycle (`src/lib/workspaces/tokens.ts`):**
     - Generates 32-byte cryptographically random hex tokens (`crypto.getRandomValues`) delivered to recipients.
     - Computes deterministic SHA-256 digests (`crypto.subtle.digest`) for storage in `public.workspace_invitations.token_hash`. Zero plaintext tokens leaked into database or audit logs.
     - Strict 7-day expiration and single-use invalidation (`status = 'accepted'`).
     - Rejects unauthorized email claims by verifying that accepting authenticated user matches invitation recipient.
  4. **Authenticated Next.js Server Actions (`src/lib/workspaces/actions.ts`):**
     - Implemented `"use server"` actions with structured results (`WorkspaceActionResult<T>`): `createWorkspaceAction`, `updateWorkspaceProfileAction`, `inviteWorkspaceMemberAction`, `acceptWorkspaceInvitationAction`, `updateMemberRoleAction`, `removeMemberAction`, `leaveWorkspaceAction`.
     - Integrated `revalidatePath` across workspace route shells (`/workspace`, `/workspace/team`, `/workspace/settings`).
  5. **Accessible Mobile-First UI Primitives (`src/components/workspaces/`):**
     - Built `WorkspaceSwitcher`: Dropdown selector with active workspace badges and creation trigger.
     - Built `WorkspaceTeamTable`: Team member roster with role badges, role update dropdowns, remove actions, and accessibility labels.
     - Built `WorkspaceSettingsForm`: Workspace name and slug management with owner-only editing protections.
     - Built `WorkspaceInviteModal`: Accessible WAI-ARIA modal dialog for sending member invitations and displaying one-time invitation links.
  6. **Forward-Only Database Migration (`supabase/migrations/20261112000003_secure_search_path_and_workspace_roles.sql`):**
     - Hardened PostgreSQL `handle_new_auth_user()` trigger function with `SECURITY DEFINER SET search_path = ''` using fully qualified `pg_catalog.*` and `public.*` schema references to neutralize search path hijacking.
     - Expanded `workspace_members_role_check` constraint to support canonical and reseller aliases: `('workspace_owner', 'workspace_admin', 'workspace_member', 'reseller_admin', 'reseller_staff')`.
     - Created `public.workspace_invitations` table with UUID PK, foreign keys, status checks, index on `token_hash`, and enabled Row-Level Security (`ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY`).
  7. **Comprehensive Unit Testing & Verification:**
     - Added 78 passing unit tests across 7 test files in `tests/unit/workspaces/` (permissions, tokens, schemas, service, actions, migration, components).
     - Full Vitest suite contains 34 test files, 340 passing tests with 100% pass rate.
     - Test coverage satisfies all quality gate thresholds: Statements 85.53% (target >= 85%), Branches 72.15% (target >= 70%), Functions 84.45% (target >= 80%), Lines 85.53% (target >= 85%).
     - Formatter (`pnpm format:check`), linter (`pnpm lint`), and TypeScript typechecker (`pnpm typecheck`) all clean with 0 errors.
     - Next.js production build (`pnpm build`) compiled 34 static and dynamic routes cleanly.
  8. **Architecture Documentation:**
     - Created `docs/WORKSPACES_AND_MEMBERSHIPS.md` documenting hierarchy, invariant proofs, token security, and component architecture.
- **Files added/modified:**
  - Added: `supabase/migrations/20261112000003_secure_search_path_and_workspace_roles.sql`
  - Added: `src/lib/workspaces/types.ts`
  - Added: `src/lib/workspaces/permissions.ts`
  - Added: `src/lib/workspaces/schemas.ts`
  - Added: `src/lib/workspaces/tokens.ts`
  - Added: `src/lib/workspaces/service.ts`
  - Added: `src/lib/workspaces/actions.ts`
  - Added: `src/lib/workspaces/index.ts`
  - Added: `src/components/workspaces/workspace-switcher.tsx`
  - Added: `src/components/workspaces/workspace-team-table.tsx`
  - Added: `src/components/workspaces/workspace-settings-form.tsx`
  - Added: `src/components/workspaces/workspace-invite-modal.tsx`
  - Added: `src/components/workspaces/index.ts`
  - Added: `docs/WORKSPACES_AND_MEMBERSHIPS.md`
  - Added: `tests/unit/workspaces/permissions.test.ts`
  - Added: `tests/unit/workspaces/tokens.test.ts`
  - Added: `tests/unit/workspaces/schemas.test.ts`
  - Added: `tests/unit/workspaces/service.test.ts`
  - Added: `tests/unit/workspaces/actions.test.ts`
  - Added: `tests/unit/workspaces/migration.test.ts`
  - Added: `tests/unit/workspaces/components.test.tsx`
  - Modified: `src/lib/supabase/types.ts`
  - Modified: `tests/factories/workspaces.ts`
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`

## Task report: VO-021

- **Task ID:** VO-021
- **Status:** DONE
- **Summary:** Implemented the complete authentication and account lifecycle for the Supabase-based VyapOne application:
  1. **Dual Multi-Modal Sign-In & Registration UI Primitives:**
     - Created `src/components/auth/login-form.tsx` featuring tabbed authentication (India-primary Mobile SMS OTP and Email/Password), accessible WAI-ARIA tabs, live validation error feedback, and step-by-step OTP verification.
     - Created `src/components/auth/register-form.tsx` for merchant and reseller agency onboarding with account type selection (`owner`, `reseller`), business naming, email, normalized phone, and password inputs.
     - Created `src/components/auth/forgot-password-form.tsx` and `src/components/auth/update-password-form.tsx` for end-to-end password recovery.
     - Created `src/app/(auth)/verify-email/page.tsx` for email verification feedback.
  2. **Next.js Server Actions ("use server"):**
     - Implemented `signUpAction`, `signInWithPasswordAction`, `requestPhoneOtpAction`, `verifyPhoneOtpAction`, `requestPasswordResetAction`, `updatePasswordAction`, and `signOutAction` in `src/lib/auth/actions.ts`.
     - Standardized on structured result objects (`AuthActionResult`) with user-safe error mapping to prevent information disclosure.
  3. **Security Invariants & Utilities (`src/lib/auth/security.ts`):**
     - Open Redirect Protection: `isValidInternalRedirect()` strictly allows safe relative paths and rejects external schemes, protocol-relative paths (`//evil.com`), Windows backslash evasions (`/\evil.com`), and control characters.
     - Indian Mobile Normalization: `normalizePhoneNumber()` converts 10-digit Indian numbers, prefixed 0-numbers, and prefixed 91-numbers to canonical E.164 (`+91xxxxxxxxxx`).
     - Error Sanitization: `mapAuthError()` translates internal database/GoTrue errors into uniform, user-safe messages without leaking account existence or stack traces.
  4. **Strict Zod Schemas (`src/lib/auth/schemas.ts`):**
     - Enforced validation rules for email, phone (E.164), password strength (min 8 chars, letter + digit), 6-digit OTP, signup, password reset, and password confirmation matching.
  5. **PKCE Callback Route Handler (`src/app/auth/callback/route.ts`):**
     - Created GET Route Handler for code-for-session exchange, validating redirect targets with `isValidInternalRedirect()`, and idempotently bootstrapping user profiles.
  6. **Next.js 15 Edge Middleware (`src/middleware.ts`):**
     - Enforces session token freshness via `updateSession()`.
     - Route Protection: Redirects anonymous visitors on `/dashboard/*`, `/counter/*`, `/workspace/*`, `/platform-admin/*` to `/login?next=<encodedPath>`.
     - Guest-Only Protection: Redirects authenticated users accessing `/login`, `/register`, or `/forgot-password` to `/dashboard`.
     - Cookie Preservation: Preserves refreshed Supabase session cookies across 307 redirects using `copyCookies()`.
  7. **Database Triggers & Profile Bootstrapping:**
     - Created forward-only migration `supabase/migrations/20261112000002_auth_profile_trigger.sql` implementing `handle_new_auth_user()` with `SECURITY DEFINER` and search path restriction to bridge `auth.users` to `public.users` and `public.user_auth_identities`.
     - Created application-layer fallback helper `ensureUserProfile()` in `src/lib/auth/profile.ts`.
  8. **Automated Unit Testing & Verification:**
     - Added 55 new unit tests across 6 auth test files in `tests/unit/auth/` (schemas, security, actions, middleware, profile bootstrap, callback).
     - Full Vitest test suite now passes with 27 test files, 262 tests (100% pass rate).
     - Test coverage satisfies all quality gate thresholds: Statements 85.34%, Branches 75.13%, Functions 80.68%, Lines 85.34%.
     - Next.js production build (`pnpm build`) compiled 34 pages with 0 errors.
  9. **Documentation:**
     - Created `docs/AUTHENTICATION.md` covering architecture, lifecycle flows, middleware sequence, India DLT/SMS regulatory requirements, and security controls.
- **Files added/modified:**
  - Added: `src/lib/auth/security.ts`
  - Added: `src/lib/auth/schemas.ts`
  - Added: `src/lib/auth/profile.ts`
  - Added: `src/lib/auth/actions.ts`
  - Added: `src/components/auth/login-form.tsx`
  - Added: `src/components/auth/register-form.tsx`
  - Added: `src/components/auth/forgot-password-form.tsx`
  - Added: `src/components/auth/update-password-form.tsx`
  - Added: `src/app/auth/callback/route.ts`
  - Added: `src/app/(auth)/forgot-password/page.tsx`
  - Added: `src/app/(auth)/update-password/page.tsx`
  - Added: `src/app/(auth)/verify-email/page.tsx`
  - Added: `src/middleware.ts`
  - Added: `supabase/migrations/20261112000002_auth_profile_trigger.sql`
  - Added: `tests/unit/auth/security.test.ts`
  - Added: `tests/unit/auth/schemas.test.ts`
  - Added: `tests/unit/auth/actions.test.ts`
  - Added: `tests/unit/auth/middleware.test.ts`
  - Added: `tests/unit/auth/profile.test.ts`
  - Added: `tests/unit/auth/callback.test.ts`
  - Added: `docs/AUTHENTICATION.md`
  - Modified: `src/lib/supabase/middleware.ts`
  - Modified: `src/lib/supabase/types.ts`
  - Modified: `src/app/(auth)/login/page.tsx`
  - Modified: `src/app/(auth)/register/page.tsx`
  - Modified: `tests/unit/routing/route-shells.test.tsx`
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Verification commands run:**
  - `pnpm format:check`: Passed (clean Prettier formatting)
  - `pnpm lint`: Passed (0 errors, 0 warnings)
  - `pnpm typecheck`: Passed (0 errors across entire workspace)
  - `pnpm test`: Passed (27 test files, 262 tests passing)
  - `pnpm test:coverage`: Passed (all thresholds met: Stmts >= 85%, Branch >= 70%, Funcs >= 80%, Lines >= 85%)
  - `pnpm build`: Passed (Next.js 15.5.29 production build succeeded with 34 generated pages and Middleware)

## Task report: VO-020

- **Task ID:** VO-020
- **Status:** DONE
- **Summary:** Built, tested, and statically validated the canonical database migration framework for PostgreSQL 16+ on Supabase, reconciling ADR-002, ADR-003, and ADR-004 into a single authoritative migration history:
  1. **Architecture Reconciliation & Single Source of Truth:**
     - Reconciled ADR-002 (PostgreSQL + RLS), ADR-003 (full Supabase platform backend), and ADR-004 (Cloudflare edge runtime).
     - Standardized on Supabase CLI native SQL migrations (`supabase/migrations/`) as the single authoritative DDL pipeline, eliminating dual-runner drift.
     - Runtime queries execute connectionlessly via PostgREST HTTPS, while DDL migrations run via dedicated migration runners on port 5432/Supavisor session pooler.
  2. **Initial Core Schema Migration (`supabase/migrations/20261112000001_initial_schema.sql`):**
     - Authored initial migration defining all 14 canonical domain tables: `users`, `user_auth_identities`, `workspaces`, `workspace_members`, `businesses`, `locations`, `business_members`, `sites`, `catalogue_items`, `customers`, `orders`, `invoice_sequences`, `bills`, `audit_logs`.
     - Primary Keys: All 14 tables enforce `UUID PRIMARY KEY DEFAULT gen_random_uuid()`.
     - Financial Amounts: Strictly enforce 64-bit integer minor units (`price_minor BIGINT`, `total_minor BIGINT`, `amount_minor BIGINT`, `tax_minor BIGINT`, `total_spend_minor BIGINT`) with explicit ISO 4217 currency (`INR`). Banned all floating-point money representations.
     - Row-Level Security: Activated `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;` on all 14 tables, establishing a strict **Default Deny** posture across public tables.
     - Multi-Tenant Performance: Added composite B-tree indexes `(business_id, created_at DESC)` and foreign-key lookup indexes across all tenant tables.
     - Gap-Free Sequential Invoices: Implemented `invoice_sequences` table with composite unique constraint `(business_id, financial_year, series_prefix)`.
     - Append-Only Audit Trail: `audit_logs` table designed without update triggers to guarantee immutability.
  3. **Local Supabase Configuration (`supabase/config.toml`):**
     - Configured local project ID `vyapone`, PostgreSQL port 54322, PostgREST API port 54321, transaction pooler port 54329 (`pool_mode = "transaction"`), auth, and storage.
  4. **Synthetic Seed Data (`supabase/seed.sql`):**
     - Created local development seed records using valid RFC 4122 v4 UUIDs, synthetic `.vyapone.internal` emails, and integer minor units, mirroring `tests/fixtures/demo-seed.ts`.
  5. **pgTAP Database Regression Test Suite (`supabase/tests/00001_schema_test.sql`):**
     - Authored 32 pgTAP assertions verifying extension installation, table existence, UUID PK types, `BIGINT` minor units, foreign-key relationships, and active RLS state.
  6. **Automated Vitest Static Validation (`tests/unit/database/migrations.test.ts`):**
     - Implemented 11 automated unit tests validating migration file naming, all 14 table definitions, UUID PKs, minor-unit constraints, RLS enablement, index presence, seed RFC 4122 UUIDs, zero PII, and pgTAP syntax.
     - Total Vitest test suite expanded to 21 test files, 202 passing tests (100% pass rate).
  7. **Developer Package Scripts:**
     - Added `db:start`, `db:stop`, `db:reset`, `db:migration:new`, `db:test`, and `db:types` to `package.json`.
  8. **Comprehensive Architecture Documentation (`docs/DATABASE_MIGRATIONS.md`):**
     - Authored canonical reference covering migration architecture, file conventions, local workflow, Docker dependency, RLS migration rules, seed safety, Cloudflare boundaries, and production approval process.
- **Files added/modified:**
  - Added: `supabase/config.toml`
  - Added: `supabase/migrations/20261112000001_initial_schema.sql`
  - Added: `supabase/tests/00001_schema_test.sql`
  - Added: `supabase/seed.sql`
  - Added: `tests/unit/database/migrations.test.ts`
  - Added: `docs/DATABASE_MIGRATIONS.md`
  - Modified: `package.json` (added `db:*` scripts)
  - Modified: `docs/TASK_BACKLOG.md` (VO-020 DONE)
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Verification commands run:**
  - `pnpm format:check`: Passed (clean Prettier formatting)
  - `pnpm lint`: Passed (0 errors, 0 warnings)
  - `pnpm typecheck`: Passed (clean TypeScript compilation)
  - `pnpm test tests/unit/database/migrations.test.ts`: 1/1 test file passed, 11/11 tests passed (100%)
  - `pnpm test`: 21/21 test files passed, 202/202 tests passed (100%)
  - `pnpm test:coverage`: Passed (Statements: 96.36%, Branches: 79.75%, Functions: 92.30%, Lines: 96.36%)
  - `pnpm build`: Clean Next.js 15.5.29 production build (30 static pages, 1 dynamic route)
- **Blocked/deferred:** Live local PostgreSQL container execution via `supabase start` and `supabase test db` is BLOCKED by the absence of Docker Desktop / WSL2 on this Windows workstation. Static SQL and schema verification passed completely.
- **Next task:** VO-021 — Implement authentication and account lifecycle

## Task report: VO-019

- **Task ID:** VO-019
- **Status:** DONE
- **Summary:** Established formal testing conventions, test execution layers, comprehensive test factories for all 13 canonical entities, seeded local demo data architecture with strict environment guards, Playwright E2E configuration, measured Vitest code coverage baseline, and updated documentation:
  1. **Testing Layers Separation:**
     - `tests/unit/`: Fast in-memory unit tests executing via Vitest + jsdom (18 files, 182 tests).
     - `tests/integration/`: Cross-module integration tests validating app shells with live Zod config validation and multi-tenant isolation boundaries (2 files, 9 tests). Total Vitest test suite: 20 files, 191 tests passing (100%).
     - `tests/e2e/`: Browser end-to-end tests executing via Playwright Chromium (`playwright.config.ts`, `tests/e2e/app-shell.spec.ts`).
  2. **Canonical Test Factories (`tests/factories/`):**
     - Built strongly-typed factories for all 13 canonical domain entities from `docs/diagrams/core-erd.mmd`:
       - `createTestUser()`, `createTestUserAuthIdentity()`
       - `createTestWorkspace()`, `createTestWorkspaceMember()`
       - `createTestBusiness()`, `createTestLocation()`, `createTestBusinessMember()`, `createTestSite()`
       - `createTestCatalogueItem()`, `createTestCustomer()`, `createTestOrder()`, `createTestBill()`, `createTestAuditLog()`
     - Supported deterministic IDs via monotonic sequence generators (`formatDeterministicId`, `resetFactorySequence`) and frozen test timestamp (`BASE_TEST_TIMESTAMP = "2026-11-12T10:00:00.000Z"`).
     - Strictly enforced financial minor units (`amount_minor BIGINT`, `price_minor BIGINT`, ISO 4217 `currency: "INR"`).
  3. **Seeded Local Demo Data (`tests/fixtures/demo-seed.ts`):**
     - Constructed realistic, synthetic multi-tenant demo hierarchy: Platform Super-Admin (`demo.admin@example.vyapone.internal`), Reseller Workspace (`demo-reseller-workspace`), Sovereign Business (`demo-business-kaveri` / "Kaveri Silks & Sarees"), Location (`loc-demo-kaveri-mg-road`), Staff (`demo.staff@example.vyapone.internal`), Published Site (`demo-kaveri-site`), Catalogue Item (`item-demo-kanchipuram-saree`, 850,000 minor units = ₹8,500.00), Customer, Order, Sequential Invoice (`INV/2026-27/0001`), and immutable Audit Logs.
     - Production Security Guard (`src/lib/database/seed.ts`): Implemented `assertSafeSeedEnvironment()` throwing `SeedingSecurityError` if executed in `NODE_ENV === "production"`, `NEXT_PUBLIC_APP_ENV === "production"|"staging"`, or against non-localhost database URLs.
  4. **Integration Test Layer (`tests/integration/`):**
     - `tests/integration/app-shell-validation.test.tsx`: Validates 5 core protected route shells (Dashboard, Counter POS, Workspace Reseller, Platform Admin, and Public Site) within genuine validated public & server environment contexts.
     - `tests/integration/multi-tenant-isolation.test.ts`: Verifies strict isolation of sovereign business records, ensuring reseller workspaces do not conflate ownership with sovereign business entities.
  5. **Vitest Code Coverage Configuration & Baseline:**
     - Installed and configured `@vitest/coverage-v8` (`3.2.7`).
     - Excluded barrel exports, pure type declarations, and configuration stubs from coverage collection.
     - Measured baseline coverage: Statements **96.35%**, Branches **79.75%**, Functions **92.30%**, Lines **96.35%**.
     - Enforced automated thresholds in `vitest.config.ts`: Statements 85%, Branches 70%, Functions 80%, Lines 85%.
  6. **Comprehensive Documentation (`docs/TESTING_CONVENTIONS.md`):**
     - Authored canonical guide detailing the testing pyramid, Arrange-Act-Assert (AAA) pattern, deterministic factories, seeding safety invariants, code coverage thresholds, test commands (`pnpm test`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:coverage`, `pnpm test:responsive`), and debugging practices.
  7. **Phase P1 Completion:**
     - Marked all Phase P1 tasks (VO-010 to VO-019) DONE.
     - Verified Phase P1 Gate criteria in `docs/PHASE_GATES.md`.
- **Files added/modified:**
  - Added: `docs/TESTING_CONVENTIONS.md`
  - Added: `playwright.config.ts`
  - Added: `src/lib/database/seed.ts`
  - Added: `tests/factories/types.ts`
  - Added: `tests/factories/users.ts`
  - Added: `tests/factories/workspaces.ts`
  - Added: `tests/factories/businesses.ts`
  - Added: `tests/factories/commerce.ts`
  - Added: `tests/factories/index.ts`
  - Added: `tests/fixtures/demo-seed.ts`
  - Added: `tests/unit/factories/factories.test.ts`
  - Added: `tests/unit/fixtures/demo-seed.test.ts`
  - Added: `tests/integration/app-shell-validation.test.tsx`
  - Added: `tests/integration/multi-tenant-isolation.test.ts`
  - Added: `tests/e2e/app-shell.spec.ts`
  - Modified: `package.json` (added `@vitest/coverage-v8`, added test scripts)
  - Modified: `pnpm-lock.yaml`
  - Modified: `vitest.config.ts` (configured v8 coverage & thresholds)
  - Modified: `docs/TASK_BACKLOG.md` (VO-019 DONE)
  - Modified: `docs/PHASE_GATES.md` (P1 Gate passed)
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Verification commands run:**
  - `pnpm format:check`: Passed (clean formatting)
  - `pnpm lint`: Passed (0 errors, 0 warnings)
  - `pnpm typecheck`: Passed (clean TypeScript compilation)
  - `pnpm test:unit`: 18/18 test files passed, 182/182 tests passed (100%)
  - `pnpm test:integration`: 2/2 test files passed, 9/9 tests passed (100%)
  - `pnpm test`: 20/20 test files passed, 191/191 tests passed (100%)
  - `pnpm test:coverage`: Statements: 96.35% (min 85%), Branches: 79.75% (min 70%), Functions: 92.30% (min 80%), Lines: 96.35% (min 85%)
  - `pnpm test:responsive`: 35/35 responsive checks passed across 5 canonical viewports (320px, 390px, 768px, 1024px, 1440px)
  - `pnpm build`: Clean Next.js 15.5.29 production build (30 static pages, 1 dynamic route)
- **Blocked/deferred:** None. Phase P1 is complete.
- **Next task:** VO-020 — Create database migration framework (Phase P2 entry) |

## Task report: VO-018

- **Task ID:** VO-018
- **Status:** DONE
- **Summary:** Built, tested, and locally validated the GitHub Actions CI pipeline and pull-request validation checks with strict action SHA pinning, least-privilege permissions, zero secrets in CI, reproducible pnpm/Node.js setup, and Dependabot automation:
  1. **CI Workflow (`.github/workflows/ci.yml`):**
     - Structured into two sequential jobs with stable check names:
       - `quality-checks`: Runs `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`.
       - `production-build`: Dependent on `quality-checks`; runs `pnpm build` (compiles all 30 App Router static/dynamic route shells).
     - Triggers on `push` to `main`, `pull_request` targeting `main`, and manual execution via `workflow_dispatch`.
     - Concurrency control: `cancel-in-progress: true` terminates superseded runs when new commits are pushed to an open PR.
     - Sensible execution timeouts: `timeout-minutes: 15` per job.
  2. **Security Hardening & Action Pinning:**
     - Global least-privilege permissions locked to `contents: read`. No write or deployment tokens.
     - `persist-credentials: false` in checkout prevents leaked git tokens on runner disks.
     - All third-party actions pinned to full 40-character commit SHAs with version comments running natively on Node 24 (`runs.using: 'node24'`):
       - `actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0 # v7.0.0`
       - `pnpm/action-setup@fc06bc1257f339d1d5d8b3a19a8cae5388b55320 # v5.0.0`
       - `actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0`
  3. **Reproducible Environment:**
     - Added `.nvmrc` (`24`) fixing the Node.js 24 LTS version.
     - Aligned `package.json` `"engines": { "node": ">=24.0.0" }`.
     - Added `"packageManager": "pnpm@11.21.0"` to `package.json`.
     - Dependency installation locked via `pnpm install --frozen-lockfile` with pnpm store caching via `actions/setup-node`.
  4. **Zero Secrets in CI:**
     - Verified that unit tests mock external providers and that `pnpm build` compiles all route shells without requiring live database credentials, production secrets, or third-party API keys.
  5. **Dependabot Configuration (`.github/dependabot.yml`):**
     - Weekly automated security and version update checks for `github-actions` and `npm` ecosystems.
  6. **Architecture Documentation (`docs/CI_CD.md`):**
     - Comprehensive reference detailing CI pipeline stages, pinned actions, security invariants, reproducing CI locally, failure triage, and pending GitHub branch protection configuration.
  7. **Automated Unit Tests (`tests/unit/ci/workflow.test.ts`):**
     - 6 automated tests validating workflow syntax, branch triggers, permission hardening, action SHA pinning, required quality gates, Dependabot configuration, and reproducible runtime settings.
     - Total project test suite increased to 170 passing tests across 16 test files (100% pass rate).
- **Files added/modified:**
  - Added: `.github/workflows/ci.yml`
  - Added: `.github/dependabot.yml`
  - Added: `.nvmrc`
  - Added: `docs/CI_CD.md`
  - Added: `tests/unit/ci/workflow.test.ts`
  - Modified: `package.json` (added `"packageManager": "pnpm@11.21.0"`)
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Verification commands run:**
  - `pnpm vitest run tests/unit/ci`: 1/1 test file passed, 6/6 tests passed (100%)
  - `pnpm test`: 16/16 test files passed, 170/170 tests passed (100%)
  - `pnpm typecheck`: Clean TypeScript compilation (0 errors)
  - `pnpm lint`: Clean ESLint check (0 errors, 0 warnings)
  - `pnpm format:check`: Clean Prettier check (All files formatted)
  - `pnpm build`: Clean Next.js 15.5.29 production build (30/30 static pages)
- **Blocked/deferred:** Remote GitHub-hosted execution and branch protection configuration remain pending repository administrator setup. Ready for VO-019.
- **Next task:** VO-019 — Establish testing conventions and baseline coverage

## Task report: VO-017

- **Task ID:** VO-017
- **Status:** DONE
- **Summary:** Built, tested, and verified the Supabase client and database connection foundation with full compile-time and runtime security isolation, request-scoped cookie handling, Cloudflare Workers connection pooling reconciliation, and version-controlled TypeScript database type definitions:
  1. **Browser Client (`src/lib/supabase/client.ts`):**
     - Implemented `createBrowserSupabaseClient()` using `@supabase/ssr`.
     - Strictly restricted to public allowlisted configuration (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
     - Browser runtime singleton memoization prevents duplicate GoTrue auth listeners or redundant WebSocket connection channels.
     - Never imports privileged server configuration or `server-only`.
  2. **Server Client (`src/lib/supabase/server.ts`):**
     - Implemented `createServerSupabaseClient(customCookies?)` guarded by Next.js `import "server-only"`.
     - Request-scoped authenticated client integrating with Next.js 15 asynchronous `await cookies()` from `next/headers`.
     - Cookie reading (`getAll`) and writing (`setAll`) support seamless session propagation with graceful handling of Server Component read-only cookie constraints.
     - Operates strictly in the context of the authenticated user's JWT, enforcing PostgreSQL Row-Level Security (RLS) policies (`auth.uid()`). Zero shared mutable state across requests.
  3. **Middleware Session Handler (`src/lib/supabase/middleware.ts`):**
     - Implemented `updateSession(request)` for Next.js Middleware.
     - Refreshes auth sessions via `supabase.auth.getUser()`, updating request headers and response cookies to prevent session desynchronization during App Router navigation.
     - Handles unconfigured local dev environments gracefully without throwing or interrupting requests.
  4. **Administrative Client (`src/lib/supabase/admin.ts`):**
     - Implemented `createAdminSupabaseClient(customEnv?)` using `@supabase/supabase-js`.
     - Guarded by Next.js `import "server-only"`. Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.
     - Disabled session persistence (`persistSession: false, autoRefreshToken: false`) tailored for stateless server execution.
     - Strictly restricted to platform-level tenant provisioning, webhook verification (e.g. Razorpay payment notifications), background cron jobs, and audit log ingestion. Never exposed to client bundles or routine user operations.
  5. **Database Types Foundation (`src/lib/supabase/types.ts`):**
     - Version-controlled `Database` interface covering all 13 canonical tables from `docs/diagrams/core-erd.mmd` (`users`, `user_auth_identities`, `workspaces`, `workspace_members`, `businesses`, `locations`, `business_members`, `sites`, `catalogue_items`, `orders`, `customers`, `bills`, `audit_logs`).
     - Strongly-typed `Row`, `Insert`, `Update`, and `Relationships` definitions.
     - Documented official CLI type regeneration command: `pnpm dlx supabase gen types typescript --project-id <project-ref> > src/lib/supabase/types.ts`.
  6. **Database Connection & Pooler Foundation (`src/lib/database/index.ts`):**
     - Reconciled ADR-002, ADR-003, and ADR-004 for Cloudflare Pages/Workers edge runtime.
     - Implemented `inspectDatabaseConfig(customEnv?)` safely detecting Supavisor transaction pooler (port 6543 / `?pgbouncer=true`), session pooler (port 5432), and direct connections without opening persistent TCP sockets on import.
     - Zero credential leakage: host, port, database name, and pooler mode are extracted safely while passwords and credentials are never included in output metadata.
  7. **Architecture Documentation (`docs/DATABASE_ARCHITECTURE.md`):**
     - Authored canonical reference documenting client boundaries, serverless connection pooling, Cloudflare Workers compatibility, environment matrix, RLS protection boundaries, and $0-budget free-tier constraints/mitigations.
  8. **Comprehensive Automated Unit Tests (`tests/unit/supabase/` & `tests/unit/database/`):**
     - `tests/unit/supabase/browser-client.test.ts`: 4 tests (initialization, browser memoization, missing credentials error).
     - `tests/unit/supabase/server-client.test.ts`: 3 tests (request scoping, cookie read/write handling, missing credentials error).
     - `tests/unit/supabase/admin-client.test.ts`: 4 tests (service-role auth, non-persisted session, secret redaction, missing key error).
     - `tests/unit/supabase/boundary.test.ts`: 3 tests (proves `server.ts` and `admin.ts` actively reject client component imports via `server-only`).
     - `tests/unit/supabase/types.test.ts`: 4 tests (validates table keys, entity attributes, sovereign ownership, and monetary integer minor units).
     - `tests/unit/database/connection.test.ts`: 5 tests (transaction pooler detection, session pooler detection, unpooled detection, secret redaction).
     - Total project test suite increased to 164 passing tests across 15 test files (100% pass rate).
- **Files added/modified:**
  - Added: `src/lib/supabase/types.ts`
  - Added: `src/lib/supabase/client.ts`
  - Added: `src/lib/supabase/server.ts`
  - Added: `src/lib/supabase/middleware.ts`
  - Added: `src/lib/supabase/admin.ts`
  - Added: `src/lib/supabase/index.ts`
  - Added: `src/lib/database/index.ts`
  - Added: `docs/DATABASE_ARCHITECTURE.md`
  - Added: `tests/unit/supabase/browser-client.test.ts`
  - Added: `tests/unit/supabase/server-client.test.ts`
  - Added: `tests/unit/supabase/admin-client.test.ts`
  - Added: `tests/unit/supabase/boundary.test.ts`
  - Added: `tests/unit/supabase/types.test.ts`
  - Added: `tests/unit/database/connection.test.ts`
  - Modified: `package.json` (installed `@supabase/ssr` `0.12.7` and `@supabase/supabase-js` `2.119.0`)
  - Modified: `pnpm-lock.yaml`
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Verification commands run:**
  - `pnpm vitest run tests/unit/supabase tests/unit/database`: 6/6 test files passed, 23/23 tests passed (100%)
  - `pnpm test`: 15/15 test files passed, 164/164 tests passed (100%)
  - `pnpm typecheck`: Clean TypeScript compilation (0 errors)
  - `pnpm lint`: Clean ESLint check (0 errors, 0 warnings)
  - `pnpm format:check`: Clean Prettier check (All files formatted)
  - `pnpm build`: Clean Next.js 15.5.29 production build (30/30 static pages)
- **Blocked/deferred:** None. Ready for VO-018.
- **Next task:** VO-018 — Set up CI and pull-request checks

## Task report: VO-016

- **Task ID:** VO-016
- **Status:** DONE
- **Summary:** Built, tested, and verified a typed, security-isolated application configuration and environment-variable handling foundation:
  1. **Public vs. Server-Only Separation:**
     - Client-Safe Public Configuration (`src/config/public.ts`): Strict allowlist extracting only `NEXT_PUBLIC_*` variables (`NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`). Safe to import in React Client Components (`"use client"`).
     - Server-Only Privileged Configuration (`src/config/server.ts`): Enforced compile-time and runtime protection via Next.js `import "server-only"`. Encapsulates database connection strings, Supabase service-role keys, session encryption secrets, and integration credentials.
     - Central Barrel Export (`src/config/index.ts`): Exports `publicConfig`, validation schemas, and validator utilities. Deliberately excludes direct `serverConfig` exports to prevent inadvertent bundling into client components.
  2. **Validation Engine (`src/config/env.ts`):**
     - Built comprehensive Zod schemas (`publicEnvSchema`, `serverCoreEnvSchema`, `optionalIntegrationsEnvSchema`) validating URLs, port numbers, enum modes, and database connection strings.
     - Dedicated `ConfigurationError` class aggregating missing/malformed configuration and enforcing the **zero-leak rule**: actual secret values, passwords, or tokens are NEVER printed in error messages or logs.
     - Production Invariants: Enforces that `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (min 32 chars and not dev placeholder), and Supabase public credentials are strictly present in `production` mode, throwing immediately on startup if absent.
     - Graceful Local Development: Absence of optional third-party integrations (payments, WhatsApp, AI, storage, redis) defaults cleanly with `isConfigured: false` without breaking local app execution.
     - Cloudflare Runtime Context Support: `validateEnvironment(rawEnv?)` accepts explicit runtime dictionary bindings (e.g. `context.env` from Cloudflare Pages/Workers) with fallback to `process.env`.
  3. **Updated Environment Template (`.env.example`):**
     - Fully structured into Public, Server-Only Core, and Optional Integration sections with detailed instructions for local `.env.local` and Cloudflare `.dev.vars` / Dashboard Secrets.
     - Sanitized placeholder values only; zero working credentials.
     - Updated `.gitignore` to explicitly ignore `.dev.vars` and `.dev.vars.local`.
  4. **Updated Project Decisions (`docs/DECISION_REGISTER.md`):**
     - Recorded approved project direction for ADR-003 (Supabase selected as full backend platform: Auth, PostgreSQL DB with RLS, Storage) and ADR-004 (Cloudflare selected as hosting direction: Pages/Workers edge runtime).
  5. **Architecture Documentation (`docs/CONFIGURATION.md`):**
     - Created comprehensive reference detailing the configuration architecture, variable matrix, Cloudflare runtime guidance, Supabase credentials distinction, and secret-management rules.
  6. **Automated Unit Tests (`tests/unit/config/`):**
     - `tests/unit/config/env.test.ts`: 15 tests covering valid dev/prod configuration, missing required production credentials, format validation, optional integrations absence, public allowlisting, secret redaction, and Cloudflare context evaluation.
     - `tests/unit/config/server.test.ts`: 3 tests verifying server configuration loading, memoization, and custom env re-evaluation.
     - `tests/unit/config/client-boundary.test.ts`: 1 test verifying that loading `server-only` in client/JSDOM runtime actively throws an error.
     - Total project test count reached 141 passing tests across 9 test files (100% pass rate).
- **Files added/modified:**
  - Added: `src/config/env.ts`
  - Added: `src/config/public.ts`
  - Added: `src/config/server.ts`
  - Added: `src/config/index.ts`
  - Added: `docs/CONFIGURATION.md`
  - Added: `tests/unit/config/env.test.ts`
  - Added: `tests/unit/config/server.test.ts`
  - Added: `tests/unit/config/client-boundary.test.ts`
  - Modified: `.env.example`
  - Modified: `.gitignore`
  - Modified: `package.json` (installed `zod` and `server-only`)
  - Modified: `pnpm-lock.yaml`
  - Modified: `docs/DECISION_REGISTER.md`
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Verification commands run:**
  - `pnpm vitest run tests/unit/config/`: 19/19 tests passed (100%)
  - `pnpm test`: 9/9 test files passed, 141/141 tests passed (100%)
  - `pnpm typecheck`: Clean TypeScript compilation (0 errors)
  - `pnpm lint`: Clean ESLint check (0 errors, 0 warnings)
  - `pnpm format:check`: Clean Prettier check (All files formatted)
  - `pnpm build`: Clean Next.js 15.5.29 production build (30/30 static pages)
- **Blocked/deferred:** None. Ready for VO-017.
- **Next task:** VO-017 — Add structured logging and error handling

## Task report: VO-015

- **Task ID:** VO-015
- **Status:** DONE
- **Summary:** Built, tested, and validated responsive layout and mobile interaction foundation across all 6 application route shells and root portal:
  1. **Responsive Tokens Parity (`src/design-system/tokens.ts`):** Defined canonical breakpoints (`320px`, `390px`, `768px`, `1024px`, `1440px`), safe-area inset definitions (`env(safe-area-inset-*, 0px)`), responsive page gutters (`mobile: 16px`, `tablet: 24px`, `desktop: 32px`), and WCAG 2.2 AA compliant touch targets (min interactive `24px`, standard control `44px`, mobile preferred `48px`).
  2. **Viewport & Safe Area Configuration (`src/app/layout.tsx`):** Added `viewportFit: "cover"` to Next.js `Viewport` export, enabling notch, dynamic island, and gesture bar accommodation on modern mobile devices.
  3. **Global Responsive Utilities (`src/app/globals.css`):**
     - Implemented dynamic safe-area CSS variables (`--safe-area-top`, `--safe-area-bottom`, `--safe-area-left`, `--safe-area-right`) with 0px fallbacks.
     - Implemented responsive page gutter scaling (`--page-gutter`) dynamically at 768px and 1024px.
     - Implemented dynamic viewport height utility (`.min-h-screen-safe` supporting `100vh` and `100dvh`) protecting layouts against mobile virtual keyboard popping.
     - Enforced 16px minimum font size on inputs to permanently eliminate mobile iOS Safari auto-zooming.
     - Implemented responsive navigation separation: `.owner-desktop-nav` hidden on mobile (`<= 768px`), `.ui-nav-bottom-bar` hidden on desktop (`>= 769px`).
     - Added `.has-bottom-bar` utility guaranteeing main content is never obscured by the fixed mobile bottom bar.
     - Implemented `.ui-nav-scrollable` horizontal momentum scroll utility with hidden scrollbars for multi-tab mobile headers.
     - Implemented `.ui-table-container` allowing keyboard-accessible table horizontal scrolling without breaking root page viewport containment.
  4. **Layout Normalization:** Applied responsive utilities (`.min-h-screen-safe`, `.app-header`, `.app-container`, `.ui-nav-scrollable`, `.has-bottom-bar`) across all 6 route group layouts (`(auth)`, `(public)`, `(reseller)`, `(owner)`, `(staff)`, `(admin)`) and root `src/app/page.tsx`.
  5. **Responsive Invariants Unit Tests (`tests/unit/responsive/responsive-foundation.test.ts`):** 14 automated unit tests verifying token values, safe-area variables, gutter scaling, touch targets, reduced motion queries, and viewport metadata.
  6. **Automated Headless Browser Viewport Validation (`scripts/validate-responsive.mjs`):** Executed 35 browser-level matrix checks across all 7 core representative routes (`/login`, `/s/demo-store`, `/workspace`, `/dashboard`, `/dashboard/billing`, `/counter/pos`, `/platform-admin`) at 5 target viewports (`320x568`, `390x844`, `768x1024`, `1024x768`, `1440x900`). Confirmed 100% pass rate with zero horizontal overflow (`docScrollWidth <= winInnerWidth`). Captured 35 screenshot artifacts to `docs/evidence/screenshots/`.
  7. **Comprehensive Architecture Documentation (`docs/RESPONSIVE_DESIGN.md`):** Authored full reference documentation covering design philosophy, breakpoint matrix, safe area ergonomics, touch targets, and browser test results.
- **Files added/modified:**
  - Added: `docs/RESPONSIVE_DESIGN.md`
  - Added: `tests/unit/responsive/responsive-foundation.test.ts`
  - Added: `scripts/validate-responsive.mjs`
  - Added: `docs/evidence/responsive_viewport_results.json`
  - Added: `docs/evidence/screenshots/*.png` (35 screenshot files)
  - Modified: `src/design-system/tokens.ts`
  - Modified: `src/app/globals.css`
  - Modified: `src/app/layout.tsx`
  - Modified: `src/app/page.tsx`
  - Modified: `src/app/(owner)/dashboard/layout.tsx`
  - Modified: `src/app/(admin)/platform-admin/layout.tsx`
  - Modified: `src/app/(reseller)/workspace/layout.tsx`
  - Modified: `src/app/(staff)/counter/layout.tsx`
  - Modified: `src/app/(public)/layout.tsx`
  - Modified: `src/app/(auth)/layout.tsx`
  - Modified: `package.json`
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Verification commands run:**
  - `pnpm vitest run tests/unit/responsive/responsive-foundation.test.ts`: 14/14 tests passed (100%)
  - `pnpm test`: 6/6 test files passed, 122/122 tests passed (100%)
  - `pnpm typecheck`: Clean TypeScript compilation (0 errors)
  - `pnpm build`: Clean Next.js 15.5.29 production build (30/30 static pages)
  - `pnpm test:responsive`: 35/35 browser viewport checks passed (100%)
- **Blocked/deferred:** None. Ready for VO-016.
- **Next task:** VO-016 — Implement application configuration and environment handling
| P3 — Niche registry, presets and business onboarding | NOT_STARTED | |
| P4 — Website engine, templates and publishing | NOT_STARTED | |
| P5 — Vya AI gateway and website builder | NOT_STARTED | |
| P6 — Shared business operations engine | NOT_STARTED | |
| P7 — Niche operational experiences | NOT_STARTED | |
| P8 — Customers, GST billing, payments and reseller money flows | NOT_STARTED | |
| P9 — WhatsApp, messaging and automation | NOT_STARTED | |
| P10 — Vya daily assistant, voice and languages | NOT_STARTED | |
| P11 — Reseller ecosystem, integrations, staff and PWA | NOT_STARTED | |
| P12 — Platform administration, analytics and support | NOT_STARTED | |
| P13 — Production hardening, beta validation and GA | NOT_STARTED | |
| P14 — Post-launch expansion (not a GA blocker) | NOT_STARTED | |

## Task report: VO-014

- **Task ID:** VO-014
- **Status:** DONE
- **Summary:** Built and audited complete application route shells with role-aware navigation and layout hierarchy using Next.js 15 App Router route groups across exactly 28 application routes:
  1. **Reconciled Route Inventory & Architecture (`docs/ROUTE_ARCHITECTURE.md`):** Reconciled the route count to exactly 28 authored application page routes (27 static page files + 1 dynamic route `/s/[subdomain]`). Documented that Next.js static generation reports `(30/30)` because it includes `/_not-found` and framework prerender envelopes. Authored visual layout hierarchy tree, role navigation isolation matrix, client vs server component boundaries, and security delineation confirming hard authorization lives at middleware/RLS layers (P2 / VO-021, VO-024).
  2. **Clean Root Layout Normalization (`src/app/layout.tsx`):** Simplified root layout to a clean HTML/body envelope containing only global styles, fonts, and `{children}`, eliminating nested `<main>` landmark issues.
  3. **Developer Discovery Portal Showcase (`src/app/page.tsx`):** Clarified root portal status as a developer-only navigation showcase during Phase P1 to inspect route shells and token parity, not the final public marketing page.
  4. **Authentication Route Group `(auth)`:** Dedicated minimalist layout and placeholder screens for `/login` and `/register` with inputs disabled and explicit notices that OTP verification connects in Phase P2 (`VO-021`).
  5. **Public Storefront Route Group `(public)`:** Customer-facing touchpoint shell with dynamic subdomain route `/s/[subdomain]` and statutory draft privacy policy touchpoint `/privacy` (marked with clear warning as draft template pending official legal entity registration and DPO designation per DPDP 2023).
  6. **Reseller Agency Workspace `(reseller)`:** Multi-client agency portal with persistent top header navigation and routes for overview (`/workspace`), client business roster (`/workspace/clients`), wholesale billing and payouts (`/workspace/billing`), agency staff team (`/workspace/team`), and agency white-label settings (`/workspace/settings`). Removed invented business metrics and mock tables; marked controls disabled for Phase P11 (`VO-110`) and Phase P8 (`VO-085`).
  7. **Business Owner Operations Dashboard `(owner)`:** Sovereign merchant portal with desktop header navigation and a dedicated mobile bottom bar (44px+ touch targets) covering `/dashboard`, `/dashboard/catalogue`, `/dashboard/orders`, `/dashboard/billing`, `/dashboard/customers`, `/dashboard/whatsapp`, `/dashboard/website`, `/dashboard/analytics`, and `/dashboard/settings`. Replaced invented business records with placeholders (`--`) and disabled non-functional buttons.
  8. **Staff Counter POS Terminal `(staff)`:** Dedicated high-contrast, distraction-free point-of-sale shell for store clerks with rapid switching between counter overview (`/counter`), fast item punch & QR billing (`/counter/pos`), and station PIN lock/unlock (`/counter/unlock`). Controls clearly disabled pending shift session integration in Phase P11 (`VO-110`).
  9. **Platform Governance Console `(admin)`:** Internal super-admin console with alert badges and global overview (`/platform-admin`), tenant inspector (`/platform-admin/tenants`), plan tiers & quotas (`/platform-admin/plans`), statutory GST HSN/SAC master tables (`/platform-admin/taxes`), immutable audit trail (`/platform-admin/audit-logs`), and TRAI/Meta abuse & quiet-hour defense (`/platform-admin/abuse`). Replaced fake tenant numbers with placeholders and disabled mutation triggers pending Phase P2/P12.
  10. **Client Component Boundary Fixes:** Marked `Button` and `Field` primitives with `"use client";` to ensure event handlers (`onClick`, `onChange`, `createContext`) cleanly bridge the React Server Component serialization boundary in Next.js 15 production builds.
  11. **Comprehensive Route Shell Unit Tests (`tests/unit/routing/route-shells.test.tsx`):** 34 tests validating route mounting, semantic landmarks (`role="main"`, `role="navigation"`), accessible labels, navigation href targets, and strict role navigation isolation.
  12. **Next.js Production Build Verification:** Verified all 28 authored application routes and internal pages compile cleanly with zero collisions (`pnpm build`).
- **Files added/modified:**
  - Added: `docs/ROUTE_ARCHITECTURE.md`
  - Added: `src/app/(auth)/layout.tsx`
  - Added: `src/app/(auth)/login/page.tsx`
  - Added: `src/app/(auth)/register/page.tsx`
  - Added: `src/app/(public)/layout.tsx`
  - Added: `src/app/(public)/s/[subdomain]/page.tsx`
  - Added: `src/app/(public)/privacy/page.tsx`
  - Added: `src/app/(reseller)/workspace/layout.tsx`
  - Added: `src/app/(reseller)/workspace/page.tsx`
  - Added: `src/app/(reseller)/workspace/clients/page.tsx`
  - Added: `src/app/(reseller)/workspace/billing/page.tsx`
  - Added: `src/app/(reseller)/workspace/team/page.tsx`
  - Added: `src/app/(reseller)/workspace/settings/page.tsx`
  - Added: `src/app/(owner)/dashboard/layout.tsx`
  - Added: `src/app/(owner)/dashboard/page.tsx`
  - Added: `src/app/(owner)/dashboard/catalogue/page.tsx`
  - Added: `src/app/(owner)/dashboard/orders/page.tsx`
  - Added: `src/app/(owner)/dashboard/billing/page.tsx`
  - Added: `src/app/(owner)/dashboard/customers/page.tsx`
  - Added: `src/app/(owner)/dashboard/whatsapp/page.tsx`
  - Added: `src/app/(owner)/dashboard/website/page.tsx`
  - Added: `src/app/(owner)/dashboard/analytics/page.tsx`
  - Added: `src/app/(owner)/dashboard/settings/page.tsx`
  - Added: `src/app/(staff)/counter/layout.tsx`
  - Added: `src/app/(staff)/counter/page.tsx`
  - Added: `src/app/(staff)/counter/pos/page.tsx`
  - Added: `src/app/(staff)/counter/unlock/page.tsx`
  - Added: `src/app/(admin)/platform-admin/layout.tsx`
  - Added: `src/app/(admin)/platform-admin/page.tsx`
  - Added: `src/app/(admin)/platform-admin/tenants/page.tsx`
  - Added: `src/app/(admin)/platform-admin/plans/page.tsx`
  - Added: `src/app/(admin)/platform-admin/taxes/page.tsx`
  - Added: `src/app/(admin)/platform-admin/audit-logs/page.tsx`
  - Added: `src/app/(admin)/platform-admin/abuse/page.tsx`
  - Added: `tests/unit/routing/route-shells.test.tsx`
  - Modified: `src/app/layout.tsx`
  - Modified: `src/app/page.tsx`
  - Modified: `src/components/ui/button/index.tsx`
  - Modified: `src/components/ui/field/index.tsx`
  - Modified: `docs/TASK_BACKLOG.md`
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
| P2 — Platform identity, authentication and multi-tenancy | NOT_STARTED | |
| P3 — Niche registry, presets and business onboarding | NOT_STARTED | |
| P4 — Website engine, templates and publishing | NOT_STARTED | |
| P5 — Vya AI gateway and website builder | NOT_STARTED | |
| P6 — Shared business operations engine | NOT_STARTED | |
| P7 — Niche operational experiences | NOT_STARTED | |
| P8 — Customers, GST billing, payments and reseller money flows | NOT_STARTED | |
| P9 — WhatsApp, messaging and automation | NOT_STARTED | |
| P10 — Vya daily assistant, voice and languages | NOT_STARTED | |
| P11 — Reseller ecosystem, integrations, staff and PWA | NOT_STARTED | |
| P12 — Platform administration, analytics and support | NOT_STARTED | |
| P13 — Production hardening, beta validation and GA | NOT_STARTED | |
| P14 — Post-launch expansion (not a GA blocker) | NOT_STARTED | |

## Task report: VO-013

- **Task ID:** VO-013
- **Status:** DONE
- **Summary:** Built complete suite of 12 accessible shared UI component primitives adhering to WCAG 2.2 AA, PRD Section 12, `docs/DESIGN_TOKENS.md`, and `docs/PROJECT_STRUCTURE.md`:
  1. **Button Primitive (`src/components/ui/button`):** Variants (`primary`, `secondary`, `outline`, `ghost`, `destructive`, `accent`), sizes (`sm`, `md`, `lg`), `isLoading` state with spinner and `aria-busy`, prevents duplicate submissions when disabled/loading, accessible touch targets (`>= 44px` for md/lg).
  2. **Form Field Family (`src/components/ui/field`):** `Field`, `Input`, `Textarea`, `Select`, `Checkbox` with explicit `htmlFor` / `id` linking, `aria-required`, `aria-invalid`, `aria-describedby` linking helper and error IDs, `role="alert"` on errors, 16px minimum text preventing iOS Safari auto-zoom.
  3. **Card Primitive (`src/components/ui/card`):** `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction` supporting `default`, `elevated`, `glass`, and `subtle` variants with configurable heading tags.
  4. **Dialog Primitive (`src/components/ui/dialog`):** Accessible modal dialog with `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, focus trapping, Escape key dismiss, backdrop click dismiss, focus restoration to trigger, and body scroll locking.
  5. **Drawer / Bottom-Sheet Primitive (`src/components/ui/drawer`):** Mobile-first sheet designed for 390px viewports and counter POS usage with visual drag handle, focus management, Escape dismiss, and body scroll locking.
  6. **Tabs Primitive (`src/components/ui/tabs`):** WAI-ARIA tabs with `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, `aria-labelledby`, and keyboard navigation (ArrowLeft/Right, ArrowUp/Down, Home, End).
  7. **Table Primitive (`src/components/ui/table`):** Semantic `table`, `caption`, `thead`, `tbody`, `tfoot`, `tr`, `th` (with `scope="col"`), `td`, wrapped in a keyboard-accessible responsive scroll container (`role="region"`, `tabindex="0"`).
  8. **Badge Primitive (`src/components/ui/badge`):** Status indicators (`default`, `primary`, `accent`, `success`, `warning`, `danger`, `info`) with visible text (never color alone) and optional decorative icons (`aria-hidden="true"`).
  9. **Empty State Primitive (`src/components/ui/empty-state`):** Standardized empty state with `role="region"`, decorative icon, title, description, and primary/secondary action slots.
  10. **Skeleton Primitive (`src/components/ui/skeleton`):** Placeholder loader with `aria-hidden="true"`, pulse animation, reduced-motion override, and `text`, `circular`, `rectangular` variants.
  11. **Toast Notification Primitive (`src/components/ui/toast`):** Live region notifications (`polite` for info/success/warning, `assertive` with `role="alert"` for error) with accessible close button and non-premature error dismissal.
  12. **Navigation Landmark Primitive (`src/components/ui/navigation`):** Landmark `<nav>` with required `aria-label`, list structure, and links with `aria-current="page"`.
  13. **Central Barrel Export (`src/components/ui/index.ts`):** Clean export of all primitives and types.
  14. **CSS Tokens Consumption (`src/app/globals.css`):** Fully styled primitives consuming existing design token variables without any hardcoded colors or arbitrary values.
  15. **Unit Test Suite (`tests/unit/components/primitives.test.tsx`):** Added 26 unit tests verifying static server markup, ARIA states, roles, keyboard attributes, disabled states, error alerts, and styling hooks.
  16. **Interaction & Accessibility Test Suite (`tests/unit/components/interactions.test.tsx`):** Conducted interaction audit and added 25 automated interaction tests using `@testing-library/react` and `jsdom`: mouse/keyboard button activation, loading/disabled double-submit prevention, explicit button type enforcement, icon-only accessible names, form field label focus and native required validation, error description connection with `role="alert"`, checkbox toggle, dialog and drawer focus trapping and escape dismissal, focus restoration to triggers, body scroll locking and cleanup, horizontal and vertical tabs arrow/home/end navigation, mobile scrollable table regions, live region toast announcements and dismissals, and navigation landmark keyboard links.
- **Files added/modified:**
  - Added: `src/components/ui/button/index.tsx`
  - Added: `src/components/ui/field/index.tsx`
  - Added: `src/components/ui/card/index.tsx`
  - Added: `src/components/ui/dialog/index.tsx`
  - Added: `src/components/ui/drawer/index.tsx`
  - Added: `src/components/ui/tabs/index.tsx`
  - Added: `src/components/ui/table/index.tsx`
  - Added: `src/components/ui/badge/index.tsx`
  - Added: `src/components/ui/empty-state/index.tsx`
  - Added: `src/components/ui/skeleton/index.tsx`
  - Added: `src/components/ui/toast/index.tsx`
  - Added: `src/components/ui/navigation/index.tsx`
  - Added: `src/components/ui/index.ts`
  - Added: `tests/unit/components/primitives.test.tsx`
  - Added: `tests/unit/components/interactions.test.tsx`
  - Modified: `src/app/globals.css` (appended primitive classes)
  - Modified: `vitest.config.ts` (configured jsdom environment and `.tsx` test patterns)
  - Modified: `package.json` & `pnpm-lock.yaml` (installed `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `@types/jsdom`)
  - Modified: `docs/TASK_BACKLOG.md` (marked VO-013 as DONE)
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Commands/tests run:**
  - `pnpm typecheck`: Exit code 0 (zero TypeScript errors).
  - `pnpm lint`: Exit code 0 (zero ESLint errors or warnings).
  - `pnpm format:check`: Exit code 0 (All matched files use Prettier code style).
  - `pnpm test`: Exit code 0 (4 test files, 74 tests passing: 25 interaction tests, 26 structure tests, 21 contrast tests, 2 baseline tests).
  - `pnpm build`: Exit code 0 (Next.js production build compiled successfully).
- **Results:** Shared UI primitives are fully accessible, interaction-verified, and ready for route shells.
- **Acceptance criteria met:**
  - [x] Primitives have keyboard, focus, labels, loading, disabled and error states verified through real user interaction tests.
  - [x] Unit and interaction tests exist and pass (51 tests in `primitives.test.tsx` and `interactions.test.tsx`, 74 total across workspace).
  - [x] All 12 primitives implemented and exported via `src/components/ui/index.ts`.
- **Blockers/decisions:** None. All work remains local.
- **Next task ID:** VO-014 — Create application route shells

## Task report: VO-012

- **Task ID:** VO-012
- **Status:** DONE
- **Summary:** Implemented and audited canonical VyapOne design tokens, brand identity, typography scale, 4px spacing, radii, elevation shadows, restrained glassmorphism, and WCAG 2.2 AA touch targets.
  1. **Canonical Brand Palette (`src/design-system/tokens.ts`):** Codified canonical brand identity tokens: Canonical Brand Emerald (`#0F5132`) with accessible white text (9.36:1 AAA) and Canonical Brand Marigold (`#D97706`) with accessible dark text (5.30:1 AA), alongside PRD Section 12.2 UI action shades (`#0B6E4F` Action Emerald, `#F5A524` Accent Marigold, `#0A3D2E` Deep Green).
  2. **Global CSS Custom Properties (`src/app/globals.css`):** Exposed all tokens centrally as CSS variables with base reset, accessible `:focus-visible` ring, `.glass-surface` utility, and `@supports not (backdrop-filter)` fallback.
  3. **Contrast Calculation Audit (`src/design-system/contrast.ts`, `tests/unit/tokens/contrast.test.ts`):** Built automated Vitest test suite (21 tests) calculating exact WCAG 2.2 relative luminance without pre-rounding. Verified White on Brand Emerald (9.36:1), Dark text on Brand Marigold (5.30:1), White on Action Emerald (6.25:1), Dark text on Accent Marigold (8.27:1), Dark text on Canvas (15.91:1), Danger Red (6.17:1), corrected Warning Amber to 5.02:1, and corrected Info Slate-Teal to 7.68:1. Strictly enforced failure rule for White on Marigold (2.04:1).
  4. **Token Parity Test:** Automated test verifying exact parity between `tokens.ts` and `src/app/globals.css`.
  5. **Core UI Refactoring (`src/app/page.tsx`):** Eliminated all scattered hardcoded colors; refactored application baseline to consume semantic tokens via CSS custom properties.
  6. **Responsive Verification Boundary:** Verified CSS layout rules, fluid `clamp()` type scaling, and box-sizing constraint. Clarified that full headless browser E2E automated viewport verification is scheduled for `VO-015`.
  7. **Documentation (`docs/DESIGN_TOKENS.md`):** Formulated comprehensive design tokens specification, brand rationale, and contrast matrix.
- **Files added/modified:**
  - Added: `src/design-system/tokens.ts`
  - Added: `src/design-system/contrast.ts`
  - Added: `src/design-system/index.ts`
  - Added: `src/app/globals.css`
  - Added: `tests/unit/tokens/contrast.test.ts`
  - Added: `docs/DESIGN_TOKENS.md`
  - Modified: `src/app/layout.tsx` (imported globals.css)
  - Modified: `src/app/page.tsx` (consumed design tokens)
  - Modified: `docs/TASK_BACKLOG.md` (marked VO-012 as DONE)
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Commands/tests run:**
  - `pnpm install --frozen-lockfile`: Exit code 0 (clean).
  - `pnpm typecheck`: Exit code 0 (zero TypeScript errors).
  - `pnpm lint`: Exit code 0 (zero ESLint errors or warnings).
  - `pnpm format:check`: Exit code 0 (All matched files use Prettier code style).
  - `pnpm test`: Exit code 0 (2 test files passed, 23 tests passed).
  - `pnpm build`: Exit code 0 (Next.js production build compiled successfully).
- **Results:** Design tokens are centralized, fully accessible, and verified.
- **Acceptance criteria met:**
  - [x] Tokens are centralized in `tokens.ts` and `globals.css`.
  - [x] No scattered hardcoded brand colors in core UI.
  - [x] Contrast checked and verified via automated tests.
- **Blockers/decisions:** Confirmation of remote GitHub repository name (`VyaponeV1` vs `VyaponeV2`) requires project owner decision.
- **Next task ID:** VO-013 — Build accessible shared UI primitives

## Task report: VO-011

- **Task ID:** VO-011
- **Status:** DONE
- **Summary:** Configured comprehensive code quality, linting, formatting, type checking, and unit testing tooling:
  1. **ESLint (`eslint.config.mjs`):** Configured modern ESLint 9 Flat Config with Next.js core web vitals and TypeScript rules (`@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-unused-vars: error`, `prefer-const: error`, `no-console: warn`). Set explicit ignore patterns (`.next/`, `node_modules/`, `dist/`, `build/`, `coverage/`, `reference/`).
  2. **Prettier (`.prettierrc`, `.prettierignore`):** Configured consistent code formatting (2-space indentation, double quotes, trailing commas, LF line endings, `proseWrap: preserve`). Protected existing documentation (`docs/`, `reference/`, root `.md` files) from automated reformatting.
  3. **TypeScript:** Maintained strict type-checking configuration (`tsc --noEmit`). Verified zero compiler errors.
  4. **Test Tooling (`vitest.config.ts`):** Configured Vitest test runner with path aliases (`@/*` mapping to `./src/*`). Created baseline test harness in `tests/unit/baseline.test.ts` verifying test execution and integer minor units arithmetic.
  5. **Package Scripts (`package.json`):** Standardized scripts:
     - `pnpm dev`: Starts Next.js development server.
     - `pnpm build`: Compiles production build.
     - `pnpm typecheck`: Executes `tsc --noEmit`.
     - `pnpm lint` / `pnpm lint:fix`: Executes ESLint CLI.
     - `pnpm format:check` / `pnpm format:write`: Executes Prettier.
     - `pnpm test` / `pnpm test:watch`: Executes Vitest.
  6. **pnpm Security Policy (`pnpm-workspace.yaml`):** Approved trusted build script for `esbuild` using official pnpm 11+ `allowBuilds` policy.
- **Files added/modified:**
  - Added: `eslint.config.mjs`
  - Added: `.prettierrc`
  - Added: `.prettierignore`
  - Added: `vitest.config.ts`
  - Added: `tests/unit/baseline.test.ts`
  - Added: `pnpm-workspace.yaml`
  - Modified: `package.json`
  - Modified: `pnpm-lock.yaml`
  - Modified: `docs/TASK_BACKLOG.md` (marked VO-011 as DONE)
  - Modified: `docs/PROGRESS.md`
  - Modified: `docs/CHANGELOG.md`
- **Commands/tests run:**
  - `pnpm install --frozen-lockfile`: Exit code 0 (verified lockfile consistency).
  - `pnpm typecheck`: Exit code 0 (zero TypeScript errors).
  - `pnpm lint`: Exit code 0 (zero ESLint errors or warnings).
  - `pnpm format:check`: Exit code 0 (All matched files use Prettier code style).
  - `pnpm test`: Exit code 0 (1 test file passed, 2 tests passed).
  - `pnpm build`: Exit code 0 (Next.js production build succeeded in 4.1s).
- **Results:** Code quality tooling is fully operational, verified, and CI-ready.
- **Acceptance criteria met:**
  - [x] Documented scripts run successfully.
  - [x] CI can call the same scripts.
  - [x] Compatible package versions installed without breaking existing workspace.
- **Blockers/decisions:** None for VO-011.
- **Next task ID:** VO-012 — Implement design tokens
