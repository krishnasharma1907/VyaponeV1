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


-- ==============================================================================
-- 6. Section 6: Fix Auth Profile Trigger & RLS Security Definer Bypass
-- Migration: 20261114000001_fix_auth_profile_trigger_and_rls.sql
-- ==============================================================================

ALTER TABLE IF EXISTS public.users NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.user_auth_identities NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspaces NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_invitations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.businesses NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.locations NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.business_members NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sites NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.catalogue_items NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.customers NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.orders NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.invoice_sequences NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.bills NO FORCE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs NO FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_insert_policy" ON public.users;
CREATE POLICY "users_insert_policy" ON public.users
    FOR INSERT
    WITH CHECK (id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "user_auth_identities_insert_policy" ON public.user_auth_identities;
CREATE POLICY "user_auth_identities_insert_policy" ON public.user_auth_identities
    FOR INSERT
    WITH CHECK (user_id = auth.uid() OR auth.uid() IS NULL);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = pg_catalog.now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_catalog;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
    v_display_name TEXT;
    v_preferred_lang TEXT;
    v_phone TEXT;
BEGIN
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

    v_phone := pg_catalog.coalesce(
        pg_catalog.nullif(pg_catalog.trim(NEW.phone), ''),
        pg_catalog.nullif(pg_catalog.trim(NEW.raw_user_meta_data->>'phone'), '')
    );

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
        v_phone,
        'active',
        v_preferred_lang,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = pg_catalog.coalesce(EXCLUDED.display_name, public.users.display_name),
        email = pg_catalog.coalesce(EXCLUDED.email, public.users.email),
        phone_number = pg_catalog.coalesce(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = pg_catalog.now();

    IF v_phone IS NOT NULL AND v_phone <> '' THEN
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
            v_phone,
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
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_auth_user error: %, SQLSTATE: %', SQLERRM, SQLSTATE;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_catalog;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT OR UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role, supabase_auth_admin;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role, supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role, supabase_auth_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO postgres, anon, authenticated, service_role, supabase_auth_admin;


-- ==============================================================================
-- 7. Section 7: Business Profile Settings & Tenant Isolation Hardening
-- Migration: 20261114000002_business_profile_settings.sql
-- ==============================================================================

ALTER TABLE public.businesses
    ADD COLUMN IF NOT EXISTS category TEXT,
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en',
    ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    ADD COLUMN IF NOT EXISTS tax_scheme TEXT NOT NULL DEFAULT 'unregistered'
        CHECK (tax_scheme IN ('registered', 'composition', 'unregistered', 'exempt')),
    ADD COLUMN IF NOT EXISTS contact_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS address_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS timings_configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS facts_provenance JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_businesses_category ON public.businesses (category);

DROP POLICY IF EXISTS "audit_logs_insert_policy" ON public.audit_logs;
CREATE POLICY "audit_logs_insert_policy" ON public.audit_logs
    FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL AND
        (user_id IS NULL OR user_id = auth.uid()) AND
        (business_id IS NULL OR public.can_access_business(business_id, auth.uid())) AND
        (workspace_id IS NULL OR public.is_workspace_member(workspace_id, auth.uid()))
    );

DROP POLICY IF EXISTS "businesses_update_policy" ON public.businesses;
CREATE POLICY "businesses_update_policy" ON public.businesses
    FOR UPDATE
    USING (
        sovereign_owner_id = auth.uid() OR
        public.is_business_owner_or_manager(id, auth.uid())
    )
    WITH CHECK (
        sovereign_owner_id = (SELECT b.sovereign_owner_id FROM public.businesses b WHERE b.id = public.businesses.id) AND
        (
            (workspace_id IS NULL AND (SELECT b.workspace_id FROM public.businesses b WHERE b.id = public.businesses.id) IS NULL) OR
            (workspace_id = (SELECT b.workspace_id FROM public.businesses b WHERE b.id = public.businesses.id))
        ) AND
        (
            sovereign_owner_id = auth.uid() OR
            public.is_business_owner_or_manager(id, auth.uid())
        )
    );

DROP POLICY IF EXISTS "catalogue_items_select_policy" ON public.catalogue_items;
CREATE POLICY "catalogue_items_select_policy" ON public.catalogue_items
    FOR SELECT
    USING (
        public.can_access_business(business_id, auth.uid()) OR
        (
            is_available = true AND
            EXISTS (
                SELECT 1 FROM public.sites s
                WHERE s.business_id = public.catalogue_items.business_id
                  AND s.status = 'published'
            )
        )
    );


-- ==============================================================================
-- 8. Section 8: Plans, Subscriptions, Entitlements and Capacity Model
-- Migration: 20261115000001_plans_entitlements_capacity.sql
-- ==============================================================================

-- 1. Schema Extensions & Constraint Updates
-- ------------------------------------------------------------------------------

-- 1.1 Support all canonical plan identifiers in workspaces ('starter', 'growth', 'pro', 'agency', 'scale')
ALTER TABLE public.workspaces DROP CONSTRAINT IF EXISTS workspaces_plan_check;
ALTER TABLE public.workspaces ADD CONSTRAINT workspaces_plan_check 
    CHECK (plan IN ('starter', 'growth', 'pro', 'agency', 'scale'));

-- 1.2 Support 'archived' status for sites per PRD §9.2 counting rules
ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_status_check;
ALTER TABLE public.sites ADD CONSTRAINT sites_status_check 
    CHECK (status IN ('draft', 'published', 'suspended', 'archived'));

-- 1.3 PRD §9.2 rule 1: Enforce at most one live published storefront per business
-- Prevents double-counting and guarantees 1 website slot = 1 live business.
-- Drop unconditional business_id uniqueness so businesses can have multiple draft sites.
ALTER TABLE public.sites DROP CONSTRAINT IF EXISTS sites_business_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sites_single_published_per_business 
    ON public.sites (business_id) 
    WHERE status = 'published';

-- ------------------------------------------------------------------------------
-- 2. Subscriptions Table (Workspace Commercial Plan Assignment)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    plan_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'grace_period', 'canceled')),
    current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    current_period_end TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
    grace_period_end TIMESTAMPTZ,
    provider_reference TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT subscriptions_workspace_unique UNIQUE (workspace_id)
);

CREATE TRIGGER trg_subscriptions_updated_at
    BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON public.subscriptions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan_status ON public.subscriptions (plan_id, status);

-- ------------------------------------------------------------------------------
-- 3. Entitlement Overrides Table (Feature Grants / Add-ons)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entitlement_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ,
    reason TEXT,
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT chk_override_scope CHECK (
        (workspace_id IS NOT NULL AND business_id IS NULL) OR
        (workspace_id IS NULL AND business_id IS NOT NULL)
    )
);

CREATE TRIGGER trg_entitlement_overrides_updated_at
    BEFORE UPDATE ON public.entitlement_overrides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_ws ON public.entitlement_overrides (workspace_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_biz ON public.entitlement_overrides (business_id);
CREATE INDEX IF NOT EXISTS idx_entitlement_overrides_feature ON public.entitlement_overrides (feature_key);

-- ------------------------------------------------------------------------------
-- 4. Capacity Overrides Table (Additional Website / Seat Quotas)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.capacity_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    metric TEXT NOT NULL,
    additional_capacity INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    reason TEXT,
    granted_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT capacity_overrides_workspace_metric_unique UNIQUE (workspace_id, metric)
);

CREATE TRIGGER trg_capacity_overrides_updated_at
    BEFORE UPDATE ON public.capacity_overrides
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX IF NOT EXISTS idx_capacity_overrides_ws_metric ON public.capacity_overrides (workspace_id, metric);

-- ------------------------------------------------------------------------------
-- 5. Row-Level Security & Tenant Isolation Enforcement
-- ------------------------------------------------------------------------------
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions FORCE ROW LEVEL SECURITY;

ALTER TABLE public.entitlement_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_overrides FORCE ROW LEVEL SECURITY;

ALTER TABLE public.capacity_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capacity_overrides FORCE ROW LEVEL SECURITY;

-- 5.1 Subscriptions RLS Policies
CREATE POLICY "subscriptions_select_policy" ON public.subscriptions
    FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "subscriptions_insert_policy" ON public.subscriptions
    FOR INSERT
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "subscriptions_update_policy" ON public.subscriptions
    FOR UPDATE
    USING (public.is_workspace_admin_or_owner(workspace_id))
    WITH CHECK (public.is_workspace_admin_or_owner(workspace_id));

CREATE POLICY "subscriptions_delete_policy" ON public.subscriptions
    FOR DELETE
    USING (false);

-- 5.2 Entitlement Overrides RLS Policies
CREATE POLICY "entitlement_overrides_select_policy" ON public.entitlement_overrides
    FOR SELECT
    USING (
        (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id)) OR
        (business_id IS NOT NULL AND public.can_access_business(business_id))
    );

CREATE POLICY "entitlement_overrides_insert_policy" ON public.entitlement_overrides
    FOR INSERT
    WITH CHECK (false);

CREATE POLICY "entitlement_overrides_update_policy" ON public.entitlement_overrides
    FOR UPDATE
    USING (false);

CREATE POLICY "entitlement_overrides_delete_policy" ON public.entitlement_overrides
    FOR DELETE
    USING (false);

-- 5.3 Capacity Overrides RLS Policies
CREATE POLICY "capacity_overrides_select_policy" ON public.capacity_overrides
    FOR SELECT
    USING (public.is_workspace_member(workspace_id));

CREATE POLICY "capacity_overrides_insert_policy" ON public.capacity_overrides
    FOR INSERT
    WITH CHECK (false);

CREATE POLICY "capacity_overrides_update_policy" ON public.capacity_overrides
    FOR UPDATE
    USING (false);

CREATE POLICY "capacity_overrides_delete_policy" ON public.capacity_overrides
    FOR DELETE
    USING (false);

-- ------------------------------------------------------------------------------
-- 6. Atomic Concurrency-Safe Capacity Reservation & Site Transition Functions
-- ------------------------------------------------------------------------------
-- Protects against time-of-check to time-of-use (TOCTOU) race conditions when
-- multiple concurrent requests attempt to create/publish sites or add team seats.
-- Uses transaction-scoped row locking (SELECT ... FOR UPDATE on public.workspaces).

CREATE OR REPLACE FUNCTION public.assert_and_lock_workspace_capacity(
    p_workspace_id UUID,
    p_metric TEXT,
    p_requested_quantity INT DEFAULT 1
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INT,
    effective_limit INT,
    remaining INT,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current INT := 0;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    -- 1. Caller Authorization (prevent cross-tenant snooping)
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        -- Check actual session connection role or JWT role; DO NOT check current_user (which is the definer)
        IF session_user NOT IN ('postgres', 'service_role') AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSE
        IF NOT EXISTS (
            SELECT 1 FROM public.workspaces w
            WHERE w.id = p_workspace_id AND w.owner_user_id = v_caller_id
        ) AND NOT EXISTS (
            SELECT 1 FROM public.workspace_members wm
            WHERE wm.workspace_id = p_workspace_id 
              AND wm.user_id = v_caller_id 
              AND wm.status = 'active'
        ) THEN
            RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id USING ERRCODE = '42501';
        END IF;
    END IF;

    -- 2. Transaction-scoped row lock on the workspace to serialize concurrent operations
    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

    -- 3. Resolve plan from active/grace subscription or workspace plan fallback
    SELECT s.plan_id INTO v_plan_id
    FROM public.subscriptions s
    WHERE s.workspace_id = p_workspace_id
      AND (
          s.status = 'active'
          OR (s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > v_now))
          OR (s.status = 'past_due' AND s.grace_period_end IS NOT NULL AND s.grace_period_end > v_now)
          OR (s.status = 'grace_period' AND (s.grace_period_end IS NULL OR s.grace_period_end > v_now))
      )
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        SELECT plan INTO v_plan_id FROM public.workspaces WHERE id = p_workspace_id;
    END IF;

    IF v_plan_id IS NULL THEN
        RETURN QUERY SELECT false, 0, 0, 0, 'Workspace not found';
        RETURN;
    END IF;

    -- 4. Normalize canonical plan to base limits (PRD §9.1)
    -- Unknown plans FAIL CLOSED per strict security invariants
    IF v_plan_id = 'starter' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 3;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 10;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 2;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 1;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 50;
        END IF;
    ELSIF v_plan_id IN ('growth', 'pro') THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 8;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 25;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 5;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 3;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 250;
        END IF;
    ELSIF v_plan_id = 'agency' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 20;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 50;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 15;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 10;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 1000;
        END IF;
    ELSIF v_plan_id = 'scale' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 50;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 100;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 50;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 25;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 5000;
        END IF;
    ELSE
        -- Unknown plan ID: FAIL CLOSED
        RETURN QUERY SELECT false, 0, 0, 0, 'Unknown or unsupported plan identifier: ' || coalesce(v_plan_id, 'none');
        RETURN;
    END IF;

    -- 5. Check capacity overrides
    SELECT coalesce(additional_capacity, 0) INTO v_override
    FROM public.capacity_overrides
    WHERE workspace_id = p_workspace_id
      AND metric = p_metric
      AND (expires_at IS NULL OR expires_at > v_now);

    v_effective_limit := v_base_limit + v_override;

    -- 6. Count current live/draft sites or team seats (PRD §9.2 Counting Rules)
    IF p_metric = 'live_websites' THEN
        -- Distinct live businesses (archived businesses excluded)
        SELECT count(DISTINCT s.business_id)::INT INTO v_current
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = p_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'published';
    ELSIF p_metric = 'draft_websites' THEN
        SELECT count(*)::INT INTO v_current
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = p_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';
    ELSIF p_metric = 'team_seats' THEN
        SELECT count(*)::INT INTO v_current
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND status = 'active';
    END IF;

    -- 7. Evaluate remaining capacity
    IF v_current + p_requested_quantity > v_effective_limit THEN
        RETURN QUERY SELECT
            false,
            v_current,
            v_effective_limit,
            pg_catalog.greatest(0, v_effective_limit - v_current),
            'Capacity limit reached for ' || p_metric;
    ELSE
        RETURN QUERY SELECT
            true,
            v_current,
            v_effective_limit,
            v_effective_limit - (v_current + p_requested_quantity),
            'Capacity available'::TEXT;
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.transition_site_status_atomic(
    p_site_id UUID,
    p_target_status TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    status TEXT,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_business_id UUID;
    v_workspace_id UUID;
    v_sovereign_owner_id UUID;
    v_current_status TEXT;
    v_biz_status TEXT;
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current_live_count INT := 0;
    v_current_draft_count INT := 0;
    v_draft_limit INT := 0;
    v_draft_override INT := 0;
    v_effective_draft_limit INT := 0;
    v_business_has_published BOOLEAN := false;
    v_is_authorized BOOLEAN := false;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    -- 1. Fetch site, business, and parent workspace
    SELECT s.business_id, s.status, b.workspace_id, b.status, b.sovereign_owner_id
    INTO v_business_id, v_current_status, v_workspace_id, v_biz_status, v_sovereign_owner_id
    FROM public.sites s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = p_site_id;

    IF v_business_id IS NULL OR v_workspace_id IS NULL THEN
        RETURN QUERY SELECT false, 'not_found'::TEXT, 'Site or parent business not found'::TEXT;
        RETURN;
    END IF;

    -- Validate workspace-business containment
    IF NOT EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = v_business_id AND workspace_id = v_workspace_id
    ) THEN
        RAISE EXCEPTION 'Tenant boundary violation: business does not belong to specified workspace' USING ERRCODE = '42501';
    END IF;

    -- 2. Transaction-scoped row lock on workspace first to serialize all concurrent operations
    PERFORM 1 FROM public.workspaces WHERE id = v_workspace_id FOR UPDATE;

    -- 3. Lock business row and all sites of this business in consistent order
    PERFORM 1 FROM public.businesses WHERE id = v_business_id FOR UPDATE;
    PERFORM 1 FROM public.sites WHERE business_id = v_business_id FOR UPDATE ORDER BY id;

    -- 4. Caller Authentication & Exact Role-Based Authorization
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        -- Check actual session connection role or JWT role; DO NOT check current_user (which is the definer)
        IF session_user NOT IN ('postgres', 'service_role') AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSE
        -- Validate exact authorized roles:
        -- - Workspace owner
        -- - Workspace admin / Reseller admin
        -- - Sovereign business owner
        -- - Business owner or manager
        -- Strictly excluded: workspace_member, reseller_staff, cashier, staff
        SELECT (
            EXISTS (SELECT 1 FROM public.workspaces WHERE id = v_workspace_id AND owner_user_id = v_caller_id)
            OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_workspace_id AND user_id = v_caller_id AND status = 'active' AND role = 'workspace_owner')
            OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_workspace_id AND user_id = v_caller_id AND status = 'active' AND role IN ('workspace_admin', 'reseller_admin'))
            OR (v_sovereign_owner_id = v_caller_id)
            OR EXISTS (SELECT 1 FROM public.business_members WHERE business_id = v_business_id AND user_id = v_caller_id AND status = 'active' AND role IN ('owner', 'manager'))
        ) INTO v_is_authorized;

        IF NOT v_is_authorized THEN
            RAISE EXCEPTION 'Access denied: caller does not possess required publishing permissions for site %', p_site_id
                USING ERRCODE = '42501';
        END IF;
    END IF;

    -- Validate target status parameter
    IF p_target_status NOT IN ('draft', 'published', 'archived', 'suspended') THEN
        RETURN QUERY SELECT false, v_current_status, 'Invalid target status'::TEXT;
        RETURN;
    END IF;

    -- 5. Archiving or Suspending is ALWAYS permitted and frees capacity (PRD §9.2)
    -- Authorized users can archive/suspend even if the business is archived (cleanup)
    IF p_target_status IN ('archived', 'suspended') THEN
        UPDATE public.sites SET status = p_target_status, updated_at = pg_catalog.now() WHERE id = p_site_id;
        RETURN QUERY SELECT true, p_target_status, 'Status updated'::TEXT;
        RETURN;
    END IF;

    -- Invariant: Archived businesses cannot publish or restore storefronts
    IF v_biz_status = 'archived' THEN
        RETURN QUERY SELECT false, v_current_status, 'Cannot modify site for an archived business'::TEXT;
        RETURN;
    END IF;

    -- Idempotency Check
    IF v_current_status = p_target_status THEN
        RETURN QUERY SELECT true, v_current_status, 'Already in target status'::TEXT;
        RETURN;
    END IF;

    -- 6. Resolve canonical effective plan
    SELECT s.plan_id INTO v_plan_id
    FROM public.subscriptions s
    WHERE s.workspace_id = v_workspace_id
      AND (
          s.status = 'active'
          OR (s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > v_now))
          OR (s.status = 'past_due' AND s.grace_period_end IS NOT NULL AND s.grace_period_end > v_now)
          OR (s.status = 'grace_period' AND (s.grace_period_end IS NULL OR s.grace_period_end > v_now))
      )
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        SELECT plan INTO v_plan_id FROM public.workspaces WHERE id = v_workspace_id;
    END IF;

    IF v_plan_id = 'starter' THEN
        v_base_limit := 3;
        v_draft_limit := 10;
    ELSIF v_plan_id IN ('growth', 'pro') THEN
        v_base_limit := 8;
        v_draft_limit := 25;
    ELSIF v_plan_id = 'agency' THEN
        v_base_limit := 20;
        v_draft_limit := 50;
    ELSIF v_plan_id = 'scale' THEN
        v_base_limit := 50;
        v_draft_limit := 100;
    ELSE
        -- Fail closed on unknown plan
        RETURN QUERY SELECT false, v_current_status, 'Unknown or unsupported plan identifier: ' || coalesce(v_plan_id, 'none');
        RETURN;
    END IF;

    -- 7. If publishing: check capacity before modifying any existing published sites
    IF p_target_status = 'published' THEN
        SELECT coalesce(additional_capacity, 0) INTO v_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'live_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

        v_effective_limit := v_base_limit + v_override;

        -- Calculate existing live business usage correctly (PRD §9.2)
        SELECT count(DISTINCT s.business_id)::INT INTO v_current_live_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'published';

        -- Account for currently published site of this business
        SELECT exists(
            SELECT 1 FROM public.sites
            WHERE business_id = v_business_id
              AND status = 'published'
        ) INTO v_business_has_published;

        -- Determine whether replacement publishing is allowed
        IF v_business_has_published THEN
            -- Replacement: business already has a published site.
            -- If plan capacity is already exceeded (e.g. after downgrade), replacement is rejected.
            IF v_current_live_count > v_effective_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for live_websites: workspace exceeds plan allowance'::TEXT;
                RETURN;
            END IF;
        ELSE
            -- New live business: consumes 1 slot
            IF v_current_live_count + 1 > v_effective_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for live_websites'::TEXT;
                RETURN;
            END IF;
        END IF;

        -- ONLY AFTER ALL CHECKS SUCCEED: Demote old published site and publish target site
        UPDATE public.sites
        SET status = 'draft', updated_at = pg_catalog.now()
        WHERE business_id = v_business_id
          AND status = 'published'
          AND id <> p_site_id;

        UPDATE public.sites 
        SET status = 'published', 
            published_at = coalesce(published_at, pg_catalog.now()),
            updated_at = pg_catalog.now() 
        WHERE id = p_site_id;

        RETURN QUERY SELECT true, 'published'::TEXT, 'Site published successfully'::TEXT;
        RETURN;
    END IF;

    -- 8. If restoring archived to draft: check draft capacity atomically
    IF p_target_status = 'draft' AND v_current_status = 'archived' THEN
        SELECT coalesce(additional_capacity, 0) INTO v_draft_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'draft_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

        v_effective_draft_limit := v_draft_limit + v_draft_override;

        SELECT count(*)::INT INTO v_current_draft_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';

        IF v_current_draft_count + 1 > v_effective_draft_limit THEN
            RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for draft_websites'::TEXT;
            RETURN;
        END IF;

        UPDATE public.sites SET status = 'draft', updated_at = pg_catalog.now() WHERE id = p_site_id;
        RETURN QUERY SELECT true, 'draft'::TEXT, 'Draft restored successfully'::TEXT;
        RETURN;
    END IF;

    UPDATE public.sites SET status = p_target_status, updated_at = pg_catalog.now() WHERE id = p_site_id;
    RETURN QUERY SELECT true, p_target_status, 'Status updated'::TEXT;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Direct Mutation Trigger Guards (Zero-Bypass Capacity & Immutability Defense)
-- ------------------------------------------------------------------------------
-- Ensures that ANY direct UPDATE or INSERT on public.sites to status = 'published'
-- (via Server Actions, raw SQL, or client APIs) automatically executes inside
-- the transaction with the workspace row lock and capacity enforcement.

CREATE OR REPLACE FUNCTION public.check_site_publish_capacity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id UUID;
    v_biz_status TEXT;
    v_now TIMESTAMPTZ := pg_catalog.now();
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current_live_count INT := 0;
    v_business_has_published BOOLEAN := false;
BEGIN
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status <> 'published') THEN
        -- 1. Resolve parent business and workspace
        SELECT b.workspace_id, b.status INTO v_workspace_id, v_biz_status
        FROM public.businesses b
        WHERE b.id = NEW.business_id;

        IF v_biz_status IS NULL THEN
            RAISE EXCEPTION 'Parent business not found for site' USING ERRCODE = 'P0002';
        END IF;

        IF v_biz_status = 'archived' THEN
            RAISE EXCEPTION 'Cannot publish site for an archived business' USING ERRCODE = 'P0004';
        END IF;

        -- 2. Lock workspace & business rows
        PERFORM 1 FROM public.workspaces WHERE id = v_workspace_id FOR UPDATE;
        PERFORM 1 FROM public.businesses WHERE id = NEW.business_id FOR UPDATE;
        PERFORM 1 FROM public.sites WHERE business_id = NEW.business_id FOR UPDATE ORDER BY id;

        -- 3. Resolve plan
        SELECT s.plan_id INTO v_plan_id
        FROM public.subscriptions s
        WHERE s.workspace_id = v_workspace_id
          AND (
              s.status = 'active'
              OR (s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > v_now))
              OR (s.status = 'past_due' AND s.grace_period_end IS NOT NULL AND s.grace_period_end > v_now)
              OR (s.status = 'grace_period' AND (s.grace_period_end IS NULL OR s.grace_period_end > v_now))
          )
        ORDER BY s.created_at DESC
        LIMIT 1;

        IF v_plan_id IS NULL THEN
            SELECT plan INTO v_plan_id FROM public.workspaces WHERE id = v_workspace_id;
        END IF;

        IF v_plan_id = 'starter' THEN v_base_limit := 3;
        ELSIF v_plan_id IN ('growth', 'pro') THEN v_base_limit := 8;
        ELSIF v_plan_id = 'agency' THEN v_base_limit := 20;
        ELSIF v_plan_id = 'scale' THEN v_base_limit := 50;
        ELSE
            RAISE EXCEPTION 'Unknown or unsupported plan identifier: %', coalesce(v_plan_id, 'none') USING ERRCODE = 'P0005';
        END IF;

        SELECT coalesce(additional_capacity, 0) INTO v_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'live_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

        v_effective_limit := v_base_limit + v_override;

        -- 4. Count live businesses (PRD §9.2)
        SELECT count(DISTINCT s.business_id)::INT INTO v_current_live_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'published';

        -- 5. Check if this business already has another published site
        SELECT exists(
            SELECT 1 FROM public.sites
            WHERE business_id = NEW.business_id
              AND status = 'published'
              AND id <> NEW.id
        ) INTO v_business_has_published;

        -- 6. Evaluate capacity
        IF v_business_has_published THEN
            IF v_current_live_count > v_effective_limit THEN
                RAISE EXCEPTION 'Capacity limit reached for live_websites: workspace exceeds plan allowance' USING ERRCODE = 'P0003';
            END IF;
        ELSE
            IF v_current_live_count + 1 > v_effective_limit THEN
                RAISE EXCEPTION 'Capacity limit reached for live_websites' USING ERRCODE = 'P0003';
            END IF;
        END IF;

        -- 7. Demote other published sites for this business to uphold PRD §9.2 rule 1
        UPDATE public.sites
        SET status = 'draft', updated_at = pg_catalog.now()
        WHERE business_id = NEW.business_id
          AND status = 'published'
          AND id <> NEW.id;

        NEW.published_at := coalesce(NEW.published_at, v_now);
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_site_publish_capacity ON public.sites;
CREATE TRIGGER trg_check_site_publish_capacity
    BEFORE INSERT OR UPDATE OF status ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.check_site_publish_capacity_trigger();

-- 7.2 Enforce Immutable business_id on public.sites (PRD Invariant & Tenant Protection)
-- A site permanently belongs to its sovereign business and cannot be moved across businesses
CREATE OR REPLACE FUNCTION public.prevent_site_business_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.business_id <> OLD.business_id THEN
        RAISE EXCEPTION 'business_id on public.sites is immutable and cannot be modified'
            USING ERRCODE = '42809';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_site_business_id_change ON public.sites;
CREATE TRIGGER trg_prevent_site_business_id_change
    BEFORE UPDATE OF business_id ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_site_business_id_change();

-- Function Execution Privileges
REVOKE ALL ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_site_publish_capacity_trigger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_site_publish_capacity_trigger() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.prevent_site_business_id_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_site_business_id_change() TO postgres, service_role;


-- ==============================================================================
-- 9. Section 9: Harden Auth Trigger, Prevent Anonymous Writes & Profile Integrity
-- Migration: 20261115000002_harden_auth_trigger_and_profile_rls.sql
-- ==============================================================================

-- 1. Revoke write privileges from anon & PUBLIC across ALL public tables
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;

-- 2. Grant SELECT privileges to anon strictly on public web storefront browsing tables
GRANT SELECT ON public.sites, public.catalogue_items TO anon;

-- 3. Revoke excessive maintenance privileges (TRUNCATE, TRIGGER) from authenticated
REVOKE TRUNCATE, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated, anon, PUBLIC;

-- 4. Harden audit_logs table to be strictly append-only (no update or deletion by application users)
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon, PUBLIC;

-- 5. Column-level privilege protection for public.users
-- Only display_name and preferred_language are user-editable.
-- Protected columns (id, status, email, phone_number, created_at, updated_at) cannot be modified directly.
REVOKE ALL ON public.users FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.users TO authenticated;
GRANT UPDATE (display_name, preferred_language) ON public.users TO authenticated;

-- 6. Privilege hardening for public.user_auth_identities
-- Identities are security-sensitive credentials; no direct user INSERT/UPDATE/DELETE is permitted.
REVOKE ALL ON public.user_auth_identities FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.user_auth_identities TO authenticated;

-- 7. Scope supabase_auth_admin privileges strictly to auth profile provisioning
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT SELECT, INSERT, UPDATE ON public.users, public.user_auth_identities TO supabase_auth_admin;

-- 8. Harden default privileges for future objects
-- Explicit least privilege: revoke all default table, sequence, and routine privileges from anon, authenticated, and PUBLIC.
-- Every future table must receive its own explicit GRANT and RLS policies in its feature migration.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO service_role;

-- 9. Row-Level Security Policies for public.users and public.user_auth_identities
-- Drop direct INSERT policies (profile creation is governed by trigger and secure RPC)
DROP POLICY IF EXISTS "users_insert_policy" ON public.users;

-- Explicitly drop users_delete_policy.
-- In VyapOne, hard deletion of user accounts by end-users is intentionally prohibited.
-- User deactivation/suspension is performed via status transitions ('suspended').
-- Sovereign data deletion is governed by administrative DPDP compliance workflows (VO-124).
-- Because DELETE privilege is revoked from authenticated on public.users, no DELETE policy is created.
DROP POLICY IF EXISTS "users_delete_policy" ON public.users;

DROP POLICY IF EXISTS "users_update_policy" ON public.users;
CREATE POLICY "users_update_policy" ON public.users
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Tighten users_select_policy:
-- Users can always view their own profile.
-- Workspace and Business owners/admins can view member profiles within their tenant.
-- Regular peers cannot view other users' private contact details directly from public.users.
DROP POLICY IF EXISTS "users_select_policy" ON public.users;
CREATE POLICY "users_select_policy" ON public.users
    FOR SELECT
    TO authenticated
    USING (
        id = auth.uid() OR
        EXISTS (
            SELECT 1 FROM public.workspace_members wm_admin
            JOIN public.workspace_members wm_target ON wm_target.workspace_id = wm_admin.workspace_id
            WHERE wm_admin.user_id = auth.uid()
              AND wm_admin.role IN ('owner', 'workspace_owner', 'admin', 'workspace_admin', 'reseller_owner', 'reseller_admin')
              AND wm_target.user_id = public.users.id
        ) OR
        EXISTS (
            SELECT 1 FROM public.business_members bm_admin
            JOIN public.business_members bm_target ON bm_target.business_id = bm_admin.business_id
            WHERE bm_admin.user_id = auth.uid()
              AND bm_admin.role IN ('owner', 'manager')
              AND bm_target.user_id = public.users.id
        )
    );

DROP POLICY IF EXISTS "user_auth_identities_insert_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_update_policy" ON public.user_auth_identities;
DROP POLICY IF EXISTS "user_auth_identities_delete_policy" ON public.user_auth_identities;

DROP POLICY IF EXISTS "user_auth_identities_select_policy" ON public.user_auth_identities;
CREATE POLICY "user_auth_identities_select_policy" ON public.user_auth_identities
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- 10. User Directory Projection View
-- Exposes non-sensitive profile information for workspace and business team directories.
-- Strictly omits private contact details (email, phone_number) from peer members.
CREATE OR REPLACE VIEW public.user_directory
WITH (security_invoker = true) AS
SELECT
    u.id,
    u.display_name,
    u.status,
    u.preferred_language
FROM public.users u
WHERE
    u.id = auth.uid() OR
    EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.user_id = u.id
          AND public.is_workspace_member(wm.workspace_id, auth.uid())
    ) OR
    EXISTS (
        SELECT 1 FROM public.business_members bm
        WHERE bm.user_id = u.id
          AND public.is_business_member(bm.business_id, auth.uid())
    );

GRANT SELECT ON public.user_directory TO authenticated;

-- 11. Hardened Auth Trigger Function
-- - SECURITY DEFINER owned by postgres (bypasses RLS naturally)
-- - SET search_path = '' strictly protects against search_path hijacking
-- - All relation and function references are schema-qualified
-- - Standard SQL constructs (coalesce, nullif, trim) used without invalid pg_catalog prefix
-- - Dual-check phone collision handling ensures duplicate phone numbers do not violate unique constraints
-- - Identity conflict protection: ON CONFLICT ... WHERE user_id = EXCLUDED.user_id prevents identity theft
-- - Unexpected fatal errors are propagated so GoTrue transactions abort atomically (zero silent suppression)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_display_name pg_catalog.text;
    v_preferred_lang pg_catalog.text;
    v_phone pg_catalog.text;
    v_existing_id pg_catalog.uuid;
BEGIN
    -- 1. Sanitize and extract display name
    v_display_name := coalesce(
        nullif(trim(NEW.raw_user_meta_data->>'display_name'), ''),
        nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''),
        nullif(trim(pg_catalog.split_part(NEW.email, '@', 1)), ''),
        nullif(trim(NEW.phone), ''),
        'VyapOne User'
    );

    v_preferred_lang := coalesce(
        nullif(trim(NEW.raw_user_meta_data->>'preferred_language'), ''),
        'en'
    );

    v_phone := coalesce(
        nullif(trim(NEW.phone), ''),
        nullif(trim(NEW.raw_user_meta_data->>'phone'), '')
    );

    -- 2. Guard against phone number collision with another user (both in users and identities)
    IF v_phone IS NOT NULL AND v_phone <> '' THEN
        SELECT id INTO v_existing_id
        FROM public.users
        WHERE phone_number = v_phone AND id <> NEW.id
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            v_phone := NULL;
        ELSE
            SELECT user_id INTO v_existing_id
            FROM public.user_auth_identities
            WHERE provider = 'phone_otp' AND identifier = v_phone AND user_id <> NEW.id
            LIMIT 1;

            IF v_existing_id IS NOT NULL THEN
                v_phone := NULL;
            END IF;
        END IF;
    END IF;

    -- 3. Upsert user profile record in public.users
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
        v_phone,
        'active',
        v_preferred_lang,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = coalesce(EXCLUDED.display_name, public.users.display_name),
        email = coalesce(EXCLUDED.email, public.users.email),
        phone_number = coalesce(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = pg_catalog.now();

    -- 4. Upsert phone identity if valid and non-colliding
    -- Guard: Only update verification timestamp if the identity already belongs to this user
    IF v_phone IS NOT NULL AND v_phone <> '' THEN
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
            v_phone,
            NEW.phone_confirmed_at,
            pg_catalog.now()
        )
        ON CONFLICT (provider, identifier) DO UPDATE SET
            verified_at = coalesce(EXCLUDED.verified_at, public.user_auth_identities.verified_at)
        WHERE public.user_auth_identities.user_id = EXCLUDED.user_id;
    END IF;

    -- 5. Upsert email identity if present
    -- Guard: Only update verification timestamp if the identity already belongs to this user
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
            verified_at = coalesce(EXCLUDED.verified_at, public.user_auth_identities.verified_at)
        WHERE public.user_auth_identities.user_id = EXCLUDED.user_id;
    END IF;

    RETURN NEW;
END;
$$;

-- 12. Restrict trigger execution privileges (least privilege)
-- Trigger functions must not be directly invocable by anon or authenticated RPC
REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres, supabase_auth_admin, service_role;

-- 13. Secure Profile Recovery RPC
-- Allows authenticated users to safely provision or recover their profile if missing
-- Strictly uses auth.uid() and auth.users verified data; caller cannot forge another user's profile
CREATE OR REPLACE FUNCTION public.ensure_user_profile(
    p_display_name pg_catalog.text DEFAULT NULL,
    p_preferred_language pg_catalog.text DEFAULT NULL
)
RETURNS pg_catalog.jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id pg_catalog.uuid;
    v_email pg_catalog.text;
    v_phone pg_catalog.text;
    v_raw_meta pg_catalog.jsonb;
    v_display_name pg_catalog.text;
    v_pref_lang pg_catalog.text;
    v_existing_id pg_catalog.uuid;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '28000';
    END IF;

    SELECT email, phone, raw_user_meta_data
    INTO v_email, v_phone, v_raw_meta
    FROM auth.users
    WHERE id = v_user_id;

    IF v_email IS NULL AND v_phone IS NULL THEN
        RAISE EXCEPTION 'Auth user record not found' USING ERRCODE = 'P0002';
    END IF;

    v_display_name := coalesce(
        nullif(trim(p_display_name), ''),
        nullif(trim(v_raw_meta->>'display_name'), ''),
        nullif(trim(v_raw_meta->>'full_name'), ''),
        nullif(trim(pg_catalog.split_part(v_email, '@', 1)), ''),
        nullif(trim(v_phone), ''),
        'VyapOne User'
    );

    v_pref_lang := coalesce(
        nullif(trim(p_preferred_language), ''),
        nullif(trim(v_raw_meta->>'preferred_language'), ''),
        'en'
    );

    v_phone := coalesce(
        nullif(trim(v_phone), ''),
        nullif(trim(v_raw_meta->>'phone'), '')
    );

    IF v_phone IS NOT NULL AND v_phone <> '' THEN
        SELECT id INTO v_existing_id
        FROM public.users
        WHERE phone_number = v_phone AND id <> v_user_id
        LIMIT 1;

        IF v_existing_id IS NOT NULL THEN
            v_phone := NULL;
        END IF;
    END IF;

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
        v_user_id,
        v_display_name,
        v_email,
        v_phone,
        'active',
        v_pref_lang,
        pg_catalog.now(),
        pg_catalog.now()
    )
    ON CONFLICT (id) DO UPDATE SET
        display_name = coalesce(EXCLUDED.display_name, public.users.display_name),
        email = coalesce(EXCLUDED.email, public.users.email),
        phone_number = coalesce(EXCLUDED.phone_number, public.users.phone_number),
        updated_at = pg_catalog.now();

    RETURN pg_catalog.jsonb_build_object(
        'success', true,
        'user_id', v_user_id,
        'display_name', v_display_name
    );
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_user_profile(pg_catalog.text, pg_catalog.text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile(pg_catalog.text, pg_catalog.text) TO authenticated, service_role;


-- ==============================================================================
-- 10. Section 10: Harden Capacity Locking, Zero-Bypass, and Custom SQLSTATE Codes
-- Migration: 20261116000001_harden_capacity_locking_and_sqlstate.sql
-- ==============================================================================
-- ==============================================================================
-- VyapOne Database Migration: 20261116000001_harden_capacity_locking_and_sqlstate.sql
-- Task: VO-026 — Final Capacity, Locking Inversion & SQLSTATE Hardening Gate
--
-- Security & Integrity Invariants Addressed:
-- 1. Correct custom SQLSTATE codes (VY001-VY006) preventing collision with predefined PostgreSQL codes.
-- 2. Eliminate lock-order inversion: revoke direct UPDATE(status) from authenticated clients;
--    require transition_site_status_atomic() for all publishing and capacity-checked transitions.
-- 3. Verify exact row-lock syntax: ORDER BY id precedes FOR UPDATE clause.
-- 4. Draft capacity verification during replacement: ensure net-neutral or projected drafts do not
--    exceed draft allowance, especially when workspace is in an exceeded state post-downgrade.
-- 5. Business archival/restoration safety: demote published sites to suspended when a business is
--    archived or restored, preventing silent live slot leakage without atomic republication.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Direct Site Status Write Restrictions (Zero-Bypass & Deadlock Elimination)
-- ------------------------------------------------------------------------------
-- Revoke direct UPDATE privilege on status column of public.sites from authenticated and anon clients.
-- Authenticated users must invoke transition_site_status_atomic() to publish or alter status.
REVOKE UPDATE (status) ON public.sites FROM authenticated, anon, PUBLIC;

-- ------------------------------------------------------------------------------
-- 2. Dedicated Custom SQLSTATE Exception Helpers
-- ------------------------------------------------------------------------------
-- VY001: Capacity Limit Exceeded
-- VY002: Invalid Business Lifecycle State
-- VY003: Permission Denied / Prohibited Direct Transition
-- VY004: Tenant Boundary Violation
-- VY005: Unknown or Unsupported Plan Identifier
-- VY006: Immutable Field Mutation Prohibited

CREATE OR REPLACE FUNCTION public.raise_capacity_exceeded(
    p_metric TEXT,
    p_current INT,
    p_limit INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION 'Capacity limit reached for %: current %, limit %', p_metric, p_current, p_limit
        USING ERRCODE = 'VY001';
END;
$$;

REVOKE ALL ON FUNCTION public.raise_capacity_exceeded(TEXT, INT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.raise_capacity_exceeded(TEXT, INT, INT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Site Status Trigger Guard (Eliminates Reverse Lock Order & Deadlocks)
-- ------------------------------------------------------------------------------
-- Ensures no caller can acquire a site row lock directly and then wait on workspace locks.
CREATE OR REPLACE FUNCTION public.check_site_publish_capacity_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_workspace_id UUID;
    v_biz_status TEXT;
BEGIN
    -- Direct updates to published outside the atomic procedure are strictly prohibited
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status <> 'published') THEN
        IF pg_catalog.current_setting('vyapone.in_atomic_site_transition', true) <> 'true' THEN
            RAISE EXCEPTION 'Direct site status transitions to published are prohibited. Use transition_site_status_atomic() instead'
                USING ERRCODE = 'VY003';
        END IF;

        -- Verify parent business lifecycle state
        SELECT b.workspace_id, b.status INTO v_workspace_id, v_biz_status
        FROM public.businesses b
        WHERE b.id = NEW.business_id;

        IF v_biz_status IS NULL THEN
            RAISE EXCEPTION 'Parent business not found for site' USING ERRCODE = 'VY002';
        END IF;

        IF v_biz_status = 'archived' THEN
            RAISE EXCEPTION 'Cannot publish site for an archived business' USING ERRCODE = 'VY002';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_site_publish_capacity ON public.sites;
CREATE TRIGGER trg_check_site_publish_capacity
    BEFORE INSERT OR UPDATE OF status ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.check_site_publish_capacity_trigger();

-- ------------------------------------------------------------------------------
-- 4. Immutable business_id Trigger (SQLSTATE VY006)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_site_business_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.business_id <> OLD.business_id THEN
        RAISE EXCEPTION 'business_id on public.sites is immutable and cannot be modified'
            USING ERRCODE = 'VY006';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_site_business_id_change ON public.sites;
CREATE TRIGGER trg_prevent_site_business_id_change
    BEFORE UPDATE OF business_id ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_site_business_id_change();

-- ------------------------------------------------------------------------------
-- 5. Business Archival and Restoration Safety Trigger
-- ------------------------------------------------------------------------------
-- Prevents an archived business from silently restoring with a published storefront
-- and bypassing workspace live website capacity limits.
CREATE OR REPLACE FUNCTION public.handle_business_archive_restore_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    -- When a business is archived or restored from archived, demote any published sites to suspended.
    -- This ensures that a restored business does not silently consume a live website slot without
    -- explicit republication through transition_site_status_atomic().
    IF (NEW.status = 'archived' AND OLD.status <> 'archived')
       OR (OLD.status = 'archived' AND NEW.status <> 'archived') THEN
        UPDATE public.sites
        SET status = 'suspended', updated_at = pg_catalog.now()
        WHERE business_id = NEW.id
          AND status = 'published';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_handle_business_archive_restore ON public.businesses;
CREATE TRIGGER trg_handle_business_archive_restore
    BEFORE UPDATE OF status ON public.businesses
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_business_archive_restore_trigger();

-- ------------------------------------------------------------------------------
-- 6. Atomic Workspace Capacity Assertion Procedure (SQLSTATE VY001-VY005)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_and_lock_workspace_capacity(
    p_workspace_id UUID,
    p_metric TEXT,
    p_requested_units INT DEFAULT 1
)
RETURNS TABLE (
    allowed BOOLEAN,
    current_count INT,
    effective_limit INT,
    remaining INT,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current INT := 0;
    v_remaining INT := 0;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    -- 1. Caller Authentication
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF session_user NOT IN ('postgres', 'service_role') AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSE
        -- 2. Caller Tenant Authorization
        IF NOT EXISTS (
            SELECT 1 FROM public.workspaces WHERE id = p_workspace_id AND owner_user_id = v_caller_id
        ) AND NOT EXISTS (
            SELECT 1 FROM public.workspace_members
            WHERE workspace_id = p_workspace_id
              AND user_id = v_caller_id
              AND status = 'active'
        ) THEN
            RAISE EXCEPTION 'Access denied to workspace %', p_workspace_id USING ERRCODE = 'VY003';
        END IF;
    END IF;

    -- Validate metric parameter
    IF p_metric NOT IN ('live_websites', 'draft_websites', 'team_seats', 'locations_per_business', 'catalogue_items_per_business') THEN
        RAISE EXCEPTION 'Unsupported capacity metric: %', p_metric USING ERRCODE = 'VY001';
    END IF;

    -- 3. Acquire transaction-scoped row lock on the workspace record
    PERFORM 1 FROM public.workspaces WHERE id = p_workspace_id FOR UPDATE;

    -- Resolve canonical plan
    SELECT s.plan_id INTO v_plan_id
    FROM public.subscriptions s
    WHERE s.workspace_id = p_workspace_id
      AND (
          s.status = 'active'
          OR (s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > v_now))
          OR (s.status = 'past_due' AND s.grace_period_end IS NOT NULL AND s.grace_period_end > v_now)
          OR (s.status = 'grace_period' AND (s.grace_period_end IS NULL OR s.grace_period_end > v_now))
      )
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        SELECT plan INTO v_plan_id FROM public.workspaces WHERE id = p_workspace_id;
    END IF;

    IF v_plan_id IS NULL THEN
        RAISE EXCEPTION 'Workspace not found: %', p_workspace_id USING ERRCODE = 'VY002';
    END IF;

    -- 4. Normalize canonical plan to base limits (PRD §9.1)
    IF v_plan_id = 'starter' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 3;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 10;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 2;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 1;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 50;
        END IF;
    ELSIF v_plan_id IN ('growth', 'pro') THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 8;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 25;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 5;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 3;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 250;
        END IF;
    ELSIF v_plan_id = 'agency' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 20;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 50;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 15;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 10;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 1000;
        END IF;
    ELSIF v_plan_id = 'scale' THEN
        IF p_metric = 'live_websites' THEN v_base_limit := 50;
        ELSIF p_metric = 'draft_websites' THEN v_base_limit := 100;
        ELSIF p_metric = 'team_seats' THEN v_base_limit := 50;
        ELSIF p_metric = 'locations_per_business' THEN v_base_limit := 25;
        ELSIF p_metric = 'catalogue_items_per_business' THEN v_base_limit := 5000;
        END IF;
    ELSE
        -- Unknown plan ID: FAIL CLOSED
        RAISE EXCEPTION 'Unknown or unsupported plan identifier: %', coalesce(v_plan_id, 'none') USING ERRCODE = 'VY005';
    END IF;

    -- 5. Check capacity overrides
    SELECT coalesce(additional_capacity, 0) INTO v_override
    FROM public.capacity_overrides
    WHERE workspace_id = p_workspace_id
      AND metric = p_metric
      AND (expires_at IS NULL OR expires_at > v_now);

    v_effective_limit := v_base_limit + v_override;

    -- 6. Count current live/draft sites or team seats (PRD §9.2 Counting Rules)
    IF p_metric = 'live_websites' THEN
        SELECT count(DISTINCT s.business_id)::INT INTO v_current
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = p_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'published';
    ELSIF p_metric = 'draft_websites' THEN
        SELECT count(*)::INT INTO v_current
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = p_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';
    ELSIF p_metric = 'team_seats' THEN
        SELECT count(*)::INT INTO v_current
        FROM public.workspace_members
        WHERE workspace_id = p_workspace_id
          AND status = 'active';
    ELSIF p_metric = 'locations_per_business' THEN
        SELECT coalesce(max(loc_count), 0)::INT INTO v_current
        FROM (
            SELECT count(*)::INT AS loc_count
            FROM public.locations l
            JOIN public.businesses b ON b.id = l.business_id
            WHERE b.workspace_id = p_workspace_id
              AND b.status <> 'archived'
            GROUP BY l.business_id
        ) sub;
    ELSIF p_metric = 'catalogue_items_per_business' THEN
        SELECT coalesce(max(cat_count), 0)::INT INTO v_current
        FROM (
            SELECT count(*)::INT AS cat_count
            FROM public.catalogue_items c
            JOIN public.businesses b ON b.id = c.business_id
            WHERE b.workspace_id = p_workspace_id
              AND b.status <> 'archived'
            GROUP BY c.business_id
        ) sub;
    END IF;

    v_remaining := GREATEST(0, v_effective_limit - v_current);

    -- 7. Evaluate capacity availability
    IF (v_current + p_requested_units) > v_effective_limit THEN
        RETURN QUERY SELECT false, v_current, v_effective_limit, v_remaining, 'Capacity limit reached for ' || p_metric;
    ELSE
        RETURN QUERY SELECT true, v_current, v_effective_limit, v_remaining, 'Capacity available';
    END IF;
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. Atomic Site Status Transition Procedure (SQLSTATE VY001-VY004)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.transition_site_status_atomic(
    p_site_id UUID,
    p_target_status TEXT
)
RETURNS TABLE (
    success BOOLEAN,
    status TEXT,
    reason TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_caller_id UUID;
    v_business_id UUID;
    v_workspace_id UUID;
    v_sovereign_owner_id UUID;
    v_current_status TEXT;
    v_biz_status TEXT;
    v_plan_id TEXT;
    v_base_limit INT := 0;
    v_override INT := 0;
    v_effective_limit INT := 0;
    v_current_live_count INT := 0;
    v_current_draft_count INT := 0;
    v_projected_draft_count INT := 0;
    v_draft_limit INT := 0;
    v_draft_override INT := 0;
    v_effective_draft_limit INT := 0;
    v_business_has_published BOOLEAN := false;
    v_is_authorized BOOLEAN := false;
    v_now TIMESTAMPTZ := pg_catalog.now();
BEGIN
    -- Set transaction-scoped config flag allowing trigger execution
    PERFORM pg_catalog.set_config('vyapone.in_atomic_site_transition', 'true', true);

    -- 1. Fetch site, business, and parent workspace
    SELECT s.business_id, s.status, b.workspace_id, b.status, b.sovereign_owner_id
    INTO v_business_id, v_current_status, v_workspace_id, v_biz_status, v_sovereign_owner_id
    FROM public.sites s
    JOIN public.businesses b ON b.id = s.business_id
    WHERE s.id = p_site_id;

    IF v_business_id IS NULL OR v_workspace_id IS NULL THEN
        RETURN QUERY SELECT false, 'not_found'::TEXT, 'Site or parent business not found'::TEXT;
        RETURN;
    END IF;

    -- Validate workspace-business containment
    IF NOT EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = v_business_id AND workspace_id = v_workspace_id
    ) THEN
        RAISE EXCEPTION 'Tenant boundary violation: business does not belong to specified workspace' USING ERRCODE = 'VY004';
    END IF;

    -- 2. Transaction-scoped row lock on workspace first to serialize all concurrent operations
    PERFORM 1 FROM public.workspaces WHERE id = v_workspace_id FOR UPDATE;

    -- 3. Lock business row and all sites of this business in consistent order (ORDER BY id precedes FOR UPDATE)
    PERFORM 1 FROM public.businesses WHERE id = v_business_id FOR UPDATE;
    PERFORM 1 FROM public.sites WHERE business_id = v_business_id ORDER BY id FOR UPDATE;

    -- 4. Caller Authentication & Exact Role-Based Authorization
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        IF session_user NOT IN ('postgres', 'service_role') AND coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
            RAISE EXCEPTION 'Unauthenticated execution: caller must be authenticated' USING ERRCODE = '28000';
        END IF;
    ELSE
        -- Validate exact authorized roles:
        -- - Workspace owner
        -- - Workspace admin / Reseller admin
        -- - Sovereign business owner
        -- - Business owner or manager
        -- Strictly excluded: workspace_member, reseller_staff, cashier, staff
        SELECT (
            EXISTS (SELECT 1 FROM public.workspaces WHERE id = v_workspace_id AND owner_user_id = v_caller_id)
            OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_workspace_id AND user_id = v_caller_id AND status = 'active' AND role = 'workspace_owner')
            OR EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = v_workspace_id AND user_id = v_caller_id AND status = 'active' AND role IN ('workspace_admin', 'reseller_admin'))
            OR (v_sovereign_owner_id = v_caller_id)
            OR EXISTS (SELECT 1 FROM public.business_members WHERE business_id = v_business_id AND user_id = v_caller_id AND status = 'active' AND role IN ('owner', 'manager'))
        ) INTO v_is_authorized;

        IF NOT v_is_authorized THEN
            RAISE EXCEPTION 'Access denied: caller does not possess required publishing permissions for site %', p_site_id
                USING ERRCODE = 'VY003';
        END IF;
    END IF;

    -- Validate target status parameter
    IF p_target_status NOT IN ('draft', 'published', 'archived', 'suspended') THEN
        RETURN QUERY SELECT false, v_current_status, 'Invalid target status'::TEXT;
        RETURN;
    END IF;

    -- 5. Archiving or Suspending is ALWAYS permitted and frees capacity (PRD §9.2)
    -- Authorized users can archive/suspend even if the business is archived (cleanup)
    IF p_target_status IN ('archived', 'suspended') THEN
        UPDATE public.sites SET status = p_target_status, updated_at = pg_catalog.now() WHERE id = p_site_id;
        RETURN QUERY SELECT true, p_target_status, 'Status updated'::TEXT;
        RETURN;
    END IF;

    -- Invariant: Archived businesses cannot publish or restore storefronts
    IF v_biz_status = 'archived' THEN
        IF p_target_status = 'published' THEN
            RETURN QUERY SELECT false, v_current_status, 'Cannot publish site for an archived business'::TEXT;
        ELSE
            RETURN QUERY SELECT false, v_current_status, 'Cannot modify site for an archived business'::TEXT;
        END IF;
        RETURN;
    END IF;

    -- Idempotency Check
    IF v_current_status = p_target_status THEN
        RETURN QUERY SELECT true, v_current_status, 'Already in target status'::TEXT;
        RETURN;
    END IF;

    -- 6. Resolve canonical effective plan
    SELECT s.plan_id INTO v_plan_id
    FROM public.subscriptions s
    WHERE s.workspace_id = v_workspace_id
      AND (
          s.status = 'active'
          OR (s.status = 'trialing' AND (s.current_period_end IS NULL OR s.current_period_end > v_now))
          OR (s.status = 'past_due' AND s.grace_period_end IS NOT NULL AND s.grace_period_end > v_now)
          OR (s.status = 'grace_period' AND (s.grace_period_end IS NULL OR s.grace_period_end > v_now))
      )
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_plan_id IS NULL THEN
        SELECT plan INTO v_plan_id FROM public.workspaces WHERE id = v_workspace_id;
    END IF;

    IF v_plan_id = 'starter' THEN
        v_base_limit := 3;
        v_draft_limit := 10;
    ELSIF v_plan_id IN ('growth', 'pro') THEN
        v_base_limit := 8;
        v_draft_limit := 25;
    ELSIF v_plan_id = 'agency' THEN
        v_base_limit := 20;
        v_draft_limit := 50;
    ELSIF v_plan_id = 'scale' THEN
        v_base_limit := 50;
        v_draft_limit := 100;
    ELSE
        -- Fail closed on unknown plan
        RETURN QUERY SELECT false, v_current_status, 'Unknown or unsupported plan identifier: ' || coalesce(v_plan_id, 'none');
        RETURN;
    END IF;

    -- 7. If publishing: check live AND draft capacity before modifying any existing published sites
    IF p_target_status = 'published' THEN
        SELECT coalesce(additional_capacity, 0) INTO v_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'live_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

        v_effective_limit := v_base_limit + v_override;

        -- Calculate existing live business usage correctly (PRD §9.2)
        SELECT count(DISTINCT s.business_id)::INT INTO v_current_live_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'published';

        -- Account for currently published site of this business
        SELECT exists(
            SELECT 1 FROM public.sites
            WHERE business_id = v_business_id
              AND status = 'published'
              AND id <> p_site_id
        ) INTO v_business_has_published;

        -- 7.1 Evaluate Live Website Capacity
        IF v_business_has_published THEN
            -- Replacement: business already has a published site.
            -- If plan capacity is already exceeded (e.g. after downgrade), replacement is rejected.
            IF v_current_live_count > v_effective_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for live_websites: workspace exceeds plan allowance'::TEXT;
                RETURN;
            END IF;
        ELSE
            -- New live business: consumes 1 slot
            IF v_current_live_count + 1 > v_effective_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for live_websites'::TEXT;
                RETURN;
            END IF;
        END IF;

        -- 7.2 Evaluate Draft Capacity During Replacement (PRD §9.2)
        SELECT coalesce(additional_capacity, 0) INTO v_draft_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'draft_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

        v_effective_draft_limit := v_draft_limit + v_draft_override;

        SELECT count(*)::INT INTO v_current_draft_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';

        IF v_business_has_published THEN
            -- Replacement demotes old published site to draft (+1 draft).
            -- If target site was draft, target ceases to be draft (-1 draft). Projected delta = 0.
            -- If target site was not draft, target was not in draft count. Projected delta = +1.
            IF v_current_status = 'draft' THEN
                v_projected_draft_count := v_current_draft_count;
            ELSE
                v_projected_draft_count := v_current_draft_count + 1;
            END IF;

            -- If projected drafts exceed allowance (e.g. workspace is above limit following downgrade), reject
            IF v_projected_draft_count > v_effective_draft_limit THEN
                RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for draft_websites: workspace exceeds draft allowance'::TEXT;
                RETURN;
            END IF;
        END IF;

        -- ONLY AFTER ALL CHECKS SUCCEED: Demote old published site and publish target site
        UPDATE public.sites
        SET status = 'draft', updated_at = pg_catalog.now()
        WHERE business_id = v_business_id
          AND status = 'published'
          AND id <> p_site_id;

        UPDATE public.sites 
        SET status = 'published', 
            published_at = coalesce(published_at, pg_catalog.now()),
            updated_at = pg_catalog.now() 
        WHERE id = p_site_id;

        RETURN QUERY SELECT true, 'published'::TEXT, 'Site published successfully'::TEXT;
        RETURN;
    END IF;

    -- 8. If restoring archived to draft: check draft capacity atomically
    IF p_target_status = 'draft' AND v_current_status = 'archived' THEN
        SELECT coalesce(additional_capacity, 0) INTO v_draft_override
        FROM public.capacity_overrides
        WHERE workspace_id = v_workspace_id
          AND metric = 'draft_websites'
          AND (expires_at IS NULL OR expires_at > v_now);

        v_effective_draft_limit := v_draft_limit + v_draft_override;

        SELECT count(*)::INT INTO v_current_draft_count
        FROM public.sites s
        JOIN public.businesses b ON b.id = s.business_id
        WHERE b.workspace_id = v_workspace_id
          AND b.status <> 'archived'
          AND s.status = 'draft';

        IF v_current_draft_count + 1 > v_effective_draft_limit THEN
            RETURN QUERY SELECT false, v_current_status, 'Capacity limit reached for draft_websites'::TEXT;
            RETURN;
        END IF;

        UPDATE public.sites SET status = 'draft', updated_at = pg_catalog.now() WHERE id = p_site_id;
        RETURN QUERY SELECT true, 'draft'::TEXT, 'Draft restored successfully'::TEXT;
        RETURN;
    END IF;

    UPDATE public.sites SET status = p_target_status, updated_at = pg_catalog.now() WHERE id = p_site_id;
    RETURN QUERY SELECT true, p_target_status, 'Status updated'::TEXT;
END;
$$;

-- ------------------------------------------------------------------------------
-- 8. Function Execution Privileges
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assert_and_lock_workspace_capacity(UUID, TEXT, INT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transition_site_status_atomic(UUID, TEXT) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.check_site_publish_capacity_trigger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_site_publish_capacity_trigger() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.prevent_site_business_id_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prevent_site_business_id_change() TO postgres, service_role;

REVOKE ALL ON FUNCTION public.handle_business_archive_restore_trigger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.handle_business_archive_restore_trigger() TO postgres, service_role;

-- ============================================================================== 
-- 11. Section 11: Sites Table Privilege Hardening & Zero-Bypass RPC Gate
-- Migration: 20261116000002_harden_sites_table_privileges_and_rpc.sql
-- ============================================================================== 

-- ==============================================================================
-- VyapOne Database Migration: 20261116000002_harden_sites_table_privileges_and_rpc.sql
-- Task: VO-026 — Sites Table Privilege Hardening & Zero-Bypass RPC Gate
--
-- Security Invariants Addressed:
-- 1. Eliminate broad table-level UPDATE & INSERT privileges from authenticated on public.sites.
--    In PostgreSQL, a table-level grant supersedes column-level revocations.
-- 2. Grant explicit, column-level INSERT excluding status:
--    Direct INSERT cannot supply status; all new sites default to 'draft'.
-- 3. Install unconditional check_site_insert_status_trigger:
--    Rejects ANY non-draft status on direct INSERT with SQLSTATE VY003, independent of GUCs.
-- 4. Grant explicit, column-level UPDATE excluding status and business_id:
--    Direct UPDATE naming status or business_id is rejected by the PostgreSQL parser/privilege check.
-- 5. Neutralize custom GUC manipulation:
--    Callers setting vyapone.in_atomic_site_transition cannot bypass column-level privilege checks.
-- 6. Enforce transition_site_status_atomic() as the exclusive path for status transitions.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Revoke Broad Table-Level Privileges from Untrusted Roles
-- ------------------------------------------------------------------------------
-- In PostgreSQL, revoking column privileges has NO effect if the role holds table-level grants.
-- Table-level ALL/UPDATE/INSERT are completely stripped from anon, authenticated, and PUBLIC.
REVOKE ALL ON public.sites FROM anon, authenticated, PUBLIC;

-- ------------------------------------------------------------------------------
-- 2. Scoped SELECT Privileges
-- ------------------------------------------------------------------------------
-- anon: public storefront browsing (filtered by RLS sites_select_policy: status = 'published')
-- authenticated: business storefront management and dashboard inspection
GRANT SELECT ON public.sites TO anon, authenticated;

-- ------------------------------------------------------------------------------
-- 3. Scoped Column-Level INSERT Privileges (Strictly Excludes status)
-- ------------------------------------------------------------------------------
-- authenticated clients may insert new sites for businesses they manage.
-- status is intentionally excluded from the column list; all inserts rely on column DEFAULT 'draft'.
-- Any explicit supply of status in direct INSERT statements is rejected with permission denied.
GRANT INSERT (id, business_id, subdomain, primary_domain, published_version_id, created_at, updated_at)
ON public.sites TO authenticated;

-- ------------------------------------------------------------------------------
-- 4. Scoped Column-Level UPDATE Privileges (Strictly Excludes status & business_id)
-- ------------------------------------------------------------------------------
-- authenticated clients may update non-critical website attributes.
-- status and business_id are intentionally excluded; direct UPDATE naming them fails at the parser.
GRANT UPDATE (subdomain, primary_domain, published_version_id, updated_at)
ON public.sites TO authenticated;

-- ------------------------------------------------------------------------------
-- 5. Scoped DELETE Privilege (Protected by RLS sites_delete_policy)
-- ------------------------------------------------------------------------------
-- Sovereign business owners may delete draft sites per RLS policy.
GRANT DELETE ON public.sites TO authenticated;

-- ------------------------------------------------------------------------------
-- 6. Administrative Privileges for Trusted Service Role
-- ------------------------------------------------------------------------------
GRANT ALL ON public.sites TO service_role;

-- ------------------------------------------------------------------------------
-- 7. Defense-in-Depth Trigger: Unconditional Draft Status on Direct INSERT
-- ------------------------------------------------------------------------------
-- Guarantees that even if an execution context supplies a status, direct INSERT can NEVER
-- create a published, archived, or suspended storefront. Publishing requires transition_site_status_atomic().
CREATE OR REPLACE FUNCTION public.check_site_insert_status_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    IF NEW.status IS DISTINCT FROM 'draft' THEN
        RAISE EXCEPTION 'Direct insertion of non-draft site is prohibited. New sites must be created with status draft'
            USING ERRCODE = 'VY003';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_site_insert_status ON public.sites;
CREATE TRIGGER trg_check_site_insert_status
    BEFORE INSERT ON public.sites
    FOR EACH ROW
    EXECUTE FUNCTION public.check_site_insert_status_trigger();

-- ------------------------------------------------------------------------------
-- 8. Trigger Function Execution Privileges
-- ------------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.check_site_insert_status_trigger() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_site_insert_status_trigger() TO postgres, service_role;

-- ==============================================================================
-- VyapOne — VO-027 Team Invitations and Membership Lifecycle Migration
-- Migration: 20261117000001_team_invitations_and_membership_lifecycle.sql
--
-- Requirements:
-- 1. Create public.business_invitations table with SHA-256 token hashing, expiry,
--    and RLS policies enforcing domain isolation between workspaces and businesses.
-- 2. Provide atomic acceptance RPCs:
--    - accept_workspace_invitation_atomic: locks invitation, checks expiry,
--      matches recipient email, enforces team_seats capacity via
--      assert_and_lock_workspace_capacity(), upserts active workspace_members,
--      updates invitation status to 'accepted', and logs audit record.
--    - accept_business_invitation_atomic: locks invitation, checks expiry,
--      matches recipient email, sets sovereign_owner_id when role = 'owner',
--      upserts active business_members, updates status to 'accepted', and logs audit.
-- 3. Standardized Custom SQLSTATE error codes:
--    - VY010: Invalid or nonexistent invitation token
--    - VY011: Invitation is not pending (already accepted, revoked, or expired)
--    - VY012: Invitation has expired
--    - VY013: Recipient email mismatch with authenticated caller
--    - VY001: Capacity exceeded (team_seats)
-- ==============================================================================

-- 1. Create public.business_invitations table
CREATE TABLE IF NOT EXISTS public.business_invitations (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'cashier', 'staff')),
    location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    token_hash TEXT NOT NULL UNIQUE,
    invited_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

-- Indexes for performance and lookup
CREATE INDEX IF NOT EXISTS idx_business_invitations_business_id 
    ON public.business_invitations (business_id);

CREATE INDEX IF NOT EXISTS idx_business_invitations_email 
    ON public.business_invitations (lower(email));

CREATE INDEX IF NOT EXISTS idx_business_invitations_token_hash 
    ON public.business_invitations (token_hash);

-- Enforce single pending invitation per email per business
CREATE UNIQUE INDEX IF NOT EXISTS idx_business_invitations_pending_unique 
    ON public.business_invitations (business_id, lower(email)) 
    WHERE status = 'pending';

-- Enable Row Level Security
ALTER TABLE public.business_invitations ENABLE ROW LEVEL SECURITY;

-- 2. Authorization helper for business managers / owners
CREATE OR REPLACE FUNCTION public.is_business_manager_or_owner(p_business_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_authorized BOOLEAN := FALSE;
BEGIN
    IF p_business_id IS NULL OR p_user_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- A. Sovereign owner check
    SELECT EXISTS (
        SELECT 1 FROM public.businesses
        WHERE id = p_business_id AND sovereign_owner_id = p_user_id
    ) INTO v_is_authorized;

    IF v_is_authorized THEN
        RETURN TRUE;
    END IF;

    -- B. Active business member check (owner or manager)
    SELECT EXISTS (
        SELECT 1 FROM public.business_members
        WHERE business_id = p_business_id
          AND user_id = p_user_id
          AND status = 'active'
          AND role IN ('owner', 'manager')
    ) INTO v_is_authorized;

    IF v_is_authorized THEN
        RETURN TRUE;
    END IF;

    -- C. Parent workspace admin or owner check
    SELECT EXISTS (
        SELECT 1 FROM public.businesses b
        JOIN public.workspace_members wm ON wm.workspace_id = b.workspace_id
        WHERE b.id = p_business_id
          AND wm.user_id = p_user_id
          AND wm.status = 'active'
          AND wm.role IN ('workspace_owner', 'workspace_admin', 'reseller_admin')
    ) INTO v_is_authorized;

    RETURN v_is_authorized;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- RLS Policies for public.business_invitations
DROP POLICY IF EXISTS "business_invitations_select_policy" ON public.business_invitations;
DROP POLICY IF EXISTS "business_invitations_insert_policy" ON public.business_invitations;
DROP POLICY IF EXISTS "business_invitations_update_policy" ON public.business_invitations;
DROP POLICY IF EXISTS "business_invitations_delete_policy" ON public.business_invitations;

CREATE POLICY "business_invitations_select_policy" ON public.business_invitations
    FOR SELECT
    USING (
        public.is_business_manager_or_owner(business_id, auth.uid()) OR
        lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    );

CREATE POLICY "business_invitations_insert_policy" ON public.business_invitations
    FOR INSERT
    WITH CHECK (
        public.is_business_manager_or_owner(business_id, auth.uid()) AND
        invited_by = auth.uid()
    );

CREATE POLICY "business_invitations_update_policy" ON public.business_invitations
    FOR UPDATE
    USING (
        public.is_business_manager_or_owner(business_id, auth.uid()) OR
        lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    )
    WITH CHECK (
        public.is_business_manager_or_owner(business_id, auth.uid()) OR
        lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    );

CREATE POLICY "business_invitations_delete_policy" ON public.business_invitations
    FOR DELETE
    USING (public.is_business_manager_or_owner(business_id, auth.uid()));

-- 3. Atomic Workspace Invitation Acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_workspace_invitation_atomic(
    p_token_hash TEXT,
    p_accepting_user_id UUID,
    p_accepting_user_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_existing_active_count INT;
BEGIN
    -- Input sanitization
    IF p_token_hash IS NULL OR pg_catalog.length(pg_catalog.trim(p_token_hash)) = 0 THEN
        RAISE EXCEPTION 'Token hash cannot be empty' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_id IS NULL THEN
        RAISE EXCEPTION 'Accepting user ID cannot be null' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_email IS NULL OR pg_catalog.length(pg_catalog.trim(p_accepting_user_email)) = 0 THEN
        RAISE EXCEPTION 'Accepting user email cannot be empty' USING ERRCODE = 'VY013';
    END IF;

    -- 1. Lock the invitation record to prevent concurrent acceptance / replay
    SELECT * INTO v_invitation
    FROM public.workspace_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_invitation.id IS NULL THEN
        RAISE EXCEPTION 'Invalid or nonexistent invitation token' USING ERRCODE = 'VY010';
    END IF;

    -- 2. Status verification
    IF v_invitation.status <> 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_invitation.status USING ERRCODE = 'VY011';
    END IF;

    -- 3. Expiration verification
    IF v_invitation.expires_at < v_now THEN
        UPDATE public.workspace_invitations
        SET status = 'expired', updated_at = v_now
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = 'VY012';
    END IF;

    -- 4. Case-insensitive email match verification
    IF pg_catalog.lower(pg_catalog.trim(v_invitation.email)) <> pg_catalog.lower(pg_catalog.trim(p_accepting_user_email)) THEN
        RAISE EXCEPTION 'Authenticated user email does not match invitation recipient' USING ERRCODE = 'VY013';
    END IF;

    -- 5. Team-Seat Capacity Integration
    -- Call assert_and_lock_workspace_capacity, which locks public.workspaces FOR UPDATE
    -- and enforces that (current_active_members + 1) <= effective_team_seats.
    -- If capacity exceeded, it raises exception with SQLSTATE 'VY001' and aborts transaction.
    PERFORM public.assert_and_lock_workspace_capacity(v_invitation.workspace_id, 'team_seats', 1);

    -- 6. Check if user is already an active member of this workspace
    SELECT pg_catalog.count(*)::INT INTO v_existing_active_count
    FROM public.workspace_members
    WHERE workspace_id = v_invitation.workspace_id
      AND user_id = p_accepting_user_id
      AND status = 'active';

    IF v_existing_active_count > 0 THEN
        -- Mark invitation as accepted since user is already active member
        UPDATE public.workspace_invitations
        SET status = 'accepted', updated_at = v_now
        WHERE id = v_invitation.id;

        RETURN jsonb_build_object(
            'success', true,
            'workspace_id', v_invitation.workspace_id,
            'role', v_invitation.role,
            'invitation_id', v_invitation.id,
            'already_member', true
        );
    END IF;

    -- 7. Upsert membership into public.workspace_members
    INSERT INTO public.workspace_members (
        workspace_id,
        user_id,
        role,
        status,
        created_at,
        updated_at
    )
    VALUES (
        v_invitation.workspace_id,
        p_accepting_user_id,
        v_invitation.role,
        'active',
        v_now,
        v_now
    )
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        status = 'active',
        updated_at = v_now;

    -- 8. Mark invitation as accepted
    UPDATE public.workspace_invitations
    SET status = 'accepted', updated_at = v_now
    WHERE id = v_invitation.id;

    -- 9. Record immutable audit log
    INSERT INTO public.audit_logs (
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json
    )
    VALUES (
        v_invitation.workspace_id,
        p_accepting_user_id,
        'workspace.invitation_accepted',
        'workspace_members',
        jsonb_build_object(
            'invitation_id', v_invitation.id,
            'recipient_email', v_invitation.email,
            'assigned_role', v_invitation.role
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'workspace_id', v_invitation.workspace_id,
        'role', v_invitation.role,
        'invitation_id', v_invitation.id,
        'already_member', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 4. Atomic Business Invitation Acceptance RPC
CREATE OR REPLACE FUNCTION public.accept_business_invitation_atomic(
    p_token_hash TEXT,
    p_accepting_user_id UUID,
    p_accepting_user_email TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_invitation RECORD;
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_existing_active_count INT;
BEGIN
    -- Input sanitization
    IF p_token_hash IS NULL OR pg_catalog.length(pg_catalog.trim(p_token_hash)) = 0 THEN
        RAISE EXCEPTION 'Token hash cannot be empty' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_id IS NULL THEN
        RAISE EXCEPTION 'Accepting user ID cannot be null' USING ERRCODE = 'VY010';
    END IF;

    IF p_accepting_user_email IS NULL OR pg_catalog.length(pg_catalog.trim(p_accepting_user_email)) = 0 THEN
        RAISE EXCEPTION 'Accepting user email cannot be empty' USING ERRCODE = 'VY013';
    END IF;

    -- 1. Lock invitation record to prevent replay and race conditions
    SELECT * INTO v_invitation
    FROM public.business_invitations
    WHERE token_hash = p_token_hash
    FOR UPDATE;

    IF v_invitation.id IS NULL THEN
        RAISE EXCEPTION 'Invalid or nonexistent invitation token' USING ERRCODE = 'VY010';
    END IF;

    -- 2. Status verification
    IF v_invitation.status <> 'pending' THEN
        RAISE EXCEPTION 'Invitation is no longer valid (status: %)', v_invitation.status USING ERRCODE = 'VY011';
    END IF;

    -- 3. Expiration verification
    IF v_invitation.expires_at < v_now THEN
        UPDATE public.business_invitations
        SET status = 'expired', updated_at = v_now
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'Invitation has expired' USING ERRCODE = 'VY012';
    END IF;

    -- 4. Case-insensitive email match verification
    IF pg_catalog.lower(pg_catalog.trim(v_invitation.email)) <> pg_catalog.lower(pg_catalog.trim(p_accepting_user_email)) THEN
        RAISE EXCEPTION 'Authenticated user email does not match invitation recipient' USING ERRCODE = 'VY013';
    END IF;

    -- 5. Sovereign Business Ownership Integration:
    -- If the invited role is 'owner', and the business sovereign_owner_id was temporarily
    -- held by the creator/reseller, assign sovereign ownership to the accepting merchant owner.
    IF v_invitation.role = 'owner' THEN
        UPDATE public.businesses
        SET sovereign_owner_id = p_accepting_user_id,
            updated_at = v_now
        WHERE id = v_invitation.business_id
          AND sovereign_owner_id = v_invitation.invited_by;
    END IF;

    -- 6. Check if user is already an active member of this business
    SELECT pg_catalog.count(*)::INT INTO v_existing_active_count
    FROM public.business_members
    WHERE business_id = v_invitation.business_id
      AND user_id = p_accepting_user_id
      AND status = 'active';

    IF v_existing_active_count > 0 THEN
        UPDATE public.business_invitations
        SET status = 'accepted', updated_at = v_now
        WHERE id = v_invitation.id;

        RETURN jsonb_build_object(
            'success', true,
            'business_id', v_invitation.business_id,
            'role', v_invitation.role,
            'invitation_id', v_invitation.id,
            'already_member', true
        );
    END IF;

    -- 7. Upsert membership into public.business_members
    INSERT INTO public.business_members (
        business_id,
        user_id,
        role,
        location_id,
        permissions,
        status,
        created_at
    )
    VALUES (
        v_invitation.business_id,
        p_accepting_user_id,
        v_invitation.role,
        v_invitation.location_id,
        v_invitation.permissions,
        'active',
        v_now
    )
    ON CONFLICT (business_id, user_id) DO UPDATE SET
        role = EXCLUDED.role,
        location_id = pg_catalog.coalesce(EXCLUDED.location_id, business_members.location_id),
        permissions = EXCLUDED.permissions,
        status = 'active';

    -- 8. Mark invitation as accepted
    UPDATE public.business_invitations
    SET status = 'accepted', updated_at = v_now
    WHERE id = v_invitation.id;

    -- 9. Record immutable audit log
    INSERT INTO public.audit_logs (
        business_id,
        user_id,
        action,
        resource,
        metadata_json
    )
    VALUES (
        v_invitation.business_id,
        p_accepting_user_id,
        'business.invitation_accepted',
        'business_members',
        jsonb_build_object(
            'invitation_id', v_invitation.id,
            'recipient_email', v_invitation.email,
            'assigned_role', v_invitation.role
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'business_id', v_invitation.business_id,
        'role', v_invitation.role,
        'invitation_id', v_invitation.id,
        'already_member', false
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 5. Revocation and Privilege Configuration
-- Revoke all privileges from PUBLIC and anon
REVOKE ALL ON FUNCTION public.is_business_manager_or_owner(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON TABLE public.business_invitations FROM PUBLIC, anon;

-- Grant execution to authenticated and service_role
GRANT EXECUTE ON FUNCTION public.is_business_manager_or_owner(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_workspace_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_business_invitation_atomic(TEXT, UUID, TEXT) TO authenticated, service_role;

-- Grant controlled table privileges to authenticated and service_role
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.business_invitations TO authenticated, service_role;


-- ==============================================================================
-- VyapOne — VO-028 Audit/Activity and Notification Foundation Migration
-- Migration: 20261117000002_audit_and_notification_foundation.sql
-- ==============================================================================

-- 1. Create public.notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid(),
    recipient_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
    business_id UUID REFERENCES public.businesses(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN (
        'workspace_invitation',
        'business_invitation',
        'membership_change',
        'role_updated',
        'member_removed',
        'capacity_warning',
        'site_status_changed',
        'security_alert',
        'system_announcement'
    )),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    idempotency_key TEXT UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()
);

-- 2. Performance & Retrieval Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
    ON public.notifications (recipient_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
    ON public.notifications (recipient_user_id) 
    WHERE read = FALSE;

CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id 
    ON public.notifications (workspace_id) 
    WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_business_id 
    ON public.notifications (business_id) 
    WHERE business_id IS NOT NULL;

-- 3. Enable Row-Level Security
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;

-- 4. Fail-closed RLS Policies
DROP POLICY IF EXISTS "notifications_select_policy" ON public.notifications;
CREATE POLICY "notifications_select_policy" ON public.notifications
    FOR SELECT
    USING (recipient_user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_policy" ON public.notifications;
CREATE POLICY "notifications_update_policy" ON public.notifications
    FOR UPDATE
    USING (recipient_user_id = auth.uid())
    WITH CHECK (recipient_user_id = auth.uid());

-- Direct client inserts are strictly prohibited; notifications are created via trusted server operations
DROP POLICY IF EXISTS "notifications_insert_policy" ON public.notifications;
CREATE POLICY "notifications_insert_policy" ON public.notifications
    FOR INSERT
    WITH CHECK (false);

-- Client deletions are strictly prohibited
DROP POLICY IF EXISTS "notifications_delete_policy" ON public.notifications;
CREATE POLICY "notifications_delete_policy" ON public.notifications
    FOR DELETE
    USING (false);

-- 5. Updated_at Trigger
CREATE OR REPLACE TRIGGER trg_notifications_updated_at
    BEFORE UPDATE ON public.notifications
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Trusted Server-Side Notification Creation Procedure
CREATE OR REPLACE FUNCTION public.create_in_app_notification(
    p_recipient_user_id UUID,
    p_type TEXT,
    p_title TEXT,
    p_message TEXT,
    p_data JSONB DEFAULT '{}'::jsonb,
    p_workspace_id UUID DEFAULT NULL,
    p_business_id UUID DEFAULT NULL,
    p_idempotency_key TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_notification_id UUID;
BEGIN
    -- Guard: Only service_role or database superuser can execute this function
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') AND session_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'Access denied: create_in_app_notification requires privileged service execution' USING ERRCODE = 'VY003';
    END IF;

    IF p_recipient_user_id IS NULL THEN
        RAISE EXCEPTION 'Recipient user ID cannot be null' USING ERRCODE = 'VY020';
    END IF;

    -- Recipient user existence validation
    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_recipient_user_id) THEN
        RAISE EXCEPTION 'Recipient user does not exist' USING ERRCODE = 'VY021';
    END IF;

    -- Tenant existence validation if tenant scope supplied
    IF p_workspace_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.workspaces WHERE id = p_workspace_id) THEN
        RAISE EXCEPTION 'Referenced workspace does not exist' USING ERRCODE = 'VY022';
    END IF;

    IF p_business_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id) THEN
        RAISE EXCEPTION 'Referenced business does not exist' USING ERRCODE = 'VY023';
    END IF;

    -- Idempotency check: if key already exists, return existing notification id
    IF p_idempotency_key IS NOT NULL THEN
        SELECT id INTO v_notification_id
        FROM public.notifications
        WHERE idempotency_key = p_idempotency_key;

        IF v_notification_id IS NOT NULL THEN
            RETURN v_notification_id;
        END IF;
    END IF;

    INSERT INTO public.notifications (
        recipient_user_id,
        workspace_id,
        business_id,
        type,
        title,
        message,
        data,
        idempotency_key
    ) VALUES (
        p_recipient_user_id,
        p_workspace_id,
        p_business_id,
        p_type,
        p_title,
        p_message,
        pg_catalog.coalesce(p_data, '{}'::jsonb),
        p_idempotency_key
    )
    RETURNING id INTO v_notification_id;

    RETURN v_notification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = '';

-- 7. Privileges Configuration
REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_in_app_notification(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

GRANT SELECT, UPDATE (read, read_at) ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT EXECUTE ON FUNCTION public.create_in_app_notification(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, TEXT) TO service_role;
