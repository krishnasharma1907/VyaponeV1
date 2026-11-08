# ADR-009: Merchant Payment Gateway Adapter Framework

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Technical Lead  
**Related PRD Requirements:** FR-11, FR-23, PAY-01 to PAY-04, AC-12, AC-19  
**Affected Tasks:** `VO-003`, `VO-084`, `VO-085`, `VO-086`  

---

## 1. Context and Problem Statement
VyapOne powers customer transactions (orders, salon bookings, tuition fees, bills) across Indian local businesses. The payment architecture follows a two-tier model:
1. **Zero-Setup UPI QR & Intent:** Immediate go-live using the merchant's plain VPA (`merchant@upi`) with client-side status tracking (`Claimed by customer` → `Received by staff`).
2. **Integrated Merchant Payment Gateway:** Full checkout supporting UPI Intent, credit/debit cards, Net Banking, and payment links with automated server-side verification and webhooks.

We must define a payment gateway abstraction framework and select candidate payment providers (Razorpay, Cashfree, PhonePe PG) for sandbox integration without hardcoding provider-specific logic into the core domain.

---

## 2. Options Considered

### Option 1: Provider-Neutral Gateway Adapter Framework with Razorpay as First Sandbox Candidate (PRD FINAL §10.4, §15.1)
- **Architecture:** Core billing logic interacts exclusively with an `IPaymentGateway` interface (`createPaymentOrder()`, `verifyWebhook()`, `createPaymentLink()`, `initiateRefund()`).
- **First Implementation:** Razorpay Node.js SDK in sandbox mode.
- **Verification:** Payment success is accepted strictly through signed webhook verification (`x-razorpay-signature`) or server-to-server API lookups. Front-end redirect parameters are never trusted.

### Option 2: Cashfree Payments as Primary Candidate
- **Architecture:** Cashfree PG adapter providing similar payment link and intent APIs with competitive domestic MDR fees.

### Option 3: PhonePe Payment Gateway (PhonePe PG)
- **Architecture:** PhonePe PG adapter focusing heavily on mobile UPI Intent flow.

---

## 3. Comparison of Options

| Criterion | Option 1: Razorpay PG | Option 2: Cashfree PG | Option 3: PhonePe PG |
|---|---|---|---|
| **Ecosystem Maturity & Documentation** | **Industry Gold Standard:** Best-in-class developer documentation, battle-tested Node SDK, robust webhook simulator. | **High:** Excellent APIs, fast onboarding, strong marketplace features. | **Moderate:** Growing developer portal, strong UPI brand recognition in India. |
| **Split Settlement & Marketplace Support** | **Razorpay Route:** Mature, compliant split settlement API required for reseller client billing (ADR-010). | **Cashfree Marketplace:** Highly capable vendor split API; competitive fees. | **Limited:** Less mature multi-vendor split settlement capabilities. |
| **Developer Sandbox Experience** | **Instant:** Complete self-serve test mode with simulated webhooks and card payments. | **Good:** Test environment available after basic registration. | **Manual:** Requires manual test credentials from sales team. |

---

## 4. Architectural Implications

- **Strict Payment State Machine:** Order and booking statuses are independent of payment statuses. In accordance with PRD FINAL §10.5 and AC-19:
  - `UNPAID` → Initial state.
  - `CLAIMED` → Customer provided a UPI reference (requires human confirmation or webhook).
  - `RECEIVED` → Staff confirmed receipt in counter mode.
  - `PAID` → Cryptographically verified via gateway webhook or bank settlement.
- **Idempotency & Replay Resistance:** Webhook endpoints store event IDs in an immutable `payment_events` table. Duplicate webhook deliveries return HTTP 200 immediately without double-crediting balances or re-dispatching order alerts.
- **Security (Zero Card Storage):** The platform never touches, transmits, or stores raw cardholder data (PAN, CVV), complying with RBI card tokenization rules.

---

## 5. Vendor Lock-in & Portability
All gateway interactions reside behind `IPaymentGateway`. Business models and database records store generic `payment_records` referencing `provider_name` and `provider_payment_id`. Adding Cashfree or PhonePe requires only writing an additional adapter implementing the interface.

---

## 6. Recommendation and Rationale
**Adopt Option 1: Implement an `IPaymentGateway` adapter framework, with Razorpay as the initial sandbox implementation candidate.**
- Matches PRD FINAL §10.4 and §15.1 recommendations.
- Razorpay offers the most reliable sandbox tooling, comprehensive webhooks, and the proven "Razorpay Route" product required for reseller split settlements (ADR-010).

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** Sandbox merchant credentials, server secret management (`VO-016`, `VO-084`).
- **Reversal Strategy:** The gateway interface ensures that swapping Razorpay for Cashfree or PhonePe requires zero schema changes and zero frontend refactoring.
- **Approval Requirement:** **Product Owner & Merchant Agreement Approval Required.** Marked `NEEDS APPROVAL`.
