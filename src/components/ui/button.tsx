import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "outline";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition",
        "active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        {
          "bg-ink text-white hover:bg-[#333333]": variant === "primary",
          "border border-line bg-surface text-ink hover:bg-bone": variant === "outline",
          "text-mute hover:text-ink": variant === "ghost",
          "bg-redsoft text-redtext hover:bg-[#FADFE0]": variant === "danger",
        },
        className
      )}
      {...props}
    />
  );
}
