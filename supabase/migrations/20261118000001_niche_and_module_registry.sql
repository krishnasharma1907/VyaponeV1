-- ==============================================================================
-- VyapOne — Niche & Module Registry [VO-030]
--
-- Reusable platform foundation defining supported business niches, product modules,
-- niche manifests (onboarding questions, navigation, availability labels),
-- and tenant-scoped module selections with strict plan entitlement separation.
--
-- PRD Authority:
-- - PRD FINAL v2 §7: Supported Business Niches (9 niche groups, availability labels)
-- - PRD FINAL v2 §8: Reusable Product Modules (Platform core, operations, growth)
-- - PRD FINAL v2 §9.1/§9.2: Plan Entitlements & Capacity
-- - PRD FINAL v2 §21.2: Niche Treatment & Operational Verticals
-- ==============================================================================

-- 1. Niche Groups Table (High-Level Industry Verticals)
CREATE TABLE IF NOT EXISTS public.niche_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_niche_groups_status_order ON public.niche_groups (status, display_order);

-- 2. Niches Table (Specific Business Categories with Versioned Manifests)
CREATE TABLE IF NOT EXISTS public.niches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    niche_group_id UUID NOT NULL REFERENCES public.niche_groups(id) ON DELETE RESTRICT,
    slug VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    availability_label VARCHAR(64) NOT NULL DEFAULT 'informational_with_enquiry'
        CHECK (availability_label IN ('live_operational', 'informational_with_enquiry', 'coming_soon')),
    manifest_version VARCHAR(16) NOT NULL DEFAULT 'v1',
    manifest JSONB NOT NULL DEFAULT '{}'::jsonb,
    display_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deprecated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_niches_group_status ON public.niches (niche_group_id, status, display_order);
CREATE INDEX IF NOT EXISTS idx_niches_slug ON public.niches (slug);

-- 3. Platform Modules Table (Reusable Capability Registry)
CREATE TABLE IF NOT EXISTS public.platform_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(64) NOT NULL UNIQUE,
    name VARCHAR(128) NOT NULL,
    description TEXT,
    category VARCHAR(64) NOT NULL DEFAULT 'operations'
        CHECK (category IN ('core', 'operations', 'growth', 'compliance', 'commerce')),
    entitlement_feature_key VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'beta', 'coming_soon', 'deprecated')),
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_platform_modules_category ON public.platform_modules (category, status, display_order);
CREATE INDEX IF NOT EXISTS idx_platform_modules_key ON public.platform_modules (key);

-- 4. Niche-to-Module Mappings Table (Recommended/Default Modules & Presets)
CREATE TABLE IF NOT EXISTS public.niche_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    niche_id UUID NOT NULL REFERENCES public.niches(id) ON DELETE CASCADE,
    module_id UUID NOT NULL REFERENCES public.platform_modules(id) ON DELETE RESTRICT,
    is_default BOOLEAN NOT NULL DEFAULT false,
    is_recommended BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    preset_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (niche_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_niche_modules_lookup ON public.niche_modules (niche_id, is_default, is_recommended);

-- 5. Business Enabled Modules Table (Tenant-Selected Active Capabilities)
CREATE TABLE IF NOT EXISTS public.business_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    module_key VARCHAR(64) NOT NULL REFERENCES public.platform_modules(key) ON DELETE RESTRICT,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    custom_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    enabled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    UNIQUE (business_id, module_key)
);

CREATE INDEX IF NOT EXISTS idx_business_modules_lookup ON public.business_modules (business_id, is_enabled);

-- 6. Connect businesses table to niches table (Optional FK for referential integrity)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'niche_id'
    ) THEN
        ALTER TABLE public.businesses
        ADD COLUMN niche_id UUID REFERENCES public.niches(id) ON DELETE SET NULL;

        CREATE INDEX idx_businesses_niche_id ON public.businesses (niche_id);
    END IF;
END $$;

-- 7. Row-Level Security Configuration
ALTER TABLE public.niche_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.niche_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_modules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.niche_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.niches FORCE ROW LEVEL SECURITY;
ALTER TABLE public.platform_modules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.niche_modules FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_modules FORCE ROW LEVEL SECURITY;

-- Global Platform Registry Tables: Read-Only for Application Users
-- Public/Authenticated users can read active entries; mutation strictly forbidden to clients.
CREATE POLICY "niche_groups_select_policy" ON public.niche_groups
    FOR SELECT
    USING (status != 'inactive' OR auth.role() = 'service_role');

CREATE POLICY "niche_groups_insert_policy" ON public.niche_groups
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "niche_groups_update_policy" ON public.niche_groups
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "niche_groups_delete_policy" ON public.niche_groups
    FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "niches_select_policy" ON public.niches
    FOR SELECT
    USING (status != 'inactive' OR auth.role() = 'service_role');

CREATE POLICY "niches_insert_policy" ON public.niches
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "niches_update_policy" ON public.niches
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "niches_delete_policy" ON public.niches
    FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "platform_modules_select_policy" ON public.platform_modules
    FOR SELECT
    USING (status != 'inactive' OR auth.role() = 'service_role');

CREATE POLICY "platform_modules_insert_policy" ON public.platform_modules
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "platform_modules_update_policy" ON public.platform_modules
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "platform_modules_delete_policy" ON public.platform_modules
    FOR DELETE USING (auth.role() = 'service_role');

CREATE POLICY "niche_modules_select_policy" ON public.niche_modules
    FOR SELECT
    USING (status != 'inactive' OR auth.role() = 'service_role');

CREATE POLICY "niche_modules_insert_policy" ON public.niche_modules
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "niche_modules_update_policy" ON public.niche_modules
    FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "niche_modules_delete_policy" ON public.niche_modules
    FOR DELETE USING (auth.role() = 'service_role');

-- Business Modules Table: Scoped to Sovereign Owner, Business Members, & Parent Workspace Admins
CREATE POLICY "business_modules_select_policy" ON public.business_modules
    FOR SELECT
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_modules.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.business_members bm
                      WHERE bm.business_id = b.id
                        AND bm.user_id = auth.uid()
                        AND bm.status = 'active'
                  ) OR
                  (
                      b.workspace_id IS NOT NULL AND
                      EXISTS (
                          SELECT 1 FROM public.workspace_members wm
                          WHERE wm.workspace_id = b.workspace_id
                            AND wm.user_id = auth.uid()
                            AND wm.status = 'active'
                            AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
                      )
                  )
              )
        )
    );

CREATE POLICY "business_modules_insert_policy" ON public.business_modules
    FOR INSERT
    WITH CHECK (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_modules.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.business_members bm
                      WHERE bm.business_id = b.id
                        AND bm.user_id = auth.uid()
                        AND bm.status = 'active'
                        AND bm.role IN ('owner', 'manager')
                  ) OR
                  (
                      b.workspace_id IS NOT NULL AND
                      EXISTS (
                          SELECT 1 FROM public.workspace_members wm
                          WHERE wm.workspace_id = b.workspace_id
                            AND wm.user_id = auth.uid()
                            AND wm.status = 'active'
                            AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
                      )
                  )
              )
        )
    );

CREATE POLICY "business_modules_update_policy" ON public.business_modules
    FOR UPDATE
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_modules.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.business_members bm
                      WHERE bm.business_id = b.id
                        AND bm.user_id = auth.uid()
                        AND bm.status = 'active'
                        AND bm.role IN ('owner', 'manager')
                  ) OR
                  (
                      b.workspace_id IS NOT NULL AND
                      EXISTS (
                          SELECT 1 FROM public.workspace_members wm
                          WHERE wm.workspace_id = b.workspace_id
                            AND wm.user_id = auth.uid()
                            AND wm.status = 'active'
                            AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
                      )
                  )
              )
        )
    );

CREATE POLICY "business_modules_delete_policy" ON public.business_modules
    FOR DELETE
    USING (
        auth.role() = 'service_role' OR
        EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = business_modules.business_id
              AND (
                  b.sovereign_owner_id = auth.uid() OR
                  EXISTS (
                      SELECT 1 FROM public.business_members bm
                      WHERE bm.business_id = b.id
                        AND bm.user_id = auth.uid()
                        AND bm.status = 'active'
                        AND bm.role IN ('owner', 'manager')
                  ) OR
                  (
                      b.workspace_id IS NOT NULL AND
                      EXISTS (
                          SELECT 1 FROM public.workspace_members wm
                          WHERE wm.workspace_id = b.workspace_id
                            AND wm.user_id = auth.uid()
                            AND wm.status = 'active'
                            AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
                      )
                  )
              )
        )
    );

-- 8. Explicit Privileges
GRANT SELECT ON public.niche_groups, public.niches, public.platform_modules, public.niche_modules TO anon, authenticated;
GRANT ALL ON public.niche_groups, public.niches, public.platform_modules, public.niche_modules TO service_role;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.niche_groups, public.niches, public.platform_modules, public.niche_modules FROM anon, authenticated, PUBLIC;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.business_modules TO authenticated;
GRANT ALL ON public.business_modules TO service_role;
REVOKE ALL ON public.business_modules FROM anon, PUBLIC;

-- 9. Idempotent Canonical Seeds for Niches, Groups, & Modules
-- 9.1 Niche Groups (PRD §7)
INSERT INTO public.niche_groups (slug, name, description, display_order)
VALUES
    ('food_hospitality', 'Food & Hospitality', 'Cafés, restaurants, bakeries, cloud kitchens, and catering', 10),
    ('beauty_wellness_fitness', 'Beauty, Wellness & Fitness', 'Salons, spas, barbers, gyms, and fitness studios', 20),
    ('retail_commerce', 'Retail & Local Commerce', 'Kirana, boutiques, electronics, supermarkets, and local shops', 30),
    ('professional_home_services', 'Professional & Home Services', 'Repair, cleaning, consulting, freelancers, and planners', 40),
    ('automotive_repair', 'Automotive & Repair', 'Garages, washes, detailing studios, tyre, and repair shops', 50),
    ('education', 'Education & Coaching', 'Coaching centres, tutors, training institutes, and classes', 60),
    ('real_estate', 'Real Estate', 'Brokers, developers, rental managers, and property consultants', 70),
    ('operational_rentals', 'Operational Services & Rentals', 'Laundry, tailors, printing, and equipment rentals', 80),
    ('other_business', 'Other Business', 'Custom business models, unique offerings, and niche ventures', 90)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    display_order = EXCLUDED.display_order;

-- 9.2 Platform Modules (PRD §8)
INSERT INTO public.platform_modules (key, name, description, category, entitlement_feature_key, display_order)
VALUES
    ('website_engine', 'Website Engine', 'Structured responsive website pages, approved blocks, theme tokens, and publishing', 'core', 'website_engine', 10),
    ('catalogue_services', 'Catalogue & Services', 'Product and service catalogue, categories, variants, and pricing', 'commerce', 'catalogue_services', 20),
    ('enquiries_leads', 'Enquiries & Lead Management', 'Configurable enquiry forms, contact capture, lead status pipeline, and notes', 'operations', 'enquiries_leads', 30),
    ('orders', 'Order Management', 'Server-validated orders, cart, pickup/delivery/table context, and status updates', 'commerce', 'orders', 40),
    ('appointments', 'Appointments & Scheduling', 'Service durations, staff assignment, schedules, and double-booking prevention', 'operations', 'appointments', 50),
    ('inventory', 'Inventory Tracking', 'Stock levels, low-stock alerts, order-linked inventory adjustments, and audit trail', 'operations', 'inventory', 60),
    ('property_listings', 'Property Listings', 'Sale and rent listings, property attributes, floor plans, filters, and site visits', 'operations', NULL, 70),
    ('qr_management', 'QR Management', 'Permanent dynamic QR codes for storefront, tables, products, and campaign links', 'growth', 'qr_management', 80),
    ('feedback_reviews', 'Feedback & Reviews', 'Private feedback collection and direct Google Review links for honest feedback', 'growth', 'feedback_reviews', 90),
    ('offers_loyalty', 'Offers & Loyalty', 'Coupons, validity windows, festival discounts, and customer loyalty rewards', 'growth', NULL, 100),
    ('analytics', 'Business Analytics', 'Traffic, enquiries, orders, appointment conversion, and source attribution', 'growth', 'analytics', 110),
    ('whatsapp_layer', 'WhatsApp Communication', 'Click-to-chat links, order-to-WhatsApp, bill sharing, and automated alerts', 'growth', NULL, 120),
    ('udhaar_balances', 'Udhaar & Balances', 'Pay-later ledger, customer balance statements, and WhatsApp payment reminders', 'compliance', NULL, 130),
    ('gst_billing', 'GST Invoicing & Bills', 'Gap-free sequential billing, tax calculations, thermal/A4 formats, and credit notes', 'compliance', 'gst_e_invoicing', 140),
    ('customer_broadcasts', 'Customer Directory & Broadcasts', 'Customer profile directory, consent logging, segmenting, and WhatsApp broadcasts', 'growth', 'whatsapp_broadcasts', 150),
    ('automation_engine', 'Automation Engine', 'Automated reminders, review requests, low-stock alerts, and schedule nudges', 'growth', 'smart_ai_bot', 160),
    ('google_business_sync', 'Google Business Sync', 'Synchronize operating hours, address, and reviews with Google Business Profile', 'growth', NULL, 170),
    ('auto_social_posts', 'Auto Social Creatives', 'Brand-templated Instagram posts, WhatsApp statuses, and festival creatives', 'growth', NULL, 180),
    ('delivery_integration', 'Delivery Partner Dispatch', 'Hyperlocal delivery dispatch through Porter, Borzo, and logistics partners', 'operations', NULL, 190),
    ('staff_roles', 'Staff Counter Mode', 'Shared counter terminal mode with PIN switch, attendance, and POS billing', 'operations', NULL, 200),
    ('campaign_pages', 'Campaign & Landing Pages', 'Single-page landing pages with dedicated QR codes and promotional share links', 'growth', NULL, 210)
ON CONFLICT (key) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    entitlement_feature_key = EXCLUDED.entitlement_feature_key,
    display_order = EXCLUDED.display_order;

-- 9.3 Canonical Niches with Versioned Manifests
-- Food & Hospitality Niches
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'restaurant',
    'Restaurant & Dine-in',
    'Full-service dine-in restaurants, multi-cuisine dining, and family eateries',
    'live_operational',
    10,
    '{
        "version": "v1",
        "nicheGroupSlug": "food_hospitality",
        "nicheSlug": "restaurant",
        "name": "Restaurant & Dine-in",
        "availabilityLabel": "live_operational",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "orders", "qr_management", "whatsapp_layer", "feedback_reviews", "gst_billing"],
            "recommended": ["website_engine", "catalogue_services", "orders", "inventory", "qr_management", "feedback_reviews", "offers_loyalty", "analytics", "whatsapp_layer", "gst_billing", "staff_roles"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "cuisine_types", "label": "Cuisine Types", "type": "multiselect", "required": true, "options": ["North Indian", "South Indian", "Chinese", "Mughlai", "Continental", "Street Food", "Beverages"]},
                {"key": "dine_in_tables", "label": "Number of Dining Tables", "type": "number", "required": false},
                {"key": "offers_takeaway", "label": "Do you offer Takeaway / Delivery?", "type": "boolean", "required": true},
                {"key": "has_fssai", "label": "FSSAI License Number", "type": "text", "required": false}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "menu", "label": "Menu & Catalogue", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "orders", "label": "Dine-in & Orders", "href": "/dashboard/orders", "requiredModule": "orders"},
            {"id": "gst_billing", "label": "GST Billing", "href": "/dashboard/billing", "requiredModule": "gst_billing"},
            {"id": "qr_codes", "label": "Table QR Codes", "href": "/dashboard/qr", "requiredModule": "qr_management"},
            {"id": "whatsapp", "label": "WhatsApp Desk", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Storefront", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ],
        "presets": {
            "websiteBlocks": ["hero_restaurant", "menu_highlights", "table_booking_card", "location_hours", "customer_reviews"],
            "suggestedTags": ["Pure Veg", "AC Dining", "Family Friendly", "Home Delivery"],
            "sampleOfferings": ["Special Thali", "Chef Signature Starter", "Beverage Cooler"]
        }
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'food_hospitality'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'cafe',
    'Café & Coffee Shop',
    'Specialty coffee, beverage bars, bakeries, and casual hangouts',
    'live_operational',
    20,
    '{
        "version": "v1",
        "nicheGroupSlug": "food_hospitality",
        "nicheSlug": "cafe",
        "name": "Café & Coffee Shop",
        "availabilityLabel": "live_operational",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "orders", "qr_management", "whatsapp_layer", "feedback_reviews"],
            "recommended": ["website_engine", "catalogue_services", "orders", "qr_management", "offers_loyalty", "whatsapp_layer", "feedback_reviews", "analytics"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "beverage_specialties", "label": "Beverage Specialties", "type": "text", "required": true, "placeholder": "Artisan coffee, bubble tea, matcha"},
                {"key": "has_wifi", "label": "Customer Wi-Fi Available?", "type": "boolean", "required": false},
                {"key": "has_fssai", "label": "FSSAI License Number", "type": "text", "required": false}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "menu", "label": "Café Menu", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "orders", "label": "Counter Orders", "href": "/dashboard/orders", "requiredModule": "orders"},
            {"id": "qr_codes", "label": "QR Standees", "href": "/dashboard/qr", "requiredModule": "qr_management"},
            {"id": "whatsapp", "label": "WhatsApp", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Website", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'food_hospitality'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- Beauty & Wellness Niches
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'salon',
    'Salon & Hair Studio',
    'Hair cutting, beauty parlour, bridal makeup, and grooming studios',
    'live_operational',
    10,
    '{
        "version": "v1",
        "nicheGroupSlug": "beauty_wellness_fitness",
        "nicheSlug": "salon",
        "name": "Salon & Hair Studio",
        "availabilityLabel": "live_operational",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "appointments", "whatsapp_layer", "feedback_reviews"],
            "recommended": ["website_engine", "catalogue_services", "appointments", "whatsapp_layer", "feedback_reviews", "offers_loyalty", "staff_roles", "gst_billing"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "client_gender", "label": "Services Offered For", "type": "select", "required": true, "options": ["Unisex", "Women Only", "Men Only"]},
                {"key": "staff_count", "label": "Number of Stylists / Staff", "type": "number", "required": false},
                {"key": "appointment_advance_hours", "label": "Minimum Advance Booking Notice (Hours)", "type": "number", "required": false}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "services", "label": "Service Menu", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "appointments", "label": "Appointments", "href": "/dashboard/appointments", "requiredModule": "appointments"},
            {"id": "whatsapp", "label": "WhatsApp Reminders", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Website", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'beauty_wellness_fitness'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- Retail & Commerce Niches
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'kirana',
    'Kirana & Grocery Store',
    'Daily essentials, neighbourhood provisions, FMCG, and grocery stores',
    'live_operational',
    10,
    '{
        "version": "v1",
        "nicheGroupSlug": "retail_commerce",
        "nicheSlug": "kirana",
        "name": "Kirana & Grocery Store",
        "availabilityLabel": "live_operational",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "orders", "inventory", "whatsapp_layer", "udhaar_balances", "gst_billing"],
            "recommended": ["website_engine", "catalogue_services", "orders", "inventory", "whatsapp_layer", "udhaar_balances", "gst_billing", "qr_management", "staff_roles"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "home_delivery", "label": "Do you provide Local Home Delivery?", "type": "boolean", "required": true},
                {"key": "min_delivery_order", "label": "Minimum Order Amount for Free Delivery (INR)", "type": "number", "required": false},
                {"key": "has_gstin", "label": "GSTIN (If Registered)", "type": "text", "required": false}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "catalogue", "label": "Products & Stock", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "orders", "label": "Grocery Orders", "href": "/dashboard/orders", "requiredModule": "orders"},
            {"id": "billing", "label": "Fast Counter Bill", "href": "/dashboard/billing", "requiredModule": "gst_billing"},
            {"id": "udhaar", "label": "Udhaar Book", "href": "/dashboard/udhaar", "requiredModule": "udhaar_balances"},
            {"id": "whatsapp", "label": "WhatsApp Alerts", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Storefront", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'retail_commerce'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- Real Estate Niches
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'property_broker',
    'Real Estate Agent & Broker',
    'Residential and commercial property sales, leases, site visits, and consulting',
    'informational_with_enquiry',
    10,
    '{
        "version": "v1",
        "nicheGroupSlug": "real_estate",
        "nicheSlug": "property_broker",
        "name": "Real Estate Agent & Broker",
        "availabilityLabel": "informational_with_enquiry",
        "modules": {
            "defaultEnabled": ["website_engine", "property_listings", "enquiries_leads", "qr_management", "whatsapp_layer"],
            "recommended": ["website_engine", "property_listings", "enquiries_leads", "qr_management", "whatsapp_layer", "analytics", "campaign_pages"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "rera_id", "label": "RERA Registration Number", "type": "text", "required": false},
                {"key": "primary_locations", "label": "Primary Operational Localities / Cities", "type": "text", "required": true, "placeholder": "e.g. Bandra, Andheri, Powai"},
                {"key": "property_types", "label": "Property Specialization", "type": "multiselect", "required": true, "options": ["Residential Apartments", "Villas & Plots", "Commercial Offices", "Retail Shops", "Warehouse"]}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "properties", "label": "Property Listings", "href": "/dashboard/properties", "requiredModule": "property_listings"},
            {"id": "leads", "label": "Buyer Leads", "href": "/dashboard/enquiries", "requiredModule": "enquiries_leads"},
            {"id": "whatsapp", "label": "WhatsApp Desk", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Portal", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'real_estate'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- Professional & Home Services Niches
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'home_cleaning',
    'Home Cleaning & Facility Services',
    'Deep cleaning, sanitization, housekeeping, and commercial maintenance',
    'informational_with_enquiry',
    10,
    '{
        "version": "v1",
        "nicheGroupSlug": "professional_home_services",
        "nicheSlug": "home_cleaning",
        "name": "Home Cleaning & Facility Services",
        "availabilityLabel": "informational_with_enquiry",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "enquiries_leads", "whatsapp_layer"],
            "recommended": ["website_engine", "catalogue_services", "enquiries_leads", "appointments", "whatsapp_layer", "feedback_reviews", "gst_billing"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "service_areas", "label": "Service Areas Covered", "type": "text", "required": true, "placeholder": "e.g. South Delhi, Gurgaon, Noida"},
                {"key": "service_packages", "label": "Key Packages Offered", "type": "text", "required": false}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "services", "label": "Services & Packages", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "leads", "label": "Service Enquiries", "href": "/dashboard/enquiries", "requiredModule": "enquiries_leads"},
            {"id": "whatsapp", "label": "WhatsApp Desk", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Website", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'professional_home_services'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- Automotive & Repair Niches
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'vehicle_garage',
    'Automobile Garage & Workshop',
    'Car & two-wheeler periodic servicing, mechanical repairs, and denting-painting',
    'informational_with_enquiry',
    10,
    '{
        "version": "v1",
        "nicheGroupSlug": "automotive_repair",
        "nicheSlug": "vehicle_garage",
        "name": "Automobile Garage & Workshop",
        "availabilityLabel": "informational_with_enquiry",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "enquiries_leads", "whatsapp_layer", "gst_billing"],
            "recommended": ["website_engine", "catalogue_services", "enquiries_leads", "appointments", "whatsapp_layer", "gst_billing", "feedback_reviews"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "vehicle_categories", "label": "Vehicles Serviced", "type": "multiselect", "required": true, "options": ["Two-Wheelers", "Cars & Sedans", "SUVs", "Commercial Vehicles"]},
                {"key": "offers_breakdown_towing", "label": "24/7 Breakdown Assistance / Towing?", "type": "boolean", "required": false}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "services", "label": "Service Packages", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "service_requests", "label": "Repair Requests", "href": "/dashboard/enquiries", "requiredModule": "enquiries_leads"},
            {"id": "billing", "label": "GST Invoicing", "href": "/dashboard/billing", "requiredModule": "gst_billing"},
            {"id": "whatsapp", "label": "WhatsApp Status", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Website", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'automotive_repair'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- Education Niches
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'coaching_centre',
    'Coaching Centre & Institute',
    'Competitive exam preparation, academic tuition, and skill development classes',
    'informational_with_enquiry',
    10,
    '{
        "version": "v1",
        "nicheGroupSlug": "education",
        "nicheSlug": "coaching_centre",
        "name": "Coaching Centre & Institute",
        "availabilityLabel": "informational_with_enquiry",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "enquiries_leads", "whatsapp_layer"],
            "recommended": ["website_engine", "catalogue_services", "enquiries_leads", "whatsapp_layer", "feedback_reviews", "customer_broadcasts", "gst_billing"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "target_courses", "label": "Target Courses / Classes", "type": "text", "required": true, "placeholder": "Class 9-12 CBSE, JEE, NEET, Banking, UPSC"},
                {"key": "delivery_mode", "label": "Delivery Mode", "type": "select", "required": true, "options": ["Offline Classroom", "Online Live", "Hybrid Mode"]}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "courses", "label": "Courses & Batches", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "admissions", "label": "Admission Leads", "href": "/dashboard/enquiries", "requiredModule": "enquiries_leads"},
            {"id": "broadcasts", "label": "Parent Updates", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Institute Portal", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'education'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- Operational Services & Rentals Niches
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'laundry_dry_cleaner',
    'Laundry & Dry Cleaner',
    'Wash & fold, dry cleaning, steam ironing, and express pick-and-drop',
    'informational_with_enquiry',
    10,
    '{
        "version": "v1",
        "nicheGroupSlug": "operational_rentals",
        "nicheSlug": "laundry_dry_cleaner",
        "name": "Laundry & Dry Cleaner",
        "availabilityLabel": "informational_with_enquiry",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "enquiries_leads", "whatsapp_layer", "gst_billing"],
            "recommended": ["website_engine", "catalogue_services", "orders", "enquiries_leads", "whatsapp_layer", "gst_billing", "feedback_reviews"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "offers_doorstep_pickup", "label": "Doorstep Pickup & Delivery Available?", "type": "boolean", "required": true},
                {"key": "turnaround_hours", "label": "Standard Turnaround Time (Hours)", "type": "number", "required": false}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "rate_card", "label": "Rate Card & Services", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "pickup_requests", "label": "Pickup Requests", "href": "/dashboard/enquiries", "requiredModule": "enquiries_leads"},
            {"id": "billing", "label": "Receipts & GST", "href": "/dashboard/billing", "requiredModule": "gst_billing"},
            {"id": "whatsapp", "label": "WhatsApp Status", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Website", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'operational_rentals'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- Other Business (PRD §7.9)
INSERT INTO public.niches (niche_group_id, slug, name, description, availability_label, display_order, manifest)
SELECT
    g.id,
    'other_business',
    'Other Business',
    'Custom business models, unique offerings, and specialized local services',
    'informational_with_enquiry',
    90,
    '{
        "version": "v1",
        "nicheGroupSlug": "other_business",
        "nicheSlug": "other_business",
        "name": "Other Business",
        "availabilityLabel": "informational_with_enquiry",
        "modules": {
            "defaultEnabled": ["website_engine", "catalogue_services", "enquiries_leads", "whatsapp_layer"],
            "recommended": ["website_engine", "catalogue_services", "enquiries_leads", "qr_management", "whatsapp_layer", "feedback_reviews"]
        },
        "onboarding": {
            "requiredQuestions": [
                {"key": "business_summary", "label": "Describe your business offerings", "type": "text", "required": true, "placeholder": "What products or services do you provide?"},
                {"key": "target_customer_action", "label": "Primary action you want customers to take", "type": "select", "required": true, "options": ["Send an Enquiry", "Call / WhatsApp", "Browse Catalogue", "Visit Store / Office"]}
            ]
        },
        "dashboardNavigation": [
            {"id": "daily_pulse", "label": "Daily Pulse", "href": "/dashboard"},
            {"id": "offerings", "label": "Offerings & Pricing", "href": "/dashboard/catalogue", "requiredModule": "catalogue_services"},
            {"id": "enquiries", "label": "Enquiries & Leads", "href": "/dashboard/enquiries", "requiredModule": "enquiries_leads"},
            {"id": "whatsapp", "label": "WhatsApp Desk", "href": "/dashboard/whatsapp", "requiredModule": "whatsapp_layer"},
            {"id": "website", "label": "Website", "href": "/dashboard/website", "requiredModule": "website_engine"},
            {"id": "settings", "label": "Settings", "href": "/dashboard/settings"}
        ]
    }'::jsonb
FROM public.niche_groups g WHERE g.slug = 'other_business'
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    availability_label = EXCLUDED.availability_label,
    manifest = EXCLUDED.manifest;

-- 9.4 Niche-to-Module Mappings Seed
INSERT INTO public.niche_modules (niche_id, module_id, is_default, is_recommended, display_order)
SELECT n.id, m.id,
    CASE WHEN m.key IN ('website_engine', 'catalogue_services', 'orders', 'qr_management', 'whatsapp_layer', 'feedback_reviews', 'gst_billing') THEN true ELSE false END,
    true,
    m.display_order
FROM public.niches n
CROSS JOIN public.platform_modules m
WHERE n.slug IN ('restaurant', 'cafe')
  AND m.key IN ('website_engine', 'catalogue_services', 'orders', 'inventory', 'qr_management', 'feedback_reviews', 'offers_loyalty', 'analytics', 'whatsapp_layer', 'gst_billing', 'staff_roles')
ON CONFLICT (niche_id, module_id) DO UPDATE SET
    is_default = EXCLUDED.is_default,
    is_recommended = EXCLUDED.is_recommended;

INSERT INTO public.niche_modules (niche_id, module_id, is_default, is_recommended, display_order)
SELECT n.id, m.id,
    CASE WHEN m.key IN ('website_engine', 'catalogue_services', 'appointments', 'whatsapp_layer', 'feedback_reviews') THEN true ELSE false END,
    true,
    m.display_order
FROM public.niches n
CROSS JOIN public.platform_modules m
WHERE n.slug = 'salon'
  AND m.key IN ('website_engine', 'catalogue_services', 'appointments', 'whatsapp_layer', 'feedback_reviews', 'offers_loyalty', 'staff_roles', 'gst_billing')
ON CONFLICT (niche_id, module_id) DO UPDATE SET
    is_default = EXCLUDED.is_default,
    is_recommended = EXCLUDED.is_recommended;

INSERT INTO public.niche_modules (niche_id, module_id, is_default, is_recommended, display_order)
SELECT n.id, m.id,
    CASE WHEN m.key IN ('website_engine', 'catalogue_services', 'orders', 'inventory', 'whatsapp_layer', 'udhaar_balances', 'gst_billing') THEN true ELSE false END,
    true,
    m.display_order
FROM public.niches n
CROSS JOIN public.platform_modules m
WHERE n.slug = 'kirana'
  AND m.key IN ('website_engine', 'catalogue_services', 'orders', 'inventory', 'whatsapp_layer', 'udhaar_balances', 'gst_billing', 'qr_management', 'staff_roles')
ON CONFLICT (niche_id, module_id) DO UPDATE SET
    is_default = EXCLUDED.is_default,
    is_recommended = EXCLUDED.is_recommended;

INSERT INTO public.niche_modules (niche_id, module_id, is_default, is_recommended, display_order)
SELECT n.id, m.id,
    CASE WHEN m.key IN ('website_engine', 'property_listings', 'enquiries_leads', 'qr_management', 'whatsapp_layer') THEN true ELSE false END,
    true,
    m.display_order
FROM public.niches n
CROSS JOIN public.platform_modules m
WHERE n.slug = 'property_broker'
  AND m.key IN ('website_engine', 'property_listings', 'enquiries_leads', 'qr_management', 'whatsapp_layer', 'analytics', 'campaign_pages')
ON CONFLICT (niche_id, module_id) DO UPDATE SET
    is_default = EXCLUDED.is_default,
    is_recommended = EXCLUDED.is_recommended;

INSERT INTO public.niche_modules (niche_id, module_id, is_default, is_recommended, display_order)
SELECT n.id, m.id,
    CASE WHEN m.key IN ('website_engine', 'catalogue_services', 'enquiries_leads', 'whatsapp_layer') THEN true ELSE false END,
    true,
    m.display_order
FROM public.niches n
CROSS JOIN public.platform_modules m
WHERE n.slug IN ('home_cleaning', 'vehicle_garage', 'coaching_centre', 'laundry_dry_cleaner', 'other_business')
  AND m.key IN ('website_engine', 'catalogue_services', 'enquiries_leads', 'appointments', 'orders', 'inventory', 'qr_management', 'feedback_reviews', 'offers_loyalty', 'analytics', 'whatsapp_layer', 'gst_billing', 'customer_broadcasts')
ON CONFLICT (niche_id, module_id) DO UPDATE SET
    is_default = EXCLUDED.is_default,
    is_recommended = EXCLUDED.is_recommended;
