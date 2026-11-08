# ADR-013: Grace Period, Plan Downgrade and Data Retention Lifecycle

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Legal Counsel, Technical Lead  
**Related PRD Requirements:** FR-02, FR-10, AC-16  
**Affected Tasks:** `VO-003`, `VO-026`, `VO-087`, `VO-124`  

---

## 1. Context and Problem Statement
When a reseller’s subscription lapses, fails payment, or downgrades to a lower tier, live local business websites and their operations are affected. 

**Non-Negotiable Product Rule (PRD FINAL §9.3, §25, `BUILD_PLAN.md` §5):**
> *The platform must NEVER silently delete live business data, customer records, bills, or published websites upon plan expiration or downgrade.*

We must define the technical lifecycle, status transitions, and data retention rules for expired and downgraded accounts.

---

## 2. Options Considered

### Option 1: 15-Day Grace Period + Read-Only Downgrade Mode (Recommended)
- **Day 0 (Payment Failure):** Status moves to `PAST_DUE`. Three automated WhatsApp and email reminders are sent (Day 1, 3, 7). All websites and dashboards remain 100% active.
- **Day 15 (Grace Period Expiry):** Status moves to `SUSPENDED_GRACE`.
  - Websites display a tasteful, non-embarrassing temporary holding message or remain online in read-only mode (depending on owner policy).
  - Business owners can still view past bills, orders, and customer lists.
  - New edits, broadcasts, and AI requests are locked.
- **Downgrade Policy:** If a reseller with 10 live sites downgrades to Starter (3 sites limit), the reseller chooses which 3 sites remain live; the remaining 7 sites transition to `ARCHIVED` status (data preserved indefinitely, website un-published).
- **Permanent Data Deletion:** Occurs only upon explicit verified Data Principal erasure request (`VO-124`) under DPDP compliance rules or after 365 days of total dormancy following advance written notice.

### Option 2: Immediate Site Shutdown on Day 1
- **Architecture:** Websites are taken down immediately on payment failure. (Rejected: Destroys trust with local merchants and harms reseller reputation).

---

## 3. Comparison of Options

| Criterion | Option 1: 15-Day Grace + Read-Only Archive | Option 2: Immediate Shutdown |
|---|---|---|
| **Reseller & Client Trust** | **Highest:** Gives resellers time to resolve card/bank issues without client embarrassment. | **Extremely Low:** Client sees their site down on day 1; reseller loses the client permanently. |
| **Data Safety & Compliance** | **100% Protected:** Zero accidental data loss; full audit trail of status changes. | High churn risk; potential dispute over lost business records. |
| **Storage & Cost Overhead** | Low: Text, orders, and bills occupy minimal storage; media can remain in cold storage. | Slightly lower storage, but high business cost. |

---

## 4. Architectural Implications

- **Status State Machine (`business_status`):**
  `DRAFT` → `LIVE` → `PAST_DUE` → `SUSPENDED_GRACE` → `ARCHIVED`.
- **Scheduled Status Evaluator (`VO-087`):** Daily background worker checks billing subscriptions, transitions statuses, and dispatches grace notifications.
- **Data Export Guarantee (`VO-124`):** Even in `ARCHIVED` or `SUSPENDED_GRACE` states, business owners and resellers can download a full CSV/JSON export of all customer records, GST bills, and product catalogs.

---

## 5. Recommendation and Rationale
**Adopt Option 1: 15-day active grace period followed by read-only archival with guaranteed data retention.**
- Preserves the reputations of resellers with their local merchant clients.
- Prevents catastrophic accidental data loss while giving clear commercial incentives to renew.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Subscription service (`VO-087`), Export pipeline (`VO-124`).
- **Approval Requirement:** **Product Owner & Legal Counsel sign-off on Terms of Service and grace policy.** Marked `NEEDS APPROVAL`.
