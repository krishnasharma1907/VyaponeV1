# ADR-003: Authentication, Identity Lifecycle and Object Storage

**Date:** 8 November 2026  
**Status:** `PROPOSED`  
**Deciders:** Technical Lead  
**Related PRD Requirements:** FR-01, FR-02, SEC-01, SEC-04, AC-01, AC-10  
**Affected Tasks:** `VO-003`, `VO-021`, `VO-027`, `VO-032`  

---

## 1. Context and Problem Statement
VyapOne requires:
1. **Authentication:** Phone-based OTP (India primary) and email/password signup, passwordless recovery, secure session management, and role-based access control (Platform Admin, Reseller, Business Owner, Staff).
2. **Object Storage:** Secure media upload pipeline for business logos, product catalogs, gallery photos, and PDF invoices with direct-to-storage signed uploads, tenant path scoping, and dimension/MIME validation.

---

## 2. Options Considered

### Option 1: Supabase Auth + Supabase Storage (Candidate in PRD FINAL §15.1)
- **Auth:** Supabase Auth with GoTrue, supporting Phone OTP (via Twilio/Msg91), email, JWT session cookies, and native integration with PostgreSQL RLS.
- **Storage:** Supabase Storage (S3-compatible underlying bucket) with storage policies evaluated against PostgreSQL RLS.

### Option 2: Auth.js (NextAuth v5) + AWS S3 / Cloudflare R2 (Decoupled Approach)
- **Auth:** Auth.js v5 embedded in Next.js, storing sessions in PostgreSQL via Drizzle adapter. SMS OTP handled via custom DLT-registered SMS provider.
- **Storage:** AWS S3 (Mumbai `ap-south-1`) or Cloudflare R2 using AWS SDK v3 pre-signed upload URLs (`@aws-sdk/s3-request-presigner`).

### Option 3: Clerk / Auth0 + AWS S3
- **Auth:** Managed enterprise auth platform (Clerk or Auth0).
- **Storage:** AWS S3.

---

## 3. Comparison of Options

| Criterion | Option 1: Supabase Managed | Option 2: Auth.js + S3/R2 | Option 3: Clerk/Auth0 + S3 |
|---|---|---|---|
| **India Phone OTP & DLT Compliance** | **Moderate:** Requires custom SMS hook or Twilio/MessageBird integration. | **High:** Direct integration with Indian DLT-compliant SMS gateways (MSG91, Karix). | **Low/Expensive:** High cost per active user; phone auth requires enterprise tiers. |
| **Integration with PostgreSQL RLS** | **Native:** `auth.uid()` and JWT claims map directly into SQL RLS policies. | **Good:** Requires setting session variables on connection checkout. | **Moderate:** External JWT verification required. |
| **Media Storage Cost & Egress** | **Good:** Standard S3 pricing. | **Excellent:** Cloudflare R2 offers zero egress fees; AWS S3 Mumbai offers lowest local latency. | **Good:** Standard S3 pricing. |
| **Vendor Independence** | **Moderate:** Open source, but tightly coupled to Supabase infrastructure. | **Very High:** Standard Next.js libraries and AWS S3 API standard. | **Low:** Proprietary auth lock-in. |

---

## 4. Architectural Implications

- **Security:** In accordance with SEC-04, no cloud storage credentials or auth master keys can reside in client bundles. Direct-to-storage uploads must use short-lived presigned URLs with strict Content-Length and Content-Type restrictions.
- **Tenant Path Isolation:** Storage keys must follow deterministic tenant scoping: `tenants/{business_id}/media/{file_id}.webp`. Server must verify `business_id` ownership before issuing a presigned upload URL.
- **Session Security:** Auth tokens must be stored in `HttpOnly`, `Secure`, `SameSite=Lax` cookies with server-side session revocation.

---

## 5. Vendor Lock-in & Portability
Both Supabase Auth and S3-compatible storage use open standards. If Supabase is selected, storage can be redirected to AWS S3 Mumbai or Cloudflare R2 via standard S3 client libraries with zero application code changes.

---

## 6. Recommendation and Rationale
**Adopt Option 1 (Supabase Auth & Storage) as primary candidate for initial phases, with strict provider abstraction interfaces:**
- Provides out-of-the-box integration with PostgreSQL RLS and user lifecycle management.
- All storage access must go through an application storage service adapter (`IStorageService`) using S3-compatible commands, allowing seamless failover to Cloudflare R2 or AWS S3 Mumbai if pricing or DLT constraints require it.

---

## 7. Dependencies & Reversal Strategy
- **Dependencies:** PostgreSQL database instance, SMS gateway provider for OTP.
- **Reversal Strategy:** All auth and storage calls reside behind facade interfaces. Switching from Supabase to Auth.js or AWS S3 requires changing only the adapter implementation without refactoring domain logic.
- **Approval Requirement:** Technical Lead. Marked `PROPOSED`.
