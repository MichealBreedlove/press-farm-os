"use client";

import { useState } from "react";
import type { AvailabilityItemWithItem } from "@/types";
import { UNIT_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { getItemImageUrl, PLACEHOLDER_WREATH } from "@/lib/flower-images";
import { resolveUnits, resolveSizes, resolveColors, resolveVarieties, isEventOnlyItem } from "@/lib/order-availability";
import { buildOrderKey } from "@/lib/order-keys";

interface ItemRowProps {
  availabilityItem: AvailabilityItemWithItem;
  quantities: Record<string, number>; // keyed by availId or availId__size
  itemNote: string;
  /** Multi-select colors keyed by availId (no-sizes) or availId__size (per-size). */
  itemColors: Record<string, string[]>;
  /** Multi-select varieties, keyed exactly like itemColors. */
  itemVarieties: Record<string, string[]>;
  onQuantityChange: (key: string, qty: number) => void;
  onNoteChange: (id: string, note: string) => void;
  onColorChange: (key: string, colors: string[]) => void;
  onVarietyChange: (key: string, varieties: string[]) => void;
  /** Whether this item's lines are marked "For an event". Only meaningful
   *  when onEventToggle is provided (i.e. not the Press Bar section). */
  eventChecked?: boolean;
  onEventToggle?: (id: string, checked: boolean) => void;
  /** True when this row IS the event portion of a split — it always submits
   *  as events, so the badge/checkmark/split controls are suppressed. */
  isEventCopy?: boolean;
  /** Whether the regular/event split is open for this item. */
  splitOpen?: boolean;
  onOpenSplit?: (id: string) => void;
}

function QuantityStepper({ value, onChange, disabled, maxQty, label }: {
  value: number; onChange: (v: number) => void; disabled: boolean; maxQty: number; label: string;
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} disabled={disabled || value <= 0}
        className="w-11 h-11 rounded-full bg-farm-cream/60 text-farm-muted/90 flex items-center justify-center text-xl font-light disabled:opacity-30 active:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-green/40"
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
        // Desktop browsers increment a focused number input on scroll-wheel,
        // so scrolling the (long) order form silently changes quantities —
        // chefs ended up with items they never tapped. Blur on wheel so the
        // scroll goes to the page instead.
        onWheel={(e) => (e.target as HTMLInputElement).blur()}
        disabled={disabled}
        className="w-14 h-11 text-center text-base font-semibold tabular-nums text-farm-dark border border-farm-dark/10 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-farm-green/40"
        placeholder="0"
        aria-label={`Quantity for ${label}`}
      />
      <button type="button" onClick={() => onChange(Math.min(maxQty, value + 1))} disabled={disabled || value >= maxQty}
        className="w-11 h-11 rounded-full bg-farm-cream/60 text-farm-muted/90 flex items-center justify-center text-xl font-light disabled:opacity-30 active:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-green/40"
        aria-label={`Increase ${label}`}>+</button>
    </div>
  );
}

/** Inline multi-select option picker. Used for whole-item colors/varieties
 *  (no sizes) and per-size colors/varieties (with sizes). Colors render in
 *  the violet family, varieties in the blue family — matching the
 *  availability editor's toggle tones. */
function OptionPicker({
  options,
  selected,
  onToggle,
  label = "Colors",
  tone = "violet",
}: {
  options: string[];
  selected: string[];
  onToggle: (next: string[]) => void;
  label?: string;
  tone?: "violet" | "blue";
}) {
  const chipClass =
    tone === "blue"
      ? {
          on: "bg-pf-master-blue text-white",
          off: "bg-pf-master-blue/[0.08] text-pf-master-blue hover:bg-pf-master-blue/[0.16]",
        }
      : {
          on: "bg-pf-master-violet text-white",
          off: "bg-pf-master-violet/[0.08] text-pf-master-violet hover:bg-pf-master-violet/[0.16]",
        };
  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label={`${label} (multi-select)`}>
      <span className="text-[10px] text-farm-muted mr-0.5">
        {label}{selected.length > 0 ? ` (${selected.length})` : ""}:
      </span>
      {options.map((c: string) => {
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
            className={`text-xs px-3 py-2 min-h-[44px] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-green/40 ${
              isSelected ? chipClass.on : chipClass.off
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
  itemVarieties,
  onQuantityChange,
  onNoteChange,
  onColorChange,
  onVarietyChange,
  eventChecked = false,
  onEventToggle,
  isEventCopy = false,
  splitOpen = false,
  onOpenSplit,
}: ItemRowProps) {
  const { item, status, limited_qty, cycle_notes } = availabilityItem;
  const isUnavailable = status === "unavailable";
  const isLimited = status === "limited";
  const maxQty = isLimited ? (limited_qty ?? Infinity) : Infinity;

  // Events checkmark — replaces the old separate "Events Menu" section.
  // Event-only items (not on the regular menu) always submit as events, so
  // their checkmark renders pre-checked and locked. The event portion of a
  // split is implicitly events — no badge/checkmark on that copy.
  const isEventFlagged = Boolean(item.is_event_item) && !!onEventToggle && !isEventCopy;
  const isEventOnly = isEventFlagged && isEventOnlyItem(item);
  const isEventChecked = isEventOnly || eventChecked;
  // Both-menus items can split into independent regular + event portions.
  const canSplit = isEventFlagged && !isEventOnly && !!onOpenSplit;

  // Sizes/colors/units are filtered by this cycle's per-availability overrides
  // (available_sizes / available_colors / available_units). A null override means
  // "all of the item's master options"; a subset restricts what the chef can pick.
  const sizes = resolveSizes(item, availabilityItem.available_sizes);
  const colors = resolveColors(item, availabilityItem.available_colors);
  const varieties = resolveVarieties(item, availabilityItem.available_varieties);
  const units = resolveUnits(item, availabilityItem.available_units);
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
    return buildOrderKey(availabilityItem.id, { unit, size, hasMultiUnits });
  }

  const totalQty = (() => {
    if (hasMultiUnits && hasSizes) {
      return units.reduce((sum, u) => sum + sizes.reduce((s2: number, sz: string) => s2 + (quantities[qtyKey(u, sz)] ?? 0), 0), 0);
    }
    if (hasMultiUnits) {
      return units.reduce((sum, u) => sum + (quantities[qtyKey(u)] ?? 0), 0);
    }
    if (hasSizes) {
      return sizes.reduce((sum: number, s: string) => sum + (quantities[buildOrderKey(availabilityItem.id, { size: s })] ?? 0), 0);
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
          const imgUrl = getItemImageUrl({ name: item.name, image_url: item.image_url });
          const isFlower = imgUrl?.startsWith("/assets/pressfarm/flowers/");
          if (imgUrl) {
            return (
              <div className={cn(
                "w-16 h-16 rounded-lg overflow-hidden flex-shrink-0",
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
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-farm-cream/60 border border-farm-dark/5 flex items-center justify-center">
              <img
                src={PLACEHOLDER_WREATH}
                alt=""
                aria-hidden="true"
                className="w-10 h-10 object-contain opacity-25"
              />
            </div>
          );
        })()}

        {/* Item info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-base text-farm-dark">{item.name}</span>
            <span className="text-xs text-farm-muted flex-shrink-0">
              {hasMultiUnits
                ? `${units.length} containers`
                : `${UNIT_LABELS[units[0]] ?? (units[0] ?? "").toUpperCase()} container`}
            </span>
            {isEventFlagged && (
              <span className="text-[10px] bg-pf-master-violet/10 text-pf-master-violet px-1.5 py-0.5 rounded flex-shrink-0">
                EVENTS
              </span>
            )}
            {isLimited && <StatusBadge status="limited" label="Limited" className="flex-shrink-0" />}
            {item.season_status === "ending_soon" && <span className="badge-orange flex-shrink-0">ENDING SOON</span>}
            {item.season_status === "coming_soon" && <span className="badge-blue flex-shrink-0">COMING SOON</span>}
            {totalQty > 0 && hasSizes && (
              <span className="text-xs font-semibold text-farm-green flex-shrink-0 tabular-nums">({totalQty} total)</span>
            )}
          </div>
          {cycle_notes && <p className="text-xs text-farm-muted italic mt-0.5 truncate">{cycle_notes}</p>}
          {!cycle_notes && item.chef_notes && <p className="text-xs text-farm-muted italic mt-0.5 truncate">{item.chef_notes}</p>}
          {/* season_note intentionally hidden on chef-facing rows — it's
              admin/farm-facing growing-cycle info (e.g. "Cool-season crop")
              that clutters the order experience. */}

          {/* Whole-item color/variety pickers — only when item has NO sizes.
              For items WITH sizes, the pickers live under each size row. */}
          {colors.length > 0 && !hasSizes && totalQty > 0 && (
            <div className="mt-1">
              <OptionPicker
                options={colors}
                selected={itemColors[availabilityItem.id] ?? []}
                onToggle={(next) => onColorChange(availabilityItem.id, next)}
              />
            </div>
          )}
          {varieties.length > 0 && !hasSizes && totalQty > 0 && (
            <div className="mt-1">
              <OptionPicker
                options={varieties}
                selected={itemVarieties[availabilityItem.id] ?? []}
                onToggle={(next) => onVarietyChange(availabilityItem.id, next)}
                label="Varieties"
                tone="blue"
              />
            </div>
          )}
          {colors.length > 0 && totalQty === 0 && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {colors.map((c: string) => (
                <span key={c} className="text-[10px] bg-pf-master-violet/10 text-pf-master-violet px-1.5 py-0.5 rounded">{c}</span>
              ))}
            </div>
          )}
          {varieties.length > 0 && totalQty === 0 && (
            <div className="flex items-center gap-1 mt-0.5 flex-wrap">
              {varieties.map((v: string) => (
                <span key={v} className="text-[10px] bg-pf-master-blue/10 text-pf-master-blue px-1.5 py-0.5 rounded">{v}</span>
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
              const unitVarieties = itemVarieties[key] ?? [];
              return (
                <div key={unit} className="bg-blue-50/40 border border-blue-100 rounded-lg px-3 py-2 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <span className={cn("text-sm", unitQty > 0 ? "text-farm-dark font-medium" : "text-farm-muted/90")}>
                        {unitLabel}
                      </span>
                    </div>
                    <QuantityStepper
                      value={unitQty}
                      onChange={(v) => onQuantityChange(key, v)}
                      disabled={isUnavailable}
                      maxQty={maxQty}
                      label={`${item.name} ${unitLabel}`}
                    />
                  </div>
                  {colors.length > 0 && unitQty > 0 && (
                    <OptionPicker options={colors} selected={unitColors} onToggle={(next) => onColorChange(key, next)} />
                  )}
                  {varieties.length > 0 && unitQty > 0 && (
                    <OptionPicker options={varieties} selected={unitVarieties} onToggle={(next) => onVarietyChange(key, next)} label="Varieties" tone="blue" />
                  )}
                </div>
              );
            }
            // Multi-unit + sizes → nested grid (sizes within each unit)
            return (
              <div key={unit} className="bg-blue-50/40 border border-blue-100 rounded-lg px-3 py-2 space-y-1.5">
                <div className="flex items-baseline justify-between">
                  <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">{unitLabel}</p>
                </div>
                {sizes.map((size: string) => {
                  const key = qtyKey(unit, size);
                  const sizeQty = quantities[key] ?? 0;
                  const sizeColors = itemColors[key] ?? [];
                  const sizeVarieties = itemVarieties[key] ?? [];
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
                        <OptionPicker options={colors} selected={sizeColors} onToggle={(next) => onColorChange(key, next)} />
                      )}
                      {varieties.length > 0 && sizeQty > 0 && (
                        <OptionPicker options={varieties} selected={sizeVarieties} onToggle={(next) => onVarietyChange(key, next)} label="Varieties" tone="blue" />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
          {totalQty === 0 && (
            <button type="button" onClick={() => setSizesExpanded(false)} className="text-xs text-farm-muted hover:text-farm-muted/90 mt-1 min-h-[44px] px-3 inline-flex items-center">
              Hide options
            </button>
          )}
        </div>
      )}

      {/* Single-unit + sizes (legacy path) */}
      {!hasMultiUnits && hasSizes && showSizes && (
        <div className="mt-2 ml-0 space-y-1.5">
          {sizes.map((size: string) => {
            const key = buildOrderKey(availabilityItem.id, { size });
            const sizeQty = quantities[key] ?? 0;
            const sizeColors = itemColors[key] ?? [];
            const sizeVarieties = itemVarieties[key] ?? [];
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
                  <OptionPicker options={colors} selected={sizeColors} onToggle={(next) => onColorChange(key, next)} />
                )}
                {varieties.length > 0 && sizeQty > 0 && (
                  <OptionPicker options={varieties} selected={sizeVarieties} onToggle={(next) => onVarietyChange(key, next)} label="Varieties" tone="blue" />
                )}
              </div>
            );
          })}
          {totalQty === 0 && (
            <button type="button" onClick={() => setSizesExpanded(false)} className="text-xs text-farm-muted hover:text-farm-muted/90 mt-1 min-h-[44px] px-3 inline-flex items-center">
              Hide sizes
            </button>
          )}
        </div>
      )}

      {/* "For an event" checkmark + split affordance — shown once something
          is ordered. While a split is open the whole-item checkmark hides:
          the main row is the regular portion, the sub-row below is events. */}
      {isEventFlagged && totalQty > 0 && !isUnavailable && (
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {splitOpen ? (
            <span className="text-xs text-farm-muted py-1.5">
              Regular portion — event portion below
            </span>
          ) : (
            <>
              <button
                type="button"
                role="checkbox"
                aria-checked={isEventChecked}
                disabled={isEventOnly}
                onClick={() => onEventToggle?.(availabilityItem.id, !isEventChecked)}
                className={cn(
                  "inline-flex items-center gap-2 text-xs px-3 py-1.5 min-h-[44px] rounded-full transition-colors",
                  isEventChecked
                    ? "bg-pf-master-violet text-white"
                    : "bg-pf-master-violet/[0.08] text-pf-master-violet hover:bg-pf-master-violet/[0.16]",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center text-[10px] leading-none",
                    isEventChecked ? "border-white/70" : "border-pf-master-violet/50",
                  )}
                >
                  {isEventChecked ? "✓" : ""}
                </span>
                For an event{isEventOnly ? " (events-only item)" : ""}
              </button>
              {canSplit && (
                <button
                  type="button"
                  onClick={() => onOpenSplit?.(availabilityItem.id)}
                  className="text-xs text-pf-master-violet/80 hover:text-pf-master-violet underline underline-offset-2 min-h-[44px] px-2"
                >
                  Split: regular + event
                </button>
              )}
            </>
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
            className="w-full text-base border border-farm-dark/10 rounded-lg px-3 py-2 min-h-[44px] focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent placeholder:text-farm-muted/70"
          />
        </div>
      )}
    </div>
  );
}
