"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Save, Check, Send, Loader2, Sprout, Inbox, Newspaper, Plus, X } from "lucide-react";

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

export function EmailSettingsClient({
  settings,
  farmId,
  chefs,
}: {
  settings: Record<string, string>;
  farmId: string;
  chefs: { name: string; email: string }[];
}) {
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

  // Weekly digest recipient list — stored comma-separated in farm_settings
  // under weekly_digest_recipients, managed here as chips.
  const [digestRecipients, setDigestRecipients] = useState<string[]>(() =>
    (settings["weekly_digest_recipients"] ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const [digestInput, setDigestInput] = useState("");
  const [digestInputError, setDigestInputError] = useState<string | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestResult, setDigestResult] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  function addDigestRecipient() {
    const email = digestInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setDigestInputError("That doesn't look like a valid email address.");
      return;
    }
    if (digestRecipients.includes(email)) {
      setDigestInputError("Already on the list.");
      return;
    }
    setDigestRecipients((list) => [...list, email]);
    setDigestInput("");
    setDigestInputError(null);
    setSaved(false);
  }

  function removeDigestRecipient(email: string) {
    setDigestRecipients((list) => list.filter((e) => e !== email));
    setSaved(false);
  }

  // Chef weekly update — general note + hand-picked recipient list, stored in
  // farm_settings under weekly_update_general_note / weekly_update_recipients.
  // ONLY addresses on this list receive the update; chefs are offered as a
  // picker but never auto-included.
  const [updateNote, setUpdateNote] = useState(settings["weekly_update_general_note"] ?? "");
  const [updateRecipients, setUpdateRecipients] = useState<string[]>(() =>
    (settings["weekly_update_recipients"] ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const [updateInput, setUpdateInput] = useState("");
  const [updateInputError, setUpdateInputError] = useState<string | null>(null);
  const [sendingUpdate, setSendingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const chefEmails = new Set(chefs.map((c) => c.email));
  const customRecipients = updateRecipients.filter((e) => !chefEmails.has(e));

  function toggleUpdateRecipient(email: string) {
    setUpdateRecipients((list) =>
      list.includes(email) ? list.filter((e) => e !== email) : [...list, email],
    );
    setSaved(false);
  }

  function addUpdateRecipient() {
    const email = updateInput.trim().toLowerCase();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setUpdateInputError("That doesn't look like a valid email address.");
      return;
    }
    if (updateRecipients.includes(email)) {
      setUpdateInputError("Already on the list.");
      return;
    }
    setUpdateRecipients((list) => [...list, email]);
    setUpdateInput("");
    setUpdateInputError(null);
    setSaved(false);
  }

  function removeUpdateRecipient(email: string) {
    setUpdateRecipients((list) => list.filter((e) => e !== email));
    setSaved(false);
  }

  async function sendWeeklyUpdateNow() {
    setSendingUpdate(true);
    setUpdateResult(null);
    try {
      const res = await fetch("/api/reports/weekly-update", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setUpdateResult({ kind: "err", msg: data?.error || "Send failed — check Resend config." });
      } else {
        const to: string[] = Array.isArray(data?.to) ? data.to : [data?.to].filter(Boolean);
        const failedNote = data?.failed?.length
          ? ` (${data.failed.length} failed: ${data.failed.map((f: { to: string }) => f.to).join(", ")})`
          : "";
        setUpdateResult({
          kind: "ok",
          msg: `Weekly update sent to ${to.length} recipient${to.length === 1 ? "" : "s"}: ${to.join(", ")}.${failedNote}`,
        });
      }
    } catch (err) {
      setUpdateResult({ kind: "err", msg: String(err) });
    }
    setSendingUpdate(false);
  }

  async function sendDigestNow() {
    setSendingDigest(true);
    setDigestResult(null);
    try {
      const res = await fetch("/api/reports/weekly-digest", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        setDigestResult({ kind: "err", msg: data?.error || "Send failed — check Resend config." });
      } else {
        const to: string[] = Array.isArray(data?.to) ? data.to : [data?.to].filter(Boolean);
        const failedNote = data?.failed?.length
          ? ` (${data.failed.length} failed: ${data.failed.map((f: { to: string }) => f.to).join(", ")})`
          : "";
        setDigestResult({ kind: "ok", msg: `Digest sent to ${to.join(", ")}.${failedNote}` });
      }
    } catch (err) {
      setDigestResult({ kind: "err", msg: String(err) });
    }
    setSendingDigest(false);
  }

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
      body: JSON.stringify({
        farm_id: farmId,
        settings: {
          ...form,
          weekly_digest_recipients: digestRecipients.join(","),
          weekly_update_general_note: updateNote,
          weekly_update_recipients: updateRecipients.join(","),
        },
      }),
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

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-farm-green text-white flex items-center justify-center">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Chef Weekly Update</h2>
            <p className="text-xs text-farm-muted">
              The &quot;what&apos;s going on at the farm&quot; email — available now, planter beds,
              gaps &amp; limited supply, and what&apos;s coming. Sends automatically every Monday
              morning — <span className="font-medium text-farm-dark">only to the people you pick
              below</span>.
            </p>
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-farm-dark mb-0.5">General Note</label>
          <p className="text-xs text-farm-muted mb-1.5">
            Shows at the top of the email as bullets — one per line. Update it each week with
            farm news, or leave blank to skip the section.
          </p>
          <textarea
            value={updateNote}
            onChange={(e) => {
              setUpdateNote(e.target.value);
              setSaved(false);
            }}
            rows={3}
            placeholder={"First tomatoes of the season this week\nHeat wave — flowers may run short"}
            className="input-field resize-y"
          />
        </div>

        <label className="block text-sm font-medium text-farm-dark mb-0.5">Recipients</label>
        <p className="text-xs text-farm-muted mb-2">
          Check the chef accounts that should get the update — unchecked chefs won&apos;t receive
          it — and add any other addresses below.
        </p>

        {chefs.length > 0 && (
          <div className="rounded-lg border border-farm-dark/10 divide-y divide-farm-dark/5 mb-3">
            {chefs.map((chef) => (
              <label
                key={chef.email}
                className="flex items-center gap-3 px-3 py-2.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={updateRecipients.includes(chef.email)}
                  onChange={() => toggleUpdateRecipient(chef.email)}
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
                  onClick={() => removeUpdateRecipient(email)}
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
            value={updateInput}
            onChange={(e) => {
              setUpdateInput(e.target.value);
              setUpdateInputError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUpdateRecipient();
              }
            }}
            placeholder="name@example.com"
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={addUpdateRecipient}
            className="btn-secondary flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {updateInputError && (
          <p className="text-xs text-amber-800 mt-1.5">{updateInputError}</p>
        )}

        {updateResult && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs ${
              updateResult.kind === "ok"
                ? "bg-green-50 text-farm-green border border-green-100"
                : "bg-amber-50 text-amber-800 border border-amber-100"
            }`}
          >
            {updateResult.msg}
          </div>
        )}

        <button
          type="button"
          onClick={sendWeeklyUpdateNow}
          disabled={sendingUpdate}
          className="btn-secondary w-full flex items-center justify-center gap-2 mt-3"
        >
          {sendingUpdate ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Weekly Update Now
        </button>
        <p className="text-xs text-farm-muted mt-1.5 text-center">
          Sends only to the saved recipient list — save first if you just changed the note or the
          list.
        </p>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-farm-green text-white flex items-center justify-center">
            <Newspaper className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-sm text-farm-dark">Weekly Digest Recipients</h2>
            <p className="text-xs text-farm-muted">
              Who receives the weekly farm digest — revenue, deliveries, expenses, and labor for
              the past 7 days. Sends automatically every Monday morning; each person gets their own
              copy. If the list is empty it falls back to the admin email.
            </p>
          </div>
        </div>

        {digestRecipients.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {digestRecipients.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1.5 rounded-full bg-green-50 border border-green-100 text-farm-green text-xs px-3 py-1.5"
              >
                {email}
                <button
                  type="button"
                  onClick={() => removeDigestRecipient(email)}
                  aria-label={`Remove ${email}`}
                  className="text-farm-green/60 hover:text-farm-green min-h-0 min-w-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs text-farm-muted mb-3">
            No recipients yet — the digest currently goes to the admin email only.
          </p>
        )}

        <div className="flex gap-2">
          <input
            type="email"
            value={digestInput}
            onChange={(e) => {
              setDigestInput(e.target.value);
              setDigestInputError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addDigestRecipient();
              }
            }}
            placeholder="name@example.com"
            className="input-field flex-1"
          />
          <button
            type="button"
            onClick={addDigestRecipient}
            className="btn-secondary flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        {digestInputError && (
          <p className="text-xs text-amber-800 mt-1.5">{digestInputError}</p>
        )}
        <p className="text-xs text-farm-muted mt-2">
          Remember to tap <span className="font-medium text-farm-dark">Save Email Settings</span>{" "}
          below after changing the list.
        </p>

        {digestResult && (
          <div
            className={`mt-3 rounded-lg px-3 py-2 text-xs ${
              digestResult.kind === "ok"
                ? "bg-green-50 text-farm-green border border-green-100"
                : "bg-amber-50 text-amber-800 border border-amber-100"
            }`}
          >
            {digestResult.msg}
          </div>
        )}

        <button
          type="button"
          onClick={sendDigestNow}
          disabled={sendingDigest}
          className="btn-secondary w-full flex items-center justify-center gap-2 mt-3"
        >
          {sendingDigest ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send Weekly Digest Now
        </button>
        <p className="text-xs text-farm-muted mt-1.5 text-center">
          Sends to the saved list — save first if you just changed it.
        </p>
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
