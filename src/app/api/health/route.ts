import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

/**
 * GET /api/health
 *
 * Unauthenticated liveness + readiness probe for uptime monitors
 * (UptimeRobot / Better Stack), Kubernetes probes (deploy/k8s/), and the
 * post-deploy smoke check in CI.
 *
 * - 200 { status: "ok" }       — app is serving and Supabase answers
 * - 503 { status: "degraded" } — app is serving but the DB check failed
 *
 * The DB check is a HEAD count on `farms` (1 row) with a 3s timeout so a
 * hung connection can never wedge the probe. Response deliberately exposes
 * nothing sensitive: no table data, no env values, only the deploy SHA
 * Vercel already exposes in response headers.
 */
export async function GET() {
  const startedAt = Date.now();

  let dbOk = false;
  let dbError: string | null = null;
  try {
    const admin = createAdminClient();
    const check = admin
      .from("farms")
      .select("id", { count: "exact", head: true })
      .limit(1);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("db check timed out (3s)")), 3000),
    );
    const { error } = await Promise.race([check, timeout]);
    if (error) throw new Error(error.message);
    dbOk = true;
  } catch (err) {
    dbError = err instanceof Error ? err.message : "unknown error";
  }

  const body = {
    status: dbOk ? "ok" : "degraded",
    checks: {
      app: "ok",
      db: dbOk ? "ok" : `fail: ${dbError}`,
    },
    latencyMs: Date.now() - startedAt,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    env: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(body, {
    status: dbOk ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
