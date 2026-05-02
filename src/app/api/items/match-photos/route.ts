import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "item-photos";
const FOLDER = "items";

/**
 * Auto-match photos to catalog items by name similarity.
 *
 * GET /api/items/match-photos?scope=missing|all
 *   - scope=missing (default): only items where image_url IS NULL
 *   - scope=all: every active, non-archived item — useful when user
 *     wants to overwrite mismatched assignments wholesale
 * Returns: { proposals: [{ itemId, itemName, currentUrl, photoPath, photoName, photoUrl, confidence, tier }] }
 *
 * POST /api/items/match-photos
 *   Body: { apply: [{ itemId, photoUrl }] }
 *   Updates items.image_url for each row. Returns { applied, errors }.
 *
 * Admin-only.
 */

interface ItemRow {
  id: string;
  name: string;
  image_url: string | null;
  is_archived: boolean;
}

interface PhotoMeta {
  name: string;     // bare filename ("bachelor-button.jpg")
  path: string;     // "items/bachelor-button.jpg"
  url: string;      // public URL
  tokens: Set<string>;
  normalized: string;
}

/** Drop the extension, lowercase, replace separators with single spaces, strip junk. */
function normalize(s: string): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, "")
    .replace(/[_\-\s]+/g, " ")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

const STOP_WORDS = new Set(["the", "of", "and", "with", "a", "an"]);

function tokenize(s: string): Set<string> {
  return new Set(
    normalize(s)
      .split(" ")
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t)),
  );
}

/**
 * Compute a [0,1] similarity score between an item name and a photo name.
 *
 * Strategy:
 *   1. Tokenize both, drop stopwords + 1-letter tokens
 *   2. Jaccard overlap on token sets
 *   3. Substring boost: if one normalized string contains the other,
 *      bump the score so compound filenames like "almondbranch" still
 *      match "Almond Branch" (which would tokenize differently)
 *   4. Acronym boost: if every token in the shorter side appears in
 *      the longer side, treat it as a strong match
 */
function similarity(itemTokens: Set<string>, itemNormalized: string, photo: PhotoMeta): number {
  if (itemTokens.size === 0 || photo.tokens.size === 0) return 0;

  let common = 0;
  for (const t of itemTokens) if (photo.tokens.has(t)) common++;
  const union = itemTokens.size + photo.tokens.size - common;
  let score = union > 0 ? common / union : 0;

  // Substring containment boost (handles "almondbranch" vs "almond branch")
  if (
    itemNormalized.length >= 4 &&
    photo.normalized.length >= 4 &&
    (photo.normalized.includes(itemNormalized) || itemNormalized.includes(photo.normalized))
  ) {
    score = Math.max(score, 0.85);
  }

  // "Every short-side token is in the long side" — handles cases where
  // a photo filename has extra prefix/suffix tokens beyond the item name
  // (e.g. "tomato_paul_robeson" matching "Paul Robeson")
  const [shorter, longer] =
    itemTokens.size <= photo.tokens.size ? [itemTokens, photo.tokens] : [photo.tokens, itemTokens];
  if (shorter.size >= 1) {
    let allIn = true;
    for (const t of shorter) if (!longer.has(t)) { allIn = false; break; }
    if (allIn) score = Math.max(score, 0.7);
  }

  return score;
}

function tier(score: number): "high" | "medium" | "low" {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") === "all" ? "all" : "missing";

  const admin = createAdminClient();

  // Pull items + photos in parallel — neither depends on the other
  const [itemsRes, photosRes] = await Promise.all([
    (admin as any)
      .from("items")
      .select("id, name, image_url, is_archived")
      .eq("is_archived", false)
      .order("name"),
    admin.storage.from(BUCKET).list(FOLDER, { limit: 1000, sortBy: { column: "name", order: "asc" } }),
  ]);

  if (itemsRes.error) {
    console.error("match-photos: items fetch error", itemsRes.error);
    return NextResponse.json({ error: itemsRes.error.message }, { status: 500 });
  }
  if (photosRes.error) {
    console.error("match-photos: photos list error", photosRes.error);
    return NextResponse.json({ error: photosRes.error.message }, { status: 500 });
  }

  const items: ItemRow[] = (itemsRes.data ?? []) as ItemRow[];
  const photos: PhotoMeta[] = (photosRes.data ?? [])
    .filter((f) => f.name && !f.name.startsWith("."))
    .map((f) => {
      const path = `${FOLDER}/${f.name}`;
      const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);
      return {
        name: f.name,
        path,
        url: urlData.publicUrl,
        normalized: normalize(f.name),
        tokens: tokenize(f.name),
      };
    });

  const candidates = scope === "missing" ? items.filter((i) => !i.image_url) : items;

  // Track which photos have been claimed already so we don't suggest the
  // same photo for two different items. Walk in order of "best match first"
  // by computing all pairs, sorting by score, and assigning greedily.
  type Pair = { itemIdx: number; photoIdx: number; score: number };
  const pairs: Pair[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const itemTokens = tokenize(candidates[i].name);
    const itemNormalized = normalize(candidates[i].name);
    for (let p = 0; p < photos.length; p++) {
      const score = similarity(itemTokens, itemNormalized, photos[p]);
      if (score >= 0.4) pairs.push({ itemIdx: i, photoIdx: p, score });
    }
  }
  pairs.sort((a, b) => b.score - a.score);

  const itemAssigned = new Set<number>();
  const photoAssigned = new Set<number>();
  const proposals: Array<{
    itemId: string;
    itemName: string;
    currentUrl: string | null;
    photoPath: string;
    photoName: string;
    photoUrl: string;
    confidence: number;
    tier: "high" | "medium" | "low";
  }> = [];

  for (const p of pairs) {
    if (itemAssigned.has(p.itemIdx) || photoAssigned.has(p.photoIdx)) continue;
    itemAssigned.add(p.itemIdx);
    photoAssigned.add(p.photoIdx);
    const item = candidates[p.itemIdx];
    const photo = photos[p.photoIdx];
    proposals.push({
      itemId: item.id,
      itemName: item.name,
      currentUrl: item.image_url,
      photoPath: photo.path,
      photoName: photo.name,
      photoUrl: photo.url,
      confidence: Math.round(p.score * 100) / 100,
      tier: tier(p.score),
    });
  }

  // Sort proposals: high confidence first, then medium, then alphabetical
  proposals.sort((a, b) => {
    const tierOrder = { high: 0, medium: 1, low: 2 };
    if (tierOrder[a.tier] !== tierOrder[b.tier]) return tierOrder[a.tier] - tierOrder[b.tier];
    return a.itemName.localeCompare(b.itemName);
  });

  return NextResponse.json({
    proposals,
    summary: {
      itemsConsidered: candidates.length,
      photosAvailable: photos.length,
      proposed: proposals.length,
      highConfidence: proposals.filter((p) => p.tier === "high").length,
      mediumConfidence: proposals.filter((p) => p.tier === "medium").length,
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await (supabase as any)
    .from("profiles").select("role").eq("id", user.id).single();
  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { apply: { itemId: string; photoUrl: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.apply) || body.apply.length === 0) {
    return NextResponse.json({ error: "No assignments provided" }, { status: 400 });
  }

  const admin = createAdminClient();
  let applied = 0;
  const errors: Array<{ itemId: string; error: string }> = [];

  // Run in parallel — each is an independent UPDATE on a single row
  await Promise.all(
    body.apply.map(async ({ itemId, photoUrl }) => {
      if (typeof itemId !== "string" || typeof photoUrl !== "string") {
        errors.push({ itemId: String(itemId), error: "Invalid assignment" });
        return;
      }
      try {
        const { error } = await (admin as any)
          .from("items")
          .update({ image_url: photoUrl })
          .eq("id", itemId);
        if (error) errors.push({ itemId, error: error.message });
        else applied++;
      } catch (err: any) {
        errors.push({ itemId, error: err?.message ?? "Update exception" });
      }
    }),
  );

  return NextResponse.json({ applied, errors });
}
