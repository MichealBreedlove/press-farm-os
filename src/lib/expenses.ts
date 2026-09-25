import { EXPENSE_CATEGORIES } from "@/lib/constants";

/**
 * Expenses may carry several categories, stored as one comma-joined string
 * ("Seeds, Soil") — the expense form multi-selects them and the CSV export
 * writes them verbatim. Every writer (POST/PATCH/CSV import) normalizes
 * through here so the stored string is always canonical: known categories
 * only, canonical casing, deduped, in EXPENSE_CATEGORIES order.
 *
 * Returns null when the input is empty or contains an unknown category.
 */
export function normalizeExpenseCategory(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parts = raw.split(",").map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (parts.length === 0) return null;
  const wanted = new Set(parts);
  const matched = EXPENSE_CATEGORIES.filter((c) => wanted.has(c.toLowerCase()));
  if (matched.length !== wanted.size) return null;
  return matched.join(", ");
}

/** Split a stored category string back into its known categories. */
export function splitExpenseCategory(stored: string | null | undefined): string[] {
  if (!stored) return [];
  const normalized = normalizeExpenseCategory(stored);
  return normalized ? normalized.split(", ") : [];
}

/** YYYY-MM guard for ?month= params. */
export function isValidMonth(month: string | null | undefined): month is string {
  return !!month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
}
