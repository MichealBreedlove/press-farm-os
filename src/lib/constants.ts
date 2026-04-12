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
  { value: "tiny", label: "Tiny" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "dime-nickel", label: "Dime - Nickel" },
  { value: "quarter", label: "Quarter" },
  { value: "dollar", label: "Dollar" },
  { value: "palm", label: "Palm" },
  { value: "pencil-eraser", label: "Pencil Eraser" },
  { value: "thumbnail", label: "Thumbnail" },
  { value: "silver-dollar", label: "Silver Dollar" },
  { value: "1-inch", label: "1 inch" },
  { value: "2-inch", label: "2 inch" },
  { value: "3-inch", label: "3 inch" },
  { value: "baby", label: "Baby" },
  { value: "crudite", label: "Crudite" },
  { value: "micro", label: "Micro" },
  { value: "microgreen", label: "Microgreen" },
  { value: "heart-leaf", label: "Heart Leaf" },
  { value: "palm-size", label: "Palm Size" },
] as const;

export type ItemSize = (typeof ITEM_SIZES)[number]["value"];

export const UNIT_TYPES: { value: UnitType; label: string; description: string }[] = [
  { value: "ea", label: "EA", description: "Each" },
  { value: "sm", label: "SM", description: "Small To Go" },
  { value: "lg", label: "LG", description: "Large To Go" },
  { value: "lbs", label: "LBS", description: "Pounds" },
  { value: "bu", label: "BU", description: "Bunch" },
  { value: "qt", label: "QT", description: "Quart" },
  { value: "bx", label: "BX", description: "Box" },
  { value: "cs", label: "CS", description: "Case" },
  { value: "pt", label: "PT", description: "Pint" },
  { value: "kit", label: "Kit", description: "Pre-assembled kit" },
];

export const UNIT_LABELS: Record<UnitType, string> = {
  ea: "EA",
  sm: "SM",
  lg: "LG",
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

export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const ADMIN_EMAIL = "micheal@pressfarm.app";

export const FROM_EMAIL = "orders@pressfarm.app";

/** Max characters for order freeform notes */
export const MAX_NOTES_LENGTH = 1000;

/** Session duration for chefs (30 days in seconds) */
export const CHEF_SESSION_DURATION = 60 * 60 * 24 * 30;
