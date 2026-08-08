"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Save, Check, Send, Loader2, Sprout, Users, Plus, X, Trash2, RotateCcw,
  Table2, Flower2, AlertTriangle, CalendarClock,
} from "lucide-react";
import type { WeeklyUpdateData } from "@/lib/weekly-update";

/**
 * Weekly Update editor — the full email is editable before it goes out.
 *
 * The server passes a live-built draft (availability, planter boxes,
 * forecast) plus any saved edits for this week. Every section — general
 * note, Available Now, planter beds, gaps, incoming timeline — can be
 * changed, rows added or removed. "Save Draft" persists the edited version
 * (farm_settings.weekly_update_draft); both Send Now and the Monday cron
 * send the saved draft verbatim, falling back to live data when no draft
 * exists for the week.
 */

type RowField = { key: string; label: string; wide?: boolean };

function RowsEditor({
  rows,
  fields,
  onChange,
  addLabel,
}: {
  rows: Record<string, string>[];
  fields: RowField[];
  onChange: (rows: Record<string, string>[]) => void;
  addLabel: string;
}) {
  function setCell(idx: number, key: string, value: string) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }
  function removeRow(idx: number) {
    onChange(rows.filter((_, i) => i !== idx));
  }
  function addRow() {
    onChange([...rows, Object.fromEntries(fields.map((f) => [f.key, ""]))]);
  }
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-xs text-farm-muted">Nothing here — the section is skipped in the email unless you add a row.</p>
      )}
      {rows.map((row, idx) => (
        <div key={idx} className="rounded-lg border border-farm-dark/10 p-2.5">
          <div className="flex items-start gap-2">
            <div className="flex-1 grid grid-cols-2 gap-2">
              {fields.map((f) => (
                <div key={f.key} className={f.wide ? "col-span-2" : ""}>
                  <label className="block text-[10px] uppercase tracking-wider text-farm-muted mb-0.5">
                    {f.label}
                  </label>
                  <input
                    type="text"
                    value={row[f.key] ?? ""}
                    onChange={(e) => setCell(idx, f.key, e.target.value)}
                    className="input-field py-1.5 text-sm"
                  />
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              aria-label="Remove row"
              className="text-farm-muted hover:text-red-700 mt-5 min-h-0 min-w-0 flex-shrink-0"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="btn-secondary w-full flex items-center justify-center gap-1.5 py-2 text-sm"
      >
        <Plus className="w-4 h-4" /> {addLabel}
      </button>
    </div>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-farm-green text-white flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-sm text-farm-dark">{title}</h2>
          <p className="text-xs text-farm-muted">{description}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

export function WeeklyUpdateClient({
  settings,
  farmId,
  chefs,
  liveData,
  draftData,
  weekAnchor,
}: {
  settings: Record<string, string>;
  farmId: string;
  chefs: { name: string; email: string }[];
  liveData: WeeklyUpdateData;
  draftData: WeeklyUpdateData | null;
  weekAnchor: string;
}) {
  const router = useRouter();
  const [data, setData] = useState<WeeklyUpdateData>(draftData ?? liveData);
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

  function patch(partial: Partial<WeeklyUpdateData>) {
    setData((d) => ({ ...d, ...partial }));
    setSaved(false);
  }

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

  async function saveDraft(): Promise<boolean> {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        farm_id: farmId,
        settings: {
          weekly_update_general_note: data.generalNote,
          weekly_update_recipients: recipients.join(","),
          weekly_update_draft: JSON.stringify({ weekOf: weekAnchor, data }),
        },
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
    return res.ok;
  }

  async function sendNow() {
    setSending(true);
    setSendResult(null);
    try {
      // Persist first so the sent version and the saved draft match.
      const savedOk = await saveDraft();
      if (!savedOk) {
        setSendResult({ kind: "err", msg: "Couldn't save the draft — send cancelled." });
        setSending(false);
        return;
      }
      const res = await fetch("/api/reports/weekly-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const resData = await res.json().catch(() => ({}));
      if (!res.ok || !resData?.success) {
        setSendResult({ kind: "err", msg: resData?.error || "Send failed — check Resend config." });
      } else {
        const to: string[] = Array.isArray(resData?.to) ? resData.to : [resData?.to].filter(Boolean);
        const failedNote = resData?.failed?.length
          ? ` (${resData.failed.length} failed: ${resData.failed.map((f: { to: string }) => f.to).join(", ")})`
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

  function resetToLive() {
    setData(liveData);
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      {/* Draft status strip */}
      <div className="rounded-xl bg-blue-100 border border-blue-700/20 px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-700">
            Editing the email for Week of {data.weekOfLabel}
          </p>
          <p className="text-[11px] text-blue-700/80 mt-0.5">
            {draftData
              ? "Loaded your saved draft. Everything below is exactly what will be sent."
              : "Built from live farm data. Edit anything below, then save — the saved draft is what goes out Monday."}
          </p>
        </div>
        <button
          type="button"
          onClick={resetToLive}
          className="flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:underline whitespace-nowrap min-h-0"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Reset to live data
        </button>
      </div>

      <SectionCard
        icon={<Sprout className="w-5 h-5" />}
        title="General"
        description="Shows at the top of the email as bullets — one per line. Leave blank to skip the section."
      >
        <textarea
          value={data.generalNote}
          onChange={(e) => patch({ generalNote: e.target.value })}
          rows={4}
          placeholder={"First tomatoes of the season this week\nHeat wave — flowers may run short"}
          className="input-field resize-y"
        />
      </SectionCard>

      <SectionCard
        icon={<Table2 className="w-5 h-5" />}
        title="Available Now"
        description="Pre-filled from the latest published availability. Edit quantities, sizes, and notes freely."
      >
        <RowsEditor
          rows={data.availableNow as unknown as Record<string, string>[]}
          fields={[
            { key: "name", label: "Item", wide: true },
            { key: "qty", label: "Qty" },
            { key: "size", label: "Size" },
            { key: "notes", label: "Notes", wide: true },
          ]}
          onChange={(rows) => patch({ availableNow: rows as unknown as WeeklyUpdateData["availableNow"] })}
          addLabel="Add item"
        />
      </SectionCard>

      <SectionCard
        icon={<Flower2 className="w-5 h-5" />}
        title="Restaurant Planter Beds"
        description="Pre-filled from active planter box plantings."
      >
        <RowsEditor
          rows={data.planterBeds as unknown as Record<string, string>[]}
          fields={[
            { key: "name", label: "Item", wide: true },
            { key: "bed", label: "Bed" },
            { key: "planted", label: "Planted" },
            { key: "notes", label: "Notes", wide: true },
          ]}
          onChange={(rows) => patch({ planterBeds: rows as unknown as WeeklyUpdateData["planterBeds"] })}
          addLabel="Add planting"
        />
      </SectionCard>

      <SectionCard
        icon={<AlertTriangle className="w-5 h-5" />}
        title="Gaps or Limited Supply"
        description="Pre-filled with limited items and anything chefs had last week that's gone now. Fill in substitutes by hand."
      >
        <RowsEditor
          rows={data.gaps as unknown as Record<string, string>[]}
          fields={[
            { key: "name", label: "Item", wide: true },
            { key: "lastWeek", label: "Last Wk. Avail" },
            { key: "backWhen", label: "Back When" },
            { key: "substitute", label: "Substitute", wide: true },
          ]}
          onChange={(rows) => patch({ gaps: rows as unknown as WeeklyUpdateData["gaps"] })}
          addLabel="Add gap"
        />
      </SectionCard>

      <SectionCard
        icon={<CalendarClock className="w-5 h-5" />}
        title="Items Incoming Timeline"
        description="Pre-filled from the crop plan forecast. Comma-separate the items in each window."
      >
        <div className="space-y-3">
          {data.incoming.map((group, gi) => (
            <div key={gi}>
              <label className="block text-[10px] uppercase tracking-wider text-farm-muted mb-0.5">
                Window label
              </label>
              <div className="flex gap-2 mb-1.5">
                <input
                  type="text"
                  value={group.label}
                  onChange={(e) =>
                    patch({
                      incoming: data.incoming.map((g, i) =>
                        i === gi ? { ...g, label: e.target.value } : g,
                      ),
                    })
                  }
                  className="input-field py-1.5 text-sm w-32"
                />
                <input
                  type="text"
                  value={group.items.join(", ")}
                  onChange={(e) =>
                    patch({
                      incoming: data.incoming.map((g, i) =>
                        i === gi
                          ? { ...g, items: e.target.value.split(",").map((s) => s.trimStart()) }
                          : g,
                      ),
                    })
                  }
                  placeholder="Snap Peas, Cucumbers"
                  className="input-field py-1.5 text-sm flex-1"
                />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        icon={<Users className="w-5 h-5" />}
        title="Recipients"
        description="Only the people picked here get the update. Check the chef accounts that should see it and add any other addresses."
      >
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
      </SectionCard>

      <button
        onClick={() => saveDraft()}
        disabled={saving}
        className="btn-primary w-full flex items-center justify-center gap-2"
      >
        {saved ? (
          <><Check className="w-4 h-4" /> Draft Saved</>
        ) : saving ? (
          "Saving..."
        ) : (
          <><Save className="w-4 h-4" /> Save Draft</>
        )}
      </button>
      <p className="text-xs text-farm-muted -mt-3 text-center">
        The saved draft is what Monday&apos;s automatic send uses. Unsaved edits stay on this
        screen only.
      </p>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-farm-green text-white flex items-center justify-center">
            <Send className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Send</h2>
            <p className="text-xs text-farm-muted">
              Sends exactly what&apos;s on this screen (it saves the draft first). If you send
              manually, Monday&apos;s automatic send skips this week — no duplicates.
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
