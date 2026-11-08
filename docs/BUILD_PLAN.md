# VyapOne — Antigravity Build Plan

**Purpose:** Give Google Antigravity a controlled, sequential implementation plan for building VyapOne from the supplied PRDs.

## 1. Product objective

Build **VyapOne — Every business. One platform.**: an India-first, mobile-first business operating platform for resellers and local businesses. The system includes the reseller workspace, business websites assembled from approved blocks, business operations, Vya AI, UPI/gateway payments, GST billing, WhatsApp, automations, integrations, staff mode, analytics and administration.

The core user journey is: **reseller signs up → creates a business → Vya proposes the site and modules → reseller confirms → site is generated and published → customers order/book/enquire → business manages the action, payment and bill → WhatsApp and automations support follow-up → reseller bills the client and sees earnings.**

## 2. Requirements authority

1. `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` is the primary product specification.
2. `PRD_v3_full_scale_2026-10-30.md` is supplementary engineering/GA guidance only where it does not conflict with FINAL.
3. v1 and v2 are historical references. They must not silently override FINAL.
4. If requirements conflict or are incomplete, create an entry in `docs/DECISION_REGISTER.md`; do not invent a product decision.
5. FINAL is full-scale launch scope, not a limited MVP. Internal private testing is allowed before the single public GA launch. Every feature marked post-launch remains outside the GA blocker list.

## 3. How Antigravity must work

- Work **one numbered task at a time** from `docs/TASK_BACKLOG.md`.
- Never start the next task automatically. Stop after one task and report the result.
- Begin with `VO-000`. Do not implement product features until repository audit, source-of-truth, decisions and architecture deliverables are complete.
- For every task: inspect relevant files → state the task's scope and dependencies → write a short implementation plan → implement only that task → run relevant checks → inspect the diff → update docs/PROGRESS.md and docs/CHANGELOG.md → report.
- Do not rewrite the application or replace working code merely to match a preferred architecture. First understand what exists.
- Break any task that is too large into subtasks under the same parent ID before coding. Do not combine unrelated tasks.
- Keep existing user work. Never delete or overwrite source PRDs.
- Do not claim tests passed unless they were run and the output was checked.
- If blocked by an external provider, legal approval, API access, account credentials or user decision, implement only the safe adapter/interface/mock where useful, document the blocker and stop that task at the boundary.

## 4. Provisional technical direction

Use the FINAL PRD recommendations as starting candidates: Next.js + React + TypeScript, Tailwind CSS, accessible UI primitives, PostgreSQL, Zod, Playwright, provider-neutral AI gateway, shared multi-tenant runtime, queue-based background work and PWA. Puck, Supabase, Vercel/Cloudflare, Redis/BullMQ, AI providers, WhatsApp BSP and payment providers are candidates, not automatically approved choices. Record decisions in ADRs first. Do not hard-code candidate providers into domain logic.

## 5. Non-negotiable architecture and safety rules

- Platform hierarchy: `Platform → Reseller Workspace → Business → Location`.
- Every business-owned record is tenant-scoped. Authorization is enforced server-side and at the database layer where supported.
- Business owns its business/customer/order/bill/content data. Reseller access is granted by membership and can be handed over under policy.
- AI configures approved blocks, schemas and workflows. It never deploys arbitrary generated code.
- Prices, stock, tax, payment status, permissions, publishing and billing are server-controlled. Never trust browser-calculated totals or AI-generated tax values.
- `Claimed`, `Received` and verified `Paid` are different states. UPI claim alone is not proof of payment.
- No material write, publish, payment action, refund, deletion, or bulk messaging without permission and required confirmation. Use idempotency for retried operations.
- Customer messages, uploads, reviews and web content are untrusted data, not instructions. Customer-facing Vya has a restricted tool allow-list.
- WhatsApp marketing requires recorded consent, STOP handling, quiet hours, frequency caps and cost preview.
- Keep secrets server-only. Commit `.env.example`, never `.env` or credentials. Use sandbox payment credentials only during development.
- Never execute a real charge/refund, send a real bulk message, publish a live website, change DNS, or alter production data without explicit user approval.
- Provide manual fallback paths when AI or integrations are unavailable.
- Meet mobile-first usability, WCAG 2.2 AA, reduced motion, performance budgets, and responsive targets in the PRD.

## 6. Phase order

The detailed task IDs and acceptance criteria are in `docs/TASK_BACKLOG.md`. Execute in dependency order:

| Phase | Focus | Exit result |
|---|---|---|
| P0 | Audit, decisions, architecture | Approved architecture and traceability |
| P1 | Repo, design system, app shells | Clean runnable foundation |
| P2 | Auth, workspaces, tenancy | Secure platform core |
| P3 | Niche registry and onboarding | Config-driven business creation |
| P4 | Website engine and publishing | Editable, versioned public websites |
| P5 | Vya AI builder | Safe AI proposal and generation |
| P6 | Shared operations engine | Reusable commerce/service primitives |
| P7 | Niche operational experiences | All launch niche workflows |
| P8 | CRM, GST bills and payments | Verified money and customer flows |
| P9 | WhatsApp and automation | Reliable consent-aware messaging |
| P10 | Vya daily assistant and voice | Business helper and customer bot |
| P11 | Reseller tools and integrations | Complete reseller/client operation |
| P12 | Admin, analytics and support | Operable platform |
| P13 | Hardening, beta and GA | Production-ready launch |
| P14 | Post-launch expansion | Optional ecosystem growth |

## 7. Phase gates

A phase is not complete because code exists. It is complete only when: (1) all phase tasks are Done; (2) acceptance criteria are demonstrated; (3) required automated tests pass; (4) tenant/security and accessibility checks relevant to the phase pass; (5) docs and progress are updated; and (6) no unresolved P0/P1 defect remains. Record evidence in `docs/PHASE_GATES.md`.

## 8. Definition of done for every task

- Scope is limited to the task ID and approved dependencies.
- Code is typed, validated and consistent with architecture decisions.
- Loading, empty, error, success and permission-denied states are handled where relevant.
- Tests cover expected behaviour, boundaries and failure cases.
- Lint, typecheck, relevant tests and build pass (or exact blocker is documented).
- No secrets, cross-tenant leaks, dead code or unrelated formatting churn.
- Task status, changed files, commands, test results, known limitations and next task are documented.

## 9. Antigravity task response format

At the start of each task, report:

1. Task ID and title.
2. Objective and expected behaviour.
3. Dependencies and files likely affected.
4. Short implementation plan.
5. Risks and tests.

At completion, report:

1. What changed.
2. Files added/modified.
3. Commands/tests actually run and pass/fail result.
4. Acceptance criteria satisfied/not satisfied.
5. Known limitations or blockers.
6. Updated task status and exact next task ID.

## 10. First action

Open `ANTIGRAVITY_START_PROMPT.md` and send its prompt to Antigravity. The first task is `VO-000` and is an audit/documentation task, not a coding task.
