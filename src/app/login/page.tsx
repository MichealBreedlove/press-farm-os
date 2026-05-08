"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PressFarmLogo } from "@/components/shared/PressFarmLogo";

/**
 * /login — Single email + password sign-in for restaurant accounts +
 * the receiver + admin. Magic-link was removed once we moved to shared
 * per-restaurant accounts: kitchens don't share an inbox to click email
 * links, so password is the practical option.
 */
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <main className="login-bg min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="login-card px-8 py-12 sm:px-12 sm:py-14 space-y-8">
          <div className="text-center">
            <PressFarmLogo size="lg" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="login-label">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="press@pressnapavalley.com"
                className="login-input"
                autoComplete="email"
              />
            </div>

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

            {error && (
              <p className="text-sm text-red-700 bg-red-50/70 rounded-lg px-4 py-3 border border-red-100/80">
                {error}
              </p>
            )}

            <button type="submit" disabled={loading} className="login-cta">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-[11px] tracking-wide text-center text-farm-muted/80">
            Trouble signing in? Contact Press Farm.
          </p>
        </div>

        <p className="login-footer">Yountville · California · Est. 2024</p>
      </div>
    </main>
  );
}
