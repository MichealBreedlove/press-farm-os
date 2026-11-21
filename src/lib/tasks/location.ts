/**
 * Where a farm task happens — place, field quadrant, rows. Pure; tested in
 * tests/lib/tasks/location.test.ts.
 */

export const TASK_PLACES = ["farm", "greenhouse", "press", "understudy"] as const;
export type TaskPlace = (typeof TASK_PLACES)[number];

export const PLACE_LABELS: Record<"en" | "es", Record<TaskPlace, string>> = {
  en: { farm: "Farm", greenhouse: "Greenhouse", press: "Press", understudy: "Under-Study" },
  es: { farm: "Granja", greenhouse: "Invernadero", press: "Press", understudy: "Under-Study" },
};

export interface TaskLocation {
  location_place: TaskPlace | null;
  location_quadrant: number | null;
  location_rows: string | null;
}

export const NO_LOCATION: TaskLocation = { location_place: null, location_quadrant: null, location_rows: null };

/** Validates location fields from a request body. Junk is dropped to null. */
export function sanitizeLocation(raw: unknown): TaskLocation {
  if (!raw || typeof raw !== "object") return { ...NO_LOCATION };
  const r = raw as Record<string, unknown>;
  const place = TASK_PLACES.includes(r.location_place as TaskPlace) ? (r.location_place as TaskPlace) : null;
  const q = Number(r.location_quadrant);
  const quadrant = r.location_quadrant != null && r.location_quadrant !== "" && Number.isInteger(q) && q >= 1 && q <= 20 ? q : null;
  const rows =
    typeof r.location_rows === "string" && r.location_rows.trim() ? r.location_rows.trim().slice(0, 40) : null;
  return { location_place: place, location_quadrant: quadrant, location_rows: rows };
}

export function hasLocation(l: Partial<TaskLocation>): boolean {
  return !!(l.location_place || l.location_quadrant || l.location_rows);
}

/** "Farm · Quadrant 3 · Rows 5-6" / "Granja · Cuadrante 3 · Hileras 5-6". Null when empty. */
export function formatLocation(l: Partial<TaskLocation>, lang: "en" | "es" = "en"): string | null {
  const parts: string[] = [];
  if (l.location_place) parts.push(PLACE_LABELS[lang][l.location_place]);
  if (l.location_quadrant) parts.push(`${lang === "es" ? "Cuadrante" : "Quadrant"} ${l.location_quadrant}`);
  if (l.location_rows) {
    const single = /^\d+$/.test(l.location_rows);
    parts.push(
      lang === "es" ? `${single ? "Hilera" : "Hileras"} ${l.location_rows}` : `${single ? "Row" : "Rows"} ${l.location_rows}`,
    );
  }
  return parts.length ? parts.join(" · ") : null;
}

/**
 * Reads a location out of task text written as "Where: Quadrant 1, rows 4-5.
 * How: …" (the job list and the recurring-sow notes use that shape). Only
 * the "Where:" part is read when there is one. Returns NO_LOCATION when
 * nothing recognisable is there — never guesses a quadrant.
 */
export function parseLocationFromText(text: string | null | undefined): TaskLocation {
  if (!text) return { ...NO_LOCATION };
  const where = /Where:\s*([^]*?)(?:\s+(?:How|How much|ES):|$)/i.exec(text)?.[1] ?? text;
  const quadrant = /quadrant\s+(\d{1,2})/i.exec(where);
  const rows = /rows?\s+(\d+(?:\s*[-–,]\s*\d+)*)/i.exec(where);
  const greenhouseOnly = /greenhouse/i.test(where) && !quadrant;
  if (greenhouseOnly) return { location_place: "greenhouse", location_quadrant: null, location_rows: null };
  if (!quadrant && !rows) return { ...NO_LOCATION };
  return {
    location_place: "farm",
    location_quadrant: quadrant ? Number(quadrant[1]) : null,
    location_rows: rows ? rows[1].replace(/\s+/g, "").replace("–", "-") : null,
  };
}
