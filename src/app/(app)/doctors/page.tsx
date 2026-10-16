import { getDoctors, getSchedules, getDepartments } from "@/lib/queries";
import { createDoctorAction, createScheduleAction } from "@/server/actions";
import { Table, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { DbUnavailable } from "@/components/db-unavailable";

export const dynamic = "force-dynamic";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default async function DoctorsPage() {
  let dbErr: unknown;
  const all = await Promise.all([getDoctors(), getSchedules(), getDepartments()]).catch(
    (e) => ((dbErr = e), null),
  );
  if (!all) return <DbUnavailable page="doctors" error={dbErr} />;
  const [doctors, schedules, departments] = all;
  const deptName = new Map(departments.map((d) => [d.dept_id, d.name]));
  const byDoctor = new Map<number, any[]>();
  for (const s of schedules) {
    byDoctor.set(s.doctor_id, [...(byDoctor.get(s.doctor_id) ?? []), s]);
  }

  return (
    <section className="space-y-10">
      <header>
        <h1 className="font-serif text-4xl leading-[1.1] tracking-[-0.03em]">
          Doctors & schedules
        </h1>
        <p className="mt-1 text-mute">
          Weekly shifts gate every booking — a slot outside a schedule is rejected at insert time.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        {doctors.map((doc) => (
          <article key={doc.doctor_id} className="rounded-card border border-line bg-surface p-6">
            <header className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-serif text-lg tracking-[-0.02em]">{doc.name}</h2>
                <p className="text-sm text-mute">
                  {doc.specialization} · {doc.department}
                </p>
                <p className="mt-1 font-mono text-[11px] text-mute">
                  {doc.phone} · ₹{Number(doc.consultation_fee).toLocaleString("en-IN")} consult
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-mute">
                #{doc.doctor_id}
              </span>
            </header>
            <ul className="mt-4 flex flex-wrap gap-2">
              {(byDoctor.get(doc.doctor_id) ?? []).map((s) => (
                <li
                  key={s.schedule_id}
                  className="rounded-full border border-line bg-bone px-2.5 py-0.5 font-mono text-[11px] text-mute"
                >
                  {DAYS[s.day_of_week - 1]} {s.start_time.slice(0, 5)}–{s.end_time.slice(0, 5)}
                </li>
              ))}
              {(byDoctor.get(doc.doctor_id) ?? []).length === 0 && (
                <li className="text-xs text-mute">No shifts registered.</li>
              )}
            </ul>
          </article>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-card border border-line bg-surface p-6">
          <h2 className="font-serif text-lg tracking-[-0.02em]">Add doctor</h2>
          <form action={createDoctorAction} className="mt-4 space-y-4">
            <Field label="Name">
              <Input name="name" required placeholder="Dr. …" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Department">
                <Select name="dept_id" required>
                  {departments.map((d) => (
                    <option key={d.dept_id} value={d.dept_id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Consultation fee (₹)">
                <Input name="consultation_fee" type="number" min="1" step="0.01" required />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Specialization">
                <Input name="specialization" required />
              </Field>
              <Field label="Phone">
                <Input name="phone" required />
              </Field>
            </div>
            <Button className="w-full">Add doctor</Button>
          </form>
        </div>

        <div className="rounded-card border border-line bg-surface p-6">
          <h2 className="font-serif text-lg tracking-[-0.02em]">Add schedule</h2>
          <form action={createScheduleAction} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Doctor">
                <Select name="doctor_id" required>
                  {doctors.map((d) => (
                    <option key={d.doctor_id} value={d.doctor_id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Day">
                <Select name="day_of_week" required defaultValue="1">
                  {DAYS.map((label, i) => (
                    <option key={label} value={i + 1}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start">
                <Input name="start_time" type="time" required />
              </Field>
              <Field label="End">
                <Input name="end_time" type="time" required />
              </Field>
            </div>
            <p className="text-xs text-mute">
              Overlapping shifts on the same day are rejected before insert.
            </p>
            <Button variant="outline" className="w-full">
              Add schedule
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}
