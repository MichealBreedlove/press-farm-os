"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PressFarmLogo } from "@/components/shared/PressFarmLogo";

/**
 * /login — Username + password sign-in for restaurant accounts +
 * receiver + admin. Restaurant accounts are shared usernames (press,
 * understudy, pressbar, events, receiver). The admin keeps an email-
 * based login. We accept either: if the input contains an "@" we send
 * it to Supabase as-is (admin email); otherwise we transparently map
 * username → "<username>@accounts.pressfarm.app" so Supabase Auth,
 * which requires an email under the hood, still works.
 */
const SYNTHETIC_EMAIL_DOMAIN = "accounts.pressfarm.app";

function toAuthEmail(input: string): string {
  const v = input.trim();
  if (v.includes("@")) return v.toLowerCase();
  // Username path: strip whitespace + non-alphanumeric so "Press Bar" /
  // "press-bar" / "Press_Bar" all resolve to the same canonical account.
  const username = v.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `${username}@${SYNTHETIC_EMAIL_DOMAIN}`;
}

export default function LoginPage() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const email = toAuthEmail(identifier);
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
            <Link href="/about" aria-label="About Press Farm" className="inline-block">
              <PressFarmLogo size="lg" />
            </Link>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="identifier" className="login-label">Email or username</label>
              <input
                id="identifier"
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="you@email.com"
                className="login-input"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <p className="mt-1.5 text-[11px] tracking-wide text-farm-muted/80">
                Chefs sign in with their email address.
              </p>
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center" aria-hidden="true">
              <div className="w-full border-t border-farm-dark/10" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-[10px] tracking-[0.2em] uppercase text-farm-muted/70">
                New here
              </span>
            </div>
          </div>

          <Link
            href="/signup"
            className="block w-full text-center min-h-[52px] py-3.5 rounded-xl border border-farm-dark/15 text-sm font-medium text-farm-dark hover:bg-farm-cream/40 hover:border-farm-dark/25 transition-colors"
          >
            Create a chef account
          </Link>

          <p className="text-[11px] tracking-wide text-center text-farm-muted/80">
            Trouble signing in? Contact Press Farm.
          </p>
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/about"
            className="text-xs tracking-[0.18em] uppercase text-farm-muted/90 hover:text-pf-master-gold transition-colors"
          >
            About Press Farm →
          </Link>
        </div>

        <p className="login-footer">Yountville · California · Est. 2024</p>
      </div>
    </main>
  );
}
