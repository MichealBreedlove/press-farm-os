"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: string; // emoji for now — replace with icons in UI build
}

const ADMIN_NAV_ITEMS: NavItem[] = [
  { href: "/admin/orders", label: "Orders", icon: "📋" },
  { href: "/admin/availability", label: "Availability", icon: "📊" },
  { href: "/admin/deliveries", label: "Deliveries", icon: "📦" },
  { href: "/admin/items", label: "Items", icon: "🌱" },
  { href: "/admin/reports", label: "Reports", icon: "📈" },
];

/**
 * BottomNav — admin mobile navigation bar.
 * Fixed to bottom of screen. 5 tabs.
 * Settings accessible via header/hamburger (not in bottom nav to keep it at 5 tabs).
 *
 * TODO: Replace emoji icons with proper icon library (Lucide/Heroicons)
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 safe-area-inset-bottom">
      <div className="flex items-stretch h-16">
        {ADMIN_NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex-1 flex flex-col items-center justify-center gap-0.5 text-xs min-h-[44px]",
                isActive
                  ? "text-farm-green font-medium"
                  : "text-gray-400"
              )}
            >
              <span className="text-lg leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
