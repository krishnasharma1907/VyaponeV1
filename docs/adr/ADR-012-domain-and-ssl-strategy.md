# ADR-012: Domain Strategy, Free Subdomains and Custom SSL

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Technical Lead  
**Related PRD Requirements:** FR-07, RES-03, AC-09  
**Affected Tasks:** `VO-003`, `VO-042`, `VO-049`, `VO-111`  

---

## 1. Context and Problem Statement
VyapOne hosts thousands of public client websites and reseller dashboards. The platform must support two domain tiers:
1. **Free Instant Subdomains:** Every created business receives an immediate live URL (e.g. `rohitcafe.vyapone.in`) with automated wildcard SSL.
2. **Custom Domains:** Higher-tier businesses and white-labeled agencies can connect custom domains (e.g. `rohitcafe.com` or `portal.agencybrand.in`) with automated CNAME verification and SSL certificate provisioning.

We must decide the official platform domain structure, wildcard DNS architecture, and custom domain SSL management engine.

---

## 2. Options Considered

### Option 1: Official Root Domain `*.vyapone.in` with Vercel Domains API (Recommended)
- **Root Domain:** Primary candidate `vyapone.in` (India-first recognition) with wildcard DNS (`*.vyapone.in` pointing to Vercel/Cloudflare edge).
- **Custom Domains:** Automated provisioning via Vercel Domains API (`POST /v9/projects/{id}/domains`), which verifies CNAME records and provisions Let’s Encrypt SSL certificates automatically.
- **Agency White-Label:** Custom dashboard domains (`portal.agency.com`) routed via the same domain verification engine.

### Option 2: Cloudflare for SaaS (Custom Hostnames)
- **Architecture:** Cloudflare SaaS custom hostnames with fallback origin and automated SSL certificates issued at the edge.

---

## 3. Comparison of Options

| Criterion | Option 1: Vercel Domains API | Option 2: Cloudflare for SaaS |
|---|---|---|
| **Next.js Integration** | **Native:** Managed inside the primary Next.js deployment. Zero external proxy configuration. | **Good:** Requires setting up a Cloudflare zone and routing to origin server. |
| **SSL Provisioning Time** | Typically under 60 seconds once CNAME propagates. | Under 60 seconds via Cloudflare edge. |
| **India Latency** | Excellent edge presence across Indian metros. | Excellent edge presence across Indian metros. |

---

## 4. Architectural Implications

- **DNS Configuration:**
  - Wildcard A/CNAME record: `*.vyapone.in` → Platform edge IP.
  - Client custom domain instruction: CNAME pointing to `cname.vyapone.in`.
- **Pre-Publish Verification (`VO-049`):** Before activating a custom domain, background workers verify DNS propagation (`dig CNAME`) and ensure the domain is not already linked to another tenant.
- **Permanent QR Target:** Dynamic QR codes always point to the permanent platform slug route (`https://vyapone.in/qr/{business_slug}/{qr_id}`), which performs a 302 redirect to whatever custom domain or page destination the owner currently configures.

---

## 5. Recommendation and Rationale
**Adopt Option 1: Primary subdomain candidate `*.vyapone.in` with Vercel Domains API (or Cloudflare for SaaS).**
- Provides instant zero-setup subdomains for small shops while supporting agency white-label custom domains.
- Decouples QR destinations from custom domain migrations, ensuring physical printed QR codes never break.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Domain acquisition and DNS management for `vyapone.in` (or approved alternative).
- **Approval Requirement:** **Product Owner sign-off on domain name purchase and brand policy.** Marked `NEEDS APPROVAL`.
