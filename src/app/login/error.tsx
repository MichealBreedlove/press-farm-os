"use client";

import Image from "next/image";
import { useEffect } from "react";

/**
 * Route-level error boundary for /login — keeps a crash here branded and
 * recoverable instead of escalating to the bare global-error.tsx.
 * Generic copy on purpose: error.message can carry internals.
 */
export default function LoginError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[login Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-farm-cream flex items-center justify-center px-6">
      <div className="text-center space-y-5 max-w-sm">
        <div className="relative mx-auto w-32 h-32">
          <Image
            src="/assets/pressfarm/flowers/marigold.png"
            alt=""
            aria-hidden="true"
            width={128}
            height={128}
            sizes="128px"
            className="w-full h-full object-contain opacity-90"
          />
          <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-red-700 border-4 border-farm-cream shadow-lg flex items-center justify-center">
            <span className="text-white text-base font-bold" aria-hidden="true">!</span>
          </div>
        </div>
        <p className="login-eyebrow text-red-700">Something went wrong</p>
        <h2 className="font-display text-2xl text-farm-dark">Couldn&apos;t load sign-in</h2>
        <p className="text-sm text-farm-muted leading-relaxed">
          Please try again. If it keeps happening, let Press Farm know.
        </p>
        {error.digest && (
          <p className="text-[11px] text-farm-muted font-pf-mono">Reference: {error.digest}</p>
        )}
        <button onClick={reset} className="btn-primary px-6 py-2.5 text-sm">
          Try again
        </button>
      </div>
    </div>
  );
}
