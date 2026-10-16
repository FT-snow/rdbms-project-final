import { getReports } from "@/lib/queries";
import { Table, Th, Td } from "@/components/ui/table";
import { Card, CardHeader } from "@/components/ui/card";
import { DbUnavailable } from "@/components/db-unavailable";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  let dbErr: unknown;
  const reports = await getReports().catch((e) => ((dbErr = e), null));
  if (!reports) return <DbUnavailable page="reports" error={dbErr} />;
  const { busy, aboveAvg, ranked, revDept, audit } = reports;

  return (
    <section className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.1] tracking-[-0.03em]">Reports</h1>
          <p className="mt-1 max-w-2xl text-mute">
            Every block here maps to a required SQL query — JOIN, GROUP BY with HAVING,
            subquery, aggregate, window function. Full text lives in{" "}
            <span className="font-mono text-xs">sql/report_queries.sql</span>.
          </p>
        </div>
      </header>

      {/* GROUP BY + HAVING: departments with > 10 appointments this month */}
      <Card>
        <CardHeader
          title="Busiest departments"
          meta="GROUP BY + HAVING · this month"
        />
        <div className="p-6 space-y-2">
          {busy.map((row) => (
            <div key={row.department} className="flex items-center gap-3 text-sm">
              <span className="w-40 truncate">{row.department}</span>
              <span className="h-[3px] flex-1 rounded-full bg-line">
                <span
                  className="block h-full rounded-full bg-ink/70"
                  style={{
                    width: `${Math.min(100, (Number(row.appts) / Math.max(1, ...busy.map((b) => Number(b.appts)))) * 100)}%`,
                  }}
                />
              </span>
              <span className="w-8 text-right font-mono text-xs text-mute">{row.appts}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subquery: above-average doctors */}
        <Card>
          <CardHeader title="Above-average doctors" meta="scalar subquery" />
          <Table className="border-0">
            <thead>
              <tr>
                <Th>Doctor</Th>
                <Th>Total</Th>
              </tr>
            </thead>
            <tbody>
              {aboveAvg.map((row) => (
                <tr key={row.doctor_name}>
                  <Td>{row.doctor_name}</Td>
                  <Td className="tabular-nums text-mute">{row.total_appointments}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>

        {/* Window function: RANK() OVER */}
        <Card>
          <CardHeader title="Doctors ranked" meta="RANK() OVER (ORDER BY … DESC)" />
          <Table className="border-0">
            <thead>
              <tr>
                <Th>Rank</Th>
                <Th>Doctor</Th>
                <Th>Patients treated</Th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((row) => (
                <tr key={row.doctor_name}>
                  <Td className="font-mono text-xs text-mute">#{row.rnk}</Td>
                  <Td>
                    {row.doctor_name}
                    <span className="block text-xs text-mute">{row.department}</span>
                  </Td>
                  <Td className="tabular-nums">{row.total_appointments}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      </div>

      {/* Aggregate: revenue per department per month */}
      <Card>
        <CardHeader title="Revenue by department" meta="GROUP BY month + revenue" />
        <Table className="border-0">
          <thead>
            <tr>
              <Th>Month</Th>
              <Th>Department</Th>
              <Th>Revenue</Th>
            </tr>
          </thead>
          <tbody>
            {revDept.map((row) => (
              <tr key={`${row.month}-${row.department}`}>
                <Td className="font-mono text-xs text-mute">{row.month}</Td>
                <Td>{row.department}</Td>
                <Td className="tabular-nums">₹{Number(row.revenue).toLocaleString("en-IN")}</Td>
              </tr>
            ))}
            {revDept.length === 0 && (
              <tr>
                <Td className="text-mute" colSpan={3}>
                  No payments recorded yet.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>

      {/* audit_log */}
      <Card>
        <CardHeader title="Audit trail" meta="audit_log · latest 10" />
        <Table className="border-0">
          <thead>
            <tr>
              <Th>Table</Th>
              <Th>Action</Th>
              <Th>Record</Th>
              <Th>Changed at</Th>
            </tr>
          </thead>
          <tbody>
            {audit.map((row) => (
              <tr key={row.log_id}>
                <Td className="font-mono text-xs">{row.table_name}</Td>
                <Td className="font-mono text-xs text-mute">{row.action}</Td>
                <Td className="font-mono text-xs text-mute">#{row.record_id}</Td>
                <Td className="font-mono text-xs text-mute">{String(row.changed_at)}</Td>
              </tr>
            ))}
            {audit.length === 0 && (
              <tr>
                <Td className="text-mute" colSpan={4}>
                  No changes recorded yet.
                </Td>
              </tr>
            )}
          </tbody>
        </Table>
      </Card>
    </section>
  );
}
