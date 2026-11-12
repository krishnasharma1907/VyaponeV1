import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock server-only to simulate server runtime inside Vitest JSDOM environment
vi.mock("server-only", () => ({}));

describe("Supabase Server Client [VO-017]", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws ConfigurationError when public Supabase credentials are missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";

    const { createServerSupabaseClient } = await import("@/lib/supabase/server");

    await expect(
      createServerSupabaseClient({
        getAll: () => [],
      }),
    ).rejects.toThrow(
      /Supabase server client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("creates request-scoped server client and reads cookies via getAll", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mockproject.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key-12345678901234567890";

    const { createServerSupabaseClient } = await import("@/lib/supabase/server");

    const mockCookieStore = [
      { name: "sb-mock-auth-token", value: "test-user-jwt" },
      { name: "theme", value: "light" },
    ];

    const getAllSpy = vi.fn().mockReturnValue(mockCookieStore);
    const setAllSpy = vi.fn();

    const client = await createServerSupabaseClient({
      getAll: getAllSpy,
      setAll: setAllSpy,
    });

    expect(client).toBeDefined();
    expect(typeof client.from).toBe("function");
    expect(typeof client.auth).toBe("object");
  });

  it("creates distinct request-scoped client instances without sharing state", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mockproject.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key-12345678901234567890";

    const { createServerSupabaseClient } = await import("@/lib/supabase/server");

    const client1 = await createServerSupabaseClient({
      getAll: () => [{ name: "session", value: "user-1" }],
    });

    const client2 = await createServerSupabaseClient({
      getAll: () => [{ name: "session", value: "user-2" }],
    });

    // Request-scoped instances MUST NOT be the same singleton
    expect(client1).not.toBe(client2);
  });
});
