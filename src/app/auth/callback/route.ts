import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth callback route — handles magic link and OAuth redirects.
 * Supabase redirects here after email confirmation.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only ever redirect within this origin: a `next` like "@evil.com" or
  // ".evil.com" would otherwise be glued onto `${origin}` and resolve to a
  // foreign host (userinfo / subdomain tricks). Relative paths only.
  const rawNext = searchParams.get("next") ?? "/";
  const next = /^\/(?![\/\\])/.test(rawNext) ? rawNext : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth error — redirect to login with error param
  return NextResponse.redirect(`${origin}/login?error=auth_error`);
}
