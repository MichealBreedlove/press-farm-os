"use client";

import { useMemo, useState } from "react";
import { MapPin, AlertTriangle } from "lucide-react";
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

const BANK_GOTHIC: React.CSSProperties = {
  fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif",
};

function scrollToItem(slug: string) {
  const el = document.getElementById(`forage-${slug}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("ring-2", "ring-pf-master-gold");
  setTimeout(() => {
    el.classList.remove("ring-2", "ring-pf-master-gold");
  }, 1500);
}

export function ForagingCalendarClient({
  currentMonth,
  counts,
  inPeakNow,
}: ForagingCalendarClientProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    const items =
      filter === "all" ? FORAGE_ITEMS : FORAGE_ITEMS.filter((i) => i.category === filter);
    return [...items].sort((a, b) => {
      const aNow = a.peak.includes(currentMonth) ? 0 : 1;
      const bNow = b.peak.includes(currentMonth) ? 0 : 1;
      if (aNow !== bNow) return aNow - bNow;
      return a.name.localeCompare(b.name);
    });
  }, [filter, currentMonth]);

  const totalCount = FORAGE_ITEMS.length;
  const monthName = MONTH_LABELS[currentMonth - 1];

  return (
    <div className="px-4 pb-12 max-w-2xl mx-auto">
      {/* ─── Editorial spotlight: what's in peak this month ─── */}
      {inPeakNow.length > 0 && (
        <section className="mt-6 rounded-2xl bg-white/75 border border-pf-master-gold/30 px-6 py-7 shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
            <p
              className="text-[10px] tracking-[0.25em] uppercase text-pf-master-gold font-medium"
              style={BANK_GOTHIC}
            >
              Now Foraging · {monthName}
            </p>
            <span className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
          </div>
          <h3 className="font-display text-3xl sm:text-4xl text-farm-dark leading-tight mt-3">
            What's wild this {monthName.toLowerCase()}
          </h3>
          <p className="text-sm text-farm-muted mt-2 max-w-lg leading-relaxed">
            {inPeakNow.length}{" "}
            {inPeakNow.length === 1 ? "harvest is" : "harvests are"} at peak across the
            Napa and North Bay region this month.
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            {inPeakNow.map((item) => (
              <button
                key={item.slug}
                onClick={() => scrollToItem(item.slug)}
                className="text-[12px] px-3 py-1.5 rounded-full bg-farm-green/10 text-farm-green border border-farm-green/20 hover:bg-farm-green/20 transition-colors"
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ─── Filter chips ─── */}
      <div className="mt-7 -mx-1 flex gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-thin">
        {FILTER_ORDER.map(({ value, label }) => {
          const count = value === "all" ? totalCount : counts[value];
          const active = filter === value;
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "flex-shrink-0 text-[12px] px-3.5 py-2 rounded-full border transition-colors min-h-[36px] whitespace-nowrap",
                active
                  ? "bg-farm-dark text-farm-cream border-farm-dark"
                  : "bg-white/70 text-farm-dark border-pf-master-gold/30 hover:border-pf-master-gold/60",
              )}
            >
              <span>{label}</span>
              <span
                className={cn(
                  "ml-2 text-[10px] tabular-nums",
                  active ? "text-farm-cream/60" : "text-farm-muted",
                )}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px] text-farm-muted tracking-wide">
        {filtered.length} {filtered.length === 1 ? "item" : "items"}
        {filter !== "all" && ` · ${CATEGORY_META[filter as ForageCategory].label}`}
        {" · sorted by season"}
      </p>

      {/* ─── Item cards ─── */}
      <ul className="mt-3 space-y-3">
        {filtered.map((item) => {
          const peakNow = item.peak.includes(currentMonth);
          const category = CATEGORY_META[item.category].label;
          return (
            <li
              key={item.slug}
              id={`forage-${item.slug}`}
              className="rounded-2xl bg-white/85 border border-pf-master-gold/20 px-5 sm:px-6 py-5 transition-all"
            >
              {/* Eyebrow row */}
              <div className="flex items-center gap-2">
                <p
                  className="text-[9.5px] tracking-[0.24em] uppercase text-pf-master-gold font-medium"
                  style={BANK_GOTHIC}
                >
                  {category}
                </p>
                {peakNow && (
                  <>
                    <span className="text-pf-master-gold/40 text-[10px]">·</span>
                    <p
                      className="text-[9.5px] tracking-[0.24em] uppercase text-farm-green font-semibold"
                      style={BANK_GOTHIC}
                    >
                      {monthName} Peak
                    </p>
                  </>
                )}
                {item.caution && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium tracking-wide">
                    <AlertTriangle className="w-3 h-3" />
                    Caution
                  </span>
                )}
              </div>

              {/* Title */}
              <h4 className="font-display text-2xl sm:text-3xl text-farm-dark leading-tight mt-1.5">
                {item.name}
              </h4>
              {item.scientificName && (
                <p className="text-[12px] text-farm-muted italic mt-1">
                  {item.scientificName}
                </p>
              )}

              {/* Year strip */}
              <div className="mt-5">
                <div className="grid grid-cols-12 gap-1 mb-1.5">
                  {MONTH_LABELS.map((m, i) => {
                    const isCurrent = i + 1 === currentMonth;
                    return (
                      <div
                        key={m}
                        className={cn(
                          "text-[9px] text-center tracking-wide tabular-nums",
                          isCurrent
                            ? "text-pf-master-gold font-semibold"
                            : "text-farm-muted/70",
                        )}
                      >
                        {m.toUpperCase()}
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-12 gap-1 items-center">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const month = i + 1;
                    const isPeak = item.peak.includes(month);
                    const isShoulder = item.shoulder?.includes(month);
                    const isCurrent = month === currentMonth;
                    return (
                      <div
                        key={month}
                        className="relative h-3 flex items-center"
                      >
                        <div
                          className={cn(
                            "w-full h-2.5 rounded-full transition-colors",
                            isPeak
                              ? "bg-farm-green"
                              : isShoulder
                                ? "bg-farm-green/30"
                                : "bg-pf-master-gold/10",
                          )}
                        />
                        {isCurrent && (
                          <span
                            className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-1 h-1 rounded-full bg-pf-master-gold"
                            aria-hidden="true"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Habitat */}
              <div className="mt-5 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-pf-master-gold/80 mt-0.5 flex-shrink-0" />
                <p className="text-[12px] text-farm-dark/70 leading-relaxed">
                  {item.habitat}
                </p>
              </div>

              {/* Notes */}
              <p className="mt-2.5 text-[13.5px] text-farm-dark/90 leading-relaxed">
                {item.notes}
              </p>

              {/* Caution */}
              {item.caution && (
                <div className="mt-4 rounded-lg border border-amber-700/25 bg-amber-50/80 px-3.5 py-2.5 flex gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-700 flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-amber-900 leading-relaxed">
                    <span className="font-semibold">Caution. </span>
                    {item.caution}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Legend */}
      <div className="mt-8 flex items-center justify-center gap-5 text-[11px] text-farm-muted">
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-2 rounded-full bg-farm-green" />
          Peak
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-5 h-2 rounded-full bg-farm-green/30" />
          Shoulder
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-pf-master-gold" />
          {monthName}
        </div>
      </div>

      {/* Footer disclaimer */}
      <p className="mt-6 text-[11px] text-farm-muted leading-relaxed text-center max-w-md mx-auto px-2">
        Field reference for the Napa / North Bay region. Always positively
        identify before consuming — a 100% match on every diagnostic, not 95%.
        Foraging is restricted in most state and national parks; check land-use
        rules before harvesting. Take a fraction, leave the rest.
      </p>
    </div>
  );
}
