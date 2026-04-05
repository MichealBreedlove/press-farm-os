"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      window.location.href = "/";
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-farm-cream px-4">
        <div className="w-full max-w-sm text-center">
          <div className="text-5xl mb-4">📬</div>
          <h1 className="text-xl font-semibold text-farm-green mb-2">Check your email</h1>
          <p className="text-gray-600 text-sm">
            We sent a magic link to <strong>{email}</strong>. Click the link in your email to sign in.
          </p>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="mt-6 text-sm text-farm-green underline"
          >
            Use a different email
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-farm-cream px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🌿</div>
          <h1 className="text-2xl font-semibold text-farm-green">Press Farm OS</h1>
          <p className="text-gray-500 mt-1 text-sm">Farm-to-kitchen ordering</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          {/* Mode tabs */}
          <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("magic"); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "magic"
                  ? "bg-white text-farm-green shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Chef Login
            </button>
            <button
              type="button"
              onClick={() => { setMode("password"); setError(null); }}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === "password"
                  ? "bg-white text-farm-green shadow-sm"
                  : "text-gray-500"
              }`}
            >
              Admin Login
            </button>
          </div>

          {mode === "magic" ? (
            <form onSubmit={handleMagicLink} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="chef@press.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
                />
              </div>
              {error && (
                <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-farm-green text-white py-3 rounded-xl font-medium text-base disabled:opacity-50 active:scale-95 transition-transform"
              >
                {loading ? "Sending..." : "Send Magic Link"}
              </button>
              <p className="text-xs text-gray-400 text-center">
                We&apos;ll email you a secure sign-in link. No password needed.
              </p>
            </form>
          ) : (
            <form onSubmit={handlePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="micheal@pressfarm.app"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-farm-green focus:border-transparent"
                />
              </div>
              {error && (
                <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-farm-green text-white py-3 rounded-xl font-medium text-base disabled:opacity-50 active:scale-95 transition-transform"
              >
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
