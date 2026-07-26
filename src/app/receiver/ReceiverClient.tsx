"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getItemImageUrl } from "@/lib/flower-images";
import { laneStyle } from "@/lib/lanes";
import { isEventOnlyItem } from "@/lib/order-availability";
import { cn, formatDateTimePacific } from "@/lib/utils";

type Status = "ready" | "short" | "pending" | "extra";
/** Which DB table backs a line — drives the check-line API call. */
type LineKind = "order_item" | "delivery_item";

interface Line {
  /** Composite map key: itemId__unit__size__color__variety. Differentiates rows
   *  when a chef orders multiple sizes/colors/varieties of the same item. */
  lineKey: string;
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  /** Size descriptor (e.g. "Quarter", "Palm"). null when item has no sizes. */
  sizeLabel: string | null;
  /** Comma-separated colors selected ("red,blue"). null when none. */
  colorKey: string | null;
  /** Comma-separated varieties selected ("Genovese,Thai"). null when none. */
  varietyKey: string | null;
  imageUrl: string | null;
  isEvent: boolean;
  ordered: number;
  delivered: number;
  status: Status;
  shortageReason: string | null;
  /** Underlying DB row's primary id — the API target for the receiver check. */
  dbId: string;
  /** Which table dbId points at. */
  kind: LineKind;
  /** ISO timestamp when receiver checked this line, or null. */
  receivedAt: string | null;
}

interface RestaurantBlock {
  id: string;
  name: string;
  freeformNotes: string | null;
  lines: Line[];
  hasDelivery: boolean;
  /** delivery_id for the close-out call. null when there's no delivery row yet. */
  deliveryId: string | null;
  /** ISO timestamp when receiver closed out this delivery, null while still open. */
  closedAt: string | null;
  /** Free-text "marked by" name from the close-out signoff. */
  closedByName: string | null;
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

      // Composite key — keep multiple sizes/colors/varieties of the same item
      // visible as separate rows.
      const buildKey = (
        itemId: string,
        unit: string,
        size: string | null,
        color: string | null,
        variety: string | null,
      ) => `${itemId}__${unit}__${size ?? ""}__${color ?? ""}__${variety ?? ""}`;

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
        const varietyKey: string | null = oi.variety_key ?? null;
        const key = buildKey(item.id, unit, sizeLabel, colorKey, varietyKey);
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
          varietyKey,
          imageUrl: getItemImageUrl({ name: item.name, image_url: item.image_url }),
          isEvent: isEventOnlyItem(item),
          ordered,
          delivered: fulfilled ?? 0,
          status: isShortedFlag ? "short" : "pending",
          shortageReason: oi.shortage_reason ?? null,
          dbId: oi.id,
          kind: "order_item",
          receivedAt: oi.received_at ?? null,
        });
      }

      // Pass 2 — overlay deliveries. Deliveries now carry size_label
      // (migration 050), so a delivery line is credited straight to the
      // matching (item, unit, size) order line. Legacy / size-less rows have
      // no size and get pooled across the item+unit's ordered sizes, then
      // distributed below — historical data keeps reconciling.
      const deliveredPool = new Map<string, number>(); // `${itemId}__${unit}` -> unmatched qty
      const norm = (s: string | null | undefined) => (s ?? "").toString().trim().toLowerCase();

      for (const di of delivery?.delivery_items ?? []) {
        const item = di.items;
        if (!item) continue;
        const unit = String(di.unit ?? item.unit_type ?? "").split(",")[0]?.trim().toUpperCase() ?? "";
        const delivered = Number(di.quantity ?? 0);
        const size = norm(di.size_label);
        const groupKey = `${item.id}__${unit}`;

        const groupLines = Array.from(lines.values()).filter(
          (l) => l.kind === "order_item" && l.itemId === item.id && l.unit === unit,
        );

        if (groupLines.length === 0) {
          // Delivered but never ordered → extra. Sum repeated lines for the
          // same item+unit; there's no order_item to attach the check to.
          const extraKey = buildKey(item.id, unit, null, null, null);
          const extra = lines.get(extraKey);
          if (extra && extra.kind === "delivery_item") {
            extra.delivered += delivered;
          } else {
            lines.set(extraKey, {
              lineKey: extraKey,
              itemId: item.id,
              itemName: item.name,
              category: item.category,
              unit,
              sizeLabel: di.size_label ?? null,
              colorKey: null,
              varietyKey: null,
              imageUrl: getItemImageUrl({ name: item.name, image_url: item.image_url }),
              isEvent: isEventOnlyItem(item),
              ordered: 0,
              delivered,
              status: "extra",
              shortageReason: null,
              dbId: di.id,
              kind: "delivery_item",
              receivedAt: di.received_at ?? null,
            });
          }
          continue;
        }

        // Credit an exact size match when the farm logged one; otherwise pool
        // the quantity across the item+unit group.
        const exact = size ? groupLines.find((l) => norm(l.sizeLabel) === size) : undefined;
        if (exact) {
          exact.delivered += delivered;
        } else {
          deliveredPool.set(groupKey, (deliveredPool.get(groupKey) ?? 0) + delivered);
        }
      }

      // Distribute each size-less pool across its group's unmet need, biggest
      // shortfall first; the last line absorbs any surplus so over-delivery
      // still reads ready.
      for (const [groupKey, pooled] of deliveredPool) {
        const splitAt = groupKey.lastIndexOf("__");
        const itemId = groupKey.slice(0, splitAt);
        const unit = groupKey.slice(splitAt + 2);
        const group = Array.from(lines.values())
          .filter((l) => l.kind === "order_item" && l.itemId === itemId && l.unit === unit)
          .sort((a, b) => (b.ordered - b.delivered) - (a.ordered - a.delivered));

        let remaining = pooled;
        group.forEach((line, idx) => {
          const need = Math.max(0, line.ordered - line.delivered);
          const give = idx === group.length - 1 ? remaining : Math.min(remaining, need);
          line.delivered += give;
          remaining -= give;
        });
      }

      // Final status. "Pending" means the farm hasn't logged this
      // restaurant's delivery yet; once a delivery row exists an ordered line
      // is ready (covered) or short (partial / didn't arrive). An admin-flagged
      // shortage from pass 1 stays short even with no delivery row.
      const hasDeliveryRow = Boolean(delivery);
      for (const line of lines.values()) {
        if (line.kind !== "order_item") continue;
        if (line.ordered > 0 && line.delivered >= line.ordered) {
          line.status = "ready";
          line.shortageReason = null;
        } else if (line.delivered > 0 || hasDeliveryRow) {
          line.status = "short";
        } else if (line.status !== "short") {
          line.status = "pending";
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
        deliveryId: delivery?.id ?? null,
        closedAt: delivery?.closed_at ?? null,
        closedByName: delivery?.closed_by_name ?? null,
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
  const router = useRouter();
  const isClosed = Boolean(block.closedAt);
  const [markedBy, setMarkedBy] = useState(block.closedByName ?? "");
  const [closing, setClosing] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const checkedCount = block.lines.filter((l) => l.receivedAt).length;
  const totalCount = block.lines.length;

  async function closeOut() {
    if (!block.deliveryId) {
      setCloseError("No delivery row exists yet — can't close out until pickup is logged.");
      return;
    }
    if (!markedBy.trim()) {
      setCloseError("Type your name first.");
      return;
    }
    setClosing(true);
    setCloseError(null);
    try {
      const res = await fetch("/api/receiver/close-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_id: block.deliveryId,
          closed_by_name: markedBy.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setCloseError(json.error ?? "Close failed");
        return;
      }
      router.refresh();
    } catch (err: any) {
      setCloseError(err?.message ?? "Network error");
    } finally {
      setClosing(false);
    }
  }

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
    <div className={cn("bg-white rounded-2xl border border-farm-dark/5 border-l-2 shadow-sm overflow-hidden", laneStyle(block.name).border)}>
      <div className="px-5 py-4 border-b border-farm-dark/5 bg-gradient-to-br from-farm-green/5 to-farm-cream/30">
        <div className="flex items-baseline justify-between">
          <span className="flex items-center gap-2 min-w-0">
            <span className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", laneStyle(block.name).dot)} aria-hidden="true" />
            <p className={cn("text-lg text-farm-dark truncate", laneStyle(block.name).nameClass)}>{block.name}</p>
          </span>
          <p className="text-[10px] tracking-[0.18em] uppercase text-farm-muted">
            {checkedCount}/{totalCount} verified
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
          {regularLines.map((line) => (
            <LineRow key={line.lineKey} line={line} disabled={isClosed} />
          ))}
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
            {eventLines.map((line) => (
              <LineRow key={line.lineKey} line={line} disabled={isClosed} />
            ))}
          </ul>
        </>
      )}

      {/* Close-out footer — captures who's signing for the delivery so a
          shared restaurant account still has personal attribution on the
          row. Once closed, the form locks and the signoff is shown
          read-only (re-opening would need a separate admin action). */}
      <div className="px-5 py-4 bg-farm-cream/40 border-t border-farm-dark/5">
        {isClosed ? (
          <div className="text-sm text-farm-green flex items-center gap-2">
            <span aria-hidden="true">✓</span>
            <span>
              <span className="font-semibold">Closed out</span> by {block.closedByName ?? "—"} ·{" "}
              {block.closedAt
                ? formatDateTimePacific(block.closedAt)
                : ""}
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
              <div className="flex-1">
                <label className="form-label text-[10px] tracking-wider uppercase text-farm-muted">
                  Marked by
                </label>
                <input
                  type="text"
                  value={markedBy}
                  onChange={(e) => setMarkedBy(e.target.value)}
                  placeholder="Your name"
                  maxLength={100}
                  className="w-full border border-farm-dark/10 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green"
                />
              </div>
              <button
                type="button"
                onClick={closeOut}
                disabled={closing || !block.deliveryId}
                className="px-4 min-h-[44px] rounded-lg bg-farm-green text-white text-sm font-semibold hover:bg-farm-green-dark disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
              >
                {closing ? "Closing…" : "Close out"}
              </button>
            </div>
            {!block.deliveryId && (
              <p className="text-[11px] text-farm-muted">
                Awaiting delivery — close-out will unlock once the farm logs the drop-off.
              </p>
            )}
            {closeError && (
              <p className="text-xs text-red-700">{closeError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function LineRow({ line, disabled = false }: { line: Line; disabled?: boolean }) {
  const meta = STATUS_META[line.status];
  const router = useRouter();
  const [checkedLocal, setCheckedLocal] = useState<boolean>(Boolean(line.receivedAt));
  const [toggling, setToggling] = useState(false);

  async function toggleCheck() {
    if (disabled || toggling) return;
    const next = !checkedLocal;
    setCheckedLocal(next);
    setToggling(true);
    try {
      const res = await fetch("/api/receiver/check-line", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: line.kind, id: line.dbId, received: next }),
      });
      if (!res.ok) throw new Error("Failed");
      router.refresh();
    } catch {
      setCheckedLocal(!next);
    } finally {
      setToggling(false);
    }
  }

  return (
    <li className={`px-5 py-3 flex items-center gap-3 ${checkedLocal ? "bg-farm-green/[0.04]" : ""} transition-colors`}>
      {/* Pick checkmark — receiver verification. Disabled once the
          delivery is closed out so the audit trail is locked. */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checkedLocal}
        aria-label={checkedLocal ? "Mark as not received" : "Mark as received"}
        onClick={toggleCheck}
        disabled={disabled}
        className={`flex-shrink-0 w-7 h-7 rounded-md border-2 flex items-center justify-center transition-colors ${
          checkedLocal
            ? "bg-farm-green border-farm-green"
            : disabled
              ? "bg-farm-cream/40 border-farm-dark/15 cursor-not-allowed"
              : "bg-white border-farm-dark/25 hover:border-farm-green cursor-pointer"
        } ${toggling ? "opacity-60" : ""}`}
      >
        {checkedLocal && (
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
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
            {(line.sizeLabel || line.colorKey || line.varietyKey) && (
              <span className="ml-1.5 text-xs font-normal text-farm-muted">
                {[
                  line.sizeLabel,
                  line.varietyKey ? line.varietyKey.split(",").join(" / ") : null,
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
