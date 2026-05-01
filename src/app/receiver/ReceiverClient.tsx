"use client";

import { useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getItemImageUrl } from "@/lib/flower-images";

type Status = "ready" | "short" | "pending" | "extra";

interface Line {
  /** Composite map key: itemId__unit__size__color. Differentiates rows when a chef
   *  orders multiple sizes/colors of the same item. */
  lineKey: string;
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  /** Size descriptor (e.g. "Quarter", "Palm"). null when item has no sizes. */
  sizeLabel: string | null;
  /** Comma-separated colors selected ("red,blue"). null when none. */
  colorKey: string | null;
  imageUrl: string | null;
  isEvent: boolean;
  ordered: number;
  delivered: number;
  status: Status;
  shortageReason: string | null;
}

interface RestaurantBlock {
  id: string;
  name: string;
  freeformNotes: string | null;
  lines: Line[];
  hasDelivery: boolean;
}

interface DateOption {
  date: string;
  day: string;
  isToday: boolean;
  isPast: boolean;
}

interface Props {
  selectedDate: string;
  dates: DateOption[];
  restaurants: { id: string; name: string }[];
  orders: any[];
  deliveries: any[];
}

const STATUS_META: Record<Status, { label: string; pill: string; icon: string; sortOrder: number }> = {
  short:   { label: "Short",   pill: "bg-pf-master-orange/[0.12] text-pf-master-orange",   icon: "⚠", sortOrder: 0 },
  pending: { label: "Pending", pill: "bg-amber-50 text-amber-700",                          icon: "•", sortOrder: 1 },
  extra:   { label: "Extra",   pill: "bg-blue-50 text-blue-700",                            icon: "+", sortOrder: 2 },
  ready:   { label: "Ready",   pill: "bg-farm-green-light text-farm-green",                 icon: "✓", sortOrder: 3 },
};

export function ReceiverClient({ selectedDate, dates, restaurants, orders, deliveries }: Props) {
  const router = useRouter();
  const search = useSearchParams();

  function jumpToDate(date: string) {
    const params = new URLSearchParams(search.toString());
    params.set("date", date);
    router.push(`/receiver?${params.toString()}`);
  }

  // Compute per-restaurant lines by joining orders + deliveries for the date.
  const blocks = useMemo<RestaurantBlock[]>(() => {
    const out: RestaurantBlock[] = [];

    for (const r of restaurants) {
      const order = orders.find((o: any) => o.restaurant_id === r.id);
      const delivery = deliveries.find((d: any) => d.restaurant_id === r.id);
      const lines = new Map<string, Line>();

      // Composite key — keep multiple sizes/colors of the same item visible
      // as separate rows.
      const buildKey = (
        itemId: string,
        unit: string,
        size: string | null,
        color: string | null,
      ) => `${itemId}__${unit}__${size ?? ""}__${color ?? ""}`;

      // Pass 1 — record every ordered item
      for (const oi of order?.order_items ?? []) {
        const item = oi.availability_items?.items;
        if (!item) continue;
        // Prefer the chef's chosen unit; fall back to the item's first
        // declared unit for legacy rows where unit_type is null.
        const unit =
          (oi.unit_type ?? "").toString().toUpperCase() ||
          (String(item.unit_type ?? "").split(",")[0]?.trim().toUpperCase() ?? "");
        const sizeLabel: string | null = oi.size_label ?? null;
        const colorKey: string | null = oi.color_key ?? null;
        const key = buildKey(item.id, unit, sizeLabel, colorKey);
        const ordered = Number(oi.quantity_requested ?? 0);
        const isShortedFlag = Boolean(oi.is_shorted);
        const fulfilled = oi.quantity_fulfilled != null ? Number(oi.quantity_fulfilled) : null;
        lines.set(key, {
          lineKey: key,
          itemId: item.id,
          itemName: item.name,
          category: item.category,
          unit,
          sizeLabel,
          colorKey,
          imageUrl: getItemImageUrl({ name: item.name, image_url: item.image_url }),
          isEvent: Boolean(item.is_event_item),
          ordered,
          delivered: fulfilled ?? 0,
          status: isShortedFlag ? "short" : "pending",
          shortageReason: oi.shortage_reason ?? null,
        });
      }

      // Pass 2 — overlay delivery_items. Deliveries don't carry size/color
      // today, so fall back to "any line for this item under the same unit"
      // when there isn't a (item, unit, null, null) bucket.
      for (const di of delivery?.delivery_items ?? []) {
        const item = di.items;
        if (!item) continue;
        const unit = String(di.unit ?? item.unit_type ?? "").split(",")[0]?.trim().toUpperCase() ?? "";
        const delivered = Number(di.quantity ?? 0);
        const exactKey = buildKey(item.id, unit, null, null);
        let existing = lines.get(exactKey);
        if (!existing) {
          for (const line of lines.values()) {
            if (line.itemId === item.id && line.unit === unit && line.status === "pending") {
              existing = line;
              break;
            }
          }
        }

        if (!existing) {
          // Delivered but never ordered → extra
          lines.set(exactKey, {
            lineKey: exactKey,
            itemId: item.id,
            itemName: item.name,
            category: item.category,
            unit,
            sizeLabel: null,
            colorKey: null,
            imageUrl: getItemImageUrl({ name: item.name, image_url: item.image_url }),
            isEvent: Boolean(item.is_event_item),
            ordered: 0,
            delivered,
            status: "extra",
            shortageReason: null,
          });
        } else {
          // Sum if multiple delivery lines for the same item
          existing.delivered += delivered;
          if (existing.delivered >= existing.ordered) {
            existing.status = "ready";
            existing.shortageReason = null;
          } else if (existing.delivered > 0) {
            existing.status = "short";
          }
        }
      }

      const allLines = Array.from(lines.values()).sort((a, b) => {
        if (STATUS_META[a.status].sortOrder !== STATUS_META[b.status].sortOrder) {
          return STATUS_META[a.status].sortOrder - STATUS_META[b.status].sortOrder;
        }
        // Event items grouped at the bottom of each status
        if (a.isEvent !== b.isEvent) return a.isEvent ? 1 : -1;
        return a.itemName.localeCompare(b.itemName);
      });

      out.push({
        id: r.id,
        name: r.name,
        freeformNotes: order?.freeform_notes ?? null,
        lines: allLines,
        hasDelivery: Boolean(delivery),
      });
    }

    return out;
  }, [restaurants, orders, deliveries]);

  // Aggregate counts for the summary strip
  const counts = useMemo(() => {
    const totals = { ready: 0, short: 0, pending: 0, extra: 0 };
    for (const b of blocks) for (const line of b.lines) totals[line.status]++;
    return totals;
  }, [blocks]);

  const totalLines = counts.ready + counts.short + counts.pending + counts.extra;
  const isEmpty = totalLines === 0;

  return (
    <div className="space-y-6">
      {/* Date picker strip */}
      <div className="bg-white rounded-2xl border border-farm-dark/5 p-2 shadow-sm overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {dates.map((d) => {
            const active = d.date === selectedDate;
            const dayLabel = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
            const dateLabel = new Date(d.date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => jumpToDate(d.date)}
                className={`px-3 py-2 rounded-xl min-h-[44px] flex flex-col items-center gap-0.5 transition-colors min-w-[72px] ${
                  active
                    ? "bg-farm-green text-white"
                    : d.isToday
                      ? "bg-farm-cream/40 text-farm-dark border border-farm-green/30"
                      : d.isPast
                        ? "text-farm-muted hover:bg-farm-cream/40"
                        : "text-farm-dark hover:bg-farm-cream/40"
                }`}
              >
                <span className={`text-[10px] tracking-wider uppercase ${active ? "text-white/80" : "text-farm-muted"}`}>
                  {d.isToday ? "Today" : dayLabel}
                </span>
                <span className="text-sm font-semibold">{dateLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary strip */}
      {!isEmpty && (
        <div className="grid grid-cols-4 gap-2">
          <SummaryStat label="Ready" value={counts.ready} active={counts.ready > 0} status="ready" />
          <SummaryStat label="Short" value={counts.short} active={counts.short > 0} status="short" />
          <SummaryStat label="Pending" value={counts.pending} active={counts.pending > 0} status="pending" />
          <SummaryStat label="Extra" value={counts.extra} active={counts.extra > 0} status="extra" />
        </div>
      )}

      {/* Per-restaurant blocks */}
      {isEmpty ? (
        <div className="bg-white rounded-2xl border border-farm-dark/5 p-8 text-center shadow-sm">
          <img src="/assets/pressfarm/flowers/chamomile.png" alt="" aria-hidden="true" className="mx-auto h-20 w-auto mb-3 opacity-90" />
          <p className="font-display text-lg text-farm-dark">Nothing scheduled</p>
          <p className="text-sm text-farm-muted mt-1">No orders or deliveries on the books for this date.</p>
        </div>
      ) : (
        blocks.map((block) => (
          <RestaurantSection key={block.id} block={block} />
        ))
      )}
    </div>
  );
}

function SummaryStat({
  label, value, active, status,
}: { label: string; value: number; active: boolean; status: Status }) {
  return (
    <div className={`bg-white border border-farm-dark/5 rounded-2xl p-3 text-center shadow-sm ${active ? "" : "opacity-50"}`}>
      <p className={`font-display text-2xl ${active ? activeColor(status) : "text-farm-muted"}`}>{value}</p>
      <p className="text-[10px] tracking-wider uppercase text-farm-muted mt-0.5">{label}</p>
    </div>
  );
}

function activeColor(status: Status): string {
  switch (status) {
    case "ready":   return "text-farm-green";
    case "short":   return "text-pf-master-orange";
    case "pending": return "text-amber-700";
    case "extra":   return "text-blue-700";
  }
}

function RestaurantSection({ block }: { block: RestaurantBlock }) {
  if (block.lines.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm">
        <div className="px-5 py-4 border-b border-farm-dark/5">
          <p className="font-display text-lg text-farm-dark">{block.name}</p>
        </div>
        <p className="px-5 py-6 text-sm text-farm-muted text-center">Nothing on the order for this restaurant.</p>
      </div>
    );
  }

  // Split into regular vs events for visual separation
  const regularLines = block.lines.filter((l) => !l.isEvent);
  const eventLines = block.lines.filter((l) => l.isEvent);

  return (
    <div className="bg-white rounded-2xl border border-farm-dark/5 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-farm-dark/5 bg-gradient-to-br from-farm-green/5 to-farm-cream/30">
        <div className="flex items-baseline justify-between">
          <p className="font-display text-lg text-farm-dark">{block.name}</p>
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">
            {block.lines.length} item{block.lines.length === 1 ? "" : "s"}
            {block.hasDelivery ? "" : " · awaiting delivery"}
          </p>
        </div>
        {block.freeformNotes && (
          <p className="text-xs text-farm-muted italic mt-2 leading-relaxed">
            <span className="font-semibold not-italic">Chef note:</span> &ldquo;{block.freeformNotes}&rdquo;
          </p>
        )}
      </div>

      {regularLines.length > 0 && (
        <ul className="divide-y divide-farm-dark/5">
          {regularLines.map((line) => <LineRow key={line.lineKey} line={line} />)}
        </ul>
      )}

      {eventLines.length > 0 && (
        <>
          <div className="px-5 py-2 bg-pf-master-violet/[0.06] border-y border-pf-master-violet/15">
            <p className="text-[10px] tracking-[0.22em] uppercase text-pf-master-violet font-semibold">
              For Events
            </p>
          </div>
          <ul className="divide-y divide-farm-dark/5">
            {eventLines.map((line) => <LineRow key={line.lineKey} line={line} />)}
          </ul>
        </>
      )}
    </div>
  );
}

function LineRow({ line }: { line: Line }) {
  const meta = STATUS_META[line.status];
  return (
    <li className="px-5 py-3 flex items-center gap-3">
      {line.imageUrl ? (
        <div className="w-12 h-12 rounded-lg bg-farm-cream/60 flex items-center justify-center flex-shrink-0 overflow-hidden">
          <img src={line.imageUrl} alt="" aria-hidden="true" className="w-10 h-10 object-contain" />
        </div>
      ) : (
        <div className="w-12 h-12 rounded-lg bg-farm-cream/60 flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-farm-dark truncate">
            {line.itemName}
            {(line.sizeLabel || line.colorKey) && (
              <span className="ml-1.5 text-xs font-normal text-farm-muted">
                {[
                  line.sizeLabel,
                  line.colorKey ? line.colorKey.split(",").join(" / ") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </p>
          <span className={`text-[10px] tracking-wider uppercase px-1.5 py-0.5 rounded font-semibold flex-shrink-0 ${meta.pill}`}>
            <span aria-hidden="true">{meta.icon}</span> {meta.label}
          </span>
        </div>
        <p className="text-xs text-farm-muted mt-0.5">
          {line.status === "extra" ? (
            <>Delivered <strong className="text-farm-dark">{line.delivered}</strong> {line.unit} · not on order</>
          ) : line.status === "ready" ? (
            <>Delivered <strong className="text-farm-dark">{line.delivered}</strong> / ordered {line.ordered} {line.unit}</>
          ) : line.status === "short" ? (
            <>Delivered <strong className="text-pf-master-orange">{line.delivered}</strong> of {line.ordered} {line.unit} ordered</>
          ) : (
            <>Ordered <strong className="text-farm-dark">{line.ordered}</strong> {line.unit} · awaiting delivery</>
          )}
        </p>
        {line.shortageReason && (
          <p className="text-xs text-pf-master-orange mt-0.5 italic">Reason: {line.shortageReason}</p>
        )}
      </div>
    </li>
  );
}
