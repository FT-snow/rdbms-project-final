import { getPatient, getPatientHistory } from "@/lib/queries";
import { updatePatientAction } from "@/server/actions";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { DbUnavailable } from "@/components/db-unavailable";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TONE = { booked: "blue", completed: "green", cancelled: "red" } as const;

export default async function PatientHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let dbErr: unknown;
  const patient = await getPatient(Number(id)).catch((e) => ((dbErr = e), "db" as const));
  if (patient === "db") return <DbUnavailable page="patient history" error={dbErr} />;
  if (!patient) notFound();
  let dbErr2: unknown;
  const history = await getPatientHistory(Number(id)).catch((e) => ((dbErr2 = e), null));
  if (!history) return <DbUnavailable page="patient history" error={dbErr2} />;

  return (
    <section className="space-y-8">
      <header>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
          Patient #{patient.patient_id}
        </p>
        <h1 className="mt-1 font-serif text-4xl leading-[1.1] tracking-[-0.03em]">
          {patient.name}
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-mute">
          <span>{patient.age} yrs · {patient.gender}</span>
          <span className="font-mono text-xs">{patient.phone}</span>
          {patient.email && <span>{patient.email}</span>}
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <h2 className="font-serif text-xl tracking-[-0.02em]">Visit history</h2>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Doctor</Th>
                <Th>Status</Th>
                <Th>Reason</Th>
                <Th>Bill</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row.appointment_id} className="hover:bg-bone">
                  <Td className="whitespace-nowrap tabular-nums">
                    {row.appt_date} {row.appt_time}
                  </Td>
                  <Td>
                    {row.doctor_name}
                    <span className="block text-xs text-mute">{row.department}</span>
                  </Td>
                  <Td><Badge tone={TONE[row.status as keyof typeof TONE]}>{row.status}</Badge></Td>
                  <Td className="max-w-40 truncate text-mute">{row.reason}</Td>
                  <Td>
                    {row.bill_id ? (
                      <span className="text-xs text-mute tabular-nums">
                        ₹{Number(row.total).toLocaleString("en-IN")} · {row.paid_status}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td>
                    <Link
                      href={`/appointments/${row.appointment_id}`}
                      className="text-xs underline underline-offset-4 decoration-line"
                    >
                      Open
                    </Link>
                  </Td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <Td className="text-mute" colSpan={6}>
                    No visits recorded yet.
                  </Td>
                </tr>
              )}
            </tbody>
          </Table>
        </div>

        <aside>
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="font-serif text-lg tracking-[-0.02em]">Update record</h2>
            <form action={updatePatientAction} className="mt-4 space-y-4">
              <input type="hidden" name="patient_id" value={patient.patient_id} />
              <Field label="Full name">
                <Input name="name" defaultValue={patient.name} required />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of birth">
                  <Input name="dob" type="date" defaultValue={patient.dob} required />
                </Field>
                <Field label="Gender">
                  <Select name="gender" defaultValue={patient.gender}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
              </div>
              <Field label="Phone">
                <Input name="phone" defaultValue={patient.phone} required />
              </Field>
              <Field label="Email">
                <Input name="email" defaultValue={patient.email ?? ""} />
              </Field>
              <Field label="Address">
                <Input name="address" defaultValue={patient.address ?? ""} />
              </Field>
              <Button variant="outline" className="w-full">
                Save changes
              </Button>
            </form>
          </div>
        </aside>
      </div>
    </section>
  );
}
