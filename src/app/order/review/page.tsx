"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { UNIT_LABELS } from "@/lib/constants";
import { flowerImageForName } from "@/lib/flower-images";
import { DeliveryWeatherBanner } from "@/components/shared/DeliveryWeatherBanner";
import type { OrderFormData } from "@/components/order/OrderForm";
import type { UnitType } from "@/types";

/**
 * /order/review — Order review before submit (Client Component)
 *
 * Reads order data from sessionStorage, shows summary,
 * and submits to POST /api/orders on confirm.
 */
export default function OrderReviewPage() {
  const router = useRouter();
  const [orderData, setOrderData] = useState<OrderFormData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("press_farm_order");
    if (!raw) {
      router.replace("/order");
      return;
    }
    try {
      setOrderData(JSON.parse(raw));
    } catch {
      router.replace("/order");
    }
  }, [router]);

  if (!orderData) {
    return (
      <main className="min-h-screen bg-farm-cream flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading...</p>
      </main>
    );
  }

  const { items, freeformNotes, deliveryDateFormatted, restaurantId, deliveryDate, editingOrderId } = orderData;
  const isEditing = !!editingOrderId;

  async function handleSubmit() {
    if (!orderData) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurant_id: restaurantId,
          delivery_date: deliveryDate,
          items: items.map((item) => ({
            availability_item_id: item.availabilityItemId,
            quantity: item.quantity,
            unit_price: item.unitPrice,
            unit_type: item.unitType,
            size_label: item.sizeLabel,
            color_key: item.colorKey,
          })),
          freeform_notes: freeformNotes || undefined,
          // Tells the API "this is an explicit edit — replace items".
          // Without it, a second submission for an existing date MERGES
          // (sums qty for matching lines, appends new ones) instead of
          // wiping the prior order.
          editing_order_id: editingOrderId ?? null,
        }),
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setIsSubmitting(false);
        return;
      }

      // Store the delivery date for the confirmation page, then clear order
      sessionStorage.setItem("press_farm_order_confirmed_date", deliveryDateFormatted);
      sessionStorage.removeItem("press_farm_order");
      router.push("/order/confirmed");
    } catch {
      setError("Network error. Please check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-farm-cream pb-32">
      <header className="page-header flex items-center gap-3">
        <button
          onClick={() => router.push(isEditing ? `/order?edit=${editingOrderId}` : '/order')}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-white/70 hover:text-white -ml-2"
          aria-label="Go back"
        >
          ‹
        </button>
        <div>
          <h1 className="page-title">{isEditing ? "Review Changes" : "Review Order"}</h1>
          <p className="text-sm text-white/60">{deliveryDateFormatted}</p>
        </div>
      </header>

      <div className="px-4 py-5 space-y-4">
        <DeliveryWeatherBanner
          deliveryDate={deliveryDate}
          deliveryDateFormatted={deliveryDateFormatted}
        />

        {/* Order items */}
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-50">
            <p className="section-eyebrow with-flower text-farm-muted">Items · {items.length}</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {items.map((item, idx) => {
              const flowerSrc = flowerImageForName(item.itemName);
              // Composite React key — chefs can order multiple sizes/colors of
              // the same availability_item_id; bare id alone collides.
              const liKey = `${item.availabilityItemId}__${item.unitType}__${item.sizeLabel ?? ""}__${item.colorKey ?? ""}__${idx}`;
              return (
                <li key={liKey} className="px-4 py-3">
                  <div className="flex items-start gap-3">
                    {flowerSrc && (
                      <div className="w-12 h-12 rounded-lg bg-farm-cream border border-farm-dark/5 flex items-center justify-center flex-shrink-0">
                        <img src={flowerSrc} alt="" aria-hidden="true" className="w-9 h-9 object-contain" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-farm-dark truncate">{item.itemName}</p>
                      <p className="text-xs text-farm-muted mt-0.5">
                        {UNIT_LABELS[item.unitType as UnitType] ?? item.unitType} container
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-farm-dark">
                        &times; {item.quantity}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center bg-farm-cream/40">
            <span className="text-sm font-semibold text-farm-dark">Total Items</span>
            <span className="text-base font-bold text-farm-dark">{items.length}</span>
          </div>
        </div>

        {/* Notes */}
        {freeformNotes && (
          <div className="card px-4 py-4">
            <p className="section-eyebrow with-flower text-farm-muted mb-1.5">Notes for Press Farm</p>
            <p className="text-sm text-farm-dark whitespace-pre-wrap leading-relaxed">{freeformNotes}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Sticky action buttons */}
      <div className="fixed bottom-nav-safe inset-x-0 bg-white shadow-nav px-4 py-3 z-40">
        <div className="flex gap-3 max-w-2xl mx-auto">
          <button
            onClick={() => router.push(isEditing ? `/order?edit=${editingOrderId}` : '/order')}
            disabled={isSubmitting}
            className="btn-ghost flex-1 bg-gray-50 hover:bg-gray-100 text-sm py-3"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-primary flex-[2] text-sm py-3"
          >
            {isSubmitting ? (isEditing ? "Updating..." : "Submitting...") : (isEditing ? "Update Order" : "Submit Order")}
          </button>
        </div>
      </div>
    </main>
  );
}
