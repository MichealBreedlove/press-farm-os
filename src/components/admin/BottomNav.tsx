"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "Orders", icon: "📋", href: "/admin/orders" },
  { label: "Availability", icon: "🌿", href: "/admin/availability" },
  { label: "Deliveries", icon: "🚚", href: "/admin/deliveries" },
  { label: "Items", icon: "📦", href: "/admin/items" },
  { label: "Reports", icon: "📊", href: "/admin/reports" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex items-stretch z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] transition-colors ${
              isActive
                ? "text-green-700"
                : "text-gray-400 hover:text-gray-600 active:text-green-600"
            }`}
          >
            <span className="text-xl leading-none" aria-hidden="true">
              {item.icon}
            </span>
            <span className={`text-[10px] font-medium leading-none ${isActive ? "text-green-700" : ""}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
