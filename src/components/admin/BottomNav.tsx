"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, CalendarDays, PackageOpen, Leaf, BarChart3 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { label: string; Icon: LucideIcon; href: string }[] = [
  { label: "Orders", Icon: ClipboardList, href: "/admin/orders" },
  { label: "Availability", Icon: CalendarDays, href: "/admin/availability" },
  { label: "Deliveries", Icon: PackageOpen, href: "/admin/deliveries" },
  { label: "Items", Icon: Leaf, href: "/admin/items" },
  { label: "Reports", Icon: BarChart3, href: "/admin/reports" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-50 safe-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ label, Icon, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium min-h-[44px] transition-colors",
                isActive ? "text-farm-green" : "text-gray-400"
              )}
            >
              <Icon
                className="w-5 h-5"
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
