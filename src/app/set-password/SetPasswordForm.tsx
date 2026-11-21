"use client";

import { useEffect, useState } from "react";

type Lang = "en" | "es";
const LANG_KEY = "pf-harvest-lang"; // shared with the Farm Hand portal toggle

const TEXT = {
  en: {
    title: "Choose a new password",
    intro: "Your starter password only works once. Pick your own password to continue.",
    password: "New password",
    again: "Type it again",
    hint: "At least 8 characters. Common passwords are refused — two words and a number work well, like Tomato-Barn-58.",
    save: "Save password",
    saving: "Saving…",
    tooShort: "The password needs at least 8 characters.",
    mismatch: "The two passwords don't match.",
    rejected: "That password can't be used. Try a different one.",
    weak: "That password is too common — it appears on lists of leaked passwords. Try two words and a number, like Tomato-Barn-58.",
    failed: "Couldn't save — try again.",
    show: "Show",
    hide: "Hide",
    language: "Language",
  },
  es: {
    title: "Elija una contraseña nueva",
    intro: "Su contraseña inicial solo sirve una vez. Elija su propia contraseña para continuar.",
    password: "Contraseña nueva",
    again: "Escríbala otra vez",
    hint: "Al menos 8 caracteres. No se aceptan contraseñas comunes — dos palabras y un número funcionan bien, como Tomate-Granero-58.",
    save: "Guardar contraseña",
    saving: "Guardando…",
    tooShort: "La contraseña necesita al menos 8 caracteres.",
    mismatch: "Las dos contraseñas no son iguales.",
    rejected: "Esa contraseña no se puede usar. Pruebe con otra.",
    weak: "Esa contraseña es muy común — aparece en listas de contraseñas filtradas. Pruebe dos palabras y un número, como Tomate-Granero-58.",
    failed: "No se pudo guardar — intente de nuevo.",
    show: "Ver",
    hide: "Ocultar",
    language: "Idioma",
  },
} as const;

/**
 * First-sign-in password form. Bilingual because the first people to see it
 * are the farm hands; `defaultLang` is Spanish for them, English otherwise,
 * and the choice is shared with the Farm Hand portal's own toggle.
 */
export function SetPasswordForm({ defaultLang }: { defaultLang: Lang }) {
  const [lang, setLang] = useState<Lang>(defaultLang);
  useEffect(() => {
    const stored = window.localStorage.getItem(LANG_KEY);
    if (stored === "en" || stored === "es") setLang(stored);
  }, []);
  function pickLang(next: Lang) {
    setLang(next);
    window.localStorage.setItem(LANG_KEY, next);
  }
  const t = TEXT[lang];

  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(t.tooShort);
    if (password !== again) return setError(t.mismatch);
    setSaving(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Full reload so the root router sends them to their portal.
        window.location.href = "/";
        return;
      }
      const j = await res.json().catch(() => ({}));
      setError(j.error === "too_short" ? t.tooShort : j.error === "weak" ? t.weak : j.error === "rejected" ? t.rejected : t.failed);
    } catch {
      setError(t.failed);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full text-base px-3 py-3 border border-farm-dark/15 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-farm-green";

  return (
    <main id="main" lang={lang} className="min-h-screen bg-farm-cream">
      <header className="page-header">
        <div className="flex items-center justify-between gap-3">
          <h1 className="page-title">{t.title}</h1>
          <div className="flex rounded-lg overflow-hidden border border-white/25" role="group" aria-label={t.language}>
            {(["en", "es"] as const).map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => pickLang(code)}
                aria-pressed={lang === code}
                className={`min-h-[44px] min-w-[52px] px-3 text-sm font-bold uppercase tracking-wide transition-colors ${
                  lang === code ? "bg-white text-farm-green" : "text-white/80 hover:text-white"
                }`}
              >
                {code.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </header>

      <form onSubmit={submit} className="px-4 py-6 max-w-md mx-auto space-y-4">
        <p className="text-base text-farm-dark leading-relaxed">{t.intro}</p>

        <div>
          <div className="flex items-baseline justify-between mb-1">
            <label htmlFor="new-password" className="text-sm font-semibold text-farm-dark">
              {t.password}
            </label>
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="text-sm text-farm-green font-medium min-h-[44px] px-2 -mr-2"
            >
              {visible ? t.hide : t.show}
            </button>
          </div>
          <input
            id="new-password"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          <p className="text-xs text-farm-muted mt-1">{t.hint}</p>
        </div>

        <div>
          <label htmlFor="new-password-again" className="block text-sm font-semibold text-farm-dark mb-1">
            {t.again}
          </label>
          <input
            id="new-password-again"
            type={visible ? "text" : "password"}
            autoComplete="new-password"
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full min-h-[48px] rounded-xl bg-farm-green text-white text-base font-semibold hover:bg-farm-green/90 disabled:opacity-50"
        >
          {saving ? t.saving : t.save}
        </button>
      </form>
    </main>
  );
}
