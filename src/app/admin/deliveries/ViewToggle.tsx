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
      <div className="flex bg-farm-cream/60 rounded-xl p-1 mb-3">
        <button
          type="button"
          onClick={() => setView("calendar")}
          className={`flex-1 flex items-center justify-center gap-1.5 min-h-[40px] text-sm font-medium rounded-lg transition-colors ${
            view === "calendar"
              ? "bg-white text-farm-dark shadow-sm"
              : "text-farm-muted hover:text-farm-dark/80"
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
              : "text-farm-muted hover:text-farm-dark/80"
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
