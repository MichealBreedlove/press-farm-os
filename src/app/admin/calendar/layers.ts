import type { CalendarDay, CalendarLayer } from "@/lib/calendar";

/**
 * Layer palette — one swatch per layer, reused by the grid dots, the chip
 * filter row, and the day-panel section headers so the colour reads the same
 * everywhere. Every class is a static literal (Tailwind content scan) and
 * stays inside the documented status/brand families.
 */
export interface LayerMeta {
  key: CalendarLayer;
  label: string;
  /** Swatch / dot background. */
  dot: string;
  /** Mini chip (sm+ cells + panel counts). */
  chip: string;
  count: (d: CalendarDay) => number;
}

export const LAYER_META: LayerMeta[] = [
  {
    key: "orders",
    label: "Orders",
    dot: "bg-pf-master-blue",
    chip: "bg-blue-50 text-blue-700",
    count: (d) => d.orders.length,
  },
  {
    key: "deliveries",
    label: "Deliveries",
    dot: "bg-pf-master-orange",
    chip: "bg-orange-50 text-orange-700",
    count: (d) => d.deliveries.length,
  },
  {
    key: "tasks",
    label: "Tasks",
    dot: "bg-farm-green",
    chip: "bg-farm-green-light text-farm-green",
    count: (d) => d.tasks.filter((t) => t.status !== "completed").length,
  },
  {
    key: "harvest",
    label: "Harvest",
    dot: "bg-amber-500",
    chip: "bg-amber-50 text-amber-800",
    count: (d) => d.harvest.length,
  },
  {
    key: "events",
    label: "Events",
    dot: "bg-pf-master-violet",
    chip: "bg-pf-master-violet/10 text-pf-master-violet",
    count: (d) => d.eventRequests.length,
  },
  {
    key: "notes",
    label: "Notes",
    dot: "bg-farm-muted",
    chip: "bg-gray-100 text-gray-600",
    count: (d) => d.notes.length,
  },
  {
    key: "labor",
    label: "Labor",
    dot: "bg-farm-dark/50",
    chip: "bg-farm-cream text-farm-dark",
    count: (d) => (d.labor ? 1 : 0),
  },
];

export const LAYER_STORAGE_KEY = "pf-admin-calendar-layers";
