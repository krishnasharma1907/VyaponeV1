import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "@/middleware";
import * as supabaseMiddleware from "@/lib/supabase/middleware";
import type { User } from "@supabase/supabase-js";

describe("VO-021 Next.js 15 Middleware Route Protection", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const createRequest = (path: string, cookies: Record<string, string> = {}) => {
    const url = new URL(path, "http://localhost:3000");
    const req = new NextRequest(url);
    Object.entries(cookies).forEach(([k, v]) => {
      req.cookies.set(k, v);
    });
    return req;
  };

  it("redirects unauthenticated users trying to access /dashboard to /login with encoded next param", async () => {
    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const request = createRequest("/dashboard/orders?status=active");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    const location = response.headers.get("location");
    expect(location).toBe(
      "http://localhost:3000/login?next=%2Fdashboard%2Forders%3Fstatus%3Dactive",
    );
  });

  it("redirects unauthenticated users trying to access /counter to /login", async () => {
    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const request = createRequest("/counter/pos");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fcounter%2Fpos",
    );
  });

  it("redirects unauthenticated users trying to access /workspace to /login", async () => {
    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const request = createRequest("/workspace/clients");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fworkspace%2Fclients",
    );
  });

  it("redirects unauthenticated users trying to access /platform-admin to /login", async () => {
    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const request = createRequest("/platform-admin/audit-logs");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/login?next=%2Fplatform-admin%2Faudit-logs",
    );
  });

  it("allows authenticated users to access protected routes", async () => {
    const mockUser: User = {
      id: "auth-user-123",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: mockUser,
    });

    const request = createRequest("/dashboard/catalogue");
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects authenticated users away from guest routes (/login) to /dashboard", async () => {
    const mockUser: User = {
      id: "auth-user-123",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: mockUser,
    });

    const request = createRequest("/login");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("redirects authenticated users from /login to safe internal 'next' destination", async () => {
    const mockUser: User = {
      id: "auth-user-123",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: mockUser,
    });

    const request = createRequest("/login?next=%2Fcounter%2Fpos");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/counter/pos");
  });

  it("neutralizes open redirect attacks in 'next' param for authenticated users", async () => {
    const mockUser: User = {
      id: "auth-user-123",
      app_metadata: {},
      user_metadata: {},
      aud: "authenticated",
      created_at: new Date().toISOString(),
    };

    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: mockUser,
    });

    const request = createRequest("/login?next=https%3A%2F%2Fevil.com");
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
  });

  it("allows unauthenticated access to public routes without redirection", async () => {
    vi.spyOn(supabaseMiddleware, "updateSession").mockResolvedValue({
      response: NextResponse.next(),
      user: null,
    });

    const request = createRequest("/s/demo-store");
    const response = await middleware(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("copies cookies across redirects using copyCookies", () => {
    const source = NextResponse.next();
    source.cookies.set("sb-access-token", "xyz-token", { httpOnly: true });
    source.cookies.set("sb-refresh-token", "refresh-token", { httpOnly: true });

    const dest = NextResponse.redirect(new URL("/login", "http://localhost:3000"));
    supabaseMiddleware.copyCookies(source, dest);

    expect(dest.cookies.get("sb-access-token")?.value).toBe("xyz-token");
    expect(dest.cookies.get("sb-refresh-token")?.value).toBe("refresh-token");
  });
});
