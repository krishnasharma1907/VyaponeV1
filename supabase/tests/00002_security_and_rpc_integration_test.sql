-- ==============================================================================
-- VyapOne — Security, Invitation, Capacity, Concurrency & RLS pgTAP Tests
-- Test Suite: supabase/tests/00002_security_and_rpc_integration_test.sql
-- Tasks: CLOUD-007, CLOUD-009
-- Run Command: supabase test db
-- ==============================================================================

BEGIN;
SELECT plan(42);

-- Helper: Execute SQL statement under specified PostgreSQL role + JWT claim context,
-- rolling back any raised statement inside the subtransaction and capturing SQLSTATE.
CREATE OR REPLACE FUNCTION pg_temp.run_as_and_catch(
    p_role TEXT,
    p_user_id UUID,
    p_email TEXT,
    p_sql TEXT
)
RETURNS TABLE (threw BOOLEAN, sql_state TEXT, err_msg TEXT)
LANGUAGE plpgsql AS $$
DECLARE
    v_claims JSONB;
BEGIN
    IF p_user_id IS NOT NULL THEN
        v_claims := pg_catalog.jsonb_strip_nulls(
            pg_catalog.jsonb_build_object(
                'sub', p_user_id::TEXT,
                'role', COALESCE(p_role, 'authenticated'),
                'email', p_email
            )
        );
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user_id::TEXT, true);
        PERFORM pg_catalog.set_config('request.jwt.claims', v_claims::TEXT, true);
    ELSE
        PERFORM pg_catalog.set_config('request.jwt.claim.sub', '', true);
        PERFORM pg_catalog.set_config('request.jwt.claims', '{}', true);
    END IF;

    EXECUTE 'SET LOCAL ROLE ' || pg_catalog.quote_ident(p_role);
    EXECUTE p_sql;
    RESET ROLE;
    RETURN QUERY SELECT false, NULL::TEXT, NULL::TEXT;
EXCEPTION WHEN OTHERS THEN
    RESET ROLE;
    RETURN QUERY SELECT true, SQLSTATE::TEXT, SQLERRM::TEXT;
END;
$$;

-- Helper: Set active session role & JWT claims in current transaction scope.
CREATE OR REPLACE FUNCTION pg_temp.set_session_user(
    p_user_id UUID,
    p_email TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql AS $$
DECLARE
    v_claims JSONB;
BEGIN
    v_claims := pg_catalog.jsonb_strip_nulls(
        pg_catalog.jsonb_build_object(
            'sub', p_user_id::TEXT,
            'role', 'authenticated',
            'email', p_email
        )
    );
    PERFORM pg_catalog.set_config('request.jwt.claim.sub', p_user_id::TEXT, true);
    PERFORM pg_catalog.set_config('request.jwt.claims', v_claims::TEXT, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
END;
$$;

-- Deterministic test identities & fixtures (rolled back at end of pgTAP run)
INSERT INTO auth.users (id, aud, role, email)
VALUES
    ('a1000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated', 'pgtap-ws-owner@example.invalid'),
    ('a1000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated', 'pgtap-invitee-1@example.invalid'),
    ('a1000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated', 'pgtap-invitee-2@example.invalid'),
    ('a1000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated', 'pgtap-biz-owner2@example.invalid'),
    ('a1000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated', 'pgtap-manager@example.invalid'),
    ('a1000000-0000-4000-8000-000000000006', 'authenticated', 'authenticated', 'pgtap-staff@example.invalid'),
    ('a1000000-0000-4000-8000-000000000007', 'authenticated', 'authenticated', 'pgtap-cashier@example.invalid'),
    ('a1000000-0000-4000-8000-000000000008', 'authenticated', 'authenticated', 'pgtap-stranger@example.invalid')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, display_name, email, status)
VALUES
    ('a1000000-0000-4000-8000-000000000001', 'WS Owner', 'pgtap-ws-owner@example.invalid', 'active'),
    ('a1000000-0000-4000-8000-000000000002', 'Invitee One', 'pgtap-invitee-1@example.invalid', 'active'),
    ('a1000000-0000-4000-8000-000000000003', 'Invitee Two', 'pgtap-invitee-2@example.invalid', 'active'),
    ('a1000000-0000-4000-8000-000000000004', 'Biz Owner Two', 'pgtap-biz-owner2@example.invalid', 'active'),
    ('a1000000-0000-4000-8000-000000000005', 'Biz Manager', 'pgtap-manager@example.invalid', 'active'),
    ('a1000000-0000-4000-8000-000000000006', 'Biz Staff', 'pgtap-staff@example.invalid', 'active'),
    ('a1000000-0000-4000-8000-000000000007', 'Biz Cashier', 'pgtap-cashier@example.invalid', 'active'),
    ('a1000000-0000-4000-8000-000000000008', 'Stranger User', 'pgtap-stranger@example.invalid', 'active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.workspaces (id, name, slug, owner_user_id, status, plan)
VALUES
    ('b1000000-0000-4000-8000-000000000001', 'pgTAP Starter WS', 'pgtap-starter-ws', 'a1000000-0000-4000-8000-000000000001', 'active', 'starter'),
    ('b1000000-0000-4000-8000-000000000002', 'pgTAP Agency WS', 'pgtap-agency-ws', 'a1000000-0000-4000-8000-000000000008', 'active', 'agency');

-- Make WS Owner count as active seat #1 in starter workspace (team_seats = 2)
INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
VALUES
    ('b1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'workspace_owner', 'active'),
    ('b1000000-0000-4000-8000-000000000002', 'a1000000-0000-4000-8000-000000000008', 'workspace_owner', 'active');

INSERT INTO public.businesses (id, workspace_id, legal_name, trade_name, slug, sovereign_owner_id, status)
VALUES
    ('c1000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'pgTAP Primary Biz LLP', 'pgTAP Primary Biz', 'pgtap-primary-biz', 'a1000000-0000-4000-8000-000000000001', 'active'),
    ('c1000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000002', 'pgTAP Foreign Biz LLP', 'pgTAP Foreign Biz', 'pgtap-foreign-biz', 'a1000000-0000-4000-8000-000000000008', 'active');

INSERT INTO public.business_members (business_id, user_id, role, status)
VALUES
    ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'manager', 'active'),
    ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000006', 'staff', 'active'),
    ('c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000007', 'cashier', 'active');

INSERT INTO public.sites (id, business_id, subdomain, status)
VALUES
    ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'pgtap-primary-site', 'draft'),
    ('d1000000-0000-4000-8000-000000000002', 'c1000000-0000-4000-8000-000000000002', 'pgtap-foreign-site', 'draft');

INSERT INTO public.site_versions (id, site_id, business_id, version_number, schema_version, configuration, created_by)
VALUES
    ('e1000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 1, 'v1', '{"title":"V1"}'::jsonb, 'a1000000-0000-4000-8000-000000000001'),
    ('e1000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 2, 'v1', '{"title":"V2"}'::jsonb, 'a1000000-0000-4000-8000-000000000001');

UPDATE public.site_versions
SET published_at = now() - interval '1 hour'
WHERE id = 'e1000000-0000-4000-8000-000000000001';

UPDATE public.sites
SET current_draft_version_id = 'e1000000-0000-4000-8000-000000000002'
WHERE id = 'd1000000-0000-4000-8000-000000000001';

-- ==============================================================================
-- 1. pg_proc Metadata, SECURITY DEFINER, search_path, Grants & Notification Trigger (8 tests)
-- ==============================================================================
SELECT is(
    (
        SELECT pg_catalog.count(*)::INT
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'accept_workspace_invitation_atomic',
              'accept_business_invitation_atomic',
              'create_business_with_setup_atomic',
              'confirm_business_import_atomic',
              'assert_and_lock_workspace_capacity',
              'transition_site_status_atomic',
              'save_site_draft_configuration_atomic',
              'rollback_published_site_version_atomic',
              'publish_site_draft_atomic'
          )
          AND p.prosecdef = true
          AND 'search_path=' = ANY(p.proconfig)
    ),
    9,
    '1. All 9 critical security/remediated RPCs exist with SECURITY DEFINER and empty search_path'
);

SELECT is(
    (
        SELECT pg_catalog.count(*)::INT
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'accept_workspace_invitation_atomic',
              'accept_business_invitation_atomic',
              'create_business_with_setup_atomic',
              'confirm_business_import_atomic',
              'assert_and_lock_workspace_capacity',
              'transition_site_status_atomic',
              'save_site_draft_configuration_atomic',
              'rollback_published_site_version_atomic',
              'publish_site_draft_atomic'
          )
          AND has_function_privilege('anon', p.oid, 'EXECUTE')
    ),
    0,
    '2. anon has ZERO EXECUTE privileges on all 9 atomic RPCs'
);

SELECT is(
    (
        SELECT pg_catalog.count(*)::INT
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'accept_workspace_invitation_atomic',
              'accept_business_invitation_atomic',
              'create_business_with_setup_atomic',
              'confirm_business_import_atomic',
              'assert_and_lock_workspace_capacity',
              'transition_site_status_atomic',
              'save_site_draft_configuration_atomic',
              'rollback_published_site_version_atomic',
              'publish_site_draft_atomic'
          )
          AND has_function_privilege('public', p.oid, 'EXECUTE')
    ),
    0,
    '3. PUBLIC has ZERO EXECUTE privileges on all 9 atomic RPCs'
);

SELECT is(
    (
        SELECT pg_catalog.count(*)::INT
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'accept_workspace_invitation_atomic',
              'accept_business_invitation_atomic',
              'create_business_with_setup_atomic',
              'confirm_business_import_atomic',
              'assert_and_lock_workspace_capacity',
              'transition_site_status_atomic',
              'save_site_draft_configuration_atomic',
              'rollback_published_site_version_atomic',
              'publish_site_draft_atomic'
          )
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
    ),
    9,
    '4. authenticated holds EXECUTE privilege on all 9 atomic RPCs'
);

SELECT is(
    (
        SELECT pg_catalog.count(*)::INT
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname IN (
              'create_business_with_setup_atomic',
              'confirm_business_import_atomic',
              'save_site_draft_configuration_atomic'
          )
          AND has_function_privilege('service_role', p.oid, 'EXECUTE')
    ),
    0,
    '5. service_role remains revoked on create_business_with_setup_atomic, confirm_business_import_atomic, and save_site_draft_configuration_atomic'
);

SELECT is(
    has_table_privilege('anon', 'public.site_domains', 'SELECT'),
    false,
    '6. anon has no SELECT table privilege on public.site_domains'
);

SELECT is(
    (
        SELECT p.proname
        FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_proc p ON p.oid = t.tgfoid
        WHERE n.nspname = 'public'
          AND c.relname = 'notifications'
          AND t.tgname = 'trg_notifications_updated_at'
    ),
    'set_updated_at',
    '7. trg_notifications_updated_at targets public.set_updated_at()'
);

INSERT INTO public.notifications (id, recipient_user_id, type, title, message)
VALUES ('f1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000001', 'system_announcement', 'pgTAP', 'Check trigger');

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch('postgres', NULL, NULL, $$UPDATE public.notifications SET read = true WHERE id = 'f1000000-0000-4000-8000-000000000001'$$)),
    false,
    '8. Updating public.notifications succeeds without missing update_updated_at_column() error'
);

-- ==============================================================================
-- 2. accept_workspace_invitation_atomic & team_seats Capacity (12 tests)
-- ==============================================================================
INSERT INTO public.workspace_invitations (id, workspace_id, email, role, token_hash, invited_by, status, expires_at)
VALUES
    ('b2000000-0000-4000-8000-000000000001', 'b1000000-0000-4000-8000-000000000001', 'pgtap-invitee-1@example.invalid', 'reseller_staff', 'pgtap_ws_tok_1', 'a1000000-0000-4000-8000-000000000001', 'pending', now() + interval '1 day'),
    ('b2000000-0000-4000-8000-000000000002', 'b1000000-0000-4000-8000-000000000001', 'pgtap-invitee-2@example.invalid', 'reseller_staff', 'pgtap_ws_tok_2', 'a1000000-0000-4000-8000-000000000001', 'pending', now() + interval '1 day'),
    ('b2000000-0000-4000-8000-000000000003', 'b1000000-0000-4000-8000-000000000001', 'pgtap-invitee-1@example.invalid', 'reseller_staff', 'pgtap_ws_tok_dup_active', 'a1000000-0000-4000-8000-000000000001', 'pending', now() + interval '1 day'),
    ('b2000000-0000-4000-8000-000000000004', 'b1000000-0000-4000-8000-000000000001', 'pgtap-invitee-2@example.invalid', 'reseller_staff', 'pgtap_ws_tok_expired', 'a1000000-0000-4000-8000-000000000001', 'pending', now() - interval '1 hour');

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000002',
        'pgtap-invitee-1@example.invalid',
        $$SELECT public.accept_workspace_invitation_atomic('pgtap_ws_tok_1', 'a1000000-0000-4000-8000-000000000002', 'pgtap-invitee-1@example.invalid')$$
    )),
    false,
    '9. Valid non-member invitee accepts workspace invitation as authenticated user (seat 2 of 2)'
);

SELECT is(
    (SELECT pg_catalog.count(*)::INT FROM public.workspace_members WHERE workspace_id = 'b1000000-0000-4000-8000-000000000001' AND user_id = 'a1000000-0000-4000-8000-000000000002' AND role = 'reseller_staff' AND status = 'active'),
    1,
    '10. Valid acceptance inserts active workspace_members row with invited role'
);

SELECT is(
    (SELECT status FROM public.workspace_invitations WHERE id = 'b2000000-0000-4000-8000-000000000001'),
    'accepted',
    '11. Workspace invitation status transitions to accepted'
);

SELECT is(
    (SELECT pg_catalog.count(*)::INT FROM public.audit_logs WHERE workspace_id = 'b1000000-0000-4000-8000-000000000001' AND user_id = 'a1000000-0000-4000-8000-000000000002' AND action = 'workspace.invitation_accepted'),
    1,
    '12. Audit log records workspace.invitation_accepted event'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000008',
        'pgtap-stranger@example.invalid',
        $$SELECT public.accept_workspace_invitation_atomic('pgtap_ws_tok_2', 'a1000000-0000-4000-8000-000000000003', 'pgtap-invitee-2@example.invalid')$$
    )),
    'VY013',
    '13. Caller auth.uid() mismatch is rejected with VY013'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000008',
        'pgtap-stranger@example.invalid',
        $$SELECT public.accept_workspace_invitation_atomic('pgtap_ws_tok_2', 'a1000000-0000-4000-8000-000000000008', 'pgtap-invitee-2@example.invalid')$$
    )),
    'VY013',
    '14. Email spoofing against auth.users.email is rejected with VY013'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000002',
        'pgtap-invitee-1@example.invalid',
        $$SELECT public.accept_workspace_invitation_atomic('pgtap_ws_tok_1', 'a1000000-0000-4000-8000-000000000002', 'pgtap-invitee-1@example.invalid')$$
    )),
    'VY011',
    '15. Replay acceptance of already accepted workspace invitation fails with VY011'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000003',
        'pgtap-invitee-2@example.invalid',
        $$SELECT public.accept_workspace_invitation_atomic('pgtap_ws_tok_expired', 'a1000000-0000-4000-8000-000000000003', 'pgtap-invitee-2@example.invalid')$$
    )),
    'VY012',
    '16. Expired workspace invitation fails with VY012'
);

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000002',
        'pgtap-invitee-1@example.invalid',
        $$SELECT public.accept_workspace_invitation_atomic('pgtap_ws_tok_dup_active', 'a1000000-0000-4000-8000-000000000002', 'pgtap-invitee-1@example.invalid')$$
    )),
    false,
    '17. Existing active workspace member accepting pending invite succeeds without consuming extra seat'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000003',
        'pgtap-invitee-2@example.invalid',
        $$SELECT public.accept_workspace_invitation_atomic('pgtap_ws_tok_2', 'a1000000-0000-4000-8000-000000000003', 'pgtap-invitee-2@example.invalid')$$
    )),
    'VY001',
    '18. Starter workspace at 2/2 team_seats (zero capacity_overrides row) rejects 3rd member with VY001'
);

SELECT is(
    (SELECT pg_catalog.count(*)::INT FROM public.workspace_members WHERE workspace_id = 'b1000000-0000-4000-8000-000000000001' AND user_id = 'a1000000-0000-4000-8000-000000000003'),
    0,
    '19. Over-capacity rejection rolls back without inserting 3rd member'
);

INSERT INTO public.capacity_overrides (workspace_id, metric, additional_capacity, reason)
VALUES ('b1000000-0000-4000-8000-000000000001', 'team_seats', 1, 'pgTAP seat override');

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000003',
        'pgtap-invitee-2@example.invalid',
        $$SELECT public.accept_workspace_invitation_atomic('pgtap_ws_tok_2', 'a1000000-0000-4000-8000-000000000003', 'pgtap-invitee-2@example.invalid')$$
    )),
    false,
    '20. Workspace team_seats override (+1) permits 3rd invitee acceptance atomically'
);

-- ==============================================================================
-- 3. accept_business_invitation_atomic Security & Sovereign Owner Handoff (3 tests)
-- ==============================================================================
INSERT INTO public.business_invitations (id, business_id, email, role, token_hash, invited_by, status, expires_at)
VALUES
    ('c2000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'pgtap-biz-owner2@example.invalid', 'owner', 'pgtap_biz_tok_owner', 'a1000000-0000-4000-8000-000000000001', 'pending', now() + interval '1 day');

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000008',
        'pgtap-stranger@example.invalid',
        $$SELECT public.accept_business_invitation_atomic('pgtap_biz_tok_owner', 'a1000000-0000-4000-8000-000000000004', 'pgtap-biz-owner2@example.invalid')$$
    )),
    'VY013',
    '21. accept_business_invitation_atomic rejects caller identity spoofing with VY013'
);

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000004',
        'pgtap-biz-owner2@example.invalid',
        $$SELECT public.accept_business_invitation_atomic('pgtap_biz_tok_owner', 'a1000000-0000-4000-8000-000000000004', 'pgtap-biz-owner2@example.invalid')$$
    )),
    false,
    '22. Valid owner invitee accepts business invitation via authenticated session'
);

SELECT is(
    (SELECT sovereign_owner_id FROM public.businesses WHERE id = 'c1000000-0000-4000-8000-000000000001'),
    'a1000000-0000-4000-8000-000000000004'::UUID,
    '23. Business sovereign_owner_id transfers on owner invitation acceptance'
);

-- ==============================================================================
-- 4. Publish & Rollback VY049 Concurrency + Role Parity Across RPCs (10 tests)
-- ==============================================================================
SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000006',
        'pgtap-staff@example.invalid',
        $$SELECT public.save_site_draft_configuration_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000006', 'v1', '{"siteId":"d1000000-0000-4000-8000-000000000001","businessId":"c1000000-0000-4000-8000-000000000001","schemaVersion":"v1"}'::jsonb, 'Staff deny', ARRAY[]::uuid[], 2)$$
    )),
    'VY021',
    '24. staff cannot call save_site_draft_configuration_atomic (VY021)'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000006',
        'pgtap-staff@example.invalid',
        $$SELECT public.publish_site_draft_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000006', 'e1000000-0000-4000-8000-000000000002', 2)$$
    )),
    'VY020',
    '25. staff cannot call publish_site_draft_atomic (VY020)'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000007',
        'pgtap-cashier@example.invalid',
        $$SELECT public.rollback_published_site_version_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000007', 'e1000000-0000-4000-8000-000000000001', NULL)$$
    )),
    'VY020',
    '26. cashier cannot call rollback_published_site_version_atomic (VY020)'
);

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000005',
        'pgtap-manager@example.invalid',
        $$SELECT public.publish_site_draft_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000002', 2)$$
    )),
    false,
    '27. Active manager can publish draft version 2 via publish_site_draft_atomic'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000005',
        'pgtap-manager@example.invalid',
        $$SELECT public.publish_site_draft_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000002', 1)$$
    )),
    'VY049',
    '28. publish_site_draft_atomic rejects stale expected_draft_version_number with VY049'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000005',
        'pgtap-manager@example.invalid',
        $$SELECT public.publish_site_draft_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000002', NULL)$$
    )),
    'VY049',
    '29. publish_site_draft_atomic rejects NULL expected_draft_version_number with VY049'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000005',
        'pgtap-manager@example.invalid',
        $$SELECT public.rollback_published_site_version_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000099')$$
    )),
    'VY049',
    '30. rollback_published_site_version_atomic rejects stale published version expectation with VY049'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000005',
        'pgtap-manager@example.invalid',
        $$SELECT public.rollback_published_site_version_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001', NULL)$$
    )),
    'VY049',
    '31. rollback_published_site_version_atomic rejects NULL expectation when published_version_id is set (VY049)'
);

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000005',
        'pgtap-manager@example.invalid',
        $$SELECT public.rollback_published_site_version_atomic('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'a1000000-0000-4000-8000-000000000005', 'e1000000-0000-4000-8000-000000000001', 'e1000000-0000-4000-8000-000000000002')$$
    )),
    false,
    '32. Active manager can roll back published site when matching expected version v2 is supplied'
);

SELECT is(
    (SELECT published_version_id FROM public.sites WHERE id = 'd1000000-0000-4000-8000-000000000001'),
    'e1000000-0000-4000-8000-000000000001'::UUID,
    '33. sites.published_version_id switches cleanly to rolled-back v1'
);

-- ==============================================================================
-- 5. site_domains & qr_codes RLS Role Parity & Cross-Tenant Isolation (7 tests)
-- ==============================================================================
INSERT INTO public.site_domains (id, site_id, business_id, domain, status, verification_token, verification_target)
VALUES ('d2000000-0000-4000-8000-000000000001', 'd1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'pgtap-seed-domain.example.invalid', 'pending_verification', 'tok1', 'cname.vyapone.invalid');

SELECT is(
    (
        SELECT pg_catalog.count(*)::INT FROM (
            SELECT pg_temp.set_session_user('a1000000-0000-4000-8000-000000000006', 'pgtap-staff@example.invalid')
        ) s,
        public.site_domains sd
        WHERE sd.site_id = 'd1000000-0000-4000-8000-000000000001'
    ),
    1,
    '34. Active business staff can SELECT own business site_domains'
);
RESET ROLE;

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000006',
        'pgtap-staff@example.invalid',
        $$INSERT INTO public.site_domains (site_id, business_id, domain, status, verification_token, verification_target) VALUES ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'pgtap-staff-fail.example.invalid', 'pending_verification', 'tok2', 'cname.vyapone.invalid')$$
    )),
    '42501',
    '35. Active staff INSERT on site_domains is rejected by RLS (42501)'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000007',
        'pgtap-cashier@example.invalid',
        $$INSERT INTO public.qr_codes (site_id, business_id, type, public_slug, title, status, destination_configuration) VALUES ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'custom', 'pgtap-cashier-qr', 'Cashier QR', 'active', '{"type":"storefront"}'::jsonb)$$
    )),
    '42501',
    '36. Active cashier INSERT on qr_codes is rejected by RLS (42501)'
);

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000005',
        'pgtap-manager@example.invalid',
        $$INSERT INTO public.site_domains (id, site_id, business_id, domain, status, verification_token, verification_target) VALUES ('d2000000-0000-4000-8000-000000000002', 'd1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000001', 'pgtap-mgr-domain.example.invalid', 'pending_verification', 'tok3', 'cname.vyapone.invalid')$$
    )),
    false,
    '37. Active manager can INSERT site_domains for own business site'
);

SELECT is(
    (SELECT sql_state FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000008',
        'pgtap-stranger@example.invalid',
        $$INSERT INTO public.site_domains (site_id, business_id, domain, status, verification_token, verification_target) VALUES ('d1000000-0000-4000-8000-000000000001', 'c1000000-0000-4000-8000-000000000002', 'pgtap-cross-tenant.example.invalid', 'pending_verification', 'tok4', 'cname.vyapone.invalid')$$
    )),
    '42501',
    '38. Cross-tenant site_id + business_id mismatch on site_domains INSERT is rejected by RLS (42501)'
);

SELECT pg_temp.set_session_user('a1000000-0000-4000-8000-000000000005', 'pgtap-manager@example.invalid');
DELETE FROM public.site_domains WHERE id = 'd2000000-0000-4000-8000-000000000002';
RESET ROLE;

SELECT is(
    (SELECT pg_catalog.count(*)::INT FROM public.site_domains WHERE id = 'd2000000-0000-4000-8000-000000000002'),
    1,
    '39. Manager DELETE on site_domains is denied by site_domains_delete_policy (row preserved)'
);

SELECT pg_temp.set_session_user('a1000000-0000-4000-8000-000000000004', 'pgtap-biz-owner2@example.invalid');
DELETE FROM public.site_domains WHERE id = 'd2000000-0000-4000-8000-000000000002';
RESET ROLE;

SELECT is(
    (SELECT pg_catalog.count(*)::INT FROM public.site_domains WHERE id = 'd2000000-0000-4000-8000-000000000002'),
    0,
    '40. Sovereign business owner DELETE on site_domains removes the domain row'
);

-- ==============================================================================
-- 6. Canonical niches -> niche_groups Join on Business Creation & Import (2 tests)
-- ==============================================================================
SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000008',
        'pgtap-stranger@example.invalid',
        $$SELECT public.create_business_with_setup_atomic(
            p_workspace_id => 'b1000000-0000-4000-8000-000000000002'::UUID,
            p_caller_user_id => 'a1000000-0000-4000-8000-000000000008'::UUID,
            p_trade_name => 'pgTAP Cafe Setup',
            p_legal_name => 'pgTAP Cafe Setup LLP',
            p_slug => 'pgtap-cafe-setup',
            p_niche_slug => COALESCE((SELECT slug FROM public.niches ORDER BY slug LIMIT 1), 'cafe'),
            p_category => 'food_beverage',
            p_description => 'pgTAP setup check',
            p_gst_number => NULL,
            p_pan_number => NULL,
            p_tax_scheme => 'unregistered',
            p_contact => '{"primary_phone":"+919800000099"}'::jsonb,
            p_location_name => 'Main Store',
            p_address_line1 => '100 MG Road',
            p_address_line2 => NULL,
            p_city => 'Bengaluru',
            p_state => 'Karnataka',
            p_postal_code => '560001',
            p_logo_media_id => NULL,
            p_showcase_media_ids => ARRAY[]::UUID[],
            p_manifest_version => 'v1',
            p_sanitized_answers => '{}'::jsonb,
            p_is_onboarding_complete => true,
            p_missing_fields => '[]'::jsonb,
            p_default_modules => ARRAY['website_engine']::TEXT[]
        )$$
    )),
    false,
    '41. create_business_with_setup_atomic executes canonical niches -> niche_groups join cleanly'
);

SELECT is(
    (SELECT threw FROM pg_temp.run_as_and_catch(
        'authenticated',
        'a1000000-0000-4000-8000-000000000008',
        'pgtap-stranger@example.invalid',
        $$SELECT public.confirm_business_import_atomic(
            p_workspace_id => 'b1000000-0000-4000-8000-000000000002'::UUID,
            p_caller_user_id => 'a1000000-0000-4000-8000-000000000008'::UUID,
            p_trade_name => 'pgTAP Imported Store',
            p_legal_name => 'pgTAP Imported Store LLP',
            p_slug => 'pgtap-imported-store',
            p_niche_slug => COALESCE((SELECT slug FROM public.niches ORDER BY slug LIMIT 1), 'cafe'),
            p_category => 'food_beverage',
            p_description => 'pgTAP import check',
            p_gst_number => NULL,
            p_pan_number => NULL,
            p_tax_scheme => 'unregistered',
            p_contact => '{"primary_phone":"+919800000098"}'::jsonb,
            p_location_name => 'Main Store',
            p_address_line1 => '200 Indiranagar',
            p_address_line2 => NULL,
            p_city => 'Bengaluru',
            p_state => 'Karnataka',
            p_postal_code => '560038',
            p_timings_answers => '{}'::jsonb,
            p_import_proposal_id => 'pgtap-proposal-001',
            p_source_format => 'csv',
            p_source_file_name => 'catalog.csv',
            p_default_modules => ARRAY['website_engine']::TEXT[],
            p_catalogue_items => '[{"title":"Filter Coffee","price_minor":4500,"currency_code":"INR"}]'::jsonb,
            p_reviewed_fields_count => 5
        )$$
    )),
    false,
    '42. confirm_business_import_atomic executes canonical niches -> niche_groups join cleanly'
);

SELECT * FROM finish();
ROLLBACK;
