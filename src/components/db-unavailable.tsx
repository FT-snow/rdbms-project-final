import { Card } from "@/components/ui/card";

export function DbUnavailable({ page = "this page" }: { page?: string }) {
  return (
    <section className="space-y-6">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-redtext">
          Database unreachable
        </p>
        <h1 className="mt-1 font-serif text-4xl leading-[1.1] tracking-[-0.03em]">
          {page[0].toUpperCase() + page.slice(1)}
        </h1>
      </header>
      <Card className="p-8 max-w-xl">
        <p className="text-sm text-ink">
          {page[0].toUpperCase() + page.slice(1)} needs MySQL, which the app
          can&rsquo;t reach right now.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-mute">
          <li>&#x2022; IF running locally: make sure MySQL is up and{" "}
            <span className="font-mono text-xs">sql/schema.sql</span> has run.</li>
          <li>&#x2022; IF on Vercel: set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD,
            DB_NAME (and DB_SSL=true for hosted MySQL) in the project&rsquo;s
            environment variables, pointing at a cloud-reachable server.</li>
        </ul>
      </Card>
    </section>
  );
}
