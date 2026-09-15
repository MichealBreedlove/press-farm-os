"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CATEGORY_ORDER, MAX_NOTES_LENGTH } from "@/lib/constants";
import { CategorySection } from "@/components/order/category-section";
import { ItemSearchBar } from "@/components/order/ItemSearchBar";
import { useItemPicker } from "@/components/order/useItemPicker";
import { collectOrderedLines, groupByCategory } from "@/lib/order/lines";
import type { PickerSource } from "@/lib/order/lines";
import type { AvailabilityItemWithItem } from "@/types";

interface DeliveryDateOption {
  date: string;
  label: string;
}

interface Props {
  deliveryDates: DeliveryDateOption[];
  selectedDeliveryDate: string | null;
  availabilityItems: AvailabilityItemWithItem[];
  initialEventDate: string;
  initialEventName: string;
  today: string;
}

export function EventOrderClient({
  deliveryDates,
  selectedDeliveryDate,
  availabilityItems,
  initialEventDate,
  initialEventName,
  today,
}: Props) {
  const router = useRouter();

  // Event-level metadata. Kept in the URL across the delivery-date reload so a
  // typed event date/name survives loading a date's availability.
  const [eventDate, setEventDate] = useState(initialEventDate);
  const [eventName, setEventName] = useState(initialEventName);

  // Item-picker state — the same hook + key conventions as the chef order
  // form. Reset on every delivery-date load (remount).
  const picker = useItemPicker();
  const [search, setSearch] = useState("");
  const [freeformNotes, setFreeformNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Navigate to load a delivery date's availability, preserving event metadata.
  function loadDeliveryDate(date: string) {
    const params = new URLSearchParams();
    if (date) params.set("deliveryDate", date);
    if (eventDate) params.set("eventDate", eventDate);
    if (eventName.trim()) params.set("eventName", eventName.trim());
    router.push(`/events/order?${params.toString()}`);
  }

  const allAvailable = useMemo(
    () => availabilityItems.filter((ai) => ai.status !== "unavailable"),
    [availabilityItems],
  );
  // Quantities are kept for the whole list; search only narrows what's shown.
  const sources: PickerSource[] = useMemo(
    () => allAvailable.map((ai) => ({ ai, section: "events" as const })),
    [allAvailable],
  );
  const visible = search.trim()
    ? allAvailable.filter((ai) => ai.item.name.toLowerCase().includes(search.toLowerCase().trim()))
    : allAvailable;
  const byCategory = useMemo(() => groupByCategory(visible), [visible]);

  // Flatten every ordered line (qty > 0) into the API's item shape.
  function buildItems() {
    return collectOrderedLines(sources, picker.maps).map((l) => ({
      availability_item_id: l.availabilityItemId,
      quantity: l.quantity,
      unit_type: l.unit || null,
      size_label: l.size,
      color_key: l.colors.length > 0 ? l.colors.join(",") : null,
      variety_key: l.varieties.length > 0 ? l.varieties.join(",") : null,
    }));
  }

  const orderedCount = useMemo(() => buildItems().length, [picker.maps, sources]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit() {
    setError(null);
    setSuccess(null);
    if (!eventName.trim()) return setError("Enter the event name.");
    if (!eventDate) return setError("Pick the event date.");
    if (eventDate < today) return setError("The event date must be today or later.");
    if (!selectedDeliveryDate) return setError("Pick a delivery date.");
    const items = buildItems();
    if (items.length === 0) return setError("Add at least one item.");

    setSubmitting(true);
    try {
      const res = await fetch("/api/events/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_date: selectedDeliveryDate,
          event_date: eventDate,
          event_name: eventName.trim() || null,
          freeform_notes: freeformNotes.trim() || null,
          items,
          idempotency_key:
            typeof crypto !== "undefined" && "randomUUID" in crypto
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? "Something went wrong.");
      setSuccess(
        `Order confirmed for delivery on ${
          deliveryDates.find((d) => d.date === selectedDeliveryDate)?.label ?? selectedDeliveryDate
        }. Press Farm has it.`,
      );
      // Reset the item picker; keep the event metadata for a possible follow-up.
      picker.reset();
      setFreeformNotes("");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      {success && (
        <div className="bg-farm-green-light border border-farm-green/20 rounded-xl px-4 py-3 text-sm text-farm-green">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Event + delivery details */}
      <div className="card p-4 space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-farm-dark">Event details</h3>
          <p className="text-xs text-farm-muted mt-0.5">
            Tell us what the event is, when it is, and when you need the items delivered.
          </p>
        </div>

        <div>
          <label className="block text-xs text-farm-muted mb-1">Event name</label>
          <input
            type="text"
            value={eventName}
            required
            onChange={(e) => setEventName(e.target.value)}
            className="input-field"
            placeholder="Wine club dinner, private party, etc."
          />
          <p className="text-[11px] text-farm-muted/80 mt-1">What the event is.</p>
        </div>

        <div>
          <label className="block text-xs text-farm-muted mb-1">Event date</label>
          <input
            type="date"
            value={eventDate}
            min={today}
            onChange={(e) => setEventDate(e.target.value)}
            className="input-field"
          />
          <p className="text-[11px] text-farm-muted/80 mt-1">The day of the event itself.</p>
        </div>

        <hr className="border-farm-dark/10" />

        <div>
          <label className="block text-xs text-farm-muted mb-1">Deliver on</label>
          <select
            value={selectedDeliveryDate ?? ""}
            onChange={(e) => loadDeliveryDate(e.target.value)}
            className="input-field"
          >
            <option value="">Choose a delivery date…</option>
            {deliveryDates.map((d) => (
              <option key={d.date} value={d.date}>
                {d.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-farm-muted/80 mt-1">
            When the items should arrive. Loads what&rsquo;s available for that day.
          </p>
        </div>
      </div>

      {/* Item picker — only once a delivery date is loaded */}
      {!selectedDeliveryDate ? (
        <p className="text-sm text-farm-muted text-center py-8">
          Choose a delivery date above to see what&rsquo;s available.
        </p>
      ) : availabilityItems.length === 0 ? (
        <p className="text-sm text-farm-muted text-center py-8">
          Nothing is published as available for that delivery date yet. Pick another date or contact
          Press Farm.
        </p>
      ) : (
        <>
          <div className="-mx-4">
            <ItemSearchBar value={search} onChange={setSearch}>
              {orderedCount > 0 && (
                <p className="text-xs text-farm-green mt-1.5 px-1 tabular-nums">
                  {orderedCount} item{orderedCount !== 1 ? "s" : ""} in this order
                </p>
              )}
            </ItemSearchBar>
          </div>
          <div>
            {visible.length === 0 ? (
              <p className="text-sm text-farm-muted text-center py-8">No items match &ldquo;{search}&rdquo;.</p>
            ) : (
              CATEGORY_ORDER.map((cat) => {
                const catItems = byCategory[cat];
                if (catItems.length === 0) return null;
                return (
                  <CategorySection
                    key={cat}
                    category={cat}
                    items={catItems}
                    quantities={picker.quantities}
                    itemNotes={picker.itemNotes}
                    itemColors={picker.itemColors}
                    itemVarieties={picker.itemVarieties}
                    {...picker.sectionHandlers}
                  />
                );
              })
            )}
          </div>

          <div className="card px-4 py-4">
            <label htmlFor="event-notes" className="block text-sm font-semibold text-farm-dark mb-2">
              Notes for Press Farm
            </label>
            <textarea
              id="event-notes"
              value={freeformNotes}
              onChange={(e) => setFreeformNotes(e.target.value)}
              maxLength={MAX_NOTES_LENGTH}
              rows={3}
              placeholder="Anything that helps us prep for this event…"
              className="w-full text-sm border border-farm-dark/10 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
            />
            <p className="text-xs text-farm-muted mt-1 text-right">
              {freeformNotes.length}/{MAX_NOTES_LENGTH}
            </p>
          </div>

          <div className="fixed bottom-nav-safe inset-x-0 bg-white shadow-nav px-4 py-3 z-40">
            <div className="max-w-2xl mx-auto">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting || orderedCount === 0}
                className="w-full bg-farm-green text-white font-semibold py-3 rounded-xl disabled:opacity-40 disabled:cursor-not-allowed min-h-[44px] transition-opacity"
              >
                {submitting ? "Submitting…" : "Submit Event Order"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
