# VyapOne — Testing Conventions & Quality Assurance Architecture

**Document Version:** 1.0  
**Task ID:** VO-019  
**Phase:** P1 — Repository, Design System and Application Shell  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15, §16, §17, §18, §20, §23, §26)  
**Related Documents:** `docs/TEST_STRATEGY.md`, `docs/QUALITY_GATES.md`, `docs/ENGINEERING_STANDARDS.md`, `docs/DATABASE_ARCHITECTURE.md`, `docs/CI_CD.md`  
**Status:** Canonical Testing Standard  

---

## 1. Testing Philosophy & Layer Architecture

VyapOne enforces a deterministic, multi-tiered testing pyramid designed to catch regressions early, maintain rock-solid tenant boundaries, guarantee statutory accuracy (GST and integer currency), and protect against cross-session data leaks.

```
                              ┌─────────────────────────────┐
                              │     Playwright E2E Tests    │
                              │  (Mobile 390px, 320px, Desk)│
                              ├─────────────────────────────┤
                              │      Integration Tests      │
                              │ (Shell + Server Validation) │
                              │ (Multi-Tenant Isolation)    │
                              ├─────────────────────────────┤
                              │       Fast Unit Tests       │
                              │ (Pure logic, Primitives,    │
                              │  Zod schemas, Factories)    │
                              └─────────────────────────────┘
```

### 1.1 Testing Layers

| Layer | Runner / Tool | Target Directory | Primary Scope | Network / DB Dependency |
| :--- | :--- | :--- | :--- | :--- |
| **Unit Tests** | Vitest (`jsdom`) | `tests/unit/` | Isolated components, design tokens, Zod schemas, client/server config parsing, entity factories, seed guards | **Zero live network / zero external DB** |
| **Integration Tests** | Vitest (`jsdom`) | `tests/integration/` | Cross-module flows, App Router shells with server validation, multi-tenant hierarchy separation | **In-memory state & mocks only** |
| **Browser / E2E Tests** | Playwright | `tests/e2e/` | Visual layout rendering, navigation links, mobile-first 390px responsive fidelity | **Local Next.js server (`127.0.0.1:3000`)** |
| **Responsive Runner** | Playwright script | `scripts/validate-responsive.mjs` | Multi-viewport screenshot generation (320, 390, 768, 1024, 1440px) | **Local Next.js production build (`:3005`)** |

---

## 2. Directory Structure

The `tests/` directory strictly isolates testing layers to prevent runner confusion and cross-test contamination:

```
tests/
├── unit/                               # Fast unit tests (Vitest)
│   ├── baseline.test.ts                # Environment smoke verification
│   ├── ci/                             # CI workflow & Dependabot validation
│   ├── components/                     # Shared UI primitives & interaction tests
│   ├── config/                         # Server-only vs. public client config boundaries
│   ├── database/                       # Database pooler & connection inspector tests
│   ├── factories/                      # Entity builder & sequence tests
│   ├── fixtures/                       # Seeded demo dataset & guard tests
│   ├── responsive/                     # CSS token & responsive foundation tests
│   ├── routing/                        # App Router 30 route shell accessibility tests
│   ├── supabase/                       # Supabase browser, server, admin client tests
│   └── tokens/                         # WCAG 2.2 AA contrast & design token tests
├── integration/                        # Multi-module integration tests (Vitest)
│   ├── app-shell-validation.test.tsx   # Shell rendering with validated server config
│   └── multi-tenant-isolation.test.ts  # Cross-tenant data separation & hierarchy tests
├── e2e/                                # End-to-end browser tests (Playwright)
│   └── app-shell.spec.ts               # Browser smoke & portal navigation verification
├── factories/                          # Reusable strongly typed entity builders
│   ├── types.ts                        # ID sequence generator & shared helper types
│   ├── users.ts                        # User & Auth Identity factories
│   ├── workspaces.ts                   # Reseller Workspace & Member factories
│   ├── businesses.ts                   # Business, Location, Member, Site factories
│   ├── commerce.ts                     # Catalogue, Customer, Order, Bill, AuditLog factories
│   └── index.ts                        # Central factory barrel export
└── fixtures/                           # Seed datasets & static fixture files
    └── demo-seed.ts                    # Canonical in-memory multi-tenant demo tree
```

---

## 3. Test Conventions & Coding Standards

### 3.1 File and Test Naming Rules
- **Unit and Integration Tests:** Must end with `.test.ts` or `.test.tsx` and reside under `tests/unit/` or `tests/integration/`.
- **Playwright E2E Tests:** Must end with `.spec.ts` and reside under `tests/e2e/`. Vitest is explicitly configured to exclude `tests/e2e/**` to prevent framework collision.
- **Test Block Naming:** Always use descriptive names stating the domain, task ID, and expected behavior:
  ```ts
  describe("Integration: Core App Shell & Server Configuration Validation [VO-019]", () => {
    it("rejects invalid server environment before shell rendering can occur", () => { ... });
  });
  ```

### 3.2 The Arrange-Act-Assert (AAA) Pattern
Every test must be structured cleanly into three visible phases:
```ts
it("calculates sequential invoice total with exact integer tax precision", () => {
  // 1. Arrange: Setup fixtures and deterministic inputs
  const bill = createTestBill({
    amount_minor: 720339, // ₹7,203.39
    tax_minor: 129661,    // ₹1,296.61
    total_minor: 850000,  // ₹8,500.00
  });

  // 2. Act: Execute domain function or query
  const sum = bill.amount_minor + bill.tax_minor;

  // 3. Assert: Validate results and invariants
  expect(sum).toBe(bill.total_minor);
  expect(Number.isInteger(sum)).toBe(true);
});
```

### 3.3 Test State Isolation & Mocking Boundaries
1. **Never Share Mutable State:** Each test must start from a clean baseline. Reset sequence counters via `beforeEach(() => resetFactorySequence())`.
2. **Restore Environment Variables:** When tests modify `process.env`, save `originalEnv = process.env` before tests and restore it in `afterEach()`.
3. **Mock Boundaries vs. Live Services:**
   - Unit and integration tests mock external services (Supabase, Razorpay, WhatsApp BSP, Redis, LLM).
   - Mock tests must **never** be reported as live service tests.
   - Tests requiring live databases or cloud services are deferred to dedicated integration harnesses with local TestContainers or Supabase Local CLI.

---

## 4. Reusable Test Factories & Fixtures

All entity factories are located in `tests/factories/` and directly typed against the canonical database schema (`Database["public"]["Tables"]` from `src/lib/supabase/types.ts`):

### 4.1 Supported Canonical Entity Factories
- `createTestUser(overrides?)`
- `createTestUserAuthIdentity(overrides?)`
- `createTestWorkspace(overrides?)`
- `createTestWorkspaceMember(overrides?)`
- `createTestBusiness(overrides?)`
- `createTestLocation(overrides?)`
- `createTestBusinessMember(overrides?)`
- `createTestSite(overrides?)`
- `createTestCatalogueItem(overrides?)`
- `createTestOrder(overrides?)`
- `createTestCustomer(overrides?)`
- `createTestBill(overrides?)`
- `createTestAuditLog(overrides?)`

### 4.2 Factory Design Rules
1. **Deterministic Unique IDs:** Automatically generated using counter sequences (`usr_0001`, `ws_0001`, `biz_0001`, `ord_0001`).
2. **Predictable Timestamps:** Fixed to `2026-11-01T10:00:00.000Z` (`BASE_TEST_TIMESTAMP`).
3. **Monetary Values in Integer Minor Units:** Stored strictly as integers (`amount_minor`, `price_minor`, `tax_minor`, `total_minor`). Currency code defaults to `"INR"`. Floating-point values are strictly prohibited.
4. **Zero Real PII:** All emails use the `@example.vyapone.internal` domain; all phone numbers use demo prefixes (`+9198765...`).

---

## 5. Seeded Local Demo Data & Safety Guards

The canonical synthetic demo dataset (`tests/fixtures/demo-seed.ts` and `src/lib/database/seed.ts`) models the complete sovereign multi-tenant hierarchy:

```
Platform Admin (usr_platform_admin_0001)
  └── Reseller Workspace (ws_apex_commerce_0001: Apex Commerce Studio)
        ├── Workspace Members (Owner: Vikram Mehta, Staff: Siddharth Rao)
        └── Sovereign Business (biz_kaveri_silks_0001: Kaveri Silks & Sarees)
              ├── Sovereign Owner (Priya Sharma)
              ├── Location (loc_kaveri_commercial_st_0001: Commercial Street Store)
              ├── Staff (Store Manager: Rajesh, Cashier: Deepa)
              ├── Published Site (kaveri-silks.vyapone.com)
              ├── Catalogue Items (3 pure silk saree items in minor paise units)
              ├── Customers (Ananya Rao, Rahul Verma)
              ├── Orders (ORD-2026-0001: ₹8,500.00, ORD-2026-0002: ₹3,200.00)
              ├── Sequential Invoice (INV/2026-27/0001: ₹8,500.00)
              └── Audit Trail Logs (Order & Bill generation)
```

### 5.1 Environment Safety Assertions
The seed utility (`src/lib/database/seed.ts`) enforces strict runtime guards via `assertSafeSeedEnvironment()`:
- **Production Block:** Throws `SeedingSecurityError` if `NODE_ENV === "production"`.
- **Staging / Remote Block:** Throws `SeedingSecurityError` if `NEXT_PUBLIC_APP_ENV` is `"production"` or `"staging"`.
- **Target Host Verification:** Throws `SeedingSecurityError` if `DATABASE_URL` contains any host other than `localhost`, `127.0.0.1`, or `supabase_db`.
- **Database Schema Dependency:** Physical SQL table insertion requires schema migrations from task `VO-020`. In VO-019, the seed is verified as an in-memory dataset and export utility.

---

## 6. Coverage Baseline & Thresholds

Vitest coverage is configured via `@vitest/coverage-v8` in `vitest.config.ts`, covering all application source code under `src/` while excluding barrel files (`src/**/index.ts`) and pure type files (`src/**/types.ts`).

### 6.1 Measured Baseline vs. Enforced Thresholds

| Metric | Measured Baseline (`src/`) | Enforced CI Threshold | Status |
| :--- | :--- | :--- | :--- |
| **Statements** | **96.35%** | **85.00%** | **PASSING (+11.35%)** |
| **Branches** | **79.75%** | **70.00%** | **PASSING (+9.75%)** |
| **Functions** | **92.30%** | **80.00%** | **PASSING (+12.30%)** |
| **Lines** | **96.35%** | **85.00%** | **PASSING (+11.35%)** |

---

## 7. Developer Test Execution Commands

```bash
# Run all unit and integration tests (fast, in-memory)
pnpm test

# Run unit tests only
pnpm test:unit

# Run integration tests only
pnpm test:integration

# Run full test suite with v8 coverage report and threshold verification
pnpm test:coverage

# Run Playwright end-to-end browser tests
pnpm test:e2e

# Run responsive multi-viewport screenshot runner (starts local production server)
pnpm test:responsive
```

---

## 8. Debugging Test Failures

1. **Focused Execution:** Run a single test file using `pnpm vitest run <path/to/test>` (e.g. `pnpm vitest run tests/integration/app-shell-validation.test.tsx`).
2. **Watch Mode:** Run `pnpm test:watch` for interactive hot-reloading during development.
3. **Inspect Output & Logs:** Vitest prints detailed assertion diffs. When testing components, `screen.debug()` can be inserted to print the full DOM tree.
4. **Server-Only Boundary Failures:** If a client test accidentally imports a server-only file, Next.js `server-only` will throw an error immediately, identifying the unauthorized import chain.
