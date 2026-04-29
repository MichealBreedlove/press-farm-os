/**
 * Item image resolution + flower auto-matching.
 *
 * Resolution order:
 *   1. Admin-uploaded photo (item.image_url) — the real photo
 *   2. Auto-matched brand flower illustration if the item's name
 *      maps to one of our 28 botanical illustrations
 *   3. null — caller shows the brand floral wreath placeholder
 *
 * The auto-match uses a normalized lookup against known species
 * names + common aliases (e.g. "Bachelor Buttons" → bachelor-button,
 * "Squash Blossoms" → squash-blossom, "Hairy Vetch" → fairy-vetch).
 */

const FLOWERS_BASE = "/assets/pressfarm/flowers";

/** Path to the floral wreath placeholder shown when an item has no photo and no auto-match. */
export const PLACEHOLDER_WREATH = "/assets/logo/png/logo-floral-only-transparent.png";

/**
 * Map of normalized item names → flower slug.
 * Keys are lowercased, hyphens removed, spaces collapsed,
 * trailing -s removed (so "Squash Blossoms" matches "squashblossom").
 */
const FLOWER_NAME_MAP: Record<string, string> = {
  // Brand-sheet 14
  "alyssum": "alyssum",
  "bachelorbutton": "bachelor-button",
  "cornflower": "bachelor-button",
  "chiveblossom": "chive-blossom",
  "chiveflower": "chive-blossom",
  "fairyvetch": "fairy-vetch",
  "hairyvetch": "fairy-vetch", // legacy alias
  "favaflower": "fava-flower",
  "favabean": "fava-flower",
  "favabloom": "fava-flower",
  "gemmarigold": "gem-marigold",
  "signetmarigold": "gem-marigold",
  "greenleaf": "green-leaf",
  "leaf": "green-leaf",
  "marigold": "marigold",
  "mustardflower": "mustard-flower",
  "mustardbloom": "mustard-flower",
  "nasturtium": "nasturtium",
  "pansy": "pansy",
  "peaflower": "pea-flower",
  "peablossom": "pea-flower",
  "sweetpea": "pea-flower",
  "squashblossom": "squash-blossom",
  "squashflower": "squash-blossom",
  "viola": "viola",
  // Extended chef-garden 14
  "anisehyssop": "anise-hyssop",
  "agastache": "anise-hyssop",
  "borage": "borage",
  "boragefower": "borage",
  "calendula": "calendula",
  "potmarigold": "calendula",
  "chamomile": "chamomile",
  "camomile": "chamomile",
  "chervil": "chervil",
  "chervilflower": "chervil",
  "dill": "dill",
  "dillflower": "dill",
  "dillblossom": "dill",
  "fennel": "fennel",
  "fennelflower": "fennel",
  "fennelblossom": "fennel",
  "garlicchive": "garlic-chive",
  "garlicchiveflower": "garlic-chive",
  "lavender": "lavender",
  "nasturtiumleaf": "nasturtium-leaf",
  "nasturtiumleaves": "nasturtium-leaf",
  "rosemary": "rosemary",
  "rosemaryflower": "rosemary",
  "rosemaryblossom": "rosemary",
  "squashbud": "squash-bud",
  "babysquash": "squash-bud",
  "thaibasil": "thai-basil",
  "thaibasilflower": "thai-basil",
  "thyme": "thyme",
  "thymeflower": "thyme",
};

/**
 * Normalize an item name for flower lookup.
 * "Squash Blossoms (Yellow)" → "squashblossom"
 * "Bachelor Buttons" → "bachelorbutton"
 */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")            // strip parenthetical
    .replace(/[^a-z\s-]/g, "")            // strip punctuation
    .replace(/\s+/g, "")                  // collapse whitespace
    .replace(/-/g, "")                    // strip hyphens
    .replace(/s$/, "");                   // strip trailing -s (plural)
}

/** Find a brand flower illustration matching this item name, or null. */
export function flowerImageForName(name: string): string | null {
  const key = normalize(name);
  const slug = FLOWER_NAME_MAP[key];
  return slug ? `${FLOWERS_BASE}/${slug}.png` : null;
}

/**
 * Resolve an item's image URL.
 * Admin photo wins; otherwise falls back to brand flower illustration if name matches.
 * Returns null only if no photo AND no flower match (caller shows wreath placeholder).
 */
export function getItemImageUrl(item: { name: string; image_url?: string | null }): string | null {
  if (item.image_url) return item.image_url;
  return flowerImageForName(item.name);
}
