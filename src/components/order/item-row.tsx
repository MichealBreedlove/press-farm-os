"use client";

import { useState } from "react";
import type { AvailabilityItemWithItem } from "@/types";
import type { UnitType } from "@/types/database";
import { UNIT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { getItemImageUrl, PLACEHOLDER_WREATH } from "@/lib/flower-images";

/** Resolve which units this availability row exposes to the chef.
 *  Falls back to the item-level unit_type list if the per-cycle override is null. */
function resolveUnits(item: { unit_type: string }, availableUnits: string | null | undefined): UnitType[] {
  const itemUnits = String(item.unit_type ?? "")
    .split(",").map(u => u.trim()).filter(Boolean) as UnitType[];
  if (!availableUnits) return itemUnits;
  const allowed = new Set(availableUnits.split(",").map(u => u.trim()).filter(Boolean));
  return itemUnits.filter(u => allowed.has(u));
}

interface ItemRowProps {
  availabilityItem: AvailabilityItemWithItem;
  quantities: Record<string, number>; // keyed by availId or availId__size
  itemNote: string;
  /** Multi-select colors keyed by availId (no-sizes) or availId__size (per-size). */
  itemColors: Record<string, string[]>;
  onQuantityChange: (key: string, qty: number) => void;
  onNoteChange: (id: string, note: string) => void;
  onColorChange: (key: string, colors: string[]) => void;
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

/** Inline multi-select color picker. Used for whole-item colors (no sizes)
 *  and per-size colors (with sizes). */
function ColorPicker({
  colors,
  selected,
  onToggle,
  label = "Colors",
}: {
  colors: string[];
  selected: string[];
  onToggle: (next: string[]) => void;
  label?: string;
}) {
  return (
    <div className="flex items-center gap-1 flex-wrap">
      <span className="text-[10px] text-farm-muted mr-0.5">
        {label}{selected.length > 0 ? ` (${selected.length})` : ""}:
      </span>
      {colors.map((c: string) => {
        const isSelected = selected.includes(c);
        return (
          <button key={c} type="button"
            onClick={() => {
              const next = isSelected
                ? selected.filter((x) => x !== c)
                : [...selected, c];
              onToggle(next);
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
  );
}

export function ItemRow({
  availabilityItem,
  quantities,
  itemNote,
  itemColors,
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
  const units = resolveUnits(item, (availabilityItem as any).available_units);
  const hasSizes = sizes.length > 0;
  const hasMultiUnits = units.length > 1;

  /**
   * Quantity-key strategy:
   *  - multi-unit + sizes:   `${availId}__unit:${unit}__${size}`
   *  - multi-unit, no sizes: `${availId}__unit:${unit}`
   *  - single unit, sizes:   `${availId}__${size}`              (legacy)
   *  - single unit, no sizes: `${availId}`                       (legacy)
   */
  function qtyKey(unit?: string, size?: string): string {
    let k = availabilityItem.id;
    if (unit && hasMultiUnits) k += `__unit:${unit}`;
    if (size) k += `__${size}`;
    return k;
  }

  const totalQty = (() => {
    if (hasMultiUnits && hasSizes) {
      return units.reduce((sum, u) => sum + sizes.reduce((s2: number, sz: string) => s2 + (quantities[qtyKey(u, sz)] ?? 0), 0), 0);
    }
    if (hasMultiUnits) {
      return units.reduce((sum, u) => sum + (quantities[qtyKey(u)] ?? 0), 0);
    }
    if (hasSizes) {
      return sizes.reduce((sum: number, s: string) => sum + (quantities[`${availabilityItem.id}__${s}`] ?? 0), 0);
    }
    return quantities[availabilityItem.id] ?? 0;
  })();

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
            <span className="text-xs text-farm-muted flex-shrink-0">
              {hasMultiUnits
                ? `${units.length} containers`
                : `${UNIT_LABELS[units[0]] ?? (units[0] ?? "").toUpperCase()} container`}
            </span>
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

          {/* Whole-item color picker — only when item has NO sizes.
              For items WITH sizes, the color picker lives under each size row. */}
          {colors.length > 0 && !hasSizes && totalQty > 0 && (
            <div className="mt-1">
              <ColorPicker
                colors={colors}
                selected={itemColors[availabilityItem.id] ?? []}
                onToggle={(next) => onColorChange(availabilityItem.id, next)}
              />
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

        {/* Single stepper — only when item has exactly one unit AND no sizes */}
        {!hasMultiUnits && !hasSizes && (
          <QuantityStepper
            value={quantities[availabilityItem.id] ?? 0}
            onChange={(v) => onQuantityChange(availabilityItem.id, v)}
            disabled={isUnavailable}
            maxQty={maxQty}
            label={item.name}
          />
        )}

        {/* Expand button when item has sizes/units (collapsed state) */}
        {(hasMultiUnits || hasSizes) && !showSizes && !isUnavailable && (
          <button
            type="button"
            onClick={() => setSizesExpanded(true)}
            className="flex-shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-full bg-farm-green-light text-farm-green text-sm font-semibold hover:bg-farm-green hover:text-white transition-colors"
            aria-label={`Pick options for ${item.name}`}
          >
            {hasMultiUnits && hasSizes
              ? `${units.length}×${sizes.length}`
              : hasMultiUnits
                ? `${units.length} sizes`
                : `${sizes.length} sizes`}
          </button>
        )}
      </div>

      {/* Preview pills when collapsed */}
      {(hasMultiUnits || hasSizes) && !showSizes && (
        <div className="flex items-center gap-1 mt-1.5 ml-0 flex-wrap">
          {hasMultiUnits && units.map(u => (
            <span key={u} className="text-[10px] bg-blue-50 text-blue-700 px-2 py-1 rounded-md">
              {UNIT_LABELS[u] ?? u.toUpperCase()}
            </span>
          ))}
          {!hasMultiUnits && sizes.map((s: string) => (
            <span key={s} className="text-[10px] bg-farm-cream/40 text-farm-muted px-2 py-1 rounded-md">{s}</span>
          ))}
        </div>
      )}

      {/* Per-unit (and optionally per-size within each unit) steppers */}
      {hasMultiUnits && showSizes && (
        <div className="mt-2 ml-0 space-y-1.5">
          {units.map(unit => {
            const unitLabel = UNIT_LABELS[unit] ?? unit.toUpperCase();
            // No sizes → single stepper per unit
            if (!hasSizes) {
              const key = qtyKey(unit);
              const unitQty = quantities[key] ?? 0;
              const unitColors = itemColors[key] ?? [];
              return (
                <div key={unit} className="bg-blue-50/40 border border-blue-100 rounded-lg px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm", unitQty > 0 ? "text-farm-dark font-medium" : "text-farm-muted/90")}>
                      {unitLabel}
                    </span>
                    <QuantityStepper
                      value={unitQty}
                      onChange={(v) => onQuantityChange(key, v)}
                      disabled={isUnavailable}
                      maxQty={maxQty}
                      label={`${item.name} ${unitLabel}`}
                    />
                  </div>
                  {colors.length > 0 && unitQty > 0 && (
                    <ColorPicker colors={colors} selected={unitColors} onToggle={(next) => onColorChange(key, next)} />
                  )}
                </div>
              );
            }
            // Multi-unit + sizes → nested grid (sizes within each unit)
            return (
              <div key={unit} className="bg-blue-50/40 border border-blue-100 rounded-lg px-3 py-2 space-y-1.5">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{unitLabel}</p>
                {sizes.map((size: string) => {
                  const key = qtyKey(unit, size);
                  const sizeQty = quantities[key] ?? 0;
                  const sizeColors = itemColors[key] ?? [];
                  return (
                    <div key={size} className="bg-white/70 rounded-md px-2.5 py-1.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className={cn("text-sm", sizeQty > 0 ? "text-farm-dark font-medium" : "text-farm-muted/90")}>{size}</span>
                        <QuantityStepper
                          value={sizeQty}
                          onChange={(v) => onQuantityChange(key, v)}
                          disabled={isUnavailable}
                          maxQty={maxQty}
                          label={`${item.name} ${unitLabel} ${size}`}
                        />
                      </div>
                      {colors.length > 0 && sizeQty > 0 && (
                        <ColorPicker colors={colors} selected={sizeColors} onToggle={(next) => onColorChange(key, next)} />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {totalQty === 0 && (
            <button type="button" onClick={() => setSizesExpanded(false)} className="text-xs text-farm-muted hover:text-farm-muted/90 mt-1 min-h-0">
              Hide options
            </button>
          )}
        </div>
      )}

      {/* Single-unit + sizes (legacy path) */}
      {!hasMultiUnits && hasSizes && showSizes && (
        <div className="mt-2 ml-0 space-y-1.5">
          {sizes.map((size: string) => {
            const key = `${availabilityItem.id}__${size}`;
            const sizeQty = quantities[key] ?? 0;
            const sizeColors = itemColors[key] ?? [];
            return (
              <div key={size} className="bg-farm-cream/40 rounded-lg px-3 py-2 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={cn("text-sm", sizeQty > 0 ? "text-farm-dark font-medium" : "text-farm-muted/90")}>{size}</span>
                  <QuantityStepper
                    value={sizeQty}
                    onChange={(v) => onQuantityChange(key, v)}
                    disabled={isUnavailable}
                    maxQty={maxQty}
                    label={`${item.name} ${size}`}
                  />
                </div>
                {colors.length > 0 && sizeQty > 0 && (
                  <ColorPicker colors={colors} selected={sizeColors} onToggle={(next) => onColorChange(key, next)} />
                )}
              </div>
            );
          })}
          {totalQty === 0 && (
            <button type="button" onClick={() => setSizesExpanded(false)} className="text-xs text-farm-muted hover:text-farm-muted/90 mt-1 min-h-0">
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
