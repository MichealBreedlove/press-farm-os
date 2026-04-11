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

export function UsersClient({ users, restaurants, currentUserId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showInvite, setShowInvite] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", restaurant_id: restaurants[0]?.id ?? "" });
  const [inviting, setInviting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Invite failed");
      setSuccess(`Invite sent to ${form.email}`);
      setForm({ email: "", full_name: "", restaurant_id: restaurants[0]?.id ?? "" });
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

  async function handleResetPassword(userId: string) {
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setResetting(true);
    setError(null);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to reset password");
      setSuccess("Password updated successfully");
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

  return (
    <div className="space-y-4">
      {/* Success banner */}
      {success && (
        <div className="bg-farm-green-light border border-farm-green/20 rounded-xl px-4 py-3 text-sm text-farm-green flex justify-between">
          {success}
          <button onClick={() => setSuccess(null)} className="text-farm-green/60 hover:text-farm-green">✕</button>
        </div>
      )}

      {/* Invite button */}
      <button
        onClick={() => { setShowInvite((v) => !v); setError(null); }}
        className="w-full min-h-[44px] bg-gray-900 text-white rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        {showInvite ? "Cancel" : "+ Invite Chef"}
      </button>

      {/* Invite form */}
      {showInvite && (
        <form onSubmit={handleInvite} className="card p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Invite Chef</h3>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              placeholder="Chef's full name"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="chef@restaurant.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Restaurant</label>
            <select
              value={form.restaurant_id}
              onChange={(e) => setForm((f) => ({ ...f, restaurant_id: e.target.value }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {restaurants.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={inviting}
            className="btn-primary w-full min-h-[44px] text-sm font-medium disabled:opacity-50"
          >
            {inviting ? "Sending invite…" : "Send Magic Link Invite"}
          </button>
        </form>
      )}

      {/* Admins */}
      {admins.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Admin</h2>
          {admins.map((u) => (
            <div key={u.id} className="card p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.full_name ?? "Admin"}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
              </div>
              <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full flex-shrink-0">Admin</span>
            </div>
          ))}
        </div>
      )}

      {/* Chefs */}
      <div>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Chefs ({chefs.length})
        </h2>
        <div className="space-y-2">
          {chefs.map((u) => (
            <div
              key={u.id}
              className={`bg-white rounded-xl border p-4 transition-opacity ${
                u.is_active ? "border-gray-100" : "border-gray-100 opacity-50"
              }`}
            >
              <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.full_name ?? "(No name)"}</p>
                <p className="text-xs text-gray-400 truncate">{u.email}</p>
                {u.restaurants.length > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">{u.restaurants.join(", ")}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={u.is_active ? "badge-green" : "badge-gray"}>
                  {u.is_active ? "Active" : "Inactive"}
                </span>
                {u.id !== currentUserId && (
                  <>
                    <button
                      onClick={() => {
                        setResetUserId(resetUserId === u.id ? null : u.id);
                        setNewPassword("");
                        setError(null);
                      }}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xs text-gray-400 hover:text-gray-700"
                    >
                      {resetUserId === u.id ? "Cancel" : "Reset Pw"}
                    </button>
                    <button
                      onClick={() => handleToggle(u)}
                      disabled={toggling === u.id || isPending}
                      className="min-w-[44px] min-h-[44px] flex items-center justify-center text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
                    >
                      {toggling === u.id ? "…" : u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </>
                )}
              </div>
              </div>
              {resetUserId === u.id && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="New password (min 8 chars)"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                  <button
                    onClick={() => handleResetPassword(u.id)}
                    disabled={resetting}
                    className="min-h-[44px] px-4 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {resetting ? "…" : "Set"}
                  </button>
                </div>
              )}
            </div>
          ))}
          {chefs.length === 0 && (
            <p className="text-center text-sm text-gray-400 py-6">No chefs yet. Invite one above.</p>
          )}
        </div>
      </div>

      {error && !showInvite && <p className="text-xs text-red-600 text-center">{error}</p>}
    </div>
  );
}
