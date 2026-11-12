import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Supabase Browser Client [VO-017]", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("throws ConfigurationError when NEXT_PUBLIC_SUPABASE_URL is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key";

    const { createBrowserSupabaseClient } = await import("@/lib/supabase/client");

    expect(() => createBrowserSupabaseClient()).toThrow(
      /Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("throws ConfigurationError when NEXT_PUBLIC_SUPABASE_ANON_KEY is missing", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mock.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";

    const { createBrowserSupabaseClient } = await import("@/lib/supabase/client");

    expect(() => createBrowserSupabaseClient()).toThrow(
      /Supabase browser client requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY/,
    );
  });

  it("initializes browser client with public credentials without errors", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mockproject.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key-12345678901234567890";

    const { createBrowserSupabaseClient, _resetBrowserClientForTesting } =
      await import("@/lib/supabase/client");
    _resetBrowserClientForTesting();

    const client = createBrowserSupabaseClient();
    expect(client).toBeDefined();
    expect(typeof client.from).toBe("function");
    expect(typeof client.auth).toBe("object");
  });

  it("memoizes client instance in browser environment", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://mockproject.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "mock-anon-key-12345678901234567890";

    const { createBrowserSupabaseClient, _resetBrowserClientForTesting } =
      await import("@/lib/supabase/client");
    _resetBrowserClientForTesting();

    const client1 = createBrowserSupabaseClient();
    const client2 = createBrowserSupabaseClient();

    // In JSDOM (where window is defined), client instances should be identical
    expect(client1).toBe(client2);
  });
});
