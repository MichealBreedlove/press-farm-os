import Link from "next/link";
import { SEEDS_ENABLED } from "@/lib/constants";
import { cn } from "@/lib/utils";

export type GrowingTab = "overview" | "crop-plan" | "planter-boxes" | "seeds" | "microgreens";

export const GROWING_TABS: { key: GrowingTab; label: string; href: string }[] = [
  { key: "overview", label: "Overview", href: "/admin/growing" },
  { key: "crop-plan", label: "Crop Plan", href: "/admin/crop-plan" },
  { key: "planter-boxes", label: "Planter Boxes", href: "/admin/planter-boxes" },
  ...(SEEDS_ENABLED ? [{ key: "seeds" as GrowingTab, label: "Seeds", href: "/admin/seeds" }] : []),
  { key: "microgreens", label: "Microgreens", href: "/admin/microgreens" },
];

/**
 * Tab strip shared by every "what's growing" page, so Crop Plan, Planter
 * Boxes, Seeds and Microgreens read as one section with one entry point
 * (/admin/growing). Plain links — each tab is its own server-rendered page.
 */
export function GrowingTabs({ active }: { active: GrowingTab }) {
  return (
    <div className="px-4 pt-4 max-w-3xl mx-auto">
      <nav
        className="flex gap-1 overflow-x-auto no-scrollbar -mx-4 px-4 border-b border-pf-master-gold/20"
        aria-label="Growing sections"
      >
        {GROWING_TABS.map((t) => {
          const on = t.key === active;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex-shrink-0 px-3 min-h-[44px] inline-flex items-center text-sm whitespace-nowrap transition-colors",
                on
                  ? "text-farm-dark font-medium border-b-2 border-pf-master-gold -mb-px"
                  : "text-farm-muted hover:text-farm-dark",
              )}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
