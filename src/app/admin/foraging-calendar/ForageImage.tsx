"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

const CACHE_KEY_PREFIX = "forage-img-v1:";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const THUMB_PX = 500;

interface ForageImageProps {
  /** Wikipedia page title (with underscores). */
  wikiTitle: string;
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
 * Lazy-loaded identification photo for a foraging species.
 *
 * Pulls a thumbnail from the Wikipedia REST API (free, CORS-enabled,
 * CC-licensed images) when the image scrolls into view. Results are
 * cached in localStorage for 30 days so repeat visits don't hammer the
 * API.
 *
 * If a species has no Wikipedia page, a styled placeholder is shown
 * instead — never a broken image.
 */
export function ForageImage({ wikiTitle, alt, className }: ForageImageProps) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const containerRef = useRef<HTMLDivElement>(null);

  // Intersection-observer lazy load — only fetch when the card is near the viewport
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
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [state.kind]);

  // Fetch (with localStorage cache) once we enter the loading state
  useEffect(() => {
    if (state.kind !== "loading") return;
    let cancelled = false;
    const cacheKey = `${CACHE_KEY_PREFIX}${wikiTitle}`;

    // Cached hit?
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as CachedImage;
        if (Date.now() - parsed.ts < CACHE_TTL_MS) {
          setState(parsed.url ? { kind: "ok", url: parsed.url } : { kind: "missing" });
          return;
        }
      }
    } catch {
      /* ignore */
    }

    // Live fetch from Wikipedia's PageImages API
    const url = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=pageimages&piprop=thumbnail&pithumbsize=${THUMB_PX}&titles=${encodeURIComponent(wikiTitle)}&origin=*&redirects=1`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const pages = data?.query?.pages ?? {};
        const first = Object.values(pages)[0] as
          | { thumbnail?: { source?: string } }
          | undefined;
        const src = first?.thumbnail?.source ?? null;
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ url: src, ts: Date.now() }));
        } catch {
          /* ignore quota errors */
        }
        setState(src ? { kind: "ok", url: src } : { kind: "missing" });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ kind: "missing" });
      });
    return () => {
      cancelled = true;
    };
  }, [state.kind, wikiTitle]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-xl bg-pf-master-gold/8",
        "border border-pf-master-gold/15",
        className,
      )}
    >
      {state.kind === "ok" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={state.url}
          alt={alt}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      {state.kind === "missing" && (
        <div className="absolute inset-0 flex items-center justify-center bg-farm-cream/40">
          <span className="text-[10px] uppercase tracking-[0.18em] text-farm-muted/70">
            No photo
          </span>
        </div>
      )}
      {(state.kind === "idle" || state.kind === "loading") && (
        <div className="absolute inset-0 bg-pf-master-gold/8 animate-pulse" />
      )}
    </div>
  );
}
