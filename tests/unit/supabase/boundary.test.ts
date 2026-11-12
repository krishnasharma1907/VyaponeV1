import { describe, expect, it } from "vitest";

describe("Supabase Architecture & Server-Only Boundaries [VO-017]", () => {
  it("allows browser client to be imported without triggering server-only guard", async () => {
    // client.ts does NOT import server-only and should import cleanly in JSDOM / client context
    const clientModule = await import("@/lib/supabase/client");
    expect(clientModule).toBeDefined();
    expect(typeof clientModule.createBrowserSupabaseClient).toBe("function");
  });

  it("fails to import server client in unmocked client environment due to server-only guard", async () => {
    // In Vitest JSDOM environment without mocks, node_modules/server-only/index.js throws:
    // "This module cannot be imported from a Client Component module."
    await expect(import("@/lib/supabase/server")).rejects.toThrow(
      /This module cannot be imported from a Client Component module/,
    );
  });

  it("fails to import admin client in unmocked client environment due to server-only guard", async () => {
    await expect(import("@/lib/supabase/admin")).rejects.toThrow(
      /This module cannot be imported from a Client Component module/,
    );
  });
});
