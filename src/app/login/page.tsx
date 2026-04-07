"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const BANK_GOTHIC: React.CSSProperties = {
  fontFamily: "'BankGothic Lt BT', 'Bank Gothic', Arial, sans-serif",
};

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
      <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#212326" }}>
        <div className="w-full max-w-xs text-center space-y-6">
          <div>
            <h1 className="text-2xl font-normal tracking-[0.35em] uppercase text-white" style={BANK_GOTHIC}>
              PRESS FARM
            </h1>
            <div className="mt-3 h-px bg-white/15" />
          </div>
          <div className="space-y-3">
            <p className="text-xs tracking-[0.2em] uppercase text-white/50">Check your email</p>
            <p className="text-sm text-white/70 leading-relaxed">
              We sent a sign-in link to<br />
              <span className="text-white">{email}</span>
            </p>
          </div>
          <button
            onClick={() => { setSent(false); setEmail(""); }}
            className="text-xs tracking-[0.15em] uppercase text-white/40 hover:text-white/70 transition-colors min-h-0"
          >
            Use a different email
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6" style={{ backgroundColor: "#212326" }}>
      <div className="w-full max-w-xs space-y-10">

        {/* Wordmark */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-normal tracking-[0.35em] uppercase text-white" style={BANK_GOTHIC}>
            PRESS FARM
          </h1>
          <div className="flex items-center gap-4">
            <div className="h-px flex-1 bg-white/20" />
            <span className="text-[9px] tracking-[0.3em] uppercase text-white/40">
              Kitchen Portal
            </span>
            <div className="h-px flex-1 bg-white/20" />
          </div>
        </div>

        {/* Form */}
        <div className="space-y-5">
          {/* Mode toggle */}
          <div className="flex border border-white/15 rounded-sm overflow-hidden">
            {(["magic", "password"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`flex-1 py-2.5 text-xs tracking-[0.15em] uppercase transition-all min-h-0 ${
                  mode === m
                    ? "bg-white/10 text-white"
                    : "text-white/35 hover:text-white/60"
                }`}
              >
                {m === "magic" ? "Magic Link" : "Password"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] tracking-[0.2em] uppercase text-white/50">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pressfarm.app"
                className="w-full bg-transparent border-b border-white/20 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/60 transition-colors"
                style={{ fontSize: "16px" }}
              />
            </div>

            {mode === "password" && (
              <div className="space-y-1.5">
                <label className="block text-[10px] tracking-[0.2em] uppercase text-white/50">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-transparent border-b border-white/20 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-white/60 transition-colors"
                  style={{ fontSize: "16px" }}
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400 border border-red-400/30 px-3 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 text-xs tracking-[0.2em] uppercase border border-white/30 text-white hover:bg-white hover:text-[#212326] transition-all disabled:opacity-40 min-h-0"
            >
              {loading ? "…" : mode === "magic" ? "Send Link" : "Sign In"}
            </button>
          </form>

          {mode === "magic" && (
            <p className="text-[10px] text-white/30 text-center tracking-wide">
              We&apos;ll email you a sign-in link
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="text-center text-[9px] tracking-[0.25em] uppercase text-white/20">
          Yountville · California
        </p>
      </div>
    </main>
  );
}
