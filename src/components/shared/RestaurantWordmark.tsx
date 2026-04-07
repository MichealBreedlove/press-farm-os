/**
 * Styled wordmarks matching each restaurant's brand identity.
 * Press: wide-spaced thin caps (pressnapavalley.com)
 * Under-Study: white circle ampersand + spaced serif caps on farm-green (under-study.com)
 */

interface RestaurantWordmarkProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

export function RestaurantWordmark({ name, size = "md" }: RestaurantWordmarkProps) {
  const normalized = name.toLowerCase().replace(/[-\s]/g, "");

  if (normalized === "press") {
    const textSize =
      size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm";
    return (
      <span
        className={`font-sans font-light tracking-[0.35em] uppercase text-farm-dark ${textSize}`}
      >
        Press
      </span>
    );
  }

  if (normalized === "understudy") {
    const circleSize =
      size === "sm" ? "w-6 h-6 text-xs" : size === "lg" ? "w-10 h-10 text-lg" : "w-8 h-8 text-base";
    const textSize =
      size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs";

    return (
      <span className="inline-flex items-center gap-2 bg-farm-green rounded-lg px-3 py-1.5">
        <span
          className={`inline-flex items-center justify-center rounded-full bg-white text-farm-green font-display flex-shrink-0 ${circleSize}`}
          style={{ fontStyle: "italic" }}
        >
          &amp;
        </span>
        <span
          className={`font-display tracking-[0.18em] uppercase text-white ${textSize}`}
        >
          Under-Study
        </span>
      </span>
    );
  }

  return (
    <span className="font-sans font-semibold text-farm-dark">{name}</span>
  );
}
