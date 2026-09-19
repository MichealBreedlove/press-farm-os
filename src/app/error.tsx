"use client";

import { ErrorScreen } from "@/components/shared/ErrorScreen";

/**
 * Root error boundary — catches errors from every route that doesn't have a
 * closer error.tsx (login, history, harvest, events, receiver, signup, about)
 * and from the top of the tree during a client-side navigation. Without this
 * file those fall through to global-error.tsx, which replaces the whole
 * document with an unstyled page.
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <ErrorScreen
      error={error}
      reset={reset}
      scope="[App Error]"
      flower="thyme"
      fallbackTitle="Couldn't load this page"
      fallbackDetail="An unexpected error occurred. Try again, or reload the page."
      fullScreen
    />
  );
}
