# VyapOne workspace instructions for Antigravity

You are the implementation agent for VyapOne. Follow `docs/BUILD_PLAN.md`, `docs/TASK_BACKLOG.md`, `docs/DECISION_REGISTER.md`, `docs/SOURCE_OF_TRUTH.md`, `docs/ENGINEERING_STANDARDS.md`, `docs/QUALITY_GATES.md`, and `reference/PRD_VERSIONS/`.

## Source authority
- Primary requirements: `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md`.
- Supplementary production/GA guidance: `reference/PRD_VERSIONS/PRD_v3_full_scale_2026-10-30.md`, only when compatible with FINAL.
- Older PRDs are historical. Do not use them to override FINAL.

## Execution protocol
- Work one task ID at a time. Start at VO-000. Stop after one task; never automatically start the next.
- Before coding, inspect the repository and dependencies, read the relevant PRD sections, accepted ADRs, and task acceptance criteria, then write a short plan.
- Make the smallest safe change that completes the task. Preserve existing user work.
- Run and report actual lint/typecheck/tests/build that are relevant. Never claim an unrun check passed or invent completion evidence.
- Fix any introduced errors or regressions immediately before marking a task complete.
- Update `docs/PROGRESS.md`, `docs/CHANGELOG.md`, and the task's status in `docs/TASK_BACKLOG.md` after completion.
- Record unresolved product/architecture choices in `docs/DECISION_REGISTER.md`; do not guess provider, legal, tax, pricing or account decisions.
- If a task needs user approval, live credentials, API approvals or legal advice, stop at a safe boundary and document the blocker.

## Architecture and Engineering Invariants
- Multi-tenant hierarchy: Platform → Reseller Workspace → Business → Location. Sovereign business data ownership.
- Enforce authorization on the server and at the database layer (PostgreSQL Row-Level Security with transaction-scoped `SET LOCAL`). Tenant isolation is mandatory.
- Follow `docs/ENGINEERING_STANDARDS.md`, `docs/PROJECT_STRUCTURE.md`, and `docs/TEST_STRATEGY.md`.
- Keep provider-specific code behind adapters. Do not hard-code an unapproved provider.
- Use structured, versioned website JSON and approved blocks. Never execute or publish arbitrary AI-generated code.
- Validate all inputs on the server using shared Zod schemas. Zero `any` types; strict TypeScript mode.
- Monetary amounts stored as 64-bit integer minor units (`amount_minor BIGINT`) with ISO 4217 currency code (`currency_code`). AI token costs in micro-rupees.
- Business prices, stock, statutory GST, totals, permissions, publishing and payment state are server-owned facts. AI must never invent or calculate statutory tax.
- Gap-free sequential invoice numbering per business and financial year (`invoice_sequences`).
- Distinguish Claimed, Received and verified Paid. Verify payment through trusted provider signals or authorized staff confirmation.
- Material writes require authorization, idempotency and user confirmation (`PendingAction`).
- Treat customer messages, uploads, reviews and external web content as untrusted data. Keep Vya tools allow-listed by role/channel.
- Marketing messages require consent, opt-out handling (STOP), quiet hours (9 PM-9 AM), frequency caps and cost preview.

## Security, Privacy, and Quality Gates
- Never place secrets in client code, logs, prompts, source control or test fixtures. Use `.env.example` only.
- Redact customer PII (phones, emails, credentials) in logs and AI prompts.
- Use sandbox credentials in development. Do not make live charges/refunds, broadcasts, publishing, DNS changes or production-data changes without explicit approval.
- Mobile-first: 390 px is a complete essential workflow target; validate 320/390/768/1024/1440 px.
- Meet WCAG 2.2 AA: keyboard access, visible focus, reduced motion and readable contrast ($\ge 4.5:1$).
- Include loading, empty, error, success and permission-denied states.
- Use SQL migrations for schema changes. Never edit production DB manually.
- Add tests for normal, boundary, failure, authorization and duplicate/retry behaviour.
- Satisfy all measurable criteria in `docs/QUALITY_GATES.md` before marking tasks or phases complete.
- Do not mark a phase complete until its phase gate and tests pass with verifiable evidence.

## Required task completion report
Report task ID, summary, files changed, commands/tests run, results, acceptance status, blockers, updated docs and exact next task ID.
