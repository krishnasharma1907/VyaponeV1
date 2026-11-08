# VyapOne — Domain Architecture and Data Ownership

**Document Version:** 2.0 (Corrective Review)  
**Date:** 8 November 2026  
**Status:** Canonical Domain Specification (All architectural recommendations marked `PROPOSED`)  
**Task ID:** VO-005  
**Primary Authority:** `reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md` (§4, §8, §15, §16, §17)  
**Related Architecture Documents:** `docs/SOURCE_OF_TRUTH.md`, `docs/THREAT_MODEL.md`, `docs/ADR_INDEX.md`, `docs/REQUIREMENTS_TRACEABILITY.md`  
**Diagram References:**
- Master System Context: [`docs/diagrams/system-context.mmd`](file:///f:/VyaponeV2/docs/diagrams/system-context.mmd)
- Master Container Architecture: [`docs/diagrams/container-diagram.mmd`](file:///f:/VyaponeV2/docs/diagrams/container-diagram.mmd)
- Master Ownership Model: [`docs/diagrams/ownership-model.mmd`](file:///f:/VyaponeV2/docs/diagrams/ownership-model.mmd)
- Core ERD (Master): [`docs/diagrams/core-erd.mmd`](file:///f:/VyaponeV2/docs/diagrams/core-erd.mmd)
- Module ERD 1 — IAM & Tenancy: [`docs/diagrams/erd-iam-tenancy.mmd`](file:///f:/VyaponeV2/docs/diagrams/erd-iam-tenancy.mmd)
- Module ERD 2 — Commerce & Billing: [`docs/diagrams/erd-commerce-billing.mmd`](file:///f:/VyaponeV2/docs/diagrams/erd-commerce-billing.mmd)
- Module ERD 3 — Communications & AI: [`docs/diagrams/erd-communications-ai.mmd`](file:///f:/VyaponeV2/docs/diagrams/erd-communications-ai.mmd)
- Module ERD 4 — Niche Operations: [`docs/diagrams/erd-niche-operations.mmd`](file:///f:/VyaponeV2/docs/diagrams/erd-niche-operations.mmd)

---

## 1. Domain Overview and Core Entity Relationships

VyapOne models the Indian digital commerce ecosystem around resellers, agencies, and local merchants. The platform cleanly decouples platform governance, agency management, sovereign business data ownership, and operational shop roles.

```
┌────────────────────────────────────────────────────────────────────────┐
│                              Platform                                  │
│         (System Governance, Pricing Slabs, Master Tax Tables)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 : N
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                         Reseller Workspace                             │
│       (Agency Branding, Live Site Quotas, Reseller Team Members)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 : N (Delegated Admin)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              Business                                  │
│         (The Sovereign Tenant: Owns Orders, Bills, Customers)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 : 1 (GA) / 1 : N (Post-Launch)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                              Location                                  │
│          (Physical / Virtual Storefront, Operating Hours, Address)     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ 1 : N
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Business Modules and Records                       │
│    (Catalogue, Inventory, Orders, GST Invoices, WhatsApp Chats, CRM)  │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Complete Entity Definitions and Ownership

In strict compliance with PRD FINAL (§4, §8, §16), every platform entity is classified by its ownership tier and tenant scope:

| Entity Name | Primary Ownership | Tenant Scope Column | PRD Section | Backlog Task | Description & Boundary |
|---|---|---|---|---|---|
| **`User`** | Platform | N/A (Global) | §4.1, §16 | `VO-021` | Physical human identity holding profile metadata (name, email, phone, preferred language). Contains zero passwords or tenant data. |
| **`UserAuthIdentity`** | Platform | N/A (Global) | §15.2, §16 | `VO-021` | Delegated authentication provider identities (Supabase Auth UID, Phone OTP, Google OAuth sub). Passwords are never stored in the application domain. |
| **`Workspace`** | Reseller / Agency | `workspace_id` | §4.2, §16 | `VO-022` | Reseller agency boundary managing live website quotas, sub-account billing, agency white-label branding, and staff seats. |
| **`WorkspaceMember`** | Workspace | `workspace_id` | §4.2, §16 | `VO-022` | Associative membership mapping users to workspaces (`OWNER`, `ADMIN`, `MEMBER`, `BILLING_VIEWER`). |
| **`Business`** | Business (Sovereign) | `business_id` | §4.7, §16 | `VO-022`, `VO-025` | **The sovereign tenant.** Owns all operational records, customer bases, GST ledgers, and site versions. Cannot be held hostage by resellers. |
| **`BusinessMember`** | Business | `business_id` | §4.3, §16 | `VO-022`, `VO-112` | Associative membership granting shop roles (`OWNER`, `MANAGER`, `STAFF`). Holds salted PIN hash for counter terminal unlocking. |
| **`Location`** | Business | `business_id` | §4.7, §16 | `VO-022`, `VO-025` | Physical/virtual storefront with geo-coordinates, address, and hours. At GA, exactly 1 primary location per business. |
| **`HandoverRequest`** | Business (Dual Scoped) | `business_id`, `source_workspace_id` | §4.7, §16 | `VO-022`, `VO-111` | Immutable, auditable business transfer ledger recording owner approval OTPs, workspace detachment, domain retention, and payment decoupling. |
| **`Site`** | Business | `business_id` | §8.2, §16 | `VO-040`, `VO-042` | Root website container holding custom domains, SSL status, and references to current draft and published AST versions. |
| **`SiteVersion`** | Business | `business_id` (via Site) | §8.2, §16 | `VO-040`, `VO-044` | Immutable structured JSON configuration (AST) of the website. Never stores arbitrary executable user code. |
| **`ModuleInstallation`** | Business | `business_id` | §8, §16 | `VO-030` | Active niche modules and feature configurations enabled for the merchant. |
| **`Customer`** | Business | `business_id` | §8.16, §16 | `VO-080` | Business-scoped CRM record. Protected phone lookup via deterministic hash; shared phone numbers permitted. |
| **`ConsentRecord`** | Business | `business_id` | §8.16, §16 | `VO-080`, `VO-124` | DPDP-compliant consent ledger recording channel, purpose (marketing vs transactional), timestamp, and source evidence. |
| **`CatalogueCategory`** | Business | `business_id` | §8.3, §16 | `VO-060` | Taxonomy tree for grouping products and services. |
| **`CatalogueItem`** | Business | `business_id` | §8.3, §16 | `VO-060` | Product or service definition with variants, price configuration, and media. |
| **`InventoryStock`** | Business | `business_id`, `location_id` | §8.7, §16 | `VO-061` | Real-time stock on hand, low-stock thresholds, and availability status. |
| **`InventoryMovement`** | Business | `business_id`, `location_id` | §8.7, §16 | `VO-061` | Immutable audit ledger of stock adjustments (sales, restocks, damages). |
| **`Lead`** | Business | `business_id` | §8.4, §16 | `VO-062` | Enquiry pipeline record with status, source attribution, and follow-up schedules. |
| **`Order`** | Business | `business_id`, `location_id` | §8.5, §16 | `VO-063` | Customer commerce order with server-calculated totals, pickup/delivery context, and status. |
| **`OrderItem`** | Business | `business_id` (via Order) | §8.5, §16 | `VO-063` | Line item snapshot containing item name, options, unit price, and tax amounts. |
| **`Appointment`** | Business | `business_id`, `location_id` | §8.6, §16 | `VO-070` | Booking booking service slot, assigned staff, start/end time, and status. |
| **`StaffSchedule`** | Business | `business_id`, `location_id` | §8.6, §8.21 | `VO-070`, `VO-112` | Staff roster, working hours, and blocked times. |
| **`PropertyListing`** | Business | `business_id` | §8.8, §16 | `VO-071` | Real estate property with attributes, media, pricing, and assigned agent. |
| **`SiteVisit`** | Business | `business_id` | §8.8 | `VO-071` | Property site visit appointment linked to customer and agent. |
| **`RestaurantTable`** | Business | `business_id`, `location_id` | §8.5, §8.9 | `VO-072` | Dining table identifier, QR pairing, seating capacity, and active order reference. |
| **`KotTicket`** | Business | `business_id`, `location_id` | §8.5 | `VO-072` | Kitchen Order Ticket sequence for restaurant counter and kitchen operations. |
| **`ServiceTicket`** | Business | `business_id` | §8.4, §8.5 | `VO-073` | Repair/service ticket with item condition notes, estimated/final cost, and promised delivery date. |
| **`CouponOffer`** | Business | `business_id` | §8.11 | `VO-083` | Promotional discount code, validity period, and usage limits. |
| **`LoyaltyLedger`** | Business | `business_id` | §8.11 | `VO-083` | Customer loyalty points transactions and audit ledger. |
| **`InvoiceSequence`** | Business | `business_id` | §8.15 | `VO-081` | Gap-free transactional sequence counter per business, financial year, and series prefix. |
| **`Bill`** | Business | `business_id`, `location_id` | §8.15, §16 | `VO-081` | Statutory GST tax invoice, bill of supply, or credit note with server-computed tax breakdown. |
| **`TaxRate`** | Platform | N/A (Master Reference) | §8.15, §16 | `VO-082` | Authoritative statutory HSN/SAC master rates and price-slab rules. |
| **`PaymentRecord`** | Dual (Workspace or Business) | `workspace_id` OR `business_id` | §16 | `VO-084`, `VO-088` | Payment transaction ledger for customer orders (business) or reseller subscriptions (workspace). Governed by exclusive-OR check. |
| **`Subscription`** | Workspace | `workspace_id` | §16 | `VO-026`, `VO-087` | Reseller platform plan entitlement, active billing period, and grace status. |
| **`ClientInvoice`** | Workspace (Dual Reference) | `workspace_id`, `business_id` | §16 | `VO-088` | Reseller-to-merchant agency management fee invoice managed via split settlement partner. |
| **`QRCode`** | Business | `business_id` | §8.9, §16 | `VO-085` | Permanent redirect slug and dynamic routing configuration. |
| **`MessageTemplate`** | Business / Platform | `business_id` (NULL if platform) | §8.13, §16 | `VO-091` | Meta-approved WhatsApp template definition with language and category. |
| **`Message`** | Business | `business_id` | §8.13, §16 | `VO-092` | Outbound/inbound WhatsApp chat log with delivery status and provider reference. |
| **`Broadcast`** | Business | `business_id` | §8.16, §16 | `VO-095` | Bulk marketing campaign record with recipient counts, cost previews, and owner approval. |
| **`Automation`** | Business | `business_id` | §8.17, §16 | `VO-096` | Event-driven trigger/condition/action rule configuration. |
| **`AutomationRun`** | Business | `business_id` | §8.17, §16 | `VO-097` | Execution log of an automation rule with idempotency key and step outputs. |
| **`BusinessMemory`** | Business | `business_id` | §16 | `VO-101` | Curated shop profile facts and business context used for Vya AI prompts. |
| **`Conversation`** | Business | `business_id` | §16 | `VO-100` | Chat thread between customer or staff and Vya assistant. |
| **`ConversationTurn`** | Business | `business_id` (via Conversation) | §16 | `VO-100` | Individual message turn with role, content, and tool calls. |
| **`AIAction`** | Workspace & Business | `workspace_id`, `business_id` | §16 | `VO-050`, `VO-102` | Audit ledger of AI operations recording token usage, latency, provider, and cost. |
| **`PendingAction`** | Business | `business_id` | §16 | `VO-052`, `VO-103` | Staged high-consequence AI write action requiring human owner confirmation. |
| **`Integration`** | Business | `business_id` | §16 | `VO-110`, `VO-113` | Third-party connection credentials (Google, Meta, Payment Gateways, Delivery). |
| **`AuditLog`** | Platform / Workspace / Business | `workspace_id`, `business_id` | §16 | `VO-028` | Immutable tamper-evident system audit log of sensitive operations. |
| **`AnalyticsEvent`** | Business | `business_id` | §8.12, §16 | `VO-086` | Privacy-coarse metric event for site visits, QR scans, and order conversions. |

---

## 2. Multi-Tenant Model and Access Hierarchy

### 2.1 The Four-Level Tenancy Path
The multi-tenant hierarchy strictly enforces the four tiers:
$$\text{Platform} \longrightarrow \text{Reseller Workspace} \longrightarrow \text{Business} \longrightarrow \text{Location} \longrightarrow \text{Operational Records}$$

- **Tenant Boundary:** The `Business` entity is the primary tenant partition for all merchant data. Every customer, order, bill, catalogue item, and message contains an indexed, non-nullable `business_id`.
- **Workspace Isolation:** Reseller agencies operate exclusively within their assigned `Workspace`. A workspace cannot query, enumerate, or modify businesses belonging to another workspace.
- **Business Data Isolation:** Business data is row-level isolated. Even within the same reseller workspace, Business A cannot query or read data belonging to Business B.
- **User Membership:** Users have zero implicit access. Access to a workspace requires an explicit `WorkspaceMember` row; access to a business requires a `BusinessMember` row or an active delegated workspace administrative relationship.
- **Reseller Team Access:** Agency staff members hold scoped permissions (e.g., "Site Editor" can modify website drafts but cannot see client billing payouts; "Billing Viewer" sees earnings but cannot edit site code).
- **Business Owner Access:** The merchant proprietor holds full read/write authority over their business operations, inventory, GST bills, and staff members.
- **Staff Permissions (Counter Mode):** Staff members log in using a 4-to-6-digit PIN on a shared tablet/phone. Access is restricted to `orders:create`, `orders:update_status`, `appointments:view`, `bills:punch`, and `payments:confirm_cash`. They cannot view client billing, profit margins, or export customer data.
- **Platform Admin Access:** Super-admins hold zero unrestricted database access. Admin operations utilize a dedicated `assume_tenant_view` token with mandatory time-expiry (max 60 minutes) and mandatory reason logging in `audit_logs`.

---

## 3. Data Ownership vs. Administrative Access

A foundational architectural requirement (PRD FINAL §4.7) is that **business data must never become hostage to or inseparable from the reseller workspace**.

```
┌───────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ Responsibility Dimension      │ Authoritative Entity & Governance Rules                                │
├───────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ 1. Sovereign Data Ownership   │ BUSINESS owns all operational records:                                 │
│                               │ • Customer lists & consent ledgers                                     │
│                               │ • Orders, bookings, catalogue items, inventory                         │
│                               │ • Statutory GST invoices & credit notes                                │
│                               │ • Website AST configurations & media assets                            │
│                               │ • AI shop memories & WhatsApp conversation transcripts                 │
├───────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ 2. Administrative Access      │ RESELLER WORKSPACE holds revocable administrative access:              │
│                               │ • Can edit website drafts & publish updates                            │
│                               │ • Can configure enabled modules & integrations                         │
│                               │ • Can assist with customer support                                     │
│                               │ *Access terminates immediately upon business handover.*               │
├───────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ 3. Billing Responsibility     │ Split across two distinct relationships:                               │
│                               │ • Platform Subscription: Reseller pays VyapOne for website slots       │
│                               │ • Client Billing: Merchant pays Reseller for management via Split API  │
│                               │ • Customer Checkout: End-customers pay the Merchant directly          │
├───────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ 4. Platform Operational Access│ VYAPONE PLATFORM holds least-privilege diagnostic access:              │
│                               │ • Platform operators inspect health & resolve support tickets          │
│                               │ • Enforces statutory compliance (CERT-In, DPDP Act 2023)               │
│                               │ • All platform reads/writes write immutable audit rows                 │
└───────────────────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Entity-Relationship Diagrams

To prevent overcrowding and ensure modular maintainability, the domain schema is documented across five dedicated Mermaid diagrams:

1. **Master Core ERD:** [`docs/diagrams/core-erd.mmd`](file:///f:/VyaponeV2/docs/diagrams/core-erd.mmd) (Tenancy backbone and top-level relations)
2. **Module ERD 1 — IAM & Tenancy:** [`docs/diagrams/erd-iam-tenancy.mmd`](file:///f:/VyaponeV2/docs/diagrams/erd-iam-tenancy.mmd) (Users, Auth Identities, Workspaces, Businesses, Memberships, Locations, Handover)
3. **Module ERD 2 — Commerce & Billing:** [`docs/diagrams/erd-commerce-billing.mmd`](file:///f:/VyaponeV2/docs/diagrams/erd-commerce-billing.mmd) (Orders, Items, Bills, Sequences, Tax Rates, Payments, Subscriptions, Invoices)
4. **Module ERD 3 — Communications & AI:** [`docs/diagrams/erd-communications-ai.mmd`](file:///f:/VyaponeV2/docs/diagrams/erd-communications-ai.mmd) (Conversations, Memory, AI Actions, Templates, Messages, Broadcasts, Automations)
5. **Module ERD 4 — Niche Operations:** [`docs/diagrams/erd-niche-operations.mmd`](file:///f:/VyaponeV2/docs/diagrams/erd-niche-operations.mmd) (Leads, Catalogue, Inventory, Appointments, Properties, Tables, KOT, Service Tickets, Loyalty)

---

## 5. Module Data Architecture (14 Operational Domains)

| Domain Group | Primary Entities | Data Ownership | Tenant Scoping Column | Access Boundaries & Visibility | Task ID |
|---|---|---|---|---|---|
| **1. Catalogue & Services** | `catalogue_items`, `catalogue_categories` | Business | `business_id` | Publicly readable on website; writable by Owner, Reseller, and authorized Staff. | `VO-060` |
| **2. Orders & Fulfilment** | `orders`, `order_items` | Business | `business_id` | Readable by Customer (own order), Staff (counter), Owner, Reseller. Server-calculated totals. | `VO-063` |
| **3. Appointments** | `appointments`, `staff_schedules` | Business | `business_id` | Readable by Customer (own slot), Staff (assigned), Owner, Reseller. Double-booking locks. | `VO-070` |
| **4. Inventory** | `inventory_stock`, `inventory_movements` | Business | `business_id` | Owner and Staff counter view. Never exposed to public visitors. Low-stock WhatsApp alerts. | `VO-061` |
| **5. Property Listings** | `property_listings`, `site_visits` | Business | `business_id` | Public listing pages; enquiries and visits routed to assigned agent. | `VO-071` |
| **6. Customer CRM** | `customers`, `consent_records` | Business | `business_id` | Strictly private to Business Owner and Reseller. Staff see only counter summaries. | `VO-080` |
| **7. GST Billing** | `bills`, `invoice_sequences`, `tax_rates` | Business | `business_id` | Gap-free sequential numbering. CGST/SGST/IGST computed by system. Immutable. | `VO-081` |
| **8. Payments** | `payment_records` | Dual (Business or Workspace) | `business_id` OR `workspace_id` | Strict check constraint: customer order payments map to `business_id`; reseller subscription payments map to `workspace_id`. | `VO-084` |
| **9. WhatsApp Messaging** | `messages`, `message_templates`, `broadcasts` | Business | `business_id` | Subject to customer consent status and quiet hours (no promos after 9 PM). | `VO-091` |
| **10. Automations** | `automations`, `automation_runs` | Business | `business_id` | Background execution with `idempotency_key` and loop detection. | `VO-096` |
| **11. Reseller Billing** | `client_invoices`, `subscriptions` | Workspace | `workspace_id` | Reseller Owner and Business Owner view. Managed via licensed split settlement partner. | `VO-088` |
| **12. Staff Management** | `business_members` | Business | `business_id` | PIN-hashed session access; actions tagged with staff member ID. | `VO-112` |
| **13. AI Memory & Chat** | `business_memories`, `conversations`, `pending_actions`, `ai_actions` | Business | `business_id` | Memory inspectable and deletable by Business Owner. Bounded by `PendingAction`. | `VO-101` |
| **14. Analytics** | `analytics_events` | Business | `business_id` | Privacy-coarse metrics (visits, orders, GMV). Zero raw chat or PII stored. | `VO-086` |

---

## 6. The Location Model (GA Baseline vs. Post-Launch Expansion)

### 6.1 PRD Authority Constraint
> **CRITICAL RULE (PRD FINAL §22 Phase 5):**  
> *Multi-location support is explicitly designated as **Post-Launch Phase 5 Expansion**.*  
> *Full multi-location features (inventory transfers between warehouses, location-specific staff shifts, multi-branch consolidated analytics) MUST NOT be pulled into General Availability (GA) scope.*

### 6.2 Data Model Gap Analysis in PRD FINAL
In `PRD_FINAL_v2_2026-11-03.md` §4.7, the hierarchy is defined as:
`Platform → Reseller Workspace → Business → Location → Modules and records`  
However, in Section 16 (Initial Data Model), a dedicated `Location` table was omitted; instead, `address_configuration` was embedded as a JSONB field inside `Business`.

### 6.3 Future-Compatible GA Solution (PROPOSED)
1. **Schema Design:** We define a canonical `locations` table:
   - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` (or `uuidv7()`)
   - `business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE`
   - `name VARCHAR(255) NOT NULL DEFAULT 'Main Location'`
   - `is_primary BOOLEAN NOT NULL DEFAULT true`
   - `address JSONB NOT NULL` (street, city, state, postal_code, country)
   - `coordinates JSONB NULL` (latitude, longitude for delivery/maps)
   - `operating_hours JSONB NOT NULL`
   - `status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE'`
2. **GA Enforcement:** At launch, each business has **exactly one primary location** automatically provisioned upon onboarding. All operational records carry `business_id` as the required tenant partition, with an optional foreign key `location_id REFERENCES locations(id)`.
3. **Post-Launch Evolution (Phase P14):** When multi-location launches, the system simply permits multiple rows per `business_id` in `locations`, with zero schema rewrites.

---

## 7. Business Handover Architecture (Auditable Transfers)

A merchant business must possess the technical and legal capability to transfer between resellers or graduate to a direct self-managed subscription without losing operational history, SEO equity, or customer data.

### 7.1 The Handover Lifecycle and State Machine (PROPOSED)

```
[INITIATED] ──(OTP Dispatched)──► [PENDING_OWNER_CONSENT]
                                            │
               ┌────────────────────────────┴───────────────────────────┐
               ▼ (Owner Approves via OTP)                               ▼ (Owner Rejects / Times Out)
      [OWNER_APPROVED]                                          [REJECTED] / [EXPIRED]
               │
               ▼ (Target Workspace Accepts or Direct Provisioned)
     [ATOMIC_EXECUTION]
         • Rebind workspace_id on Business
         • Revoke Source Reseller Team Access
         • Preserve Merchant Owner & Staff Access
         • Maintain Site Custom Domain & SSL Pointers
         • Terminate Source Reseller Split Contract
         • Reconnect Payment/Direct Gateway
               │
               ▼
          [COMPLETED]
```

### 7.2 The `handover_requests` Schema Specification (PROPOSED)
```sql
CREATE TABLE handover_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    source_workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
    target_workspace_id UUID NULL REFERENCES workspaces(id) ON DELETE RESTRICT, -- NULL for direct owner tier
    target_owner_email VARCHAR(255) NOT NULL,
    target_owner_phone VARCHAR(32) NOT NULL,
    initiated_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    transfer_type VARCHAR(50) NOT NULL, -- 'RESELLER_TO_RESELLER', 'RESELLER_TO_DIRECT', 'DIRECT_TO_RESELLER'
    owner_approval_status VARCHAR(50) NOT NULL DEFAULT 'PENDING_OTP', -- 'PENDING_OTP', 'VERIFIED', 'REJECTED', 'EXPIRED'
    owner_approval_verified_at TIMESTAMPTZ NULL,
    owner_approval_channel VARCHAR(50) NULL, -- 'WHATSAPP_OTP', 'SMS_OTP'
    source_reseller_acknowledged_at TIMESTAMPTZ NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'INITIATED', -- 'INITIATED', 'OWNER_APPROVED', 'COMPLETED', 'CANCELLED', 'EXPIRED', 'DISPUTED'
    domain_reconnection_status VARCHAR(50) NOT NULL DEFAULT 'PRESERVED_ACTIVE',
    payment_reconnection_status VARCHAR(50) NOT NULL DEFAULT 'SPLIT_DECOUPLED',
    transfer_notes TEXT NULL,
    expires_at TIMESTAMPTZ NOT NULL, -- Defaults to NOW() + INTERVAL '72 hours'
    completed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 7.3 Handover Execution Guarantees
1. **Registered Owner Dual-Channel Verification:** Handover cannot execute without cryptographic OTP verification dispatched to the registered business proprietor's phone and email.
2. **Zero Operational Data Loss:** All orders, bills, customers, inventory, and site AST versions remain anchored to `business_id` and are completely untouched during workspace transfer.
3. **Domain Continuity:** The site’s platform domain (`slug.vyapone.in`) and any configured custom domains remain bound to `Site`. DNS and SSL certificates are preserved with zero downtime.
4. **Split Payout Decoupling:** Active split settlement schedules tied to the source reseller (`ClientInvoice`) are immediately severed in the transaction. Future customer payments route 100% to the merchant's direct gateway or bank account.
5. **Membership Revocation:** Source reseller team members are removed from `BusinessMember`; proprietor and staff access remain intact.

---

## 8. Database Design Rules and Type Conventions

### 8.1 Primary Keys: UUIDv7 vs Alternatives (PROPOSED)
- **PostgreSQL 18 Native Function:** In PostgreSQL 18, native `uuidv7()` is built-in:
  ```sql
  id UUID PRIMARY KEY DEFAULT uuidv7()
  ```
- **PostgreSQL 14–17 via Extension:** When deployed on existing PostgreSQL engines (versions 14 through 17), the `pg_uuidv7` extension function is used:
  ```sql
  id UUID PRIMARY KEY DEFAULT uuid_generate_v7()
  ```
- **Application-Layer Generation (Recommended Default for Next.js):** To ensure zero database version dependency and optimal temporal B-tree index locality regardless of database host, UUIDv7 strings are generated by the application server before insertion using RFC 9562-compliant libraries (`uuid` v10+ `uuidv7()`). This retains application-side UUIDv7 as the primary database-independent option without requiring approval or pinning of a specific PostgreSQL database version.
- **PostgreSQL Fallback:** If UUIDv7 is unavailable, `gen_random_uuid()` (standard UUIDv4, native in PostgreSQL 13+) is the approved fallback.

### 8.2 Currency and Financial Representation (PROPOSED)
> **CRITICAL RELATIONAL RULE:**  
> The database MUST NOT assume that all future currencies use 100 minor units per major unit. Every financial entity pairs an exact integer denomination with an ISO 4217 currency code.

- **Integer Minor Units:** All monetary values are stored as 64-bit integers (`BIGINT`) under column names formatted as `amount_minor`, `subtotal_minor`, `tax_total_minor`, `grand_total_minor`, `total_spend_minor`, `udhaar_balance_minor`.
- **Currency Code:** Every monetary table carries `currency_code VARCHAR(3) NOT NULL DEFAULT 'INR'`.
- **Minor Unit Interpretation by ISO 4217 Currency:**
  - 2 Decimals (Factor 100): `INR` (paise), `USD` (cents), `EUR` (cents), `GBP` (pence). ₹150.50 is stored as `15050`.
  - 0 Decimals (Factor 1): `JPY` (yen), `KRW` (won), `VND` (dong). ¥500 is stored as `500`.
  - 3 Decimals (Factor 1000): `KWD` (fils), `BHD` (fils), `OMR` (baisa).
- **AI Micro-Costs:** LLM token and API inference costs are stored in **micro-rupees** (`cost_microrupees BIGINT`) where $1\text{ INR} = 1,000,000\text{ micro-rupees}$ to prevent rounding errors on micro-transactions.

### 8.3 Authentication Identity Separation (PROPOSED)
> **SECURITY INVARIANT:**  
> The application domain model MUST NEVER store user passwords, salt hashes, or secret provider tokens.

- **Profile vs. Credentials:** `User` represents the application profile (`id`, `display_name`, `email`, `phone_number`, `status`, `preferred_language`).
- **Provider Identities:** `UserAuthIdentity` links the application user to external identity providers:
  ```sql
  CREATE TABLE user_auth_identities (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL, -- 'SUPABASE_AUTH', 'PHONE_OTP', 'GOOGLE_OAUTH'
      provider_user_id VARCHAR(255) NOT NULL, -- Subject UID from provider
      identifier VARCHAR(255) NOT NULL, -- E.164 phone or email
      last_sign_in_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT uq_provider_uid UNIQUE (provider, provider_user_id)
  );
  ```
- **Local Staff PINs:** For fast counter terminal unlocking only, `BusinessMember.pin_hash` stores a salted Argon2id/Scrypt hash of a 4-to-6-digit PIN. This is strictly scoped to station switching and is never valid for cloud API authentication.

### 8.4 Customer Phone Integrity and Shared Numbers (PROPOSED)
> **DATA INTEGRITY RULE:**  
> In Indian retail, multiple family members often share a single mobile number, and counter walk-in customers may decline to provide a number. The database MUST NOT enforce a `UNIQUE(business_id, phone_hash)` constraint.

- **Non-Unique Indexing:** Customer phone lookups are supported via a non-unique B-tree index on `(business_id, phone_hash)`:
  ```sql
  CREATE INDEX idx_customers_business_phone ON customers (business_id, phone_hash);
  ```
- **Disambiguation:** If multiple customer records share a phone number under the same business (e.g. Ramesh - Father vs Priya - Daughter), the POS and WhatsApp engines prompt the cashier/customer with a disambiguation picker rather than throwing database duplicate key errors.

### 8.5 Gap-Free Sequential Invoice Numbering (CGST Rule 46) (PROPOSED)
Statutory GST rules require sequential, gap-free numbering per business and financial year across distinct series:
- Tax Invoices: `INV/2026-27/0001` or `POS/2026-27/0001`
- Bills of Supply: `BOS/2026-27/0001`
- Credit Notes: `CRN/2026-27/0001`
- Debit Notes: `DBN/2026-27/0001`

To prevent sequence gaps caused by transaction aborts in standard PostgreSQL sequences, VyapOne utilizes an atomic, row-locking sequence allocation table:

```sql
CREATE TABLE invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    financial_year VARCHAR(10) NOT NULL, -- e.g. '2026-2027'
    series_prefix VARCHAR(10) NOT NULL, -- e.g. 'INV', 'POS', 'CRN', 'BOS'
    current_sequence_number BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_business_fy_series UNIQUE (business_id, financial_year, series_prefix)
);

-- Gap-free allocation inside the bill creation transaction:
UPDATE invoice_sequences
SET current_sequence_number = current_sequence_number + 1,
    updated_at = NOW()
WHERE business_id = $1 AND financial_year = $2 AND series_prefix = $3
RETURNING current_sequence_number;
```
Because `UPDATE ... RETURNING` executes within the bill creation transaction, sequence increments roll back automatically if bill insertion fails, guaranteeing strict gap-free continuity.

### 8.6 Resolution of Ambiguous Foreign Keys (`PaymentRecord`) (PROPOSED)
PRD Section 16 suggested `PaymentRecord.business_id_or_workspace_id`. Polymorphic foreign keys violate relational integrity. We implement two explicit foreign keys protected by an exclusive-OR CHECK constraint:

```sql
CREATE TABLE payment_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NULL REFERENCES workspaces(id) ON DELETE RESTRICT,
    business_id UUID NULL REFERENCES businesses(id) ON DELETE RESTRICT,
    customer_id UUID NULL REFERENCES customers(id) ON DELETE SET NULL,
    purpose VARCHAR(50) NOT NULL, -- 'SUBSCRIPTION', 'ADDON_WALLET', 'ORDER_CHECKOUT', 'BILL_PAYMENT'
    provider VARCHAR(50) NOT NULL, -- 'RAZORPAY', 'CASHFREE', 'MANUAL_UPI', 'CASH'
    provider_reference VARCHAR(255) UNIQUE,
    amount_minor BIGINT NOT NULL,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL, -- 'PENDING', 'CLAIMED', 'RECEIVED', 'PAID', 'FAILED', 'REFUNDED'
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT chk_payment_owner CHECK (
        (workspace_id IS NOT NULL AND business_id IS NULL) OR
        (workspace_id IS NULL AND business_id IS NOT NULL)
    )
);
```

---

## 9. Tenant Security, Context Propagation and RLS (PROPOSED)

### 9.1 Connection Pooling and Context Leakage Prevention (PROPOSED)
In pooled connection environments (PgBouncer in transaction mode or Supavisor), physical database connections are recycled across requests. If tenant context is set using session-level commands (`SET app.current_business_id = '...'`), subsequent queries on that physical connection risk inheriting prior tenant context if not cleared.

**Mandatory Transaction-Scoped Context Rule (`ADR-002`, `ADR-025`):**
Tenant context must strictly be set using transaction-local configuration (`SET LOCAL`):
```sql
BEGIN;
-- SET LOCAL automatically resets upon COMMIT or ROLLBACK
SELECT set_config('app.current_business_id', $1, true); -- true = local to current transaction

-- Query executes under RLS boundary
SELECT * FROM orders WHERE customer_id = $2;
COMMIT;
```
**Application Defense-in-Depth:** Application queries MUST also include explicit `WHERE business_id = $1` filters even when RLS is active.

### 9.2 Storage Isolation (S3 / Cloudflare R2) (PROPOSED)
- **Tenant Path Partitioning:** Every uploaded asset is stored under an immutable tenant prefix:
  `businesses/{business_id}/uploads/{year}/{month}/{file_uuid}.{ext}`
- **Presigned URLs:** Direct-to-storage uploads and private asset downloads utilize time-limited presigned URLs (max 15 minutes TTL).
- **Zero Public Bucket Enumeration:** S3 bucket ACLs disable public listing; all accesses require authenticated API gateway resolution.

### 9.3 Webhook Isolation and Replay Defense (PROPOSED)
- **Signature Verification:** All provider webhooks (Razorpay, Cashfree, Meta WhatsApp, Google) verify HMAC signatures before performing any database read or write.
- **Payload Scoping:** Tenant resolution occurs via verified external IDs (`provider_reference`, metadata `business_id`). Never trust unverified payload parameters.
- **Idempotency Ledger:** Webhook event IDs are stored in a `webhook_events` table with a `UNIQUE(provider, event_id)` constraint to guarantee replay protection.

### 9.4 Background-Job Isolation (BullMQ / Redis) (PROPOSED)
- **Job Envelope:** Every background task carries explicit `business_id` and `workspace_id` in its payload.
- **Worker Context:** Background workers initialize transaction-scoped RLS context (`SET LOCAL app.current_business_id`) before running business logic.
- **Rate Limits & Quiet Hours:** WhatsApp broadcasts and automations evaluate per-business quiet hours (no marketing after 9 PM) and rate caps within the worker.

---

## 10. Data Lifecycle and Statutory Retention (NEEDS CA/LEGAL REVIEW)

| Lifecycle Stage | Trigger Event | State Transition & Data Handling | Statutory Retention Hold |
|---|---|---|---|
| **1. Creation** | Reseller taps "Create Business" | Row inserted into `businesses` with status `DRAFT`. Auto-provisions default `Location` and `Site`. | N/A |
| **2. Activation** | Pre-publish checks pass (`VO-049`) | Status transitions to `LIVE`. Public site accessible via `*.vyapone.in`. | N/A |
| **3. Past Due** | Reseller subscription renewal fails | Status moves to `PAST_DUE`. 15-day active grace period begins; all client sites remain 100% operational (`ADR-013`). | N/A |
| **4. Grace Expiry** | 15 days past due without renewal | Status moves to `SUSPENDED_GRACE`. Site serves read-only holding view; merchant can export customer lists and bills. | Data preserved indefinitely; zero silent deletion. |
| **5. Archival** | Reseller downgrades plan tier | Excess sites transition to `ARCHIVED`. Public URLs un-publish, but all historical bills, orders, and customer records are preserved. | Indefinite retention until explicit owner delete. |
| **6. Handover** | Merchant verifies ownership transfer | Executed via auditable `HandoverRequest`. Historical data moves intact to incoming workspace or direct account (`ADR-013`). | Full audit record preserved in `audit_logs` and `handover_requests`. |
| **7. Export** | Merchant requests data export | Background worker compiles JSON/CSV archive containing all customers, orders, inventory, and PDF GST bills (`VO-124`). | Available for download for 14 days via signed S3 link. |
| **8. DPDP Erasure** | Verified customer erasure request | PII fields in `customers` masked/erased within 30 days (`ADR-015`). | **STATUTORY EXCEPTION (Section 36 of CGST Act 2017):** Books of accounts and tax invoices (`bills`) must be retained for **72 months from the due date of furnishing the annual return (GSTR-9)** for the financial year, subject to statutory extension or proceedings/appeals under Chapter XIX. *(NEEDS CA/LEGAL REVIEW)* |

---

## 11. Architecture Decisions Classification Summary

| Domain Component / Recommendation | Classification | Authority Source / Stakeholder Requirement |
|---|---|---|
| **Platform → Reseller → Business → Location Hierarchy** | `CONFIRMED BY PRD` | `PRD_FINAL_v2_2026-11-03.md` §4.7 |
| **Sovereignty of Business Data (Survives Handover)** | `CONFIRMED BY PRD` | `PRD_FINAL_v2_2026-11-03.md` §4.7 |
| **Multi-Location Operations deferred to Phase 5** | `POST-LAUNCH` | `PRD_FINAL_v2_2026-11-03.md` §22 Phase 5 |
| **Auth-Provider Identity Separation (`UserAuthIdentity`)** | `PROPOSED` | Technical Lead (`ADR-003`, `VO-005`) |
| **1:1 Primary Location table at GA** | `PROPOSED` | Technical Lead (`ADR-002`, `VO-005`) |
| **UUIDv7 with supported runtime fallbacks** | `PROPOSED` | Technical Lead (`ADR-002`, `VO-005`) |
| **`amount_minor` and `currency_code` (ISO 4217)** | `PROPOSED` | Technical Lead (`ADR-009`, `ADR-014`) |
| **Non-Unique Index on Customer Phone** | `PROPOSED` | Technical Lead (`ADR-015`, `VO-080`) |
| **Gap-Free Sequential Invoice Numbering (`invoice_sequences`)** | `PROPOSED` | Technical Lead (`ADR-014`, `VO-081`) |
| **Auditable Handover Records (`handover_requests`)** | `PROPOSED` | Technical Lead (`ADR-013`, `VO-005`) |
| **Dual Non-Polymorphic FKs on `PaymentRecord`** | `PROPOSED` | Technical Lead (`ADR-009`, `VO-005`) |
| **Transaction-Scoped `SET LOCAL` for PostgreSQL RLS** | `PROPOSED` | Technical Lead (`ADR-002`, `ADR-025`) |
| **Storage, Webhook, and Worker Isolation Controls** | `PROPOSED` | Technical Lead (`ADR-003`, `ADR-006`, `ADR-025`) |
| **Handover Dispute Resolution Policy** | `NEEDS PRODUCT APPROVAL` | Product Owner (`ADR-013`, `ADR-021`) |
| **Reseller Split Settlement Provider Contract** | `NEEDS PRODUCT APPROVAL` | Product Owner & Legal (`ADR-010`) |
| **Statutory GST 72-Month Retention vs. DPDP Erasure Policy** | `NEEDS CA/LEGAL REVIEW` | Legal Counsel & Chartered Accountant (`ADR-014`, `ADR-015`) |
