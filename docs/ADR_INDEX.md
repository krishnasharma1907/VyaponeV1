# VyapOne — Architecture Decision Records (ADR) Index

**Document Version:** 1.0  
**Date:** 8 November 2026  
**Status:** Approved Index  
**Task ID:** VO-003  
**Phase:** P0 — Project audit, decisions and architecture  
**Backlog Reference:** `docs/TASK_BACKLOG.md`  
**Decision Register:** `docs/DECISION_REGISTER.md`  

---

## 1. Overview and ADR Governance

This index catalogs all Architecture Decision Records (ADRs) for the VyapOne platform. ADRs formalize technical choices, vendor candidate evaluations, and trade-offs before implementation.

### Status Taxonomy
- `ACCEPTED`: Decision formally approved by the Technical Lead or Product Owner; active standard for implementation.
- `PROPOSED`: Technical lead recommendation based on PRD requirements and industry standards; awaiting final operational sign-off.
- `NEEDS APPROVAL`: Critical commercial, partner, statutory, or legal decision requiring explicit human Product Owner, Chartered Accountant, or Legal Counsel approval.
- `REJECTED`: Option evaluated and determined unsuitable for VyapOne.
- `SUPERSEDED`: Previous decision replaced by a newer accepted record.

---

## 2. Complete ADR Master Registry

| ADR ID | Title | Category | Status | Primary Candidate / Recommendation | Approval Requirement | Target Backlog Tasks |
|---|---|---|---|---|---|---|
| [ADR-001](file:///f:/VyaponeV2/docs/adr/ADR-001-application-stack.md) | Frontend & Backend Application Stack | Core Stack | `PROPOSED` | Next.js 15+ (App Router) + TypeScript + React 19 + Tailwind CSS | Technical Lead | `VO-010`, `VO-011`, `VO-014` |
| [ADR-002](file:///f:/VyaponeV2/docs/adr/ADR-002-database-and-migrations.md) | Database, Migrations & Multi-Tenancy RLS | Data Architecture | `PROPOSED` | PostgreSQL 16+ with Drizzle ORM migrations & native RLS policies | Technical Lead | `VO-020`, `VO-023`, `VO-024` |
| [ADR-003](file:///f:/VyaponeV2/docs/adr/ADR-003-auth-and-storage.md) | Authentication & Object Storage | Identity & Media | `PROPOSED` | Supabase Auth (or Auth.js + PG) + S3-compatible signed storage | Technical Lead & Security Review | `VO-021`, `VO-032` |
| [ADR-004](file:///f:/VyaponeV2/docs/adr/ADR-004-hosting-and-runtime.md) | Hosting, Edge Runtime & Subdomain Routing | Infrastructure | `PROPOSED` | Vercel (or Cloudflare Workers) with multi-tenant wildcard edge resolution | Technical Lead & Cost Review | `VO-042`, `VO-049` |
| [ADR-005](file:///f:/VyaponeV2/docs/adr/ADR-005-visual-website-editor.md) | Constrained Visual Website Editor | Website Engine | `PROPOSED` | Puck visual editor adapted to validated JSON component blocks | Technical Lead & UX Review | `VO-044`, `VO-045` |
| [ADR-006](file:///f:/VyaponeV2/docs/adr/ADR-006-queue-cache-and-automations.md) | Queue, Cache & Event-Driven Automation | Background Worker | `PROPOSED` | Redis (Upstash / Redis Cloud) + BullMQ event-driven job queue | Technical Lead | `VO-093`, `VO-097`, `VO-102` |
| [ADR-007](file:///f:/VyaponeV2/docs/adr/ADR-007-ai-gateway-and-model-routing.md) | AI Gateway, Multi-Model Routing & Token Budgets | AI Architecture | `PROPOSED` | Vercel AI SDK; Claude Sonnet 5.5 (Main), Gemini Flash (Fallback), Sarvam | Technical Lead & AI Budget Owner | `VO-050` to `VO-058` |
| [ADR-008](file:///f:/VyaponeV2/docs/adr/ADR-008-whatsapp-bsp-route.md) | WhatsApp Business Platform (Cloud API) & BSP Selection | Messaging | `NEEDS APPROVAL` | Meta Cloud API via official BSP (Gupshup / Karix / MSG91) with Level 1 fallback | Product Owner & BSP Commercials | `VO-090` to `VO-094` |
| [ADR-009](file:///f:/VyaponeV2/docs/adr/ADR-009-merchant-payment-gateways.md) | Merchant Payment Gateway Adapter Framework | Payments | `NEEDS APPROVAL` | Modular payment adapter; Razorpay & Cashfree candidates in sandbox | Product Owner & KYC Sign-off | `VO-084`, `VO-085`, `VO-086` |
| [ADR-010](file:///f:/VyaponeV2/docs/adr/ADR-010-reseller-split-settlement.md) | Reseller Client Billing & Split Settlement | Financial Core | `NEEDS APPROVAL` | Provider marketplace split API (Razorpay Route / Cashfree Split); 0 fund pooling | **BLOCKING FOR LIVE BILLING** (Legal & Partner) | `VO-088` |
| [ADR-011](file:///f:/VyaponeV2/docs/adr/ADR-011-subscription-pricing-and-quotas.md) | Subscription Pricing, Quotas & Add-On Metering | Commercial Model | `NEEDS APPROVAL` | Dynamic DB-driven pricing schemas; PRD figures treated as hypotheses | Product Owner & Unit Economics | `VO-026`, `VO-087`, `VO-099` |
| [ADR-012](file:///f:/VyaponeV2/docs/adr/ADR-012-domain-and-ssl-strategy.md) | Domain Strategy, Free Subdomains & Custom SSL | Network & DNS | `NEEDS APPROVAL` | `*.vyapone.in` candidate for subdomains; automated edge SSL via Vercel/Cloudflare | Product Owner (Domain acquisition) | `VO-042`, `VO-049`, `VO-111` |
| [ADR-013](file:///f:/VyaponeV2/docs/adr/ADR-013-grace-period-and-data-lifecycle.md) | Grace Period, Downgrade & Data Retention Lifecycle | Data Governance | `NEEDS APPROVAL` | 15-day grace period; read-only downgrade retention; no silent live data deletion | Product Owner & Legal Review | `VO-026`, `VO-087` |
| [ADR-014](file:///f:/VyaponeV2/docs/adr/ADR-014-gst-rules-and-einvoicing.md) | GST Invoicing Engine, Tax Slabs & e-Invoice Rules | Statutory Billing | `NEEDS APPROVAL` | Deterministic server tax engine, gap-free numbering, GSP/IRP e-invoicing adapter | **BLOCKING FOR LIVE GST** (Chartered Accountant) | `VO-081`, `VO-082` |
| [ADR-015](file:///f:/VyaponeV2/docs/adr/ADR-015-dpdp-compliance-and-privacy.md) | DPDP Act 2023 Compliance & Consent Architecture | Privacy & Compliance | `NEEDS APPROVAL` | Immutable consent ledger, Data Principal erasure workflows, grievance routing | **BLOCKING FOR GA** (Legal Counsel) | `VO-080`, `VO-124`, `VO-137` |
| [ADR-016](file:///f:/VyaponeV2/docs/adr/ADR-016-multilingual-and-voice.md) | Multilingual Localization, Indic Typography & Voice | Internationalization | `NEEDS APPROVAL` | i18next; Noto Sans Indic fonts; Sarvam STT/TTS; ElevenLabs English voice | Product Owner & Language Review | `VO-105`, `VO-106` |
| [ADR-017](file:///f:/VyaponeV2/docs/adr/ADR-017-google-business-profile.md) | Google Business Profile API Integration Architecture | Integrations | `NEEDS APPROVAL` | OAuth 2.0 location sync; manual owner approval for Vya-drafted review replies | External Google App Verification | `VO-113` |
| [ADR-018](file:///f:/VyaponeV2/docs/adr/ADR-018-meta-platform-and-social.md) | Meta Platform Verification, Catalogs & Social Auto-Posting | Integrations | `NEEDS APPROVAL` | Meta Graph API for Instagram/FB auto-drafts; human approval required before post | External Meta App Review | `VO-091`, `VO-114` |
| [ADR-019](file:///f:/VyaponeV2/docs/adr/ADR-019-delivery-partner-framework.md) | Hyperlocal Delivery Partner Framework | Operations | `NEEDS APPROVAL` | Partner-neutral dispatch adapter; Porter & Borzo candidates; own-rider fallback | Product Owner & City Operations | `VO-115` |
| [ADR-020](file:///f:/VyaponeV2/docs/adr/ADR-020-support-operations-and-staffing.md) | Support Model, Escalation Routing & Staffing Architecture | Support & Operations | `NEEDS APPROVAL` | In-app support with tenant-isolated context; tiered escalation to human agents | Product Owner & Ops Staffing | `VO-122`, `VO-137` |
| [ADR-021](file:///f:/VyaponeV2/docs/adr/ADR-021-direct-diy-owner-plan.md) | Direct DIY Business Owner Plan at GA | Strategy & GTM | `NEEDS APPROVAL` | Focus launch marketing 100% on resellers; technical support for DIY enabled in schema | Product Owner Decision | `VO-022`, `VO-026`, `VO-033` |
| [ADR-022](file:///f:/VyaponeV2/docs/adr/ADR-022-workspace-and-git-model.md) | Workspace Scaffolding & Git Initialization Model | Engineering Baseline | `ACCEPTED` | Scaffolding and build scripts formalized under task VO-010; root git init by developer | Technical Lead | `VO-010`, `VO-011` |
| [ADR-023](file:///f:/VyaponeV2/docs/adr/ADR-023-observability-and-telemetry.md) | Observability, Telemetry, Request Tracing & Health Dashboards | Operations & Reliability | `PROPOSED` | OpenTelemetry + structured JSON logging + request IDs + health check endpoints | Technical Lead | `VO-017`, `VO-123` |
| [ADR-024](file:///f:/VyaponeV2/docs/adr/ADR-024-testing-architecture-and-eval.md) | Testing Architecture, QA Strategy & Golden Evaluation Suite | Quality Assurance | `PROPOSED` | Vitest (unit/component) + Playwright (mobile E2E) + Vya multilingual eval suite | Technical Lead | `VO-019`, `VO-051`, `VO-130` |
| [ADR-025](file:///f:/VyaponeV2/docs/adr/ADR-025-security-threat-defense-and-dr.md) | Security Threat Defense, Incident Response & Disaster Recovery | Security & Compliance | `PROPOSED` | STRIDE mitigations, CERT-In 6hr runbook, hourly DB backups, RPO < 1h / RTO < 4h | Technical Lead & Security Review | `VO-004`, `VO-131`, `VO-134` |

---

## 3. High-Priority Hard Blockers for Live Production

Before live real-money transactions, customer messaging broadcasts, or public GA deployment, the following three decisions must transition from `NEEDS APPROVAL` to `ACCEPTED`:

1. **ADR-010 (Reseller Split Settlement):** Under RBI PA/PG regulations, VyapOne cannot collect customer funds on behalf of client businesses or resellers without a licensed payment aggregator marketplace arrangement. Live client billing is strictly blocked until a provider contract is executed.
2. **ADR-014 (GST Rules & e-Invoicing):** Statutory tax calculation, HSN/SAC mappings, bill of supply formats, and e-invoicing thresholds must be reviewed and certified by a licensed Chartered Accountant.
3. **ADR-015 (DPDP Act 2023 Compliance):** Data minimization policies, explicit consent tracking, customer opt-out processing, and data retention/deletion rules must receive formal legal counsel sign-off.
