"use client";

import { useState } from "react";
import { savePrescriptionAction } from "@/server/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";

interface Medicine {
  medicine_id: number;
  name: string;
  price: string | number;
  stock: number;
}

type Row = { key: number; medicine_id: string; dosage: string; days: string };

let nextKey = 1;

export function PrescriptionForm({
  appointmentId,
  initialDiagnosis,
  initialNotes,
  medicines,
}: {
  appointmentId: number;
  initialDiagnosis: string;
  initialNotes: string;
  medicines: Medicine[];
}) {
  const [rows, setRows] = useState<Row[]>(
    initialDiagnosis ? [] : [{ key: 0, medicine_id: "", dosage: "", days: "1" }]
  );
  nextKey = 1;

  const addRow = () =>
    setRows((r) => [...r, { key: nextKey++, medicine_id: "", dosage: "", days: "1" }]);
  const removeRow = (key: number) =>
    setRows((r) => (r.length > 1 ? r.filter((row) => row.key !== key) : r));

  return (
    <form
      action={savePrescriptionAction}
      className="rounded-card border border-line bg-surface p-6 card-shadow"
    >
      <input type="hidden" name="appointment_id" value={appointmentId} />
      <h3 className="font-serif text-lg tracking-[-0.02em]">
        {initialDiagnosis ? "Update prescription" : "Write prescription"}
      </h3>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label="Diagnosis">
          <Input
            name="diagnosis"
            defaultValue={initialDiagnosis}
            required
            placeholder="e.g. viral fever"
          />
        </Field>
        <Field label="Notes">
          <Input name="notes" defaultValue={initialNotes} placeholder="Further instructions" />
        </Field>
      </div>

      <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.08em] text-mute">
        Medicines — inserting a row decrements stock via trigger{" "}
        <span className="normal-case">trg_item_insert</span>
      </p>
      <div className="mt-2 space-y-2">
        {(rows.length ? rows : [{ key: -1, medicine_id: "", dosage: "", days: "" }]).map(
          (row, i) => (
            <div key={row.key} className="grid grid-cols-[1fr_1fr_72px_40px] items-start gap-2">
              <Select name="medicine_id" defaultValue={row.medicine_id}>
                <option value="">Medicine…</option>
                {medicines.map((m) => (
                  <option key={m.medicine_id} value={m.medicine_id}>
                    {m.name} (₹{Number(m.price).toFixed(2)}, {m.stock} in stock)
                  </option>
                ))}
              </Select>
              <Input name="dosage" placeholder="1 tab 2x daily" defaultValue={row.dosage} />
              <Input name="days" type="number" min="1" defaultValue={row.days} placeholder="Days" />
              <Button
                type="button"
                variant="ghost"
                aria-label="Remove medicine row"
                onClick={() => (row.key !== -1 ? removeRow(row.key) : undefined)}
                className="justify-center px-0"
              >
                −
              </Button>
            </div>
          )
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button type="button" variant="outline" onClick={addRow}>
          + Add medicine
        </Button>
        <Button type="submit">Save prescription &amp; update bill</Button>
      </div>
    </form>
  );
}
