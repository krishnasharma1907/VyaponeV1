-- ==============================================================================
-- VyapOne â€” Core Database Schema Migration
-- Migration: 20261112000001_initial_schema.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (Â§4, Â§15, Â§16, Â§17)
-- Architecture: ADR-002, ADR-003, docs/DATABASE_ARCHITECTURE.md
-- Domain Model: docs/diagrams/core-erd.mmd, src/lib/supabase/types.ts
--
-- Tenancy Invariant:
--   Platform -> Reseller Workspace -> Business (Sovereign Owner) -> Location
--
-- Security Invariants:
--   1. All primary keys are UUID (gen_random_uuid())
--   2. All monetary amounts are 64-bit integer minor units (BIGINT)
--   3. All tenant tables have Row-Level Security enabled (DEFAULT DENY)
--   4. Audit logs are append-only and immutable
--   5. Gap-free sequential invoices use atomic transaction-safe counters
-- ==============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Generic Trigger Function for Automatic `updated_at` Timestamps
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 3. Users Table (Identity & Profile)
-- ------------------------------------------------------------------------------
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone_number TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'pending_verification')),
    preferred_language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_users_updated_at
    BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 4. User Auth Identities Table (Delegated Authentication Providers)
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_auth_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('phone_otp', 'email_password', 'google')),
    identifier TEXT NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_auth_identities_provider_identifier_key UNIQUE (provider, identifier)
);

CREATE INDEX idx_user_auth_identities_user_id ON public.user_auth_identities (user_id);
ALTER TABLE public.user_auth_identities ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 5. Workspaces Table (Reseller / Agency Tenancy Scope)
-- ------------------------------------------------------------------------------
CREATE TABLE public.workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    owner_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'archived')),
    plan TEXT NOT NULL DEFAULT 'starter' CHECK (plan IN ('starter', 'pro', 'agency')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON public.workspaces
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_workspaces_owner_user_id ON public.workspaces (owner_user_id);
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 6. Workspace Members Table (Reseller Staff & Access Control)
-- ------------------------------------------------------------------------------
CREATE TABLE public.workspace_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('reseller_admin', 'reseller_staff')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'deactivated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT workspace_members_workspace_user_key UNIQUE (workspace_id, user_id)
);

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members (workspace_id);
CREATE INDEX idx_workspace_members_user_id ON public.workspace_members (user_id);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 7. Businesses Table (The Sovereign Data Entity)
-- ------------------------------------------------------------------------------
CREATE TABLE public.businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE RESTRICT,
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    gst_number TEXT,
    pan_number TEXT,
    status TEXT NOT NULL DEFAULT 'onboarding' CHECK (status IN ('active', 'onboarding', 'suspended', 'archived')),
    currency_code TEXT NOT NULL DEFAULT 'INR',
    sovereign_owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_businesses_updated_at
    BEFORE UPDATE ON public.businesses
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_businesses_workspace_id ON public.businesses (workspace_id);
CREATE INDEX idx_businesses_sovereign_owner_id ON public.businesses (sovereign_owner_id);
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 8. Locations Table (Physical / Operational Storefronts)
-- ------------------------------------------------------------------------------
CREATE TABLE public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    postal_code TEXT NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT locations_business_slug_key UNIQUE (business_id, slug)
);

CREATE TRIGGER trg_locations_updated_at
    BEFORE UPDATE ON public.locations
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_locations_business_id ON public.locations (business_id);
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 9. Business Members Table (Operational Staff & Permissions)
-- ------------------------------------------------------------------------------
CREATE TABLE public.business_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'staff')),
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'deactivated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT business_members_business_user_key UNIQUE (business_id, user_id)
);

CREATE INDEX idx_business_members_business_id ON public.business_members (business_id);
CREATE INDEX idx_business_members_user_id ON public.business_members (user_id);
CREATE INDEX idx_business_members_location_id ON public.business_members (location_id);
ALTER TABLE public.business_members ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 10. Sites Table (Published Web Storefronts)
-- ------------------------------------------------------------------------------
CREATE TABLE public.sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    primary_domain TEXT UNIQUE,
    subdomain TEXT NOT NULL UNIQUE,
    published_version_id UUID,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_sites_updated_at
    BEFORE UPDATE ON public.sites
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_sites_business_id ON public.sites (business_id);
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 11. Catalogue Items Table (Products, Services, Menu Items)
-- ------------------------------------------------------------------------------
CREATE TABLE public.catalogue_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    price_minor BIGINT NOT NULL CHECK (price_minor >= 0),
    currency_code TEXT NOT NULL DEFAULT 'INR',
    tax_rate_id UUID,
    sku TEXT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_catalogue_items_updated_at
    BEFORE UPDATE ON public.catalogue_items
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_catalogue_items_business_id ON public.catalogue_items (business_id);
CREATE INDEX idx_catalogue_items_business_created ON public.catalogue_items (business_id, created_at DESC);
ALTER TABLE public.catalogue_items ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 12. Customers Table (Sovereign Business Customer Registry)
-- ------------------------------------------------------------------------------
CREATE TABLE public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    email TEXT,
    total_spend_minor BIGINT NOT NULL DEFAULT 0 CHECK (total_spend_minor >= 0),
    visits_count INTEGER NOT NULL DEFAULT 0 CHECK (visits_count >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT customers_business_phone_key UNIQUE (business_id, phone_number)
);

CREATE TRIGGER trg_customers_updated_at
    BEFORE UPDATE ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_customers_business_id ON public.customers (business_id);
CREATE INDEX idx_customers_business_created ON public.customers (business_id, created_at DESC);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 13. Orders Table (Commerce Transactions & POS Lifecycle)
-- ------------------------------------------------------------------------------
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled')),
    total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
    payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'claimed', 'received', 'paid', 'failed', 'refunded')),
    currency_code TEXT NOT NULL DEFAULT 'INR',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT orders_business_order_number_key UNIQUE (business_id, order_number)
);

CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_orders_business_id ON public.orders (business_id);
CREATE INDEX idx_orders_business_created ON public.orders (business_id, created_at DESC);
CREATE INDEX idx_orders_location_id ON public.orders (location_id);
CREATE INDEX idx_orders_customer_id ON public.orders (customer_id);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 14. Invoice Sequences Table (Gap-Free Statutory Invoice Numbers)
-- ------------------------------------------------------------------------------
CREATE TABLE public.invoice_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    financial_year TEXT NOT NULL,
    series_prefix TEXT NOT NULL DEFAULT 'INV',
    current_sequence_number BIGINT NOT NULL DEFAULT 0 CHECK (current_sequence_number >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT invoice_sequences_business_fy_prefix_key UNIQUE (business_id, financial_year, series_prefix)
);

CREATE TRIGGER trg_invoice_sequences_updated_at
    BEFORE UPDATE ON public.invoice_sequences
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_invoice_sequences_business_id ON public.invoice_sequences (business_id);
ALTER TABLE public.invoice_sequences ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 15. Bills Table (Statutory Tax Invoices & Payment Verification)
-- ------------------------------------------------------------------------------
CREATE TABLE public.bills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    invoice_number TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    amount_minor BIGINT NOT NULL CHECK (amount_minor >= 0),
    tax_minor BIGINT NOT NULL DEFAULT 0 CHECK (tax_minor >= 0),
    total_minor BIGINT NOT NULL CHECK (total_minor >= 0),
    currency_code TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT bills_business_invoice_key UNIQUE (business_id, invoice_number)
);

CREATE TRIGGER trg_bills_updated_at
    BEFORE UPDATE ON public.bills
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_bills_business_id ON public.bills (business_id);
CREATE INDEX idx_bills_business_created ON public.bills (business_id, created_at DESC);
CREATE INDEX idx_bills_order_id ON public.bills (order_id);
CREATE INDEX idx_bills_customer_id ON public.bills (customer_id);
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------------------------
-- 16. Audit Logs Table (Immutable Audit Trail)
-- ------------------------------------------------------------------------------
CREATE TABLE public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    resource TEXT NOT NULL,
    metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Note: No updated_at trigger for audit_logs; records are strictly append-only.
CREATE INDEX idx_audit_logs_business_id ON public.audit_logs (business_id);
CREATE INDEX idx_audit_logs_workspace_id ON public.audit_logs (workspace_id);
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs (user_id);
CREATE INDEX idx_audit_logs_business_created ON public.audit_logs (business_id, created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
-- ==============================================================================
-- VyapOne â€” Auth Profile & Identity Linking Trigger
-- Migration: 20261112000002_auth_profile_trigger.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (Â§4, Â§16, Â§17)
-- Task: VO-021
--
-- Security Invariants:
--   1. Trigger runs with SECURITY DEFINER to bridge auth.users to public.users
--   2. Explicit search_path = public, auth prevents search path hijacking
--   3. No passwords, tokens, or raw credentials duplicated into public tables
--   4. Idempotent ON CONFLICT handling protects against duplicate insert crashes
-- ==============================================================================

-- 1. Create Profile Bootstrap Function
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_preferred_lang TEXT;
BEGIN
    -- Extract display name from user metadata or fallback cleanly
    v_display_name := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'display_name'), ''),
        NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
        NULLIF(TRIM(split_part(NEW.email, '@', 1)), ''),
        NULLIF(TRIM(NEW.phone), ''),
        'VyapOne User'
    );

    v_preferred_lang := COALESCE(
        NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_language'), ''),
        'en'
    );

    -- Insert or update user record in public.users matching auth.users.id
    INSERT INTO public.users (
        id,
        display_name,
        email,
        phone_number,
        status,
        preferred_language,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_display_name,
        NEW.email,
        NEW.phone,
        'active',
        v_preferred_lang,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, public.users.email),
        phone_number = COALESCE(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = now();

    -- Insert or update identity record in public.user_auth_identities
    IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
        INSERT INTO public.user_auth_identities (
            user_id,
            provider,
            identifier,
            verified_at,
            created_at
        )
        VALUES (
            NEW.id,
            'phone_otp',
            NEW.phone,
            NEW.phone_confirmed_at,
            now()
        )
        ON CONFLICT (provider, identifier) DO UPDATE SET
            verified_at = EXCLUDED.verified_at;
    END IF;

    IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
        INSERT INTO public.user_auth_identities (
            user_id,
            provider,
            identifier,
            verified_at,
            created_at
        )
        VALUES (
            NEW.id,
            'email_password',
            NEW.email,
            NEW.email_confirmed_at,
            now()
        )
        ON CONFLICT (provider, identifier) DO UPDATE SET
            verified_at = EXCLUDED.verified_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

-- 2. Create Trigger on auth.users (Executed when Supabase Auth creates a user)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'on_auth_user_created'
    ) THEN
        CREATE TRIGGER on_auth_user_created
            AFTER INSERT OR UPDATE ON auth.users
            FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();
    END IF;
END $$;
-- ==============================================================================
-- VyapOne â€” Secure Search Path & Workspace Roles Expansion
-- Migration: 20261112000003_secure_search_path_and_workspace_roles.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (Â§4, Â§16, Â§17)
-- Task: VO-022
--
-- Security Invariants:
--   1. Re-define handle_new_auth_user() with SET search_path = '' and fully qualified
--      pg_catalog and public references to eliminate search path hijacking.
--   2. Expand workspace_members role constraint to support canonical workspace roles:
--      'workspace_owner', 'workspace_admin', 'workspace_member' alongside backwards-
--      compatible 'reseller_admin' and 'reseller_staff'.
--   3. Create public.workspace_invitations with secure token hashes, expiry, and RLS.
-- ==============================================================================

-- 1. Redefine handle_new_auth_user with SET search_path = '' and schema-qualified references
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_preferred_lang TEXT;
BEGIN
    -- Extract display name from user metadata or fallback cleanly using pg_catalog
    v_display_name := pg_catalog.coalesce(
        pg_catalog.nullif(pg_catalog.trim(NEW.raw_user_meta_data->>'display_name'), ''),
        pg_catalog.nullif(pg_catalog.trim(NEW.raw_user_meta_data->>'full_name'), ''),
        pg_catalog.nullif(pg_catalog.trim(pg_catalog.split_part(NEW.email, '@', 1)), ''),
        pg_catalog.nullif(pg_catalog.trim(NEW.phone), ''),
        'VyapOne User'
    );

    v_preferred_lang := pg_catalog.coalesce(
        pg_catalog.nullif(pg_catalog.trim(NEW.raw_user_meta_data->>'preferred_language'), ''),
        'en'
    );

    -- Insert or update user record in public.users matching auth.users.id
    INSERT INTO public.users (
        id,
        display_name,
        email,
        phone_number,
        status,
        preferred_language,
        created_at,
        updated_at
    )
    VALUES (
        NEW.id,
        v_display_name,
        NEW.email,
        NEW.phone,
        'active',
        v_preferred_lang,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = pg_catalog.coalesce(EXCLUDED.email, public.users.email),
        phone_number = pg_catalog.coalesce(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = pg_catalog.now();

    -- Insert or update identity record in public.user_auth_identities
    IF NEW.phone IS NOT NULL AND NEW.phone <> '' THEN
        INSERT INTO public.user_auth_identities (
            user_id,
            provider,
            identifier,
            verified_at,
            created_at
        )
        VALUES (
            NEW.id,
            'phone_otp',
            NEW.phone,
            NEW.phone_confirmed_at,
            pg_catalog.now()
        )
        ON CONFLICT (provider, identifier) DO UPDATE SET
            verified_at = EXCLUDED.verified_at;
    END IF;

    IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
        INSERT INTO public.user_auth_identities (
            user_id,
            provider,
            identifier,
            verified_at,
            created_at
        )
        VALUES (
            NEW.id,
            'email_password',
            NEW.email,
            NEW.email_confirmed_at,
            pg_catalog.now()
        )
        ON CONFLICT (provider, identifier) DO UPDATE SET
            verified_at = EXCLUDED.verified_at;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 2. Expand role check constraint on public.workspace_members
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_role_check
    CHECK (role IN ('workspace_owner', 'workspace_admin', 'workspace_member', 'reseller_admin', 'reseller_staff'));

-- 3. Create public.workspace_invitations table for secure invitation lifecycle
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('workspace_owner', 'workspace_admin', 'workspace_member', 'reseller_admin', 'reseller_staff')),
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_workspace_id ON public.workspace_invitations (workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations (email);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token_hash ON public.workspace_invitations (token_hash);
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;
-- ==============================================================================
-- VyapOne â€” Database Migration 20261113000001
-- Task ID: VO-023 â€” Implement business and location core
-- Scope:
--   1. Allow DIY businesses by making businesses.workspace_id nullable.
--   2. Enforce single primary location invariant per business.
--   3. Create atomic business + primary location + initial owner bootstrap function.
-- ==============================================================================

-- 1. Support DIY businesses: make workspace_id NULLABLE in public.businesses
-- Direct business owners can establish a sovereign business without a reseller workspace.
ALTER TABLE public.businesses
    ALTER COLUMN workspace_id DROP NOT NULL;

-- 2. Enforce exactly one primary location per business via partial unique index
CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_primary_per_business
    ON public.locations (business_id)
    WHERE is_primary = true;

-- 3. Atomic business bootstrap function (SECURITY DEFINER with secure search_path)
-- Creates business, primary location, and initial owner membership in a single transaction.
CREATE OR REPLACE FUNCTION public.create_business_with_primary_location(
    p_legal_name TEXT,
    p_trade_name TEXT,
    p_slug TEXT,
    p_location_name TEXT,
    p_address_line1 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_postal_code TEXT,
    p_workspace_id UUID DEFAULT NULL,
    p_gst_number TEXT DEFAULT NULL,
    p_pan_number TEXT DEFAULT NULL,
    p_address_line2 TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_business_id UUID;
    v_location_id UUID;
    v_member_id UUID;
    v_location_slug TEXT;
BEGIN
    -- 1. Derive caller identity strictly from auth.uid()
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'UNAUTHENTICATED: Caller must be authenticated to create a business'
            USING ERRCODE = '42501';
    END IF;

    -- 2. If workspace_id is provided, verify caller has active management role in workspace
    IF p_workspace_id IS NOT NULL THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = p_workspace_id
              AND user_id = v_caller_id
              AND status = 'active'
              AND role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
        ) THEN
            RAISE EXCEPTION 'UNAUTHORIZED: Caller does not have management permission in the specified workspace'
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 3. Check for business slug collision
    IF EXISTS (SELECT 1 FROM public.businesses WHERE slug = p_slug) THEN
        RAISE EXCEPTION 'SLUG_CONFLICT: A business with slug "%" already exists', p_slug
            USING ERRCODE = '23505';
    END IF;

    -- 4. Insert business record with caller as sovereign_owner_id
    INSERT INTO public.businesses (
        workspace_id,
        legal_name,
        trade_name,
        slug,
        gst_number,
        pan_number,
        status,
        currency_code,
        sovereign_owner_id
    ) VALUES (
        p_workspace_id,
        p_legal_name,
        p_trade_name,
        p_slug,
        p_gst_number,
        p_pan_number,
        'onboarding',
        'INR',
        v_caller_id
    )
    RETURNING id INTO v_business_id;

    -- 5. Insert primary location for the business
    v_location_slug := 'main';
    INSERT INTO public.locations (
        business_id,
        name,
        slug,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        is_primary
    ) VALUES (
        v_business_id,
        p_location_name,
        v_location_slug,
        p_address_line1,
        p_address_line2,
        p_city,
        p_state,
        p_postal_code,
        true
    )
    RETURNING id INTO v_location_id;

    -- 6. Insert initial business owner membership
    INSERT INTO public.business_members (
        business_id,
        user_id,
        role,
        location_id,
        permissions,
        status
    ) VALUES (
        v_business_id,
        v_caller_id,
        'owner',
        v_location_id,
        '{"can_bill": true, "can_manage_catalogue": true, "can_view_reports": true, "can_edit_settings": true}'::jsonb,
        'active'
    )
    RETURNING id INTO v_member_id;

    -- 7. Record append-only audit log
    INSERT INTO public.audit_logs (
        business_id,
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json
    ) VALUES (
        v_business_id,
        p_workspace_id,
        v_caller_id,
        'business.created',
        'businesses',
        pg_catalog.jsonb_build_object(
            'trade_name', p_trade_name,
            'slug', p_slug,
            'primary_location_id', v_location_id,
            'workspace_id', p_workspace_id
        )
    );

    RETURN pg_catalog.jsonb_build_object(
        'business_id', v_business_id,
        'location_id', v_location_id,
        'member_id', v_member_id,
        'slug', p_slug
    );
END;
$$;

-- Restrict function execution to authenticated callers only
REVOKE EXECUTE ON FUNCTION public.create_business_with_primary_location FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_business_with_primary_location TO authenticated;
-- ==============================================================================
-- VyapOne â€” Database Migration 20261113000002
-- Task ID: VO-024 â€” Enforce tenant isolation at database and API layers
-- Scope:
--   1. Create hardened SECURITY DEFINER helper functions with search_path = ''
--      to prevent policy recursion and safely evaluate tenancy boundaries.
--   2. Enforce FORCE ROW LEVEL SECURITY across all 15 tenant tables.
--   3. Define explicit fail-closed SELECT, INSERT, UPDATE, DELETE policies for all tables.
--   4. Guard against cross-tenant record tampering, moving records, and ID guessing.
--   5. Add supporting lookup indexes for RLS evaluation paths.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Helper Functions (SECURITY DEFINER with SET search_path = '')
-- ------------------------------------------------------------------------------

-- 1.1 Evaluates active workspace membership without RLS recursion
CREATE OR REPLACE FUNCTION public.is_workspace_member(
    p_workspace_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_workspace_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = p_user_id
          AND status = 'active'
    );
END;
$$;

-- 1.2 Evaluates workspace administration/ownership
CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(
    p_workspace_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_workspace_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Workspace record owner
    IF EXISTS (
        SELECT 1
        FROM public.workspaces
        WHERE id = p_workspace_id
          AND owner_user_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Active member with administrative role
    RETURN EXISTS (
        SELECT 1
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND user_id = p_user_id
          AND status = 'active'
          AND role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
    );
END;
$$;

-- 1.3 Evaluates sovereign business ownership (anchored strictly to businesses.sovereign_owner_id)
CREATE OR REPLACE FUNCTION public.is_business_sovereign_owner(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    RETURN EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    );
END;
$$;

-- 1.4 Evaluates active business membership (sovereign owner OR active business_member)
CREATE OR REPLACE FUNCTION public.is_business_member(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Sovereign owner always holds member authority
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Active business member
    RETURN EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
    );
END;
$$;

-- 1.5 Evaluates business management authority (owner or manager role)
CREATE OR REPLACE FUNCTION public.is_business_owner_or_manager(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Sovereign owner always has management authority
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Active business member with owner or manager role
    RETURN EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
          AND role IN ('owner', 'manager')
    );
END;
$$;

-- 1.6 Evaluates business access across sovereign owner, business member, and assigned reseller workspace
CREATE OR REPLACE FUNCTION public.can_access_business(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ws_id UUID;
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Sovereign owner
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Business member
    IF EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
    ) THEN
        RETURN TRUE;
    END IF;

    -- 3. Reseller workspace member (if business is linked to a workspace)
    SELECT workspace_id INTO v_ws_id
    FROM public.businesses
    WHERE id = p_business_id;

    IF v_ws_id IS NOT NULL THEN
        RETURN public.is_workspace_member(v_ws_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- 1.7 Evaluates management access across business and reseller workspace
CREATE OR REPLACE FUNCTION public.can_manage_business(
    p_business_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_ws_id UUID;
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Sovereign owner
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = p_business_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Business owner or manager
    IF EXISTS (
        SELECT 1
        FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
          AND role IN ('owner', 'manager')
    ) THEN
        RETURN TRUE;
    END IF;

    -- 3. Reseller workspace admin/owner
    SELECT workspace_id INTO v_ws_id
    FROM public.businesses
    WHERE id = p_business_id;

    IF v_ws_id IS NOT NULL THEN
        RETURN public.is_workspace_admin_or_owner(v_ws_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- 1.8 Evaluates location access according to staff location scoping
CREATE OR REPLACE FUNCTION public.can_access_location(
    p_location_id UUID,
    p_user_id UUID DEFAULT auth.uid()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_biz_id UUID;
    v_member_loc UUID;
    v_member_role TEXT;
    v_ws_id UUID;
BEGIN
    IF p_location_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Retrieve the owning business ID for the location
    SELECT business_id INTO v_biz_id
    FROM public.locations
    WHERE id = p_location_id;

    IF v_biz_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 1. Sovereign owner
    IF EXISTS (
        SELECT 1
        FROM public.businesses
        WHERE id = v_biz_id
          AND sovereign_owner_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- 2. Check business member role and location assignment
    SELECT role, location_id INTO v_member_role, v_member_loc
    FROM public.business_members
    WHERE business_id = v_biz_id
      AND user_id = p_user_id
      AND status = 'active';

    IF FOUND THEN
        -- Owners and managers have all-location access across the business
        IF v_member_role IN ('owner', 'manager') THEN
            RETURN TRUE;
        END IF;

        -- Operational staff/cashiers: access granted if unassigned (NULL) or matched
        IF v_member_loc IS NULL OR v_member_loc = p_location_id THEN
            RETURN TRUE;
        ELSE
            RETURN FALSE;
        END IF;
    END IF;

    -- 3. Reseller workspace admin/owner
    SELECT workspace_id INTO v_ws_id
    FROM public.businesses
    WHERE id = v_biz_id;

    IF v_ws_id IS NOT NULL THEN
        RETURN public.is_workspace_admin_or_owner(v_ws_id, p_user_id);
    END IF;

    RETURN FALSE;
END;
$$;

-- Grant execution to authenticated and anon (RLS policy evaluation context)
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_business_sovereign_owner(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_business_member(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_business_owner_or_manager(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_business(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_manage_business(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.can_access_location(UUID, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_workspace_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_business_sovereign_owner(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_business_member(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_business_owner_or_manager(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_business(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_business(UUID, UUID) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.can_access_location(UUID, UUID) TO authenticated, anon;


-- ------------------------------------------------------------------------------
-- 2. FORCE ROW LEVEL SECURITY on all 15 tenant-owned tables
-- Ensures non-superuser table owners are strictly subject to RLS policies.
-- ------------------------------------------------------------------------------
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;
ALTER TABLE public.user_auth_identities FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.businesses FORCE ROW LEVEL SECURITY;
ALTER TABLE public.locations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sites FORCE ROW LEVEL SECURITY;
ALTER TABLE public.catalogue_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.customers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders FORCE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_sequences FORCE ROW LEVEL SECURITY;
ALTER TABLE public.bills FORCE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;


-- ------------------------------------------------------------------------------
-- 3. Explicit RLS Policies for Tenant-Owned Tables
-- ------------------------------------------------------------------------------

-- === 3.1 public.users ===
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
DROP POLICY IF EXISTS "users_update_policy" ON public.users;
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.user_id = public.users.id
              AND public.is_workspace_member(wm.workspace_id, auth.uid())
        ) OR
        EXISTS (
            SELECT 1 FROM public.business_members bm
            WHERE bm.user_id = public.users.id
              AND public.is_business_member(bm.business_id, auth.uid())
        )
    );

CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "users_delete_policy" ON public.users
    FOR DELETE
    USING (id = auth.uid());


-- === 3.2 public.user_auth_identities ===
DROP POLICY IF EXISTS "user_auth_identities_select_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_insert_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_update_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_delete_policy" ON public.user_auth_identities;

CREATE POLICY "user_auth_identities_select_policy" ON public.user_auth_identities
    FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "user_auth_identities_insert_policy" ON public.user_auth_identities
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_auth_identities_update_policy" ON public.user_auth_identities
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_auth_identities_delete_policy" ON public.user_auth_identities
    FOR DELETE
    USING (user_id = auth.uid());


-- === 3.3 public.workspaces ===
DROP POLICY IF EXISTS "workspaces_select_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_insert_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_update_policy" ON public.workspaces;
DROP POLICY IF EXISTS "workspaces_delete_policy" ON public.workspaces;

CREATE POLICY "workspaces_select_policy" ON public.workspaces
    FOR SELECT
    USING (
        owner_user_id = auth.uid() OR
        public.is_workspace_member(id, auth.uid())
    );

CREATE POLICY "workspaces_insert_policy" ON public.workspaces
    FOR INSERT
    WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "workspaces_update_policy" ON public.workspaces
    FOR UPDATE
    USING (public.is_workspace_admin_or_owner(id, auth.uid()))
    WITH CHECK (public.is_workspace_admin_or_owner(id, auth.uid()));

CREATE POLICY "workspaces_delete_policy" ON public.workspaces
    FOR DELETE
    USING (owner_user_id = auth.uid());


-- === 3.4 public.workspace_members ===
DROP POLICY IF EXISTS "workspace_members_select_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_insert_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_update_policy" ON public.workspace_members;
DROP POLICY IF EXISTS "workspace_members_delete_policy" ON public.workspace_members;

CREATE POLICY "workspace_members_select_policy" ON public.workspace_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        public.is_workspace_member(workspace_id, auth.uid())
    );

CREATE POLICY "workspace_members_insert_policy" ON public.workspace_members
    FOR INSERT
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY "workspace_members_update_policy" ON public.workspace_members
    FOR UPDATE
    USING (public.is_workspace_admin_or_owner(workspace_id, auth.uid()))
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE POLICY "workspace_members_delete_policy" ON public.workspace_members
    FOR DELETE
    USING (
        user_id = auth.uid() OR
        public.is_workspace_admin_or_owner(workspace_id, auth.uid())
    );


-- === 3.5 public.workspace_invitations ===
DROP POLICY IF EXISTS "workspace_invitations_select_policy" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_insert_policy" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_update_policy" ON public.workspace_invitations;
DROP POLICY IF EXISTS "workspace_invitations_delete_policy" ON public.workspace_invitations;

CREATE POLICY "workspace_invitations_select_policy" ON public.workspace_invitations
    FOR SELECT
    USING (
        public.is_workspace_admin_or_owner(workspace_id, auth.uid()) OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY "workspace_invitations_insert_policy" ON public.workspace_invitations
    FOR INSERT
    WITH CHECK (
        public.is_workspace_admin_or_owner(workspace_id, auth.uid()) AND
        invited_by = auth.uid()
    );

CREATE POLICY "workspace_invitations_update_policy" ON public.workspace_invitations
    FOR UPDATE
    USING (
        public.is_workspace_admin_or_owner(workspace_id, auth.uid()) OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
    WITH CHECK (
        public.is_workspace_admin_or_owner(workspace_id, auth.uid()) OR
        email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

CREATE POLICY "workspace_invitations_delete_policy" ON public.workspace_invitations
    FOR DELETE
    USING (public.is_workspace_admin_or_owner(workspace_id, auth.uid()));


-- === 3.6 public.businesses ===
DROP POLICY IF EXISTS "businesses_select_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_insert_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_update_policy" ON public.businesses;
DROP POLICY IF EXISTS "businesses_delete_policy" ON public.businesses;

CREATE POLICY "businesses_select_policy" ON public.businesses
    FOR SELECT
    USING (
        sovereign_owner_id = auth.uid() OR
        public.is_business_member(id, auth.uid()) OR
        (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
    );

CREATE POLICY "businesses_insert_policy" ON public.businesses
    FOR INSERT
    WITH CHECK (
        sovereign_owner_id = auth.uid() AND
        (workspace_id IS NULL OR public.is_workspace_admin_or_owner(workspace_id, auth.uid()))
    );

CREATE POLICY "businesses_update_policy" ON public.businesses
    FOR UPDATE
    USING (
        sovereign_owner_id = auth.uid() OR
        public.is_business_owner_or_manager(id, auth.uid())
    )
    WITH CHECK (
        sovereign_owner_id = auth.uid() OR
        public.is_business_owner_or_manager(id, auth.uid())
    );

-- Invariant: Resellers CANNOT delete a sovereign business; strictly sovereign_owner_id required
CREATE POLICY "businesses_delete_policy" ON public.businesses
    FOR DELETE
    USING (sovereign_owner_id = auth.uid());


-- === 3.7 public.locations ===
DROP POLICY IF EXISTS "locations_select_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_insert_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_update_policy" ON public.locations;
DROP POLICY IF EXISTS "locations_delete_policy" ON public.locations;

CREATE POLICY "locations_select_policy" ON public.locations
    FOR SELECT
    USING (public.can_access_business(business_id, auth.uid()));

CREATE POLICY "locations_insert_policy" ON public.locations
    FOR INSERT
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "locations_update_policy" ON public.locations
    FOR UPDATE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()))
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "locations_delete_policy" ON public.locations
    FOR DELETE
    USING (public.is_business_sovereign_owner(business_id, auth.uid()));


-- === 3.8 public.business_members ===
DROP POLICY IF EXISTS "business_members_select_policy" ON public.business_members;
DROP POLICY IF EXISTS "business_members_insert_policy" ON public.business_members;
DROP POLICY IF EXISTS "business_members_update_policy" ON public.business_members;
DROP POLICY IF EXISTS "business_members_delete_policy" ON public.business_members;

CREATE POLICY "business_members_select_policy" ON public.business_members
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        public.is_business_sovereign_owner(business_id, auth.uid()) OR
        public.is_business_member(business_id, auth.uid()) OR
        (EXISTS (
            SELECT 1 FROM public.businesses b
            WHERE b.id = public.business_members.business_id
              AND b.workspace_id IS NOT NULL
              AND public.is_workspace_admin_or_owner(b.workspace_id, auth.uid())
        ))
    );

CREATE POLICY "business_members_insert_policy" ON public.business_members
    FOR INSERT
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "business_members_update_policy" ON public.business_members
    FOR UPDATE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()))
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "business_members_delete_policy" ON public.business_members
    FOR DELETE
    USING (
        user_id = auth.uid() OR
        public.is_business_owner_or_manager(business_id, auth.uid())
    );


-- === 3.9 public.sites ===
DROP POLICY IF EXISTS "sites_select_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_insert_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_update_policy" ON public.sites;
DROP POLICY IF EXISTS "sites_delete_policy" ON public.sites;

CREATE POLICY "sites_select_policy" ON public.sites
    FOR SELECT
    USING (
        status = 'published' OR
        public.can_access_business(business_id, auth.uid())
    );

CREATE POLICY "sites_insert_policy" ON public.sites
    FOR INSERT
    WITH CHECK (public.can_manage_business(business_id, auth.uid()));

CREATE POLICY "sites_update_policy" ON public.sites
    FOR UPDATE
    USING (public.can_manage_business(business_id, auth.uid()))
    WITH CHECK (public.can_manage_business(business_id, auth.uid()));

CREATE POLICY "sites_delete_policy" ON public.sites
    FOR DELETE
    USING (public.is_business_sovereign_owner(business_id, auth.uid()));


-- === 3.10 public.catalogue_items ===
DROP POLICY IF EXISTS "catalogue_items_select_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_insert_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_update_policy" ON public.catalogue_items;
DROP POLICY IF EXISTS "catalogue_items_delete_policy" ON public.catalogue_items;

CREATE POLICY "catalogue_items_select_policy" ON public.catalogue_items
    FOR SELECT
    USING (
        is_available = true OR
        public.can_access_business(business_id, auth.uid())
    );

CREATE POLICY "catalogue_items_insert_policy" ON public.catalogue_items
    FOR INSERT
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        (location_id IS NULL OR public.can_access_location(location_id, auth.uid()))
    );

CREATE POLICY "catalogue_items_update_policy" ON public.catalogue_items
    FOR UPDATE
    USING (public.can_access_business(business_id, auth.uid()))
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        (location_id IS NULL OR public.can_access_location(location_id, auth.uid()))
    );

CREATE POLICY "catalogue_items_delete_policy" ON public.catalogue_items
    FOR DELETE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()));


-- === 3.11 public.customers ===
DROP POLICY IF EXISTS "customers_select_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_insert_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_update_policy" ON public.customers;
DROP POLICY IF EXISTS "customers_delete_policy" ON public.customers;

CREATE POLICY "customers_select_policy" ON public.customers
    FOR SELECT
    USING (public.can_access_business(business_id, auth.uid()));

CREATE POLICY "customers_insert_policy" ON public.customers
    FOR INSERT
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) OR
        auth.uid() IS NOT NULL
    );

CREATE POLICY "customers_update_policy" ON public.customers
    FOR UPDATE
    USING (public.can_access_business(business_id, auth.uid()))
    WITH CHECK (public.can_access_business(business_id, auth.uid()));

CREATE POLICY "customers_delete_policy" ON public.customers
    FOR DELETE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()));


-- === 3.12 public.orders ===
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_delete_policy" ON public.orders;

CREATE POLICY "orders_select_policy" ON public.orders
    FOR SELECT
    USING (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

CREATE POLICY "orders_insert_policy" ON public.orders
    FOR INSERT
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

CREATE POLICY "orders_update_policy" ON public.orders
    FOR UPDATE
    USING (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    )
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

-- Invariant: Orders are statutory/financial operational records and must never be deleted
CREATE POLICY "orders_delete_policy" ON public.orders
    FOR DELETE
    USING (false);


-- === 3.13 public.invoice_sequences ===
DROP POLICY IF EXISTS "invoice_sequences_select_policy" ON public.invoice_sequences;
DROP POLICY IF EXISTS "invoice_sequences_insert_policy" ON public.invoice_sequences;
DROP POLICY IF EXISTS "invoice_sequences_update_policy" ON public.invoice_sequences;
DROP POLICY IF EXISTS "invoice_sequences_delete_policy" ON public.invoice_sequences;

CREATE POLICY "invoice_sequences_select_policy" ON public.invoice_sequences
    FOR SELECT
    USING (public.can_access_business(business_id, auth.uid()));

CREATE POLICY "invoice_sequences_insert_policy" ON public.invoice_sequences
    FOR INSERT
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

CREATE POLICY "invoice_sequences_update_policy" ON public.invoice_sequences
    FOR UPDATE
    USING (public.is_business_owner_or_manager(business_id, auth.uid()))
    WITH CHECK (public.is_business_owner_or_manager(business_id, auth.uid()));

-- Invariant: Statutory invoice sequences are strictly gap-free and non-deletable
CREATE POLICY "invoice_sequences_delete_policy" ON public.invoice_sequences
    FOR DELETE
    USING (false);


-- === 3.14 public.bills ===
DROP POLICY IF EXISTS "bills_select_policy" ON public.bills;
DROP POLICY IF EXISTS "bills_insert_policy" ON public.bills;
DROP POLICY IF EXISTS "bills_update_policy" ON public.bills;
DROP POLICY IF EXISTS "bills_delete_policy" ON public.bills;

CREATE POLICY "bills_select_policy" ON public.bills
    FOR SELECT
    USING (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

CREATE POLICY "bills_insert_policy" ON public.bills
    FOR INSERT
    WITH CHECK (
        public.can_access_business(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

CREATE POLICY "bills_update_policy" ON public.bills
    FOR UPDATE
    USING (
        public.is_business_owner_or_manager(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    )
    WITH CHECK (
        public.is_business_owner_or_manager(business_id, auth.uid()) AND
        public.can_access_location(location_id, auth.uid())
    );

-- Invariant: Statutory tax invoices are immutable and must never be deleted
CREATE POLICY "bills_delete_policy" ON public.bills
    FOR DELETE
    USING (false);


-- === 3.15 public.audit_logs ===
DROP POLICY IF EXISTS "audit_logs_select_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_policy" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_policy" ON public.audit_logs;

CREATE POLICY "audit_logs_select_policy" ON public.audit_logs
    FOR SELECT
    USING (
        (business_id IS NOT NULL AND public.is_business_owner_or_manager(business_id, auth.uid())) OR
        (workspace_id IS NOT NULL AND public.is_workspace_admin_or_owner(workspace_id, auth.uid())) OR
        user_id = auth.uid()
    );

CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        (user_id IS NULL OR user_id = auth.uid())
    );

-- Invariant: Audit logs are strictly append-only; update and delete are forbidden
CREATE POLICY "audit_logs_update_policy" ON public.audit_logs
    FOR UPDATE
    USING (false);

CREATE POLICY "audit_logs_delete_policy" ON public.audit_logs
    FOR DELETE
    USING (false);


-- ------------------------------------------------------------------------------
-- 4. Supporting Indexes for RLS Evaluation Performance
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_business_members_lookup
    ON public.business_members (business_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_workspace_members_lookup
    ON public.workspace_members (workspace_id, user_id, status);

CREATE INDEX IF NOT EXISTS idx_businesses_owner_ws
    ON public.businesses (sovereign_owner_id, workspace_id);

CREATE INDEX IF NOT EXISTS idx_locations_business_lookup
    ON public.locations (business_id, id);

CREATE INDEX IF NOT EXISTS idx_orders_business_location
    ON public.orders (business_id, location_id);

CREATE INDEX IF NOT EXISTS idx_bills_business_location
    ON public.bills (business_id, location_id);

CREATE INDEX IF NOT EXISTS idx_catalogue_items_business_location
    ON public.catalogue_items (business_id, location_id);
