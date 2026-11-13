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
│   3. Setup Node.js 24 LTS (`actions/setup-node` pinned SHA, cached pnpm)    │
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

In strict adherence to security engineering standards, third-party GitHub Actions are pinned to full 40-character commit SHAs to protect against upstream supply-chain attacks and mutable tag tampering. All actions run natively on Node 24 (`runs.using: 'node24'`) ensuring compatibility with the GitHub Actions runtime:

| Action | Pinned Commit SHA | Tag / Release Reference | Purpose |
| :--- | :--- | :--- | :--- |
| **`actions/checkout`** | `9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0` | `v7.0.0` | Clean repository checkout with `persist-credentials: false` (runs on Node 24) |
| **`pnpm/action-setup`** | `fc06bc1257f339d1d5d8b3a19a8cae5388b55320` | `v5.0.0` | Exact pnpm setup resolving version from `package.json` (runs on Node 24) |
| **`actions/setup-node`** | `949feb2413d6458794dcd2491c4babbbce0c15c1` | `v7.1.0` | Node.js 24 LTS setup reading `.nvmrc` with pnpm store caching (runs on Node 24) |

### Security Invariants
- **Least-Privilege Permissions:** Global workflow permission is locked to `contents: read`. No write permissions, no OIDC `id-token` write permissions, no deployment privileges.
- **Pull Request Safety:** Standard `pull_request` trigger is used (not `pull_request_target`). Untrusted code cannot access repository secrets or run with elevated tokens.
- **Credential Hygiene:** `persist-credentials: false` prevents git credentials from lingering on runner disks.
- **Concurrency Control:** `cancel-in-progress: true` automatically terminates obsolete CI runs when a developer pushes new commits to an open PR.

---

## 3. Node.js & Package Manager Reproducibility

- **Node.js Runtime:** Fixed to Node.js 24 LTS (`.nvmrc` contains `24`). Aligned with `package.json` `"engines": { "node": ">=24.0.0" }`.
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

---

## 7. Cloudflare Workers Builds & Deployment Troubleshooting

### Incident: `ERROR packages field missing or empty`

- **Symptom:** Cloudflare Workers Builds / Pages Build failed during dependency installation:
  ```
  Detected:
  - pnpm@10.11.1
  - Node.js 24.18.0

  Command:
  pnpm install --frozen-lockfile

  Error:
  ERROR packages field missing or empty
  ```
- **Root Cause:** When `pnpm-workspace.yaml` is present in the repository root, pnpm treats the directory as a workspace manifest. If `pnpm-workspace.yaml` contains configuration keys (such as `allowBuilds:`) but lacks a non-empty `packages` array, pnpm's workspace reader terminates immediately with `ERR_PNPM_PACKAGES_FIELD_MISSING_OR_EMPTY`.
- **Resolution:** In single-package applications where the primary application lives at the repository root, `pnpm-workspace.yaml` must explicitly declare the root package directory:
  ```yaml
  packages:
    - "."
  allowBuilds:
    esbuild: true
    workerd: true
  onlyBuiltDependencies:
    - esbuild
    - workerd
  ```

### Incident: `[ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: workerd@...`

- **Symptom:** During Cloudflare deployment (`Deploy command: npx wrangler deploy`), dependency installation for `wrangler` and its binary runtime `workerd` fails with:
  ```
  [ERR_PNPM_IGNORED_BUILDS] Ignored build scripts: workerd@1.20261110.1
  Run "pnpm approve-builds" to pick which dependencies should be allowed to run scripts.
  Failed: error occurred while running deploy command
  ```
- **Root Cause:** In pnpm v10 and v11, lifecycle scripts (`postinstall`/`install`) for transient and direct dependencies are ignored by default under supply-chain security policies unless explicitly approved in `pnpm-workspace.yaml`. When `npx wrangler deploy` runs inside a pnpm-managed project, `workerd`'s postinstall script is blocked if `workerd` is not listed in `allowBuilds` or `onlyBuiltDependencies`.
- **Resolution:** Add `workerd` to both `allowBuilds` and `onlyBuiltDependencies` in `pnpm-workspace.yaml`:
  ```yaml
  packages:
    - "."
  allowBuilds:
    esbuild: true
    workerd: true
  onlyBuiltDependencies:
    - esbuild
    - workerd
  ```
- **Cloudflare Build Environment Assumptions:**
  - **Root Directory:** Repository root (`.`).
  - **Node.js Version:** Node.js 24 LTS (`v24.18.0`+ / `.nvmrc` `24`).
  - **Package Manager Version:** Pinned to `pnpm@11.21.0` in `package.json` (`packageManager: "pnpm@11.21.0"`). Cloudflare Workers Builds detects package manager versions through standard Corepack / `package.json` conventions.
  - **Lockfile Integrity:** `pnpm-lock.yaml` remains strictly frozen (`--frozen-lockfile`) without generating or mutating lockfile entries.

