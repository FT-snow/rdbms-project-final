import { searchPatients } from "@/lib/queries";
import { createPatientAction } from "@/server/actions";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const patients = await searchPatients(q);

  return (
    <section className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-4xl leading-[1.1] tracking-[-0.03em]">Patients</h1>
          <p className="mt-1 text-mute">Register, search and open full visit history.</p>
        </div>
        <form className="flex gap-2" role="search">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Name or phone…"
            className="w-56"
            aria-label="Search patients"
          />
          <Button variant="outline" type="submit">
            Search
          </Button>
        </form>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Age</Th>
              <Th>Gender</Th>
              <Th>Phone</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.patient_id} className="hover:bg-bone">
                <Td>
                  <Link
                    href={`/patients/${p.patient_id}`}
                    className="font-medium hover:underline underline-offset-4 decoration-line"
                  >
                    {p.name}
                  </Link>
                </Td>
                <Td className="text-mute tabular-nums">{p.age}</Td>
                <Td className="text-mute">{p.gender}</Td>
                <Td className="font-mono text-xs text-mute">{p.phone}</Td>
                <Td>
                  <Link href={`/book?patient=${p.patient_id}`} className="text-xs underline underline-offset-4 decoration-line">
                    Book
                  </Link>
                </Td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr>
                <Td className="text-mute" colSpan={5}>No patients found.</Td>
              </tr>
            )}
          </tbody>
        </Table>

        <aside>
          <div className="rounded-card border border-line bg-surface p-6">
            <h2 className="font-serif text-lg tracking-[-0.02em]">Register patient</h2>
            <form action={createPatientAction} className="mt-4 space-y-4">
              <Field label="Full name">
                <Input name="name" required minLength={3} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date of birth">
                  <Input name="dob" type="date" required />
                </Field>
                <Field label="Gender">
                  <Select name="gender" defaultValue="male">
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </Select>
                </Field>
              </div>
              <Field label="Phone">
                <Input name="phone" required placeholder="98765…" />
              </Field>
              <Field label="Email (optional)">
                <Input name="email" type="email" />
              </Field>
              <Field label="Address (optional)">
                <Input name="address" />
              </Field>
              <Button className="w-full">Register</Button>
            </form>
          </div>
        </aside>
      </div>
    </section>
  );
}
