import { getAppointment } from "@/lib/queries";
import {
  completeAppointmentAction,
  cancelAppointmentAction,
  savePrescriptionAction,
  addPaymentAction,
  regenerateBillAction,
} from "@/server/actions";
import { Table, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { PrescriptionForm } from "./prescription-form";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TONE = { booked: "blue", completed: "green", cancelled: "red" } as const;

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getAppointment(Number(id));
  if (!data) notFound();
  const { appointment, prescription, items, bill, medicines } = data;
  const balance = bill ? Number(bill.total) - bill.paid : 0;

  return (
    <section className="space-y-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
            Appointment #{appointment.appointment_id} · {appointment.department}
          </p>
          <h1 className="mt-1 font-serif text-4xl leading-[1.1] tracking-[-0.03em]">
            {appointment.patient_name} — {appointment.doctor_name}
          </h1>
          <p className="mt-2 font-mono text-xs text-mute">
            {appointment.appt_date} at {appointment.appt_time}
            {appointment.reason ? ` · ${appointment.reason}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={TONE[appointment.status as keyof typeof TONE]}>{appointment.status}</Badge>
          {appointment.status !== "cancelled" && (
            <form action={cancelAppointmentAction}>
              <input type="hidden" name="appointment_id" value={appointment.appointment_id} />
              <Button variant="danger" name="cancel">
                Cancel visit
              </Button>
            </form>
          )}
          {appointment.status === "booked" && (
            <form action={completeAppointmentAction}>
              <input type="hidden" name="appointment_id" value={appointment.appointment_id} />
              <Button>Mark completed</Button>
            </form>
          )}
        </div>
      </header>

      <div className="space-y-6">
        <h2 className="font-serif text-xl tracking-[-0.02em]">Prescription</h2>
        {prescription ? (
          <div>
            <p className="mb-3 text-sm">
              <span className="font-medium">Diagnosis:</span> {prescription.diagnosis}
              {prescription.notes ? <span className="text-mute"> · {prescription.notes}</span> : null}
            </p>
            <Table>
              <thead>
                <tr>
                  <Th>Medicine</Th>
                  <Th>Dosage</Th>
                  <Th>Days</Th>
                  <Th>Price</Th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.item_id}>
                    <Td>{it.name}</Td>
                    <Td className="text-mute">{it.dosage}</Td>
                    <Td className="tabular-nums text-mute">{it.days}</Td>
                    <Td className="tabular-nums">₹{Number(it.price).toFixed(2)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        ) : prescription === null ? null : null}
        {appointment.status === "booked" || appointment.status === "completed" ? (
          <PrescriptionForm
            appointmentId={appointment.appointment_id}
            initialDiagnosis={prescription?.diagnosis ?? ""}
            initialNotes={prescription?.notes ?? ""}
            medicines={medicines}
          />
        ) : null}
      </div>

      <div className="space-y-6">
        <h2 className="font-serif text-xl tracking-[-0.02em]">Billing</h2>
        {!bill ? (
          <p className="rounded-card border border-line bg-surface p-6 text-sm text-mute">
            The bill appears automatically the moment the appointment is marked
            <span className="font-mono"> completed</span> (trigger{" "}
            <span className="font-mono">trg_appt_completed</span>).
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-card border border-line bg-surface p-6">
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-mute">Consultation fee</dt>
                  <dd className="tabular-nums">₹{Number(bill.consultation_fee).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-mute">Medicine cost</dt>
                  <dd className="tabular-nums">₹{Number(bill.medicine_cost).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between border-t border-line pt-2 font-medium">
                  <dt>Total</dt>
                  <dd className="tabular-nums">₹{Number(bill.total).toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-mute">Paid so far</dt>
                  <dd className="tabular-nums">₹{bill.paid.toFixed(2)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-mute">Status</dt>
                  <dd>
                    <Badge tone={bill.paid_status === "paid" ? "green" : "yellow"}>
                      {bill.paid_status}
                    </Badge>
                  </dd>
                </div>
              </dl>
              <form action={regenerateBillAction} className="mt-4">
                <input type="hidden" name="appointment_id" value={appointment.appointment_id} />
                <Button variant="ghost" className="text-xs">
                  Recalculate totals (generate_bill)
                </Button>
              </form>
            </div>

            <div className="rounded-card border border-line bg-surface p-6">
              <h3 className="font-serif text-lg tracking-[-0.02em]">Record payment</h3>
              <form action={addPaymentAction} className="mt-4 space-y-4">
                <input type="hidden" name="bill_id" value={bill.bill_id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Amount (₹)">
                    <Input
                      name="amount"
                      type="number"
                      step="0.01"
                      min="0.01"
                      defaultValue={balance > 0 ? balance.toFixed(2) : ""}
                      required
                    />
                  </Field>
                  <Field label="Method">
                    <Select name="method" defaultValue="upi">
                      <option value="cash">Cash</option>
                      <option value="card">Card</option>
                      <option value="upi">UPI</option>
                      <option value="insurance">Insurance</option>
                    </Select>
                  </Field>
                </div>
                <p className="text-xs text-mute">
                  Balance: ₹{balance.toFixed(2)} · overpaying is blocked; the trigger
                  flips the bill to <span className="font-mono">paid</span> when covered.
                </p>
                <Button className="w-full" disabled={balance <= 0}>
                  {balance <= 0 ? "Fully paid" : "Record payment"}
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
