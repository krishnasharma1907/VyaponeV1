import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { publicConfig } from "@/config/public";
import type { Database } from "./types";

/**
 * Updates the user session across request and response headers.
 *
 * Designed for Next.js Middleware. Refreshes the Supabase Auth session token
 * before routing to Server Components, ensuring cookie freshness and preventing
 * unexpected session expiration during navigation.
 *
 * If Supabase is unconfigured (e.g. local dev without credentials), passes
 * through cleanly without throwing or terminating the request.
 *
 * @param request Next.js incoming request object.
 * @returns Modified NextResponse with updated cookie headers.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const url = publicConfig.supabaseUrl;
  const anonKey = publicConfig.supabaseAnonKey;

  // If Supabase is unconfigured, allow request to proceed without auth mutation
  if (!url || !anonKey) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // Refresh auth session
  // IMPORTANT: Do not use getSession() here as it does not validate against the server.
  // getUser() sends a request to the Supabase Auth server and securely validates the JWT.
  await supabase.auth.getUser();

  return supabaseResponse;
}
