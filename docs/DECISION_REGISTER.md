# VyapOne Decision Register

Track each unresolved decision here. Do not treat a suggested vendor, price, deadline or legal assumption as approved until its status changes.

| ID | Decision | Current source guidance / candidates | Required owner or evidence | Status | Tasks affected |
|---|---|---|---|---|---|
| ADR-001 | Frontend/backend application stack | FINAL recommends Next.js + TypeScript | Product/technical owner approval | PROVISIONAL | VO-003, VO-010+ |
| ADR-002 | Database | PostgreSQL recommended | Technical owner; region/backup assessment | PENDING | VO-003, VO-020+ |
| ADR-003 | Auth and storage | Supabase is a candidate | Technical owner; RLS/security review | PENDING | VO-003, VO-021+ |
| ADR-004 | Hosting and client-site runtime | Vercel or Cloudflare candidates | Cost, domains, edge cache, India performance | PENDING | VO-003, VO-042, VO-049 |
| ADR-005 | Visual editor | Puck candidate, constrained to approved blocks | Prototype and mobile usability review | PENDING | VO-003, VO-044 |
| ADR-006 | Queue and cache | Redis/BullMQ or managed queue | Hosting and operations decision | PENDING | VO-003, VO-093, VO-097, VO-102 |
| ADR-007 | AI model routing and plan budgets | FINAL describes primary/fallback/small-task routing; budgets still open | Provider availability, price, quality and privacy review | PENDING | VO-050+ |
| ADR-008 | WhatsApp route/BSP | Cloud API via BSP or direct technology-provider route | Approval path, number ownership, pricing and support | PENDING | VO-090+ |
| ADR-009 | Merchant gateway(s) | Razorpay, Cashfree, PhonePe PG candidates | KYC, API, settlement, refunds and legal review | PENDING | VO-084+ |
| ADR-010 | Reseller split settlement | Provider product required; VyapOne must not hold/pool funds | Provider contract and legal sign-off | BLOCKING_FOR_LIVE_CLIENT_BILLING | VO-088 |
| ADR-011 | Subscription prices and plan matrix | Prices in FINAL are hypotheses, not final | Real reseller validation and unit economics | PENDING | VO-026, VO-087, VO-099 |
| ADR-012 | Domain, subdomain and white-label policy | Domain and rules TBD | DNS/brand/trademark review | PENDING | VO-042, VO-049, VO-111 |
| ADR-013 | Grace period, downgrade and expiry | Must not silently delete live data | Product and legal policy | PENDING | VO-026, VO-087 |
| ADR-014 | GST bill/tax/e-invoice rules | Must be verified; CA review required | Chartered accountant and GSP/IRP partner | BLOCKING_FOR_LIVE_GST | VO-081, VO-082 |
| ADR-015 | DPDP, retention and grievance policies | Legal review required. Route `/privacy` is a draft architectural placeholder | Legal counsel / privacy owner | BLOCKING_FOR_GA | VO-014, VO-024, VO-124, VO-137 |
| ADR-016 | Final launch language set and voice | English + Indian languages; PRD language review required | Translation and speech quality review | PENDING | VO-105, VO-106 |
| ADR-017 | Google Business Profile API access | Approval/access required | Google project/app review owner | PENDING_EXTERNAL_APPROVAL | VO-113 |
| ADR-018 | Meta app/business approvals and templates | Required for certain WhatsApp/social capabilities | Meta business verification and template approval | PENDING_EXTERNAL_APPROVAL | VO-091, VO-114 |
| ADR-019 | Delivery partners by city | Candidates in PRD; availability varies | Verified partner API + city coverage | PENDING | VO-115 |
| ADR-020 | Support model and staffing | Human support required; tiered support described in v3 | Business owner and support staffing plan | PENDING | VO-122, VO-137 |
| ADR-021 | Direct DIY plan at GA | Open in FINAL | Product decision | PENDING | VO-022, VO-026, VO-033, VO-137 |
| ADR-022 | Workspace & Git initialization model | Human developer initializes git for starter docs; canonical project workspace scaffolding in VO-010 | Technical Lead | ACCEPTED | VO-010 |
| ADR-023 | Observability, telemetry & health dashboard | OpenTelemetry + structured JSON logging + request IDs + health dashboard | Technical Lead | PROPOSED | VO-017, VO-123 |
| ADR-024 | Testing architecture & golden eval suite | Vitest (unit/component) + Playwright (mobile E2E) + Vya eval suite | Technical Lead | PROPOSED | VO-019, VO-051, VO-130 |
| ADR-025 | Security threat defense & disaster recovery | Dual-layer tenant isolation (RLS) + CERT-In 6hr runbook + hourly snapshots | Technical Lead | PROPOSED | VO-004, VO-131, VO-134 |

## New decision template

- ID:
- Decision question:
- Source PRD section(s):
- Options considered:
- Recommendation and trade-offs:
- Approval owner:
- Status: PENDING / PROVISIONAL / ACCEPTED / REJECTED / BLOCKED
- Tasks affected:
- Date and rationale:
