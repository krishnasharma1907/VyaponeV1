# ADR-014: GST Invoicing Engine, Tax Slabs and e-Invoice Rules

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL` (**BLOCKING FOR LIVE GST**)  
**Deciders:** Product Owner, Chartered Accountant (CA), Technical Lead  
**Related PRD Requirements:** FR-16, MOD-15, PAY-05, PAY-06, PAY-07, AC-18  
**Affected Tasks:** `VO-003`, `VO-081`, `VO-082`  

---

## 1. Context and Problem Statement
VyapOne includes an integrated billing engine (PRD FINAL §8.15) allowing small businesses to generate professional bills and GST tax invoices from counter orders, appointments, or catalog purchases.

**Statutory & Architectural Invariants:**
1. **Server-Owned Tax Computation:** GST rates (CGST, SGST, IGST) must be calculated strictly by deterministic server logic referencing validated tax tables. **AI must NEVER calculate, invent, or estimate statutory taxes.**
2. **Sequential Gap-Free Numbering:** Indian GST law mandates sequential, unique, gap-free invoice numbers per financial year (e.g. `INV/2026-27/0001`).
3. **No Silent Bill Deletion:** Issued invoices cannot be deleted; cancellations must issue a formal credit note.
4. **GST e-Invoicing (IRN):** Businesses exceeding statutory turnover thresholds must generate an Invoice Reference Number (IRN) and signed QR code via an approved GST Suvidha Provider (GSP) or Invoice Registration Portal (IRP).

We must define the technical architecture for the tax calculation engine and establish the sign-off boundary required from a licensed Chartered Accountant.

---

## 2. Options Considered

### Option 1: In-House Deterministic Server Tax Engine + GSP Adapter for e-Invoicing (Recommended)
- **Tax Math:** Server-side engine evaluating Place of Supply (inter-state = IGST, intra-state = CGST + SGST) based on seller and buyer state codes.
- **Tax Tables:** Master database table of approved HSN/SAC codes, descriptions, and tax rates (0%, 5%, 12%, 18%, 28%).
- **Numbering:** Database sequence or transactional counter locking (`SELECT ... FOR UPDATE`) per business and financial year.
- **Bill of Supply:** Automatically generated for unregistered businesses or composition scheme dealers (no tax charged).
- **e-Invoicing:** Abstract adapter interface (`IEInvoiceProvider`) connecting to licensed GSP partners (ClearTax, Masters India, or direct NIC IRP API).

### Option 2: Third-Party Accounting SaaS Integration Only (Zoho / Tally / Vyapar)
- **Architecture:** Offload all billing to external accounting apps via APIs. (Rejected: Adds high friction and extra subscription costs for small merchants).

---

## 3. Comparison of Options

| Criterion | Option 1: In-House Engine + GSP Adapter | Option 2: External Accounting Only |
|---|---|---|
| **Speed at the Counter** | **Instant:** 2-tap bill generation from phone; Bluetooth thermal printer ready. | Slow: Redirects between third-party apps. |
| **Zero-Setup Usability** | **High:** Non-GST shops generate simple bills of supply immediately; GST shops enter GSTIN and go live. | Complex: Requires setting up third-party accounting chart of accounts. |
| **Statutory Precision** | **Exact:** Deterministic server logic adheres to approved Indian GST calculation formulas. | Handled by vendor. |
| **WhatsApp Integration** | **Native:** Instant PDF bill generation with UPI payment QR embedded directly. | Fragmented. |

---

## 4. Architectural Implications

- **Sequential Numbering Locking:**
  ```sql
  BEGIN;
  SELECT next_invoice_number FROM invoice_sequences 
  WHERE business_id = $1 AND financial_year = $2 FOR UPDATE;
  -- Generate invoice with guaranteed gap-free numbering
  UPDATE invoice_sequences SET next_invoice_number = next_invoice_number + 1 WHERE ...;
  COMMIT;
  ```
- **Credit Notes:** Return or cancellation generates a linked `credit_note` referencing the original `invoice_id`. Original invoice status transitions to `CREDITED_CANCELLED` but is preserved permanently.
- **Formats:** PDF invoices rendered server-side; 58mm/80mm thermal receipt formats generated as lightweight ESC/POS commands or optimized text for Bluetooth printers.

---

## 5. Formal Chartered Accountant (CA) Sign-off Boundary
The billing module can be developed and verified in sandbox during Phase P8 (`VO-081`, `VO-082`), but **LIVE GST INVOICING CANNOT BE ACTIVATED IN PRODUCTION** until a licensed Chartered Accountant formally reviews and signs off on:
1. HSN/SAC tax slab mappings.
2. Inter-state (IGST) vs Intra-state (CGST+SGST) tax rounding formulas (rounding to 2 decimal places per line item vs total).
3. Bill of Supply layout compliance for composition merchants.
4. Thresholds for mandatory B2B e-invoicing.

---

## 6. Recommendation and Rationale
**Adopt Option 1: In-House Deterministic Server Tax Engine with a pluggable GSP e-Invoicing adapter.**
- Satisfies the critical speed requirement for local shop counters.
- Provides native PDF and thermal receipts with embedded UPI pay links.
- Maintains strict adherence to Indian GST legislation.

---

## 7. Dependencies & Approval Requirement
- **Dependencies:** Tax tables schema (`VO-081`), Invoice engine (`VO-082`), GSP partner API credentials for e-invoicing add-on.
- **Approval Requirement:** **MANDATORY CHARTERED ACCOUNTANT SIGN-OFF BEFORE LIVE INVOICING.** Marked `NEEDS APPROVAL (BLOCKING_FOR_LIVE_GST)`.
