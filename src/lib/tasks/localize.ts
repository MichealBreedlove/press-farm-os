/**
 * English/Spanish text for a farm task, for the Farm Hand portal (/harvest).
 *
 * Spanish comes from, in order:
 *   1. `title_es` / `description_es` (auto-translated on create/edit, editable)
 *   2. for cron-generated tasks, a template translation of the known title
 *      shapes ("Sow 2 trays Mustard", "Harvest Chervil tray CH-1009-02", …)
 *   3. the inline "ES: …" tail older hand-written descriptions carry
 *   4. the English text
 *
 * Pure — no I/O — so it's unit-tested (tests/lib/tasks/localize.test.ts).
 */

export type TaskLang = "en" | "es";

export interface LocalizableTask {
  title: string;
  description: string | null;
  title_es?: string | null;
  description_es?: string | null;
}

const TRAY_STATUS_ES: Record<string, string> = {
  soaking: "remojo",
  blackout: "oscuridad",
  light: "luz",
  harvesting: "cosecha",
  terminated: "terminada",
};

/** Template translation of the generator title shapes; null when none match. */
export function translateGeneratedTitle(title: string): string | null {
  let m = /^Sow (\d+) trays? (.+)$/.exec(title);
  if (m) {
    const n = Number(m[1]);
    return `Sembrar ${n} ${n === 1 ? "bandeja" : "bandejas"} de ${m[2]}`;
  }
  m = /^Move (.+) tray (\S+) → (\w+)$/.exec(title);
  if (m) {
    return `Mover bandeja ${m[2]} de ${m[1]} → ${TRAY_STATUS_ES[m[3]] ?? m[3]}`;
  }
  m = /^Harvest (.+) tray (\S+)$/.exec(title);
  if (m) return `Cosechar bandeja ${m[2]} de ${m[1]}`;
  m = /^Sow (.+) \(recurring every (\d+)d\)$/.exec(title);
  if (m) return `Sembrar ${m[1]} (cada ${m[2]} días)`;
  return null;
}

/** Splits "English text. ES: texto en español" at the first ES: marker. */
export function splitInlineSpanish(text: string): { en: string; es: string | null } {
  const m = /(^|\s)ES:\s*/.exec(text);
  if (!m) return { en: text.trim(), es: null };
  const en = text.slice(0, m.index).trim();
  const es = text.slice(m.index + m[0].length).trim();
  return { en, es: es || null };
}

export function localizeTaskTitle(task: LocalizableTask, lang: TaskLang): string {
  if (lang === "en") return task.title;
  const es = task.title_es?.trim();
  if (es) return es;
  return translateGeneratedTitle(task.title) ?? task.title;
}

export function localizeTaskDescription(task: LocalizableTask, lang: TaskLang): string | null {
  const raw = task.description?.trim() ?? "";
  const inline = raw ? splitInlineSpanish(raw) : { en: "", es: null };
  if (lang === "es") {
    const es = task.description_es?.trim();
    if (es) return es;
    if (inline.es) return inline.es;
    return raw || null;
  }
  // English: drop the inline Spanish tail so it isn't read twice.
  return (inline.en || raw) || null;
}
