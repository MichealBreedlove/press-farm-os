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
 * Just requires an authenticated, ACTIVE session — no role gate. For routes
 * that key off `user.id` or membership rather than a role (e.g. chef-facing
 * mutations, service-role reads scoped to the caller).
 *
 * "Active" is enforced here because an admin's Deactivate (profiles.is_active
 * = false) previously only changed the badge in /admin/settings/users: the
 * account kept submitting orders, filing event requests and closing
 * deliveries through every route gated by this helper (2026-10-27).
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

  // (The SSR client's typed select/maybeSingle chain infers `never` for this
  // row shape, so narrow it explicitly — same workaround as open-date.)
  const { data } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", user.id)
    .maybeSingle();
  const profile = data as { is_active: boolean | null } | null;
  if (profile && profile.is_active === false) {
    return { ok: false, response: forbidden() };
  }
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
  // Inactive accounts are refused by default; `requireActive: false` is the
  // explicit opt-out (nothing uses it today — kept for symmetry with the old
  // signature, where the check was opt-IN and most callers forgot it).
  const mustBeActive = opts.requireActive ?? true;
  if (!role || !roles.includes(role) || (mustBeActive && (profile as any)?.is_active === false)) {
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
 * Vercel Cron gate. Returns null when the request carries
 * `Authorization: Bearer <CRON_SECRET>`, else a ready-to-return response.
 *
 * - Constant-time compare (the secret is a long-lived credential).
 * - Fails CLOSED in production when CRON_SECRET is unset (401 — Vercel's cron
 *   dashboard shows the failed run), and lets local/dev through so a bare
 *   `curl` works. One of the seven cron-style routes used to compare against
 *   the template string "Bearer undefined" and so failed OPEN (2026-10-27).
 *
 *   const denied = requireCronSecret(request);
 *   if (denied) return denied;
 */
export function requireCronSecret(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 401 });
    }
    return null;
  }
  const header = request.headers.get("authorization") ?? "";
  const provided = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(secret);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
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
