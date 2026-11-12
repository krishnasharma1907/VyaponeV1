# VyapOne Development Changelog

Record implementation changes by task ID. Do not record planned work as completed.

## Unreleased

### [VO-017] — Implement Supabase Client and Database Connection Foundation (2026-11-12)
- Implemented strongly-typed Supabase client infrastructure and database connection foundation with compile-time and runtime security isolation:
  - Installed `@supabase/ssr` (`0.12.7`) and `@supabase/supabase-js` (`2.119.0`).
  - Browser Client (`src/lib/supabase/client.ts`): Client-safe factory `createBrowserSupabaseClient()` using `@supabase/ssr`, restricted to public allowlisted configuration (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) with browser singleton memoization.
  - Server Client (`src/lib/supabase/server.ts`): Server-only factory `createServerSupabaseClient(customCookies?)` guarded by `import "server-only"`, supporting Next.js 15 async `cookies()` with `getAll`/`setAll` and request-scoped lifecycle enforcing PostgreSQL Row-Level Security (RLS) under the requesting user's identity.
  - Middleware Session Helper (`src/lib/supabase/middleware.ts`): Session updater `updateSession(request)` refreshing auth sessions via `supabase.auth.getUser()` and synchronizing cookies between request and response headers.
  - Administrative Client (`src/lib/supabase/admin.ts`): Privileged service-role factory `createAdminSupabaseClient(customEnv?)` guarded by `import "server-only"`, disabling session persistence, strictly reserved for platform tenant provisioning, webhook verification, and audit logs.
  - Database Types Foundation (`src/lib/supabase/types.ts`): Strongly-typed `Database` interface representing all 13 canonical entities from `docs/diagrams/core-erd.mmd` (`users`, `user_auth_identities`, `workspaces`, `workspace_members`, `businesses`, `locations`, `business_members`, `sites`, `catalogue_items`, `orders`, `customers`, `bills`, `audit_logs`).
  - Database Connection & Pooler Foundation (`src/lib/database/index.ts`): Reconciled ADR-002, ADR-003, and ADR-004 for Cloudflare Workers edge runtime; implemented `inspectDatabaseConfig()` safely identifying Supavisor transaction poolers (port 6543 / `?pgbouncer=true`), session poolers (port 5432), and direct connections without persistent socket leaks on import.
  - Architecture Documentation (`docs/DATABASE_ARCHITECTURE.md`): Authored comprehensive specification covering execution boundaries, serverless connection pooling, Cloudflare Workers compatibility, environment matrix, RLS protection boundaries, and $0-budget free-tier constraints.
  - Automated Unit Tests: Authored 23 tests across 6 files (`tests/unit/supabase/browser-client.test.ts`, `server-client.test.ts`, `admin-client.test.ts`, `boundary.test.ts`, `types.test.ts`, and `tests/unit/database/connection.test.ts`). Total test suite expanded to 164 passing tests across 15 files (100% pass rate).
  - Verified all repository quality gates pass: `pnpm format:check` (clean), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (164 tests pass), and `pnpm build` (30/30 pages compiled).
  - Updated backlog status for VO-017 to `DONE` and recorded progress.

### [VO-016] — Implement application configuration and environment handling (2026-11-12)
- Implemented secure, typed, validated application configuration foundation with strict server vs. client runtime isolation:
  - Validation Engine (`src/config/env.ts`): Built Zod schemas (`publicEnvSchema`, `serverCoreEnvSchema`, `optionalIntegrationsEnvSchema`) validating environment variables, port ranges, URL formatting, and PostgreSQL connection protocols.
  - Secret Protection & Error Sanitization: Created `ConfigurationError` class enforcing the zero-leak rule; error messages report invalid paths and expected formats without printing actual secrets or partial passwords.
  - Public Client Configuration (`src/config/public.ts`): Established an allowlisted client-safe configuration object extracting only `NEXT_PUBLIC_*` variables (`NEXT_PUBLIC_APP_ENV`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`), safe for import in React Client Components.
  - Server-Only Privileged Configuration (`src/config/server.ts`): Enforced compile-time and runtime isolation using Next.js `import "server-only"`; encapsulates database connection strings, Supabase service-role keys, session encryption secrets, and third-party integration credentials.
  - Central Barrel Export (`src/config/index.ts`): Clean barrel export providing public config, schemas, and validator utilities, excluding direct server secret exports to prevent accidental client bundling.
  - Production Invariants: Enforced that `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET` (min 32 chars), and Supabase public credentials are strictly required when `NODE_ENV === "production"`.
  - Optional Integrations Resilience: Enabled safe defaults with `isConfigured: false` for unconfigured optional integrations (payments, WhatsApp, AI, storage, Redis) so local development can run without live third-party accounts.
  - Cloudflare Runtime Context Support: Designed `validateEnvironment(rawEnv?)` to accept explicit runtime dictionary bindings (e.g., `context.env` in Cloudflare Pages/Workers) with fallback to `process.env`.
  - Updated Configuration Template (`.env.example`): Restructured into Public, Server Core, and Optional Integration sections with local development instructions and Cloudflare secret guidance.
  - Git Protection (`.gitignore`): Added `.dev.vars` and `.dev.vars.local` to prevent accidental staging of Cloudflare local secret files.
  - Decision Register (`docs/DECISION_REGISTER.md`): Updated ADR-003 (Supabase full backend platform) and ADR-004 (Cloudflare hosting direction) reflecting approved project directions.
  - Architecture Documentation (`docs/CONFIGURATION.md`): Authored comprehensive configuration architecture reference covering variable classification, Cloudflare runtime context, Supabase credential separation, and secret-management rules.
  - Automated Unit Tests: Authored 19 tests across `tests/unit/config/env.test.ts`, `tests/unit/config/server.test.ts`, and `tests/unit/config/client-boundary.test.ts` validating dev/prod parsing, missing production credentials, format validation, secret redaction, Cloudflare context evaluation, and client-boundary errors. Total test suite reached 141 passing tests across 9 files (100% pass rate).
  - Verified all quality gates pass: `pnpm format:check` (clean), `pnpm lint` (0 errors, 0 warnings), `pnpm typecheck` (0 errors), `pnpm test` (141 tests pass), and `pnpm build` (30/30 pages compiled).
  - Updated backlog status for VO-016 to `DONE` and updated progress log.

### [VO-015] — Create responsive layout and mobile interaction foundation (2026-11-11)
- Implemented complete responsive layout foundation and mobile interactions across all 6 application route shells and root portal:
  - Responsive Design Tokens (`src/design-system/tokens.ts`): Exported canonical breakpoints (`xs: 320px`, `sm: 390px`, `md: 768px`, `lg: 1024px`, `xl: 1440px`), safe-area insets (`env(safe-area-inset-*, 0px)`), dynamic page gutters (`mobile: 16px`, `tablet: 24px`, `desktop: 32px`), and WCAG 2.2 AA compliant touch target constants.
  - Root Viewport Configuration (`src/app/layout.tsx`): Added `viewportFit: "cover"` to Next.js `Viewport` object to enable notch and home indicator safe area calculation across iOS and Android devices.
  - Global Responsive Utilities (`src/app/globals.css`):
    - Added CSS custom properties `--safe-area-top/right/bottom/left` with `0px` fallbacks.
    - Added responsive `--page-gutter` scaling via `@media (min-width: 768px)` and `(min-width: 1024px)`.
    - Added `.app-container` and `.app-header` container utilities integrating safe-area insets and gutters.
    - Added dynamic viewport height utility `.min-h-screen-safe` (`100vh` + `100dvh`) protecting full-height layouts against mobile virtual keyboard popping.
    - Enforced 16px (`1rem`) minimum font size on form controls to permanently prevent iOS Safari auto-zoom.
    - Added responsive navigation rules: mobile bottom bar (`.ui-nav-bottom-bar`) hidden on desktop (`>= 769px`); desktop owner navigation (`.owner-desktop-nav`) hidden on mobile (`<= 768px`).
    - Added `.has-bottom-bar` utility ensuring page content is never obscured by the fixed bottom navigation bar.
    - Added `.ui-nav-scrollable` horizontal momentum scroll utility with hidden scrollbars for multi-tab mobile headers.
    - Added `.ui-table-container` allowing keyboard-accessible table horizontal scrolling without breaking root page viewport containment.
  - Layout Normalization: Upgraded all route group layouts (`(auth)`, `(public)`, `(reseller)`, `(owner)`, `(staff)`, `(admin)`) and root `src/app/page.tsx` with responsive layout classes and safe-area padding.
  - Unit Tests (`tests/unit/responsive/responsive-foundation.test.ts`): Authored 14 automated unit tests verifying token parity, safe-area variables, gutter scaling, touch targets, reduced motion queries, and viewport metadata. Total test count reached 122 passing tests across 6 files.
  - Automated Browser Validation (`scripts/validate-responsive.mjs`): Built Playwright test runner executing 35 checks across 7 core routes (`/login`, `/s/demo-store`, `/workspace`, `/dashboard`, `/dashboard/billing`, `/counter/pos`, `/platform-admin`) at 5 viewports (`320x568`, `390x844`, `768x1024`, `1024x768`, `1440x900`). Confirmed 100% pass rate with zero horizontal overflow (`docScrollWidth <= winInnerWidth`). Captured 35 screenshot artifacts to `docs/evidence/screenshots/`.
  - Architecture Documentation: Authored `docs/RESPONSIVE_DESIGN.md` detailing responsive philosophy, breakpoint definitions, safe area ergonomics, touch targets, and browser test results.
  - Verified all quality gates pass: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), `pnpm format:check` (clean), `pnpm test` (122 tests pass), `pnpm build` (30/30 pages compiled), and `pnpm test:responsive` (35/35 checks pass).
  - Updated backlog status for VO-015 to `DONE` and updated progress log.

### [VO-014] — Create application route shells (2026-11-11)
- Implemented comprehensive Next.js 15 App Router route shells and role-aware navigation hierarchy across 28 authored application routes (27 static page files + 1 dynamic route `/s/[subdomain]`) without URL collisions:
  - `(auth)` Route Group: Dedicated layout and placeholder authentication entry points for `/login` and `/register`.
  - `(public)` Route Group: Customer-facing touchpoints including dynamic merchant subdomain storefronts `/s/[subdomain]` and statutory draft DPDP grievance privacy policy page `/privacy` (marked with clear warning as draft template pending official legal entity registration and DPO designation).
  - `(reseller)` Route Group: Multi-client agency portal with persistent navigation for `/workspace`, `/workspace/clients`, `/workspace/billing`, `/workspace/team`, and `/workspace/settings`. Removed mock metrics/tables and disabled action controls pending Phase P11 (`VO-110`) and Phase P8 (`VO-085`).
  - `(owner)` Route Group: Sovereign merchant business operations portal with desktop navigation and mobile bottom bar (44px+ touch targets) covering `/dashboard`, `/dashboard/catalogue`, `/dashboard/orders`, `/dashboard/billing`, `/dashboard/customers`, `/dashboard/whatsapp`, `/dashboard/website`, `/dashboard/analytics`, and `/dashboard/settings`. Replaced mock metrics with placeholders and disabled mutation buttons pending Phase P6/P8/P9.
  - `(staff)` Route Group: Distraction-free, high-contrast staff counter terminal for in-store clerks covering `/counter`, `/counter/pos`, and `/counter/unlock`. Disabled PIN and print actions pending shift session integration in Phase P11 (`VO-110`).
  - `(admin)` Route Group: Global platform administration and compliance console covering `/platform-admin`, `/platform-admin/tenants`, `/platform-admin/plans`, `/platform-admin/taxes`, `/platform-admin/audit-logs`, and `/platform-admin/abuse`. Replaced fake tenant numbers with placeholders and disabled mutation buttons.
- Cleaned root layout `src/app/layout.tsx` to serve as a pure HTML/body shell, eliminating nested `<main>` landmark collisions.
- Created discovery portal showcase at `src/app/page.tsx` with role navigation cards, status badges, and architecture guarantees; explicitly framed as a developer-only route showcase during Phase P1.
- Fixed React Server Component serialization boundaries in UI primitives by marking `Button` and `Field` with `"use client";`, resolving event handler serialization and React Context (`createContext`) errors during production build.
- Authored architecture reference `docs/ROUTE_ARCHITECTURE.md` documenting route-to-role mappings, layout trees, client vs server component boundaries, security delineation, and resolving the 28 application routes vs 30 Next.js static prerender units.
- Authored 34 unit tests in `tests/unit/routing/route-shells.test.tsx` verifying route rendering, ARIA navigation landmarks, accessible link targets, and role navigation isolation.
- Total test count reached 108 passing tests across 5 test files with 100% test pass rate.
- Verified all quality gates pass: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors), `pnpm format:check` (clean), `pnpm test` (108 tests pass), and `pnpm build` (28 application routes + internal pages compiled).
- Updated backlog status for VO-014 to `DONE`, updated decision register ADR-015, and updated progress log.

### [VO-013] — Build accessible shared UI primitives (2026-11-11)
- Implemented 12 accessible shared UI component primitives adhering to WCAG 2.2 AA and PRD Section 12 design specifications:
  - `Button` (`src/components/ui/button`): Variants (`primary`, `secondary`, `outline`, `ghost`, `destructive`, `accent`), sizes (`sm`, `md`, `lg`), `isLoading` with spinner, `aria-busy`, disabled state preventing duplicate submissions, and accessible touch targets.
  - `Field`, `Input`, `Textarea`, `Select`, `Checkbox` (`src/components/ui/field`): Accessible form family with explicit `htmlFor` / `id` association, `aria-required`, `aria-invalid`, `aria-describedby` linking helper and error IDs, 16px minimum text preventing iOS Safari zoom, and `role="alert"` for error messages.
  - `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`, `CardAction` (`src/components/ui/card`): Semantic card surfaces supporting `default`, `elevated`, `glass`, and `subtle` styles with configurable heading levels.
  - `Dialog` (`src/components/ui/dialog`): Accessible modal dialog with focus trapping, Escape dismiss, backdrop dismiss, focus restoration, and body scroll lock.
  - `Drawer` (`src/components/ui/drawer`): Accessible mobile-first bottom sheet with drag handle, focus management, and body scroll lock.
  - `Tabs` (`src/components/ui/tabs`): Accessible tab panels with `role="tablist"`, `role="tab"`, `role="tabpanel"`, and keyboard navigation (Arrow keys, Home, End).
  - `Table` (`src/components/ui/table`): Responsive table container with `role="region"` and `tabIndex={0}`, standard HTML table semantics, and explicit `scope="col"`.
  - `Badge` (`src/components/ui/badge`): Semantic status tags with visible text (not color alone) and optional decorative icons.
  - `EmptyState` (`src/components/ui/empty-state`): Standardized zero-data state with `role="region"`, decorative icon, heading, description, and action buttons.
  - `Skeleton` (`src/components/ui/skeleton`): Loading placeholders with `aria-hidden="true"`, pulse animation, and reduced-motion support.
  - `Toast` (`src/components/ui/toast`): Notification toast system with live regions (`polite` for info/success/warning, `assertive` for errors) and accessible dismissal.
  - `Navigation` (`src/components/ui/navigation`): Semantic `<nav>` landmark with required `aria-label`, list structure, and links with `aria-current="page"`.
- Created central barrel export at `src/components/ui/index.ts`.
- Appended component styling rules to `src/app/globals.css` consuming existing design tokens (`--color-*`, `--space-*`, `--radius-*`, `--shadow-*`, `--target-*`).
- Authored 26 static structure unit tests in `tests/unit/components/primitives.test.tsx` verifying static HTML rendering, ARIA attributes, semantic roles, loading states, and error alerts.
- Conducted interactive accessibility audit and authored 25 real user interaction tests in `tests/unit/components/interactions.test.tsx` covering mouse/keyboard activation, double-submission protection, label focus linking, native required states, dialog & drawer focus traps with Escape dismiss, focus return to triggers, body scroll locking/restoration, tabs arrow navigation, mobile table scroll regions, and live-region toasts.
- Installed `@testing-library/react`, `@testing-library/user-event`, and `jsdom` (with React 19 compatibility) and configured `environment: "jsdom"` in `vitest.config.ts`.
- Total test count reached 74 passed tests across 4 test files.
- Verified all quality gates pass: `pnpm typecheck` (0 errors), `pnpm lint` (0 errors/warnings), `pnpm format:check` (clean), `pnpm test` (74 tests pass), and `pnpm build` (Next.js production build compiled).
- Updated backlog status for VO-013 to `DONE` and updated progress log.

### [VO-012] — Implement design tokens (2026-11-08)
- Created canonical design token definitions in `src/design-system/tokens.ts` codifying Canonical Brand Emerald (`#0F5132`) + Canonical Brand Marigold (`#D97706`), PRD Section 12 UI Action Emerald (`#0B6E4F`) + Accent Marigold (`#F5A524`) palette, warm canvas (`#FAF8F3`), card surface (`#FFFFFF`), responsive typography scale (with 16px mobile input minimum to prevent iOS zoom), 4px spacing scale, radii, elevation shadows, restrained glassmorphism (`rgba(255,255,255,0.80)` with 12px blur and opaque fallback), and WCAG 2.2 AA touch targets (`>= 24px` minimum, `44-48px` preferred).
- Implemented global CSS custom properties in `src/app/globals.css` with baseline reset, accessible `:focus-visible` ring, `.glass-surface` utility, and `@media (prefers-reduced-motion)` preferences.
- Built mathematical WCAG 2.2 relative luminance and contrast calculation utilities in `src/design-system/contrast.ts` without pre-rounding.
- Conducted corrective audit of contrast ratios, establishing exact mathematical figures: Warning Amber (`#B45309`) at 5.02:1 (passes AA) and Info Slate-Teal (`#0C5A75`) at 7.68:1 (passes AAA).
- Expanded automated Vitest test suite `tests/unit/tokens/contrast.test.ts` to 21 tests, validating unrounded contrast ratios, hex validation, touch targets, and automated parity between `tokens.ts` and `src/app/globals.css`.
- Refactored `src/app/page.tsx` and `src/app/layout.tsx` to consume design tokens via CSS variables, eliminating all scattered hardcoded colors from the application baseline.
- Formulated complete design tokens specification in `docs/DESIGN_TOKENS.md`.
- Updated backlog status for VO-012 to `DONE` and updated progress log.

### [VO-011] — Configure code quality tooling (2026-11-08)
- Configured ESLint 9 Flat Config (`eslint.config.mjs`) integrating Next.js 15 (`core-web-vitals`, `typescript`) with FlatCompat and strict TypeScript rules (`@typescript-eslint/no-explicit-any: error`, `@typescript-eslint/no-unused-vars: error`, `prefer-const: error`, `no-console: warn`).
- Configured Prettier 3 (`.prettierrc`) with 2-space indentation, double quotes, semicolons, trailing commas, and LF line endings.
- Configured `.prettierignore` protecting repository documentation (`docs/`), PRDs (`reference/`), agents/rules, and generated artifacts from reformatting.
- Configured Vitest 3 (`vitest.config.ts`) with Node environment and `@/*` path alias resolution.
- Added baseline unit test harness (`tests/unit/baseline.test.ts`) validating test runner execution and integer minor unit arithmetic.
- Approved trusted build script for `esbuild` in `pnpm-workspace.yaml` under pnpm 11 security policy.
- Added standard scripts in `package.json`: `dev`, `build`, `start`, `typecheck`, `lint`, `lint:fix`, `format:check`, `format:write`, `test`, and `test:watch`.
- Verified all quality gates pass: `pnpm install --frozen-lockfile` (clean), `pnpm typecheck` (0 errors), `pnpm lint` (0 errors/warnings), `pnpm format:check` (clean), `pnpm test` (2 tests passing), and `pnpm build` (production build compiled).
- Corrected package specifiers for `next` and `eslint-config-next` to `^15.5.29` in `package.json` and `pnpm-lock.yaml`, ensuring consistent lockfile alignment with the verified runtime version `15.5.29`.
- Updated backlog status for VO-011 to `DONE` and updated progress log.

### [VO-010] — Initialize or normalize application workspace (2026-11-08)
- Initialized Git repository at `F:\VyaponeV2` on branch `main`.
- Created `.gitignore` ignoring dependencies (`node_modules`), build outputs (`.next`, `out`, `dist`), secrets/env files (`.env*`), local databases, logs, and IDE caches.
- Created `.gitattributes` normalizing text and source files to LF line endings and enforcing binary handling for media and fonts.
- Created `.editorconfig` enforcing UTF-8, LF, and 2-space indentation standards across all editors.
- Created `.env.example` template with sanitized environment variables for auth, database, redis, payment sandbox, and WhatsApp.
- Initialized workspace package manifest (`package.json`) and TypeScript configuration (`tsconfig.json`) adhering to `docs/ENGINEERING_STANDARDS.md`.
- Installed Next.js 15.5.29, React 19.3.1, React-DOM 19.3.1, and TypeScript 5.9.3 via `pnpm`.
- Created minimal baseline application shell (`src/app/layout.tsx` and `src/app/page.tsx`) with mobile viewport settings.
- Verified that `pnpm install`, `pnpm build`, and `pnpm dev` execute successfully with verified `200 OK` local server response.
- Preserved all existing documentation and source PRDs without deletion or modification.
- Updated backlog status for VO-010 to `DONE`.

### [VO-006] — Create implementation conventions and quality gates (2026-11-08)
- Created `docs/ENGINEERING_STANDARDS.md` codifying TypeScript strict mode, React Server Component patterns, layered 3-tier architecture, shared Zod input validation, gap-free invoice sequences, unified API envelopes, PII sanitization, and trunk-based Git workflow. Clearly distinguished approved invariants from proposed stack decisions.
- Created `docs/PROJECT_STRUCTURE.md` documenting scalable file and directory layout for Public storefronts, Reseller workspace, Business Owner dashboard, Staff counter mode, Platform Admin, reusable modules, background BullMQ workers, and test suites. Documented only; zero premature application files created.
- Created `docs/TEST_STRATEGY.md` formulating the multi-harness test pyramid (unit, integration, DB/RLS, payment HMAC, Vya AI golden evals, prompt injection, quiet hours, 390px Playwright mobile E2E, WCAG 2.2 AA accessibility, and k6 load testing) reusing established test IDs without duplicates.
- Created `docs/QUALITY_GATES.md` establishing measurable pass/fail criteria across Tier 1 Development Gates (types, lint, tests, RLS, Zod, secrets, 390px mobile layout), Tier 2 Phase Gates (P0 to P14), and Tier 3 GA Release Gates (CA GST review, Legal DPDP review, Split Settlement contract, CERT-In runbook, zero P0/P1 defects).
- Created `docs/CODE_REVIEW_CHECKLIST.md` providing a systematic peer review checklist covering tenancy, security, transactions, validation, errors, mobile UI, accessibility, performance, logging, tests, and documentation.
- Corrected native PostgreSQL `uuidv7()` statement in `docs/DOMAIN_ARCHITECTURE.md` to specify it as a PostgreSQL 18 native feature (not 17) while retaining application-layer RFC 9562 UUIDv7 generation as the database-independent standard.
- Updated `AGENTS.md` and `.agents/skills/vyapone-build/SKILL.md` to reference the canonical engineering standards, reinforce single-task execution, test verification, regression fixing, secret protection, and ban unrun test claims.
- Formally verified and signed off Phase P0 gate in `docs/PHASE_GATES.md`.
- Updated backlog status for VO-006 to `DONE`.

### [VO-005] — Design domain architecture and data ownership (2026-11-08)
- Created and audited `docs/DOMAIN_ARCHITECTURE.md` establishing the canonical domain model and database architecture across 11 comprehensive sections.
- Created and expanded Mermaid architectural diagrams in `docs/diagrams/`:
  - `system-context.mmd`: C4 context diagram showing users, platform core, and third-party partner boundaries.
  - `container-diagram.mmd`: C4 container diagram illustrating edge routing, Next.js application core, BullMQ queues, PostgreSQL, Redis, and S3 storage.
  - `ownership-model.mmd`: Architectural breakdown separating Data Ownership, Administrative Access, Billing Responsibility, and Platform Access, with auditable handover transfer records.
  - `core-erd.mmd`: Master entity-relationship diagram covering core tenancy, commerce, billing, and communication entities.
  - `erd-iam-tenancy.mmd`: Dedicated module ERD for IAM, User, UserAuthIdentity, Workspace, Business, BusinessMember, Location, and HandoverRequest.
  - `erd-commerce-billing.mmd`: Dedicated module ERD for Orders, OrderItems, Bills, InvoiceSequences, TaxRates, PaymentRecords, Subscriptions, and ClientInvoices.
  - `erd-communications-ai.mmd`: Dedicated module ERD for Conversations, ConversationTurns, BusinessMemory, AIActions, PendingActions, MessageTemplates, Messages, Broadcasts, and Automations.
  - `erd-niche-operations.mmd`: Dedicated module ERD for Leads, Catalogue, Inventory, Appointments, Property Listings, Restaurant Tables, KOT Tickets, Service Tickets, and Loyalty Ledgers.
- Performed rigorous corrective review addressing all 10 architectural and integrity requirements:
  - **ERD Completeness:** Fully modeled all PRD entities across the master core and 4 modular ERDs, documenting ownership, tenant scoping column, and relationships.
  - **Auth Provider Separation:** Decoupled external identity credentials (`UserAuthIdentity`) from application user profiles (`User`); explicitly barred storing passwords in the application domain.
  - **UUIDv7 Precision:** Corrected PostgreSQL 17+/18+ native function syntax to `uuidv7()` and documented all supported runtime alternatives (`pg_uuidv7` extension, application-layer RFC 9562 generation, and UUIDv4 fallback).
  - **Multi-Currency Standardization:** Standardized on `amount_minor BIGINT` and `currency_code VARCHAR(3)` (ISO 4217, default `'INR'`) across all financial tables; documented minor-unit scaling across 2-decimal, 0-decimal, and 3-decimal currencies.
  - **Customer Phone Constraints:** Replaced `UNIQUE(business_id, phone_hash)` with a non-unique B-tree index to support shared family phone numbers, corporate multi-contacts, and walk-ins.
  - **Gap-Free GST Invoice Numbering:** Designed atomic, gap-free sequence counter table `invoice_sequences` using row-level locking (`UPDATE ... RETURNING`) per business, financial year, and series prefix (`INV/`, `POS/`, `BOS/`, `CRN/`, `DBN/`).
  - **Auditable Business Handover:** Designed `handover_requests` schema and state machine with registered owner OTP verification (WhatsApp/SMS + email), source reseller detachment, target workspace assignment, domain/SSL retention, and split settlement decoupling.
  - **Statutory CGST Section 36 Correction:** Accurately cited Section 36 of CGST Act 2017 (72 months from the due date of furnishing the annual return for the financial year, plus extensions/appeal holds); marked unified retention/deletion policy `NEEDS CA/LEGAL REVIEW`.
  - **Security Architecture:** Classified all technical controls as `PROPOSED`. Rechecked transaction-scoped `SET LOCAL` RLS context propagation, S3 tenant-partitioned storage, webhook HMAC and replay defenses, and BullMQ background worker context isolation.
  - **Traceability:** Mapped every entity directly to its PRD section and existing task ID in `docs/DOMAIN_ARCHITECTURE.md` and updated `docs/REQUIREMENTS_TRACEABILITY.md`.
- Updated backlog status for VO-005 to `DONE`.

### [VO-004] — Define system boundaries and threat model (2026-11-08)
- Created `docs/THREAT_MODEL.md` establishing the canonical security architecture, system boundaries, and threat model.
- Defined all 7 actor boundaries (Platform Admin, Reseller, Business Owner, Staff, Customer, Public Storefronts, Vya AI, External Integrations) and mapped 8 distinct trust zones with a complete Mermaid architectural boundary diagram.
- Identified and classified 8 sensitive asset groups (AST-01 to AST-08).
- Conducted full STRIDE threat analysis covering spoofing, tampering, repudiation, information disclosure, denial of service, and elevation of privilege.
- Formulated multi-tenant isolation mechanisms via dual-layer Next.js API authorization and PostgreSQL Row-Level Security (RLS).
- Defined payment security controls (HMAC SHA256 webhook signatures, timestamp windowing, idempotent event caching, zero card storage, RBI-compliant split settlement).
- Formulated Vya AI prompt-injection defenses (untrusted data encapsulation, confirm-before-act `PendingAction` tokens, tool allow-lists, per-business memory isolation, pre-flight PII redaction).
- Formulated third-party integration security (OAuth AES-256-GCM encryption, presigned S3 upload MIME/size validation).
- Populated comprehensive threat register with 20 attack scenarios (THR-01 to THR-20), severity ratings, and proposed mitigations.
- Defined a 10-point automated security test plan (ST-TENANT-01 to ST-SECRET-01) mapped to upcoming development tasks.
- Updated backlog status for VO-004 to `DONE`.

### [VO-003] — Create architecture decision records (2026-11-08)
- Created `docs/ADR_INDEX.md` and 25 comprehensive Architecture Decision Records in `docs/adr/` (ADR-001 through ADR-025) covering all required architecture, infrastructure, provider, and operational areas.
- Preserved existing numbering and established ADR-001 to ADR-025 with zero collisions and verified linkages.
- Established candidate stack recommendations: Next.js 15+ (App Router) + React 19 + TypeScript + Tailwind CSS, PostgreSQL 16+ with Drizzle ORM and native RLS multi-tenancy, Supabase Auth and S3-compatible storage, Vercel/Cloudflare edge deployment and custom SSL, Puck constrained visual editor, Redis + BullMQ event-driven queues, Vercel AI SDK multi-model routing (Claude Sonnet 5.5, Gemini Flash, Haiku, Sarvam speech), WhatsApp BSP Cloud API route, and merchant payment gateway adapter framework.
- Maintained the 3 critical launch blockers: ADR-010 (Reseller split settlement provider), ADR-014 (Chartered Accountant GST review), ADR-015 (Legal Counsel DPDP sign-off).
- Added ADR-023 (Observability & Telemetry), ADR-024 (Testing Architecture & Golden Eval Suite), and ADR-025 (Security Threat Defense & Disaster Recovery) to `docs/DECISION_REGISTER.md`.
- Updated backlog status for VO-003 to `DONE`.

### [VO-002] — Create source-of-truth and conflict register (2026-11-08)
- Audited and expanded `docs/SOURCE_OF_TRUTH.md` into the canonical single source of truth and version conflict register.
- Defined the 4-tier document authority hierarchy (Tier 1: FINAL v2.0 Primary, Tier 2: v3.0 Supplementary Production Guidance, Tier 3: ADRs, Tier 4: Historical v1/v2).
- Built a comprehensive cross-version conflict register comparing v1, v2, v3, and FINAL across 15+ product and technical dimensions; recorded resolutions for all identified discrepancies.
- Separated confirmed product requirements from supplementary engineering recommendations (SLOs, load targets, DR, compliance).
- Cataloged decisions requiring product owner and legal approval; highlighted the 3 critical blockers (ADR-010 split settlement, ADR-014 GST rules, ADR-015 DPDP compliance).
- Audited and verified `docs/REQUIREMENTS_TRACEABILITY.md` source references against PRD line items.
- Documented the unsupported/incorrect claims register (debunking Dunzo, AI tax calculations, UPI claim = Paid, fund pooling, arbitrary code generation, fixed pricing).
- Identified `VO-010` in `docs/TASK_BACKLOG.md` as the existing task designated for application workspace and Git initialization; added ADR-022 to `docs/DECISION_REGISTER.md`.
- Updated backlog status for VO-002 to `DONE`.

### [VO-001] — Create requirements traceability map (2026-11-07)
- Created canonical requirements traceability matrix in `docs/REQUIREMENTS_TRACEABILITY.md`.
- Mapped all 23 Functional Requirements (FR-01 to FR-23), 9 Non-Functional Requirements (NFRs), 24 Product Modules (MOD-01 to MOD-24), 9 Niche Groups (NICHE-01 to NICHE-09), 13 Vya AI capabilities (VYA-01 to VYA-13), 11 Security/Compliance controls, 10 Payment/Billing capabilities, 8 WhatsApp/Automation rules, 7 Reseller Toolkit features, and 26 GA Acceptance Criteria (AC-01 to AC-26).
- Connected all requirements directly to exact existing backlog task IDs (`VO-000` through `VO-145`) and defined acceptance test IDs (`TC-*`).
- Performed gap analysis: confirmed 0 unmapped requirements and 0 orphaned backlog tasks; identified foundational/engineering infrastructure tasks and documented post-launch deferrals (`VO-140` to `VO-145`).
- Updated backlog status for VO-001 to `DONE`.

### [VO-000] — Inspect repository and PRD inputs (2026-11-07)
- Performed initial repository, runtime, and dependency audit; confirmed clean greenfield state with no application code, package manifests, or test suites.
- Audited all four source PRDs (`PRD_FINAL_v2_2026-11-03.md`, `PRD_v3_full_scale_2026-10-30.md`, `PRD_v2_2026-10-30.md`, `PRD_v1_original_2026-10-16.md`).
- Confirmed `PRD_FINAL_v2_2026-11-03.md` as primary source of truth, with `PRD_v3_full_scale_2026-10-30.md` as supplementary production/GA guidance.
- Created `docs/REPOSITORY_AUDIT.md` and `docs/SOURCE_OF_TRUTH.md`.
- Catalogued 21 architectural and operational choices in `docs/DECISION_REGISTER.md`.
- Updated backlog status for VO-000 to `DONE`.
