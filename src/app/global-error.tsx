"use client";

/** Last-resort boundary — renders the precise error instead of a bare digest. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ fontFamily: "system-ui", padding: "4rem", maxWidth: "40rem", margin: "0 auto" }}>
        <p style={{ fontFamily: "monospace", fontSize: 12, color: "#9F2F2D" }}>
          SERVER ERROR {error.digest ? `· digest ${error.digest}` : ""}
        </p>
        <h1 style={{ fontSize: "1.75rem", margin: "0.5rem 0" }}>
          Something failed in this server component.
        </h1>
        <p style={{ color: "#555" }}>{error.message || "The runtime logs contain the full stack for this digest."}</p>
        <button onClick={reset} style={{ marginTop: "1rem", padding: "0.5rem 1rem", background: "#111", color: "#fff", border: 0, borderRadius: 6 }}>
          Retry
        </button>
      </body>
    </html>
  );
}
