# ADR-010: Reseller Client Billing and Split Settlement Architecture

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL` (**BLOCKING FOR LIVE CLIENT BILLING**)  
**Deciders:** Product Owner, Legal Counsel, Finance Lead  
**Related PRD Requirements:** FR-22, RES-04, COMP-01, AC-23  
**Affected Tasks:** `VO-003`, `VO-088`, `VO-110`  

---

## 1. Context and Problem Statement
Reseller retention in VyapOne is anchored on in-app **Client Billing** (PRD FINAL §9.5):
- Resellers set custom setup and monthly maintenance fees for each local business client (e.g. ₹2,000 setup + ₹1,000/mo).
- Clients receive recurring payment links, UPI AutoPay, or invoices inside VyapOne.
- When a client pays, funds must be settled directly to the reseller's bank account, with VyapOne deducting its platform fee (e.g., 2–5%).

**Legal & Regulatory Invariant (PRD FINAL §10.1, Reserve Bank of India PA/PG Guidelines):**
> *VyapOne is a technology platform, NOT a licensed Payment Aggregator (PA). VyapOne must NEVER collect, hold, pool, or escrow merchant or reseller funds in a company bank account.*

We must design an automated, legally compliant split settlement architecture using licensed payment aggregator APIs.

---

## 2. Options Considered

### Option 1: Licensed Payment Aggregator Marketplace Split API (Razorpay Route / Cashfree Split) (Recommended)
- **Mechanism:**
  1. Resellers onboard as linked marketplace sub-merchants (KYC performed by the licensed PA: Razorpay or Cashfree).
  2. Invoices generated inside VyapOne contain payment links tied to the marketplace account.
  3. When a client pays ₹1,000, the licensed PA's engine automatically splits the payment at the source:
     - ₹950 settles directly into the Reseller’s linked bank account (T+2 days).
     - ₹50 settles directly into VyapOne’s corporate account as a technology platform fee.
  4. VyapOne never touches or pools the client money.
- **Offline / Cash Mode:** A free "Collected Offline" mode allows resellers to record cash or external UPI payments manually without gateway fees.

### Option 2: VyapOne Collects & Disburses Manually (Rejected — Illegal)
- **Mechanism:** Client pays into VyapOne's current account; VyapOne reconciles and payouts monthly to resellers via IMPS/NEFT.
- **Verdict:** **Strictly illegal under RBI guidelines** without a full Payment Aggregator license (which requires ₹15 crore net worth and RBI authorization). This option is disqualified.

### Option 3: Pure Invoicing & External Payment Remittance
- **Mechanism:** VyapOne only generates GST invoices; client pays reseller's personal UPI ID directly; reseller manually pays VyapOne platform fees.

---

## 3. Comparison of Options

| Criterion | Option 1: Licensed Marketplace Split API | Option 2: VyapOne Pools & Payouts | Option 3: Pure Manual Invoicing |
|---|---|---|---|
| **RBI PA/PG Legal Compliance** | **100% Compliant:** All escrow and nodal settlement is managed by an RBI-authorized Payment Aggregator. | **Illegal:** Violates RBI circulars on nodal accounts and fund pooling. | **Compliant,** but manual and friction-heavy. |
| **Reseller Retention & Stickiness** | **Highest (The Retention Moat):** Automated recurring collection makes it impossible for resellers to churn. | High, but legally fatal. | **Low:** Resellers collect off-platform and frequently default on platform fees. |
| **Operational & Reconciliation Burden** | **Automated:** Webhooks update the ledger; PA generates 1099/TDS/GST statements. | Extremely heavy; requires manual bank reconciliation. | High manual chasing of platform dues. |
| **Reseller KYC Requirement** | Resellers must complete lightweight digital KYC with the payment aggregator. | Same or heavier. | None. |

---

## 4. Architectural Implications

- **Sandboxed Ledger Implementation:** Development in Phase P8 (`VO-088`) must implement the complete data model (`ClientInvoice`, `ResellerPayout`, `PlatformFeeLedger`, `SplitSettlementTransfer`) using sandbox mock adapters.
- **Live Hard-Gate:** The production switch to trigger real money splits remains hard-blocked until:
  1. An official contract with an approved split-settlement provider (Razorpay Route or Cashfree Marketplace) is signed.
  2. Legal counsel signs off on the Master Reseller Services Agreement and Client Terms of Service.
- **Fallback Cash Ledger:** The system must support the "Collected Offline" toggle so resellers can use the client CRM and billing tracker even before completing payment gateway KYC.

---

## 5. Vendor Lock-in & Portability
The split settlement logic is isolated behind `ISplitSettlementProvider`. Razorpay Route and Cashfree Marketplace use identical nodal account split mechanics, ensuring the integration can be pivoted between providers.

---

## 6. Recommendation and Rationale
**Adopt Option 1: Licensed Payment Aggregator Marketplace Split API (Razorpay Route as primary candidate).**
- Enforces strict regulatory compliance with RBI PA/PG directives.
- Achieves the core commercial promise of VyapOne: automated recurring revenue for resellers.
- Eliminates financial liability and fraud exposure from holding client funds.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** Contract with Razorpay Route or Cashfree Split, Reseller Terms of Service legal sign-off.
- **Reversal Strategy:** If a reseller cannot complete PA KYC, they operate indefinitely on the "Collected Offline" manual mode without platform split automation.
- **Approval Requirement:** **MANDATORY LEGAL & COMMERCIAL APPROVAL BEFORE LIVE ROLLOUT.** Marked `NEEDS APPROVAL (BLOCKING_FOR_LIVE_CLIENT_BILLING)`.
