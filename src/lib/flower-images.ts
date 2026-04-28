/**
 * Item image resolution.
 *
 * Returns the item's own image_url (the real photo Micheal uploaded)
 * or null. The caller then shows the brand floral wreath mark as a
 * subtle placeholder.
 *
 * We deliberately do NOT auto-substitute flower illustrations for
 * items by name — real photos are always preferred, and the unified
 * wreath placeholder is more refined than mismatched stock flowers.
 */
export function getItemImageUrl(item: { name: string; image_url?: string | null }): string | null {
  return item.image_url ?? null;
}

/** Path to the floral wreath placeholder shown when an item has no photo. */
export const PLACEHOLDER_WREATH = "/assets/logo/png/logo-floral-only-transparent.png";
