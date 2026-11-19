-- ==============================================================================
-- VyapOne — Atomic Business Import Confirmation [VO-034]
--
-- Provides a genuinely atomic, transaction-safe PostgreSQL stored procedure
-- that provisions:
-- 1. Business record (status = 'onboarding')
-- 2. Primary location (is_primary = true, slug = 'main')
-- 3. Initial owner business member
-- 4. Business onboarding answers (including import provenance & timings)
-- 5. Default platform modules
-- 6. Confirmed catalogue items batch insertion with minor unit prices
-- 7. Append-only transactional audit log event ('business.import_confirmed')
--
-- With:
-- - Concurrency-safe capacity locking ('draft_websites')
-- - Strict workspace RBAC (workspace_owner, workspace_admin, reseller_admin)
-- - Session caller verification (auth.uid() = p_caller_user_id)
-- - Idempotency protection against duplicate proposal submissions
-- - Complete transaction rollback if any catalogue item or write fails.
--
-- PRD Authority:
-- - PRD FINAL v2 §5.2, §5.3: Creating a client business & proposal confirmation
-- - PRD FINAL v2 §6.13: Confirmation UX for writes
-- - PRD FINAL v2 §9.1, §9.2: Plan capacity & counting rules
-- - PRD FINAL v2 §17: Security & Tenant Isolation
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.confirm_business_import_atomic(
    p_workspace_id UUID,
    p_caller_user_id UUID,
    p_trade_name TEXT,
    p_legal_name TEXT,
    p_slug TEXT,
    p_niche_slug TEXT,
    p_category TEXT,
    p_description TEXT,
    p_gst_number TEXT,
    p_pan_number TEXT,
    p_tax_scheme TEXT,
    p_contact JSONB,
    p_location_name TEXT,
    p_address_line1 TEXT,
    p_address_line2 TEXT,
    p_city TEXT,
    p_state TEXT,
    p_postal_code TEXT,
    p_timings_answers JSONB,
    p_import_proposal_id TEXT,
    p_source_format TEXT,
    p_source_file_name TEXT,
    p_default_modules TEXT[],
    p_catalogue_items JSONB,
    p_reviewed_fields_count INT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
    v_business_id UUID;
    v_location_id UUID;
    v_member_id UUID;
    v_niche_id UUID := NULL;
    v_category TEXT := p_category;
    v_slug TEXT;
    v_base_slug TEXT;
    v_mod_key TEXT;
    v_cap_allowed BOOLEAN;
    v_cap_current INT;
    v_cap_limit INT;
    v_cap_reason TEXT;
    v_biz_json JSONB;
    v_loc_json JSONB;
    v_item_record JSONB;
    v_item_title TEXT;
    v_price_minor BIGINT;
    v_catalogue_count INT := 0;
BEGIN
    -- -------------------------------------------------------------------------
    -- 1. Input Sanitization & Required Field Validation
    -- -------------------------------------------------------------------------
    IF p_workspace_id IS NULL THEN
        RAISE EXCEPTION 'Workspace ID cannot be null' USING ERRCODE = 'VY020';
    END IF;

    IF p_caller_user_id IS NULL THEN
        RAISE EXCEPTION 'Caller user ID cannot be null' USING ERRCODE = 'VY020';
    END IF;

    IF p_trade_name IS NULL OR pg_catalog.length(pg_catalog.trim(p_trade_name)) = 0 THEN
        RAISE EXCEPTION 'Trade name cannot be empty' USING ERRCODE = 'VY023';
    END IF;

    IF p_address_line1 IS NULL OR pg_catalog.length(pg_catalog.trim(p_address_line1)) = 0 THEN
        RAISE EXCEPTION 'Address line 1 cannot be empty' USING ERRCODE = 'VY023';
    END IF;

    IF p_postal_code IS NULL OR p_postal_code !~ '^[1-9][0-9]{5}$' THEN
        RAISE EXCEPTION 'Invalid Indian PIN code (must be 6 digits, not starting with 0)' USING ERRCODE = 'VY023';
    END IF;

    -- -------------------------------------------------------------------------
    -- 2. Caller Context & Identity Verification
    -- -------------------------------------------------------------------------
    IF auth.uid() IS NOT NULL AND auth.uid() <> p_caller_user_id THEN
        RAISE EXCEPTION 'Access denied: caller does not match authenticated user session' USING ERRCODE = 'VY020';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = p_caller_user_id) THEN
        RAISE EXCEPTION 'Caller user record not found' USING ERRCODE = 'VY020';
    END IF;

    -- -------------------------------------------------------------------------
    -- 3. Workspace Authorization Check
    -- -------------------------------------------------------------------------
    IF NOT public.is_workspace_admin_or_owner(p_workspace_id, p_caller_user_id) THEN
        RAISE EXCEPTION 'You do not have management permissions in the specified workspace' USING ERRCODE = 'VY021';
    END IF;

    -- -------------------------------------------------------------------------
    -- 4. Concurrency-Safe Capacity Enforcement ('draft_websites')
    -- -------------------------------------------------------------------------
    SELECT allowed, current_count, effective_limit, reason
    INTO v_cap_allowed, v_cap_current, v_cap_limit, v_cap_reason
    FROM public.assert_and_lock_workspace_capacity(p_workspace_id, 'draft_websites', 1);

    IF NOT v_cap_allowed THEN
        RAISE EXCEPTION 'Workspace draft website limit reached (%/%): %', v_cap_current, v_cap_limit, v_cap_reason
            USING ERRCODE = 'VY001';
    END IF;

    -- -------------------------------------------------------------------------
    -- 5. Idempotency Check (Duplicate Proposal Submission Defense)
    -- -------------------------------------------------------------------------
    IF p_import_proposal_id IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_import_proposal_id)) > 0 THEN
        IF EXISTS (
            SELECT 1 FROM public.audit_logs
            WHERE workspace_id = p_workspace_id
              AND action = 'business.import_confirmed'
              AND metadata_json->>'proposal_id' = p_import_proposal_id
        ) THEN
            RAISE EXCEPTION 'Import proposal % has already been confirmed and provisioned', p_import_proposal_id
                USING ERRCODE = 'VY024';
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- 6. Niche Resolution
    -- -------------------------------------------------------------------------
    IF p_niche_slug IS NOT NULL AND pg_catalog.length(pg_catalog.trim(p_niche_slug)) > 0 THEN
        SELECT id, niche_group_slug INTO v_niche_id, v_category
        FROM public.niches
        WHERE slug = p_niche_slug;

        IF v_category IS NULL THEN
            v_category := COALESCE(p_category, 'other_business');
        END IF;
    ELSE
        v_category := COALESCE(p_category, 'other_business');
    END IF;

    -- -------------------------------------------------------------------------
    -- 7. Slug Resolution & Conflict Handling
    -- -------------------------------------------------------------------------
    v_base_slug := COALESCE(p_slug, p_trade_name);
    v_base_slug := pg_catalog.regexp_replace(
        pg_catalog.regexp_replace(pg_catalog.lower(v_base_slug), '[^a-z0-9]+', '-', 'g'),
        '^-+|-+$', '', 'g'
    );
    IF pg_catalog.length(v_base_slug) < 2 THEN
        v_base_slug := 'store-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 6);
    END IF;

    v_slug := v_base_slug;
    IF EXISTS (SELECT 1 FROM public.businesses WHERE slug = v_slug) THEN
        v_slug := v_base_slug || '-' || pg_catalog.substr(pg_catalog.md5(pg_catalog.random()::text), 1, 4);
    END IF;

    -- -------------------------------------------------------------------------
    -- 8. Step 1: Insert Business Record
    -- -------------------------------------------------------------------------
    INSERT INTO public.businesses (
        workspace_id,
        legal_name,
        trade_name,
        slug,
        category,
        niche_id,
        description,
        gst_number,
        pan_number,
        tax_scheme,
        contact_configuration,
        address_configuration,
        status,
        currency_code,
        sovereign_owner_id,
        created_at,
        updated_at
    ) VALUES (
        p_workspace_id,
        COALESCE(p_legal_name, p_trade_name),
        p_trade_name,
        v_slug,
        v_category,
        v_niche_id,
        p_description,
        p_gst_number,
        p_pan_number,
        COALESCE(p_tax_scheme, 'unregistered'),
        COALESCE(p_contact, '{}'::jsonb),
        jsonb_build_object(
            'address_line1', p_address_line1,
            'address_line2', p_address_line2,
            'city', p_city,
            'state', p_state,
            'postal_code', p_postal_code,
            'country', 'India'
        ),
        'onboarding',
        'INR',
        p_caller_user_id,
        v_now,
        v_now
    )
    RETURNING id INTO v_business_id;

    -- -------------------------------------------------------------------------
    -- 9. Step 2: Insert Primary Location
    -- -------------------------------------------------------------------------
    INSERT INTO public.locations (
        business_id,
        name,
        slug,
        address_line1,
        address_line2,
        city,
        state,
        postal_code,
        is_primary,
        created_at,
        updated_at
    ) VALUES (
        v_business_id,
        COALESCE(p_location_name, 'Main Store'),
        'main',
        p_address_line1,
        p_address_line2,
        p_city,
        p_state,
        p_postal_code,
        true,
        v_now,
        v_now
    )
    RETURNING id INTO v_location_id;

    -- -------------------------------------------------------------------------
    -- 10. Step 3: Insert Initial Owner Business Member
    -- -------------------------------------------------------------------------
    INSERT INTO public.business_members (
        business_id,
        user_id,
        role,
        location_id,
        permissions,
        status,
        created_at
    ) VALUES (
        v_business_id,
        p_caller_user_id,
        'owner',
        v_location_id,
        jsonb_build_object(
            'can_bill', true,
            'can_manage_catalogue', true,
            'can_view_reports', true,
            'can_edit_settings', true
        ),
        'active',
        v_now
    )
    RETURNING id INTO v_member_id;

    -- -------------------------------------------------------------------------
    -- 11. Step 4: Insert Business Onboarding Answers
    -- -------------------------------------------------------------------------
    INSERT INTO public.business_onboarding_answers (
        business_id,
        niche_slug,
        manifest_version,
        answers,
        is_complete,
        missing_fields,
        created_at,
        updated_at
    ) VALUES (
        v_business_id,
        COALESCE(p_niche_slug, 'other_business'),
        'v1',
        jsonb_build_object(
            'import_source', COALESCE(p_source_format, 'unknown'),
            'import_proposal_id', p_import_proposal_id
        ) || COALESCE(p_timings_answers, '{}'::jsonb),
        true,
        '[]'::jsonb,
        v_now,
        v_now
    );

    -- -------------------------------------------------------------------------
    -- 12. Step 5: Provision Default Platform Modules
    -- -------------------------------------------------------------------------
    IF p_default_modules IS NOT NULL AND pg_catalog.cardinality(p_default_modules) > 0 THEN
        FOREACH v_mod_key IN ARRAY p_default_modules LOOP
            IF EXISTS (SELECT 1 FROM public.platform_modules WHERE key = v_mod_key) THEN
                INSERT INTO public.business_modules (
                    business_id,
                    module_key,
                    is_enabled,
                    custom_config,
                    enabled_at,
                    updated_at
                ) VALUES (
                    v_business_id,
                    v_mod_key,
                    true,
                    '{}'::jsonb,
                    v_now,
                    v_now
                )
                ON CONFLICT (business_id, module_key) DO NOTHING;
            END IF;
        END LOOP;
    END IF;

    -- -------------------------------------------------------------------------
    -- 13. Step 6: Insert Confirmed Catalogue Items (All-or-Nothing)
    -- -------------------------------------------------------------------------
    IF p_catalogue_items IS NOT NULL AND pg_catalog.jsonb_typeof(p_catalogue_items) = 'array' THEN
        FOR v_item_record IN SELECT * FROM pg_catalog.jsonb_array_elements(p_catalogue_items) LOOP
            v_item_title := pg_catalog.trim((v_item_record->>'title')::text);
            IF v_item_title IS NULL OR pg_catalog.length(v_item_title) = 0 THEN
                RAISE EXCEPTION 'Catalogue item title cannot be empty' USING ERRCODE = 'VY025';
            END IF;

            v_price_minor := (v_item_record->>'price_minor')::BIGINT;
            IF v_price_minor IS NULL OR v_price_minor < 0 THEN
                RAISE EXCEPTION 'Catalogue item price must be a non-negative integer minor unit' USING ERRCODE = 'VY025';
            END IF;

            INSERT INTO public.catalogue_items (
                business_id,
                location_id,
                title,
                description,
                price_minor,
                currency_code,
                sku,
                is_available,
                created_at,
                updated_at
            ) VALUES (
                v_business_id,
                v_location_id,
                v_item_title,
                v_item_record->>'description',
                v_price_minor,
                COALESCE(v_item_record->>'currency_code', 'INR'),
                v_item_record->>'sku',
                true,
                v_now,
                v_now
            );

            v_catalogue_count := v_catalogue_count + 1;
        END LOOP;
    END IF;

    -- -------------------------------------------------------------------------
    -- 14. Step 7: Record Append-Only Transactional Audit Event
    -- -------------------------------------------------------------------------
    INSERT INTO public.audit_logs (
        business_id,
        workspace_id,
        user_id,
        action,
        resource,
        metadata_json,
        created_at
    ) VALUES (
        v_business_id,
        p_workspace_id,
        p_caller_user_id,
        'business.import_confirmed',
        'businesses',
        jsonb_build_object(
            'proposal_id', p_import_proposal_id,
            'source_format', p_source_format,
            'source_file_name', p_source_file_name,
            'total_fields_reviewed', p_reviewed_fields_count,
            'confirmed_catalogue_items', v_catalogue_count,
            'provisioned_business_id', v_business_id
        ),
        v_now
    );

    -- -------------------------------------------------------------------------
    -- 15. Return Structured Result
    -- -------------------------------------------------------------------------
    SELECT pg_catalog.row_to_json(b.*)::jsonb INTO v_biz_json
    FROM public.businesses b WHERE b.id = v_business_id;

    SELECT pg_catalog.row_to_json(l.*)::jsonb INTO v_loc_json
    FROM public.locations l WHERE l.id = v_location_id;

    RETURN jsonb_build_object(
        'business', v_biz_json,
        'primary_location', v_loc_json,
        'business_id', v_business_id,
        'location_id', v_location_id,
        'catalogue_items_created', v_catalogue_count,
        'audit_log_action', 'business.import_confirmed'
    );
END;
$$;

-- -----------------------------------------------------------------------------
-- Grants and Revokes for Security & Principle of Least Privilege
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.confirm_business_import_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT[], JSONB, INT
) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.confirm_business_import_atomic(
    UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB,
    TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT[], JSONB, INT
) TO authenticated, service_role;
