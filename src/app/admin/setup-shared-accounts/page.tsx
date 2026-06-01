"use client";

import { useState } from "react";

/**
 * /admin/setup-shared-accounts — One-time provisioning page used at
 * production cutover. Wipes every non-admin auth.users row, then creates
 * the 5 shared restaurant/receiver accounts with usernames + passwords
 * the admin picks here.
 *
 * Visible to admins only (the API endpoint double-checks the role).
 * Destructive: every submit wipes and recreates from scratch.
 */
const USERNAMES = ["press", "understudy", "pressbar", "events", "receiver"] as const;
type Username = (typeof USERNAMES)[number];

const LABELS: Record<Username, string> = {
  press: "Press",
  understudy: "Under-Study",
  pressbar: "Press Bar",
  events: "Events",
  receiver: "Receiver",
};

export default function SetupSharedAccountsPage() {
  const [passwords, setPasswords] = useState<Record<Username, string>>({
    press: "",
    understudy: "",
    pressbar: "",
    events: "",
    receiver: "",
  });
  const [confirm, setConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const allFilled = USERNAMES.every((u) => passwords[u].length >= 6);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/setup-shared-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passwords }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Setup failed");
        setSubmitting(false);
        return;
      }
      setResult(json);
    } catch (e: any) {
      setError(e?.message ?? "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <main className="min-h-screen bg-farm-cream pb-32">
        <header className="page-header">
          <h1 className="page-title">Accounts Provisioned</h1>
          <p className="text-sm text-white/70">Save these credentials. You won&apos;t see them again.</p>
        </header>
        <div className="px-4 py-5 space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
            <p className="text-sm text-emerald-800">
              Wiped {result.deleted_count} non-admin user{result.deleted_count === 1 ? "" : "s"}. Created{" "}
              {result.created.length} fresh account{result.created.length === 1 ? "" : "s"}.
            </p>
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-50">
              <p className="section-eyebrow with-flower text-farm-muted">Login credentials</p>
            </div>
            <ul className="divide-y divide-gray-50">
              {result.created.map((a: any) => (
                <li key={a.username} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold text-farm-dark">{LABELS[a.username as Username] ?? a.username}</p>
                    {a.restaurant && (
                      <span className="text-[10px] uppercase tracking-wide text-farm-muted">→ {a.restaurant}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs">
                    <span className="text-farm-muted">username</span>
                    <code className="font-mono bg-farm-cream/70 px-1.5 py-0.5 rounded">{a.username}</code>
                    <span className="text-farm-muted ml-2">password</span>
                    <code className="font-mono bg-farm-cream/70 px-1.5 py-0.5 rounded">{passwords[a.username as Username]}</code>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-farm-muted text-center px-2 leading-relaxed">
            These accounts log in at <code className="text-farm-dark">/login</code> with the username field
            (no @ needed). Internally they&apos;re mapped to <code className="text-farm-dark">username@accounts.pressfarm.app</code>{" "}
            so Supabase Auth has an email under the hood — chefs never see it.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-farm-cream pb-32">
      <header className="page-header">
        <h1 className="page-title">Set Up Shared Accounts</h1>
        <p className="text-sm text-white/70">Production cutover — destructive</p>
      </header>

      <div className="px-4 py-5 space-y-4">
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-semibold text-red-800">⚠ This wipes every non-admin user</p>
          <p className="text-xs text-red-700 mt-1 leading-relaxed">
            Every chef / receiver / test account currently in Supabase Auth will be deleted, along
            with their orders and history (CASCADE). Your admin login is preserved. Run this only
            once at production cutover.
          </p>
        </div>

        <div className="card px-4 py-4 space-y-4">
          <p className="section-eyebrow with-flower text-farm-muted">Pick a password for each account</p>
          {USERNAMES.map((u) => (
            <div key={u}>
              <label className="form-label flex items-baseline justify-between">
                <span>{LABELS[u]}</span>
                <code className="text-[10px] font-mono text-farm-muted">username: {u}</code>
              </label>
              <input
                type="text"
                value={passwords[u]}
                onChange={(e) => setPasswords({ ...passwords, [u]: e.target.value })}
                placeholder="At least 6 characters"
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="w-full border border-farm-dark/10 rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-farm-green font-mono"
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <label className="flex items-start gap-3 text-sm text-farm-dark/80 px-1">
          <input
            type="checkbox"
            checked={confirm}
            onChange={(e) => setConfirm(e.target.checked)}
            className="mt-1 h-5 w-5"
          />
          <span>
            I understand this will delete every non-admin user and replace them with the 5 shared accounts above.
          </span>
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!allFilled || !confirm || submitting}
          className="w-full bg-red-700 hover:bg-red-800 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {submitting ? "Wiping + provisioning…" : "Wipe and provision"}
        </button>
      </div>
    </main>
  );
}
