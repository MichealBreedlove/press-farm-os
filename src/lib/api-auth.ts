import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/** Roles stored on `profiles.role`. */
export type Role = "admin" | "receiver" | "chef" | "harvester";

export type AdminAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export type UserAuthResult =
  | { ok: true; user: User }
  | { ok: false; response: NextResponse };

export type RoleAuthResult =
  | { ok: true; user: User; role: Role }
  | { ok: false; response: NextResponse };

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const forbidden = () =>
  NextResponse.json({ error: "Forbidden" }, { status: 403 });

/**
 * Just requires an authenticated session — no role gate. For routes that key
 * off `user.id` or membership rather than a role (e.g. chef-facing mutations,
 * service-role reads scoped to the caller).
 *
 *   const supabase = await createClient();
 *   const auth = await requireUser(supabase);
 *   if (!auth.ok) return auth.response;
 *   const user = auth.user;
 */
export async function requireUser(supabase: SupabaseServerClient): Promise<UserAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: unauthorized() };
  return { ok: true, user };
}

/**
 * Session + role gate. Returns 401 (no session) or 403 (role not in `roles`,
 * or — when `requireActive` is set — the profile is inactive). The single
 * source of truth behind {@link requireAdmin}; use directly for multi-role
 * routes (e.g. `requireRole(supabase, ["receiver", "admin"])`).
 */
export async function requireRole(
  supabase: SupabaseServerClient,
  roles: ReadonlyArray<Role>,
  opts: { requireActive?: boolean } = {},
): Promise<RoleAuthResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: unauthorized() };

  const { data: profile } = await (supabase as any)
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();
  const role = (profile as any)?.role as Role | undefined;
  if (!role || !roles.includes(role) || (opts.requireActive && !(profile as any)?.is_active)) {
    return { ok: false, response: forbidden() };
  }

  return { ok: true, user, role };
}

/**
 * Session-based admin gate for API routes.
 *
 * Replaces the getUser() → fetch `profiles.role` → compare block that was
 * duplicated across dozens of routes. Pass the request-scoped server client
 * (`await createClient()`); on success returns the authenticated `user`, on
 * failure a ready-to-return 401 (no session) or 403 (not admin) response:
 *
 *   const supabase = await createClient();
 *   const auth = await requireAdmin(supabase);
 *   if (!auth.ok) return auth.response;
 *   // ...auth.user.id is the admin
 */
export async function requireAdmin(supabase: SupabaseServerClient): Promise<AdminAuthResult> {
  const auth = await requireRole(supabase, ["admin"]);
  if (!auth.ok) return auth;
  return { ok: true, user: auth.user };
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
