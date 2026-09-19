"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { describeBoundaryError } from "@/lib/error-boundary";

interface ErrorScreenProps {
  error: Error & { digest?: string };
  reset: () => void;
  /** Console tag, e.g. "[Admin Error]". */
  scope: string;
  /** Flower art under public/assets/pressfarm/flowers/. */
  flower: string;
  /** Headline + guidance when the error isn't a recognised network drop. */
  fallbackTitle: string;
  fallbackDetail: string;
  /** Full-height (standalone route) vs. fits inside a layout with nav. */
  fullScreen?: boolean;
}

/**
 * One branded error screen behind every route-level error.tsx.
 *
 * "Try Again" refreshes the router before resetting the boundary. A bare
 * reset() only re-renders the tree against the same failed data — for a
 * dropped connection (the common case on a phone in the field) that shows
 * the identical screen again. router.refresh() refetches from the server;
 * the transition keeps the old UI up until the new payload lands.
 */
export function ErrorScreen({
  error,
  reset,
  scope,
  flower,
  fallbackTitle,
  fallbackDetail,
  fullScreen = false,
}: ErrorScreenProps) {
  const router = useRouter();
  const copy = describeBoundaryError(error, { title: fallbackTitle, detail: fallbackDetail });

  useEffect(() => {
    console.error(scope, error);
  }, [scope, error]);

  const retry = () => {
    startTransition(() => {
      router.refresh();
      reset();
    });
  };

  const reload = () => {
    window.location.reload();
  };

  return (
    <div
      className={`${fullScreen ? "min-h-screen bg-farm-cream" : "min-h-[60vh]"} flex items-center justify-center px-6`}
    >
      <div className="text-center space-y-5 max-w-sm">
        <div className="relative mx-auto w-32 h-32">
          <img
            src={`/assets/pressfarm/flowers/${flower}.png`}
            alt=""
            aria-hidden="true"
            className="w-full h-full object-contain opacity-90"
          />
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-red-500 border-4 border-farm-cream shadow-lg flex items-center justify-center">
            <span className="text-white text-base font-bold">!</span>
          </div>
        </div>
        <p className="login-eyebrow text-red-500">
          {copy.isNetwork ? "No connection" : "Something went wrong"}
        </p>
        <h2 className="font-display text-2xl text-farm-dark">{copy.title}</h2>
        <p className="text-sm text-farm-muted leading-relaxed">{copy.detail}</p>
        <div className="flex flex-col items-center gap-3">
          <button type="button" onClick={retry} className="btn-primary px-6 py-2.5 text-sm">
            Try Again
          </button>
          <button
            type="button"
            onClick={reload}
            className="text-sm text-farm-muted underline underline-offset-4 min-h-[44px] px-4"
          >
            Reload the page
          </button>
        </div>
        {error.digest && !copy.isNetwork && (
          <p className="text-[11px] font-mono text-farm-muted/70">ref {error.digest}</p>
        )}
      </div>
    </div>
  );
}
