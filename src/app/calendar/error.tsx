"use client";

import { ErrorScreen } from "@/components/shared/ErrorScreen";

export default function CalendarError({
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
      scope="[Calendar Error]"
      flower="anise-hyssop"
      fallbackTitle="Couldn't load the harvest calendar"
      fallbackDetail="We couldn't load the calendar. Try again, or reload the page."
      fullScreen
    />
  );
}
