"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PressFarmLogo } from "@/components/shared/PressFarmLogo";

interface Restaurant {
  id: string;
  name: string;
}

interface Props {
  restaurants: Restaurant[];
}

export function SignupForm({ restaurants }: Props) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Live password validation — surface mismatches as the chef types rather
  // than only on submit.
  const passwordTooShort = password.length > 0 && password.length < 8;
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword;
  const canSubmit =
    !loading &&
    restaurants.length > 0 &&
    password.length >= 8 &&
    password === confirmPassword;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          password,
          full_name: fullName.trim(),
          restaurant_id: restaurantId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Couldn't create your account.");

      // Sign in immediately and land in the order portal.
      const supabase = createClient();
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) {
        setError(`Account created, but sign-in failed: ${signInErr.message}. Try signing in from the login page.`);
        setLoading(false);
        return;
      }
      window.location.href = "/order";
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <main className="login-bg min-h-screen flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="login-card px-8 py-10 sm:px-12 sm:py-12 space-y-7">
          <div className="text-center">
            <PressFarmLogo size="lg" />
            <p className="mt-4 text-[11px] tracking-[0.18em] uppercase text-farm-muted/80">
              Create a chef account
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="full_name" className="login-label">Full name</label>
              <input
                id="full_name"
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="login-input"
                autoComplete="name"
              />
            </div>

            <div>
              <label htmlFor="email" className="login-label">Email</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@restaurant.com"
                className="login-input"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
            </div>

            <div>
              <label htmlFor="restaurant" className="login-label">Restaurant</label>
              {restaurants.length === 0 ? (
                <p className="text-sm text-red-700 bg-red-50/70 rounded-lg px-4 py-3 border border-red-100/80">
                  No restaurants available yet. Contact Press Farm.
                </p>
              ) : (
                <select
                  id="restaurant"
                  required
                  aria-label="Select your restaurant"
                  value={restaurantId}
                  onChange={(e) => setRestaurantId(e.target.value)}
                  className="login-input"
                >
                  {restaurants.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              )}
              <p className="mt-1.5 text-[11px] tracking-wide text-farm-muted/80">
                Event items will appear in your order form automatically.
              </p>
            </div>

            <div>
              <label htmlFor="password" className="login-label">Password</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="login-input"
                autoComplete="new-password"
                aria-invalid={passwordTooShort}
              />
              {passwordTooShort && (
                <p className="mt-1.5 text-[11px] text-amber-700">Use at least 8 characters.</p>
              )}
            </div>

            <div>
              <label htmlFor="confirm_password" className="login-label">Confirm password</label>
              <input
                id="confirm_password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="login-input"
                autoComplete="new-password"
                aria-invalid={passwordsMismatch}
              />
              {passwordsMismatch && (
                <p className="mt-1.5 text-[11px] text-amber-700">Passwords don&apos;t match yet.</p>
              )}
              {!passwordsMismatch && confirmPassword.length > 0 && password.length >= 8 && (
                <p className="mt-1.5 text-[11px] text-farm-green">Passwords match.</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-red-700 bg-red-50/70 rounded-lg px-4 py-3 border border-red-100/80">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="login-cta"
            >
              {loading ? "Creating account…" : "Create Account"}
            </button>
          </form>

          <p className="text-[11px] tracking-wide text-center text-farm-muted/80">
            Already have an account?{" "}
            <Link href="/login" className="underline hover:text-farm-dark">
              Sign in
            </Link>
          </p>
        </div>

        <p className="login-footer">Yountville · California · Est. 2024</p>
      </div>
    </main>
  );
}
