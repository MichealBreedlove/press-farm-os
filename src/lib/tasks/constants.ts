import type { FarmTaskSource, FarmTaskStatus, FarmTaskType } from "@/types/database";

export const RECURRING_HORIZON_DAYS = 30;

export const TASK_TYPE_LABELS: Record<FarmTaskType, string> = {
  sow: "Sow",
  transplant: "Transplant",
  harvest: "Harvest",
  terminate: "Terminate",
  maintenance: "Maintenance",
  inventory: "Inventory",
  "delivery-prep": "Delivery prep",
  "chef-request": "Chef request",
  custom: "Task",
};

export const TASK_TYPE_ICONS: Record<FarmTaskType, string> = {
  sow: "🌱",
  transplant: "🪴",
  harvest: "🌾",
  terminate: "✂️",
  maintenance: "🔧",
  inventory: "📦",
  "delivery-prep": "🚚",
  "chef-request": "👨‍🍳",
  custom: "•",
};

export const TASK_SOURCE_LABELS: Record<FarmTaskSource, string> = {
  manual: "Manual",
  "microgreens-auto": "Microgreens",
  "recurring-item": "Recurring",
  "inbox-confirmed": "Chef request",
};

export const TASK_STATUS_LABELS: Record<FarmTaskStatus, string> = {
  open: "Open",
  completed: "Done",
  superseded: "Superseded",
  cancelled: "Cancelled",
  snoozed: "Snoozed",
};

export const PRIORITY_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Urgent",
  2: "Normal",
  3: "Low",
  4: "Someday",
};

export const PRIORITY_COLORS: Record<1 | 2 | 3 | 4, string> = {
  1: "badge-red",
  2: "badge-blue",
  3: "bg-farm-muted/15 text-farm-muted",
  4: "bg-farm-muted/10 text-farm-muted",
};
