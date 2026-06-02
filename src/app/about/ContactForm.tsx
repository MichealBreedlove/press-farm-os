"use client";

import { useState } from "react";

const eyebrowFont = {
  fontFamily: "'Bank Gothic LT', 'BankGothic Lt BT', 'Bank Gothic', sans-serif",
};

const fieldClass =
  "w-full min-h-[44px] rounded-lg bg-white/10 border border-pf-master-gold/30 px-3.5 py-2.5 text-sm text-farm-cream placeholder-farm-cream/40 focus:outline-none focus:ring-2 focus:ring-pf-master-gold/60 focus:border-transparent";

/**
 * Inquiry form for the /about correspondence card. Posts to /api/contact,
 * which emails the Press Farm inbox. Styled for the dark-green CTA section.
 */
export function ContactForm() {
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setStatus("sending");

    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json.error ?? "Something went wrong. Please try again.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
      form.reset();
    } catch {
      setError("Network error. Please check your connection and try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className="pt-8 max-w-md mx-auto text-center">
        <p className="text-[10px] tracking-[0.22em] uppercase text-pf-master-gold mb-2" style={eyebrowFont}>
          Message sent
        </p>
        <p className="text-farm-cream/80 leading-relaxed">
          Thank you — we&apos;ll be in touch. In the meantime, you can also reach us at{" "}
          <a href="mailto:PressFarm@PressNapaValley.com" className="text-farm-cream underline">
            PressFarm@PressNapaValley.com
          </a>
          .
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="pt-8 max-w-md mx-auto text-left space-y-3">
      {/* Honeypot — visually hidden, off-tab. Bots fill it; humans don't. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="company">Company</label>
        <input id="company" name="company" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label htmlFor="contact-name" className="sr-only">Your name</label>
          <input id="contact-name" name="name" type="text" required placeholder="Your name" maxLength={120} className={fieldClass} autoComplete="name" />
        </div>
        <div>
          <label htmlFor="contact-email" className="sr-only">Email</label>
          <input id="contact-email" name="email" type="email" required placeholder="you@restaurant.com" maxLength={200} className={fieldClass} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
        </div>
      </div>

      <div>
        <label htmlFor="contact-restaurant" className="sr-only">Restaurant (optional)</label>
        <input id="contact-restaurant" name="restaurant" type="text" placeholder="Restaurant (optional)" maxLength={160} className={fieldClass} autoComplete="organization" />
      </div>

      <div>
        <label htmlFor="contact-message" className="sr-only">Message</label>
        <textarea id="contact-message" name="message" required placeholder="Tell us what you're after…" maxLength={2000} rows={4} className={`${fieldClass} resize-y`} />
      </div>

      {error && (
        <p className="text-sm text-pf-master-yellow bg-white/5 rounded-lg px-3.5 py-2.5 border border-pf-master-yellow/30">
          {error}
        </p>
      )}

      <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
        <button
          type="submit"
          disabled={status === "sending"}
          className="login-cta inline-flex items-center disabled:opacity-60"
          style={{ background: "#faf7f0", color: "#0D2A1E" }}
        >
          {status === "sending" ? "Sending…" : "Send us a note"}
        </button>
      </div>
    </form>
  );
}
