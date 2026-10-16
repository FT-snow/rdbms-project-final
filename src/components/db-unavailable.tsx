import { Card } from "@/components/ui/card";
import { describeDbError } from "@/lib/errors";

export function DbUnavailable({
  page = "this page",
  error,
}: {
  page?: string;
  error?: unknown;
}) {
  const desc = error ? describeDbError(error) : null;

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
      <Card className="max-w-2xl p-8">
        <p className="text-sm">
          {page[0].toUpperCase() + page.slice(1)} needs MySQL, which the app
          couldn&rsquo;t reach just now.
        </p>
        {desc ? (
          <div className="mt-4 rounded-md border border-line bg-bone p-4">
            <p className="font-mono text-xs font-medium text-redtext">
              {desc.code}
            </p>
            <p className="mt-1 text-sm">{desc.summary}</p>
            {desc.detail ? (
              <p className="mt-1 text-xs text-mute">{desc.detail}</p>
            ) : null}
          </div>
        ) : (
          <ul className="mt-4 space-y-2 text-sm text-mute">
            <li>
              &bull; Locally: make sure MySQL is up and{" "}
              <span className="font-mono text-xs">sql/schema.sql</span> has run.
            </li>
            <li>
              &bull; On Vercel: set DB_HOST, DB_PORT, DB_USER, DB_PASSWORD,
              DB_NAME (and DB_SSL=true for hosted MySQL), then redeploy.
            </li>
          </ul>
        )}
      </Card>
    </section>
  );
}
