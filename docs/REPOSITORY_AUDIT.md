# VyapOne — Repository Audit (VO-000)

**Date of Audit:** 7 November 2026  
**Auditor:** Technical Lead & Implementation Agent (Antigravity)  
**Task ID:** VO-000  
**Phase:** P0 — Project audit, decisions and architecture  

---

## 1. Executive Summary & Project Status

- **Project Classification:** **Greenfield (New Project)**.
- **Current State:** The workspace contains the project governance framework, task backlog, decision register, build skill, and the four reference PRD versions. No application source code, package manifests, or test suites have been authored yet.
- **Git Status:** **Uninitialized**. The workspace is currently not a Git repository (`.git` does not exist).
- **Core Directive for P0:** Establish strict source of truth, traceability, architecture decisions (ADRs), threat model, domain entities, and engineering standards before writing any application code.

---

## 2. Host Environment & Toolchain Audit

Inspection of the host system runtimes and CLI tools via PowerShell on Windows:

| Tool | Version | Path / Executable | Status |
|---|---|---|---|
| **Node.js** | `v24.19.0` | `C:\Program Files\nodejs\node.exe` | Available |
| **npm** | `11.17.0` | `C:\Program Files\nodejs\npm.ps1` | Available |
| **pnpm** | `11.21.0` | `C:\Users\Krishna Sharma\AppData\Roaming\npm\pnpm.ps1` | Available (preferred package manager) |
| **Git** | `2.56.0.windows.1` | `C:\Program Files\Git\cmd\git.exe` | Available (workspace needs `git init`) |
| **Python** | `3.13.15` | `C:\Users\Krishna Sharma\AppData\Local\Programs\Python\Python313\python.exe` | Available |
| **OS** | Windows 10/11 | PowerShell 5.1 / Core | Host runtime |

---

## 3. Workspace File Inventory

Every file currently in the `F:\VyaponeV2` workspace was inspected:

| Relative Path | Size (Bytes) | Category | Description |
|---|---|---|---|
| `AGENTS.md` | 3,795 | Workspace Rules | Core agent instructions, invariants, and execution protocols |
| `ANTIGRAVITY_START_PROMPT.md` | 2,684 | Operational Guide | Starting instructions and prompt templates for Antigravity |
| `README.md` | 1,467 | Documentation | Workspace overview, start guide, and stack notes |
| `.agents/skills/vyapone-build/SKILL.md` | 2,867 | Agent Skill | Antigravity custom skill for sequential task execution |
| `docs/BUILD_PLAN.md` | 7,834 | Architecture & Plan | Phasing, requirements authority, rules, and Definition of Done |
| `docs/TASK_BACKLOG.md` | 43,004 | Backlog | Granular numbered tasks (VO-000 to VO-148) with acceptance criteria |
| `docs/DECISION_REGISTER.md` | 3,833 | Decision Log | 21 tracked architectural/business decisions (ADR-001 to ADR-021) |
| `docs/PHASE_GATES.md` | 5,525 | Quality Gates | Checklist criteria for passing Phases P0 through P14 |
| `docs/PROGRESS.md` | 1,542 | Status Tracking | Live progress tracking file across all phases |
| `docs/CHANGELOG.md` | 197 | Changelog | Chronological record of task-level changes |
| `reference/README.md` | 770 | Reference Guide | PRD authority rules and conflict handling instructions |
| `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` | 139,840 | Source PRD | **PRIMARY** authoritative requirements specification (v2.0 FINAL) |
| `reference/PRD_VERSIONS/PRD_v3_full_scale_2026-10-30.md` | 94,957 | Source PRD | **SUPPLEMENTARY** engineering & GA compliance guidance |
| `reference/PRD_VERSIONS/PRD_v2_2026-10-30.md` | 75,036 | Source PRD | **HISTORICAL** MVP-framed document (superseded) |
| `reference/PRD_VERSIONS/PRD_v1_original_2026-10-16.md` | 49,348 | Source PRD | **HISTORICAL** original foundational document (superseded) |

---

## 4. Existing Code, Dependencies, Scripts & Tests

- **Application Code:** **0 files**. No frontend, backend, shared packages, or database migrations exist.
- **Package Manifests:** **None**. No `package.json`, `pnpm-workspace.yaml`, or lockfiles exist.
- **Configuration Files:** **None**. No `tsconfig.json`, `tailwind.config.*`, `.env`, or lint configs exist.
- **Build / Dev Scripts:** **None**.
- **Automated Tests:** **0 test files**. No unit, integration, or E2E tests exist.
- **External Connections / Credentials:** None present. No secrets exist in the repository.

---

## 5. Audit of PRD Versions in `reference/PRD_VERSIONS/`

Four PRD documents exist in `reference/PRD_VERSIONS/`. Their characteristics and roles are:

### 5.1 `PRD_FINAL_v2_2026-11-03.md` (139,840 bytes, 2,607 lines)
- **Status:** **PRIMARY SOURCE OF TRUTH (v2.0 FINAL, 3 Nov 2026)**.
- **Key Positioning:** India-first, mobile-first business operating platform for resellers, local businesses, agencies, and freelancers.
- **Brand Line:** *"Every business. One platform."* (Supersedes *"Har business. One platform."*).
- **Design System:** **Emerald + Marigold** palette (Primary `#0B6E4F`, Hover `#095C42`, Marigold accent `#F5A524`, Warm Background `#FAF8F3`, Deep Green `#0A3D2E`).
- **Vya Identity & Mascot:** Floating green speech-bubble robot with marigold kurta collar named **"H1"** with explicit animation states and synthesized voice direction (confident-playful male, light robotic sheen).
- **AI Architecture:** Multi-tier model routing (Claude Sonnet 5.5 main, Gemini Flash fallback, Claude Haiku 5.5 / Gemini Flash-Lite small tasks, Sarvam speech for Indian languages). Shop memory architecture, strict tool-calling schemas, and confirm-before-acting rules.
- **Scope Model:** Single full-scale public launch (not an MVP or beta). Includes operational modules for all launch niche groups, Level 1 & Level 2 WhatsApp, UPI-first payment states + gateway, GST billing + e-invoicing option, automations engine, CRM list, staff mode, PWA, and reseller client billing with split settlements.

### 5.2 `PRD_v3_full_scale_2026-10-30.md` (94,957 bytes, 1,250 lines)
- **Status:** **SUPPLEMENTARY ENGINEERING & GA GUIDANCE (v3.0, 30 Oct 2026)**.
- **Role:** Provides deep production SLOs, concurrency targets (10,000 concurrent, 500 orders/sec), multi-region disaster recovery, threat modeling, DPDP Act 2023 compliance, RBI PA/PG rules, CERT-In compliance, and operational runbooks.
- **Authority Constraint:** Authoritative **only** where it does not conflict with `PRD_FINAL_v2_2026-11-03.md`.

### 5.3 `PRD_v2_2026-10-30.md` (75,036 bytes, 1,052 lines)
- **Status:** **HISTORICAL REFERENCE (v2.0 MVP-framed, 30 Oct 2026)**.
- **Role:** Drafted around a single-vertical pilot in one city with phased delivery. Superseded by the full-scale launch mandate of FINAL. Kept for historical context on rationale.

### 5.4 `PRD_v1_original_2026-10-16.md` (49,348 bytes, 1,440 lines)
- **Status:** **HISTORICAL FOUNDATION (v1.0, 16 Oct 2026)**.
- **Role:** Original product foundation describing the website builder and generic module concept. Superseded by v2, v3, and FINAL. Kept for baseline context.

---

## 6. PRD Contradictions & Reconciliations

| Topic | Historical / Earlier PRD (v1/v2/v3) | Primary Authoritative PRD (FINAL v2.0) | Resolution & Authority |
|---|---|---|---|
| **Brand Line** | *"Har business. One platform."* (v1, v2, v3) | *"Every business. One platform."* (FINAL §1, §11.4) | **FINAL v2.0 prevails**. Use *"Every business. One platform."* in all UI, docs, and assets. |
| **Launch Strategy** | MVP with 1 vertical pilot in 1 city (v2) | One complete, full-scale public launch; internal private testing only before GA (FINAL §10, §21) | **FINAL v2.0 prevails**. All launch niche group modules ship at GA. |
| **Color Palette** | Emerald + Pearl (v1, v2, v3) | Emerald + Marigold (FINAL §12.1, Primary `#0B6E4F`, Accent `#F5A524`, BG `#FAF8F3`) | **FINAL v2.0 prevails**. Design tokens must implement Emerald + Marigold. |
| **Vya Mascot** | Abstract concept / speech bubble (v1, v2) | Mascot "H1" (floating green bubble with marigold kurta collar, bobbing/blinking/talking) (FINAL §6.21, §11.5) | **FINAL v2.0 prevails**. Animation states and voice settings match FINAL §6.21. |
| **AI Model Routing** | Generic LLM or single model (v1, v2) | Claude Sonnet 5.5 (Primary), Gemini Flash (Fallback), Haiku/Flash-Lite (Small/fast), Sarvam (Indian speech) (FINAL §6.8) | **FINAL v2.0 prevails**. Router must support this multi-model architecture behind a provider-neutral gateway. |
| **Direct DIY Owner Plan** | Included as core tier in v3 | Kept as Open Decision / post-launch consideration (FINAL §25) | Recorded as **ADR-021 (Pending approval)**; Reseller-first is launch priority. |

---

## 7. Open Decisions and External Blockers (Summary of Register)

The 21 decisions tracked in `docs/DECISION_REGISTER.md` must be addressed systematically:
1. **Application Stack (ADR-001):** Next.js + React + TypeScript recommended (Provisional).
2. **Database (ADR-002):** PostgreSQL recommended (Pending host/region selection).
3. **Auth & Storage (ADR-003):** Supabase candidate (Pending RLS security evaluation).
4. **Hosting & Edge Runtime (ADR-004):** Vercel vs Cloudflare Pages (Pending evaluation).
5. **Visual Editor (ADR-005):** Puck candidate restricted to approved blocks (Pending prototype).
6. **Background Queue & Cache (ADR-006):** Redis + BullMQ candidate (Pending ops model).
7. **AI Gateway & Budgets (ADR-007):** Model routing defined in FINAL; budget caps and provider credentials pending.
8. **WhatsApp BSP (ADR-008):** Cloud API via BSP vs Direct (Pending business verification & pricing model).
9. **Merchant Payment Gateway (ADR-009):** Razorpay, Cashfree, or PhonePe PG (Pending KYC & settlement review).
10. **Reseller Split Settlement (ADR-010):** **Critical Blocker for Live Billing**. Platform must never pool/hold merchant funds without license. Provider marketplace split API required.
11. **GST Rules & Invoicing (ADR-014):** **Critical Blocker for Live GST**. Format and calculation rules require Chartered Accountant sign-off.
12. **DPDP Compliance & Data Retention (ADR-015):** **Critical Blocker for GA**. Legal sign-off required for privacy policy, data deletion, and consent records.
13. **External Platform Approvals (ADR-017, ADR-018):** Google Business Profile API and Meta App verification required before live sync.

---

## 8. Verification of VO-000 Acceptance Criteria

- [x] **Audit document exists:** `docs/REPOSITORY_AUDIT.md` created.
- [x] **Every PRD version is identified:** All 4 PRDs analyzed with dates, roles, line counts, sizes, and relationships.
- [x] **Existing code and commands recorded:** Verified 0 source files, 0 packages, 0 tests; recorded host runtimes (Node 24, npm 11, pnpm 11, git 2.56, python 3.13).
- [x] **No implementation files changed:** Only documentation and audit artifacts created. No application code written.
