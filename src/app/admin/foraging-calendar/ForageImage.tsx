"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CACHE_KEY_PREFIX = "forage-img-v2:";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const THUMB_PX = 500;

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
 * Search Wikipedia for the best matching page and return its lead
 * thumbnail URL, if any. Single API call per query — uses the
 * `generator=search` + `prop=pageimages` pattern so a search and a
 * thumbnail lookup happen together.
 */
async function searchWikipediaThumb(query: string): Promise<string | null> {
  const url =
    `https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=4` +
    `&prop=pageimages&piprop=thumbnail&pithumbsize=${THUMB_PX}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  const pages = data?.query?.pages ?? {};
  const candidates = Object.values(pages) as {
    index?: number;
    thumbnail?: { source?: string };
  }[];
  // Sort by Wikipedia's search rank (lower `index` = better match)
  candidates.sort((a, b) => (a.index ?? 999) - (b.index ?? 999));
  for (const page of candidates) {
    if (page.thumbnail?.source) return page.thumbnail.source;
  }
  return null;
}

/**
 * Walk a series of search queries until one returns a thumbnail.
 * Scientific name first (most specific); then progressively broader
 * common-name searches.
 */
async function findBestThumb(
  scientificName: string | undefined,
  commonName: string,
): Promise<string | null> {
  const queries = [
    scientificName,
    `${commonName} ${scientificName ?? ""}`.trim(),
    `${commonName} foraging`,
    commonName,
  ].filter((q): q is string => Boolean(q && q.length > 0));

  // De-duplicate while preserving order
  const seen = new Set<string>();
  for (const query of queries) {
    if (seen.has(query)) continue;
    seen.add(query);
    try {
      const url = await searchWikipediaThumb(query);
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
 * Searches Wikipedia for the best matching page using the species'
 * scientific name first, then a common-name fallback, then a broader
 * search query. Returns the lead thumbnail of the best result. Results
 * are cached in localStorage for 30 days.
 *
 * If nothing matches, a styled "No photo" placeholder is shown — never
 * a broken image.
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
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.kind]);

  // Once loading, check the cache then call Wikipedia
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

    findBestThumb(scientificName, commonName)
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
        "bg-pf-master-gold/10 border border-pf-master-gold/15",
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
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {state.kind === "missing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-farm-cream/50">
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
