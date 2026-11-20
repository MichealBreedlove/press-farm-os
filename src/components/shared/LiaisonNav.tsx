"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Home, ListChecks, Sprout } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Farm Liaison bottom tabs — Home plus the three pages of the liaison
 * portal. Also shown on the chef order flow (/order, /history, /calendar)
 * when a liaison is the one ordering, so they can always get back.
 */
export function LiaisonNav() {
  const pathname = usePathname();
  const tabs = [
    { label: "Home", Icon: Home, href: "/liaison", exact: true, alsoActive: [] as string[] },
    { label: "Order", Icon: ClipboardList, href: "/order", exact: false, alsoActive: ["/history", "/calendar"] },
    { label: "Production", Icon: Sprout, href: "/liaison/production", exact: false, alsoActive: [] as string[] },
    { label: "Farm Tasks", Icon: ListChecks, href: "/liaison/tasks", exact: false, alsoActive: [] as string[] },
  ];

  return (
    <nav
      aria-label="Main"
      className="fixed bottom-0 left-0 right-0 bg-white shadow-nav z-50 safe-bottom print-hide"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16 max-w-3xl mx-auto">
        {tabs.map(({ label, Icon, href, exact, alsoActive }) => {
          const isActive = exact
            ? pathname === href
            : [href, ...alsoActive].some((p) => pathname === p || pathname.startsWith(p + "/"));
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium min-h-[44px] transition-colors",
                isActive ? "text-farm-green" : "text-farm-muted",
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.5} />
              <span>{label}</span>
              {isActive && <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-farm-green" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
