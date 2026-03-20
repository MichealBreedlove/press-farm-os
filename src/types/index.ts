/**
 * Press Farm OS — App-Level Type Definitions
 *
 * Convenience types that combine database rows with related data.
 * Used throughout the app for data fetching and component props.
 */

import type { Database, ItemCategory, UnitType, AvailabilityStatus, OrderStatus } from "./database";

// ============================================
// Row type aliases (shorthand)
// ============================================

export type Farm = Database["public"]["Tables"]["farms"]["Row"];
export type Restaurant = Database["public"]["Tables"]["restaurants"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type RestaurantUser = Database["public"]["Tables"]["restaurant_users"]["Row"];
export type Item = Database["public"]["Tables"]["items"]["Row"];
export type DeliveryDate = Database["public"]["Tables"]["delivery_dates"]["Row"];
export type AvailabilityItem = Database["public"]["Tables"]["availability_items"]["Row"];
export type Order = Database["public"]["Tables"]["orders"]["Row"];
export type OrderItem = Database["public"]["Tables"]["order_items"]["Row"];
export type PriceHistory = Database["public"]["Tables"]["price_history"]["Row"];
export type PriceCatalog = Database["public"]["Tables"]["price_catalog"]["Row"];
export type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
export type DeliveryItem = Database["public"]["Tables"]["delivery_items"]["Row"];
export type FarmExpense = Database["public"]["Tables"]["farm_expenses"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];

// ============================================
// Enriched types (joins)
// ============================================

/** Availability item with the item's master catalog data joined */
export type AvailabilityItemWithItem = AvailabilityItem & {
  item: Item;
};

/** Order with restaurant, chef, and line items */
export type OrderWithDetails = Order & {
  restaurant: Restaurant;
  chef: Profile;
  order_items: OrderItemWithAvailability[];
};

/** Order item with linked availability and item data */
export type OrderItemWithAvailability = OrderItem & {
  availability_item: AvailabilityItem & {
    item: Item;
  };
};

/** Delivery with restaurant and line items */
export type DeliveryWithItems = Delivery & {
  restaurant: Restaurant;
  delivery_items: (DeliveryItem & { item: Item })[];
};

/** Chef view: items grouped by category for ordering */
export type ItemsByCategory = Record<ItemCategory, AvailabilityItemWithItem[]>;

/** Admin harvest list: combined quantities from both restaurants */
export type HarvestListItem = {
  item: Item;
  press_qty: number | null;
  understudy_qty: number | null;
  total_qty: number;
  unit: UnitType;
};

// ============================================
// API response types
// ============================================

export type ApiSuccess<T> = {
  data: T;
  error: null;
};

export type ApiError = {
  data: null;
  error: string;
};

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ============================================
// Form input types
// ============================================

export type OrderItemInput = {
  availability_item_id: string;
  quantity: number;
};

export type OrderSubmitInput = {
  restaurant_id: string;
  delivery_date: string;
  items: OrderItemInput[];
  freeform_notes?: string;
};

export type AvailabilityUpdateInput = {
  item_id: string;
  status: AvailabilityStatus;
  limited_qty?: number | null;
  cycle_notes?: string | null;
};

export type ShortageInput = {
  order_item_id: string;
  quantity_fulfilled: number;
  shortage_reason: string;
};

export type DeliveryLineItemInput = {
  item_id: string;
  quantity: number;
  unit: UnitType;
  unit_price: number;
};

export type ExpenseInput = {
  date: string;
  category: string;
  description?: string;
  amount: number;
};

// ============================================
// Report types
// ============================================

export type MonthlyReport = {
  period: string; // e.g., "2026-02"
  press_value: number;
  understudy_value: number;
  total_value: number;
  operating_cost: number;
  cost_ratio: number;
  delivery_count: number;
  order_count: number;
  top_items_by_value: TopItem[];
  top_items_by_quantity: TopItem[];
  previous_month?: MonthlyReport;
};

export type TopItem = {
  item_name: string;
  category: ItemCategory;
  total_quantity: number;
  unit: UnitType;
  total_value: number;
};

export type QuarterlyIncome = {
  quarter: string; // e.g., "Q1 2026"
  press_value: number;
  understudy_value: number;
  total_value: number;
  total_expenses: number;
  farmer_pay: number;
  net_margin: number;
  cost_ratio: number;
};

// Re-export enum types
export type { ItemCategory, UnitType, AvailabilityStatus, OrderStatus };
export type { DayOfWeek, DeliveryStatus, PriceSource, NotificationType, NotificationChannel } from "./database";
