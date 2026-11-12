import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { _resetServerConfigForTesting } from "@/config/server";

// Mock server-only to simulate server runtime inside Vitest JSDOM environment
vi.mock("server-only", () => ({}));

describe("Supabase Administrative Client [VO-017]", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    _resetServerConfigForTesting();
  });

  afterEach(() => {
    process.env = originalEnv;
    _resetServerConfigForTesting();
    vi.restoreAllMocks();
  });

  it("throws ConfigurationError when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");

    expect(() =>
      createAdminSupabaseClient({
        NODE_ENV: "development",
        NEXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "",
      }),
    ).toThrow(
      /Administrative Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("throws ConfigurationError when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");

    expect(() =>
      createAdminSupabaseClient({
        NODE_ENV: "development",
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
        SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key-1234567890",
      }),
    ).toThrow(
      /Administrative Supabase client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it("creates administrative client with service-role credentials and non-persisted auth", async () => {
    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");

    const client = createAdminSupabaseClient({
      NODE_ENV: "development",
      NEXT_PUBLIC_SUPABASE_URL: "https://mock.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "mock-anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "mock-service-role-key-12345678901234567890",
    });

    expect(client).toBeDefined();
    expect(typeof client.from).toBe("function");
    expect(typeof client.auth).toBe("object");
  });

  it("never prints the actual service-role key in ConfigurationError message", async () => {
    const { createAdminSupabaseClient } = await import("@/lib/supabase/admin");

    const secretKey = "super-secret-service-role-key-that-must-never-leak";

    try {
      createAdminSupabaseClient({
        NODE_ENV: "production",
        NEXT_PUBLIC_SUPABASE_URL: "", // Cause failure
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
        SUPABASE_SERVICE_ROLE_KEY: secretKey,
      });
      expect.unreachable("Should have thrown ConfigurationError");
    } catch (error: unknown) {
      const err = error as Error;
      expect(err.name).toBe("ConfigurationError");
      expect(err.message).not.toContain(secretKey);
    }
  });
});
