import { EXPENSE_CATEGORIES } from "@/lib/constants";

/**
 * Pure validation for the expense create/update payload.
 *
 * The admin expense form lets Micheal tag one expense with several
 * categories; the client joins them with ", " (e.g. "Seeds, Soil") and the
 * list page splits on the same separator. The stored `category` column is
 * therefore a ", "-joined list of known category names, and validation has
 * to accept that shape rather than a single name.
 */

export const EXPENSE_CATEGORY_SEPARATOR = ", ";

export interface ExpenseInput {
  date: string;
  category: string;
  description: string | null;
  vendor: string | null;
  amount: number;
}

export type ExpenseValidation =
  | { ok: true; value: ExpenseInput }
  | { ok: false; error: string };

const KNOWN = new Set<string>(EXPENSE_CATEGORIES);

/** Normalize a ", "-joined (or single) category string; null when invalid. */
export function normalizeExpenseCategory(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const parts = raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const seen: string[] = [];
  for (const p of parts) {
    if (!KNOWN.has(p)) return null;
    if (!seen.includes(p)) seen.push(p);
  }
  return seen.join(EXPENSE_CATEGORY_SEPARATOR);
}

function optionalText(raw: unknown): string | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateExpenseInput(body: unknown): ExpenseValidation {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid body" };
  }
  const b = body as Record<string, unknown>;

  const date = b.date;
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "Invalid date" };
  }

  const category = normalizeExpenseCategory(b.category);
  if (!category) return { ok: false, error: "Invalid category" };

  const amountRaw = b.amount;
  const amount = typeof amountRaw === "string" ? Number(amountRaw) : amountRaw;
  if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, error: "amount must be a positive number" };
  }

  return {
    ok: true,
    value: {
      date,
      category,
      description: optionalText(b.description),
      vendor: optionalText(b.vendor),
      amount: Math.round(amount * 100) / 100,
    },
  };
}
