# ADR-018: Meta Platform Verification, Catalogs and Social Auto-Posting

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Technical Lead  
**Related PRD Requirements:** FR-15, FR-21, MOD-19, AC-24  
**Affected Tasks:** `VO-003`, `VO-091`, `VO-114`  

---

## 1. Context and Problem Statement
VyapOne integrates with Meta (Facebook & Instagram) across two essential modules:
1. **WhatsApp Business Platform:** Dedicated Cloud API access via Meta Embedded Signup (ADR-008).
2. **Auto Social Posts & Catalog Sync (PRD FINAL §8.19):** Converting catalog items, festival greetings, and review highlights into formatted Instagram/Facebook posts (1:1, 4:5) and WhatsApp status stories (9:16) with draft captions in regional languages.

We must define the technical architecture for social asset generation and address Meta’s required App Review and business verification protocols.

---

## 2. Technical Architecture

### 2.1 Brand Creative Rendering Pipeline (`VO-114`)
- **Template Engine:** Server-side canvas rendering (`@napi-rs/canvas` or Satori SVG engine) merges merchant brand tokens (logo, primary green `#0B6E4F`, marigold accent `#F5A524`, business name, phone number) with curated festival calendars and product photography.
- **Strict Human Approval Gate:** Creatives and AI-suggested captions are saved to a `social_drafts` queue. **No creative or caption is ever auto-published without an explicit owner confirmation click.**
- **Manual Share Fallback:** One-tap "Download Image & Copy Caption" button allows instant manual posting to Instagram, Facebook, and WhatsApp Status without requiring connected Meta API accounts.

### 2.2 Meta Graph API Integration
- **Permissions Required:** `pages_manage_posts`, `instagram_basic`, `instagram_content_publish`.
- **Meta App Review:** Requires a live app demo video, privacy policy, and business verification.

---

## 3. Comparison of Approaches

| Criterion | Direct Meta Publishing + Manual Share Fallback | Pure API Automation (No Manual Option) |
|---|---|---|
| **Immediate Usability** | **100% Day-One Utility:** Merchants can generate and download branded festival creatives even before connecting Meta accounts. | Zero utility until merchant successfully navigates complex Meta Business Manager setup. |
| **Merchant Safety** | **High:** Zero risk of unintended social posts; full human review. | Moderate risk of AI hallucinated social posts damaging merchant reputation. |
| **Meta Approval Dependency** | Platform delivers 80% of value through manual share downloads while Meta App Review is pending. | Hard blocked until Meta approves enterprise permissions. |

---

## 4. Architectural Implications

- **Asset Caching:** Generated social images are cached in S3/Supabase Storage as WebP files (`/tenants/{id}/social/{uuid}.webp`).
- **Festival Calendar Engine:** Pre-populated Hindu, Islamic, Christian, Sikh, and national holiday calendar triggers creative draft generation 7 days in advance.

---

## 5. Recommendation and Rationale
**Adopt a hybrid architecture: Automated creative rendering with one-tap manual sharing fallback, backed by official Meta Graph API publishing.**
- Delivers immediate marketing value to merchants from day one.
- Shields platform rollout from third-party Meta App Review delays.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Satori/Canvas rendering engine (`VO-114`), Meta App Review submission.
- **Approval Requirement:** **External Meta Business Verification & App Review Required.** Marked `NEEDS APPROVAL (PENDING_EXTERNAL_APPROVAL)`.
