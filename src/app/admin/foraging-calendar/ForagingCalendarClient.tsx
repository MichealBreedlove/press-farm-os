"use client";

import { useMemo, useState } from "react";
import { ChevronDown, AlertTriangle } from "lucide-react";
import {
  FORAGE_ITEMS,
  CATEGORY_META,
  MONTH_LABELS,
  type ForageCategory,
  type ForageItem,
} from "@/lib/foraging-calendar-data";
import { cn } from "@/lib/utils";

type Filter = "all" | ForageCategory;

interface ForagingCalendarClientProps {
  currentMonth: number; // 1–12
  counts: Record<ForageCategory, number>;
  inPeakNow: ForageItem[];
}

const FILTER_ORDER: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "greens", label: "Greens" },
  { value: "mushrooms", label: "Mushrooms" },
  { value: "berries", label: "Berries & Fruit" },
  { value: "flowers", label: "Flowers" },
  { value: "nuts", label: "Nuts & Seeds" },
  { value: "seaweed", label: "Seaweed" },
];

export function ForagingCalendarClient({
  currentMonth,
  counts,
  inPeakNow,
}: ForagingCalendarClientProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const items = filter === "all" ? FORAGE_ITEMS : FORAGE_ITEMS.filter((i) => i.category === filter);
    return [...items].sort((a, b) => {
      const aNow = a.peak.includes(currentMonth) ? 0 : 1;
      const bNow = b.peak.includes(currentMonth) ? 0 : 1;
      if (aNow !== bNow) return aNow - bNow;
      return a.name.localeCompare(b.name);
    });
  }, [filter, currentMonth]);

  const totalCount = FORAGE_ITEMS.length;

  return (
    <div className="px-4 pb-8 max-w-3xl mx-auto">
      {/* In-peak-now callout */}
      {inPeakNow.length > 0 && (
        <section className="mt-6 rounded-2xl border border-pf-master-gold/30 bg-white/80 px-5 py-4">
          <p
            className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold font-medium"
            style={{ fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif" }}
          >
            What's wild this {MONTH_LABELS[currentMonth - 1]}
          </p>
          <p className="font-display text-2xl text-farm-dark leading-snug mt-1">
            {inPeakNow.length} {inPeakNow.length === 1 ? "harvest" : "harvests"} at peak
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {inPeakNow.map((item) => (
              <button
                key={item.slug}
                onClick={() => {
                  setFilter("all");
                  setExpanded(item.slug);
                  setTimeout(() => {
                    document.getElementById(`row-${item.slug}`)?.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                    });
                  }, 50);
                }}
                className="text-[12px] px-2.5 py-1 rounded-full bg-farm-green/10 text-farm-green hover:bg-farm-green/20 transition-colors"
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Filter chips */}
      <div className="mt-6 -mx-1 flex gap-1.5 overflow-x-auto pb-2 px-1 scrollbar-thin">
        {FILTER_ORDER.map(({ value, label }) => {
          const count = value === "all" ? totalCount : counts[value];
          const active = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "flex-shrink-0 text-[12px] px-3 py-1.5 rounded-full border transition-colors min-h-[36px]",
                active
                  ? "bg-farm-dark text-white border-farm-dark"
                  : "bg-white text-farm-dark border-farm-muted/30 hover:border-farm-dark/40",
              )}
            >
              <span>{label}</span>
              <span className={cn("ml-1.5 text-[10px]", active ? "text-white/70" : "text-farm-muted")}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Month-header strip */}
      <div className="mt-4 sticky top-0 bg-farm-cream/95 backdrop-blur z-10 pt-2 pb-2 border-b border-pf-master-gold/20">
        <div className="grid grid-cols-[1fr_repeat(12,minmax(0,1fr))] items-center gap-0.5">
          <div className="text-[10px] text-farm-muted tracking-wide uppercase pl-1">Item</div>
          {MONTH_LABELS.map((m, i) => {
            const isNow = i + 1 === currentMonth;
            return (
              <div
                key={m}
                className={cn(
                  "text-[9px] text-center font-medium tabular-nums",
                  isNow ? "text-farm-dark" : "text-farm-muted",
                )}
              >
                <div className={cn("relative", isNow && "after:content-[''] after:absolute after:left-1/2 after:-translate-x-1/2 after:-bottom-2 after:w-1 after:h-1 after:rounded-full after:bg-pf-master-gold")}>
                  {m.slice(0, 1)}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Item rows */}
      <ul className="mt-2 divide-y divide-pf-master-gold/15">
        {filtered.map((item) => {
          const isOpen = expanded === item.slug;
          const isPeakNow = item.peak.includes(currentMonth);
          return (
            <li key={item.slug} id={`row-${item.slug}`}>
              <button
                onClick={() => setExpanded(isOpen ? null : item.slug)}
                className="w-full text-left py-2.5 px-1 hover:bg-white/40 transition-colors rounded"
                aria-expanded={isOpen}
              >
                <div className="grid grid-cols-[1fr_repeat(12,minmax(0,1fr))] items-center gap-0.5">
                  <div className="min-w-0 pr-1.5">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={cn(
                          "text-[13px] leading-tight truncate",
                          isPeakNow ? "text-farm-dark font-semibold" : "text-farm-dark",
                        )}
                      >
                        {item.name}
                      </p>
                      {item.caution && (
                        <AlertTriangle
                          className="w-3 h-3 text-amber-700 flex-shrink-0"
                          aria-label="caution"
                        />
                      )}
                    </div>
                    <p className="text-[10px] text-farm-muted truncate italic">
                      {CATEGORY_META[item.category].label}
                    </p>
                  </div>
                  {Array.from({ length: 12 }).map((_, i) => {
                    const month = i + 1;
                    const isPeak = item.peak.includes(month);
                    const isShoulder = item.shoulder?.includes(month);
                    const isCurrent = month === currentMonth;
                    return (
                      <div
                        key={month}
                        className={cn(
                          "h-5 rounded-sm border",
                          isPeak
                            ? "bg-farm-green border-farm-green"
                            : isShoulder
                              ? "bg-farm-green/25 border-farm-green/30"
                              : "bg-white/40 border-pf-master-gold/15",
                          isCurrent && !isPeak && !isShoulder && "ring-1 ring-pf-master-gold/40",
                          isCurrent && (isPeak || isShoulder) && "ring-1 ring-pf-master-gold",
                        )}
                      />
                    );
                  })}
                </div>
              </button>
              {isOpen && (
                <div className="px-3 pb-4 pt-1 text-[13px] leading-relaxed text-farm-dark/90 space-y-2 max-w-prose">
                  {item.scientificName && (
                    <p className="text-[11px] tracking-wide uppercase text-farm-muted italic">
                      {item.scientificName}
                    </p>
                  )}
                  <p>
                    <span className="font-semibold text-farm-dark">Where: </span>
                    <span className="text-farm-dark/80">{item.habitat}</span>
                  </p>
                  <p className="text-farm-dark/80">{item.notes}</p>
                  {item.caution && (
                    <div className="mt-2 rounded-lg border border-amber-700/30 bg-amber-50 px-3 py-2 flex gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
                      <p className="text-[12px] text-amber-900 leading-relaxed">
                        <span className="font-semibold">Caution. </span>
                        {item.caution}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-[11px] text-farm-muted pt-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-2 rounded-sm bg-farm-green" />
                      Peak
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-3 h-2 rounded-sm bg-farm-green/25" />
                      Shoulder
                    </div>
                  </div>
                </div>
              )}
              <button
                onClick={() => setExpanded(isOpen ? null : item.slug)}
                className="w-full flex justify-center -mt-1 pb-1 text-farm-muted hover:text-farm-dark"
                aria-label={isOpen ? "Collapse" : "Expand"}
              >
                <ChevronDown
                  className={cn(
                    "w-3.5 h-3.5 transition-transform",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Footer disclaimer */}
      <p className="mt-8 text-[11px] text-farm-muted leading-relaxed text-center max-w-md mx-auto">
        Field reference for the Napa / North Bay region. Always positively identify
        before consuming — a 100% match on every diagnostic, not 95%.
        Foraging is restricted in most state and national parks; check land-use
        rules before harvesting. Take a fraction, leave the rest.
      </p>
    </div>
  );
}
