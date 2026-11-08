# ADR-004: Hosting, Edge Runtime and Subdomain Routing

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-07, NFR-PERF-01, NFR-PERF-02, NFR-REL-01, AC-08, AC-09  
**Affected Tasks:** `VO-003`, `VO-042`, `VO-049`, `VO-133`  

---

## 1. Context and Problem Statement
VyapOne hosts two distinct application experiences:
1. **The Application Hub (Reseller Workspace, Operating Dashboard, Vya AI Builder):** Dynamic, authenticated, stateful mobile web application.
2. **Public Tenant Websites (`*.vyapone.in` & Custom Domains):** High-traffic, highly cacheable, SEO-critical public web pages for cafés, salons, kiranas, and services across India.

We must decide the hosting platform, edge network strategy, wildcard subdomain routing, and automated SSL provisioning model.

---

## 2. Options Considered

### Option 1: Vercel Enterprise / Pro with Vercel Domains API (Candidate in PRD FINAL §15.1)
- **Deployment:** Unified Next.js application deployed to Vercel edge/serverless network.
- **Tenant Routing:** Edge Middleware rewrites incoming requests based on the `Host` header:
  - `app.vyapone.in` → `/app` (Dashboard & Reseller Workspace)
  - `reseller.com` → `/reseller` (White-labeled Reseller Hub)
  - `<business-slug>.vyapone.in` or custom domain `cafename.com` → `/sites/[slug]`
- **Custom Domains & SSL:** Automated via Vercel Domains API and Vercel edge SSL.

### Option 2: Cloudflare Pages / Workers + Cloudflare for SaaS
- **Deployment:** Next.js deployed via OpenNext / Cloudflare Pages.
- **Tenant Routing:** Cloudflare Workers at the edge intercept requests and route directly to edge key-value or SSR origin.
- **Custom Domains & SSL:** Cloudflare for SaaS provides wildcard SSL and automated custom domain CNAME verification.

### Option 3: AWS ECS (Fargate) + CloudFront + ALB (Self-Managed Containerized Cluster)
- **Deployment:** Containerized Next.js Node.js server running in AWS Mumbai (`ap-south-1`).
- **Tenant Routing:** Custom Nginx reverse proxy or ALB wildcard rules.

---

## 3. Comparison of Options

| Criterion | Option 1: Vercel Platform | Option 2: Cloudflare for SaaS | Option 3: AWS ECS / Container |
|---|---|---|---|
| **India Edge Performance & TTFB** | **Excellent:** Mumbai edge presence; sub-50ms static asset delivery. | **Excellent:** Cloudflare has dense edge presence across Indian tier-1/2 cities. | **Good in Mumbai;** slower in regional tier-2/3 cities without CloudFront CDN tuning. |
| **Next.js 15 Feature Support** | **Native 100%:** Instant support for App Router, Server Actions, streaming. | **Good:** Requires OpenNext adapter; occasional lagging support for bleeding-edge Next.js features. | **High:** Standard Node.js runtime, but manual caching configuration required. |
| **Custom Domain Automation** | **Turnkey:** Vercel Domains API handles DNS verification, SSL cert generation, and renewal. | **Turnkey:** Cloudflare for SaaS SSL for SaaS is enterprise-grade. | **Complex:** Requires ACM certificates, ALB listener rule management, and custom automation. |
| **Operational Overhead** | **Zero:** Fully managed serverless platform. | **Low:** Managed edge platform. | **High:** Requires Kubernetes/ECS, ALB, Docker build pipelines, and auto-scaling management. |

---

## 4. Architectural Implications

- **Edge Isolation:** Middleware extracts the hostname, checks cached tenant mapping in Redis/Edge Config, and routes to `/sites/[business_id]` in sub-5ms.
- **Cache Strategy:** Public website pages use Incremental Static Regeneration (ISR) with tag-based revalidation (`revalidateTag(business_id)`). When an owner publishes an update or edits stock, only that business's cache is invalidated.
- **DDoS & Rate Limiting:** Edge network absorbs public bot traffic, DDoS attacks, and form spam before hitting origin database servers.

---

## 5. Vendor Lock-in & Portability
Next.js outputs a standalone Node.js server build (`output: 'standalone'`). If Vercel costs scale beyond budget post-GA, the identical container can be migrated to AWS ECS or Cloudflare without code refactoring.

---

## 6. Recommendation and Rationale
**Adopt Option 1 (Vercel) as primary deployment architecture for development and initial launch:**
- Turnkey integration with Next.js 15, App Router, and Vercel AI SDK.
- Proven custom domain management via Vercel Domains API for both free subdomains (`*.vyapone.in`) and white-label custom domains.
- Excellent low-latency edge caching across India.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** Target domain registration (`vyapone.in` - ADR-012), Vercel account.
- **Reversal Strategy:** Maintain standard Next.js code without Vercel-proprietary runtime calls. The standalone Docker build is preserved and tested in CI (`VO-018`).
- **Approval Requirement:** Technical Lead & Cost Review. Marked `PROPOSED`.
