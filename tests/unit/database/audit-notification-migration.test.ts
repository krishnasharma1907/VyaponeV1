import { describe, expect, it } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("VO-028 Audit & Notification Foundation Database Migration", () => {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20261117000002_audit_and_notification_foundation.sql",
  );
  const combinedPath = path.join(process.cwd(), "supabase", "combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("verifies migration file exists and is populated", () => {
    expect(migrationSql.length).toBeGreaterThan(100);
  });

  it("verifies public.notifications table is defined with all canonical columns", () => {
    expect(migrationSql).toContain("CREATE TABLE IF NOT EXISTS public.notifications");
    expect(migrationSql).toContain("id UUID PRIMARY KEY DEFAULT pg_catalog.gen_random_uuid()");
    expect(migrationSql).toContain("recipient_user_id UUID NOT NULL REFERENCES public.users(id)");
    expect(migrationSql).toContain("workspace_id UUID REFERENCES public.workspaces(id)");
    expect(migrationSql).toContain("business_id UUID REFERENCES public.businesses(id)");
    expect(migrationSql).toContain("type TEXT NOT NULL CHECK (type IN (");
    expect(migrationSql).toContain("title TEXT NOT NULL");
    expect(migrationSql).toContain("message TEXT NOT NULL");
    expect(migrationSql).toContain("data JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(migrationSql).toContain("read BOOLEAN NOT NULL DEFAULT FALSE");
    expect(migrationSql).toContain("read_at TIMESTAMPTZ");
    expect(migrationSql).toContain("idempotency_key TEXT UNIQUE");
    expect(migrationSql).toContain(
      "created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()",
    );
    expect(migrationSql).toContain(
      "updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.clock_timestamp()",
    );
  });

  it("verifies notification type check constraint includes all canonical types", () => {
    const canonicalTypes = [
      "workspace_invitation",
      "business_invitation",
      "membership_change",
      "role_updated",
      "member_removed",
      "capacity_warning",
      "site_status_changed",
      "security_alert",
      "system_announcement",
    ];

    for (const type of canonicalTypes) {
      expect(migrationSql).toContain(`'${type}'`);
    }
  });

  it("verifies query performance indexes are created", () => {
    expect(migrationSql).toContain("idx_notifications_recipient_created");
    expect(migrationSql).toContain("idx_notifications_recipient_unread");
    expect(migrationSql).toContain("idx_notifications_workspace_id");
    expect(migrationSql).toContain("idx_notifications_business_id");
  });

  it("verifies strict ROW LEVEL SECURITY and FORCE RLS are enabled", () => {
    expect(migrationSql).toContain("ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;");
    expect(migrationSql).toContain("ALTER TABLE public.notifications FORCE ROW LEVEL SECURITY;");
  });

  it("verifies fail-closed recipient isolation RLS policies", () => {
    // SELECT only by recipient
    expect(migrationSql).toContain('"notifications_select_policy"');
    expect(migrationSql).toContain("recipient_user_id = auth.uid()");

    // UPDATE only by recipient
    expect(migrationSql).toContain('"notifications_update_policy"');

    // INSERT prohibited for clients
    expect(migrationSql).toContain('"notifications_insert_policy"');
    expect(migrationSql).toContain("WITH CHECK (false)");

    // DELETE prohibited
    expect(migrationSql).toContain('"notifications_delete_policy"');
    expect(migrationSql).toContain("USING (false)");
  });

  it("verifies create_in_app_notification procedure is SECURITY DEFINER with safe search_path", () => {
    expect(migrationSql).toContain("CREATE OR REPLACE FUNCTION public.create_in_app_notification(");
    expect(migrationSql).toContain("LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''");
    expect(migrationSql).toContain("RETURNS UUID AS $$");
  });

  it("verifies principle of least privilege permissions on notifications table and function", () => {
    expect(migrationSql).toContain("REVOKE ALL ON TABLE public.notifications FROM PUBLIC, anon;");
    expect(migrationSql).toContain(
      "GRANT SELECT, UPDATE (read, read_at) ON TABLE public.notifications TO authenticated;",
    );
    expect(migrationSql).toContain("GRANT ALL ON TABLE public.notifications TO service_role;");
    expect(migrationSql).toContain("REVOKE ALL ON FUNCTION public.create_in_app_notification");
    expect(migrationSql).toContain("GRANT EXECUTE ON FUNCTION public.create_in_app_notification");
  });

  it("verifies migration is appended to combined_migrations.sql", () => {
    expect(combinedSql).toContain("20261117000002_audit_and_notification_foundation.sql");
    expect(combinedSql).toContain("CREATE TABLE IF NOT EXISTS public.notifications");
  });
});
