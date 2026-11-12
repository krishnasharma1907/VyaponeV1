import { describe, expect, it, vi } from "vitest";
import { ensureUserProfile } from "@/lib/auth/profile";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

describe("VO-021 ensureUserProfile() Bootstrap Helper", () => {
  const createMockSupabase = (options: {
    existingUser?: { id: string } | null;
    userError?: { code: string; message: string } | null;
    insertError?: { message: string } | null;
  }) => {
    const insertedUsers: unknown[] = [];
    const insertedIdentities: unknown[] = [];

    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({
                  data: options.existingUser !== undefined ? options.existingUser : null,
                  error: options.userError || null,
                })),
              })),
            })),
            insert: vi.fn(async (record: unknown) => {
              insertedUsers.push(record);
              return { error: options.insertError || null };
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

  const mockUser: User = {
    id: "usr_test_12345",
    app_metadata: {},
    user_metadata: { full_name: "Rahul Dravid" },
    aud: "authenticated",
    email: "rahul@example.com",
    phone: "+919876543210",
    created_at: new Date().toISOString(),
  };

  it("bootstraps new public.users and user_auth_identities rows when user does not exist", async () => {
    const { mockClient, insertedUsers, insertedIdentities } = createMockSupabase({
      existingUser: null,
    });

    const result = await ensureUserProfile(mockClient, mockUser, {
      fullName: "Rahul Dravid",
      email: "rahul@example.com",
      phone: "+919876543210",
    });

    expect(result.success).toBe(true);
    expect(insertedUsers.length).toBe(1);
    expect(insertedUsers[0]).toEqual({
      id: "usr_test_12345",
      display_name: "Rahul Dravid",
      email: "rahul@example.com",
      phone_number: "+919876543210",
      status: "active",
      preferred_language: "en",
    });

    // Should create identities for both phone and email
    expect(insertedIdentities.length).toBe(2);
  });

  it("skips user insertion if public.users record already exists", async () => {
    const { mockClient, insertedUsers } = createMockSupabase({
      existingUser: { id: "usr_test_12345" },
    });

    const result = await ensureUserProfile(mockClient, mockUser);
    expect(result.success).toBe(true);
    expect(insertedUsers.length).toBe(0);
  });

  it("returns error message if database insert fails", async () => {
    const { mockClient } = createMockSupabase({
      existingUser: null,
      insertError: { message: "violates foreign key constraint" },
    });

    const result = await ensureUserProfile(mockClient, mockUser);
    expect(result.success).toBe(false);
    expect(result.error).toBe("violates foreign key constraint");
  });
});
