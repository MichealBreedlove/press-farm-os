"use client";

import { useState } from "react";
import { List, CalendarDays } from "lucide-react";

export function ViewToggle({
  listView,
  calendarView,
  defaultView = "calendar",
}: {
  listView: React.ReactNode;
  calendarView: React.ReactNode;
  defaultView?: "list" | "calendar";
}) {
  const [view, setView] = useState<"list" | "calendar">(defaultView);

  return (
    <div>
      {/* Toggle */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-3">
        <button
          type="button"
          onClick={() => setView("calendar")}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[40px] text-sm font-medium rounded-lg transition-colors ${
            view === "calendar"
              ? "bg-white text-farm-dark shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Calendar
        </button>
        <button
          type="button"
          onClick={() => setView("list")}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[40px] text-sm font-medium rounded-lg transition-colors ${
            view === "list"
              ? "bg-white text-farm-dark shadow-sm"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <List className="w-4 h-4" />
          List
        </button>
      </div>

      <div>{view === "calendar" ? calendarView : listView}</div>
    </div>
  );
}
