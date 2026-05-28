"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CACHE_KEY_PREFIX = "forage-img-v3:";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

interface ForageImageProps {
  /** Cache key — usually the scientific name with underscores. */
  cacheKey: string;
  /** Common name (e.g. "Golden Chanterelle"). */
  commonName: string;
  /** Scientific name (e.g. "Cantharellus californicus"). */
  scientificName?: string;
  alt: string;
  className?: string;
}

interface CachedImage {
  url: string | null;
  ts: number;
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; url: string }
  | { kind: "missing" };

/**
 * Look up a taxon on iNaturalist and return its default photo URL.
 * iNat photos are user-submitted observations curated by the community —
 * always real photographs, never botanical drawings, and usually framed
 * at ID distance rather than tight macro crops.
 */
async function findInatPhoto(query: string): Promise<string | null> {
  const url =
    `https://api.inaturalist.org/v1/taxa?` +
    `q=${encodeURIComponent(query)}` +
    `&rank=species,genus,subspecies` +
    `&per_page=5` +
    `&is_active=true`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const results = (data?.results ?? []) as {
    default_photo?: { medium_url?: string; original_url?: string };
    matched_term?: string;
  }[];
  for (const taxon of results) {
    const photo = taxon.default_photo?.medium_url ?? taxon.default_photo?.original_url;
    if (photo) return photo;
  }
  return null;
}

/**
 * Search Wikipedia for a page-image thumbnail. Skips SVGs (which on
 * plant/fungus articles are almost always botanical illustrations or
 * range maps, not photos).
 */
async function findWikipediaPhoto(query: string): Promise<string | null> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=600`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const pages = data?.query?.pages ?? {};
  const candidates = Object.values(pages) as {
    index?: number;
    thumbnail?: { source?: string };
  }[];
  candidates.sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
  for (const page of candidates) {
    const src = page.thumbnail?.source;
    if (!src) continue;
    const lower = src.toLowerCase();
    // Skip vector illustrations and range maps
    if (lower.includes(".svg")) continue;
    if (lower.includes("range_map")) continue;
    if (lower.includes("distribution_map")) continue;
    return src;
  }
  return null;
}

/**
 * Walk a series of lookups until one returns a real photo.
 * iNaturalist first (curated photographs), then Wikipedia (photos only,
 * SVG illustrations excluded).
 */
async function findBestPhoto(
  scientificName: string | undefined,
  commonName: string,
): Promise<string | null> {
  const tryOrder: { source: "inat" | "wiki"; query: string }[] = [];
  if (scientificName) {
    tryOrder.push({ source: "inat", query: scientificName });
  }
  tryOrder.push({ source: "inat", query: commonName });
  if (scientificName) {
    tryOrder.push({ source: "wiki", query: scientificName });
    tryOrder.push({ source: "wiki", query: `${commonName} ${scientificName}` });
  }
  tryOrder.push({ source: "wiki", query: `${commonName} foraging` });
  tryOrder.push({ source: "wiki", query: commonName });

  const seen = new Set<string>();
  for (const { source, query } of tryOrder) {
    const key = `${source}::${query}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const url =
        source === "inat"
          ? await findInatPhoto(query)
          : await findWikipediaPhoto(query);
      if (url) return url;
    } catch {
      /* try the next one */
    }
  }
  return null;
}

/**
 * Lazy-loaded identification photo for a foraging species.
 *
 * Uses iNaturalist as the primary photo source (real photographs only,
 * curated by the citizen-science community) with Wikipedia as a fallback
 * for any species iNat doesn't recognize. Botanical illustrations and
 * range maps are filtered out. Results cached in localStorage for 30
 * days.
 *
 * Image is rendered with `object-contain` over a cream background so the
 * whole organism is visible — no aggressive macro-crop framing.
 */
export function ForageImage({
  cacheKey,
  commonName,
  scientificName,
  alt,
  className,
}: ForageImageProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const containerRef = useRef<HTMLDivElement>(null);

  // IntersectionObserver — only start fetching when the card is near the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el || state.kind !== "idle") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setState({ kind: "loading" });
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.kind]);

  // Once loading, check the cache then call iNat/Wikipedia
  useEffect(() => {
    if (state.kind !== "loading") return;
    let cancelled = false;
    const storageKey = `${CACHE_KEY_PREFIX}${cacheKey}`;

    try {
      const cached = localStorage.getItem(storageKey);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedImage;
        if (Date.now() - parsed.ts < CACHE_TTL_MS) {
          setState(parsed.url ? { kind: "ok", url: parsed.url } : { kind: "missing" });
          return;
        }
      }
    } catch {
      /* ignore corrupt cache */
    }

    findBestPhoto(scientificName, commonName)
      .then((url) => {
        if (cancelled) return;
        try {
          localStorage.setItem(
            storageKey,
            JSON.stringify({ url, ts: Date.now() } satisfies CachedImage),
          );
        } catch {
          /* ignore quota errors */
        }
        setState(url ? { kind: "ok", url } : { kind: "missing" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: "missing" });
      });

    return () => {
      cancelled = true;
    };
  }, [state.kind, cacheKey, commonName, scientificName]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden",
        "bg-farm-cream",
        className,
      )}
    >
      {state.kind === "ok" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.url}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setState({ kind: "missing" })}
          className="absolute inset-0 w-full h-full object-contain p-2"
        />
      )}
      {state.kind === "missing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-farm-cream">
          <span className="text-[10px] uppercase tracking-[0.18em] text-farm-muted/70">
            No photo
          </span>
        </div>
      )}
      {(state.kind === "idle" || state.kind === "loading") && (
        <div className="absolute inset-0 bg-pf-master-gold/10 animate-pulse" />
      )}
    </div>
  );
}
