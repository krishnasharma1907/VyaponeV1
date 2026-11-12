import { type NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isValidInternalRedirect } from "@/lib/auth/security";
import { ensureUserProfile } from "@/lib/auth/profile";

/**
 * Next.js Route Handler for Supabase Auth PKCE Callback
 *
 * Handles redirect callbacks from:
 * - Email confirmation links
 * - Password recovery magic links / PKCE codes
 * - Phone OTP verification redirects
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const error = requestUrl.searchParams.get("error");
  const errorDescription = requestUrl.searchParams.get("error_description");

  // Enforce open-redirect protection
  const safeNext = isValidInternalRedirect(next) ? (next as string) : "/dashboard";

  // If Supabase returned an error in the query parameters
  if (error) {
    const loginErrorUrl = new URL("/login", request.url);
    loginErrorUrl.searchParams.set("error", errorDescription || error);
    return NextResponse.redirect(loginErrorUrl);
  }

  if (code) {
    try {
      const supabase = await createServerSupabaseClient();
      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        const errorUrl = new URL("/login", request.url);
        errorUrl.searchParams.set("error", "The authentication link is invalid or has expired.");
        return NextResponse.redirect(errorUrl);
      }

      if (data?.user) {
        // Idempotently bootstrap public profile and auth identity
        await ensureUserProfile(supabase, data.user);
      }

      return NextResponse.redirect(new URL(safeNext, request.url));
    } catch {
      const errorUrl = new URL("/login", request.url);
      errorUrl.searchParams.set("error", "An error occurred while verifying your session.");
      return NextResponse.redirect(errorUrl);
    }
  }

  // Fallback if no code provided
  return NextResponse.redirect(new URL("/login", request.url));
}
