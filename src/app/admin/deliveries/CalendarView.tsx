"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface DeliveryDay {
  date: string;
  total: number;
  status: string;
  restaurant: string;
}

interface CalendarViewProps {
  deliveries: DeliveryDay[];
  deliveryDates: string[]; // dates with ordering open
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ deliveries, deliveryDates }: CalendarViewProps) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Build delivery map: date string -> array of deliveries
  const deliveryMap: Record<string, DeliveryDay[]> = {};
  for (const d of deliveries) {
    if (!deliveryMap[d.date]) deliveryMap[d.date] = [];
    deliveryMap[d.date].push(d);
  }

  const deliveryDateSet = new Set(deliveryDates);

  function prev() {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  }
  function next() {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  }

  const todayStr = today.toISOString().split("T")[0];

  // Build calendar grid
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <button onClick={prev} className="p-2 text-gray-400 hover:text-farm-dark min-h-0 min-w-0">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="font-display text-sm text-farm-dark">{monthLabel}</h3>
        <button onClick={next} className="p-2 text-gray-400 hover:text-farm-dark min-h-0 min-w-0">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider py-2 border-b border-gray-50">
        {DAYS.map((d) => <div key={d}>{d}</div>)}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="h-16 border-b border-r border-gray-50" />;

          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const dayDeliveries = deliveryMap[dateStr] ?? [];
          const isDeliveryDate = deliveryDateSet.has(dateStr);
          const isToday = dateStr === todayStr;
          const total = dayDeliveries.reduce((s, d) => s + d.total, 0);
          const hasDelivery = dayDeliveries.length > 0;

          return (
            <div
              key={dateStr}
              className={`h-16 border-b border-r border-gray-50 px-1 py-1 relative ${
                isToday ? "bg-farm-green-light/40" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isToday ? "font-bold text-farm-green" : "text-gray-500"}`}>
                  {day}
                </span>
                {isDeliveryDate && !hasDelivery && (
                  <span className="w-1.5 h-1.5 rounded-full bg-farm-green/40" />
                )}
              </div>
              {hasDelivery && (
                <Link
                  href={`/admin/deliveries/${dateStr}`}
                  className="block mt-0.5 min-h-0 min-w-0"
                >
                  <div className="bg-farm-green text-white rounded px-1 py-0.5 text-[9px] font-medium truncate">
                    ${total.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </div>
                </Link>
              )}
              {isDeliveryDate && !hasDelivery && (
                <Link
                  href={`/admin/deliveries/${dateStr}`}
                  className="block mt-0.5 min-h-0 min-w-0"
                >
                  <div className="bg-gray-100 text-gray-400 rounded px-1 py-0.5 text-[9px] truncate text-center">
                    Log
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
