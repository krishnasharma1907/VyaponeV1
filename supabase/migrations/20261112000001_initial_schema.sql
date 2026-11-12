-- ==============================================================================
-- VyapOne — Core Database Schema Migration
-- Migration: 20261112000001_initial_schema.sql
-- Authority: reference/PRD_VERSIONS/PRD_FINAL_v2_2026-11-03.md (§4, §15, §16, §17)
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
