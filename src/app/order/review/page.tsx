"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/utils";
import { UNIT_LABELS } from "@/lib/constants";
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

  const { items, freeformNotes, deliveryDateFormatted, restaurantId, deliveryDate } = orderData;

  const total = items.reduce((sum, item) => {
    if (item.unitPrice !== null) {
      return sum + item.unitPrice * item.quantity;
    }
    return sum;
  }, 0);

  const hasPrices = items.some((item) => item.unitPrice !== null);

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
          })),
          freeform_notes: freeformNotes || undefined,
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
          onClick={() => router.push('/order')}
          className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-500 -ml-2"
          aria-label="Go back"
        >
          ‹
        </button>
        <div>
          <h1 className="page-title">Review Order</h1>
          <p className="text-sm text-gray-500">{deliveryDateFormatted}</p>
        </div>
      </header>

      <div className="px-4 py-4">
        {/* Order items table */}
        <div className="card overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">
              Items ({items.length})
            </h2>
          </div>
          <ul className="divide-y divide-gray-50">
            {items.map((item) => (
              <li key={item.availabilityItemId} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.itemName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {UNIT_LABELS[item.unitType as UnitType] ?? item.unitType}
                      {item.unitPrice !== null && (
                        <span className="ml-1">· {formatCurrency(item.unitPrice)} each</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-gray-900">
                      &times; {item.quantity}
                    </p>
                    {item.unitPrice !== null && (
                      <p className="text-xs text-gray-500">
                        {formatCurrency(item.unitPrice * item.quantity)}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* Total row */}
          <div className="px-4 py-3 border-t border-gray-100 flex justify-between items-center">
            <span className="text-sm font-semibold text-gray-700">
              {hasPrices ? "Estimated Total" : "Total"}
            </span>
            <span className="text-base font-bold text-gray-900">
              {hasPrices ? formatCurrency(total) : "—"}
            </span>
          </div>
        </div>

        {/* Notes */}
        {freeformNotes && (
          <div className="card px-4 py-4 mb-4">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Notes for Micheal</h2>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{freeformNotes}</p>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>

      {/* Sticky action buttons */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t border-gray-100 px-4 py-4 safe-area-bottom">
        <div className="flex gap-3">
          <button
            onClick={() => router.push('/order')}
            disabled={isSubmitting}
            className="flex-1 bg-gray-100 text-gray-700 font-semibold py-3 rounded-xl min-h-[44px] disabled:opacity-40 transition-opacity"
          >
            Back
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex-[2] bg-farm-green text-white font-semibold py-3 rounded-xl min-h-[44px] disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
          >
            {isSubmitting ? "Submitting..." : "Submit Order"}
          </button>
        </div>
      </div>
    </main>
  );
}
