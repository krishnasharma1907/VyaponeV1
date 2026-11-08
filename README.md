# VyapOne Antigravity Build Kit

This folder is structured for a Google Antigravity workspace. It contains persistent agent instructions, a reusable build skill, an ordered backlog, decision register, progress tracking and the four supplied PRD versions.

## Start here

1. Read `ANTIGRAVITY_START_PROMPT.md`.
2. Open this folder as a Project in Antigravity.
3. Send the first prompt exactly as shown.
4. Let Antigravity complete **VO-000 only**.
5. Review its audit and decision register before allowing implementation tasks.

## Key files

- `AGENTS.md` — always-on project rules.
- `.agents/skills/vyapone-build/SKILL.md` — reusable task execution process.
- `docs/BUILD_PLAN.md` — product and phase-level implementation plan.
- `docs/TASK_BACKLOG.md` — numbered tasks with scope and acceptance criteria.
- `docs/DECISION_REGISTER.md` — unresolved decisions; do not guess.
- `docs/PROGRESS.md` — task and phase status.
- `docs/PHASE_GATES.md` — release gates.
- `reference/PRD_VERSIONS/` — source PRDs copied unchanged.

## Task discipline

One task per Antigravity run. Review the plan, diff, test results and progress update before moving to the next task. Commit completed tasks in Git so changes can be rolled back.

## Stack note

The PRD proposes a stack but leaves important providers open. The kit therefore asks Antigravity to create ADRs and interfaces first, not assume hosting, auth, AI, WhatsApp or payment providers without approval.
