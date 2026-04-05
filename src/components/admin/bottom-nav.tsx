"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/orders", label: "Orders", icon: "📋" },
  { href: "/admin/availability", label: "Avail", icon: "✅" },
  { href: "/admin/deliveries", label: "Delivery", icon: "🚚" },
  { href: "/admin/items", label: "Items", icon: "🌿" },
  { href: "/admin/reports", label: "Reports", icon: "📊" },
];

export default function AdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 h-16 flex items-center justify-around px-2 z-50">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 text-[10px] font-medium transition-colors ${
              active ? "text-farm-green" : "text-gray-400"
            }`}
          >
            <span className="text-xl leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
