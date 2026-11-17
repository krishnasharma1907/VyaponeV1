-- ==============================================================================
-- VyapOne — VO-028 Audit/Activity and Notification Foundation Migration
-- Migration: 20261117000002_audit_and_notification_foundation.sql
--
-- Requirements:
-- 1. Create public.notifications table for tamper-evident, typed in-app notifications
--    with recipient-scoped access, read/unread states, and idempotency protection.
-- 2. Configure fail-closed Row-Level Security:
--    - Users can only SELECT and UPDATE (mark as read) their own notifications.
--    - Direct client INSERT and DELETE are prohibited; creation occurs strictly via
--      trusted server operations / SECURITY DEFINER procedures.
-- 3. Provide trusted server procedure public.create_in_app_notification().
-- 4. Harden privileges: revoke all from PUBLIC/anon, granting minimal access to
--    authenticated and service_role.
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
    IF p_recipient_user_id IS NULL THEN
        RAISE EXCEPTION 'Recipient user ID cannot be null' USING ERRCODE = 'VY020';
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
REVOKE ALL ON FUNCTION public.create_in_app_notification(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, TEXT) FROM PUBLIC, anon;

GRANT SELECT, UPDATE (read, read_at) ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;
GRANT EXECUTE ON FUNCTION public.create_in_app_notification(UUID, TEXT, TEXT, TEXT, JSONB, UUID, UUID, TEXT) TO authenticated, service_role;
