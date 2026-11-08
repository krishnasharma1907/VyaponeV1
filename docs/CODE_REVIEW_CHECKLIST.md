# VyapOne — Peer Review and Pull Request Checklist

**Document Version:** 1.0  
**Date:** 8 November 2026  
**Status:** Canonical Code Review Checklist  
**Task ID:** VO-006  
**Primary Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§15, §16, §17, §18)  
**Related Documents:** `docs/ENGINEERING_STANDARDS.md`, `docs/QUALITY_GATES.md`, `docs/THREAT_MODEL.md`

---

## 1. Code Review Protocol

Every Pull Request (PR) must be reviewed by at least one human peer or technical lead before merging into `main`. Reviewers must systematically evaluate the code against this checklist.

> [!IMPORTANT]
> **REJECTION CRITERIA:**  
> A PR must be rejected immediately if it compromises tenant isolation, introduces unvalidated server inputs, leaks secrets or PII, breaks 390px mobile responsiveness, or claims unrun tests passed.

---

## 2. Review Checklist by Domain

### 2.1 Multi-Tenancy and Data Isolation
- [ ] **Tenant Partitioning:** Every query, insert, and update on business-scoped data explicitly filters by `business_id`.
- [ ] **PostgreSQL RLS Safety:** Mutations execute within a transaction utilizing transaction-scoped `SET LOCAL app.current_business_id` to prevent connection pool leakage.
- [ ] **Cross-Tenant Prevention:** An automated isolation test (`ST-TENANT-01`) exists verifying that Tenant B cannot read or alter Tenant A's records.
- [ ] **Sovereign Data Survival:** Business assets (orders, bills, catalogue, sites) are owned by `Business`, not permanently locked into `Workspace`.

### 2.2 Security and Authentication
- [ ] **Zero Passwords in Domain:** The domain model stores zero passwords or salt hashes. Authentication is delegated to `UserAuthIdentity`.
- [ ] **Staff Counter PINs:** Counter terminal PINs (`pin_hash`) are salted Argon2id hashes, scoped strictly to POS terminal station switching.
- [ ] **Role Authorization:** Server checks enforce RBAC (`OWNER`, `MANAGER`, `STAFF`, `RESELLER_ADMIN`). Staff cannot access financial margins or export data.
- [ ] **Webhook Signatures:** Provider webhooks (Razorpay, Cashfree, Meta WhatsApp) verify cryptographic HMAC signatures before reading/writing database records.
- [ ] **Replay Protection:** Webhook events verify idempotency using unique `event_id` records.
- [ ] **Untrusted External Content:** Customer WhatsApp messages, reviews, and uploads are treated as untrusted data; zero prompt injection exposure.

### 2.3 Data Integrity and Transactions
- [ ] **Atomic Financial Operations:** Bill generation, order placement, and inventory deductions execute inside explicit ACID database transactions.
- [ ] **Gap-Free Invoice Numbering:** Tax invoices allocate sequential numbers via atomic `UPDATE invoice_sequences ... RETURNING` with row-level locks.
- [ ] **Non-Polymorphic Integrity:** Financial records (`PaymentRecord`) enforce explicit foreign keys protected by check constraints (`chk_payment_owner`).
- [ ] **Monetary Precision:** All financial values use 64-bit integer minor units (`amount_minor BIGINT`) and ISO 4217 currency codes (`currency_code`). Zero floating-point decimals.

### 2.4 Server Validation and Schemas
- [ ] **Shared Zod Schemas:** All request payloads, Server Actions, and API route handlers parse inputs through Zod schemas on the server.
- [ ] **Type Narrowing:** Zero use of `any`. Types are strictly inferred from Zod schemas or declared explicitly.
- [ ] **Payload Sanitization:** Dangerous HTML or script strings are escaped/sanitized; zero arbitrary code execution.

### 2.5 Error Handling and API Responses
- [ ] **Standard Response Envelope:** Responses follow `{ success: true, data, meta }` or `{ success: false, error: { code, message, details }, meta }`.
- [ ] **User-Safe Errors:** Messages displayed to end-users or WhatsApp chats are friendly, understandable, and non-technical.
- [ ] **Zero Stack Trace Leaks:** Raw database errors, SQL syntax, or internal file paths are never returned to client browsers.

### 2.6 Mobile-First Responsive UI (390px Essential Workflow)
- [ ] **390px Viewport Verification:** All UI workflows are tested and confirmed functional on a **390px mobile screen width** (standard mobile target).
- [ ] **Zero Horizontal Scroll:** Pages fit comfortably within the viewport without horizontal layout breakage.
- [ ] **Touch Target Size:** Interactive buttons, inputs, and tabs have a minimum touch target size of **44px $\times$ 44px**.
- [ ] **Five UI States Handled:** Components explicitly handle Loading (skeletons), Empty, Error, Success, and Permission Denied states.

### 2.7 Accessibility (WCAG 2.2 AA)
- [ ] **Visible Focus Rings:** Keyboard navigation shows clear, high-contrast focus rings (`ring-2 ring-primary`). Focus is never hidden.
- [ ] **Contrast Ratio:** Text meets minimum $4.5:1$ contrast against background ($3:1$ for large text).
- [ ] **Accessible Form Labels:** Every input has an associated `<label>` or `aria-label`.
- [ ] **Zero Critical Axe Violations:** Automated `axe-core` scan reports 0 critical or serious violations.

### 2.8 Performance and Optimization
- [ ] **Server Components by Default:** Page routes are React Server Components; `'use client'` is pushed to the leaf components.
- [ ] **Indexed Queries:** High-volume queries utilize composite indexes on `(business_id, created_at DESC)`.
- [ ] **Zero N+1 Queries:** Database fetches batch related child items or use joins instead of querying inside loops.

### 2.9 Structured Logging and PII Sanitization
- [ ] **Machine-Readable JSON:** Logs are structured JSON containing timestamp, level, `requestId`, and `businessId`.
- [ ] **PII Redacted:** Customer phone numbers (`+91 ******1234`), emails, and credentials are automatically masked before logging.
- [ ] **Zero Leaked Secrets:** No API keys, passwords, or tokens in logs.

### 2.10 Tests and Verification Evidence
- [ ] **Test Coverage:** Unit and integration tests cover happy path, boundary conditions, and error/unauthorized failure states.
- [ ] **No Skipped Tests:** All tests run and pass cleanly. No test is disabled or weakened.
- [ ] **Terminal Evidence Provided:** Actual test command outputs and results are included in the PR report.

### 2.11 Documentation and Backlog Governance
- [ ] **Single Task Scope:** PR addresses exactly one backlog task ID.
- [ ] **Docs Updated:** `docs/PROGRESS.md`, `docs/CHANGELOG.md`, and task status in `docs/TASK_BACKLOG.md` are updated.
- [ ] **Unresolved Decisions Recorded:** Any open architecture, legal, or pricing questions are logged in `docs/DECISION_REGISTER.md`.

---

## 3. Pull Request Submission Template

```markdown
### Task ID: VO-XXX — Task Title

#### 1. Summary of Changes
- Concise summary of implementation changes...

#### 2. Architecture & Invariants Verified
- [ ] Multi-tenant isolation verified (RLS test passing)
- [ ] Server-side Zod input validation enforced
- [ ] 390px mobile viewport tested and responsive
- [ ] WCAG 2.2 AA accessibility verified (zero axe errors)
- [ ] Zero secrets in code, logs, or git diff

#### 3. Commands and Tests Executed
```bash
pnpm lint
pnpm typecheck
pnpm test
```
*Output: All 14 tests passed (0 failures, 0 skipped).*

#### 4. Documentation Updated
- `docs/TASK_BACKLOG.md` (Marked DONE)
- `docs/PROGRESS.md`
- `docs/CHANGELOG.md`

#### 5. Next Task ID: VO-YYY
```
