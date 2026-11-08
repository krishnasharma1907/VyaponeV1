# ADR-024: Testing Architecture, Quality Assurance and Golden Evaluation Suite

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-20, NFR-A11Y-01, Quality Strategy §20, AC-15, AC-20  
**Affected Tasks:** `VO-003`, `VO-019`, `VO-051`, `VO-106`, `VO-130`, `VO-131`, `VO-132`  

---

## 1. Context and Problem Statement
VyapOne is a mission-critical platform where failures directly affect local merchants' cash flow, tax compliance, and client trust. PRD FINAL §20 and §23 specify comprehensive quality gates:
1. Automated unit, calculation, and schema validation tests.
2. Cross-tenant negative security tests proving tenant A cannot access tenant B data.
3. End-to-end browser journeys automated with Playwright, specifically validating 390 px mobile viewports.
4. Multilingual Vya Golden Evaluation Suite (100+ prompt checks per launch language) to prevent AI regressions.
5. Accessibility audits targeting WCAG 2.2 AA and `prefers-reduced-motion`.

We must define the test runner architecture, fixture seeding conventions, and CI quality gates.

---

## 2. Options Considered

### Option 1: Vitest (Unit/Integration) + Playwright (E2E) + In-House Eval Runner (Recommended)
- **Unit & Component Testing:** Vitest with React Testing Library and `@testing-library/user-event`. Fast, native TypeScript execution, sharing identical Vite/Next.js transform pipeline.
- **End-to-End Testing:** Playwright running against headless Chromium configured with standard device descriptors:
  - Mobile: `iPhone 14 / Pixel 7` (390 px viewport).
  - Tablet: `iPad Mini` (768 px viewport).
  - Desktop: `1024 px` and `1440 px`.
- **Accessibility Testing:** `@axe-core/playwright` embedded into Playwright journeys, failing automatically on any WCAG 2.2 AA contrast or label violation.
- **Vya Golden Evaluation Suite (`VO-051`, `VO-106`):** Automated test runner executing 100+ multi-turn prompt scenarios in English, Hindi, and regional languages, evaluating tool call schemas, prompt injection resistance, and hallucination bounds.

### Option 2: Jest + Cypress
- **Analysis:** Slower execution speed; Cypress has weaker multi-tab and iframe support compared to Playwright; Jest requires complex Babel/SWC transformation setups in modern TypeScript projects.

---

## 3. Comparison of Options

| Criterion | Option 1: Vitest + Playwright | Option 2: Jest + Cypress |
|---|---|---|
| **Execution Speed & Concurrency** | **Blazing Fast:** Vitest runs 3–5x faster than Jest; Playwright parallelizes browser contexts natively. | Slower test runs; Cypress struggles with parallel tab isolation. |
| **Mobile Viewport & Touch Emulation** | **First-Class:** Playwright accurately emulates touch events, mobile keyboards, and viewports. | Cypress mobile emulation is less representative of native mobile browser behavior. |
| **TypeScript & ESM Support** | **Native 100%:** Zero configuration required. | Requires custom configuration and mocking workarounds. |

---

## 4. Architectural Implications

- **CI Pipeline Gate (`VO-018`):** Every pull request runs:
  `pnpm lint` → `pnpm typecheck` → `pnpm test:unit` → `pnpm build`.
- **Seeded Test Harness (`VO-019`):** A dedicated database seeder (`test-seed.ts`) populates two complete mock businesses:
  - Business A: "The Chai Story" (Food/Hospitality, Cafe)
  - Business B: "Glow & Shine" (Beauty/Wellness, Salon)
- **Tenant Isolation Negative Tests:** Integration tests explicitly attempt to fetch Business B’s orders using Business A’s auth session token, asserting HTTP 403 / zero rows returned.

---

## 5. Recommendation and Rationale
**Adopt Option 1: Vitest for unit/integration tests, Playwright for mobile E2E journeys, and a dedicated Vya Golden Evaluation Suite.**
- Directly matches the testing libraries specified in PRD FINAL §19.2 and §20.1.
- Guarantees strict mobile 390 px validation and zero regression on prompt updates.

---

## 6. Dependencies & Status
- **Dependencies:** Task `VO-019` (Test harness), `VO-051` (Eval set), `VO-130` (Full E2E suite).
- **Status:** `PROPOSED` by Technical Lead.
