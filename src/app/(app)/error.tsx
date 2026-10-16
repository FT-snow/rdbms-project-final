"use client";

import { Button } from "@/components/ui/button";

/** Segment boundary — shows the real error message + digest in-app. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto max-w-xl space-y-4 py-16">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-redtext">
        Server error {error.digest ? `· digest ${error.digest}` : ""}
      </p>
      <h1 className="font-serif text-3xl tracking-[-0.02em]">
        This page failed to render.
      </h1>
      <p className="text-sm text-mute">
        {error.message || "The full stack trace is in the deployment runtime logs."}
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </section>
  );
}
