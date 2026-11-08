# VyapOne Development Changelog

Record implementation changes by task ID. Do not record planned work as completed.

## Unreleased

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
