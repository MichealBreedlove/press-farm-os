/**
 * Admin navigation — the single source of truth.
 *
 * BottomNav's More sheet, the dashboard's nav cards, and the Settings hub
 * all render from this list, so a page is never in one directory and
 * missing from another. Order here = display order everywhere.
 *
 * `icon` is a lucide-react component name (resolved by the client nav);
 * `flower` is a brand illustration slug for the dashboard cards.
 */

import { SEEDS_ENABLED } from "@/lib/constants";

export type AdminSurface = "sheet" | "dashboard" | "settings";

export interface AdminNavLink {
  href: string;
  label: string;
  /** Lucide icon name, e.g. "ClipboardList". */
  icon: string;
  /** Flower illustration slug under /assets/pressfarm/flowers/. */
  flower: string;
  /** Dashboard card caption (static; the dashboard may override with live stats). */
  description: string;
  /** Surfaces this link is omitted from. Default: shown everywhere its section is. */
  hideFrom?: AdminSurface[];
  /** Extra path prefixes that count as "inside" this link for active-state
   *  highlighting (e.g. Growing owns /admin/crop-plan, /admin/microgreens…). */
  matches?: string[];
}

export interface AdminNavSection {
  key: "daily" | "farm" | "reports" | "settings";
  title: string;
  eyebrow: string;
  links: AdminNavLink[];
}

export const ADMIN_NAV_SECTIONS: AdminNavSection[] = [
  {
    key: "daily",
    title: "Daily Operations",
    eyebrow: "The day's work",
    links: [
      { href: "/admin/orders", label: "Orders", icon: "ClipboardList", flower: "squash-blossom", description: "Today's orders · explore history" },
      { href: "/admin/availability", label: "Availability", icon: "Leaf", flower: "calendula", description: "What's ready to harvest" },
      { href: "/admin/deliveries", label: "Deliveries", icon: "PackageOpen", flower: "marigold", description: "Log & history" },
      { href: "/admin/tasks", label: "Tasks", icon: "CheckSquare", flower: "borage", description: "Today's farm work" },
      { href: "/admin/inbox", label: "Inbox", icon: "Mail", flower: "chamomile", description: "Chef email replies" },
      { href: "/admin/calendar", label: "Calendar", icon: "CalendarDays", flower: "anise-hyssop", description: "Everything, by day" },
      { href: "/admin/weekly-update", label: "Weekly Update", icon: "Newspaper", flower: "alyssum", description: "Chef email — edit before Monday" },
      { href: "/admin/event-requests", label: "Event Requests", icon: "CalendarHeart", flower: "pea-flower", description: "Past chef requests" },
    ],
  },
  {
    key: "farm",
    title: "Farm Management",
    eyebrow: "Behind the harvest",
    links: [
      { href: "/admin/items", label: "Items", icon: "Carrot", flower: "nasturtium", description: "Catalog & photos" },
      {
        href: "/admin/growing",
        label: "Growing",
        icon: "Sprout",
        flower: "pea-flower",
        description: "Crop plan · planter boxes · seeds · microgreens",
        matches: ["/admin/crop-plan", "/admin/planter-boxes", "/admin/microgreens", ...(SEEDS_ENABLED ? ["/admin/seeds"] : [])],
      },
      { href: "/admin/labor", label: "Labor", icon: "Clock", flower: "lavender", description: "Track hours" },
      { href: "/admin/expenses", label: "Expenses", icon: "Receipt", flower: "chive-blossom", description: "Track costs" },
      { href: "/admin/notes", label: "Notes", icon: "StickyNote", flower: "pansy", description: "Field observations" },
      { href: "/admin/forecast", label: "Forecast", icon: "TrendingUp", flower: "bachelor-button", description: "Predict next order demand" },
      { href: "/admin/foraging-calendar", label: "Foraging", icon: "TreePine", flower: "green-leaf", description: "Wild harvest by season" },
    ],
  },
  {
    key: "reports",
    title: "Reports & Analytics",
    eyebrow: "By the numbers",
    links: [
      { href: "/admin/reports", label: "Reports", icon: "BarChart3", flower: "green-leaf", description: "Revenue & P&L" },
      { href: "/admin/reports/executive", label: "Executive P&L", icon: "FileText", flower: "gem-marigold", description: "Print summary" },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    eyebrow: "Configuration",
    links: [
      { href: "/admin/settings", label: "Settings", icon: "Settings", flower: "fennel", description: "App config", hideFrom: ["settings"] },
      { href: "/admin/settings/users", label: "Users", icon: "Users", flower: "pansy", description: "Invite chefs, manage accounts, assign restaurants" },
      { href: "/admin/settings/emails", label: "Email Settings", icon: "AtSign", flower: "chamomile", description: "Sender addresses for notifications and reminders", hideFrom: ["sheet", "dashboard"] },
      { href: "/admin/settings/suggestions", label: "Suggestion Box", icon: "Lightbulb", flower: "borage", description: "Ideas and feedback for improving the system", hideFrom: ["sheet", "dashboard"] },
      { href: "/admin/settings/data-check", label: "Data Check", icon: "ShieldCheck", flower: "thyme", description: "Verify item counts, deliveries, and import completeness", hideFrom: ["sheet", "dashboard"] },
    ],
  },
];

/** The five fixed tabs on the admin bottom bar (label overrides for width). */
export const ADMIN_TABS: { href: string; label: string; icon: string }[] = [
  { href: "/admin/dashboard", label: "Home", icon: "Home" },
  { href: "/admin/tasks", label: "Tasks", icon: "CheckSquare" },
  { href: "/admin/orders", label: "Orders", icon: "ClipboardList" },
  { href: "/admin/availability", label: "Avail", icon: "Leaf" },
  { href: "/admin/deliveries", label: "Deliveries", icon: "PackageOpen" },
];

/** Links for one surface, section by section, honouring `hideFrom`. */
export function adminNavFor(surface: AdminSurface): AdminNavSection[] {
  return ADMIN_NAV_SECTIONS.map((s) => ({
    ...s,
    links: s.links.filter((l) => !l.hideFrom?.includes(surface)),
  })).filter((s) => s.links.length > 0);
}

/**
 * Which nav href should light up for a pathname. Most-specific match wins,
 * across every link's own href plus its `matches` prefixes — so
 * /admin/reports/executive lights "Executive P&L" (not "Reports"), and
 * /admin/microgreens/trays lights "Growing".
 */
export function resolveActiveHref(pathname: string): string | null {
  const candidates: { path: string; href: string }[] = [
    ...ADMIN_TABS.map((t) => ({ path: t.href, href: t.href })),
    ...ADMIN_NAV_SECTIONS.flatMap((s) =>
      s.links.flatMap((l) => [{ path: l.href, href: l.href }, ...(l.matches ?? []).map((m) => ({ path: m, href: l.href }))]),
    ),
  ];
  const hit = candidates
    .filter((c) => pathname === c.path || pathname.startsWith(c.path + "/"))
    .sort((a, b) => b.path.length - a.path.length)[0];
  return hit?.href ?? null;
}
