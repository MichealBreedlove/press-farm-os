"use client";

import { useMemo, useState } from "react";
import { MapPin, AlertTriangle, Sprout } from "lucide-react";
import {
  FORAGE_ITEMS,
  CATEGORY_META,
  REGION_META,
  ALL_REGIONS,
  MONTH_LABELS,
  wikiTitleFor,
  type ForageCategory,
  type ForageRegion,
  type ForageItem,
} from "@/lib/foraging-calendar-data";
import { ForageImage } from "./ForageImage";
import { cn } from "@/lib/utils";

type CategoryFilter = "all" | ForageCategory | "invasives";
type RegionFilter = "all" | ForageRegion;

interface ForagingCalendarClientProps {
  defaultMonth: number; // 1–12 — today's month from the server
}

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "mushrooms", label: "Mushrooms" },
  { value: "greens", label: "Wild Greens" },
  { value: "berries", label: "Berries" },
  { value: "fruits", label: "Fruits" },
  { value: "invasives", label: "Invasives" },
];

const REGION_FILTERS: { value: RegionFilter; label: string }[] = [
  { value: "all", label: "All Bay Area" },
  { value: "marin", label: "Marin & Point Reyes" },
  { value: "east-bay", label: "East Bay" },
  { value: "peninsula", label: "Peninsula" },
  { value: "santa-cruz", label: "Santa Cruz Mtns" },
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

export function ForagingCalendarClient({ defaultMonth }: ForagingCalendarClientProps) {
  const [month, setMonth] = useState<number>(defaultMonth);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [region, setRegion] = useState<RegionFilter>("all");

  const filtered = useMemo(() => {
    const items = FORAGE_ITEMS.filter((item) => {
      if (category === "invasives") {
        if (!item.isInvasive) return false;
      } else if (category !== "all") {
        if (item.category !== category) return false;
      }
      if (region !== "all" && !item.regions.includes(region)) return false;
      return true;
    });
    return [...items].sort((a, b) => {
      const aPeak = a.peak.includes(month) ? 0 : a.shoulder?.includes(month) ? 1 : 2;
      const bPeak = b.peak.includes(month) ? 0 : b.shoulder?.includes(month) ? 1 : 2;
      if (aPeak !== bPeak) return aPeak - bPeak;
      return a.name.localeCompare(b.name);
    });
  }, [category, region, month]);

  // Stats for the spotlight stat strip — always reflect the active filters.
  const inSeasonInMonth = filtered.filter(
    (i) => i.peak.includes(month) || i.shoulder?.includes(month),
  ).length;
  const peakInMonth = filtered.filter((i) => i.peak.includes(month));

  const totalCount = FORAGE_ITEMS.length;
  const monthName = MONTH_LABELS[month - 1];
  const longMonth = new Date(2025, month - 1, 1).toLocaleDateString("en-US", { month: "long" });

  return (
    <div className="px-4 pb-12 max-w-2xl mx-auto">
      {/* ─── Editorial spotlight ─── */}
      <section className="mt-6 rounded-2xl bg-white/75 border border-pf-master-gold/30 px-6 py-7 shadow-sm">
        <div className="flex items-center gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
          <p
            className="text-[10px] tracking-[0.25em] uppercase text-pf-master-gold font-medium"
            style={BANK_GOTHIC}
          >
            Now Foraging
          </p>
          <span className="w-1.5 h-1.5 rounded-full bg-pf-master-gold" />
        </div>
        <h3 className="font-display text-3xl sm:text-4xl text-farm-dark leading-tight mt-3">
          <span className="tabular-nums">{inSeasonInMonth}</span> species can be found in {longMonth}
        </h3>
        <p className="text-sm text-farm-muted mt-2 max-w-lg leading-relaxed">
          {peakInMonth.length} at peak right now
          {region !== "all" && ` in ${REGION_META[region as ForageRegion].label}`}
          {category !== "all" && category !== "invasives" && ` · ${CATEGORY_META[category as ForageCategory].label}`}
          {category === "invasives" && ` · Invasives only`}
          {". "}
          Microclimates of The Bay routinely shift these windows by 2–6 weeks —
          treat peak and shoulder ratings as rough guidance, not a schedule.
        </p>

        {/* Month strip — tap to change the spotlight month */}
        <div className="mt-5 grid grid-cols-6 sm:grid-cols-12 gap-1.5">
          {MONTH_LABELS.map((m, i) => {
            const isActive = i + 1 === month;
            return (
              <button
                key={m}
                onClick={() => setMonth(i + 1)}
                className={cn(
                  "text-[11px] py-2 rounded-full border transition-colors min-h-[36px] tabular-nums",
                  isActive
                    ? "bg-pf-master-gold text-white border-pf-master-gold font-semibold"
                    : "bg-white/60 text-farm-dark border-pf-master-gold/30 hover:border-pf-master-gold",
                )}
              >
                {m}
              </button>
            );
          })}
        </div>

        {/* Peak-now chip rail — tap to jump to card */}
        {peakInMonth.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {peakInMonth.map((item) => (
              <button
                key={item.slug}
                onClick={() => scrollToItem(item.slug)}
                className="text-[12px] px-3 py-1.5 rounded-full bg-farm-green/10 text-farm-green border border-farm-green/20 hover:bg-farm-green/20 transition-colors"
              >
                {item.name}
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ─── Region filter ─── */}
      <div className="mt-6">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-farm-muted font-medium mb-2"
          style={BANK_GOTHIC}
        >
          Region
        </p>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-thin">
          {REGION_FILTERS.map(({ value, label }) => {
            const active = region === value;
            return (
              <button
                key={value}
                onClick={() => setRegion(value)}
                className={cn(
                  "flex-shrink-0 text-[12px] px-3.5 py-2 rounded-full border transition-colors min-h-[36px] whitespace-nowrap",
                  active
                    ? "bg-farm-dark text-farm-cream border-farm-dark"
                    : "bg-white/70 text-farm-dark border-pf-master-gold/30 hover:border-pf-master-gold/60",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Category filter ─── */}
      <div className="mt-4">
        <p
          className="text-[10px] tracking-[0.22em] uppercase text-farm-muted font-medium mb-2"
          style={BANK_GOTHIC}
        >
          Category
        </p>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto pb-1 px-1 scrollbar-thin">
          {CATEGORY_FILTERS.map(({ value, label }) => {
            const count =
              value === "all"
                ? totalCount
                : value === "invasives"
                  ? FORAGE_ITEMS.filter((i) => i.isInvasive).length
                  : FORAGE_ITEMS.filter((i) => i.category === value).length;
            const active = category === value;
            return (
              <button
                key={value}
                onClick={() => setCategory(value)}
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
      </div>

      <p className="mt-4 text-[11px] text-farm-muted tracking-wide">
        Showing {filtered.length} of {totalCount} species · sorted by {monthName} availability
      </p>

      {/* ─── Item cards ─── */}
      {filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl bg-white/60 border border-pf-master-gold/20 px-6 py-10 text-center">
          <p className="text-sm text-farm-muted">
            No species match those filters. Try widening the region or clearing the category.
          </p>
        </div>
      ) : (
        <ul className="mt-3 space-y-3">
          {filtered.map((item) => (
            <ForageCard key={item.slug} item={item} month={month} monthName={monthName} />
          ))}
        </ul>
      )}

      {/* Legend */}
      <div className="mt-8 flex items-center justify-center gap-5 text-[11px] text-farm-muted flex-wrap">
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
        Field reference for the SF Bay Area — Marin, East Bay, Peninsula, and
        Santa Cruz Mountains. Always positively identify before consuming — a
        100% match on every diagnostic, not 95%. Foraging is restricted in most
        state and national parks; check land-use rules before harvesting. Take
        a fraction, leave the rest.
      </p>
      <p className="mt-3 text-[10px] text-farm-muted/70 leading-relaxed text-center max-w-md mx-auto px-2">
        Identification photos courtesy of Wikipedia &amp; Wikimedia Commons
        contributors, served under their original Creative Commons licenses.
      </p>
    </div>
  );
}

function ForageCard({
  item,
  month,
  monthName,
}: {
  item: ForageItem;
  month: number;
  monthName: string;
}) {
  const peakNow = item.peak.includes(month);
  const shoulderNow = item.shoulder?.includes(month);
  const category = CATEGORY_META[item.category].label;

  return (
    <li
      id={`forage-${item.slug}`}
      className="rounded-2xl bg-white/85 border border-pf-master-gold/20 overflow-hidden transition-all"
    >
      {/* Identification photo — searched from Wikipedia by scientific + common name */}
      <ForageImage
        cacheKey={wikiTitleFor(item)}
        commonName={item.name}
        scientificName={item.scientificName}
        alt={`${item.name} — ${item.scientificName ?? "identification photo"}`}
        className="w-full aspect-[5/3] rounded-none border-0 border-b border-pf-master-gold/15"
      />

      <div className="px-5 sm:px-6 py-5">
      {/* Eyebrow row */}
      <div className="flex items-center gap-2 flex-wrap">
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
        {!peakNow && shoulderNow && (
          <>
            <span className="text-pf-master-gold/40 text-[10px]">·</span>
            <p
              className="text-[9.5px] tracking-[0.24em] uppercase text-farm-green/70 font-medium"
              style={BANK_GOTHIC}
            >
              {monthName} Shoulder
            </p>
          </>
        )}
        {item.isInvasive && (
          <span
            className="inline-flex items-center gap-1 text-[9.5px] tracking-[0.18em] uppercase text-amber-800 font-semibold bg-amber-100/70 px-1.5 py-0.5 rounded"
            style={BANK_GOTHIC}
            title="Invasive species"
          >
            <Sprout className="w-2.5 h-2.5" />
            Invasive
          </span>
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
        <p className="text-[12px] text-farm-muted italic mt-1">{item.scientificName}</p>
      )}

      {/* Regions */}
      <div className="mt-2 flex flex-wrap gap-1">
        {ALL_REGIONS.map((r) => {
          const present = item.regions.includes(r);
          return (
            <span
              key={r}
              className={cn(
                "text-[9.5px] px-1.5 py-0.5 rounded tracking-wide",
                present
                  ? "bg-farm-green/10 text-farm-green border border-farm-green/20"
                  : "text-farm-muted/40 border border-transparent",
              )}
            >
              {REGION_META[r].label}
            </span>
          );
        })}
      </div>

      {/* Year strip */}
      <div className="mt-5">
        <div className="grid grid-cols-12 gap-1 mb-1.5">
          {MONTH_LABELS.map((m, i) => {
            const isCurrent = i + 1 === month;
            return (
              <div
                key={m}
                className={cn(
                  "text-[9px] text-center tracking-wide tabular-nums uppercase",
                  isCurrent ? "text-pf-master-gold font-semibold" : "text-farm-muted/70",
                )}
              >
                {m}
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-12 gap-1 items-center">
          {Array.from({ length: 12 }).map((_, i) => {
            const m = i + 1;
            const isPeak = item.peak.includes(m);
            const isShoulder = item.shoulder?.includes(m);
            const isCurrent = m === month;
            return (
              <div key={m} className="relative h-3 flex items-center">
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
        <p className="text-[12px] text-farm-dark/70 leading-relaxed">{item.habitat}</p>
      </div>

      {/* Notes */}
      <p className="mt-2.5 text-[13.5px] text-farm-dark/90 leading-relaxed">{item.notes}</p>

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
      </div>
    </li>
  );
}
