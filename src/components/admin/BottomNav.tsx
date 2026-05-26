"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, ClipboardList, PackageOpen, Sprout, BarChart3, Mail, LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const NAV_ITEMS: { label: string; Icon: LucideIcon; href: string }[] = [
  { label: "Home", Icon: Home, href: "/admin/dashboard" },
  { label: "Orders", Icon: ClipboardList, href: "/admin/orders" },
  { label: "Deliveries", Icon: PackageOpen, href: "/admin/deliveries" },
  { label: "Micro", Icon: Sprout, href: "/admin/microgreens" },
  { label: "Reports", Icon: BarChart3, href: "/admin/reports" },
  { label: "Inbox", Icon: Mail, href: "/admin/inbox" },
];

interface BottomNavProps {
  /** Count of unread inbound replies — renders a red dot badge on the Inbox tab. */
  inboxUnreadCount?: number;
}

export function BottomNav({ inboxUnreadCount = 0 }: BottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white shadow-nav z-50 safe-bottom"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-stretch h-16">
        {NAV_ITEMS.map(({ label, Icon, href }) => {
          const isActive = pathname === href || pathname.startsWith(href + "/");
          const showBadge = href === "/admin/inbox" && inboxUnreadCount > 0;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "relative flex-1 flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium min-h-[44px] transition-colors",
                isActive ? "text-farm-green" : "text-farm-muted"
              )}
            >
              <div className="relative">
                <Icon
                  className="w-5 h-5"
                  strokeWidth={isActive ? 2.5 : 1.5}
                />
                {showBadge && (
                  <span
                    className="absolute -top-1.5 -right-2 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[9px] font-semibold flex items-center justify-center leading-none"
                    aria-label={`${inboxUnreadCount} unread`}
                  >
                    {inboxUnreadCount > 9 ? "9+" : inboxUnreadCount}
                  </span>
                )}
              </div>
              <span>{label}</span>
              {isActive && (
                <span className="absolute bottom-1.5 w-1 h-1 rounded-full bg-farm-green" />
              )}
            </Link>
          );
        })}

        {/* Sign Out — same bottom-right tab pattern used by ChefNav. The
            settings page no longer carries a SignOutButton card; sign-out
            lives here so it's reachable from any admin page. */}
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
