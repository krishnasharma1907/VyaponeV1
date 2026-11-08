# ADR-023: Observability, Telemetry, Request Tracing and Health Dashboards

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-12, FR-13, NFR-REL-01, COMP-02  
**Affected Tasks:** `VO-003`, `VO-017`, `VO-121`, `VO-123`, `VO-138`  

---

## 1. Context and Problem Statement
Operating a multi-tenant business operating platform across thousands of storefronts requires real-time observability into:
1. API latencies, HTTP error rates, and database connection pool saturation.
2. WhatsApp delivery webhooks, failure rates, and template delivery latencies.
3. Payment gateway webhook processing delays and idempotency status.
4. AI model streaming latencies (p95 < 2s target), token consumption, and automatic failover events.
5. Statutory incident reporting readiness under CERT-In (6-hour window).

We must establish the logging, tracing, error tracking, and health metrics architecture without logging sensitive customer PII or API secrets.

---

## 2. Options Considered

### Option 1: OpenTelemetry Standards + Structured JSON Logging + In-App Health Dashboard (Recommended)
- **Structured Logging:** Centralized logging utility (`pino` / `@logtape/logtape`) outputting structured JSON with standardized fields:
  `{ timestamp, level, requestId, tenantId, userId, action, durationMs, error }`.
- **Sensitive Data Masking:** Automated scrubbers redact passwords, tokens, Aadhaar/PAN, and full customer phone numbers from all log outputs.
- **Request Tracing:** Each incoming HTTP request receives an `x-request-id` generated at the edge, passed through database queries and downstream queue jobs.
- **Error Tracking:** Sentry (or OpenTelemetry compatible collector) for real-time exception tracking and stack traces.
- **Integration Health Dashboard (`VO-123`):** Internal platform dashboard displaying real-time connectivity states for WhatsApp BSP, Payment Gateways, and AI Model providers.

### Option 2: CloudWatch / Datadog Enterprise Agent
- **Analysis:** Heavy enterprise agent; high monthly cost; complex local developer setup.

---

## 3. Comparison of Options

| Criterion | Option 1: OpenTelemetry + Pino + Sentry | Option 2: Datadog / CloudWatch |
|---|---|---|
| **PII Scrubbing Control** | **100% Control:** In-application interceptors guarantee zero PII reaches remote servers. | Complex configuration; easy to accidentally leak raw request bodies. |
| **Developer Ergonomics** | **Lightweight:** Readable local JSON logs; zero binary background daemon required. | Requires local agents and heavy config. |
| **Edge & Serverless Support** | **Native:** Works seamlessly inside Next.js edge runtime and serverless functions. | Difficult to run Datadog agents in serverless edge environments. |

---

## 4. Architectural Implications

- **Audit Separation:** Diagnostic logs (ephemeral, retained 30 days) are strictly separated from financial and administrative audit logs (`audit_logs` table, permanent statutory retention).
- **Weekly Operating Sites (WOS) Telemetry (`VO-121`):** A dedicated background pipeline calculates the primary North-Star metric: businesses with ≥1 real order, appointment, bill, or payment in the trailing 7 days.

---

## 5. Recommendation and Rationale
**Adopt Option 1: OpenTelemetry conventions with structured JSON logging and Sentry error tracking.**
- Matches PRD FINAL §15.1 and PRD v3 §21 requirements for observability and incident response.
- Guarantees zero PII leakage under DPDP Act 2023.

---

## 6. Dependencies & Status
- **Dependencies:** Task `VO-017` (Structured logging), Task `VO-123` (Health dashboard).
- **Status:** `PROPOSED` by Technical Lead.
