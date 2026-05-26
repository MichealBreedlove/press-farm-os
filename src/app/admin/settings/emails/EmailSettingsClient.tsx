"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save, Check, Send, Loader2, Sprout } from "lucide-react";

const EMAIL_FIELDS = [
  {
    key: "email_labor_report",
    label: "Labor / Timesheet Email",
    description: "Recipient of the weekly labor timesheet — sent when you tap 'Send Timesheet' on /admin/labor. Update this if a different supervisor needs the report.",
    placeholder: "supervisor@pressnapavalley.com",
  },
  {
    key: "email_availability_updates",
    label: "Availability Updates",
    description: "Receives availability and offer sheet update emails",
    placeholder: "kitchen@example.com",
  },
  {
    key: "email_order_notifications",
    label: "Order Notifications",
    description: "Receives notifications when chefs submit orders",
    placeholder: "orders@pressfarm.app",
  },
  {
    key: "email_receiver",
    label: "Receiver Email",
    description: "Override for the receiver-daily handoff email. Leave blank to send to whatever address the receiver account uses.",
    placeholder: "receiver@pressnapavalley.com",
  },
  {
    key: "email_admin",
    label: "Admin Email",
    description: "Primary admin email for the farm",
    placeholder: "micheal@pressfarm.app",
  },
  {
    key: "email_partner_report",
    label: "Partner / Chef Phil Report",
    description: "Recipient of the monthly + quarterly partner report — value of produce delivered, top crops, and a preview of what's coming. Leave blank to skip these sends.",
    placeholder: "phil@example.com",
  },
  {
    key: "email_partner_name",
    label: "Partner Display Name",
    description: "Greeting name used in the partner report (e.g. \"Phil\" → \"Hello Chef Phil\"). Defaults to Phil if blank.",
    placeholder: "Phil",
  },
];

export function EmailSettingsClient({ settings, farmId }: { settings: Record<string, string>; farmId: string }) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const f of EMAIL_FIELDS) init[f.key] = settings[f.key] ?? "";
    return init;
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  async function sendNow(
    kind: "forecast" | "partner-monthly" | "partner-quarterly",
  ) {
    setSending(kind);
    setSendResult(null);
    try {
      let res: Response;
      if (kind === "forecast") {
        res = await fetch("/api/availability/forecast-email", { method: "POST" });
      } else {
        res = await fetch("/api/reports/partner-report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ period: kind === "partner-quarterly" ? "quarterly" : "monthly" }),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendResult({ kind: "err", msg: data?.error || "Send failed." });
      } else if (data?.skipped || data?.results?.monthly?.skipped) {
        setSendResult({ kind: "err", msg: data?.message || data?.results?.monthly?.message || "Skipped — no recipient configured." });
      } else if (kind === "forecast") {
        setSendResult({ kind: "ok", msg: `Forecast sent to ${data?.emailsSent ?? 0} chef${data?.emailsSent === 1 ? "" : "s"}.` });
      } else {
        setSendResult({ kind: "ok", msg: `${kind === "partner-quarterly" ? "Quarterly" : "Monthly"} partner report sent to ${data?.to ?? "partner"}.` });
      }
    } catch (err) {
      setSendResult({ kind: "err", msg: String(err) });
    }
    setSending(null);
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ farm_id: farmId, settings: form }),
    });
    if (res.ok) {
      setSaved(true);
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <div className="space-y-6">
      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Email Addresses</h2>
            <p className="text-xs text-farm-muted">Configure where different types of emails are sent</p>
          </div>
        </div>

        <div className="space-y-4">
          {EMAIL_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-farm-dark mb-0.5">{field.label}</label>
              <p className="text-xs text-farm-muted mb-1.5">{field.description}</p>
              <input
                type={field.key === "email_partner_name" ? "text" : "email"}
                value={form[field.key]}
                onChange={(e) => set(field.key, e.target.value)}
                placeholder={field.placeholder}
                className="input-field"
              />
            </div>
          ))}
        </div>
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
          <><Save className="w-4 h-4" /> Save Email Settings</>
        )}
      </button>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-farm-green text-white flex items-center justify-center">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Send Now</h2>
            <p className="text-xs text-farm-muted">
              Trigger a send immediately. These also run on schedule (forecast weekly; partner report
              monthly + at the start of each quarter).
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

        <div className="space-y-2">
          <button
            onClick={() => sendNow("forecast")}
            disabled={sending !== null}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            {sending === "forecast" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Availability Forecast to Chefs
          </button>
          <button
            onClick={() => sendNow("partner-monthly")}
            disabled={sending !== null}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            {sending === "partner-monthly" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Monthly Partner Report
          </button>
          <button
            onClick={() => sendNow("partner-quarterly")}
            disabled={sending !== null}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            {sending === "partner-quarterly" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send Quarterly Partner Report
          </button>
        </div>
      </div>
    </div>
  );
}
