import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

/**
 * Auth middleware helper.
 * Refreshes the session and redirects unauthenticated users to /login.
 * Called from src/middleware.ts.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session AND validate it server-side. getUser() (not getSession())
  // is deliberate: getSession() trusts the cookie payload without verifying
  // the JWT against Supabase Auth, so a forged cookie would pass. The cost is
  // one auth round-trip per matched request.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Public routes that don't require auth.
  // /api/v1/* is the documented external read-only API; each route self-gates
  // via validateApiKey (src/lib/api-auth.ts). It must bypass this redirect or
  // external clients with a valid PRESSFARM_API_KEY can never reach the
  // handler.
  // /api/inbound/* receives webhooks from Resend Inbound for chef email replies
  // (route at /api/inbound/reply). Each request is signature-verified inside
  // the handler — Resend can't authenticate via Supabase cookies.
  // /api/contact is the public inquiry form on /about (prospective chefs aren't
  // signed in); it self-protects via a honeypot, length caps + IP rate limiting.
  // /api/cron/* is invoked by Vercel Cron with a Bearer CRON_SECRET (no Supabase
  // cookie) and fail-closes inside the handler, so it must bypass the redirect.
  const publicPaths = ["/login", "/signup", "/api/auth/signup", "/api/contact", "/about", "/auth/callback", "/auth/confirm", "/api/v1", "/api/inbound", "/api/cron"];
  const isPublicPath = publicPaths.some((p) => pathname.startsWith(p));

  if (!user && !isPublicPath) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
