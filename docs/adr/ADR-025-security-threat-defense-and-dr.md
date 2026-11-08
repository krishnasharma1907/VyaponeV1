# ADR-025: Security Threat Defense, Incident Response and Disaster Recovery

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead, Security Reviewer  
**Related PRD Requirements:** SEC-01 to SEC-06, NFR-REL-03, COMP-02, AC-15  
**Affected Tasks:** `VO-003`, `VO-004`, `VO-131`, `VO-134`  

---

## 1. Context and Problem Statement
VyapOne is a mission-critical financial, operational, and messaging platform. A security breach, cross-tenant data leak, webhook replay exploit, prompt injection bypass, or prolonged database outage would permanently destroy commercial trust.

PRD FINAL §17 and PRD v3 §20–§21 mandate:
1. Threat modeling and STRIDE defense across all tenant boundaries.
2. Mandatory compliance with CERT-In 6-hour cybersecurity incident reporting.
3. Disaster Recovery (DR) and automated backup architecture meeting strict RPO (<1 hour) and RTO (<4 hours) targets.

We must define the platform security controls, incident response runbooks, and disaster recovery strategy.

---

## 2. Technical Architecture and Defense In Depth

### 2.1 Threat Modeling & Boundary Controls (`VO-004`, `VO-131`)
- **Tenant Boundary:** Enforced via dual-layer checks: Next.js API route middleware + PostgreSQL Row-Level Security (RLS).
- **Injection Defenses:**
  - SQL: 100% parameterized queries via Drizzle ORM; raw SQL concatenation strictly banned in lint rules.
  - XSS: Next.js automatic React escaping; Puck editor component validation; raw HTML injection disallowed.
  - Prompt Injection: Customer messages treated strictly as untrusted data strings; tool execution requires valid schema match; write operations gated by `PendingAction` confirmation tokens.
- **CSRF & Webhook Replay:**
  - SameSite `Lax`/`Strict` cookies + double-submit CSRF tokens for web mutations.
  - Webhooks verify cryptographic signatures (HMAC SHA256) and record message timestamps within a 5-minute tolerance window; duplicate IDs return cached HTTP 200 without re-execution.

### 2.2 Disaster Recovery & Automated Backups (`VO-134`)
- **Automated Hourly Snapshots:** PostgreSQL database performs automated hourly transaction log snapshots and continuous WAL archiving (Point-In-Time Recovery).
- **Target RPO (Recovery Point Objective):** Less than **1 hour** of data loss in a catastrophic failure.
- **Target RTO (Recovery Time Objective):** Platform restored and functional within **4 hours**.
- **Cold Standby Region:** Off-site automated daily database backups replicated to a secondary cloud region (e.g. AWS Hyderabad `ap-south-2` or GCP Delhi) to survive an entire data center failure in Mumbai.
- **Bi-Annual Recovery Drill:** Documented runbook verified in staging by restoring from a snapshot and asserting database consistency.

### 2.3 CERT-In Compliance & Incident Response
- In accordance with the Indian Computer Emergency Response Team (CERT-In) cybersecurity directions, security incidents (unauthorized access, data leak, DDoS outage) must be reported within **6 hours** of detection.
- Automated security alerts dispatch directly to the on-call engineering lead via PagerDuty/SMS upon anomalous database query spikes or authentication brute-force attacks.

---

## 3. Comparison of Approaches

| Criterion | VyapOne Automated Defense & Multi-Region DR | Basic Ad-Hoc Backups |
|---|---|---|
| **RPO & RTO Guarantee** | **Sub-1hr RPO, Sub-4hr RTO:** Continuously validated via automated scripts. | High risk: Days of data loss; manual restoration failure. |
| **CERT-In Readiness** | **Compliant:** Standardized incident severity matrix and notification runbooks. | Non-compliant: Risks regulatory penalties and operational suspension. |
| **Tenant Isolation Assurance** | Dual-layer (Server + DB RLS) verified by automated negative security tests in CI. | Single-layer; easily bypassed by developer oversight. |

---

## 4. Recommendation and Rationale
**Adopt Option 1: Dual-layer defense-in-depth security, automated point-in-time database snapshots with cross-region replication, and formalized CERT-In incident runbooks.**
- Fulfills PRD FINAL §17, PRD v3 §20, and AC-15.
- Guarantees platform resilience against security exploits and hardware failures.

---

## 5. Dependencies & Status
- **Dependencies:** Task `VO-004` (Threat model), `VO-131` (Security assessment), `VO-134` (DR runbook).
- **Status:** `PROPOSED` by Technical Lead.
