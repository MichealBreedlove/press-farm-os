"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort boundary (root layout failed, so no fonts / Tailwind / nav).
 * Inline styles only. Shows a generic message — never the raw error text —
 * plus the digest so Micheal can match it to the Vercel / Sentry log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // No-op unless NEXT_PUBLIC_SENTRY_DSN is configured.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf7f0", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ textAlign: "center", maxWidth: "360px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.22em", textTransform: "uppercase", color: "#00774A", marginBottom: "12px" }}>
              Press Farm
            </p>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1a1a1a", marginBottom: "8px" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "14px", lineHeight: 1.6, color: "#5b6258", marginBottom: "20px" }}>
              The page couldn&apos;t load. Try again, and if it keeps happening let Press Farm know.
            </p>
            <button
              onClick={reset}
              style={{
                background: "#00774A",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "12px 24px",
                minHeight: "44px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
            {error.digest && (
              <p style={{ fontSize: "11px", color: "#5b6258", marginTop: "20px", fontFamily: "ui-monospace, Menlo, monospace" }}>
                Reference: {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
