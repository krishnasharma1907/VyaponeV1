# ADR-022: Application Workspace Scaffolding and Git Initialization Model

**Date:** 8 November 2026  
**Status:** `ACCEPTED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** Quality Strategy §20, Engineering Standards §19  
**Affected Tasks:** `VO-000`, `VO-002`, `VO-003`, `VO-010`, `VO-011`  

---

## 1. Context and Problem Statement
The VyapOne repository is currently in a greenfield state. The workspace root (`F:\VyaponeV2`) contains starter documentation, agent rules, and PRD specifications, but has not yet been initialized as a Git repository (`.git` is absent) and contains zero application code or package manifests.

We must define the repository scaffolding structure, package manager, and source control workflow without conflicting with the sequential task backlog.

---

## 2. Decision and Architecture

### 2.1 Backlog Task Assignment
- In strict adherence to `docs/TASK_BACKLOG.md` and `docs/BUILD_PLAN.md`:
  👉 **`VO-010 — Initialize or normalize application workspace`** is the canonical development task designated for:
  1. Creating `package.json`, `tsconfig.json`, and configuring `pnpm` workspace tooling.
  2. Installing baseline dependencies accepted in ADR-001 (Next.js 15, React 19, Tailwind CSS).
  3. Configuring project directory layouts (`/src/app`, `/src/components`, `/src/lib`, `/src/server`).

### 2.2 Git Version Control Model
- **Starter Documentation Baseline:** As documented in `ANTIGRAVITY_START_PROMPT.md` (§Before opening Antigravity), the developer/user may execute `git init` locally at any point to track documentation revisions.
- **Commit Discipline (AGENTS.md):** Every numbered backlog task must be committed upon completion so changes can be audited, reviewed, and rolled back safely.
- **Git Hook Tooling (`VO-011`):** Husky and lint-staged will be configured in `VO-011` to enforce ESLint, Prettier formatting, and TypeScript compile checks before every git commit.

---

## 3. Rationale and Validation
- Prevents premature application scaffolding during Phase P0 (Planning & Architecture).
- Guarantees that package installation and workspace configuration occur in Phase P1 (`VO-010`) only after all foundational ADRs and threat models are reviewed.

---

## 4. Dependencies & Status
- **Dependencies:** Task `VO-010`.
- **Status:** `ACCEPTED` by Technical Lead.
