/**
 * Task photo URL validation. A task's `photo_urls` may only hold public
 * objects in this project's storage bucket (what the upload flow returns),
 * so a crafted request can't make the Farm Hand page load an arbitrary URL.
 */

export const MAX_TASK_PHOTOS = 4;

const TASK_PHOTO_URL =
  /^https:\/\/rxdfjaseilmjvcwamqyk\.supabase\.co\/storage\/v1\/object\/public\/item-photos\/tasks\/[A-Za-z0-9._-]+$/;

export function sanitizeTaskPhotoUrls(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  for (const v of input) {
    if (typeof v !== "string" || !TASK_PHOTO_URL.test(v) || out.includes(v)) continue;
    out.push(v);
    if (out.length >= MAX_TASK_PHOTOS) break;
  }
  return out;
}
