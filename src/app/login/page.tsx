"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Leaf } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    if (mode === "magic") {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) setError(error.message);
      else setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else window.location.href = "/";
    }
    setLoading(false);
  }

  if (sent) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-farm-cream px-6">
        <div className="w-full max-w-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-farm-green-light flex items-center justify-center mx-auto">
            <Leaf className="w-7 h-7 text-farm-green" />
          </div>
          <h2 className="text-xl font-semibold text-farm-dark">Check your email</h2>
          <p className="text-farm-muted text-sm leading-relaxed">
            We sent a sign-in link to<br />
            <strong className="text-farm-dark">{email}</strong>
          </p>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="text-sm text-farm-muted underline underline-offset-2 mt-2 min-h-0"
          >
            Use a different email
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-farm-cream px-6">
      <div className="w-full max-w-sm space-y-8">
        {/* Wordmark */}
        <div className="text-center">
          <h1
            className="text-3xl font-normal tracking-[0.35em] uppercase text-black"
            style={{ fontFamily: "'BankGothic Lt BT', 'Bank Gothic', Arial, sans-serif" }}
          >
            PRESS FARM
          </h1>
          <div className="flex items-center justify-center gap-3 mt-3">
            <div className="h-px flex-1 bg-black/15" />
            <p className="text-[9px] tracking-[0.3em] uppercase text-black/40 font-sans">
              Kitchen Portal
            </p>
            <div className="h-px flex-1 bg-black/15" />
          </div>
        </div>

        {/* Card */}
        <div className="card p-6 space-y-5">
          {/* Tab toggle */}
          <div className="flex rounded-xl bg-gray-50 border border-gray-100 p-1 gap-1">
            {(["magic", "password"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all min-h-0 ${
                  mode === m
                    ? "bg-white text-farm-dark shadow-sm border border-gray-100"
                    : "text-farm-muted hover:text-farm-dark"
                }`}
              >
                {m === "magic" ? "Magic Link" : "Password"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-farm-dark mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pressfarm.app"
                className="input-field"
              />
            </div>

            {mode === "password" && (
              <div>
                <label className="block text-sm font-medium text-farm-dark mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl px-4 py-3 border border-red-100">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "…" : mode === "magic" ? "Send Magic Link" : "Sign In"}
            </button>
          </form>

          {mode === "magic" && (
            <p className="text-xs text-farm-muted text-center">
              We&apos;ll send a sign-in link — no password needed
            </p>
          )}
        </div>

        <p className="text-center text-xs text-farm-muted/60">
          Press Farm · Yountville, CA
        </p>
      </div>
    </main>
  );
}
