import { getDepartments, getDoctors, getAvailableSlots, searchPatients } from "@/lib/queries";
import { bookAppointmentAction } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { DbUnavailable } from "@/components/db-unavailable";
import { cn } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{
    dept?: string;
    doctor?: string;
    date?: string;
    patient?: string;
    time?: string;
  }>;
}) {
  const sp = await searchParams;
  const departments = await getDepartments().catch(() => null as null);
  if (!departments) return <DbUnavailable page="booking" />;
  const today = new Date().toISOString().slice(0, 10);

  const deptId = sp.dept ? Number(sp.dept) : undefined;
  const doctorId = sp.doctor ? Number(sp.doctor) : undefined;
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;

  const doctors = deptId ? await getDoctors(deptId) : [];
  const slots = doctorId ? await getAvailableSlots(doctorId, date) : null;
  const patientId = sp.patient ? Number(sp.patient) : undefined;
  const recentPatients = await searchPatients("");

  const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dowLabel = DOW[new Date(date + "T00:00:00").getDay()];

  return (
    <section className="space-y-8">
      <header>
        <h1 className="font-serif text-4xl leading-[1.1] tracking-[-0.03em]">
          Book appointment
        </h1>
        <p className="mt-1 text-mute">
          Slot booking runs in a transaction with <code>SELECT … FOR UPDATE</code> and a
          unique constraint on (doctor, date, time) — double booking is impossible by design.
        </p>
      </header>

      <ol className="flex flex-wrap gap-2 font-mono text-[11px] uppercase tracking-[0.08em]">
        {["1 · Department", "2 · Doctor", "3 · Date", "4 · Slot"].map((step, i) => (
          <li
            key={step}
            className={cn(
              "rounded-full border px-3 py-1",
              [deptId, doctorId, !!date, !!doctorId][i]
                ? "border-line bg-ink text-white"
                : "border-line bg-bone text-mute"
            )}
          >
            {step}
          </li>
        ))}
      </ol>

      {/* Step 1 — department */}
      <div>
        <h2 className="mb-3 font-serif text-xl tracking-[-0.02em]">Department</h2>
        <div className="flex flex-wrap gap-2">
          {departments.map((d) => (
            <Link
              key={d.dept_id}
              href={`/book?dept=${d.dept_id}&date=${date}`}
              className={cn(
                "rounded-md border px-4 py-2 text-sm transition hover:border-ink/40",
                deptId === d.dept_id
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-surface"
              )}
            >
              {d.name}
            </Link>
          ))}
        </div>
      </div>

      {/* Step 2 — doctor */}
      {deptId && (
        <div>
          <h2 className="mb-3 font-serif text-xl tracking-[-0.02em]">Doctor</h2>
          <div className="flex flex-wrap gap-2">
            {doctors.map((d) => (
              <Link
                key={d.doctor_id}
                href={`/book?dept=${deptId}&doctor=${d.doctor_id}&date=${date}${patientId ? `&patient=${patientId}` : ""}`}
                className={cn(
                  "rounded-md border px-4 py-2 text-sm transition hover:border-ink/40",
                  doctorId === d.doctor_id
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface"
                )}
              >
                {d.name}
                <span className={cn("block text-xs", doctorId === d.doctor_id ? "text-white/70" : "text-mute")}>
                  {d.specialization} · ₹{Number(d.consultation_fee)}
                </span>
              </Link>
            ))}
            {doctors.length === 0 && (
              <p className="text-sm text-mute">No doctors in this department.</p>
            )}
          </div>
        </div>
      )}

      {/* Step 3 — date */}
      {doctorId && (
        <form
          action="/book"
          method="GET"
          className="flex flex-wrap items-end gap-3 rounded-card border border-line bg-surface p-6"
        >
          <input type="hidden" name="dept" value={deptId} />
          <input type="hidden" name="doctor" value={doctorId} />
          {patientId && <input type="hidden" name="patient" value={patientId} />}
          <Field label={`Date — ${dowLabel}`} >
            <Input name="date" type="date" defaultValue={date} min={today} />
          </Field>
          <Button variant="outline" type="submit">
            Load slots
          </Button>
        </form>
      )}

      {/* Step 4 — slots + booking form */}
      {doctorId && slots && (
        <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
          <div>
            <h2 className="mb-3 font-serif text-xl tracking-[-0.02em]">Available slots — {date}</h2>
            {!slots.scheduled ? (
              <p className="rounded-card border border-line bg-surface p-6 text-sm text-mute">
                This doctor has no <span className="font-mono">doctor_schedules</span> row for{" "}
                {dowLabel}. Add a shift on the Doctors page first.
              </p>
            ) : slots.slots.length === 0 ? (
              <p className="rounded-card border border-line bg-surface p-6 text-sm text-mute">
                Fully booked for this date. Try another day.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {slots.slots.map((t) => (
                  <Link
                    key={t}
                    href={`/book?dept=${deptId}&doctor=${doctorId}&date=${date}&time=${t}${patientId ? `&patient=${patientId}` : ""}`}
                    className="rounded-md border border-line bg-surface px-3 py-2 font-mono text-xs hover:border-ink/40"
                  >
                    {t}
                  </Link>
                ))}
              </div>
            )}
            {sp.time && !slots.slots.includes(sp.time) && (
              <p className="mt-3 text-xs text-redtext">
                Slot {sp.time} is no longer free — pick another.
              </p>
            )}
          </div>

          {sp.time && slots.slots.includes(sp.time) && (
            <form
              action={bookAppointmentAction}
              className="space-y-4 rounded-card border border-line bg-surface p-6"
            >
              <h3 className="font-serif text-lg tracking-[-0.02em]">Confirm</h3>
              <p className="font-mono text-xs text-mute">
                {date} at {sp.time}
              </p>
              <Field label="Patient">
                <Select name="patient_id" defaultValue={patientId ?? ""} required>
                  <option value="" disabled>
                    Select patient…
                  </option>
                  {recentPatients.map((p) => (
                    <option key={p.patient_id} value={p.patient_id}>
                      {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <input type="hidden" name="doctor_id" value={doctorId} />
              <input type="hidden" name="appt_date" value={date} />
              <input type="hidden" name="appt_time" value={sp.time} />
              <Field label="Reason">
                <Input name="reason" placeholder="Describe the complaint" />
              </Field>
              <Button className="w-full">Book slot</Button>
            </form>
          )}
        </div>
      )}
    </section>
  );
}
