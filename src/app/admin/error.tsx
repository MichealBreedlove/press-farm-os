"use client";

import { ErrorScreen } from "@/components/shared/ErrorScreen";

export default function AdminError({
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
      scope="[Admin Error]"
      flower="thyme"
      fallbackTitle="Couldn't load this page"
      fallbackDetail="An unexpected error occurred. Try again, or reload the page."
    />
  );
}
