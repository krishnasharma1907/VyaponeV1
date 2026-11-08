# ADR-006: Background Queue, Caching and Event-Driven Automations

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-15, FR-18, FR-19, MOD-17, AC-17, AC-22  
**Affected Tasks:** `VO-003`, `VO-093`, `VO-097`, `VO-098`, `VO-102`  

---

## 1. Context and Problem Statement
VyapOne relies on asynchronous event-driven background processing for:
1. **WhatsApp Messaging & Broadcasts:** Rate-limited delivery, quiet-hours delays (9 PM–9 AM), webhook delivery retries, and template dispatch.
2. **Business Automation Engine:** Trigger → Condition → Action workflows (payment reminders, booking alerts, abandoned cart nudges, review requests).
3. **Scheduled Cron Jobs:** Daily morning business briefings, low-stock alerts, and evening sales summaries dispatched in each business's local timezone.
4. **Caching & Rate Limiting:** Tenant hostname resolution caching, API rate-limiting tokens, and AI token budget counters.

We require a reliable, distributed queue and caching layer with idempotency, dead-letter queue (DLQ) support, and delayed task scheduling.

---

## 2. Options Considered

### Option 1: Redis + BullMQ (Recommended Candidate in PRD FINAL §15.1, §15.8)
- **Architecture:** Managed Redis instance (Upstash Serverless Redis or Redis Cloud in AWS Mumbai). Background workers run using BullMQ (Node.js).
- **Features:** First-class support for delayed jobs, exponential backoff retries, parent-child job workflows, rate-limiting, and dead-letter queues.
- **Caching:** Redis acts simultaneously as the key-value cache and distributed lock store (`redlock`) for idempotency.

### Option 2: AWS SQS + SNS + EventBridge + DynamoDB
- **Architecture:** Managed AWS messaging infrastructure. SQS for queues, SNS for fanout, EventBridge Scheduler for crons.
- **Caching:** AWS ElastiCache Redis or DynamoDB.

### Option 3: PostgreSQL-Based Job Queue (pg-boss / Graphile Worker)
- **Architecture:** Jobs stored directly in dedicated PostgreSQL tables using `SKIP LOCKED` row locking.

---

## 3. Comparison of Options

| Criterion | Option 1: Redis + BullMQ | Option 2: AWS SQS + EventBridge | Option 3: PostgreSQL (pg-boss) |
|---|---|---|---|
| **Delayed & Scheduled Jobs (Quiet Hours)** | **Native:** Millisecond-accurate delays; jobs sleep in Redis sorted sets without polling. | **Complex:** SQS delay max 15 mins; requires EventBridge Scheduler integration. | **Good:** Scheduled timestamps in DB table. |
| **Throughput & Latency** | **Sub-millisecond:** In-memory queue handles thousands of events/sec effortlessly. | **High throughput;** polling adds 20–50ms latency. | **Moderate:** High queue churn degrades PostgreSQL autovacuum performance. |
| **Unified Cache + Queue + Locks** | **Yes:** Single Redis cluster serves as cache, rate-limiter, and BullMQ store. | **No:** Requires separate SQS, DynamoDB, and ElastiCache instances. | **No:** PostgreSQL cache is less efficient for ephemeral rate-limiting. |
| **Developer Ergonomics** | **High:** Pure TypeScript API, local Docker Redis for development, inspectable UI. | **Moderate:** AWS SDK complexity; local development requires LocalStack. | **High:** Uses existing PostgreSQL connection. |

---

## 4. Architectural Implications

- **Idempotency & Replay Protection:** Every job payload contains an idempotency key (e.g. `order:update:{order_id}:{status}` or `reminder:{bill_id}:{step}`). BullMQ enforces uniqueness (`jobId = idempotencyKey`), preventing duplicate WhatsApp sends or double charges.
- **Quiet Hours Enforcement:** If an automation fires after 9 PM, the worker calculates delay until 9:00 AM the following morning and reschedules the job with `delay: msUntilMorning`.
- **Fault Tolerance:** Failed jobs retry up to 5 times with exponential backoff before routing to a Dead Letter Queue (`failed-notifications-dlq`), generating an alert in the observability dashboard (`VO-123`).

---

## 5. Vendor Lock-in & Portability
Redis and BullMQ are open-source industry standards. Upstash provides pay-per-request serverless Redis; if workloads expand, the queue can be pointed to self-hosted Redis, AWS ElastiCache, or Redis Cloud with zero code changes.

---

## 6. Recommendation and Rationale
**Adopt Option 1: Redis + BullMQ for event queues, caching, and automation workers.**
- Matches PRD FINAL §15.1 and §15.8.
- Perfect architectural fit for delayed messaging, quiet hours, and timezone-aware cron summaries.
- Single infrastructure service satisfies queue, cache, and distributed lock requirements.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** Redis instance (Upstash or Redis Cloud in India region), Node.js worker runtime.
- **Reversal Strategy:** All event publishing goes through an `IEventBus` interface. If SQS or pg-boss is selected later, only the queue adapter is swapped.
- **Approval Requirement:** Technical Lead. Marked `PROPOSED`.
