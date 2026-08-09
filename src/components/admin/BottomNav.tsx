"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ClipboardList,
  PackageOpen,
  Sprout,
  BarChart3,
  Mail,
  CheckSquare,
  LogOut,
  Menu,
  X,
  Leaf,
  CalendarDays,
  CalendarHeart,
  Newspaper,
  Carrot,
  Map,
  Boxes,
  Bean,
  Clock,
  Receipt,
  StickyNote,
  TrendingUp,
  TreePine,
  FileText,
  Users,
  Settings,
  Palette,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SEEDS_ENABLED } from "@/lib/constants";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { label: string; Icon: LucideIcon; href: string }[] = [
  { label: "Home", Icon: Home, href: "/admin/dashboard" },
  { label: "Tasks", Icon: CheckSquare, href: "/admin/tasks" },
  { label: "Orders", Icon: ClipboardList, href: "/admin/orders" },
  { label: "Avail", Icon: Leaf, href: "/admin/availability" },
  { label: "Deliveries", Icon: PackageOpen, href: "/admin/deliveries" },
];

/**
 * Full admin directory for the More sheet — every /admin page, grouped the
 * same way as the dashboard nav cards, so anything is reachable in two taps
 * from anywhere without a round-trip through Home.
 */
const MENU_SECTIONS: {
  eyebrow: string;
  links: { label: string; Icon: LucideIcon; href: string }[];
}[] = [
  {
    eyebrow: "Daily Operations",
    links: [
      { label: "Orders", Icon: ClipboardList, href: "/admin/orders" },
      { label: "Availability", Icon: Leaf, href: "/admin/availability" },
      { label: "Deliveries", Icon: PackageOpen, href: "/admin/deliveries" },
      { label: "Tasks", Icon: CheckSquare, href: "/admin/tasks" },
      { label: "Inbox", Icon: Mail, href: "/admin/inbox" },
      { label: "Calendar", Icon: CalendarDays, href: "/admin/calendar" },
      { label: "Weekly Update", Icon: Newspaper, href: "/admin/weekly-update" },
      { label: "Event Requests", Icon: CalendarHeart, href: "/admin/event-requests" },
    ],
  },
  {
    eyebrow: "Farm Management",
    links: [
      { label: "Items", Icon: Carrot, href: "/admin/items" },
      { label: "Microgreens", Icon: Sprout, href: "/admin/microgreens" },
      { label: "Crop Plan", Icon: Map, href: "/admin/crop-plan" },
      { label: "Planter Boxes", Icon: Boxes, href: "/admin/planter-boxes" },
      ...(SEEDS_ENABLED
        ? [{ label: "Seeds", Icon: Bean, href: "/admin/seeds" }]
        : []),
      { label: "Labor", Icon: Clock, href: "/admin/labor" },
      { label: "Expenses", Icon: Receipt, href: "/admin/expenses" },
      { label: "Notes", Icon: StickyNote, href: "/admin/notes" },
      { label: "Forecast", Icon: TrendingUp, href: "/admin/forecast" },
      { label: "Foraging", Icon: TreePine, href: "/admin/foraging-calendar" },
    ],
  },
  {
    eyebrow: "Reports & Analytics",
    links: [
      { label: "Reports", Icon: BarChart3, href: "/admin/reports" },
      { label: "Executive P&L", Icon: FileText, href: "/admin/reports/executive" },
    ],
  },
  {
    eyebrow: "Settings",
    links: [
      { label: "Users", Icon: Users, href: "/admin/settings/users" },
      { label: "Settings", Icon: Settings, href: "/admin/settings" },
      { label: "UI Kit", Icon: Palette, href: "/admin/ui-kit" },
    ],
  },
];

interface BottomNavProps {
  /** Count of unread inbound replies — badge on the Inbox row + dot on More. */
  inboxUnreadCount?: number;
  /** Count of open tasks due today/overdue — badge on the Tasks tab. */
  tasksOpenCount?: number;
}

export function BottomNav({ inboxUnreadCount = 0, tasksOpenCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close the sheet whenever navigation lands — BottomNav persists across
  // admin routes, so the sheet would otherwise stay open over the new page.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Lock body scroll while the sheet is up.
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  async function handleSignOut() {
    // Confirm first — same guard ChefNav uses against accidental taps.
    if (!window.confirm("Sign out of Press Farm?")) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  // Tabs highlight most-specific-first so /admin/reports/executive doesn't
  // light up the Reports tab AND the sheet's Executive row differently.
  const badgeFor = (href: string) => {
    if (href === "/admin/tasks" && tasksOpenCount > 0) return tasksOpenCount;
    if (href === "/admin/inbox" && inboxUnreadCount > 0) return inboxUnreadCount;
    return 0;
  };

  return (
    <>
      {/* MORE SHEET — full directory of every admin page */}
      {menuOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="All admin pages"
          className="fixed inset-x-0 top-0 bottom-16 z-40 bg-white overflow-y-auto overscroll-contain"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="px-5 pt-6 pb-8 max-w-3xl mx-auto">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-display text-2xl text-farm-dark">Everything</h2>
              <button
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
                className="w-11 h-11 -mr-2 flex items-center justify-center text-farm-muted hover:text-farm-dark transition-colors"
              >
                <X className="w-6 h-6" strokeWidth={1.5} />
              </button>
            </div>

            {MENU_SECTIONS.map((section) => (
              <section key={section.eyebrow} className="mt-5 first:mt-2">
                <p
                  className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold mb-2"
                  style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
                >
                  {section.eyebrow}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {section.links.map(({ label, Icon, href }) => {
                    const active = isActive(href);
                    const badge = badgeFor(href);
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-xl border px-3 py-3 min-h-[48px] transition-colors",
                          active
                            ? "border-farm-green/40 bg-farm-green/5 text-farm-green"
                            : "border-farm-dark/10 bg-farm-cream/40 text-farm-dark hover:bg-farm-cream"
                        )}
                      >
                        <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={active ? 2.5 : 1.5} />
                        <span className="text-sm font-medium leading-tight flex-1 min-w-0">
                          {label}
                        </span>
                        {badge > 0 && (
                          <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center leading-none flex-shrink-0">
                            {badge > 9 ? "9+" : badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}

            <button
              onClick={handleSignOut}
              className="mt-8 w-full flex items-center justify-center gap-2 rounded-xl border border-farm-dark/10 px-3 py-3 min-h-[48px] text-sm font-medium text-farm-muted hover:text-red-600 hover:border-red-200 transition-colors"
            >
              <LogOut className="w-5 h-5" strokeWidth={1.5} />
              Sign Out
            </button>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white shadow-nav z-50 safe-bottom"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-stretch h-16">
          {NAV_ITEMS.map(({ label, Icon, href }) => {
            const active = !menuOpen && isActive(href);
            const badge = badgeFor(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMenuOpen(false)}
                className={cn(
                  "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium min-h-[44px] transition-colors",
                  active ? "text-farm-green" : "text-farm-muted"
                )}
              >
                <div className="relative">
                  <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 1.5} />
                  {badge > 0 && (
                    <span
                      className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none"
                      aria-label={`${badge} open`}
                    >
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </div>
                <span>{label}</span>
                {active && (
                  <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-farm-green" />
                )}
              </Link>
            );
          })}

          {/* MORE — opens the full directory. Carries a red dot when the
              Inbox (now inside the sheet) has unread replies. */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
            className={cn(
              "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium min-h-[44px] transition-colors",
              menuOpen ? "text-farm-green" : "text-farm-muted"
            )}
          >
            <div className="relative">
              {menuOpen ? (
                <X className="w-5 h-5" strokeWidth={2.5} />
              ) : (
                <Menu className="w-5 h-5" strokeWidth={1.5} />
              )}
              {!menuOpen && inboxUnreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-red-500"
                  aria-label={`${inboxUnreadCount} unread inbox replies`}
                />
              )}
            </div>
            <span>More</span>
            {menuOpen && (
              <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-farm-green" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
