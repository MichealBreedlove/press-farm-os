/**
 * Shared helpers for the App Router error boundaries (error.tsx files).
 *
 * The messages below are the browser's own words for a connection that
 * died mid-request — Chromium throws `TypeError: network error` when a fetch
 * body stream is cut off (what a phone on flaky 5G sees when the RSC payload
 * for a client-side navigation stops arriving), Chromium/Firefox/WebKit say
 * "Failed to fetch" / "NetworkError…" / "Load failed" when the request never
 * connects, and React's Flight client reports "Connection closed." when the
 * server stream ends early. None of those is a bug in the app; the right
 * recovery is to refetch, not to re-render the same rejected data.
 */
const NETWORK_ERROR_PATTERNS: RegExp[] = [
  /\bnetwork ?error\b/i,
  /failed to fetch/i,
  /fetch failed/i,
  /load failed/i,
  /connection closed/i,
  /connection was lost/i,
  /internet connection/i,
  /ERR_(INTERNET_DISCONNECTED|NETWORK_CHANGED|CONNECTION_\w+|NAME_NOT_RESOLVED|TIMED_OUT)/,
];

export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "NetworkError") return true;
  if (typeof message !== "string") return false;
  return NETWORK_ERROR_PATTERNS.some((re) => re.test(message));
}

/**
 * Next.js strips server-side error messages in production and replaces them
 * with a generic "An error occurred in the Server Components render…" line
 * plus a digest. That text is meaningless to a chef or the farmer, so hide it.
 */
export function isRedactedServerError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { message } = error as { message?: unknown };
  return (
    typeof message === "string" &&
    /Server Components render|omitted in production|digest property/i.test(message)
  );
}

export interface ErrorCopy {
  /** Short, plain-language headline. */
  title: string;
  /** One or two sentences telling the reader what to do. */
  detail: string;
  /** True when this looks like a dropped connection rather than an app bug. */
  isNetwork: boolean;
}

export function describeBoundaryError(
  error: unknown,
  fallback: { title: string; detail: string },
): ErrorCopy {
  if (isNetworkError(error)) {
    return {
      title: "Connection dropped",
      detail:
        "The farm couldn't reach the server — usually a weak signal. Check your connection and try again.",
      isNetwork: true,
    };
  }
  const message =
    error && typeof error === "object" && typeof (error as Error).message === "string"
      ? (error as Error).message.trim()
      : "";
  return {
    title: fallback.title,
    detail: message && !isRedactedServerError(error) ? message : fallback.detail,
    isNetwork: false,
  };
}
