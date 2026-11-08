# ADR-001: Frontend and Backend Application Stack

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-01, FR-02, FR-06, FR-07, NFR-PERF-01, NFR-PERF-02, AC-01, AC-07  
**Affected Tasks:** `VO-003`, `VO-010`, `VO-011`, `VO-012`, `VO-014`, `VO-015`  

---

## 1. Context and Problem Statement
VyapOne is an India-first business operating platform serving resellers and local businesses. The platform requires a unified, mobile-first web application that operates seamlessly on mobile viewports (390 px), provides installable Progressive Web App (PWA) capabilities, renders high-performance multi-tenant public websites, and provides secure backend APIs with server-side authorization.

We must select an application framework and programming language that provides end-to-end type safety, excellent mobile web performance on 4G networks in India, fast time-to-market, and a rich component ecosystem.

---

## 2. Options Considered

### Option 1: Next.js 15+ (App Router) + TypeScript + React 19 + Tailwind CSS (Recommended in FINAL PRD §15.1)
- **Architecture:** Monolithic monorepo or unified full-stack application. Uses Next.js App Router for React Server Components (RSC), server actions, API route handlers, and static/edge rendering for public client websites.
- **Styling & UI:** Tailwind CSS v4, accessible unstyled primitives (Radix UI / shadcn/ui pattern), Lucide icons.

### Option 2: Remix / React Router v7 + Node.js Express Backend
- **Architecture:** Split or unified Remix application focusing on web standards and nested routing, paired with an Express/Fastify API service.
- **Styling & UI:** Tailwind CSS with Radix UI.

### Option 3: Vite SPA (Frontend) + Separate Go/FastAPI/NestJS Backend
- **Architecture:** Decoupled single-page application for dashboard/builder and separate microservices for backend business logic.

---

## 3. Comparison of Options

| Criterion | Option 1: Next.js 15+ Full-Stack | Option 2: Remix + Express API | Option 3: Vite SPA + Go/NestJS |
|---|---|---|---|
| **Public Site Load Speed (SEO/LCP)** | **Excellent:** Static generation and edge SSR for tenant websites. | **Good:** Server-rendered routes. | **Poor for SEO:** Requires separate SSR pipeline or prerendering. |
| **Developer Velocity & Single Language** | **High:** Shared TypeScript interfaces, Zod schemas, and end-to-end type safety. | **Moderate:** Two separate runtimes if using Express. | **Low:** Context switching between frontend and backend stacks. |
| **Mobile PWA & 390px Viewport** | **High:** App router supports lightweight client bundles and service workers. | **High:** Excellent progressive enhancement. | **High:** Standard SPA shell. |
| **Community & Ecosystem Support** | **Very High:** Dominant React framework in 2026; native support for Vercel AI SDK, Puck editor, and shadcn. | **Moderate:** Smaller ecosystem for specific AI and visual editor integrations. | **High:** Independent ecosystems, but higher integration overhead. |

---

## 4. Architectural Implications

- **Security:** Server Actions and API Route handlers enforce server-side authentication and tenant authorization before invoking domain logic. Next.js environment variable handling (`NEXT_PUBLIC_` prefix) guarantees zero leakage of server secrets to client bundles.
- **Performance:** Public business pages are rendered with minimal JavaScript via Server Components. Bundle analysis ensures zero admin, 3D, or Vya code leaks into public customer sites (NFR-PERF-02).
- **Cost:** A single full-stack runtime significantly reduces infrastructure overhead during Phase P1–P13 compared to maintaining separate microservice clusters.
- **Scalability:** Next.js can be deployed serverlessly on edge networks (Vercel/Cloudflare) or containerized with Node.js/Docker on AWS/GCP for multi-region scale.

---

## 5. Vendor Lock-in & Portability
Next.js applications can be containerized via standalone output (`output: 'standalone'`) and hosted on any standard Docker/Kubernetes platform, AWS ECS, or DigitalOcean, mitigating lock-in to Vercel hosting.

---

## 6. Recommendation and Rationale
**Adopt Option 1: Next.js 15+ (App Router) with TypeScript, React 19, and Tailwind CSS.**
- Directly matches the primary architecture specification in `PRD_FINAL_v2_2026-11-03.md` (§15.1).
- Provides end-to-end type safety with shared Zod validation schemas across client and server.
- Supports the required constrained visual editor (Puck) and Vercel AI SDK natively.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** Node.js v24+, pnpm package manager.
- **Reversal Strategy:** Code is structured into decoupled domain libraries (clean architecture). If a dedicated backend service (Go or NestJS) is required post-GA, API route handlers act as facades and can be migrated without modifying client UI components.
- **Product Owner Approval:** Not required for language/framework baseline; standard technical lead remit. Marked `PROPOSED`.
