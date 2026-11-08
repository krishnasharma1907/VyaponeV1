---
name: vyapone-build
description: Implements VyapOne tasks sequentially from the approved PRD and task backlog. Use for repository audits, architecture, frontend/backend features, integrations, tests, security and release work in the VyapOne project.
---

# VyapOne Build Skill

Use this skill whenever implementing or planning a numbered VyapOne task.

## Required inputs
1. Read `AGENTS.md`.
2. Read `docs/BUILD_PLAN.md`, `docs/TASK_BACKLOG.md`, and `docs/DECISION_REGISTER.md`.
3. Read `docs/ENGINEERING_STANDARDS.md`, `docs/QUALITY_GATES.md`, and `docs/TEST_STRATEGY.md`.
4. Read the relevant FINAL PRD sections in `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md`.
5. Read relevant Accepted ADRs and the repository audit before changing architecture.

## Task selection
- If the user names a task ID, work only on that ID.
- Otherwise select the earliest `NOT_STARTED` task whose dependencies are satisfied.
- Do not select tasks marked BLOCKED or DEFERRED_POST_LAUNCH.
- Never implement multiple backlog tasks in one run unless the user explicitly requests a batch.
- Do not automatically continue when the current task is complete. Stop after one task.

## Execution sequence
1. **Inspect:** inspect current code, test scripts, git status, and relevant dependencies. Preserve user work.
2. **Understand:** restate objective, in-scope behaviour, out-of-scope behaviour, dependencies, and acceptance criteria.
3. **Plan:** produce a brief file-level plan and risk/test list before editing.
4. **Implement:** make the smallest coherent change. Follow `docs/ENGINEERING_STANDARDS.md` and accepted ADRs.
5. **Verify:** run focused tests first, then relevant lint/typecheck/build. Inspect test output and git diff. Never claim an unrun check passed.
6. **Repair:** fix any regressions or errors introduced by this task immediately. Do not hide, skip, or weaken tests.
7. **Document:** update task status in `docs/TASK_BACKLOG.md`, `docs/PROGRESS.md`, `docs/CHANGELOG.md`, and decision/phase-gate documents if applicable.
8. **Report:** summarize changed files, actual test outcomes, criteria met, limitations, blockers, and the exact next task ID. Then stop.

## Blocker handling
- If a provider, secret, payment account, Meta/Google approval, domain, legal/CA decision or user choice is required, do not invent it.
- Create a safe interface, fake adapter or sandbox path only if it is useful and clearly labelled.
- Record the blocker with owner, decision needed, impact and tasks blocked in `docs/DECISION_REGISTER.md`.
- Stop before external side effects or production actions.

## Security review on every relevant task
Check tenant isolation (RLS), role permissions, Zod input validation, logging/PII sanitization, secret exposure, webhook HMAC signatures, idempotency, AI prompt injection defense, and marketing consent rules as relevant. Follow `docs/CODE_REVIEW_CHECKLIST.md`.

## Completion rule
A task is DONE only when its acceptance criteria are met and the relevant checks have actually passed with verifiable evidence. Code being generated is not completion. If checks cannot run, mark BLOCKED or partially complete and explain exactly why.
