"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PressFarmLogo } from "@/components/shared/PressFarmLogo";

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
      <main className="login-bg min-h-screen flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="login-card text-center px-8 py-12 sm:px-12 sm:py-14 space-y-8">
            <PressFarmLogo size="lg" />

            <div className="login-divider" />

            <div className="space-y-3">
              <p className="login-eyebrow text-farm-green">Check your inbox</p>
              <p className="text-sm text-farm-muted leading-relaxed">
                We sent a sign-in link to
                <br />
                <strong className="text-farm-dark">{email}</strong>
              </p>
            </div>

            <button
              onClick={() => { setSent(false); setEmail(""); }}
              className="login-link"
            >
              Use a different email
            </button>
          </div>

          <p className="login-footer">Yountville · California · Est. 2024</p>
        </div>
      </main>
    );
  }

  return (
    <main className="login-bg min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="login-card px-8 py-12 sm:px-12 sm:py-14 space-y-8">

          {/* Hero lockup */}
          <div className="text-center">
            <PressFarmLogo size="lg" />
          </div>

          {/* Mode toggle */}
          <div className="login-tabs">
            {(["magic", "password"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                className={`login-tab ${mode === m ? "is-active" : ""}`}
              >
                {m === "magic" ? "Magic Link" : "Password"}
              </button>
            ))}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="login-label">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pressfarm.io"
                className="login-input"
                autoComplete="email"
              />
            </div>

            {mode === "password" && (
              <div>
                <label htmlFor="password" className="login-label">Password</label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="login-input"
                  autoComplete="current-password"
                />
              </div>
            )}

            {error && (
              <p className="text-sm text-red-700 bg-red-50/70 rounded-lg px-4 py-3 border border-red-100/80">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="login-cta">
              {loading
                ? "Sending…"
                : mode === "magic" ? "Send Sign-In Link" : "Sign In"}
            </button>
          </form>

          {mode === "magic" && (
            <p className="text-[11px] tracking-wide text-center text-farm-muted/80">
              No password — we&apos;ll email you a one-tap link
            </p>
          )}
        </div>

        <p className="login-footer">Yountville · California · Est. 2024</p>
      </div>
    </main>
  );
}
