# VyapOne — Website Configuration Schema & Architecture [VO-040]

## 1. Architectural Invariants

In accordance with PRD FINAL v2 (§6.14, §15.3, §16, §17) and VyapOne core architecture:

1. **Assembled Blocks Only, Never Arbitrary Code:**
   AI engines or human editors may decide page layouts, copy, and block ordering, but the output is strictly validated against the approved canonical block component library schema. Raw HTML, executable JavaScript tags, iframe embeds, and unapproved block types are rejected at the server boundary.

2. **Single Source of Truth for Operational Data (Dynamic Bindings):**
   Statutory tax rates, catalogue inventory, service pricing, and store operating hours are server-owned business facts. Prices are **never** hard-coded into the website configuration JSON document. Blocks displaying prices or products dynamically bind via `"source": "catalogue"`.

3. **Immutable Versioning (`public.site_versions`):**
   Every configuration save creates a new sequentially numbered version (`version_number INT > 0`). Historical versions are protected by PostgreSQL database triggers (`prevent_site_version_modification`) that raise an exception if any update or deletion is attempted.

4. **Multi-Tenant Dual-Layer Isolation & RLS:**
   Every site version is explicitly bound to `site_id` and `business_id`. Row-Level Security policies strictly prohibit cross-tenant access. Public visitors can only view published versions of active, published sites.

5. **Referenced Media Security & Private Quarantine (VO-032):**
   Draft website configurations may reference media assets stored in private quarantine. The service verifies tenant ownership before saving. Public bucket exposure is deferred until site publication.

---

## 2. Approved Canonical Component Library (13 Blocks)

PRD FINAL v2 §15.3 explicitly authorizes exactly 13 canonical block types:

| Block Type | Description | Dynamic Bindings / Key Props |
| :--- | :--- | :--- |
| `hero` | Headline, subtitle, primary/secondary CTA, background image | `cta`, `secondaryCta`, `imageMediaId` |
| `about` | Business story, mission, highlights, optional media | `story`, `highlights`, `imageMediaId` |
| `menu` | Food / dining / restaurant structured catalogue listing | Dynamic binding: `source: "catalogue"`, optional `categoryIds` |
| `catalogue_grid` | Product grid with responsive columns (2, 3, or 4) | Dynamic binding: `source: "catalogue"`, `featuredOnly`, `columns` |
| `gallery` | Image gallery with captions and accessibility alt text | Array of `{ mediaId, caption, altText }`, `columns` |
| `booking_form` | Appointment / service booking intake interface | `serviceIds`, `requirePhone`, `notice` |
| `pricing` | Service or package pricing tier presentation | Dynamic binding: `source: "catalogue"`, `highlightCategory` |
| `reviews` | Customer testimonials and verified Google/VyapOne reviews | `source: "google_reviews" \| "verified_reviews" \| "custom"` |
| `offers` | Promotional banners, discount coupon codes, validity dates | Array of `{ headline, description, couponCode, expiresAt }` |
| `location_map` | Store address, map embed, and business hours | Fact reference: `addressRef: "business.primary_location"` |
| `contact` | Phone, WhatsApp, email links, and contact message form | `showPhone`, `showWhatsapp`, `showEmail`, `enableForm` |
| `faq` | Frequently asked questions accordion | Array of `{ question, answer }` |
| `footer` | Copyright notice, social links, powered-by badge, footer links | `showPoweredBy`, `socialLinks`, `links` |

---

## 3. Schema Structure (v1)

```typescript
export interface WebsiteConfiguration {
  schemaVersion: "v1";
  siteId: string;       // UUID referencing public.sites(id)
  businessId: string;   // UUID referencing public.businesses(id)
  presetId?: string;    // e.g. "cafe.bakery.v1" or "general.store.v1"
  metadata: SiteMetadataConfig;
  theme: ThemeConfig;
  header: HeaderConfig;
  footer: FooterBlockProps;
  pages: PageConfig[];
  modules: Record<string, { enabled: boolean; config?: Record<string, unknown> }>;
}
```

### Theme & Design Tokens

Theme definitions conform to VyapOne brand guidelines with pre-calibrated palettes:

- **`emerald-marigold` (Default):**
  - Primary: `#0B6E4F` (Forest Emerald)
  - Accent: `#F5A524` (Golden Marigold)
  - Secondary: `#1B4965` (Deep Navy)
  - Typography: Heading `Inter`, Body `Inter`
  - Radii: Button `md`, Card `md`
- **`warm-terracotta`:**
  - Primary: `#C84B31` (Terracotta)
  - Accent: `#E9B824` (Ochre Gold)
  - Secondary: `#2D4263` (Slate Indigo)
  - Typography: Heading `Plus Jakarta Sans`, Body `Plus Jakarta Sans`
  - Radii: Button `sm`, Card `sm`

---

## 4. Database Model & Migrations (`20261119000003` & `20261119000004`)

### `public.site_versions` Table & Composite Integrity Constraints (Audit B)

```sql
CREATE TABLE public.site_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES public.sites(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  version_number INT NOT NULL CHECK (version_number > 0),
  schema_version TEXT NOT NULL DEFAULT 'v1',
  configuration JSONB NOT NULL,
  change_summary TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  published_at TIMESTAMPTZ,
  CONSTRAINT uq_site_versions_site_version UNIQUE (site_id, version_number)
);

-- Composite Relationship Integrity (Audit B):
-- 1. Sites composite uniqueness
ALTER TABLE public.sites ADD CONSTRAINT uq_sites_id_business_id UNIQUE (id, business_id);

-- 2. Versions composite foreign key ensuring version business strictly matches site business
ALTER TABLE public.site_versions ADD CONSTRAINT fk_site_versions_site_business
  FOREIGN KEY (site_id, business_id) REFERENCES public.sites(id, business_id) ON DELETE CASCADE;

-- 3. Version site composite uniqueness
ALTER TABLE public.site_versions ADD CONSTRAINT uq_site_versions_site_id_id UNIQUE (site_id, id);

-- 4. Sites pointer composite foreign keys guaranteeing pointers reference versions of the SAME site
ALTER TABLE public.sites ADD CONSTRAINT fk_sites_current_draft_version
  FOREIGN KEY (id, current_draft_version_id) REFERENCES public.site_versions(site_id, id) ON DELETE SET NULL;

ALTER TABLE public.sites ADD CONSTRAINT fk_sites_published_version
  FOREIGN KEY (id, published_version_id) REFERENCES public.site_versions(site_id, id) ON DELETE SET NULL;
```

### Pointer Privilege Restrictions (Audit C)

Direct client column-level `UPDATE` and `INSERT` privileges on `current_draft_version_id` and `published_version_id` are revoked from `authenticated`, `anon`, and `PUBLIC`:
```sql
REVOKE UPDATE (current_draft_version_id, published_version_id) ON public.sites FROM authenticated, anon, PUBLIC;
REVOKE INSERT (current_draft_version_id, published_version_id) ON public.sites FROM authenticated, anon, PUBLIC;
```
Version pointers can only be updated via authorized server-controlled transactions.

### Hardened Version Immutability & Lifecycle Trigger (Audit D)

An explicit `BEFORE UPDATE OR DELETE` PostgreSQL trigger (`trg_prevent_site_version_modification` on `prevent_site_version_modification()`) enforces:
1. Core configuration and metadata immutability: Rejects any update to `site_id`, `business_id`, `version_number`, `schema_version`, `configuration`, `created_at`, `created_by`, or `change_summary`.
2. Lifecycle control: Only permits a one-way transition of `published_at` from `NULL` to non-null during publication.
3. Deletion safeguards: Prohibits deleting published versions or versions actively referenced as `current_draft_version_id` or `published_version_id`.

---

## 5. Security & Transactional Architecture (Audit A, E, F, G)

1. **RPC Service Role Revocation (Audit Preflight):**
   `REVOKE EXECUTE ... FROM service_role` is enforced on `create_business_with_setup_atomic` and `confirm_business_import_atomic`, preventing service-role caller spoofing and ensuring all writes authenticate via verified sessions (`auth.uid()`).

2. **Atomic Draft Save Transaction (`save_site_draft_configuration_atomic`):**
   Draft creation executes inside a genuine PostgreSQL transaction via `save_site_draft_configuration_atomic`:
   - **Row Locking (`FOR UPDATE OF s`):** Row-locks `public.sites` to serialize concurrent draft saves for the same site and prevent version numbering race conditions.
   - **Caller Identity Verification:** Validates `auth.uid() = p_caller_user_id` and confirms the caller user record exists in `public.users`.
   - **Business Authorization:** Enforces `public.can_manage_business(p_business_id, p_caller_user_id)`.
   - **Media Readiness & Category Verification (Audit E):** Verifies all referenced media items have `status = 'ready'`, `verified_at IS NOT NULL`, belong to the target tenant, and belong to approved website categories (`business_logo`, `catalogue_image`, `website_asset`, `onboarding_upload`). Unverified or quarantine documents are rejected.
   - **Atomic Insertion & Pointer Update:** Atomically increments version number, inserts into `public.site_versions`, updates `sites.current_draft_version_id`, and writes an audit event to `public.audit_logs` (`site.version_created`).
   - **Grants:** `SECURITY DEFINER`, `search_path = ''`, owned by `postgres`, revoked from `PUBLIC, anon, service_role`, granted to `authenticated`.

3. **Least Privilege Grants on `site_versions`:**
   - `PUBLIC` and `anon`: Revoked all default privileges.
   - `anon`: `SELECT` permitted only on published versions of published sites.
   - `authenticated`: `SELECT`, `INSERT`, and `DELETE` (un-published drafts only) governed by RLS.

---

## 6. Versioning & Migration Engine

The versioning subsystem (`src/lib/websites/versioning.ts`) guarantees forward compatibility:

- `detectConfigurationVersion(doc)` detects schema version (`v1`).
- `isSupportedSchemaVersion(version)` verifies engine compatibility.
- `migrateWebsiteConfiguration(doc)` applies deterministic transformations to normalize legacy or evolving configurations into the active standard.

---

## 7. Service Operations & Server Actions

- `getSiteByBusinessId(supabase, businessId)`: Resolves site record with tenant verification.
- `getSiteById(supabase, siteId)`: Resolves site record by ID with business ownership authorization.
- `getSiteVersions(supabase, siteId)`: Lists all versions in descending sequence.
- `getSiteConfiguration(supabase, siteId, versionNumber?)`: Retrieves and schema-validates configuration.
- `saveSiteDraftConfiguration(supabase, callerUserId, input)`: Atomically validates input, checks tenant media isolation, calculates the next version number, inserts immutable record, updates site draft pointer, and logs `site.version_created` audit event.
- Server Actions:
  - `getSiteAction(businessId)`
  - `getSiteConfigurationAction(siteId, versionNumber?)`
  - `saveSiteDraftConfigurationAction(input)` (triggers Next.js cache revalidation on `/dashboard/website` and `/workspace/clients`).
