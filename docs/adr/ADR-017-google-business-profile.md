# ADR-017: Google Business Profile Integration Architecture

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, Technical Lead  
**Related PRD Requirements:** FR-21, MOD-18, AC-24  
**Affected Tasks:** `VO-003`, `VO-113`  

---

## 1. Context and Problem Statement
Local businesses in India rely heavily on Google Maps and Google Search for discovery. PRD FINAL §8.18 mandates the **Google Business Profile (GBP) Sync** module:
1. Pushing operating hours, holiday schedules, phone numbers, website URLs, photos, and offers from VyapOne to Google Maps automatically.
2. Pulling incoming Google reviews into VyapOne; Vya drafts polite reply suggestions, and the owner approves before posting.
3. Conducting profile health audits (missing photos, incomplete hours, unreplied reviews).

We must decide the integration architecture and address the mandatory Google API approval process.

---

## 2. Options Considered

### Option 1: Official Google Business Profile API (Google Cloud OAuth 2.0)
- **Architecture:** VyapOne registers an official Google Cloud Project and applies for GBP API access.
- **Merchant Flow:** Business owner initiates an OAuth 2.0 flow granting `business.manage` permissions for their specific Google listing.
- **Sync Pipeline:**
  - Outbound sync: Triggered when an owner updates profile settings; background job patches Google listing attributes.
  - Inbound reviews: Webhook notifications or periodic 4-hour polling worker fetches new reviews and stores them in `reviews` table.
- **Safety Gate:** Vya generates draft replies using the `DRAFT_REPLY` tool; replies are **NEVER posted automatically** without an explicit owner tap in UI.

### Option 2: Scraping / Unofficial Google My Business Wrappers (Rejected)
- **Verdict:** Violates Google Terms of Service; risks immediate IP banning and legal action. Disqualified.

---

## 3. Comparison and Analysis

| Criterion | Option 1: Official Google GBP API | Option 2: Unofficial Scraping |
|---|---|---|
| **Platform Stability** | **100% Stable:** Official REST APIs backed by Google Cloud SLA. | Fragile: Breaks on any Google UI change. |
| **Merchant Account Safety** | **Safe:** Authenticated via merchant’s own Google account. | Dangerous: Risks Google listing suspension or permanent ban. |
| **Approval Overhead** | **High External Delay:** Requires formal Google Partner application, company verification, and privacy review (typically 3–6 weeks). | Zero upfront approval, but immediate catastrophic risk. |

---

## 4. Architectural Implications

- **Token Security:** OAuth refresh tokens are encrypted at rest using AES-256-GCM before storage in the database (`oauth_connections` table). Tokens are never exposed to client browsers.
- **Graceful Fallback:** If GBP API access is delayed or denied during Phase P11, the UI displays a clear "Connect Google Profile (Coming Soon / Pending Google Verification)" status, allowing merchants to input their public Google Maps review link manually for Level 1 review gathering.

---

## 5. Recommendation and Rationale
**Adopt Option 1: Official Google Business Profile API with OAuth 2.0 and manual owner confirmation on all review replies.**
- Matches PRD FINAL §8.18 and AC-24.
- Protects merchant reputations and Google listing integrity.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Google Cloud Project creation, OAuth consent screen verification, GBP API quota grant (`VO-113`).
- **Approval Requirement:** **External Google Partner API Approval Required.** Marked `NEEDS APPROVAL (PENDING_EXTERNAL_APPROVAL)`.
