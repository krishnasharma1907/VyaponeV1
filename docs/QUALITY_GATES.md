# VyapOne — Measurable Quality Gates and Verification Criteria

**Document Version:** 1.0  
**Date:** 8 November 2026  
**Status:** Canonical Quality Gates Specification  
**Task ID:** VO-006  
**Primary Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15, §17, §18, §22)  
**Related Documents:** `docs/PHASE_GATES.md`, `docs/ENGINEERING_STANDARDS.md`, `docs/TEST_STRATEGY.md`, `docs/DECISION_REGISTER.md`

---

## 1. Governance Principles

Quality gates are non-negotiable, verifiable criteria that must be satisfied before code can be merged, before a development phase can be closed, and before the platform can be released to the public.

> [!CAUTION]
> **EVIDENCE VERIFICATION PROTOCOL:**  
> A gate must never be claimed as passed based on assumption, aspiration, or generated code alone. Every gate requires actual test execution output, terminal command results, or signed stakeholder approvals.

Quality gates are organized into three distinct tiers:
1. **Tier 1: Development Gates (Pre-Commit & Pull Request Level)**
2. **Tier 2: Phase Gates (Phase P0 through P14 Closure)**
3. **Tier 3: General Availability (GA) Release Gates**

---

## 2. Tier 1: Development Gates (PR Level)

Every single commit and Pull Request must pass all Tier 1 gates automatically in CI before merging into the protected `main` branch:

| Gate ID | Area | Measurable Pass/Fail Criteria | Automated Verification Tool |
|---|---|---|---|
| **GATE-DEV-01** | **Type Safety** | `tsc --noEmit` exits with code `0`. Zero type errors. Zero `any` types. Zero non-null assertions (`!`). | TypeScript Compiler |
| **GATE-DEV-02** | **Code Quality** | `eslint .` exits with code `0`. Zero lint errors or warnings. Code matches Prettier rules. | ESLint & Prettier |
| **GATE-DEV-03** | **Unit & Integration** | 100% of unit and integration tests pass. Zero skipped or disabled tests. Execution time $< 120\text{s}$. | Vitest |
| **GATE-DEV-04** | **Test Coverage** | $\ge 80\%$ line/branch coverage across domain services; **100% test coverage** on tax calculation and payment reconciliation logic. | Vitest Coverage (v8) |
| **GATE-DEV-05** | **Tenant RLS Policy** | Every new database table has PostgreSQL RLS enabled and an automated isolation test (`ST-TENANT-01`) passing. | Vitest + Test DB |
| **GATE-DEV-06** | **Input Validation** | 100% of Server Actions and REST route handlers validate incoming inputs via shared Zod schemas (`.parse()` or `.safeParse()`). | ESLint Custom Rule / PR Review |
| **GATE-DEV-07** | **Secret Protection** | Zero API keys, database credentials, or tokens in git diff. `.env.example` updated if new env variables added. | `gitleaks` / `trufflehog` |
| **GATE-DEV-08** | **Dependency Audit** | `pnpm audit` (or `npm audit`) reports **0 critical or high vulnerabilities**. Permissive OSS licenses only. | `pnpm audit` + license-checker |
| **GATE-DEV-09** | **Mobile Layout** | PR containing UI components renders without horizontal scroll or broken text on a **390px mobile viewport**. | Playwright Mobile Snapshot |

---

## 3. Tier 2: Phase Completion Gates

In strict adherence to `docs/PHASE_GATES.md`, no phase can be marked complete until all phase tasks are `DONE` and its specific phase gate criteria have passed:

### P0 — Project Audit, Decisions and Architecture
- [x] All phase tasks (`VO-000` to `VO-006`) marked `DONE`.
- [x] Authoritative document hierarchy established (`SOURCE_OF_TRUTH.md`).
- [x] Bidirectional traceability matrix completed (`REQUIREMENTS_TRACEABILITY.md`).
- [x] Master ADR index (ADR-001 to ADR-025) and threat model completed.
- [x] Canonical domain architecture and 8 Mermaid diagrams verified.
- [x] Engineering standards, test strategy, project structure, and quality gates documented.
- [x] Zero application code, zero packages installed, zero cloud infrastructure modified.
- [x] **Phase P0 Evidence:** Verified and signed by Technical Lead on 8 November 2026.

### P1 — Repository, Design System and Application Shell
- [ ] Task `VO-010` to `VO-019` marked `DONE`.
- [ ] Application workspace initialized with Next.js 15+, React 19, Tailwind CSS.
- [ ] Centralized design tokens (Emerald `#0F5132` + Marigold `#D97706`) implemented.
- [ ] Accessible UI primitives built and verified against WCAG 2.2 AA.
- [ ] Route shells (Public, Reseller, Owner, Counter, Admin) render at 320px, 390px, 768px, 1440px.
- [ ] CI pipeline configured and passing all Tier 1 development gates.

### P2 — Platform Identity, Authentication and Multi-Tenancy
- [ ] Tasks `VO-020` to `VO-028` marked `DONE`.
- [ ] PostgreSQL migration framework operational (`VO-020`).
- [ ] Delegated auth provider integration (`UserAuthIdentity`) tested; zero passwords in app domain.
- [ ] Dual-layer tenant isolation verified: Server checks + PostgreSQL `SET LOCAL` RLS policies.
- [ ] Automated cross-tenant denial tests (`ST-TENANT-01`, `ST-TENANT-02`) pass with evidence.

### P4 — Website Engine, Templates and Publishing
- [ ] Tasks `VO-040` to `VO-049` marked `DONE`.
- [ ] Structured website AST engine assembled; zero arbitrary user code execution.
- [ ] Constrained mobile visual editor verified at 390px viewport width.
- [ ] Publish pipeline, custom domain SSL provisioning, and version rollback verified.

### P5 & P10 — Vya AI Gateway, Assistant and Safety
- [ ] Multi-tier model routing (Claude Sonnet 3.5, Gemini Flash) operational with auto-failover.
- [ ] Vya Golden Evaluation Suite passes with $\ge 95\%$ accuracy across 100+ prompt test cases.
- [ ] Adversarial prompt injection test suite (`ST-AI-01`) passes with zero system prompt leaks.
- [ ] All material write operations return staged `PendingAction` cards requiring human approval.
- [ ] AI is verified to have zero access to tax calculation formulas.

### P8 — Customers, GST Billing, Payments and Reseller Splits
- [ ] Gap-free sequential invoice numbering (`invoice_sequences`) verified under concurrent load.
- [ ] CGST/SGST/IGST tax calculation verified against master tax tables.
- [ ] Webhook HMAC signature verification and replay defense (`ST-WEBHOOK-01`, `ST-WEBHOOK-02`) pass.
- [ ] Reseller split settlement flow verified in provider sandbox.

---

## 4. Tier 3: General Availability (GA) Release Gates

The platform cannot cut over to production General Availability until every single GA release gate is formally verified:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   GENERAL AVAILABILITY (GA) GATES                      │
├─────────────────────────┬─────────────────────────┬────────────────────┤
│ 1. Functional & Quality │ 2. Statutory & Legal    │ 3. Ops & Security  │
│ • Zero P0/P1 Defects    │ • CA GST Sign-off       │ • CERT-In Runbook  │
│ • 8 Niche Beta Pilots   │ • Legal DPDP Approval   │ • RTO < 1h / RPO   │
│ • WCAG 2.2 AA Certified │ • Split Partner Contract│ • 10k User Load    │
└─────────────────────────┴─────────────────────────┴────────────────────┘
```

| Gate ID | Domain | Mandatory Verification Requirement | Required Sign-Off Owner |
|---|---|---|---|
| **GATE-GA-01** | **Defect Density** | **Zero unresolved P0 (Critical) or P1 (High) defects.** All known issues triaged. | Technical Lead & QA Lead |
| **GATE-GA-02** | **Niche Pilot Validation** | Private beta completed across all 8 supported niches with verified real transactions (`VO-135`). | Product Owner |
| **GATE-GA-03** | **Accessibility (WCAG)** | Formal WCAG 2.2 AA audit completed. Zero critical/serious axe-core violations; keyboard & focus validated. | Frontend Lead |
| **GATE-GA-04** | **Performance & Web Vitals** | Public storefronts achieve: LCP $< 2.5\text{s}$, INP $< 200\text{ms}$, CLS $< 0.1$, TTFB $< 800\text{ms}$ on 4G networks. | Performance Lead |
| **GATE-GA-05** | **Scale & Load** | k6 load test sustains 10,000 concurrent storefront visitors with $p95 < 500\text{ms}$ and error rate $< 0.1\%$. | Infrastructure Lead |
| **GATE-GA-06** | **AI Safety & Quality** | Vya Golden Eval Suite scores $\ge 95\%$; zero hallucinations on prices/taxes; zero prompt injection vulnerabilities. | AI Engineering Lead |
| **GATE-GA-07** | **GST & Tax Compliance** | Formal CA review of HSN/SAC tables, tax rounding, and invoice sequence layouts (`ADR-014`). | **Licensed Chartered Accountant** |
| **GATE-GA-08** | **Privacy & DPDP Act** | Privacy policy, consent retention, DPA, and Grievance Officer details approved under DPDP Act 2023 (`ADR-015`). | **Licensed Legal Counsel** |
| **GATE-GA-09** | **Split Settlement** | Fully executed contract with licensed payment aggregator for reseller split settlement (`ADR-010`). | **Commercial & Legal Lead** |
| **GATE-GA-10** | **Disaster Recovery** | DR drill completed: automated failover demonstrated with RTO $< 1\text{ hour}$ and RPO $< 15\text{ minutes}$. | Infrastructure Lead |
| **GATE-GA-11** | **CERT-In Compliance** | Tamper-evident NTP-synchronized audit logs; 6-hour cybersecurity incident reporting runbook documented (`ADR-025`). | Security Lead |
| **GATE-GA-12** | **Production Cutover** | Automated blue-green / canary cutover plan ready with one-click rollback verification (`VO-137`). | Technical Lead |

---

## 5. Gate Bypass and Exception Policy

- **No Unauthorized Bypasses:** Under no circumstances can a developer, agent, or manager bypass a Tier 1 or Tier 3 gate.
- **Temporary Exception Process:** If an urgent emergency fix is required in production, an exception can only be authorized in writing by the Technical Lead, accompanied by an immediate follow-up ticket scheduled for resolution within 24 hours.
