/**
 * Map item names → bundled flower illustration URLs.
 *
 * The brand pack ships 11 illustrations of common Press Farm flowers.
 * When an item has no `image_url` set, we fall back to one of these
 * if the item name matches.
 */

const FLOWER_MAP: Record<string, string> = {
  // Direct matches with bundled illustrations
  alyssum: "/assets/flowers/alyssum.png",
  "bachelor button": "/assets/flowers/bachelor-buttons.png",
  "bachelor buttons": "/assets/flowers/bachelor-buttons.png",
  fava: "/assets/flowers/fava-flowers.png",
  "fava flower": "/assets/flowers/fava-flowers.png",
  "fava flowers": "/assets/flowers/fava-flowers.png",
  marigold: "/assets/flowers/marigold.png",
  "gem marigold": "/assets/flowers/gem-marigold.png",
  "vetch": "/assets/flowers/hairy-vetch.png",
  "hairy vetch": "/assets/flowers/hairy-vetch.png",
  mustard: "/assets/flowers/mustard-flowers.png",
  "mustard flower": "/assets/flowers/mustard-flowers.png",
  "mustard flowers": "/assets/flowers/mustard-flowers.png",
  nasturtium: "/assets/flowers/nasturtium.png",
  pea: "/assets/flowers/pea-flower.png",
  "pea flower": "/assets/flowers/pea-flower.png",
  "pea flowers": "/assets/flowers/pea-flower.png",
  squash: "/assets/flowers/squash-blossom.png",
  "squash blossom": "/assets/flowers/squash-blossom.png",
  viola: "/assets/flowers/violas.png",
  violas: "/assets/flowers/violas.png",

  // Cross-mapped: items that visually resemble bundled illustrations
  // (use sparingly so admins still upload real photos for accuracy)
  allium: "/assets/flowers/bachelor-buttons.png", // both round purple-ish puffballs
  chive: "/assets/flowers/bachelor-buttons.png",
  "chive flower": "/assets/flowers/bachelor-buttons.png",
  "chive blossom": "/assets/flowers/bachelor-buttons.png",
  borage: "/assets/flowers/violas.png", // small star-shaped purple-blue florals
  "calendula flower": "/assets/flowers/marigold.png", // calendula is in marigold family
  calendula: "/assets/flowers/marigold.png",
};

/**
 * Returns a flower illustration URL if the item name matches a known
 * flower, otherwise returns null.
 *
 * Matching is case-insensitive and tries:
 *   1. Exact match
 *   2. Word-by-word substring match
 *
 * @example
 *   resolveFlowerImage("Nasturtium")              // → "/assets/flowers/nasturtium.png"
 *   resolveFlowerImage("Mustard Flowers, Yellow") // → "/assets/flowers/mustard-flowers.png"
 *   resolveFlowerImage("Carrots")                 // → null
 */
export function resolveFlowerImage(itemName: string): string | null {
  if (!itemName) return null;
  const lower = itemName.toLowerCase().trim();

  // 1. Exact match
  if (FLOWER_MAP[lower]) return FLOWER_MAP[lower];

  // 2. Substring — match longest key first so "mustard flower" beats "mustard"
  const sortedKeys = Object.keys(FLOWER_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) return FLOWER_MAP[key];
  }

  return null;
}

/**
 * Get the best image URL for an item:
 *   1. The item's own image_url (admin-set photo)
 *   2. Bundled flower illustration if name matches
 *   3. null (caller renders a generic placeholder)
 */
export function getItemImageUrl(item: { name: string; image_url?: string | null }): string | null {
  if (item.image_url) return item.image_url;
  return resolveFlowerImage(item.name);
}
