"use client";

import { useState } from "react";
import type { AvailabilityItemWithItem } from "@/types";
import { UNIT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getItemImageUrl, PLACEHOLDER_WREATH } from "@/lib/flower-images";

interface ItemRowProps {
  availabilityItem: AvailabilityItemWithItem;
  quantities: Record<string, number>; // keyed by availId or availId__size
  itemNote: string;
  selectedColors: string[];
  onQuantityChange: (key: string, qty: number) => void;
  onNoteChange: (id: string, note: string) => void;
  onColorChange: (id: string, colors: string[]) => void;
}

function QuantityStepper({ value, onChange, disabled, maxQty, label }: {
  value: number; onChange: (v: number) => void; disabled: boolean; maxQty: number; label: string;
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={disabled || value <= 0}
        className="w-11 h-11 rounded-full bg-farm-cream/60 text-farm-muted/90 flex items-center justify-center text-xl font-light disabled:opacity-30 active:bg-gray-200 transition-colors"
        aria-label={`Decrease ${label}`}>&minus;</button>
      <input
        type="number"
        min="0"
        max={maxQty}
        value={value || ""}
        onChange={(e) => {
          const v = parseInt(e.target.value) || 0;
          onChange(Math.max(0, Math.min(v, maxQty)));
        }}
        disabled={disabled}
        className="w-14 h-11 text-center text-sm font-semibold text-farm-dark border border-farm-dark/10 rounded-lg focus:outline-none focus:ring-1 focus:ring-farm-green"
        placeholder="0"
        aria-label={`Quantity for ${label}`}
      />
      <button type="button" onClick={() => onChange(Math.min(maxQty, value + 1))} disabled={disabled || value >= maxQty}
        className="w-11 h-11 rounded-full bg-farm-cream/60 text-farm-muted/90 flex items-center justify-center text-xl font-light disabled:opacity-30 active:bg-gray-200 transition-colors"
        aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}

export function ItemRow({
  availabilityItem,
  quantities,
  itemNote,
  selectedColors,
  onQuantityChange,
  onNoteChange,
  onColorChange,
}: ItemRowProps) {
  const { item, status, limited_qty, cycle_notes } = availabilityItem;
  const isUnavailable = status === "unavailable";
  const isLimited = status === "limited";
  const maxQty = isLimited ? (limited_qty ?? Infinity) : Infinity;

  const sizes = (item as any).size ? (item as any).size.split(", ").filter(Boolean) : [];
  const colors = (item as any).color ? (item as any).color.split(", ").filter(Boolean) : [];
  const hasSizes = sizes.length > 0;

  // For items with sizes: qty keyed by "id__size", for items without: keyed by "id"
  const totalQty = hasSizes
    ? sizes.reduce((sum: number, s: string) => sum + (quantities[`${availabilityItem.id}__${s}`] ?? 0), 0)
    : (quantities[availabilityItem.id] ?? 0);

  // Auto-expand sizes when something is ordered
  const [sizesExpanded, setSizesExpanded] = useState(false);
  const showSizes = sizesExpanded || totalQty > 0;

  const showDetails = totalQty > 0 || itemNote.length > 0;

  return (
    <div className={cn("py-3 border-b border-farm-dark/5 last:border-0", isUnavailable && "opacity-50")}>
      {/* Main row: photo + name + badges + stepper (only for items WITHOUT sizes) */}
      <div className="flex items-center gap-3">
        {/* Photo — admin-set photo, auto-matched brand flower, or wreath placeholder */}
        {(() => {
          const imgUrl = getItemImageUrl({ name: item.name, image_url: (item as any).image_url });
          const isFlower = imgUrl?.startsWith("/assets/pressfarm/flowers/");
          if (imgUrl) {
            return (
              <div className={cn(
                "w-24 h-24 rounded-lg overflow-hidden flex-shrink-0",
                isFlower ? "bg-farm-cream border border-farm-dark/5 flex items-center justify-center" : "bg-farm-cream/60"
              )}>
                <img
                  src={imgUrl}
                  alt={item.name}
                  className={cn("w-full h-full", isFlower ? "object-contain p-1.5" : "object-cover")}
                  loading="lazy"
                />
              </div>
            );
          }
          return (
            <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 bg-farm-cream/60 border border-farm-dark/5 flex items-center justify-center">
              <img
                src={PLACEHOLDER_WREATH}
                alt=""
                aria-hidden="true"
                className="w-14 h-14 object-contain opacity-25"
              />
            </div>
          );
        })()}

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-farm-dark">{item.name}</span>
            <span className="text-xs text-farm-muted flex-shrink-0">{UNIT_LABELS[item.unit_type]} container</span>
            {(availabilityItem as any)._isEventsItem && <span className="text-[10px] bg-pf-master-gold/15 text-pf-master-gold px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Events</span>}
            {isLimited && <span className="badge-gold flex-shrink-0">LIMITED</span>}
            {(item as any).season_status === "ending_soon" && <span className="badge-orange flex-shrink-0">ENDING SOON</span>}
            {(item as any).season_status === "coming_soon" && <span className="badge-blue flex-shrink-0">COMING SOON</span>}
            {totalQty > 0 && hasSizes && (
              <span className="text-xs font-semibold text-farm-green flex-shrink-0">({totalQty} total)</span>
            )}
          </div>
          {cycle_notes && <p className="text-xs text-farm-muted italic mt-0.5 truncate">{cycle_notes}</p>}
          {!cycle_notes && item.chef_notes && <p className="text-xs text-farm-muted italic mt-0.5 truncate">{item.chef_notes}</p>}
          {(item as any).season_note && <p className="text-xs text-pf-master-orange mt-0.5 truncate">{(item as any).season_note}</p>}

          {/* Color selector — multi-select. Tap each color to toggle inclusion. */}
          {colors.length > 0 && totalQty > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              <span className="text-[10px] text-farm-muted mr-0.5">
                Colors{selectedColors.length > 0 ? ` (${selectedColors.length})` : ""}:
              </span>
              {colors.map((c: string) => {
                const isSelected = selectedColors.includes(c);
                return (
                  <button key={c} type="button"
                    onClick={() => {
                      const next = isSelected
                        ? selectedColors.filter((x) => x !== c)
                        : [...selectedColors, c];
                      onColorChange(availabilityItem.id, next);
                    }}
                    aria-pressed={isSelected}
                    className={`text-xs px-3 py-1.5 min-h-[32px] rounded-full transition-colors ${
                      isSelected
                        ? "bg-purple-600 text-white"
                        : "bg-purple-50 text-purple-600 hover:bg-purple-100"
                    }`}
                  >{c}</button>
                );
              })}
            </div>
          )}
          {colors.length > 0 && totalQty === 0 && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {colors.map((c: string) => (
                <span key={c} className="text-[10px] bg-pf-master-violet/5 text-pf-master-violet/70 px-1.5 py-0.5 rounded">{c}</span>
              ))}
            </div>
          )}
        </div>

        {/* Single stepper for items WITHOUT sizes */}
        {!hasSizes && (
          <QuantityStepper
            value={quantities[availabilityItem.id] ?? 0}
            onChange={(v) => onQuantityChange(availabilityItem.id, v)}
            disabled={isUnavailable}
            maxQty={maxQty}
            label={item.name}
          />
        )}

        {/* Expand button for items WITH sizes (when collapsed) */}
        {hasSizes && !showSizes && !isUnavailable && (
          <button
            type="button"
            onClick={() => setSizesExpanded(true)}
            className="flex-shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-full bg-farm-green-light text-farm-green text-sm font-semibold hover:bg-farm-green hover:text-white transition-colors"
            aria-label={`Pick sizes for ${item.name}`}
          >
            {sizes.length} sizes
          </button>
        )}
      </div>

      {/* Size preview when collapsed (no quantity yet) */}
      {hasSizes && !showSizes && (
        <div className="flex items-center gap-1 mt-1.5 ml-0 flex-wrap">
          {sizes.map((s: string) => (
            <span key={s} className="text-[10px] bg-farm-cream/40 text-farm-muted px-2 py-1 rounded-md">{s}</span>
          ))}
        </div>
      )}

      {/* Per-size quantity steppers — when expanded or items ordered */}
      {hasSizes && showSizes && (
        <div className="mt-2 ml-0 space-y-1.5">
          {sizes.map((size: string) => {
            const key = `${availabilityItem.id}__${size}`;
            const sizeQty = quantities[key] ?? 0;
            return (
              <div key={size} className="flex items-center justify-between bg-farm-cream/40 rounded-lg px-3 py-2">
                <span className={cn("text-sm", sizeQty > 0 ? "text-farm-dark font-medium" : "text-farm-muted/90")}>{size}</span>
                <QuantityStepper
                  value={sizeQty}
                  onChange={(v) => onQuantityChange(key, v)}
                  disabled={isUnavailable}
                  maxQty={maxQty}
                  label={`${item.name} ${size}`}
                />
              </div>
            );
          })}
          {/* Collapse button when nothing ordered */}
          {totalQty === 0 && (
            <button
              type="button"
              onClick={() => setSizesExpanded(false)}
              className="text-xs text-farm-muted hover:text-farm-muted/90 mt-1 min-h-0"
            >
              Hide sizes
            </button>
          )}
        </div>
      )}

      {/* Note field */}
      {showDetails && !isUnavailable && (
        <div className="mt-2">
          <input
            type="text"
            value={itemNote}
            onChange={(e) => onNoteChange(availabilityItem.id, e.target.value)}
            placeholder="Add a note..."
            maxLength={200}
            className="w-full text-sm border border-farm-dark/10 rounded-lg px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent placeholder-gray-300"
          />
        </div>
      )}
    </div>
  );
}
