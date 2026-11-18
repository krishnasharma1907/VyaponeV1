import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

describe("VO-032 Media Security Hardening Migration [20261118000004]", () => {
  const migrationPath = path.resolve(
    process.cwd(),
    "supabase/migrations/20261118000004_harden_media_items_security.sql",
  );
  const combinedPath = path.resolve(process.cwd(), "supabase/combined_migrations.sql");

  const migrationSql = fs.readFileSync(migrationPath, "utf-8");
  const combinedSql = fs.readFileSync(combinedPath, "utf-8");

  it("exists as forward-only migration file and is synchronized in combined_migrations.sql", () => {
    expect(fs.existsSync(migrationPath)).toBe(true);
    expect(combinedSql).toContain("20261118000004_harden_media_items_security.sql");
    expect(combinedSql).toContain("chk_media_items_bucket_visibility");
  });

  it("revokes direct table-level INSERT, UPDATE, and DELETE from authenticated and anon", () => {
    expect(migrationSql).toMatch(
      /REVOKE INSERT,\s*UPDATE,\s*DELETE ON public\.media_items FROM authenticated;/i,
    );
    expect(migrationSql).toMatch(/REVOKE ALL ON public\.media_items FROM PUBLIC;/i);
    expect(migrationSql).toMatch(/GRANT SELECT ON public\.media_items TO anon;/i);
    expect(migrationSql).toMatch(/GRANT SELECT ON public\.media_items TO authenticated;/i);
    expect(migrationSql).toMatch(/GRANT ALL ON public\.media_items TO service_role;/i);
  });

  it("restricts insert, update, and delete RLS policies strictly to service_role", () => {
    expect(migrationSql).toMatch(/DROP POLICY IF EXISTS "media_items_insert_policy"/i);
    expect(migrationSql).toMatch(
      /CREATE POLICY "media_items_insert_policy"[\s\S]*?WITH CHECK \(auth\.role\(\) = 'service_role'\)/i,
    );
    expect(migrationSql).toMatch(/DROP POLICY IF EXISTS "media_items_update_policy"/i);
    expect(migrationSql).toMatch(
      /CREATE POLICY "media_items_update_policy"[\s\S]*?USING \(auth\.role\(\) = 'service_role'\)[\s\S]*?WITH CHECK \(auth\.role\(\) = 'service_role'\)/i,
    );
    expect(migrationSql).toMatch(/DROP POLICY IF EXISTS "media_items_delete_policy"/i);
    expect(migrationSql).toMatch(
      /CREATE POLICY "media_items_delete_policy"[\s\S]*?USING \(auth\.role\(\) = 'service_role'\)/i,
    );
  });

  it("updates chk_media_items_status to include deletion_pending for two-phase safe deletion", () => {
    expect(migrationSql).toMatch(
      /status IN \('pending_upload',\s*'ready',\s*'failed',\s*'deletion_pending',\s*'archived'\)/i,
    );
  });

  it("enforces chk_media_items_bucket_visibility consistency check", () => {
    expect(migrationSql).toMatch(
      /\(bucket = 'vyapone-public-media' AND is_public = true\)\s*OR\s*\(bucket = 'vyapone-private-media' AND is_public = false\)/i,
    );
  });

  it("reconfigures business_id foreign key to ON DELETE RESTRICT to prevent orphaned storage objects", () => {
    expect(migrationSql).toMatch(/DROP CONSTRAINT IF EXISTS media_items_business_id_fkey;/i);
    expect(migrationSql).toMatch(
      /FOREIGN KEY \(business_id\) REFERENCES public\.businesses\(id\) ON DELETE RESTRICT;/i,
    );
  });

  it("creates partial index for deletion_pending reconciliation", () => {
    expect(migrationSql).toMatch(
      /CREATE INDEX IF NOT EXISTS idx_media_items_deletion_pending[\s\S]*?WHERE status = 'deletion_pending';/i,
    );
  });
});
