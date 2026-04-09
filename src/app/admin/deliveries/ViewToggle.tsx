"use client";

import { useState } from "react";
import { List, CalendarDays } from "lucide-react";

export function ViewToggle({
  listView,
  calendarView,
}: {
  listView: React.ReactNode;
  calendarView: React.ReactNode;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");

  return (
    <div>
      {/* Toggle */}
      <div className="flex gap-1 bg-white/20 rounded-lg p-0.5 mb-4">
        <button
          onClick={() => setView("list")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all min-h-0 ${
            view === "list" ? "bg-white text-farm-green shadow-sm" : "text-white/60 hover:text-white"
          }`}
        >
          <List className="w-3.5 h-3.5" />
          List
        </button>
        <button
          onClick={() => setView("calendar")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all min-h-0 ${
            view === "calendar" ? "bg-white text-farm-green shadow-sm" : "text-white/60 hover:text-white"
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          Calendar
        </button>
      </div>

      {view === "list" ? listView : calendarView}
    </div>
  );
}
