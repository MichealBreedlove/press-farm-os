"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save, Check, Send, Loader2, Sprout, Inbox } from "lucide-react";

/** Where "Send All Test Emails" routes its sample sends. */
const TEST_EMAIL_RECIPIENT = "mikejohnbreedlove@gmail.com";

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
  const [sendingTests, setSendingTests] = useState(false);
  const [testResult, setTestResult] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  // Quarterly send selector — defaults to the most recent COMPLETED quarter.
  const now = new Date();
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1; // 1–4
  const defaultQuarter = currentQuarter === 1 ? 4 : currentQuarter - 1;
  const defaultQYear = currentQuarter === 1 ? now.getFullYear() - 1 : now.getFullYear();
  const [quarter, setQuarter] = useState<number>(defaultQuarter);
  const [quarterYear, setQuarterYear] = useState<number>(defaultQYear);
  const yearOptions = [now.getFullYear(), now.getFullYear() - 1, now.getFullYear() - 2];

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
          body: JSON.stringify(
            kind === "partner-quarterly"
              ? { period: "quarterly", year: quarterYear, quarter }
              : { period: "monthly" },
          ),
        });
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendResult({ kind: "err", msg: data?.error || "Send failed." });
      } else if (data?.skipped) {
        setSendResult({ kind: "err", msg: data?.message || "Skipped — no recipient configured." });
      } else if (kind === "forecast") {
        setSendResult({ kind: "ok", msg: `Forecast sent to ${data?.emailsSent ?? 0} chef${data?.emailsSent === 1 ? "" : "s"}.` });
      } else {
        const label = data?.periodLabel ? ` (${data.periodLabel})` : "";
        setSendResult({ kind: "ok", msg: `${kind === "partner-quarterly" ? "Quarterly" : "Monthly"} partner report sent to ${data?.to ?? "partner"}${label}.` });
      }
    } catch (err) {
      setSendResult({ kind: "err", msg: String(err) });
    }
    setSending(null);
  }

  async function sendAllTests() {
    setSendingTests(true);
    setTestResult(null);
    try {
      const res = await fetch(
        `/api/test-emails-bulk?to=${encodeURIComponent(TEST_EMAIL_RECIPIENT)}`,
      );
      const data = await res.json().catch(() => ({}));
      const failed = (data?.results ?? []).filter((r: any) => r.status !== "sent");
      if (!res.ok || (data?.failed ?? 0) > 0) {
        const labels = failed.map((r: any) => r.template).join(", ");
        setTestResult({
          kind: "err",
          msg: data?.error || `Sent ${data?.succeeded ?? 0}/${data?.total ?? 0}.${labels ? ` Failed: ${labels}.` : ""}`,
        });
      } else {
        setTestResult({
          kind: "ok",
          msg: `Sent all ${data?.succeeded ?? data?.total ?? 0} sample emails to ${data?.sent_to ?? TEST_EMAIL_RECIPIENT}. Subjects are prefixed [SAMPLE].`,
        });
      }
    } catch (err) {
      setTestResult({ kind: "err", msg: String(err) });
    }
    setSendingTests(false);
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
              Trigger a send immediately. These also run on schedule: forecast weekly; the monthly
              report on the 1st; the quarterly report at the end of each quarter (Mar 31 covers
              Jan–Mar, Jun 30 covers Apr–Jun, and so on).
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
          <div className="rounded-lg border border-farm-dark/10 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-farm-muted whitespace-nowrap">Quarter</label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(parseInt(e.target.value, 10))}
                className="input-field flex-1 py-1.5"
              >
                <option value={1}>Q1 · Jan–Mar</option>
                <option value={2}>Q2 · Apr–Jun</option>
                <option value={3}>Q3 · Jul–Sep</option>
                <option value={4}>Q4 · Oct–Dec</option>
              </select>
              <select
                value={quarterYear}
                onChange={(e) => setQuarterYear(parseInt(e.target.value, 10))}
                className="input-field py-1.5"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button
              onClick={() => sendNow("partner-quarterly")}
              disabled={sending !== null}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              {sending === "partner-quarterly" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Q{quarter} {quarterYear} Partner Report
            </button>
          </div>
        </div>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500 text-white flex items-center justify-center">
            <Inbox className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Preview All Templates</h2>
            <p className="text-xs text-farm-muted">
              Sends a sample of every email template — order confirmation, shortage notice,
              availability, receiver handoff, weekly digest, timesheet, partner report, and the
              rest — filled with sample data so you can check that each one renders correctly. The
              chef-facing set goes out once per restaurant. All land at{" "}
              <span className="font-medium text-farm-dark">{TEST_EMAIL_RECIPIENT}</span>; subjects
              are prefixed <span className="font-mono">[SAMPLE]</span>.
            </p>
          </div>
        </div>

        {testResult && (
          <div
            className={`mb-3 rounded-lg px-3 py-2 text-xs ${
              testResult.kind === "ok"
                ? "bg-green-50 text-farm-green border border-green-100"
                : "bg-amber-50 text-amber-800 border border-amber-100"
            }`}
          >
            {testResult.msg}
          </div>
        )}

        <button
          onClick={sendAllTests}
          disabled={sendingTests}
          className="btn-secondary w-full flex items-center justify-center gap-2"
        >
          {sendingTests ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send All Test Emails
        </button>
      </div>
    </div>
  );
}
