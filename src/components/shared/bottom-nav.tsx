"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  CalendarDays,
  PackageOpen,
  Leaf,
  BarChart3,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  Icon: LucideIcon;
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/orders", label: "Orders", Icon: ClipboardList },
  { href: "/admin/availability", label: "Availability", Icon: CalendarDays },
  { href: "/admin/deliveries", label: "Deliveries", Icon: PackageOpen },
  { href: "/admin/items", label: "Items", Icon: Leaf },
  { href: "/admin/reports", label: "Reports", Icon: BarChart3 },
];

/**
 * BottomNav — admin mobile navigation bar.
 * Fixed to bottom of screen. 5 tabs.
 * Settings accessible via header/hamburger (not in bottom nav to keep it at 5 tabs).
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-stretch h-16">
        {ADMIN_NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = pathname.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs min-h-[44px]",
                isActive ? "text-farm-green font-medium" : "text-gray-400"
              )}
            >
              <Icon className="w-5 h-5" strokeWidth={isActive ? 2 : 1.5} />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
