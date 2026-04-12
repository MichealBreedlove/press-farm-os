"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquarePlus, Trash2, Send } from "lucide-react";

interface Suggestion {
  id: string;
  text: string;
  author: string;
  status: string;
  created_at: string;
}

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  new: { label: "New", cls: "badge-blue" },
  reviewed: { label: "Reviewed", cls: "badge-gold" },
  implemented: { label: "Done", cls: "badge-green" },
  declined: { label: "Declined", cls: "badge-gray" },
};

export function SuggestionBoxClient({ suggestions, farmId }: { suggestions: Suggestion[]; farmId: string }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);

  async function addSuggestion() {
    if (!text.trim()) return;
    setSaving(true);
    await fetch("/api/suggestions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farm_id: farmId, text: text.trim(), author: author.trim() || "Anonymous" }),
    });
    setText("");
    setAuthor("");
    setShowForm(false);
    setSaving(false);
    router.refresh();
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/suggestions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.refresh();
  }

  async function deleteSuggestion(id: string) {
    await fetch(`/api/suggestions/${id}`, { method: "DELETE" });
    router.refresh();
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
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Anonymous" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Suggestion</label>
            <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="What would make Press Farm OS better?" rows={3} autoFocus className="input-field resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={addSuggestion} disabled={!text.trim() || saving} className="btn-primary flex-1">{saving ? "Saving..." : "Submit"}</button>
            <button onClick={() => setShowForm(false)} className="btn-ghost flex-1">Cancel</button>
          </div>
        </div>
      )}

      {suggestions.length === 0 ? (
        <p className="text-center text-gray-400 text-sm py-8">No suggestions yet.</p>
      ) : (
        <div className="space-y-2">
          {suggestions.map((s) => (
            <div key={s.id} className="card px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={STATUS_LABELS[s.status]?.cls ?? "badge-gray"}>
                      {STATUS_LABELS[s.status]?.label ?? s.status}
                    </span>
                    <span className="text-xs text-gray-400">{s.author}</span>
                    <span className="text-xs text-gray-300">
                      {new Date(s.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-farm-dark">{s.text}</p>
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
                <button onClick={() => deleteSuggestion(s.id)} className="text-gray-300 hover:text-red-500 min-h-0 min-w-0 p-2 transition-colors">
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
