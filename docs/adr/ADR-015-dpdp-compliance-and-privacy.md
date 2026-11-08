# ADR-015: DPDP Act 2023 Compliance, Privacy and Grievance Redressal

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL` (**BLOCKING FOR GA**)  
**Deciders:** Product Owner, Legal Counsel (Data Protection Officer), Technical Lead  
**Related PRD Requirements:** FR-13, FR-17, PRIV-01, PRIV-02, PRIV-03, AC-16  
**Affected Tasks:** `VO-003`, `VO-024`, `VO-080`, `VO-124`, `VO-137`  

---

## 1. Context and Problem Statement
VyapOne processes personal data of Indian citizens, including:
1. Reseller contact details, banking info, and government KYC identifiers.
2. Business owners' GSTIN, phone numbers, addresses, and sales data.
3. End-customers' names, phone numbers, order histories, delivery addresses, and WhatsApp interaction transcripts.

The platform is legally bound by India's **Digital Personal Data Protection (DPDP) Act, 2023**. We must establish a compliant privacy and consent architecture covering Data Principal rights, consent ledgers, prompt privacy, and statutory grievance redressal.

---

## 2. Technical Architecture for DPDP Compliance

### 2.1 Consent Ledger Architecture (`VO-080`)
- **Explicit Consent Logging:** Every customer phone number captured across websites, WhatsApp chats, orders, or forms must record an immutable consent row:
  - `consent_id`: UUID
  - `customer_id`: UUID
  - `purpose`: `TRANSACTIONAL` (order updates, bills) vs `MARKETING` (promotions, broadcasts)
  - `channel`: `WHATSAPP`, `SMS`, `EMAIL`
  - `status`: `GRANTED`, `WITHDRAWN`
  - `timestamp`: UTC ISO timestamp
  - `source_evidence`: IP address, form submission URL, or WhatsApp opt-in message
- **Withdrawal of Consent:** Replying `STOP` to any WhatsApp broadcast immediately updates status to `WITHDRAWN`, blocking all future marketing messages automatically.

### 2.2 Data Principal Rights Engine (`VO-124`)
- **Right to Access & Summary:** Owners and customers can request a complete, machine-readable export (JSON/CSV) of all personal data held.
- **Right to Correction & Erasure:** Verified erasure requests execute soft-deletion followed by hard-deletion of non-statutory records within 30 days.
- **Statutory Retention Exception:** Tax invoices, payments, and financial ledgers are retained pursuant to Section 36 of the CGST Act 2017 (72 months from the due date of furnishing the annual return for the financial year, subject to statutory extension or ongoing proceedings/appeals) and applicable Income Tax rules, even if an erasure request is executed for marketing profiles. The exact unified retention and deletion policy is marked `NEEDS CA/LEGAL REVIEW`. Do not apply an arbitrary eight-year universal rule without CA/legal concurrence.

### 2.3 AI Privacy & PII Scrubbing
- **Zero Model Training Guarantee:** LLM vendor contracts (Anthropic, Google) must explicitly state that API payloads are not used to train foundation models.
- **Pre-Flight Redaction:** Customer phone numbers, Aadhaar/PAN, and full names are masked (`[REDACTED_PHONE]`) before being included in general LLM context prompts where not strictly required for the tool output.

### 2.4 Grievance Redressal Mechanism
- Mandatory publication of the Data Protection Officer / Grievance Redressal Officer's name, email, and physical office address in the application footer and privacy policy.
- Automated ticketing queue ensuring grievance complaints are acknowledged within 24 hours and resolved within statutory timelines (typically 30 days).

---

## 3. Comparison of Approaches

| Criterion | VyapOne In-House Consent & DPDP Engine | Third-Party Consent SaaS (OneTrust / Cookiebot) |
|---|---|---|
| **WhatsApp-Native Opt-Out** | **Direct:** Integrated directly into BullMQ queue and WhatsApp webhook parser. | **Fragmented:** External tools focus on web cookie banners, not WhatsApp chats. |
| **Data Locality (India Hosting)** | **Compliant:** Hosted in AWS/GCP Mumbai region. | Data often processed in EU/US servers. |
| **Operational Overhead** | Engineered directly into our PostgreSQL database. | High recurring enterprise SaaS subscription cost. |

---

## 4. Formal Legal Counsel Sign-Off Boundary
The technical capabilities (consent ledger, export API, erasure workers, masking) will be developed in Phase P8 and P12, but **PUBLIC GA LAUNCH IS STRICTLY BLOCKED** until licensed Indian Legal Counsel reviews and approves:
1. The Privacy Policy and Terms of Service.
2. The Reseller Data Processing Agreement (DPA).
3. The legal classification of VyapOne as a Data Fiduciary vs Data Processor.
4. Mandatory retention schedules balancing DPDP erasure rights against GST financial retention obligations.

---

## 5. Recommendation and Rationale
**Adopt an in-house database-backed Consent Ledger and Data Principal Rights Engine, supported by formal legal review.**
- Ensures 100% adherence to DPDP Act 2023.
- Embeds consent checks directly into the transactional messaging pipeline.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Customer CRM & Consent Ledger (`VO-080`), Privacy & Export Engine (`VO-124`), Legal Counsel engagement.
- **Approval Requirement:** **MANDATORY LEGAL COUNSEL SIGN-OFF BEFORE PUBLIC GA RELEASE.** Marked `NEEDS APPROVAL (BLOCKING_FOR_GA)`.
