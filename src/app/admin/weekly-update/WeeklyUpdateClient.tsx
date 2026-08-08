"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Check, Send, Loader2, Sprout, Users, Plus, X } from "lucide-react";

/**
 * Chef Weekly Update manager — general note + hand-picked recipient list,
 * stored in farm_settings under weekly_update_general_note /
 * weekly_update_recipients. ONLY addresses on the list receive the update;
 * chefs are offered as a picker but never auto-included. Sends every Monday
 * morning via Vercel cron (/api/reports/weekly-update) or on demand here.
 */
export function WeeklyUpdateClient({
  settings,
  farmId,
  chefs,
}: {
  settings: Record<string, string>;
  farmId: string;
  chefs: { name: string; email: string }[];
}) {
  const router = useRouter();
  const [note, setNote] = useState(settings["weekly_update_general_note"] ?? "");
  const [recipients, setRecipients] = useState<string[]>(() =>
    (settings["weekly_update_recipients"] ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const chefEmails = new Set(chefs.map((c) => c.email));
  const customRecipients = recipients.filter((e) => !chefEmails.has(e));

  function toggleRecipient(email: string) {
    setRecipients((list) =>
      list.includes(email) ? list.filter((e) => e !== email) : [...list, email],
    );
    setSaved(false);
  }

  function addRecipient() {
    const email = input.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInputError("That doesn't look like a valid email address.");
      return;
    }
    if (recipients.includes(email)) {
      setInputError("Already on the list.");
      return;
    }
    setRecipients((list) => [...list, email]);
    setInput("");
    setInputError(null);
    setSaved(false);
  }

  function removeRecipient(email: string) {
    setRecipients((list) => list.filter((e) => e !== email));
    setSaved(false);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: farmId,
        settings: {
          weekly_update_general_note: note,
          weekly_update_recipients: recipients.join(","),
        },
      }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
    setSaving(false);
  }

  async function sendNow() {
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/reports/weekly-update", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setSendResult({ kind: "err", msg: data?.error || "Send failed — check Resend config." });
      } else {
        const to: string[] = Array.isArray(data?.to) ? data.to : [data?.to].filter(Boolean);
        const failedNote = data?.failed?.length
          ? ` (${data.failed.length} failed: ${data.failed.map((f: { to: string }) => f.to).join(", ")})`
          : "";
        setSendResult({
          kind: "ok",
          msg: `Weekly update sent to ${to.length} recipient${to.length === 1 ? "" : "s"}: ${to.join(", ")}.${failedNote}`,
        });
      }
    } catch (err) {
      setSendResult({ kind: "err", msg: String(err) });
    }
    setSending(false);
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-farm-green text-white flex items-center justify-center">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">This Week&apos;s Note</h2>
            <p className="text-xs text-farm-muted">
              Shows at the top of the email as bullets — one per line. The rest of the email
              (Available Now, planter beds, gaps &amp; limited supply, incoming timeline) fills in
              automatically from availability, planter boxes, and the crop plan.
            </p>
          </div>
        </div>
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          rows={4}
          placeholder={"First tomatoes of the season this week\nHeat wave — flowers may run short"}
          className="input-field resize-y"
        />
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-farm-green text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Recipients</h2>
            <p className="text-xs text-farm-muted">
              Only the people picked here get the update. Check the chef accounts that should see
              it — unchecked chefs receive nothing — and add any other addresses below.
            </p>
          </div>
        </div>

        {chefs.length > 0 && (
          <div className="rounded-lg border border-farm-dark/10 divide-y divide-farm-dark/5 mb-3">
            {chefs.map((chef) => (
              <label
                key={chef.email}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={recipients.includes(chef.email)}
                  onChange={() => toggleRecipient(chef.email)}
                  className="w-4 h-4 accent-farm-green"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-farm-dark truncate">{chef.name}</span>
                  <span className="block text-xs text-farm-muted truncate">{chef.email}</span>
                </span>
              </label>
            ))}
          </div>
        )}

        {customRecipients.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {customRecipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-100 text-farm-green text-xs px-3 py-1.5"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeRecipient(email)}
                  aria-label={`Remove ${email}`}
                  className="text-farm-green/60 hover:text-farm-green min-h-0 min-w-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="email"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setInputError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRecipient();
              }
            }}
            placeholder="name@example.com"
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={addRecipient}
            className="btn-secondary flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {inputError && <p className="text-xs text-amber-800 mt-1.5">{inputError}</p>}
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saved ? (
          <><Check className="w-4 h-4" /> Saved</>
        ) : saving ? (
          "Saving..."
        ) : (
          <><Save className="w-4 h-4" /> Save Note &amp; Recipients</>
        )}
      </button>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-farm-green text-white flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Send</h2>
            <p className="text-xs text-farm-muted">
              Goes out automatically every Monday morning to the saved list. Send now to fire it
              immediately — save first if you just changed the note or recipients.
            </p>
          </div>
        </div>

        {sendResult && (
          <div
            className={`mb-3 rounded-lg px-3 py-2 text-xs ${
              sendResult.kind === "ok"
                ? "bg-green-50 text-farm-green border border-green-100"
                : "bg-amber-50 text-amber-800 border border-amber-100"
            }`}
          >
            {sendResult.msg}
          </div>
        )}

        <button
          type="button"
          onClick={sendNow}
          disabled={sending}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Weekly Update Now
        </button>
      </div>
    </div>
  );
}
