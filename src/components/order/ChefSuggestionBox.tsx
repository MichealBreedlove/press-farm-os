"use client";

import { useState } from "react";
import { Sparkles, Sprout, Send, ChevronDown, ChevronUp } from "lucide-react";

type SuggestionKind = "crop" | "feature";

interface ChefSuggestionBoxProps {
  /** Optional farm_id to attach to the suggestion (if your API requires it). */
  farmId?: string;
}

/**
 * Collapsible chef-facing form for submitting either:
 * - A crop request ("can you grow fennel flowers next season?")
 * - A website / feature suggestion ("would love to filter by category")
 *
 * POSTs to /api/suggestions which already exists for the admin
 * suggestion box on /admin/settings/suggestions.
 */
export function ChefSuggestionBox({ farmId }: ChefSuggestionBoxProps) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<SuggestionKind>("crop");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      // Tag the suggestion text with the kind so admins can sort
      const tag = kind === "crop" ? "[CROP REQUEST]" : "[FEATURE]";
      const body: any = {
        text: `${tag} ${text.trim()}`,
        author: author.trim() || "Chef",
      };
      if (farmId) body.farm_id = farmId;
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setSubmitted(true);
        setText("");
        // Auto-close after a beat
        setTimeout(() => {
          setOpen(false);
          setSubmitted(false);
        }, 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card mt-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-farm-cream/40 transition-colors"
      >
        <Sparkles className="w-4 h-4 text-pf-master-gold flex-shrink-0" />
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-farm-dark">
            Suggestions &amp; crop requests
          </p>
          <p className="text-[11px] text-farm-muted mt-0.5">
            Want fennel flowers next season? Ideas for the website? Tell us.
          </p>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-farm-muted" />
        ) : (
          <ChevronDown className="w-4 h-4 text-farm-muted" />
        )}
      </button>

      {open && (
        <div className="border-t border-farm-dark/5 px-4 py-4 space-y-3 bg-farm-cream/40">
          {/* Kind toggle — Crop request vs Feature suggestion */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind("crop")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full min-h-[36px] transition-colors ${
                kind === "crop"
                  ? "bg-farm-green text-white"
                  : "bg-white text-farm-muted border border-farm-dark/10 hover:text-farm-dark"
              }`}
            >
              <Sprout className="w-3.5 h-3.5" />
              Crop request
            </button>
            <button
              type="button"
              onClick={() => setKind("feature")}
              className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-full min-h-[36px] transition-colors ${
                kind === "feature"
                  ? "bg-farm-green text-white"
                  : "bg-white text-farm-muted border border-farm-dark/10 hover:text-farm-dark"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Feature
            </button>
          </div>

          {/* Author (optional) */}
          <div>
            <label className="form-label">Your name (optional)</label>
            <input
              type="text"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Chef"
              className="input-field"
            />
          </div>

          {/* Text body */}
          <div>
            <label className="form-label">
              {kind === "crop" ? "What should we grow?" : "What would make this better?"}
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                kind === "crop"
                  ? "e.g. Fennel flowers next season · Lacinato kale 'Rainbow' variety · Borage in deep blue"
                  : "e.g. Show last week's order on the home screen · Filter by category · Search by name..."
              }
              rows={3}
              maxLength={500}
              className="input-field resize-none"
            />
            <p className="text-[10px] text-farm-muted mt-1 text-right">
              {text.length}/500
            </p>
          </div>

          <button
            type="button"
            onClick={submit}
            disabled={!text.trim() || saving}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitted ? (
              <>
                <Sparkles className="w-4 h-4" />
                Sent — thanks!
              </>
            ) : saving ? (
              "Sending…"
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send to Press Farm
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
