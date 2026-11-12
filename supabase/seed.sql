-- ==============================================================================
-- VyapOne — Local Development & CI Seed Data
-- Seed Script: supabase/seed.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (§4, §16, §17)
-- Architecture: ADR-002, ADR-003, tests/fixtures/demo-seed.ts
--
-- Security Invariants:
--   - STRICTLY FOR LOCAL AND STAGING/TEST ENVIRONMENTS.
--   - All data is synthetic; emails use RFC 2606 reserved .internal domains.
--   - All IDs are valid RFC 4122 v4 UUIDs.
--   - Financial amounts in 64-bit integer minor units.
-- ==============================================================================

-- 1. Users
INSERT INTO public.users (id, display_name, email, phone_number, status, preferred_language)
VALUES
    ('00000000-0000-4000-a000-000000000001', 'VyapOne Platform Admin', 'demo.admin@example.vyapone.internal', '+919800000001', 'active', 'en'),
    ('00000000-0000-4000-a000-000000000002', 'Apex Agency Owner', 'demo.reseller@example.vyapone.internal', '+919800000002', 'active', 'en'),
    ('00000000-0000-4000-a000-000000000003', 'Ramesh Rao', 'ramesh@example.vyapone.internal', '+919800000003', 'active', 'kn'),
    ('00000000-0000-4000-a000-000000000004', 'Pooja Hegde', 'demo.staff@example.vyapone.internal', '+919800000004', 'active', 'kn')
ON CONFLICT (id) DO NOTHING;

-- 2. User Auth Identities
INSERT INTO public.user_auth_identities (id, user_id, provider, identifier, verified_at)
VALUES
    ('00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000002', 'email_password', 'demo.reseller@example.vyapone.internal', now()),
    ('00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000003', 'phone_otp', '+919800000003', now()),
    ('00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000004', 'phone_otp', '+919800000004', now())
ON CONFLICT (id) DO NOTHING;

-- 3. Workspaces (Reseller Tier)
INSERT INTO public.workspaces (id, name, slug, owner_user_id, status, plan)
VALUES
    ('10000000-0000-4000-a000-000000000001', 'Apex Retail Solutions', 'apex-retail', '00000000-0000-4000-a000-000000000002', 'active', 'agency')
ON CONFLICT (id) DO NOTHING;

-- 4. Workspace Members
INSERT INTO public.workspace_members (id, workspace_id, user_id, role, status)
VALUES
    ('11000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', 'reseller_admin', 'active')
ON CONFLICT (id) DO NOTHING;

-- 5. Businesses (Sovereign Data Owner)
INSERT INTO public.businesses (id, workspace_id, legal_name, trade_name, slug, gst_number, pan_number, status, currency_code, sovereign_owner_id)
VALUES
    ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', 'Kaveri Silks and Sarees Private Limited', 'Kaveri Silks & Sarees', 'kaveri-silks', '29AABCK1234F1Z5', 'AABCK1234F', 'active', 'INR', '00000000-0000-4000-a000-000000000003')
ON CONFLICT (id) DO NOTHING;

-- 6. Locations
INSERT INTO public.locations (id, business_id, name, slug, address_line1, city, state, postal_code, is_primary)
VALUES
    ('30000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 'MG Road Flagship Store', 'mg-road', '124 Commercial Plaza, MG Road', 'Bengaluru', 'Karnataka', '560001', true)
ON CONFLICT (id) DO NOTHING;

-- 7. Business Members
INSERT INTO public.business_members (id, business_id, user_id, role, location_id, permissions, status)
VALUES
    ('21000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003', 'owner', '30000000-0000-4000-a000-000000000001', '{"all": true}'::jsonb, 'active'),
    ('21000000-0000-4000-a000-000000000002', '20000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000004', 'staff', '30000000-0000-4000-a000-000000000001', '{"pos": true, "inventory": false}'::jsonb, 'active')
ON CONFLICT (id) DO NOTHING;

-- 8. Sites
INSERT INTO public.sites (id, business_id, primary_domain, subdomain, status)
VALUES
    ('40000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 'kaveri-silks.in', 'kaveri-silks', 'published')
ON CONFLICT (id) DO NOTHING;

-- 9. Catalogue Items (Minor Units: 850000 = ₹8,500.00)
INSERT INTO public.catalogue_items (id, business_id, location_id, title, description, price_minor, currency_code, sku, is_available)
VALUES
    ('50000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', 'Pure Kanchipuram Silk Saree (Gold Zari)', 'Handloom woven pure mulberry silk saree with authentic temple border.', 850000, 'INR', 'SKU-KAV-KAN-001', true)
ON CONFLICT (id) DO NOTHING;

-- 10. Customers
INSERT INTO public.customers (id, business_id, full_name, phone_number, email, total_spend_minor, visits_count)
VALUES
    ('60000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', 'Ananya Sharma', '+919800000005', 'ananya.sharma@example.vyapone.internal', 892500, 1)
ON CONFLICT (id) DO NOTHING;

-- 11. Orders (Total Minor: 850000 = ₹8,500.00)
INSERT INTO public.orders (id, business_id, location_id, customer_id, order_number, status, total_minor, payment_status, currency_code, notes)
VALUES
    ('70000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', '60000000-0000-4000-a000-000000000001', 'ORD-2026-0001', 'completed', 850000, 'paid', 'INR', 'Walk-in boutique counter sale')
ON CONFLICT (id) DO NOTHING;

-- 12. Invoice Sequences
INSERT INTO public.invoice_sequences (id, business_id, financial_year, series_prefix, current_sequence_number)
VALUES
    ('80000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', '2026-27', 'INV', 1)
ON CONFLICT (id) DO NOTHING;

-- 13. Bills (Statutory Invoice: Subtotal ₹8,500, GST 5% ₹425, Total ₹8,925)
INSERT INTO public.bills (id, business_id, location_id, customer_id, order_id, invoice_number, financial_year, amount_minor, tax_minor, total_minor, currency_code, status)
VALUES
    ('90000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', '30000000-0000-4000-a000-000000000001', '60000000-0000-4000-a000-000000000001', '70000000-0000-4000-a000-000000000001', 'INV/2026-27/0001', '2026-27', 850000, 42500, 892500, 'INR', 'paid')
ON CONFLICT (id) DO NOTHING;

-- 14. Audit Logs (Immutable)
INSERT INTO public.audit_logs (id, business_id, workspace_id, user_id, action, resource, metadata_json, ip_address)
VALUES
    ('a0000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000004', 'bill.issued', 'bills/90000000-0000-4000-a000-000000000001', '{"invoice_number": "INV/2026-27/0001", "total_minor": 892500, "source": "pos_counter"}'::jsonb, '127.0.0.1')
ON CONFLICT (id) DO NOTHING;
