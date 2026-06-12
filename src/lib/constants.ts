/**
 * Press Farm OS — Shared Constants
 *
 * Categories, units, statuses, and other enums used across the app.
 * Single source of truth — matches database CHECK constraints.
 */

import type { ItemCategory, UnitType, AvailabilityStatus, OrderStatus, DeliveryStatus } from "@/types";

// ============================================
// Item Categories
// ============================================

export const ITEM_CATEGORIES: { value: ItemCategory; label: string }[] = [
  { value: "flowers", label: "Flowers" },
  { value: "micros_leaves", label: "Micros & Leaves" },
  { value: "herbs_leaves", label: "Herbs & Leaves" },
  { value: "fruit_veg", label: "Fruit & Veg" },
  { value: "kits", label: "Kits" },
  { value: "family_meal", label: "Family Meal" },
];

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  flowers: "Flowers",
  micros_leaves: "Micros & Leaves",
  herbs_leaves: "Herbs & Leaves",
  fruit_veg: "Fruit & Veg",
  kits: "Kits",
  family_meal: "Family Meal",
};

// Category display order for chef order form
export const CATEGORY_ORDER: ItemCategory[] = [
  "flowers",
  "micros_leaves",
  "herbs_leaves",
  "fruit_veg",
  "kits",
  "family_meal",
];

// ============================================
// Season Statuses
// ============================================

export const SEASON_STATUSES: { value: string; label: string; color: string }[] = [
  { value: "available", label: "Available", color: "badge-green" },
  { value: "ending_soon", label: "Ending Soon", color: "badge-orange" },
  { value: "coming_soon", label: "Coming Soon", color: "badge-blue" },
  { value: "out_of_season", label: "Out of Season", color: "badge-gray" },
];

// ============================================
// Unit Types
// ============================================

export const ITEM_SIZES = [
  // Generic descriptors
  { value: "tiny", label: "Tiny" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "baby", label: "Baby" },
  { value: "micro", label: "Micro" },
  { value: "microgreen", label: "Microgreen" },
  // Coin / hand-scale references
  { value: "dime-nickel", label: "Dime - Nickel" },
  { value: "quarter", label: "Quarter" },
  { value: "dollar", label: "Dollar" },
  { value: "silver-dollar", label: "Silver Dollar" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "pencil-eraser", label: "Pencil Eraser" },
  { value: "palm", label: "Palm" },
  { value: "palm-size", label: "Palm Size" },
  // Inch-scale + specials
  { value: "1-inch", label: "1 inch" },
  { value: "2-inch", label: "2 inch" },
  { value: "3-inch", label: "3 inch" },
  { value: "crudite", label: "Crudite" },
  { value: "heart-leaf", label: "Heart Leaf" },
] as const;

export type ItemSize = (typeof ITEM_SIZES)[number]["value"];

export const UNIT_TYPES: { value: UnitType; label: string; description: string }[] = [
  { value: "ea", label: "EA", description: "Each" },
  { value: "sm", label: "SM", description: "Small To Go" },
  { value: "lg", label: "LG", description: "Large To Go" },
  { value: "gb", label: "GB", description: "Green Bin" },
  { value: "bu", label: "BU", description: "Bunch" },
  { value: "qt", label: "QT", description: "Quart" },
  { value: "pt", label: "PT", description: "Pint" },
  { value: "lbs", label: "LBS", description: "Pounds" },
  { value: "bx", label: "BX", description: "Box" },
  { value: "cs", label: "CS", description: "Case" },
  { value: "kit", label: "Kit", description: "Pre-assembled kit" },
];

export const UNIT_LABELS: Record<UnitType, string> = {
  ea: "EA",
  sm: "SM",
  lg: "LG",
  gb: "GB",
  lbs: "LBS",
  bu: "BU",
  qt: "QT",
  bx: "BX",
  cs: "CS",
  pt: "PT",
  kit: "Kit",
};

// ============================================
// Availability Statuses
// ============================================

export const AVAILABILITY_STATUSES: {
  value: AvailabilityStatus;
  label: string;
  color: string;
}[] = [
  { value: "available", label: "Available", color: "green" },
  { value: "limited", label: "Limited", color: "yellow" },
  { value: "unavailable", label: "Unavailable", color: "red" },
];

// ============================================
// Order Statuses
// ============================================

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  in_progress: "In Progress",
  fulfilled: "Fulfilled",
  cancelled: "Cancelled",
};

// ============================================
// Delivery Statuses
// ============================================

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
  pending: "Pending",
  logged: "Logged",
  finalized: "Finalized",
};

// ============================================
// Farm Expense Categories
// ============================================

export const EXPENSE_CATEGORIES = [
  "Seeds",
  "Plants",
  "Soil",
  "Amendments",
  "Equipment",
  "Gas",
  "Transport",
  "Supplies",
  "Labor",
  "Software",
  "Other",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// ============================================
// Delivery Schedule
// ============================================

export const DELIVERY_DAYS = ["thursday", "saturday", "monday"] as const;

// ============================================
// App Config
// ============================================

/**
 * Public-facing URL for emails, magic-link redirects, and OG metadata.
 *
 * Resolution order (first hit wins):
 *  1. NEXT_PUBLIC_APP_URL — explicit production override (set this in Vercel
 *     to your custom domain, e.g. https://pressfarm.app)
 *  2. VERCEL_PROJECT_PRODUCTION_URL — Vercel sets this on production builds
 *     (the project's main public domain, e.g. press-farm-os.vercel.app)
 *  3. NEXT_PUBLIC_VERCEL_URL / VERCEL_URL — Vercel sets this on every deploy
 *     including previews
 *  4. http://localhost:3000 — local dev fallback
 *
 * This guards against the failure mode where an unset NEXT_PUBLIC_APP_URL
 * causes /login URLs and magic-link redirect_to params to point at
 * localhost from a production-deployed email.
 */
function resolveAppUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && explicit.trim()) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  const any = process.env.NEXT_PUBLIC_VERCEL_URL ?? process.env.VERCEL_URL;
  if (any) return `https://${any.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}

export const APP_URL = resolveAppUrl();

export const ADMIN_EMAIL = "pressfarm@pressnapavalley.com";

/**
 * Reply-To address on every outbound email.
 *
 * Lands at Resend Inbound, which POSTs the message to /api/inbound/reply.
 * The webhook stores it in `inbound_messages` and runs LLM extraction to
 * pull item requests into the `suggestions` table.
 *
 * Override with RESEND_REPLY_TO env var if you ever need to point replies
 * somewhere else (e.g. during a Resend Inbound outage).
 */
export const REPLY_TO_ADDRESS =
  process.env.RESEND_REPLY_TO || "replies@pressfarm.io";

/**
 * Per-purpose sender addresses. Each can be overridden by an env var.
 * Falls back to RESEND_FROM_EMAIL, then to default @pressfarm.io.
 */
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || "Press Farm <orders@pressfarm.io>";

export const FROM_EMAIL = DEFAULT_FROM;

export const FROM_ADDRESSES = {
  /** Admin gets order submission notifications */
  orders: process.env.RESEND_FROM_ORDERS || "Press Farm Orders <orders@pressfarm.io>",
  /** Chef gets availability published notifications */
  availability: process.env.RESEND_FROM_AVAILABILITY || "Press Farm <availability@pressfarm.io>",
  /** Admin gets weekly summary email */
  digest: process.env.RESEND_FROM_DIGEST || "Press Farm Reports <digest@pressfarm.io>",
  /** Sent to weekly labor reviewer */
  timesheet: process.env.RESEND_FROM_TIMESHEET || "Press Farm <timesheet@pressfarm.io>",
  /** Chefs get the forward-looking availability forecast */
  forecast: process.env.RESEND_FROM_FORECAST || "Press Farm <availability@pressfarm.io>",
  /** Partners (e.g. Chef Phil) get the monthly/quarterly partner report */
  partnerReport: process.env.RESEND_FROM_PARTNER_REPORT || "Press Farm <hello@pressfarm.io>",
  /** Chef gets order confirmation/shortage notices */
  noreply: process.env.RESEND_FROM_NOREPLY || "Press Farm <noreply@pressfarm.io>",
};

/** Max characters for order freeform notes */
export const MAX_NOTES_LENGTH = 1000;

/** Session duration for chefs (30 days in seconds) */
export const CHEF_SESSION_DURATION = 60 * 60 * 24 * 30;

// ─── Seeds ──────────────────────────────────────────────────────────────
// Master kill switch for the /admin/seeds feature. Migration 046 was
// applied to production on 2026-05-19 via Supabase MCP — feature is live.
export const SEEDS_ENABLED = true;

export const SEED_STATUSES = ["active", "low", "exhausted", "discarded"] as const;
export type SeedStatus = (typeof SEED_STATUSES)[number];

export const SEED_STATUS_LABELS: Record<SeedStatus, string> = {
  active: "Active",
  low: "Low",
  exhausted: "Exhausted",
  discarded: "Discarded",
};

// Free-text suggestions for the unit picker — user can type anything.
export const SEED_QUANTITY_UNIT_SUGGESTIONS = [
  "packets",
  "g",
  "oz",
  "seeds",
  "lbs",
] as const;
