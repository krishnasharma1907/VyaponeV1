# ADR-019: Hyperlocal Delivery Partner Framework

**Date:** 8 November 2026  
**Status:** `NEEDS APPROVAL`  
**Deciders:** Product Owner, City Operations Lead, Technical Lead  
**Related PRD Requirements:** FR-21, MOD-20  
**Affected Tasks:** `VO-003`, `VO-115`  

---

## 1. Context and Problem Statement
For local food, bakery, grocery, and retail businesses, order fulfillment requires local delivery. PRD FINAL §8.20 specifies a **Delivery Integration** module to dispatch local orders to logistics partners and share live tracking links with customers on WhatsApp.

**Critical Historical Correction (PRD FINAL §8.20):**
> *Dunzo, frequently cited in earlier discussions, ceased commercial operations in January 2025 and is strictly disqualified.*

Candidate partners vary drastically by city across India: **Porter**, **Borzo** (both offer mature B2B delivery APIs), **Rapido Parcel**, **Shadowfax**, and **ONDC Hyperlocal Logistics**. Many small restaurants also employ their **own delivery riders**.

We must build a partner-neutral dispatch framework that operates reliably across varying city coverages.

---

## 2. Options Considered

### Option 1: Modular Multi-Partner Dispatch Adapter + "Own Rider" Mode (Recommended)
- **Architecture:** `IDeliveryProvider` interface (`estimateCost()`, `createDeliveryTask()`, `getTrackingLink()`, `cancelTask()`).
- **Partner Adapters:**
  - `BorzoAdapter`: On-demand 2-wheeler courier across major Indian metros.
  - `PorterAdapter`: 2-wheeler and 3-wheeler intra-city goods transport.
  - `OwnRiderAdapter`: Zero-cost internal mode: owner assigns staff name and phone; generates a simple tracking WhatsApp update.
- **City Registry:** Database table `delivery_partner_cities` enables partners dynamically based on the merchant’s geographic coordinates.

### Option 2: Single Dedicated Logistics Provider Exclusive Contract
- **Architecture:** Standardizing exclusively on one provider (e.g., Shadowfax). (Rejected: No single provider has 100% operational reliability and coverage across all Indian tier-2/3 cities).

---

## 3. Comparison of Options

| Criterion | Option 1: Multi-Partner Adapter + Own Rider | Option 2: Single Exclusive Provider |
|---|---|---|
| **Geographic Coverage** | **Highest:** Automatically selects Borzo in Delhi/NCR, Porter in Mumbai, or switches to Own Rider in tier-3 towns. | Low: Leaves merchants without delivery options outside major metro zones. |
| **Merchant Independence** | **High:** Merchants with their own staff pay ₹0 delivery commissions; merchants needing riders dispatch on demand. | Low: Forces all merchants into third-party commission models. |
| **Operational Redundancy** | **High:** If Borzo experiences rider shortages, owner can dispatch via Porter or self-deliver. | Low: System goes down during single provider outages. |

---

## 4. Architectural Implications

- **Idempotent Dispatch (`VO-115`):** Dispatching a delivery generates a unique `dispatch_reference` tied to the `order_id`. Retry attempts verify provider state to prevent dispatching multiple riders for a single pizza or cake.
- **Live WhatsApp Tracking:** When the delivery partner returns a live tracking URL, the automation engine (`VO-094`) sends an automated WhatsApp template to the customer with the rider's name, phone, and map link.

---

## 5. Recommendation and Rationale
**Adopt Option 1: Modular Multi-Partner Adapter with "Own Rider" as default zero-setup mode.**
- Completely satisfies PRD FINAL §8.20 while acknowledging the closure of Dunzo.
- Empowers local shops with or without external courier accounts.

---

## 6. Dependencies & Approval Requirement
- **Dependencies:** Partner API developer agreements (Borzo / Porter), Geocoding service (`VO-115`).
- **Approval Requirement:** **Product Owner & City Operations sign-off on partner selection per launch city.** Marked `NEEDS APPROVAL`.
