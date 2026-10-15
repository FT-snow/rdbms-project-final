import { cn } from "@/lib/utils";

export function Badge({
  tone = "gray",
  children,
}: {
  tone?: "gray" | "red" | "blue" | "green" | "yellow";
  children: React.ReactNode;
}) {
  const tones = {
    gray: "bg-bone text-mute border-line",
    red: "bg-redsoft text-redtext border-[#EFDCDD]",
    blue: "bg-bluesoft text-bluetext border-[#CCE5F5]",
    green: "bg-greensoft text-greentext border-[#D2E1D0]",
    yellow: "bg-yellowsoft text-yellowtext border-[#EBDDB5]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.05em]",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}
