"use client";

import { ErrorScreen } from "@/components/shared/ErrorScreen";

export default function OrderError({
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
      scope="[Order Error]"
      flower="hairy-vetch"
      fallbackTitle="Couldn't load the order form"
      fallbackDetail="We couldn't load the order form. Try again, or reload the page."
      fullScreen
    />
  );
}
