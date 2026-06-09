import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export type AdminAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

/**
 * Session-based admin gate for API routes.
 *
 * Replaces the getUser() → fetch `profiles.role` → compare block that was
 * duplicated across ~86 routes. Pass the request-scoped server client
 * (`await createClient()`); on success returns the authenticated `user`, on
 * failure a ready-to-return 401 (no session) or 403 (not admin) response:
 *
 *   const supabase = await createClient();
 *   const auth = await requireAdmin(supabase);
 *   if (!auth.ok) return auth.response;
 *   // ...auth.user.id is the admin
 */
export async function requireAdmin(supabase: SupabaseServerClient): Promise<AdminAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, user };
}

/**
 * API Key authentication for external access (OpenClaw, scripts, etc.)
 *
 * Set PRESSFARM_API_KEY in Vercel env vars.
 * Pass as: Authorization: Bearer <key> or x-api-key: <key>
 */
export function validateApiKey(request: Request): NextResponse | null {
  const apiKey = process.env.PRESSFARM_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API not configured — set PRESSFARM_API_KEY env var" }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const xApiKey = request.headers.get("x-api-key");

  const providedKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : xApiKey;

  // Constant-time compare (length check first — timingSafeEqual throws on
  // mismatched buffer lengths, and length isn't a useful oracle here).
  const provided = Buffer.from(providedKey ?? "");
  const expected = Buffer.from(apiKey);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return null; // Auth passed
}
