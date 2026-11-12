import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock server-only in Vitest JSDOM environment for route handler testing
vi.mock("server-only", () => ({}));

import { NextRequest } from "next/server";
import { GET } from "@/app/auth/callback/route";
import * as serverSupabase from "@/lib/supabase/server";
import * as profileBootstrap from "@/lib/auth/profile";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

describe("VO-021 Auth Callback Route Handler (/auth/callback)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const setupMockSupabase = (overrides?: {
    exchangeResult?: { data: { user: unknown } | null; error: unknown };
  }) => {
    const mockAuth = {
      exchangeCodeForSession: vi.fn(
        async () =>
          overrides?.exchangeResult || { data: { user: { id: "user-123" } }, error: null },
      ),
    };

    const mockClient = {
      auth: mockAuth,
    } as unknown as SupabaseClient<Database>;

    vi.spyOn(serverSupabase, "createServerSupabaseClient").mockResolvedValue(mockClient);
    vi.spyOn(profileBootstrap, "ensureUserProfile").mockResolvedValue({ success: true });

    return { mockClient, mockAuth };
  };

  it("exchanges code for session and redirects to validated internal destination", async () => {
    const { mockAuth } = setupMockSupabase();

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-pkce-code&next=/update-password",
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/update-password");
    expect(mockAuth.exchangeCodeForSession).toHaveBeenCalledWith("valid-pkce-code");
  });

  it("defaults to /dashboard when next destination is missing", async () => {
    setupMockSupabase();

    const request = new NextRequest("http://localhost:3000/auth/callback?code=valid-pkce-code");
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("neutralizes open redirect attacks in next param, redirecting to /dashboard", async () => {
    setupMockSupabase();

    const request = new NextRequest(
      "http://localhost:3000/auth/callback?code=valid-pkce-code&next=https://attacker.com",
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("redirects to /login with error query param when Supabase returns an error in callback", async () => {
    const request = new NextRequest(
      "http://localhost:3000/auth/callback?error=access_denied&error_description=User+declined",
    );
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login?error=User+declined");
  });

  it("redirects to /login with error message when exchangeCodeForSession fails", async () => {
    setupMockSupabase({
      exchangeResult: { data: null, error: new Error("Invalid PKCE grant") },
    });

    const request = new NextRequest("http://localhost:3000/auth/callback?code=expired-code");
    const response = await GET(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toContain("/login?error=");
  });
});
