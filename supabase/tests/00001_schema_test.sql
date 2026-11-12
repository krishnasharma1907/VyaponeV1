-- ==============================================================================
-- VyapOne — Core Schema pgTAP Verification Tests
-- Test Suite: supabase/tests/00001_schema_test.sql
-- Run Command: supabase test db
-- ==============================================================================

BEGIN;
SELECT plan(32);

-- 1. Check pgcrypto extension is installed
SELECT has_extension('pgcrypto', 'pgcrypto extension must be installed');

-- 2-15. Check all 14 canonical tables exist in public schema
SELECT has_table('public', 'users', 'public.users table exists');
SELECT has_table('public', 'user_auth_identities', 'public.user_auth_identities table exists');
SELECT has_table('public', 'workspaces', 'public.workspaces table exists');
SELECT has_table('public', 'workspace_members', 'public.workspace_members table exists');
SELECT has_table('public', 'businesses', 'public.businesses table exists');
SELECT has_table('public', 'locations', 'public.locations table exists');
SELECT has_table('public', 'business_members', 'public.business_members table exists');
SELECT has_table('public', 'sites', 'public.sites table exists');
SELECT has_table('public', 'catalogue_items', 'public.catalogue_items table exists');
SELECT has_table('public', 'customers', 'public.customers table exists');
SELECT has_table('public', 'orders', 'public.orders table exists');
SELECT has_table('public', 'invoice_sequences', 'public.invoice_sequences table exists');
SELECT has_table('public', 'bills', 'public.bills table exists');
SELECT has_table('public', 'audit_logs', 'public.audit_logs table exists');

-- 16-19. Verify Primary Keys are UUID types
SELECT col_type_is('public', 'users', 'id', 'uuid', 'users.id is uuid');
SELECT col_type_is('public', 'workspaces', 'id', 'uuid', 'workspaces.id is uuid');
SELECT col_type_is('public', 'businesses', 'id', 'uuid', 'businesses.id is uuid');
SELECT col_type_is('public', 'orders', 'id', 'uuid', 'orders.id is uuid');

-- 20-23. Verify Financial Amounts are strictly BIGINT minor units
SELECT col_type_is('public', 'catalogue_items', 'price_minor', 'bigint', 'catalogue_items.price_minor is bigint');
SELECT col_type_is('public', 'customers', 'total_spend_minor', 'bigint', 'customers.total_spend_minor is bigint');
SELECT col_type_is('public', 'orders', 'total_minor', 'bigint', 'orders.total_minor is bigint');
SELECT col_type_is('public', 'bills', 'total_minor', 'bigint', 'bills.total_minor is bigint');

-- 24-27. Verify Foreign Key relationships
SELECT col_is_fk('public', 'businesses', 'workspace_id', 'businesses.workspace_id is a foreign key');
SELECT col_is_fk('public', 'locations', 'business_id', 'locations.business_id is a foreign key');
SELECT col_is_fk('public', 'orders', 'business_id', 'orders.business_id is a foreign key');
SELECT col_is_fk('public', 'bills', 'business_id', 'bills.business_id is a foreign key');

-- 28-32. Verify Row-Level Security is active (Default Deny) on tenant tables
SELECT row_level_security_is_active('public', 'users', 'RLS is active on users');
SELECT row_level_security_is_active('public', 'workspaces', 'RLS is active on workspaces');
SELECT row_level_security_is_active('public', 'businesses', 'RLS is active on businesses');
SELECT row_level_security_is_active('public', 'orders', 'RLS is active on orders');
SELECT row_level_security_is_active('public', 'bills', 'RLS is active on bills');

SELECT * FROM finish();
ROLLBACK;
