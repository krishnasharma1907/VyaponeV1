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

  it("8. SQL Migrations strictly enforce least privilege and prevent anonymous writes", () => {
    const migrationPath = path.join(
      process.cwd(),
      "supabase/migrations/20261115000002_harden_auth_trigger_and_profile_rls.sql",
    );
    expect(fs.existsSync(migrationPath)).toBe(true);

    const sql = fs.readFileSync(migrationPath, "utf8");

    // 1. Must explicitly revoke write permissions from anon across all tables
    expect(sql).toContain(
      "REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon;",
    );
    expect(sql).toContain(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;",
    );

    // 2. Must revoke truncate and trigger from authenticated
    expect(sql).toContain(
      "REVOKE TRUNCATE, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;",
    );

    // 3. Must scope supabase_auth_admin privileges
    expect(sql).toContain(
      "GRANT SELECT, INSERT, UPDATE ON public.users, public.user_auth_identities TO supabase_auth_admin;",
    );
    expect(sql).toContain("GRANT USAGE ON SCHEMA public TO supabase_auth_admin;");

    // 4. Must restrict INSERT strictly to authenticated user's own id
    expect(sql).toContain("TO authenticated");
    expect(sql).toContain("WITH CHECK (id = auth.uid())");
    expect(sql).not.toContain("auth.uid() IS NULL"); // Unauthenticated bypass must NOT be in the RLS policy

    // 5. Must restrict handle_new_auth_user execution privileges
    expect(sql).toContain("REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM anon;");
    expect(sql).toContain(
      "GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO postgres, supabase_auth_admin, service_role;",
    );

    // 6. Must specify safe explicit search path
    expect(sql).toContain("SET search_path = public, pg_catalog");

    // 7. Must avoid invalid pg_catalog prefixes on SQL-standard constructs
    expect(sql).not.toContain("pg_catalog.nullif");
    expect(sql).not.toContain("pg_catalog.trim");
    expect(sql).not.toContain("pg_catalog.coalesce");
  });
});
