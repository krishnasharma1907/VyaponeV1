# Start VyapOne in Google Antigravity

## Before opening Antigravity

1. Extract this kit into a clean project folder, for example `F:\VyaponeV2`.
2. Keep `AGENTS.md`, `.agents/`, `docs/` and `reference/` at the project root as provided.
3. Open the extracted folder as a Project in Antigravity. For the first audit, use Local Mode and review file/terminal permissions. If you use Git, initialize/commit the starter docs before asking the agent to edit code.
4. Do not move the PRD files outside `reference/PRD_VERSIONS/`; the plan refers to those exact paths.
5. Check Antigravity Customizations to confirm the workspace rule and `vyapone-build` skill are discovered.

## First prompt — copy this into Antigravity

```text
You are the technical lead and implementation agent for VyapOne. First read AGENTS.md, docs/BUILD_PLAN.md, docs/TASK_BACKLOG.md, docs/DECISION_REGISTER.md, and all four source PRDs in reference/PRD_VERSIONS/. Use the vyapone-build skill.

Start with task VO-000 only. Do not write application code yet. Inspect this repository and all PRD versions, identify the authoritative requirements, audit any existing code, dependencies, scripts and tests, and create/update the repository audit and source-of-truth documents. Identify contradictions and open decisions; do not guess.

Then report: (1) what already exists, (2) whether this is a new or existing project, (3) the confirmed product scope, (4) architecture decisions that need approval, (5) blockers and risks, (6) the proposed implementation sequence, and (7) the exact next task ID. Run no live integrations, payment operations, broadcasts, production changes or deployments. Stop after VO-000.
```

## How to continue after the audit

For each next task, send a separate prompt, for example:

```text
Use the vyapone-build skill. Implement only VO-001 from docs/TASK_BACKLOG.md. Follow AGENTS.md and docs/BUILD_PLAN.md. Inspect the repository first, plan the change, implement it, run the relevant checks, update progress/changelog/backlog, report results and stop. Do not start VO-002 automatically.
```

Replace `VO-001` with the exact next task ID reported by Antigravity.

## Suggested day-to-day loop

1. Ask Antigravity for one task ID.
2. Review its short plan before implementation.
3. Review changed files and diffs.
4. Confirm tests and acceptance results.
5. Commit the completed task in Git.
6. Start the next task only after you are satisfied.

## Important

This is a task plan and instruction kit, not a claim that the application has already been built. Provider selection, pricing, legal/tax interpretation, production credentials and external approvals remain decisions to approve.
