import { NextResponse } from "next/server";

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

  if (!providedKey || providedKey !== apiKey) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
  }

  return null; // Auth passed
}
