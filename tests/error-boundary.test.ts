import { describe, expect, it } from "vitest";
import {
  describeBoundaryError,
  isNetworkError,
  isRedactedServerError,
} from "@/lib/error-boundary";

const fallback = { title: "Couldn't load this page", detail: "Try again." };

describe("isNetworkError", () => {
  it("recognises the browser's own connection-drop messages", () => {
    // Chromium: fetch body stream cut off mid-transfer (flaky 5G on Android)
    expect(isNetworkError(new TypeError("network error"))).toBe(true);
    // Chromium: request never connected
    expect(isNetworkError(new TypeError("Failed to fetch"))).toBe(true);
    // WebKit / iOS
    expect(isNetworkError(new TypeError("Load failed"))).toBe(true);
    // Firefox
    expect(isNetworkError(new TypeError("NetworkError when attempting to fetch resource."))).toBe(true);
    // React Flight client: server stream ended early
    expect(isNetworkError(new Error("Connection closed."))).toBe(true);
    // DOMException-style name
    expect(isNetworkError({ name: "NetworkError", message: "" })).toBe(true);
  });

  it("does not flag ordinary application errors", () => {
    expect(isNetworkError(new Error("ORDER_LOCKED"))).toBe(false);
    expect(isNetworkError(new Error("column does not exist"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError("network error")).toBe(false);
  });
});

describe("describeBoundaryError", () => {
  it("gives connection copy for a network drop", () => {
    const copy = describeBoundaryError(new TypeError("network error"), fallback);
    expect(copy.isNetwork).toBe(true);
    expect(copy.title).toBe("Connection dropped");
  });

  it("shows the real message for a non-network error", () => {
    const copy = describeBoundaryError(new Error("Availability not published"), fallback);
    expect(copy.isNetwork).toBe(false);
    expect(copy.title).toBe(fallback.title);
    expect(copy.detail).toBe("Availability not published");
  });

  it("hides Next.js's redacted production server-error text", () => {
    const redacted = new Error(
      "An error occurred in the Server Components render. The specific message is omitted in production builds to avoid leaking sensitive details. A digest property is included on this error instance which may provide additional details about the nature of the error.",
    );
    expect(isRedactedServerError(redacted)).toBe(true);
    expect(describeBoundaryError(redacted, fallback).detail).toBe(fallback.detail);
  });

  it("falls back when the message is empty", () => {
    expect(describeBoundaryError(new Error(""), fallback).detail).toBe(fallback.detail);
  });
});
