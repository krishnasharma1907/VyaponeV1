import { type NextRequest, NextResponse } from "next/server";
import { updateSession, copyCookies } from "@/lib/supabase/middleware";
import { isValidInternalRedirect } from "@/lib/auth/security";

/**
 * Route prefixes requiring an active authenticated user session.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/counter", "/workspace", "/platform-admin"];

/**
 * Route prefixes intended for unauthenticated guests only.
 */
const GUEST_ONLY_PREFIXES = ["/login", "/register", "/forgot-password"];

/**
 * Next.js Edge Middleware
 *
 * Enforces session token freshness and route access boundaries.
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Refresh auth session token & inspect current authenticated user
  const { response, user } = await updateSession(request);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const isGuestOnly = GUEST_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  // If unauthenticated user tries to access a protected back-office route
  if (isProtected && !user) {
    const loginUrl = new URL("/login", request.url);
    const fullPath = pathname + request.nextUrl.search;
    loginUrl.searchParams.set("next", fullPath);

    const redirectResponse = NextResponse.redirect(loginUrl);
    return copyCookies(response, redirectResponse);
  }

  // If authenticated user visits a guest-only route (login, register, forgot-password)
  if (isGuestOnly && user) {
    const rawNext = request.nextUrl.searchParams.get("next");
    const targetPath = isValidInternalRedirect(rawNext) ? (rawNext as string) : "/dashboard";

    const redirectResponse = NextResponse.redirect(new URL(targetPath, request.url));
    return copyCookies(response, redirectResponse);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static chunks and css)
     * - _next/image (image optimization API)
     * - favicon.ico (favicon)
     * - Static asset extensions (.svg, .png, .jpg, .webp, .woff2, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff|woff2|ico)$).*)",
  ],
};
