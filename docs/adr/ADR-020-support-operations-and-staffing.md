# ADR-020: Support Model, Escalation Routing and Staffing Architecture

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Customer Operations Lead, Technical Lead  
**Related PRD Requirements:** FR-13, MOD-01, AC-16  
**Affected Tasks:** `VO-003`, `VO-122`, `VO-137`  

---

## 1. Context and Problem Statement
Local business owners and non-technical resellers require responsive, human customer support when operating daily operations. A purely automated chatbot model is insufficient for billing disputes, failed UPI transactions, or domain routing problems.

PRD FINAL §8.1, §13, and PRD v3 §25 specify:
1. An integrated help center with searchable, self-serve guides in Hindi and English.
2. In-app support ticketing with tenant-isolated context.
3. Human support escalation with audited, least-privilege administrative access (`VO-120`).

We must define the operational tiers, ticketing technology, and support context permissions.

---

## 2. Options Considered

### Option 1: In-App Database-Driven Support Desk + WhatsApp Support Desk (Recommended)
- **Architecture:** Support tickets stored in core PostgreSQL database (`support_tickets`, `ticket_messages`).
- **Support Context:** When a ticket is opened, system attaches tenant context (plan type, active modules, recent failed webhooks, last 3 error logs).
- **Security Control:** Support agents authenticate via the Platform Admin console (`VO-120`) using temporary, audited view sessions (`assume_tenant_view`). Agents **never** see customer banking PINs, payment secrets, or unmasked personal identifiers.
- **Escalation:** Escalates to dedicated human support agents during standard Indian business hours (9:00 AM – 8:00 PM IST) with a WhatsApp support desk option.

### Option 2: Heavy Third-Party Support SaaS (Zendesk / Intercom / Freshdesk)
- **Architecture:** Embed Zendesk or Intercom widget inside the dashboard.
- **Analysis:** High per-agent seat cost ($50–$100/mo); complex tenant data synchronization; privacy risks under DPDP Act 2023.

---

## 3. Comparison of Options

| Criterion | Option 1: In-App Support Desk | Option 2: Third-Party SaaS (Zendesk) |
|---|---|---|
| **Tenant Context Awareness** | **Native:** Instant access to system health, order ID, and bill state without asking the user. | Requires complex custom app integration and iframe embedding. |
| **Data Privacy & DPDP Compliance** | **High:** Ticket transcripts stay in our Mumbai database under strict access control. | Third-party cloud storage; international data transfers. |
| **Mobile 390px Usability** | **Native:** Lightweight chat UI designed specifically for 390px phone screens. | Poor: Heavy third-party chat widgets obscure primary mobile navigation buttons. |
| **Cost** | Negligible engineering infrastructure cost. | Expensive recurring seat licenses. |

---

## 4. Architectural Implications

- **Least-Privilege Support Access:** In accordance with SEC-01 and FR-13, support staff have read-only diagnostic access to merchant accounts. Any write action (e.g. issuing a subscription credit or manually updating a DNS record) requires explicit two-factor confirmation and a recorded audit reason (`VO-120`).
- **SLA Tiers:** Priority routing for paying Agency and Growth resellers; critical billing/payment tickets auto-flagged for sub-1-hour first response.

---

## 5. Recommendation and Rationale
**Adopt Option 1: In-App Database-Backed Support Desk with dedicated human escalation queues.**
- Keeps data strictly within our sovereign infrastructure.
- Provides seamless mobile-first chat support for busy shop owners.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Platform admin console (`VO-120`), Support ticketing engine (`VO-122`).
- **Approval Requirement:** **Product Owner & Operations Lead sign-off on human staffing model and operating hours.** Marked `NEEDS APPROVAL`.
