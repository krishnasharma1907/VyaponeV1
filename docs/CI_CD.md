# VyapOne Continuous Integration (CI) and Branch Protection Architecture

**Task ID:** VO-018  
**Phase:** P1 — Repository, Design System and Application Shell  
**Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15, §17, §20 Quality Strategy)  
**Status:** Canonical CI/CD Specification  

---

## 1. Executive Summary & CI Pipeline Architecture

VyapOne enforces automated quality validation on every code change before it can be merged into the primary production branch (`main`).

The CI pipeline runs via GitHub Actions (`.github/workflows/ci.yml`) and is structured into two sequential stages:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GitHub Event: PR or Push to `main`                    │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│         Job 1: Quality Checks (`quality-checks`) [Timeout: 15 min]           │
│   1. Checkout repository (`actions/checkout` pinned SHA)                    │
│   2. Setup pnpm (`pnpm/action-setup` pinned SHA)                            │
│   3. Setup Node.js 20 LTS (`actions/setup-node` pinned SHA, cached pnpm)    │
│   4. Reproducible install: `pnpm install --frozen-lockfile`                 │
│   5. Format Check: `pnpm format:check` (Prettier)                           │
│   6. Lint Check: `pnpm lint` (ESLint 9 Flat Config)                         │
│   7. Type Safety: `pnpm typecheck` (TypeScript 5.7+ `tsc --noEmit`)         │
│   8. Unit & Integration Tests: `pnpm test` (Vitest 3+)                      │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ (Must Pass with Code 0)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│         Job 2: Production Build (`production-build`) [Timeout: 15 min]      │
│   1. Checkout repository & setup cached dependencies                        │
│   2. Reproducible install: `pnpm install --frozen-lockfile`                 │
│   3. Next.js 15 Production Build: `pnpm build` (30/30 route shells compiled)│
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Pinned Action Matrix & Supply Chain Security

In strict adherence to security engineering standards, third-party GitHub Actions are pinned to full 40-character commit SHAs to protect against upstream supply-chain attacks and mutable tag tampering:

| Action | Pinned Commit SHA | Tag / Release Reference | Purpose |
| :--- | :--- | :--- | :--- |
| **`actions/checkout`** | `11bd71901bbe5b1630ceea73d27597364c9af683` | `v4.2.2` | Clean repository checkout with `persist-credentials: false` |
| **`pnpm/action-setup`** | `fe02b34f77f8bc703788d5817da081398fad5dd2` | `v4.0.0` | Exact pnpm setup resolving version from `package.json` |
| **`actions/setup-node`** | `1d0ff469b62b6d0ad9b0af0fb3b1e40be53ce9b9` | `v4.2.0` | Node.js 20 LTS setup reading `.nvmrc` with pnpm store caching |

### Security Invariants
- **Least-Privilege Permissions:** Global workflow permission is locked to `contents: read`. No write permissions, no OIDC `id-token` write permissions, no deployment privileges.
- **Pull Request Safety:** Standard `pull_request` trigger is used (not `pull_request_target`). Untrusted code cannot access repository secrets or run with elevated tokens.
- **Credential Hygiene:** `persist-credentials: false` prevents git credentials from lingering on runner disks.
- **Concurrency Control:** `cancel-in-progress: true` automatically terminates obsolete CI runs when a developer pushes new commits to an open PR.

---

## 3. Node.js & Package Manager Reproducibility

- **Node.js Runtime:** Fixed to Node.js 20 LTS (`.nvmrc` contains `20`). Aligned with `package.json` `"engines": { "node": ">=20.0.0" }`.
- **Package Manager:** Pinned to `pnpm@11.21.0` via `package.json` `"packageManager": "pnpm@11.21.0"`.
- **Lockfile Enforcement:** CI executes strictly with `pnpm install --frozen-lockfile`. If `pnpm-lock.yaml` is out of sync with `package.json`, CI fails immediately rather than silently mutating dependencies.

---

## 4. Zero Secrets in CI Policy

VyapOne CI **never requires live database credentials, production secrets, or third-party API keys**:
- Unit tests (`pnpm test`) run in Vitest using mock providers and scoped in-memory configurations.
- Production compilation (`pnpm build`) verifies Next.js App Router route shells statically without requiring an active database socket or remote Supabase project.
- No `.env` files containing actual secrets are committed or loaded in CI.
- Third-party integrations (Razorpay, WhatsApp BSP, Gemini AI, Redis) default safely to `isConfigured: false` without failing builds.

---

## 5. Required Status Checks for Branch Protection

Once repository hosting is fully configured, repository administrators must configure GitHub Branch Protection Rules on the `main` branch to require the following status checks:

1. **`Quality Checks (Format, Lint, Typecheck, Unit Tests)`** (`quality-checks`)
2. **`Production Build (Next.js 15 App Router)`** (`production-build`)

### Recommended Branch Protection Settings
- **Require a pull request before merging:** Yes
- **Require approvals:** At least 1 code review approval
- **Require status checks to pass before merging:** Yes
  - Require branches to be up to date before merging (`strict`)
  - Status checks: `Quality Checks (Format, Lint, Typecheck, Unit Tests)`, `Production Build (Next.js 15 App Router)`
- **Require conversation resolution before merging:** Yes
- **Require signed commits:** Yes (GPG / SSH commit signing)
- **Do not allow bypassing the above settings:** Yes (enforced for platform administrators)

> [!IMPORTANT]
> **Pending Administrator Action:**  
> Branch protection rules cannot be applied automatically via local git operations. They must be enabled in GitHub repository settings by an authorized repository administrator.

---

## 6. How to Reproduce CI Locally

Developers can verify all CI quality gates locally before pushing code using the exact same sequence:

```bash
# 1. Reproducible dependency verification
pnpm install --frozen-lockfile

# 2. Check code style
pnpm format:check

# 3. Check code quality
pnpm lint

# 4. Check type safety
pnpm typecheck

# 5. Run test suite
pnpm test

# 6. Verify production compilation
pnpm build
```

### Investigating Failures
- **Formatting Failure (`pnpm format:check`):** Run `pnpm format:write` to automatically format all non-compliant files.
- **Lint Failure (`pnpm lint`):** Run `pnpm lint:fix` or inspect ESLint diagnostics reported in the terminal.
- **Typecheck Failure (`pnpm typecheck`):** Inspect TypeScript compiler output. Remember that VyapOne prohibits `any` types and non-null assertions (`!`).
- **Test Failure (`pnpm test`):** Run `pnpm vitest run <file>` to isolate failing test cases and inspect expectations.
- **Build Failure (`pnpm build`):** Inspect the Next.js compilation trace for module resolution errors or accidental client-side imports of `server-only` modules.
