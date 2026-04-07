/**
 * Styled wordmarks matching each restaurant's brand identity.
 * Press: wide-spaced thin caps (pressnapavalley.com)
 * Under-Study: script ampersand + spaced caps (under-study.com)
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
    const symbolSize =
      size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-xl";
    const textSize =
      size === "sm" ? "text-[10px]" : size === "lg" ? "text-sm" : "text-xs";
    return (
      <span className="inline-flex items-center gap-1.5">
        <em
          className={`font-display not-italic text-farm-green leading-none ${symbolSize}`}
          style={{ fontStyle: "italic" }}
        >
          &amp;
        </em>
        <span
          className={`font-sans font-light tracking-[0.2em] uppercase text-farm-dark ${textSize}`}
        >
          Under-Study
        </span>
      </span>
    );
  }

  // Fallback for any other restaurant
  return (
    <span className="font-sans font-semibold text-farm-dark">{name}</span>
  );
}
