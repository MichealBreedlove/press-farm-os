"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface UserRow {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  is_active: boolean;
  restaurants: string[];
}

interface Restaurant {
  id: string;
  name: string;
}

interface Props {
  users: UserRow[];
  restaurants: Restaurant[];
  currentUserId: string;
}

const SHARED_DOMAIN = "@accounts.pressfarm.app";
const isSharedAccount = (email: string) => email.toLowerCase().endsWith(SHARED_DOMAIN);

export function UsersClient({ users, restaurants, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", restaurant_id: restaurants[0]?.id ?? "", role: "chef", password: "" });
  const [inviting, setInviting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [welcomingId, setWelcomingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // The temporary password to surface ONCE after create / generated reset.
  const [tempCredential, setTempCredential] = useState<{ email: string; password: string; label: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy — select and copy the password manually.");
    }
  }

  async function handleSendWelcome(user: UserRow) {
    setWelcomingId(user.id);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/users/${user.id}/welcome`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to send");
      setSuccess(`Welcome email sent to ${json.sent_to}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWelcomingId(null);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(null);
    setTempCredential(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Account creation failed");
      // Surface the password once so the admin can share it securely. We always
      // get one back (admin-supplied or generated); show it either way.
      setTempCredential({
        email: json.email ?? form.email,
        password: json.password,
        label: json.generated ? "Generated password" : "Password",
      });
      setSuccess(`Account created for ${json.email ?? form.email}`);
      setForm({ email: "", full_name: "", restaurant_id: restaurants[0]?.id ?? "", role: "chef", password: "" });
      setShowInvite(false);
      startTransition(() => router.refresh());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setInviting(false);
    }
  }

  async function handleToggle(user: UserRow) {
    setToggling(user.id);
    setError(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !user.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      startTransition(() => router.refresh());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setToggling(null);
    }
  }

  // mode "set": admin typed a password. mode "generate": server mints + returns one.
  async function handleResetPassword(user: UserRow, mode: "set" | "generate") {
    if (mode === "set" && newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setResetting(true);
    setError(null);
    setSuccess(null);
    setTempCredential(null);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "generate" ? { generate_password: true } : { password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to reset password");
      if (json.password) {
        setTempCredential({ email: user.email, password: json.password, label: "Generated password" });
        setSuccess(`New password generated for ${user.email}`);
      } else {
        setSuccess("Password updated successfully");
      }
      setResetUserId(null);
      setNewPassword("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setResetting(false);
    }
  }

  const chefs = users.filter((u) => u.role === "chef");
  const admins = users.filter((u) => u.role === "admin");
  const receivers = users.filter((u) => u.role === "receiver");

  return (
    <div className="space-y-4">
      {/* Success banner */}
      {success && (
        <div className="bg-farm-green-light border border-farm-green/20 rounded-xl px-4 py-3 text-sm text-farm-green flex justify-between">
          {success}
          <button onClick={() => setSuccess(null)} className="text-farm-green/60 hover:text-farm-green">✕</button>
        </div>
      )}

      {/* Temporary-password callout — shown ONCE after create / generated reset.
          The admin shares this securely (text/voice/in person), not by email. */}
      {tempCredential && (
        <div className="bg-pf-master-blue/[0.06] border border-pf-master-blue/25 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-farm-dark">Share this password once</p>
              <p className="text-xs text-farm-muted mt-0.5 leading-relaxed">
                Send it securely (text, voice, or in person) — not by email. It won&apos;t be shown again.
                Ask {tempCredential.email} to change it after their first sign-in.
              </p>
            </div>
            <button
              onClick={() => { setTempCredential(null); setCopied(false); }}
              className="text-pf-master-blue/60 hover:text-pf-master-blue min-w-[32px] min-h-[32px] flex items-center justify-center flex-shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <div className="bg-white border border-pf-master-blue/15 rounded-lg p-3 space-y-2">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-farm-muted">Email</p>
              <p className="text-sm font-medium text-farm-dark break-all">{tempCredential.email}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-farm-muted">{tempCredential.label}</p>
              <p className="font-mono text-base text-farm-dark break-all select-all">{tempCredential.password}</p>
            </div>
          </div>
          <button
            onClick={() => copyToClipboard(`Email: ${tempCredential.email}\nPassword: ${tempCredential.password}`)}
            className="btn-primary w-full min-h-[44px] text-sm font-medium"
          >
            {copied ? "Copied ✓" : "Copy email + password"}
          </button>
        </div>
      )}

      {/* Create-account button */}
      <button
        onClick={() => { setShowInvite((v) => !v); setError(null); }}
        className={showInvite ? "btn-ghost w-full text-sm" : "btn-primary w-full text-sm"}
      >
        {showInvite ? "Cancel" : "+ Add Chef"}
      </button>

      {/* Create-account form */}
      {showInvite && (
        <form onSubmit={handleInvite} className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-farm-dark">Add Chef</h3>
          <div>
            <label className="block text-xs text-farm-muted mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Chef's full name"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-farm-muted mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="chef@restaurant.com"
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-xs text-farm-muted mb-1">Role</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, role: "chef" }))}
                className={`min-h-[48px] rounded-xl border text-sm font-medium transition-colors text-left px-3 ${
                  form.role === "chef"
                    ? "bg-farm-green text-white border-farm-green shadow-sm"
                    : "bg-white text-farm-dark/80 border-farm-dark/10 hover:border-farm-green/30"
                }`}
              >
                <p className="font-semibold">Chef</p>
                <p className={`text-[11px] mt-0.5 ${form.role === "chef" ? "text-white/80" : "text-farm-muted"}`}>
                  Places orders for one restaurant
                </p>
              </button>
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, role: "receiver" }))}
                className={`min-h-[48px] rounded-xl border text-sm font-medium transition-colors text-left px-3 ${
                  form.role === "receiver"
                    ? "bg-pf-master-violet text-white border-pf-master-violet shadow-sm"
                    : "bg-white text-farm-dark/80 border-farm-dark/10 hover:border-pf-master-violet/30"
                }`}
              >
                <p className="font-semibold">Receiver</p>
                <p className={`text-[11px] mt-0.5 ${form.role === "receiver" ? "text-white/80" : "text-farm-muted"}`}>
                  Sees incoming for both restaurants
                </p>
              </button>
            </div>
          </div>

          {form.role === "chef" && (
            <div>
              <label className="block text-xs text-farm-muted mb-1">Restaurant</label>
              <select
                value={form.restaurant_id}
                onChange={(e) => setForm((f) => ({ ...f, restaurant_id: e.target.value }))}
                className="input-field"
              >
                {restaurants.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <p className="text-[11px] text-farm-muted/80 mt-1.5 leading-relaxed">
                Chefs at any restaurant automatically see the Events Menu in their order form.
              </p>
            </div>
          )}

          {form.role === "receiver" && (
            <p className="text-[11px] text-farm-muted/80 leading-relaxed bg-pf-master-violet/[0.06] border border-pf-master-violet/15 rounded-lg p-3">
              Receivers don&apos;t need a restaurant assignment — they see incoming
              from both Press and Under-Study, plus event items, on a single dashboard.
              Read-only: they can&apos;t place or edit orders.
            </p>
          )}

          <div>
            <label className="block text-xs text-farm-muted mb-1">Password (optional)</label>
            <input
              type="text"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Leave blank to auto-generate"
              className="input-field font-mono"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
            />
            <p className="text-[11px] text-farm-muted/80 mt-1.5 leading-relaxed">
              We&apos;ll show the password once after creating the account so you can
              share it securely. The chef can change it after signing in.
            </p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={inviting}
            className="btn-primary w-full min-h-[44px] text-sm font-medium disabled:opacity-50"
          >
            {inviting ? "Creating account…" : "Create Account"}
          </button>
        </form>
      )}

      {/* Admins */}
      {admins.length > 0 && (
        <div>
          <p className="section-eyebrow with-flower text-farm-muted mb-2">Admin</p>
          {admins.map((u) => (
            <div key={u.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-farm-dark truncate">{u.full_name ?? "Admin"}</p>
                <p className="text-xs text-farm-muted truncate">{u.email}</p>
              </div>
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full flex-shrink-0">Admin</span>
            </div>
          ))}
        </div>
      )}

      {/* Receivers */}
      {receivers.length > 0 && (
        <div>
          <p className="section-eyebrow with-flower text-farm-muted mb-2">
            Receivers ({receivers.length})
          </p>
          <div className="space-y-2">
            {receivers.map((u) => (
              <div key={u.id} className="card p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-farm-dark truncate">{u.full_name ?? "Receiver"}</p>
                    {isSharedAccount(u.email) && <SharedTag />}
                  </div>
                  <p className="text-xs text-farm-muted truncate">{u.email}</p>
                </div>
                <span className="text-xs px-2 py-1 bg-pf-master-violet/[0.12] text-pf-master-violet rounded-full flex-shrink-0 font-semibold">
                  Receiver
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chefs */}
      <div>
        <p className="section-eyebrow with-flower text-farm-muted mb-2">
          Chefs ({chefs.length})
        </p>
        <div className="space-y-2">
          {chefs.map((u) => (
            <div
              key={u.id}
              className={`bg-white rounded-xl border p-4 transition-opacity ${
                u.is_active ? "border-farm-dark/5" : "border-farm-dark/5 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-farm-dark truncate">{u.full_name ?? "(No name)"}</p>
                  {isSharedAccount(u.email) && <SharedTag />}
                </div>
                <p className="text-xs text-farm-muted truncate">{u.email}</p>
                {u.restaurants.length > 0 && (
                  <p className="text-xs text-farm-muted mt-0.5">{u.restaurants.join(", ")}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={u.is_active ? "badge-green" : "badge-gray"}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
                {u.id !== currentUserId && (
                  <>
                    <button
                      onClick={() => handleSendWelcome(u)}
                      disabled={welcomingId === u.id}
                      className="min-h-[44px] px-3 flex items-center justify-center text-xs text-farm-green hover:bg-farm-green-light rounded-lg disabled:opacity-50 transition-colors"
                      title="Send welcome email (points to /login — no password embedded)"
                    >
                      {welcomingId === u.id ? "Sending…" : "📧 Welcome"}
                    </button>
                    <button
                      onClick={() => {
                        setResetUserId(resetUserId === u.id ? null : u.id);
                        setNewPassword("");
                        setError(null);
                      }}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xs text-farm-muted hover:text-farm-dark/80"
                    >
                      {resetUserId === u.id ? "Cancel" : "Reset Pw"}
                    </button>
                    <button
                      onClick={() => handleToggle(u)}
                      disabled={toggling === u.id || isPending}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xs text-farm-muted hover:text-farm-dark/80 disabled:opacity-50"
                    >
                      {toggling === u.id ? "…" : u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </>
                )}
              </div>
              </div>
              {resetUserId === u.id && (
                <div className="mt-3 pt-3 border-t border-farm-dark/5 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="New password (min 8 chars)"
                      className="flex-1 border border-farm-dark/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-farm-green"
                      autoComplete="off"
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />
                    <button
                      onClick={() => handleResetPassword(u, "set")}
                      disabled={resetting}
                      className="min-h-[44px] px-4 bg-farm-green text-white rounded-lg text-sm font-medium hover:bg-farm-green/90 disabled:opacity-50"
                    >
                      {resetting ? "…" : "Set"}
                    </button>
                  </div>
                  <button
                    onClick={() => handleResetPassword(u, "generate")}
                    disabled={resetting}
                    className="w-full min-h-[40px] text-xs text-farm-muted hover:text-farm-dark/80 border border-farm-dark/10 rounded-lg disabled:opacity-50"
                  >
                    {resetting ? "…" : "Generate a new password"}
                  </button>
                </div>
              )}
            </div>
          ))}
          {chefs.length === 0 && (
            <p className="text-center text-sm text-farm-muted py-6">No chefs yet. Invite one above.</p>
          )}
        </div>
      </div>

      {error && !showInvite && <p className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  );
}

/** Small badge marking a legacy SHARED login (e.g. press@accounts.pressfarm.app). */
function SharedTag() {
  return (
    <span
      className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-full font-medium flex-shrink-0"
      title="Legacy shared login — kept working during the move to individual chef accounts"
    >
      shared
    </span>
  );
}

