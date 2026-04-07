import Image from "next/image";

// Press logo: 472×49px (wide horizontal wordmark)
// Under-Study logo: 276×140px (stacked mark + wordmark)

interface RestaurantWordmarkProps {
  name: string;
  size?: "sm" | "md" | "lg";
}

export function RestaurantWordmark({ name, size = "md" }: RestaurantWordmarkProps) {
  const normalized = name.toLowerCase().replace(/[-\s]/g, "");

  if (normalized === "press") {
    const height = size === "sm" ? 14 : size === "lg" ? 24 : 18;
    const width = Math.round(height * (472 / 49));
    return (
      <Image
        src="/logo-press.png"
        alt="Press"
        width={width}
        height={height}
        className="object-contain"
      />
    );
  }

  if (normalized === "understudy") {
    const height = size === "sm" ? 40 : size === "lg" ? 64 : 52;
    const width = Math.round(height * (276 / 140));
    return (
      <Image
        src="/logo-under-study.png"
        alt="Under-Study"
        width={width}
        height={height}
        className="object-contain"
      />
    );
  }

  return (
    <span className="font-sans font-semibold text-farm-dark">{name}</span>
  );
}
