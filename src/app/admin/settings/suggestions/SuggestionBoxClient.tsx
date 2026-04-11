"use client";

import { useState, useEffect } from "react";
import { MessageSquarePlus, Trash2, Send } from "lucide-react";

interface Suggestion {
  id: string;
  text: string;
  author: string;
  date: string;
  status: "new" | "reviewed" | "implemented" | "declined";
}

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  new: { label: "New", class: "badge-blue" },
  reviewed: { label: "Reviewed", class: "badge-gold" },
  implemented: { label: "Done", class: "badge-green" },
  declined: { label: "Declined", class: "badge-gray" },
};

const STORAGE_KEY = "press_farm_suggestions";

function loadSuggestions(): Suggestion[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch { return []; }
}

function saveSuggestions(suggestions: Suggestion[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(suggestions));
}

export function SuggestionBoxClient() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");

  useEffect(() => { setSuggestions(loadSuggestions()); }, []);

  function addSuggestion() {
    if (!text.trim()) return;
    const newSuggestion: Suggestion = {
      id: Date.now().toString(),
      text: text.trim(),
      author: author.trim() || "Anonymous",
      date: new Date().toISOString().split("T")[0],
      status: "new",
    };
    const updated = [newSuggestion, ...suggestions];
    setSuggestions(updated);
    saveSuggestions(updated);
    setText("");
    setAuthor("");
    setShowForm(false);
  }

  function updateStatus(id: string, status: Suggestion["status"]) {
    const updated = suggestions.map((s) => s.id === id ? { ...s, status } : s);
    setSuggestions(updated);
    saveSuggestions(updated);
  }

  function deleteSuggestion(id: string) {
    const updated = suggestions.filter((s) => s.id !== id);
    setSuggestions(updated);
    saveSuggestions(updated);
  }

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-purple-500 text-white flex items-center justify-center">
            <MessageSquarePlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Suggestion Box</h2>
            <p className="text-xs text-gray-400">Ideas, feedback, and improvement suggestions</p>
          </div>
        </div>
      </div>

      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="btn-primary w-full flex items-center justify-center gap-2">
          <Send className="w-4 h-4" /> Submit Suggestion
        </button>
      ) : (
        <div className="card p-4 space-y-3">
          <h3 className="font-display text-sm text-farm-dark">New Suggestion</h3>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Your Name (optional)</label>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)}
              placeholder="Anonymous" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Suggestion</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)}
              placeholder="What would make Press Farm OS better?"
              rows={3} autoFocus className="input-field resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={addSuggestion} disabled={!text.trim()} className="btn-primary flex-1">Submit</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </div>
      )}

      {/* Suggestions list */}
      {suggestions.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">No suggestions yet.</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div key={s.id} className="card px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={STATUS_LABELS[s.status]?.class ?? "badge-gray"}>
                      {STATUS_LABELS[s.status]?.label ?? s.status}
                    </span>
                    <span className="text-xs text-gray-400">{s.author}</span>
                    <span className="text-xs text-gray-300">
                      {new Date(s.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-farm-dark">{s.text}</p>
                  {/* Status buttons */}
                  <div className="flex gap-1 mt-2">
                    {(["new", "reviewed", "implemented", "declined"] as const).map((st) => (
                      <button key={st} onClick={() => updateStatus(s.id, st)}
                        className={`text-[9px] px-2 py-0.5 rounded-full min-h-0 min-w-0 capitalize transition-colors ${
                          s.status === st ? "bg-farm-green text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                        }`}
                      >{st}</button>
                    ))}
                  </div>
                </div>
                <button onClick={() => deleteSuggestion(s.id)}
                  className="text-gray-300 hover:text-red-500 min-h-0 min-w-0 p-2 transition-colors">
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
