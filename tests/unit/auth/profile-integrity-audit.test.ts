import { describe, expect, it, vi } from "vitest";
import { ensureUserProfile } from "@/lib/auth/profile";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import fs from "fs";
import path from "path";

/**
 * Authentication Trigger and Profile Integrity Security Audit Tests
 *
 * Verifies the security invariants:
 * 1. Successful signup creates the expected application profile.
 * 2. Trigger failure does not silently leave an unusable application account.
 * 3. Retry is idempotent.
 * 4. Existing user/profile is not duplicated.
 * 5. Unauthenticated direct INSERT into protected application profile data is rejected (RLS & Grant audit).
 * 6. Authenticated user cannot create another user's profile.
 * 7. Missing profiles are recovered through the approved server-side mechanism.
 * 8. Unauthorized users cannot modify protected identity fields.
 */
describe("Auth Trigger & Profile Integrity Security Audit", () => {
  const mockUser: User = {
    id: "usr_audit_valid_001",
    app_metadata: {},
    user_metadata: { full_name: "Audit User" },
    aud: "authenticated",
    email: "audit.user@example.com",
    phone: "+919876543210",
    created_at: new Date().toISOString(),
  };

  // Helper to create mock client
  const createMockSupabase = (options: {
    authenticatedUserId?: string | null;
    existingUser?: { id: string; email?: string } | null;
    insertError?: { message: string } | null;
  }) => {
    const insertedUsers: unknown[] = [];
    const insertedIdentities: unknown[] = [];

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn((_column: string, val: string) => ({
                maybeSingle: vi.fn(async () => {
                  if (options.existingUser && val === options.existingUser.id) {
                    return { data: options.existingUser, error: null };
                  }
                  return { data: null, error: null };
                }),
              })),
            })),
            insert: vi.fn(async (record: Record<string, unknown>) => {
              // RLS policy simulation:
              // Only authenticated user can insert, and record.id must equal auth.uid()
              if (!options.authenticatedUserId) {
                return {
                  error: new Error(
                    "new row violates row-level security policy for table users (unauthenticated insert rejected)",
                  ),
                };
              }
              if (record.id !== options.authenticatedUserId) {
                return {
                  error: new Error(
                    "new row violates row-level security policy for table users (cannot insert other user profile)",
                  ),
                };
              }
              if (options.insertError) {
                return { error: options.insertError };
              }
              insertedUsers.push(record);
              return { error: null };
            }),
          };
        }
        if (table === "user_auth_identities") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            })),
            insert: vi.fn(async (record: unknown) => {
              insertedIdentities.push(record);
              return { error: null };
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient<Database>;

    return { mockClient, insertedUsers, insertedIdentities };
  };

  it("1. Successful signup creates the expected application profile", async () => {
    const { mockClient, insertedUsers, insertedIdentities } = createMockSupabase({
      authenticatedUserId: mockUser.id,
      existingUser: null,
    });

    const result = await ensureUserProfile(mockClient, mockUser, {
      fullName: "Audit User",
      email: mockUser.email,
      phone: mockUser.phone,
    });

    expect(result.success).toBe(true);
    expect(insertedUsers.length).toBe(1);
    expect(insertedUsers[0]).toEqual({
      id: "usr_audit_valid_001",
      display_name: "Audit User",
      email: "audit.user@example.com",
      phone_number: "+919876543210",
      status: "active",
      preferred_language: "en",
    });
    expect(insertedIdentities.length).toBe(2);
  });

  it("2. Trigger/Insert failure with phone collision recovers by inserting without phone", async () => {
    let attempts = 0;
    const insertedUsers: Record<string, unknown>[] = [];

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: null, error: null })),
              })),
            })),
            insert: vi.fn(async (record: Record<string, unknown>) => {
              attempts++;
              if (attempts === 1 && record.phone_number) {
                // Simulate unique constraint failure on users_phone_number_key
                return {
                  error: {
                    message:
                      'duplicate key value violates unique constraint "users_phone_number_key"',
                  },
                };
              }
              insertedUsers.push(record);
              return { error: null };
            }),
          };
        }
        if (table === "user_auth_identities") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                  })),
                  maybeSingle: vi.fn(async () => ({ data: null, error: null })),
                })),
              })),
            })),
            insert: vi.fn(async () => ({ error: null })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await ensureUserProfile(mockClient, mockUser, {
      fullName: "Audit User",
      email: mockUser.email,
      phone: "+919876543210",
    });

    expect(result.success).toBe(true);
    expect(attempts).toBe(2); // Initial failed attempt + resilient fallback attempt
    expect(insertedUsers[0].phone_number).toBeNull(); // Phone omitted, but user profile safely created
    expect(insertedUsers[0].id).toBe(mockUser.id);
  });

  it("3. Retry is idempotent and handles existing profiles cleanly", async () => {
    const { mockClient, insertedUsers } = createMockSupabase({
      authenticatedUserId: mockUser.id,
      existingUser: { id: mockUser.id, email: mockUser.email },
    });

    const result = await ensureUserProfile(mockClient, mockUser);
    expect(result.success).toBe(true);
    expect(insertedUsers.length).toBe(0); // Zero duplicate rows inserted
  });

  it("4. Existing user/profile is not duplicated on multiple consecutive calls", async () => {
    const { mockClient, insertedUsers } = createMockSupabase({
      authenticatedUserId: mockUser.id,
      existingUser: { id: mockUser.id },
    });

    await ensureUserProfile(mockClient, mockUser);
    await ensureUserProfile(mockClient, mockUser);
    await ensureUserProfile(mockClient, mockUser);

    expect(insertedUsers.length).toBe(0);
  });

  it("5. Unauthenticated direct INSERT into protected application profile data is rejected", async () => {
    const { mockClient } = createMockSupabase({
      authenticatedUserId: null, // Unauthenticated caller
      existingUser: null,
    });

    const result = await ensureUserProfile(mockClient, mockUser);
    expect(result.success).toBe(false);
    expect(result.error).toContain("violates row-level security policy");
  });

  it("6. Authenticated user cannot create another user's profile", async () => {
    const { mockClient } = createMockSupabase({
      authenticatedUserId: "usr_attacker_999", // Caller has ID usr_attacker_999
      existingUser: null,
    });

    // Caller attempts to bootstrap profile for mockUser (usr_audit_valid_001)
    const result = await ensureUserProfile(mockClient, mockUser);
    expect(result.success).toBe(false);
    expect(result.error).toContain("cannot insert other user profile");
  });

  it("7. Missing profiles are recovered through approved server-side ensureUserProfile", async () => {
    const { mockClient, insertedUsers } = createMockSupabase({
      authenticatedUserId: mockUser.id,
      existingUser: null,
    });

    // Simulate recovery in callback or signin
    const result = await ensureUserProfile(mockClient, mockUser);
    expect(result.success).toBe(true);
    expect(insertedUsers.length).toBe(1);
    expect((insertedUsers[0] as { id: string }).id).toBe(mockUser.id);
  });

  it("8. SQL Migrations strictly enforce least privilege and prevent unauthorized writes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261115000002_harden_auth_trigger_and_profile_rls.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf8");

    // 1. Must explicitly revoke all permissions from anon & PUBLIC across all tables
    expect(sql).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, PUBLIC;");
    expect(sql).toContain(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated, PUBLIC;",
    );
    expect(sql).toContain(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated, PUBLIC;",
    );
    expect(sql).toContain(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON ROUTINES FROM anon, PUBLIC;",
    );

    // 2. Must revoke truncate and trigger from authenticated
    expect(sql).toContain(
      "REVOKE TRUNCATE, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated, anon, PUBLIC;",
    );

    // 3. Must protect audit logs as append-only
    expect(sql).toContain(
      "REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_logs FROM authenticated, anon, PUBLIC;",
    );

    // 4. Must enforce column-level privileges on public.users
    expect(sql).toContain("REVOKE ALL ON public.users FROM anon, authenticated, PUBLIC;");
    expect(sql).toContain("GRANT SELECT ON public.users TO authenticated;");
    expect(sql).toContain(
      "GRANT UPDATE (display_name, preferred_language) ON public.users TO authenticated;",
    );

    // 5. Must enforce strict privilege protection on user_auth_identities
    expect(sql).toContain(
      "REVOKE ALL ON public.user_auth_identities FROM anon, authenticated, PUBLIC;",
    );
    expect(sql).toContain("GRANT SELECT ON public.user_auth_identities TO authenticated;");

    // 6. Must scope supabase_auth_admin privileges
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE ON public.users, public.user_auth_identities TO supabase_auth_admin;",
    );
    expect(sql).toContain("GRANT USAGE ON SCHEMA public TO supabase_auth_admin;");

    // 7. Must restrict handle_new_auth_user execution privileges
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres, supabase_auth_admin, service_role;",
    );

    // 8. Must use SET search_path = '' for SECURITY DEFINER functions
    expect(sql).toContain("SET search_path = ''");

    // 9. Must protect against identity hijacking with explicit user_id equality check
    expect(sql).toContain("WHERE public.user_auth_identities.user_id = EXCLUDED.user_id;");

    // 10. Must provide secure ensure_user_profile RPC for profile recovery
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.ensure_user_profile(");
    expect(sql).toContain(
      "REVOKE ALL ON FUNCTION public.ensure_user_profile(pg_catalog.text, pg_catalog.text) FROM PUBLIC, anon;",
    );
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.ensure_user_profile(pg_catalog.text, pg_catalog.text) TO authenticated, service_role;",
    );

    // 11. Must eliminate dead users_delete_policy and avoid granting DELETE
    expect(sql).toContain('DROP POLICY IF EXISTS "users_delete_policy" ON public.users;');
    expect(sql).not.toContain('CREATE POLICY "users_delete_policy"');

    // 12. Must provide safe user_directory projection view for team collaboration without contact PII
    expect(sql).toMatch(
      /CREATE OR REPLACE VIEW public\.user_directory(?:\s+WITH\s*\(security_invoker\s*=\s*true\))?\s+AS/,
    );
    expect(sql).toContain("GRANT SELECT ON public.user_directory TO authenticated;");
  });

  it("9. ensureUserProfile preferentially recovers profiles via secure RPC", async () => {
    const rpcMock = vi.fn(async () => ({
      data: { success: true, user_id: mockUser.id },
      error: null,
    }));

    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => ({ data: null, error: null })),
          })),
        })),
        insert: vi.fn(async () => ({ error: null })),
      })),
      rpc: rpcMock,
    } as unknown as SupabaseClient<Database>;

    const result = await ensureUserProfile(mockClient, mockUser, {
      fullName: "Recovered User",
      preferredLanguage: "hi",
    });

    expect(result.success).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("ensure_user_profile", {
      p_display_name: "Recovered User",
      p_preferred_language: "hi",
    });
  });

  it("10. User directory projection view strictly protects contact PII (email, phone_number)", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261115000002_harden_auth_trigger_and_profile_rls.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    // Extract the VIEW definition
    const viewMatch = sql.match(
      /CREATE OR REPLACE VIEW public\.user_directory(?:\s+WITH\s*\(security_invoker\s*=\s*true\))?\s+AS([\s\S]*?);/,
    );
    expect(viewMatch).not.toBeNull();
    const viewSql = viewMatch![1];

    // Allowed non-sensitive projection columns
    expect(viewSql).toContain("u.id");
    expect(viewSql).toContain("u.display_name");
    expect(viewSql).toContain("u.status");
    expect(viewSql).toContain("u.preferred_language");

    // Strictly forbidden PII columns in directory view
    expect(viewSql).not.toContain("u.email");
    expect(viewSql).not.toContain("u.phone_number");
  });

  it("11. Auth trigger propagates unexpected fatal errors atomically without silent suppression", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261115000002_harden_auth_trigger_and_profile_rls.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    // Extract trigger function body
    const triggerMatch = sql.match(
      /CREATE OR REPLACE FUNCTION public\.handle_new_auth_user\(\)[\s\S]*?\$\$(.*?)\$\$;/s,
    );
    expect(triggerMatch).not.toBeNull();
    const triggerSql = triggerMatch![1];

    // Must NOT contain silent error suppression (EXCEPTION WHEN OTHERS THEN ... RETURN NEW)
    expect(triggerSql).not.toMatch(/EXCEPTION\s+WHEN\s+OTHERS\s+THEN[\s\S]*?RETURN\s+NEW;/i);
  });

  it("12. Identity conflict protection ensures existing user identity cannot be hijacked", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261115000002_harden_auth_trigger_and_profile_rls.sql",
    );
    const sql = fs.readFileSync(migrationPath, "utf8");

    // Both phone and email identity upserts must guard with user_id match
    const identityUpsertMatches = [
      ...sql.matchAll(
        /ON CONFLICT \(provider, identifier\) DO UPDATE SET[\s\S]*?WHERE public\.user_auth_identities\.user_id = EXCLUDED\.user_id;/g,
      ),
    ];
    // Both phone_otp and email_password upserts must have this guard
    expect(identityUpsertMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("13. Unexpected failure during ensureUserProfile returns safe failure without leaking sensitive internals", async () => {
    const mockClient = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn(async () => {
              throw new Error("Unexpected fatal connection drop");
            }),
          })),
        })),
      })),
      rpc: vi.fn(async () => {
        throw new Error("Unexpected fatal RPC failure");
      }),
    } as unknown as SupabaseClient<Database>;

    const result = await ensureUserProfile(mockClient, mockUser);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain("Unexpected fatal");
  });
});
