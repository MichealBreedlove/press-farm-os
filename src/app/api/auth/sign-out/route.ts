import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET/POST /api/auth/sign-out — Clear the Supabase session and redirect to /login.
 * Both verbs supported so it works as a plain anchor or a fetch.
 */
export async function GET(request: Request) {
  return signOut(request);
}

export async function POST(request: Request) {
  return signOut(request);
}

async function signOut(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`, { status: 303 });
}
