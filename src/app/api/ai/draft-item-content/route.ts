import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAnthropicClient, ANTHROPIC_KEY_MISSING_ERROR } from "@/lib/anthropic/client";
import { draftItemContent } from "@/lib/anthropic/draft-item";
import { ITEM_CATEGORIES } from "@/lib/constants";
import type { ItemCategory } from "@/types";

const VALID_CATEGORIES = ITEM_CATEGORIES.map((c) => c.value);

interface DraftRequest {
  name?: string;
  variety?: string;
  color?: string;
  category?: ItemCategory | string;
  source?: string;
}

/**
 * POST /api/ai/draft-item-content
 *
 * Admin-only. Generates a starter draft of chef notes, growing notes, and
 * growing-condition fields for a new item using Claude Haiku 4.5. The
 * client overlays the result onto only the empty fields of the form, so
 * admin edits are never overwritten.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if ((profile as any)?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: DraftRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (body.category && !VALID_CATEGORIES.includes(body.category as ItemCategory)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const client = getAnthropicClient();
  if (!client) {
    return NextResponse.json({ error: ANTHROPIC_KEY_MISSING_ERROR }, { status: 503 });
  }

  try {
    const draft = await draftItemContent(client, {
      name,
      variety: body.variety,
      color: body.color,
      category: body.category as ItemCategory | undefined,
      source: body.source,
    });
    return NextResponse.json({ draft });
  } catch (err: any) {
    const message = err?.message ?? "AI request failed";
    const status = typeof err?.status === "number" ? err.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
