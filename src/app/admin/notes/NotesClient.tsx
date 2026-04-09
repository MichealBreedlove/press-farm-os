"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";

interface Note {
  id: string;
  date: string;
  text: string;
  category: string;
}

const NOTE_CATEGORIES = [
  { value: "observation", label: "Observation" },
  { value: "season_update", label: "Season Update" },
  { value: "task", label: "To-Do" },
  { value: "harvest_note", label: "Harvest Note" },
  { value: "general", label: "General" },
];

// Simple localStorage-based notes for MVP
// Can be migrated to a DB table later
const STORAGE_KEY = "press_farm_notes";

function loadNotes(): Note[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveNotes(notes: Note[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
}

export function NotesClient() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [category, setCategory] = useState("observation");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    setNotes(loadNotes());
  }, []);

  function addNote() {
    if (!text.trim()) return;
    const newNote: Note = {
      id: Date.now().toString(),
      date,
      text: text.trim(),
      category,
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    saveNotes(updated);
    setText("");
    setShowForm(false);
  }

  function deleteNote(id: string) {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    saveNotes(updated);
  }

  const filtered = filter === "all" ? notes : notes.filter((n) => n.category === filter);

  const categoryColors: Record<string, string> = {
    observation: "badge-blue",
    season_update: "badge-orange",
    task: "badge-gold",
    harvest_note: "badge-green",
    general: "badge-gray",
  };

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter("all")}
          className={`text-xs px-3 py-1.5 rounded-full font-medium min-h-0 min-w-0 whitespace-nowrap transition-colors ${
            filter === "all" ? "bg-farm-green text-white" : "bg-gray-100 text-gray-500"
          }`}
        >
          All ({notes.length})
        </button>
        {NOTE_CATEGORIES.map((cat) => {
          const count = notes.filter((n) => n.category === cat.value).length;
          return (
            <button
              key={cat.value}
              onClick={() => setFilter(cat.value)}
              className={`text-xs px-3 py-1.5 rounded-full font-medium min-h-0 min-w-0 whitespace-nowrap transition-colors ${
                filter === cat.value ? "bg-farm-green text-white" : "bg-gray-100 text-gray-500"
              }`}
            >
              {cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="btn-primary w-full flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Note
        </button>
      )}

      {/* Add form */}
      {showForm && (
        <div className="card p-4 space-y-3">
          <h3 className="font-display text-sm text-farm-dark">New Note</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
              >
                {NOTE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Note</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g. Broccoli shoots are starting to bolt, 2-3 weeks left..."
              rows={3}
              className="input-field resize-none"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button onClick={addNote} className="btn-primary flex-1">Save</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {filtered.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">
          {notes.length === 0 ? "No notes yet — add your first observation." : "No notes match this filter."}
        </p>
      ) : (
        <div className="space-y-2">
          {filtered.map((note) => (
            <div key={note.id} className="card px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs text-gray-400">
                      {new Date(note.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                    <span className={categoryColors[note.category] ?? "badge-gray"}>
                      {NOTE_CATEGORIES.find((c) => c.value === note.category)?.label ?? note.category}
                    </span>
                  </div>
                  <p className="text-sm text-farm-dark">{note.text}</p>
                </div>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="text-gray-300 hover:text-red-500 transition-colors min-h-0 min-w-0 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
