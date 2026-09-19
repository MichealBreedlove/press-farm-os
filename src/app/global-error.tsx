"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { describeBoundaryError } from "@/lib/error-boundary";

/**
 * Last-resort boundary: only reached when the ROOT layout itself throws
 * (everything below it is covered by app/error.tsx). It replaces the whole
 * document, so no globals.css, no fonts, no router context — inline styles
 * and a hard reload are the only tools that work here.
 */
export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const copy = describeBoundaryError(error, {
    title: "Something went wrong",
    detail: "An unexpected error occurred. Reload the page to try again.",
  });

  // No-op unless NEXT_PUBLIC_SENTRY_DSN is configured.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf7f0", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ textAlign: "center", maxWidth: "360px" }}>
            <p style={{ fontSize: "11px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#b91c1c", marginBottom: "12px" }}>
              {copy.isNetwork ? "No connection" : "Something went wrong"}
            </p>
            <h2 style={{ fontSize: "20px", fontWeight: 600, color: "#1a1a1a", marginBottom: "8px" }}>
              {copy.title}
            </h2>
            <p style={{ fontSize: "14px", color: "#666", lineHeight: 1.5, marginBottom: "20px" }}>
              {copy.detail}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                background: "#00774A",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                minHeight: "44px",
              }}
            >
              Reload
            </button>
            {error.digest && !copy.isNetwork && (
              <p style={{ fontSize: "11px", color: "#999", marginTop: "16px", fontFamily: "monospace" }}>
                ref {error.digest}
              </p>
            )}
          </div>
        </div>
      </body>
    </html>
  );
}
