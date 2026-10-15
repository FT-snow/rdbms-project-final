import { cn } from "@/lib/utils";

export function Card({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-card border border-line bg-surface", className)} {...props} />;
}

export function CardHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-line px-6 py-4">
      <h2 className="font-serif text-lg tracking-[-0.02em]">{title}</h2>
      {meta ? <span className="font-mono text-xs text-mute">{meta}</span> : null}
    </div>
  );
}
