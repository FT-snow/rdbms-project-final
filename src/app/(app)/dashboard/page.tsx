import { getDashboardData } from "@/lib/queries";
import DashboardWidgets from "@/components/dashboard-widgets";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const data = await getDashboardData();
  const dt = new Intl.DateTimeFormat("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">{dt}</p>
          <h1 className="mt-1 font-serif text-4xl leading-[1.1] tracking-[-0.03em]">
            Today at the clinic
          </h1>
        </div>
        <Link href="/book">
          <Button>Book appointment</Button>
        </Link>
      </header>

      <p className="max-w-2xl text-sm text-mute">
        Rearrange the board to your liking — drag a tile, or press and hold on
        touch screens. Keyboard users: hold <kbd className="rounded border border-line bg-bone px-1.5 py-0.5 font-mono text-[10px]">Alt</kbd>{" "}
        and use the arrow keys.
      </p>

      <DashboardWidgets data={data} />
    </section>
  );
}
