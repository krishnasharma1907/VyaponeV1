# VyapOne — Antigravity Task Backlog

**Execution rule:** one task per agent run. Do not jump ahead. Every task must pass its acceptance criteria before the next task starts.

**Statuses:** `NOT_STARTED` · `IN_PROGRESS` · `BLOCKED` · `DONE` · `DEFERRED_POST_LAUNCH`.

## P0 — Project audit, decisions and architecture

**Goal:** Make the source of truth, repo state, product boundaries and technical decisions explicit before feature coding.

### [x] VO-000 — Inspect repository and PRD inputs

**Scope:** Read all files in reference/PRD_VERSIONS. Inspect the existing repository, package files, git status, runtime, existing code and tests. Do not overwrite existing work. Produce docs/REPOSITORY_AUDIT.md and report what already exists.

**Acceptance:** Audit document exists; every PRD version is identified; existing code and commands are recorded; no implementation files changed.

**Status:** `DONE`

### [x] VO-001 — Create requirements traceability map

**Scope:** Create docs/REQUIREMENTS_TRACEABILITY.md mapping FINAL PRD sections and FRs to product modules, tasks and acceptance tests. Mark any missing or contradictory requirements.

**Acceptance:** Every launch-scope capability has an ID, source section, backlog task and test/acceptance reference, or is explicitly marked unresolved.

**Status:** `DONE`

### [x] VO-002 — Create source-of-truth and conflict register

**Scope:** Record document authority: FINAL v2.0 is primary; v3 is supplementary only where non-conflicting; v1/v2 are historical. Resolve conflicts in an ADR rather than silently merging them.

**Acceptance:** docs/SOURCE_OF_TRUTH.md explains authority and known conflicts; no older requirement silently overrides FINAL.

**Status:** `DONE`

### [x] VO-003 — Create architecture decision records

**Scope:** Create ADRs for frontend, backend/API, database, auth, storage, deployment/hosting, queue/cache, website editor, AI gateway, WhatsApp BSP, payment providers, split settlements and observability. Recommend choices with trade-offs; leave account/legal/provider decisions pending approval.

**Acceptance:** Each choice is Accepted, Provisional or Pending; decisions needing user/provider/legal approval are clearly listed; no secrets or external accounts are created.

**Status:** `DONE`

### [x] VO-004 — Define system boundaries and threat model

**Scope:** Document tenant boundaries, trust boundaries, public endpoints, admin/support access, payment flows, webhooks, AI tools, file uploads, messaging consent and sensitive actions.

**Acceptance:** Threat model and trust-boundary diagram exist; each high-risk area has a mitigation and test requirement.

**Status:** `DONE`

### [x] VO-005 — Design domain architecture and data ownership

**Scope:** Create context, container and core entity diagrams for Platform → Reseller Workspace → Business → Location. Define business ownership, memberships, handover and data export principles.

**Acceptance:** Architecture diagrams and entity ownership rules exist; every business-owned record is scoped to a business/location as applicable.

**Status:** `DONE`

### [x] VO-006 — Create implementation conventions and quality gates

**Scope:** Define TypeScript conventions, validation, migrations, testing, logging, accessibility, error handling, secrets, code review and definition of done.

**Acceptance:** docs/ENGINEERING_STANDARDS.md is approved and can be followed by subsequent tasks.

**Status:** `DONE`

## P1 — Repository, design system and application shell

**Goal:** Create a runnable, well-structured mobile-first application foundation without prematurely implementing business features.

### [x] VO-010 — Initialize or normalize application workspace

**Scope:** Set up the project using the stack accepted in ADRs. If a project already exists, adapt it instead of replacing it. Keep web/PWA first and TypeScript end-to-end where practical.

**Acceptance:** Install/build/dev commands work; application starts locally; no unrelated files or user work are deleted.

**Status:** `DONE`

### [x] VO-011 — Configure code quality tooling

**Scope:** Configure formatter, linting, type checks, test runner, import conventions and scripts.

**Acceptance:** Documented scripts run successfully; CI can call the same scripts.

**Status:** `DONE`

### [x] VO-012 — Implement design tokens

**Scope:** Implement FINAL PRD Emerald + Marigold palette, typography, spacing, radii, borders, shadows and focus tokens. Derive missing semantic/dark tokens with contrast checks and document provisional choices.

**Acceptance:** Tokens are centralized; no scattered hard-coded brand colours in core UI; contrast checked.

**Status:** `DONE`

### [x] VO-013 — Build accessible shared UI primitives

**Scope:** Create buttons, fields, cards, dialogs, drawers, tabs, tables, badges, empty states, skeletons, toasts and navigation primitives.

**Acceptance:** Primitives have keyboard, focus, labels, loading, disabled and error states; unit/component tests exist.

**Status:** `DONE`

### [x] VO-014 — Create application route shells

**Scope:** Create distinct public, reseller, business-owner, staff and platform-admin shells with role-aware navigation placeholders.

**Acceptance:** All shells render responsively; no role sees navigation for a module it cannot access.

**Status:** `DONE`

### [ ] VO-015 — Create responsive layout and mobile interaction foundation

**Scope:** Support PRD viewports 320, 390, 768, 1024 and 1440 px; safe areas, keyboard, touch targets and reduced motion.

**Acceptance:** No unintended horizontal overflow; primary tasks are usable at 390 px; reduced motion works.

**Status:** `NOT_STARTED`

### [ ] VO-016 — Implement application configuration and environment handling

**Scope:** Add validated environment configuration, .env.example, safe defaults and server/client separation. Never commit secrets.

**Acceptance:** App refuses to start with missing required server configuration; public bundle contains no secrets.

**Status:** `NOT_STARTED`

### [ ] VO-017 — Add structured logging and error handling

**Scope:** Implement request IDs, structured server logs, user-safe errors, error boundaries and health endpoint.

**Acceptance:** Errors are observable without leaking tokens, personal data or stack traces to users.

**Status:** `NOT_STARTED`

### [ ] VO-018 — Set up CI and pull-request checks

**Scope:** Run lint, typecheck, unit tests and build in CI. Add branch protection guidance if repository hosting is configured.

**Acceptance:** CI fails on relevant quality failures and passes on a clean baseline.

**Status:** `NOT_STARTED`

### [ ] VO-019 — Establish testing conventions and baseline coverage

**Scope:** Create unit, integration and browser test structure; test factories/fixtures; seeded local demo data.

**Acceptance:** A documented test command runs; sample test covers core app shell and server validation.

**Status:** `NOT_STARTED`

## P2 — Platform identity, authentication and multi-tenancy

**Goal:** Securely separate platform users, reseller workspaces, businesses, locations and records.

### [ ] VO-020 — Create database migration framework

**Scope:** Configure the selected PostgreSQL migration approach, local database workflow and migration conventions.

**Acceptance:** Migrations run from a clean database and can be reproduced in CI.

**Status:** `NOT_STARTED`

### [ ] VO-021 — Implement authentication and account lifecycle

**Scope:** Implement signup/login, phone/email identity per selected auth decision, verification, logout, recovery and session handling.

**Acceptance:** Auth flows work in local/staging; protected endpoints reject anonymous users.

**Status:** `NOT_STARTED`

### [ ] VO-022 — Implement workspaces and membership roles

**Scope:** Create reseller/DIY workspaces, workspace memberships and explicit role/permission model.

**Acceptance:** Users can belong to permitted workspaces; permissions are centrally checked and tested.

**Status:** `NOT_STARTED`

### [ ] VO-023 — Implement business and location core

**Scope:** Create business profile, location records, business owner and reseller relationship.

**Acceptance:** Business data is linked to its owning business and location; create/read/update flows work.

**Status:** `NOT_STARTED`

### [ ] VO-024 — Enforce tenant isolation at database and API layers

**Scope:** Implement PostgreSQL RLS/database policies where supported and server-side authorization on every protected operation.

**Acceptance:** Automated negative tests prove user A cannot read/write business B via UI, API, ID guessing or background job.

**Status:** `NOT_STARTED`

### [ ] VO-025 — Implement business profile settings

**Scope:** Manage business name, category, address, contacts, timings, language, timezone, currency, tax identity and confirmed/unconfirmed facts.

**Acceptance:** Validation, field provenance/confirmation and audit trail exist for sensitive business facts.

**Status:** `NOT_STARTED`

### [ ] VO-026 — Implement plans, entitlements and capacity service

**Scope:** Create plan/feature entitlement model, website-slot counts, usage quotas and server enforcement. Treat pricing/caps as configurable hypotheses until approved.

**Acceptance:** Server rejects over-limit operations; drafts/live sites and archived sites follow documented rules.

**Status:** `NOT_STARTED`

### [ ] VO-027 — Implement team invitations and membership lifecycle

**Scope:** Invite reseller teammates, business owners and staff with expiry, revoke, accept and role assignment.

**Acceptance:** Invitation tokens are secure and single-use; access is limited to assigned tenants.

**Status:** `NOT_STARTED`

### [ ] VO-028 — Implement audit/activity and notification foundation

**Scope:** Record actor, tenant, action, time, source and sensitive change; build in-app notification primitives.

**Acceptance:** Sensitive writes create audit events; users receive only authorized notifications.

**Status:** `NOT_STARTED`

## P3 — Niche registry, presets and business onboarding

**Goal:** Make supported industries data-driven and reusable instead of hard-coded into separate applications.

### [ ] VO-030 — Create niche and module registry

**Scope:** Represent niche groups, niche types, enabled modules, required questions, dashboard navigation and availability labels as versioned manifests.

**Acceptance:** All FINAL PRD niche groups can be represented without new bespoke routing code.

**Status:** `NOT_STARTED`

### [ ] VO-031 — Create category-specific onboarding schemas

**Scope:** Build question schemas and conditional steps for each niche group, with validation and missing-field detection.

**Acceptance:** Onboarding questions are driven by manifests; irrelevant questions are not shown.

**Status:** `NOT_STARTED`

### [ ] VO-032 — Implement secure media upload pipeline

**Scope:** Support authorized direct uploads, file size/type/dimension validation, business-scoped object paths, optimization and safe deletion.

**Acceptance:** Files cannot be accessed across tenants; rejected files produce actionable errors.

**Status:** `NOT_STARTED`

### [ ] VO-033 — Build mobile-first create-business flow

**Scope:** Implement niche selection, basic facts, uploads, questions, draft save/resume and proposal-ready state.

**Acceptance:** A reseller can create/resume a business setup from 390 px; progress is preserved.

**Status:** `NOT_STARTED`

### [ ] VO-034 — Build business import and confirmation review

**Scope:** Create import review UI for extracted fields, source evidence, confidence and To Confirm state. Do not silently accept guessed data.

**Acceptance:** Every extracted price, timing and material fact stays unconfirmed until a person accepts it.

**Status:** `NOT_STARTED`

## P4 — Website engine, templates and publishing

**Goal:** Create safe, versioned, component-based websites generated and edited from structured configuration.

### [ ] VO-040 — Define website configuration schema

**Scope:** Define versioned JSON schema for site metadata, theme tokens, pages, ordered sections, approved block types, properties, module bindings and publish version.

**Acceptance:** Schema validates good configurations and rejects unknown/unsafe properties; migrations/versioning strategy documented.

**Status:** `NOT_STARTED`

### [ ] VO-041 — Build approved block library foundation

**Scope:** Create shared blocks such as hero, about, catalogue/menu, services, gallery, pricing, booking/enquiry form, offers, reviews, location, FAQ and footer.

**Acceptance:** Blocks are responsive, accessible, schema-validated and never accept arbitrary executable code.

**Status:** `NOT_STARTED`

### [ ] VO-042 — Build public website renderer

**Scope:** Render published structured site configuration through a shared multi-tenant runtime. Resolve business from verified host/slug mapping.

**Acceptance:** Public sites render without loading reseller/admin bundles; invalid configuration fails safely.

**Status:** `NOT_STARTED`

### [ ] VO-043 — Implement navigation, SEO and metadata

**Scope:** Add navigation, footer, SEO title/description, social previews, canonical URLs and sitemap/robots controls as applicable.

**Acceptance:** Metadata is business-specific and validated; drafts do not leak as public pages.

**Status:** `NOT_STARTED`

### [ ] VO-044 — Integrate constrained visual editor

**Scope:** Adapt Puck or selected editor to approved blocks only. Support selecting, editing, adding, hiding and reordering sections.

**Acceptance:** Editor cannot inject arbitrary code; edits update structured config and preserve unknown-safe fields.

**Status:** `NOT_STARTED`

### [ ] VO-045 — Build responsive preview and device modes

**Scope:** Provide phone/tablet/desktop preview and protect editing controls from mobile keyboard/safe-area overlap.

**Acceptance:** Preview matches renderer at target viewport sizes and is usable on a phone.

**Status:** `NOT_STARTED`

### [ ] VO-046 — Connect media and module data to website blocks

**Scope:** Bind uploaded images and business catalogue/services data to approved blocks with explicit empty/loading states.

**Acceptance:** No cross-tenant media/data leakage; broken references are surfaced before publish.

**Status:** `NOT_STARTED`

### [ ] VO-047 — Implement draft autosave, undo and redo

**Scope:** Add debounced autosave, visible save state, local transient recovery if appropriate, undo/redo and conflict handling.

**Acceptance:** No silent data loss on refresh/network interruption; save failures are visible and retryable.

**Status:** `NOT_STARTED`

### [ ] VO-048 — Implement site versions and rollback

**Scope:** Persist immutable draft/published versions with actor and timestamp; support restore/rollback.

**Acceptance:** Rollback restores a previous published state without deleting newer history.

**Status:** `NOT_STARTED`

### [ ] VO-049 — Implement pre-publish validation, domains and QR

**Scope:** Check required facts, links, media, plan capacity, permissions and module readiness; publish to platform URL; add custom domain adapter boundary and permanent dynamic QR redirects.

**Acceptance:** Publish blocked on critical errors; successful publish creates stable URL and scan-tested QR. Custom-domain provider remains configurable.

**Status:** `NOT_STARTED`

## P5 — Vya AI gateway and website builder

**Goal:** Deliver a controlled AI assistant that proposes and configures approved platform capabilities.

### [ ] VO-050 — Create provider-neutral AI gateway

**Scope:** Create model adapter interface, request budgets, timeouts, retries, fallback routing, usage/cost logging and redaction.

**Acceptance:** Providers can be swapped by config; timeout/failure tests pass; secrets stay server-side.

**Status:** `NOT_STARTED`

### [ ] VO-051 — Version Vya persona, prompts and evaluation set

**Scope:** Store versioned persona/prompt templates and create initial golden conversations across builder and helper jobs.

**Acceptance:** Prompt versions are traceable; at least first 50 tests run in CI or a dedicated evaluation command.

**Status:** `NOT_STARTED`

### [ ] VO-052 — Build conversation orchestrator and streaming

**Scope:** Implement streaming responses, conversation history, context assembler and cancellation.

**Acceptance:** Streaming is responsive; context is scoped to authorized workspace/business.

**Status:** `NOT_STARTED`

### [ ] VO-053 — Implement read-only business tools

**Scope:** Add schema-validated tools for business profile, catalogue, services, timings, summaries and customer-safe lookups.

**Acceptance:** Tool permission and tenant checks run server-side; tools return only minimal required data.

**Status:** `NOT_STARTED`

### [ ] VO-054 — Implement proposal generation

**Scope:** Create structured proposal output: pages, modules, actions, design direction, missing facts, plan impact and setup dependencies.

**Acceptance:** Proposal uses supplied/confirmed facts, validates against schemas and requires user review.

**Status:** `NOT_STARTED`

### [ ] VO-055 — Implement photo/document to catalogue extraction

**Scope:** Extract draft items/services/prices from supported uploads; map fields and confidence/source to review UI.

**Acceptance:** No extraction directly changes live data; unsupported/uncertain fields are flagged.

**Status:** `NOT_STARTED`

### [ ] VO-056 — Implement pending actions and confirmation cards

**Scope:** Create PendingAction model and confirmation UX for material writes, with expiry, actor, diff and idempotency.

**Acceptance:** Publish, price, payment, delete, bulk message and other material writes cannot execute without explicit confirmation.

**Status:** `NOT_STARTED`

### [ ] VO-057 — Connect Vya proposals to structured site generation

**Scope:** Translate confirmed proposal into validated site JSON, select approved templates/blocks and create versioned draft.

**Acceptance:** Vya creates only approved configuration; invalid output is rejected with recoverable feedback.

**Status:** `NOT_STARTED`

### [ ] VO-058 — Implement per-business memory and safe context retrieval

**Scope:** Add editable shop profile, rolling summaries and learned facts with provenance, retention and owner controls.

**Acceptance:** Memory is tenant-isolated, inspectable/deletable and never used as source of truth for current stock/prices.

**Status:** `NOT_STARTED`

## P6 — Shared business operations engine

**Goal:** Build shared capabilities that power every niche's operational module.

### [ ] VO-060 — Implement catalogue and service management

**Scope:** Create categories, items/services, variants/options, images, prices, availability and featured/search fields.

**Acceptance:** Server validates prices and availability; item changes are auditable.

**Status:** `NOT_STARTED`

### [ ] VO-061 — Implement enquiry and lead pipeline

**Scope:** Create forms, source attribution, consent-aware contact capture, statuses, assignment, notes and follow-up dates.

**Acceptance:** Spam controls, validation and tenant isolation pass tests.

**Status:** `NOT_STARTED`

### [ ] VO-062 — Implement order and cart lifecycle

**Scope:** Build cart, server-calculated totals, order submission, accept/reject, status progression, cancellation and refund references.

**Acceptance:** Order state and payment state are independent; stock/price changes cannot be trusted from browser totals.

**Status:** `NOT_STARTED`

### [ ] VO-063 — Implement appointment scheduling engine

**Scope:** Build services, duration, staff, availability, blocked time, booking, reschedule/cancel and collision prevention.

**Acceptance:** Concurrent booking tests prove no double booking.

**Status:** `NOT_STARTED`

### [ ] VO-064 — Implement inventory core

**Scope:** Build stock item, stock movement, adjustments, low-stock thresholds and order-linked movements.

**Acceptance:** All movements are auditable and atomic; never allow negative stock unless an explicit policy allows it.

**Status:** `NOT_STARTED`

### [ ] VO-065 — Implement property listing engine

**Scope:** Build sale/rent listings, attributes, media, availability, filters, enquiries and visit requests.

**Acceptance:** Listing status and enquiries are business-scoped; filters have automated tests.

**Status:** `NOT_STARTED`

### [ ] VO-066 — Implement hospitality, classes, jobs and rentals primitives

**Scope:** Create reusable room/stay, class batch/session, job card/repair and rental item/reservation primitives.

**Acceptance:** Each primitive has a validated lifecycle and supports the associated niche workflows.

**Status:** `NOT_STARTED`

### [ ] VO-067 — Implement module manifests and role-aware navigation

**Scope:** Connect modules to business niches, entitlements, role permissions, public blocks and dashboard navigation.

**Acceptance:** A salon does not see food-service navigation; disabled modules cannot be called through APIs.

**Status:** `NOT_STARTED`

### [ ] VO-068 — Build business operating dashboard

**Scope:** Create today view for orders/bookings/enquiries, status queues, low-stock alerts and role-appropriate quick actions.

**Acceptance:** Dashboard reflects persisted data and has empty/loading/error states.

**Status:** `NOT_STARTED`

## P7 — Niche operational experiences

**Goal:** Implement each supported niche group's end-to-end business workflow using the shared engines.

### [ ] VO-070 — Food and hospitality workflows

**Scope:** Implement menu modifiers, table/pickup/delivery context, food orders, kitchen/staff status, rooms/stays and catering enquiries as applicable.

**Acceptance:** Representative food/hospitality test businesses can complete their documented core journey.

**Status:** `NOT_STARTED`

### [ ] VO-071 — Beauty, wellness and fitness workflows

**Scope:** Implement staff/services, schedules, appointment flows, packages, class schedules, memberships and reminders as applicable.

**Acceptance:** Salon/spa/gym/yoga sample businesses can complete their core journey with no double booking.

**Status:** `NOT_STARTED`

### [ ] VO-072 — Retail and local commerce workflows

**Scope:** Implement product variants, availability, cart/orders, pickup/delivery choice, inventory and repeat-order support.

**Acceptance:** Kirana and boutique sample businesses can complete customer order to fulfilment.

**Status:** `NOT_STARTED`

### [ ] VO-073 — Professional and home services workflows

**Scope:** Implement service area, request/quote, consultation, portfolio, job status, lead assignment and packages.

**Acceptance:** Service-provider sample businesses can capture, assign and close a job/lead.

**Status:** `NOT_STARTED`

### [ ] VO-074 — Automotive and repair workflows

**Scope:** Implement repair request, estimate, job card, service status, appointment and collection.

**Acceptance:** Garage/repair sample business can track a job from intake to completion.

**Status:** `NOT_STARTED`

### [ ] VO-075 — Education workflows

**Scope:** Implement courses, class batches, instructors, admission/demo enquiries, resources and fee links.

**Acceptance:** Coaching sample business can manage enquiries and class information.

**Status:** `NOT_STARTED`

### [ ] VO-076 — Real-estate workflows

**Scope:** Implement property filters, detail pages, property QR, agent assignment and site-visit requests.

**Acceptance:** Broker sample business can publish listing and handle assigned leads/site visits.

**Status:** `NOT_STARTED`

### [ ] VO-077 — Stay and accommodation workflows

**Scope:** Implement rooms, availability requests/reservations, guest enquiries and stay lifecycle appropriate to supported scope.

**Acceptance:** Hotel/homestay sample can manage room enquiry/booking lifecycle without claiming unsupported PMS features.

**Status:** `NOT_STARTED`

### [ ] VO-078 — Operational services and rental workflows

**Scope:** Implement laundry pickup, tailoring measurements, printing file requests, rental availability, deposits and return tracking as applicable.

**Acceptance:** Rental/service sample can capture requirements and track fulfilment/return.

**Status:** `NOT_STARTED`

## P8 — Customers, GST billing, payments and reseller money flows

**Goal:** Implement business money flows with strict separation, verified statuses and configurable providers.

### [ ] VO-080 — Implement customer CRM records and consent ledger

**Scope:** Create customer profiles, contact source, tags, interaction summaries and per-channel/per-purpose consent records.

**Acceptance:** Consent has timestamp, source, purpose and withdrawal; customer data is tenant-isolated.

**Status:** `NOT_STARTED`

### [ ] VO-081 — Implement tax calculation and tax configuration

**Scope:** Create controlled tax tables and GST calculation service; support CGST/SGST/IGST rules and taxable/non-taxable classifications approved by CA.

**Acceptance:** AI cannot calculate tax; test suite matches CA-approved expected values; unresolved tax rules are blocked.

**Status:** `NOT_STARTED`

### [ ] VO-082 — Implement invoice, bill and credit-note engine

**Scope:** Create sequential gap-free numbering per required series, invoice lines, totals, PDF/A4 and thermal format adapters, credit notes and exports.

**Acceptance:** Bills cannot be silently deleted; numbering and totals are transaction-safe.

**Status:** `NOT_STARTED`

### [ ] VO-083 — Implement zero-setup UPI QR and claim flow

**Scope:** Create UPI ID setup, amount/reference intent and QR for order/bill; separate Claimed, Received and verified Paid.

**Acceptance:** A customer claim alone never sets Paid; staff confirmation is attributable and auditable.

**Status:** `NOT_STARTED`

### [ ] VO-084 — Implement payment-provider adapter interface

**Scope:** Define gateway adapter contracts for create payment, status, refund, payment links, account state and reconciliation.

**Acceptance:** Business logic does not depend on one provider SDK; sandbox adapter contract tests pass.

**Status:** `NOT_STARTED`

### [ ] VO-085 — Integrate first approved merchant gateway in sandbox

**Scope:** After provider decision, implement official SDK, server-only credentials, onboarding state and signed webhooks.

**Acceptance:** Sandbox payment success is accepted only after verified webhook/server lookup; replay is rejected.

**Status:** `NOT_STARTED`

### [ ] VO-086 — Implement payment ledger, refund and reconciliation

**Scope:** Create immutable payment records, provider references, refunds/disputes and settlement reconciliation.

**Acceptance:** Duplicate webhooks are idempotent; order/payment states reconcile with provider data.

**Status:** `NOT_STARTED`

### [ ] VO-087 — Implement VyapOne subscriptions, renewals and entitlements

**Scope:** Build reseller subscriptions, invoice/payment lifecycle, failed renewal, grace and downgrade selection.

**Acceptance:** Expired/downgraded plans follow approved grace rules and do not silently delete live business data.

**Status:** `NOT_STARTED`

### [ ] VO-088 — Implement reseller client billing and split settlement

**Scope:** Build client contracts, setup/monthly fees, offline-collected record, provider split settlement, platform fee and earnings ledger.

**Acceptance:** Funds are never pooled/held by VyapOne; provider and legal model approved before live activation; sandbox reconciliation passes.

**Status:** `NOT_STARTED`

## P9 — WhatsApp, messaging and automation

**Goal:** Deliver consent-aware customer communication and reliable trigger-based workflows.

### [ ] VO-090 — Implement messaging adapter abstraction

**Scope:** Create WhatsApp BSP/Cloud API interface and fallback share-link channel; keep provider details configurable.

**Acceptance:** Provider-specific code is isolated; no provider decision is guessed.

**Status:** `NOT_STARTED`

### [ ] VO-091 — Implement WhatsApp connection, templates and webhooks

**Scope:** Implement number mapping, connection status, template records, webhook signature verification and message status updates.

**Acceptance:** Invalid signatures fail; webhook retries are idempotent; templates are approved before use.

**Status:** `NOT_STARTED`

### [ ] VO-092 — Implement consent, opt-out and messaging policies

**Scope:** Enforce transaction vs marketing consent, STOP, quiet hours, per-customer frequency caps and channel rules.

**Acceptance:** Opt-out blocks marketing immediately; send attempts are denied and audited.

**Status:** `NOT_STARTED`

### [ ] VO-093 — Implement event queue and message delivery jobs

**Scope:** Publish business events to queue; process sends with idempotency, retries, dead-letter handling and rate limits.

**Acceptance:** Duplicate events do not send duplicate messages; failures are inspectable/retryable.

**Status:** `NOT_STARTED`

### [ ] VO-094 — Implement transactional notifications

**Scope:** Add order, booking, bill, payment, owner/staff and status-change notifications using approved templates.

**Acceptance:** Only valid template and consent combinations send; fallback state is visible.

**Status:** `NOT_STARTED`

### [ ] VO-095 — Implement shared inbox and staff assignment

**Scope:** Build inbound conversation list, assignment, quick replies, Vya suggestions and owner handoff.

**Acceptance:** Only assigned/authorized business staff see conversations; escalation is preserved.

**Status:** `NOT_STARTED`

### [ ] VO-096 — Implement broadcasts and audience segmentation

**Scope:** Build customer segments, exact message preview, recipient count, cost estimate, scheduling and delivery reports.

**Acceptance:** Owner confirmation required; only opted-in recipients included; cost and count shown before send.

**Status:** `NOT_STARTED`

### [ ] VO-097 — Implement workflow/automation engine

**Scope:** Implement versioned triggers, conditions, delays, actions, quiet hours, run logs, retries and duplicate/loop protection.

**Acceptance:** Automations are replay-safe, observable, pausable and testable.

**Status:** `NOT_STARTED`

### [ ] VO-098 — Implement ready-made niche automation recipes

**Scope:** Add payment reminders, order updates, booking reminders/no-show, review request, birthday/win-back, back-in-stock and owner summaries.

**Acceptance:** Each recipe has a preview, consent/cost rules and an enable/disable control.

**Status:** `NOT_STARTED`

### [ ] VO-099 — Implement wallet and metered message costs

**Scope:** Build prepaid message wallet, price tables, ledger debit/refund and spend caps/alerts.

**Acceptance:** No overdraft beyond configured policy; each debit reconciles to message/provider reference.

**Status:** `NOT_STARTED`

## P10 — Vya daily assistant, voice and languages

**Goal:** Let owners use Vya for real business tasks with accurate facts and controlled actions.

### [ ] VO-100 — Implement Vya business-data query tools

**Scope:** Add sales, orders, bookings, customer, bill and inventory summary read tools with permission checks.

**Acceptance:** Answers are grounded in current server data; calculation tests cover totals and date/timezone boundaries.

**Status:** `NOT_STARTED`

### [ ] VO-101 — Implement Vya write tools and approvals

**Scope:** Add permitted tools for draft catalogue changes, bill preparation, offers and operational actions using PendingAction.

**Acceptance:** Every material write requires a confirmation token and is idempotent.

**Status:** `NOT_STARTED`

### [ ] VO-102 — Implement scheduled business summaries

**Scope:** Schedule morning/evening summaries, payment reminders and low-stock alerts per business timezone.

**Acceptance:** Jobs run once per schedule window and have run history/retry controls.

**Status:** `NOT_STARTED`

### [ ] VO-103 — Implement Vya on WhatsApp for owners

**Scope:** Connect owner conversations to the same orchestrator, summaries and approval cards supported by channel UX.

**Acceptance:** Owner channel identity is verified and tools remain scoped to that owner's businesses.

**Status:** `NOT_STARTED`

### [ ] VO-104 — Implement customer-facing Smart AI bot and handoff

**Scope:** Restrict customer bot to customer-safe tools such as catalogue/timings/order or booking requests; create escalation summary.

**Acceptance:** Bot cannot change prices/refund/see other customers; injection tests pass; owner handoff works.

**Status:** `NOT_STARTED`

### [ ] VO-105 — Implement voice input and output

**Scope:** Add hold-to-talk, transcript editing, STT/TTS adapters, captions, tap-to-play and failure fallback.

**Acceptance:** Voice requests use the same tool permission/confirmation system; no audio autoplay.

**Status:** `NOT_STARTED`

### [ ] VO-106 — Implement launch languages and evaluation coverage

**Scope:** Implement language detection and reviewed UI/template/content translations for the final approved launch set; expand golden tests to 100+ prompts per language per PRD.

**Acceptance:** No unreviewed machine translation ships for money/legal templates; evaluation gate blocks quality regressions.

**Status:** `NOT_STARTED`

### [ ] VO-107 — Implement Vya mascot H1 UI states

**Scope:** Implement mascot states for idle, talking, listening, thinking and minimized; optimize assets and respect reduced-motion.

**Acceptance:** Mascot does not block actions, is accessible and loads after critical content.

**Status:** `NOT_STARTED`

## P11 — Reseller ecosystem, integrations, staff and PWA

**Goal:** Complete the reseller toolkit and connected business ecosystem required by the launch scope.

### [ ] VO-110 — Build reseller portfolio and earnings dashboard

**Scope:** Show live clients, plans, invoices, collected/due/overdue, payouts, usage cost and net earnings.

**Acceptance:** All figures reconcile to ledgers; no guessed or double-counted revenue.

**Status:** `NOT_STARTED`

### [ ] VO-111 — Implement white-label configuration

**Scope:** Support reseller branding levels, logo/name/theme, custom dashboard domain boundary and branded client materials.

**Acceptance:** White-label is entitlement-controlled and never changes platform legal identity in required disclosures.

**Status:** `NOT_STARTED`

### [ ] VO-112 — Implement Academy, certification and referral foundations

**Scope:** Create lessons, progress, assessments, certification state and referral ledger.

**Acceptance:** Eligibility and credits are auditable; no self-referral abuse.

**Status:** `NOT_STARTED`

### [ ] VO-113 — Implement Google Business Profile integration adapter

**Scope:** Connect OAuth, account/location selection, profile health, sync of hours/site/photos/posts and review retrieval/reply drafts.

**Acceptance:** Requires API access/approval; sync failures are visible; owner approves review replies.

**Status:** `NOT_STARTED`

### [ ] VO-114 — Implement Meta catalogue and social publishing adapters

**Scope:** Create social assets/captions, approval queue, scheduling and catalogue-sync boundaries.

**Acceptance:** No unapproved content auto-publishes; requires Meta review/permissions where applicable.

**Status:** `NOT_STARTED`

### [ ] VO-115 — Implement delivery partner adapter framework

**Scope:** Create partner-neutral dispatch/track/cancel/status contracts and own-rider mode; enable only partners verified for the target city.

**Acceptance:** Unavailable partners are not shown as active; dispatch is idempotent.

**Status:** `NOT_STARTED`

### [ ] VO-116 — Implement staff counter mode

**Scope:** Build PIN/session mode, large touch targets, role-restricted orders/bookings/bills and staff action trail.

**Acceptance:** Staff cannot access billing, exports or settings unless explicitly granted.

**Status:** `NOT_STARTED`

### [ ] VO-117 — Implement business PWA and offline-tolerant behaviours

**Scope:** Add installability, manifest/icons, offline read-only catalogue/menu cache and sync indicators; push notifications where supported.

**Acceptance:** Offline mode never falsely confirms payment/order completion; sync conflicts are recoverable.

**Status:** `NOT_STARTED`

## P12 — Platform administration, analytics and support

**Goal:** Give operations teams safe visibility and control and establish product health measurement.

### [ ] VO-120 — Build least-privilege platform admin console

**Scope:** Implement admin roles for support, finance, trust/safety and operations with audited/time-limited access.

**Acceptance:** Admin access is least privilege; sensitive reads/writes are logged and tested.

**Status:** `NOT_STARTED`

### [ ] VO-121 — Implement product analytics and WOS metric

**Scope:** Track onboarding, publish, website actions, orders, bookings, bills, payments, broadcasts, Vya usage and Weekly Operating Sites.

**Acceptance:** Metric definitions are documented; events distinguish clicks, claims and completed transactions.

**Status:** `NOT_STARTED`

### [ ] VO-122 — Implement help centre and support ticket flow

**Scope:** Create searchable help content, in-app support, tenant-aware support context and escalation routing.

**Acceptance:** Support agents see only authorized, time-limited tenant context; human support remains available.

**Status:** `NOT_STARTED`

### [ ] VO-123 — Implement observability and integration health dashboard

**Scope:** Expose error rates, latency, queue age, model usage/cost, message delivery, webhook health and provider connectivity.

**Acceptance:** Alerts exist for critical failures and anomalous spend; no PII/secrets in dashboards.

**Status:** `NOT_STARTED`

### [ ] VO-124 — Implement exports, privacy requests and data lifecycle

**Scope:** Support owner data exports, correction/deletion workflows, retention jobs and documented data ownership/handover.

**Acceptance:** Data-principal requests are auditable; deletion respects legal retention holds and approved policy.

**Status:** `NOT_STARTED`

## P13 — Production hardening, beta validation and GA

**Goal:** Prove the product is safe, reliable, accessible, supported and ready for public release.

### [ ] VO-130 — Create full end-to-end acceptance suite

**Scope:** Automate reseller onboarding, business creation, Vya proposal, editor, publish, QR, customer action, owner workflow and rollback.

**Acceptance:** Critical journey runs in CI against seeded environments.

**Status:** `NOT_STARTED`

### [ ] VO-131 — Complete security and tenant-isolation assessment

**Scope:** Run authorization matrix, dependency review, secret scan, webhook tests, prompt injection suite and external penetration test.

**Acceptance:** No unresolved critical/high findings; sign-off documented.

**Status:** `NOT_STARTED`

### [ ] VO-132 — Complete accessibility and responsive audit

**Scope:** Audit WCAG 2.2 AA, keyboard navigation, screen readers, contrast, zoom, reduced motion and mobile breakpoints.

**Acceptance:** Critical issues fixed; accessibility report and regression tests exist.

**Status:** `NOT_STARTED`

### [ ] VO-133 — Complete performance and load testing

**Scope:** Set budgets, profile public sites/app APIs, test 10x expected peak and campaign/broadcast bursts.

**Acceptance:** Performance budgets met or waivers approved; queues/rate limits protect providers.

**Status:** `NOT_STARTED`

### [ ] VO-134 — Complete backup, disaster recovery and incident runbooks

**Scope:** Verify backups, restore drill, regional recovery plan, on-call, status page and incident severity process.

**Acceptance:** Restore drill succeeds; operators can follow runbooks without developer improvisation.

**Status:** `NOT_STARTED`

### [ ] VO-135 — Run private beta across every niche group

**Scope:** Invite selected resellers/businesses; capture real workflow defects, support minutes, activation and SLOs.

**Acceptance:** No P1 defects; all niche core journeys complete; SLOs stable for required observation period.

**Status:** `NOT_STARTED`

### [ ] VO-136 — Run public beta readiness review

**Scope:** Open controlled signup/waitlist; confirm support capacity, security findings, pricing/wallet reconciliation and partner approvals.

**Acceptance:** Beta exit criteria and go/no-go decision are documented.

**Status:** `NOT_STARTED`

### [ ] VO-137 — Prepare and execute GA release

**Scope:** Finalize production migrations, feature flags, legal policies, provider approvals, support staffing, release notes, rollback and monitoring.

**Acceptance:** All FINAL PRD acceptance criteria and v3 supplemental GA gates pass; public launch is explicitly approved.

**Status:** `NOT_STARTED`

### [ ] VO-138 — Run post-launch stabilization

**Scope:** Monitor errors, support, WOS, costs, churn, message quality and payment reconciliation; create prioritized fixes.

**Acceptance:** Daily operational review and incident process active; stabilization report completed.

**Status:** `NOT_STARTED`

## P14 — Post-launch expansion (not a GA blocker)

**Goal:** Add ecosystem-dependent capabilities only after India launch works and unit economics are understood.

### [ ] VO-140 — Deepen inventory, procurement and advanced retail

**Scope:** Evaluate batch tracking, procurement and deeper stock operations from actual customer demand.

**Acceptance:** Only build after product metrics validate demand.

**Status:** `NOT_STARTED`

### [ ] VO-141 — Build module/template marketplace

**Scope:** Create safe module manifests, review, versioning, entitlement, revenue share and uninstall/upgrade.

**Acceptance:** Marketplace modules pass security, compatibility and tenant-isolation checks.

**Status:** `NOT_STARTED`

### [ ] VO-142 — Explore ONDC and marketplace distribution

**Scope:** Evaluate ONDC requirements and partner onboarding; build an adapter only after verified business case.

**Acceptance:** Partner and legal readiness documented before implementation.

**Status:** `NOT_STARTED`

### [ ] VO-143 — Explore public API, webhooks and Zapier ecosystem

**Scope:** Expose scoped API clients, webhook subscriptions, rate limits, signing and developer documentation.

**Acceptance:** Security scopes, revocation, replay protection and audit are implemented.

**Status:** `NOT_STARTED`

### [ ] VO-144 — Explore native branded applications

**Scope:** Evaluate Capacitor/native wrapper for qualifying reseller plans.

**Acceptance:** PWA metrics and demand justify native maintenance.

**Status:** `NOT_STARTED`

### [ ] VO-145 — Evaluate international expansion

**Scope:** Research country-specific tax, currency, privacy, payments, messaging and language requirements after India success gate.

**Acceptance:** Expansion starts only after India retention and operating criteria are met.

**Status:** `NOT_STARTED`
