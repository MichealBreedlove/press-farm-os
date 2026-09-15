"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Chef bottom tabs. Sign-out is NOT here on purpose — it lives at the bottom
 * of /history, so a mis-tap while ordering can't drop a chef mid-order.
 */
export function ChefNav() {
  const pathname = usePathname();
  // "Order" is /order for chefs and /events/order for the Events account
  // (/order redirects the Events account there), so both paths light it up.
  const tabs = [
    { label: "Order", Icon: ClipboardList, href: "/order", alsoActive: ["/events"] },
    { label: "Calendar", Icon: CalendarDays, href: "/calendar", alsoActive: [] as string[] },
    { label: "History", Icon: Clock, href: "/history", alsoActive: [] as string[] },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-nav z-50 safe-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-stretch h-16">
        {tabs.map(({ label, Icon, href, alsoActive }) => {
          const isActive = [href, ...alsoActive].some(
            (p) => pathname === p || pathname.startsWith(p + "/"),
          );
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium min-h-[44px] transition-colors",
                isActive ? "text-farm-green" : "text-farm-muted"
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
