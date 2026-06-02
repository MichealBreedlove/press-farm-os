"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDays, CalendarHeart, ClipboardList, Clock, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ChefNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    // Bottom-nav placement makes accidental taps easy — confirm first so a
    // mis-scroll doesn't drop a chef out of an in-progress order.
    if (!window.confirm("Sign out of Press Farm?")) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const tabs = [
    { label: "Order", Icon: ClipboardList, href: "/order" },
    { label: "Calendar", Icon: CalendarDays, href: "/calendar" },
    { label: "Events", Icon: CalendarHeart, href: "/events" },
    { label: "History", Icon: Clock, href: "/history" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-nav z-50 safe-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex items-stretch h-16">
        {tabs.map(({ label, Icon, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
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

        <button
          onClick={handleSignOut}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-farm-muted hover:text-red-500 transition-colors min-h-[44px]"
        >
          <LogOut className="w-5 h-5" strokeWidth={1.5} />
          <span>Sign Out</span>
        </button>
      </div>
    </nav>
  );
}
