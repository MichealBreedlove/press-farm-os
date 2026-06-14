/**
 * Lane (ordering-restaurant) visual identity — the single source of truth so
 * PRESS / Under-Study / Press Bar / Events read the same dot + left-accent
 * everywhere (order dashboard, pick-pack detail, receiver check-in, harvest
 * grid). Colors reuse existing brand tokens — Press Bar (blue) and Events
 * (violet) already used these ad-hoc; this centralizes them and adds an
 * accent for Press (ink) and Under-Study (its brand orange).
 *
 * `nameClass` / `labelClass` carry an optional typographic echo of each
 * restaurant's own brand: Press & Press Bar in tracked Bank Gothic caps
 * (matching pressnapavalley.com), Under-Study & Events in Cormorant italic
 * (matching under-study.com). They omit font-size so callers keep their own.
 *
 * Class strings are written as static literals (not composed at runtime) so
 * Tailwind's content scanner keeps them in the build.
 */

const PRESS_NAME = "font-pf-brand uppercase tracking-[0.18em]";
const US_NAME = "font-pf-serif italic";
const PRESS_LABEL = "font-pf-brand uppercase tracking-[0.14em] text-[11px]";
const US_LABEL = "font-pf-serif italic text-[13px] leading-none";

export interface LaneStyle {
  key: string;
  /** The display name passed in (preserves original casing). */
  label: string;
  /** Tailwind bg-* class for the leading dot. */
  dot: string;
  /** Tailwind border-* class for a left accent on cards/rows. */
  border: string;
  /** Family/style for a large restaurant-name heading (no size). */
  nameClass: string;
  /** Family/style for the small lane-badge label. */
  labelClass: string;
}

type LaneBase = Omit<LaneStyle, "label">;

const LANES: Record<string, LaneBase> = {
  press: {
    key: "press",
    dot: "bg-farm-dark",
    border: "border-farm-dark",
    nameClass: PRESS_NAME,
    labelClass: PRESS_LABEL,
  },
  understudy: {
    key: "understudy",
    dot: "bg-[#1C7C50]",
    border: "border-[#1C7C50]",
    nameClass: US_NAME,
    labelClass: US_LABEL,
  },
  pressbar: {
    key: "pressbar",
    dot: "bg-pf-master-blue",
    border: "border-pf-master-blue",
    nameClass: PRESS_NAME,
    labelClass: PRESS_LABEL,
  },
  events: {
    key: "events",
    dot: "bg-pf-master-violet",
    border: "border-pf-master-violet",
    nameClass: US_NAME,
    labelClass: US_LABEL,
  },
};

const FALLBACK: LaneBase = {
  key: "other",
  dot: "bg-farm-muted",
  border: "border-farm-dark/20",
  nameClass: "font-semibold",
  labelClass: "text-[11px] font-medium",
};

/**
 * Resolve a restaurant name to its lane style. Matching is case- and
 * separator-insensitive ("Press Bar" / "press-bar" → pressbar).
 */
export function laneStyle(name: string | null | undefined): LaneStyle {
  const key = (name ?? "").toLowerCase().replace(/[-\s]/g, "");
  const base = LANES[key] ?? FALLBACK;
  return { ...base, label: name ?? "" };
}
