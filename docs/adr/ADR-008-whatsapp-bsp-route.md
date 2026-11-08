# ADR-008: WhatsApp Business Platform Route and BSP Selection

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Technical Lead  
**Related PRD Requirements:** FR-15, MOD-13, PRIV-03, AC-17  
**Affected Tasks:** `VO-003`, `VO-090`, `VO-091`, `VO-092`, `VO-094`, `VO-099`  

---

## 1. Context and Problem Statement
WhatsApp is the primary conversational and operational operating system for small businesses in India. PRD FINAL §8.13 specifies a two-level WhatsApp model:
- **Level 1 (Zero Setup):** Static `wa.me` share links, prefilled text, and direct customer-to-business chats without API keys.
- **Level 2 (WhatsApp Business Platform / Cloud API):** Official WhatsApp Business Account (WABA), automated order status notifications, booking confirmations, PDF bills with UPI pay links, shared staff inbox, and marketing broadcasts.

We must decide the technical integration route for Level 2: integrate directly with Meta's WhatsApp Cloud API (as a Tech Provider), or route through an accredited Indian Business Solution Provider (BSP) such as Gupshup, Karix, or MSG91.

---

## 2. Options Considered

### Option 1: Official Indian Business Solution Provider (BSP) Partner (Recommended in PRD FINAL §8.13)
- **Candidates:** Gupshup, Karix, MSG91, or WATI.
- **Onboarding:** Resellers and business owners connect their numbers via Meta Embedded Signup hosted by the BSP.
- **Features:** BSP handles Meta billing, phone number migration, template submission workflows, and Indian rupee (INR) wallet billing.
- **Level 1 Fallback:** If Level 2 is unconfigured or BSP balance is empty, UI falls back seamlessly to Level 1 `wa.me` links.

### Option 2: Direct Meta WhatsApp Cloud API as a Meta Tech Provider
- **Onboarding:** VyapOne registers as a Meta Tech Provider; businesses onboard via Embedded Signup directly to Meta.
- **Billing:** Billed directly by Meta in USD or via credit card; VyapOne must handle direct webhook signature verification and template API submissions.

---

## 3. Comparison of Options

| Criterion | Option 1: Indian BSP Partner | Option 2: Direct Meta Cloud API |
|---|---|---|
| **INR Billing & Local Taxes** | **Turnkey:** BSP provides INR wallet recharges, GST invoicing for message fees, and domestic payment options. | **Complex:** Meta bills in USD or requires international credit cards with FX markup; complex GST reverse-charge compliance. |
| **Number Onboarding & DLT Sync** | **Streamlined:** Indian BSPs have direct relationships with Meta support and Indian telecom operators for DLT OTP synchronization. | **Difficult:** Self-serve Meta support for failed onboarding or blocked numbers is notoriously slow. |
| **Per-Message Margins & Cost** | Slightly higher per-message markup (~5–10% BSP fee on top of Meta utility/marketing rates). | Pure Meta conversation rates, but requires high engineering maintenance. |
| **Template Approval Turnaround** | Fast local approval pipelines through BSP partner portals. | Direct submission to Meta automated review. |

---

## 4. Architectural Implications

- **Provider Abstraction (`IMessagingProvider`):** All messaging logic must reside behind an abstraction interface (`sendTemplate()`, `sendSessionMessage()`, `registerWebhook()`). Neither the application nor the database can depend directly on a specific BSP SDK.
- **Webhook Signature Verification:** Webhook endpoints must verify HMAC SHA256 signatures (`x-hub-signature-256`) using provider-specific webhook secrets before processing inbound customer replies or status receipts (`sent`, `delivered`, `read`).
- **Regulatory Guardrails:** Strict compliance with Meta messaging policies: pre-approved templates outside 24-hour window, immediate STOP opt-out enforcement, quiet hours suppression (9 PM–9 AM), and recipient count/cost previews before sending broadcasts.

---

## 5. Vendor Lock-in & Portability
By isolating provider-specific code inside an adapter (`GupshupAdapter`, `Msg91Adapter`, `DirectMetaAdapter`), VyapOne avoids lock-in and can switch BSPs or transition to direct Meta Cloud API when message volume justifies it.

---

## 6. Recommendation and Rationale
**Adopt Option 1 (Official Indian BSP Partner via an abstract adapter interface).**
- Essential for domestic INR message wallet recharges, Indian GST invoices on messaging costs, and local phone number verification.
- Gupshup, MSG91, and Karix are proven India-scale providers with native Meta Embedded Signup.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** Partner agreement with chosen BSP, Meta Business Manager verification (`VO-091`, `ADR-018`).
- **Reversal Strategy:** All templates, consent records, and messages are stored in VyapOne's PostgreSQL database. Switching BSPs requires only pointing webhooks and updating the adapter credentials.
- **Approval Requirement:** **Product Owner & BSP Commercial Sign-off Required.** Marked `NEEDS APPROVAL`.
