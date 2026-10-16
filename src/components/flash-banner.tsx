"use client";

import { useSearchParams } from "next/navigation";

/** Renders `?error=` set by server actions as a dismissible banner. */
export function FlashBanner() {
  const error = useSearchParams().get("error");
  if (!error) return null;
  return (
    <div
      role="alert"
      className="mb-6 flex items-start justify-between gap-4 rounded-md border border-[#EFDCDD] bg-redsoft px-4 py-3 text-sm text-redtext"
    >
      <span>{error}</span>
    </div>
  );
}
