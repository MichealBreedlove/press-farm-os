"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

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
    <html>
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf7f0", margin: 0 }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ textAlign: "center", maxWidth: "360px" }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#1a1a1a", marginBottom: "8px" }}>
              Something went wrong
            </h2>
            <p style={{ fontSize: "14px", color: "#888", marginBottom: "20px" }}>
              {error.message || "An unexpected error occurred."}
            </p>
            <button
              onClick={reset}
              style={{
                background: "#00774A",
                color: "white",
                border: "none",
                borderRadius: "12px",
                padding: "12px 24px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
