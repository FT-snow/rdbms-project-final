"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { pool, withConn } from "@/lib/db";
import {
  login as doAuth,
  createSessionCookie,
  clearSessionCookie,
} from "@/lib/auth";
import {
  loginSchema,
  patientSchema,
  doctorSchema,
  scheduleSchema,
  medicineSchema,
  paymentSchema,
  bookSchema,
} from "@/lib/validation";

type FormState = { error?: string; ok?: string } | null;

/* ---------------- auth ---------------- */

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const session = await doAuth(parsed.data.username, parsed.data.password);
  if (!session) return { error: "Invalid username or password" };
  await createSessionCookie(session);
  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}

/* ---------------- patients ---------------- */

export async function createPatientAction(formData: FormData): Promise<void> {
  const parsed = patientSchema.safeParse({
    name: formData.get("name"),
    dob: formData.get("dob"),
    gender: formData.get("gender"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    address: formData.get("address") || "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const { name, dob, gender, phone, email, address } = parsed.data as any;
  await pool.execute(
    `INSERT INTO patients (name, dob, gender, phone, email, address)
     VALUES (?, ?, ?, ?, NULLIF(?, ''), NULLIF(?, ''))`,
    [name, dob, gender, phone, email, address]
  );
  revalidatePath("/patients");
}

export async function updatePatientAction(formData: FormData): Promise<void> {
  const parsed = patientSchema.safeParse({
    name: formData.get("name"),
    dob: formData.get("dob"),
    gender: formData.get("gender"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    address: formData.get("address") || "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const { name, dob, gender, phone, email, address } = parsed.data as any;
  const id = Number(formData.get("patient_id"));
  await pool.execute(
    `UPDATE patients SET name = ?, dob = ?, gender = ?, phone = ?,
       email = NULLIF(?, ''), address = NULLIF(?, '')
     WHERE patient_id = ?`,
    [name, dob, gender, phone, email, address, id]
  );
  revalidatePath(`/patients/${id}`);
}

/* ---------------- doctors & schedules ---------------- */

export async function createDoctorAction(formData: FormData): Promise<void> {
  const parsed = doctorSchema.safeParse({
    name: formData.get("name"),
    dept_id: formData.get("dept_id"),
    specialization: formData.get("specialization"),
    phone: formData.get("phone"),
    consultation_fee: formData.get("consultation_fee"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const d = parsed.data as any;
  await pool.execute(
    `INSERT INTO doctors (name, dept_id, specialization, phone, consultation_fee)
     VALUES (?, ?, ?, ?, ?)`,
    [d.name, d.dept_id, d.specialization, d.phone, d.consultation_fee]
  );
  revalidatePath("/doctors");
}

export async function createScheduleAction(formData: FormData): Promise<void> {
  const parsed = scheduleSchema.safeParse({
    doctor_id: formData.get("doctor_id"),
    day_of_week: formData.get("day_of_week"),
    start_time: (formData.get("start_time") as string)?.length === 5
      ? formData.get("start_time") + ":00"
      : formData.get("start_time"),
    end_time: (formData.get("end_time") as string)?.length === 5
      ? formData.get("end_time") + ":00"
      : formData.get("end_time"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const s = parsed.data as any;
  // Overlap check within the same doctor/day
  const [rows] = await pool.execute(
    `SELECT 1 FROM doctor_schedules
      WHERE doctor_id = ? AND day_of_week = ?
        AND NOT (? >= end_time OR ? <= start_time)
      LIMIT 1`,
    [s.doctor_id, s.day_of_week, s.start_time, s.end_time]
  );
  if ((rows as any[]).length > 0)
    throw new Error("Schedule overlaps an existing shift");
  await pool.execute(
    `INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time)
     VALUES (?, ?, ?, ?)`,
    [s.doctor_id, s.day_of_week, s.start_time, s.end_time]
  );
  revalidatePath("/doctors");
}

/* ---------------- appointments (ACID booking) ---------------- */

export async function bookAppointmentAction(formData: FormData): Promise<void> {
  const parsed = bookSchema.safeParse({
    patient_id: formData.get("patient_id"),
    doctor_id: formData.get("doctor_id"),
    appt_date: formData.get("appt_date"),
    appt_time: (formData.get("appt_time") as string)?.length === 5
      ? formData.get("appt_time") + ":00"
      : formData.get("appt_time"),
    reason: formData.get("reason") || "",
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const b = parsed.data as any;

  const newId = await withConn(async (conn) => {
    await conn.beginTransaction();
    try {
      // Lock the doctor's slots for this date so two receptions can't race:
      // the second transaction waits here, then the UNIQUE(uq_doctor_slot)
      // constraint backs us up. Check schedule validity too.
      const [sched] = await conn.execute(
        `SELECT 1 FROM doctor_schedules
          WHERE doctor_id = ? AND day_of_week = WEEKDAY(?) + 1
            AND start_time <= ? AND end_time > ? LIMIT 1`,
        [b.doctor_id, b.appt_date, b.appt_time, b.appt_time]
      );
      if ((sched as any[]).length === 0)
        throw new Error("This slot is outside the doctor's schedule");

      await conn.execute(
        `SELECT appointment_id FROM appointments
          WHERE doctor_id = ? AND appt_date = ? FOR UPDATE`,
        [b.doctor_id, b.appt_date]
      );
      const [result]: any = await conn.execute(
        `INSERT INTO appointments (patient_id, doctor_id, appt_date, appt_time, status, reason)
         VALUES (?, ?, ?, ?, 'booked', NULLIF(?, ''))`,
        [b.patient_id, b.doctor_id, b.appt_date, b.appt_time, b.reason]
      );
      await conn.commit();
      return result.insertId as number;
    } catch (e) {
      await conn.rollback();
      if ((e as any).code === "ER_DUP_ENTRY")
        throw new Error("That slot was just booked. Pick another.");
      throw e;
    }
  });
  revalidatePath("/dashboard");
  redirect(`/appointments/${newId}`);
}

export async function completeAppointmentAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("appointment_id"));
  await pool.execute(
    `UPDATE appointments SET status = 'completed' WHERE appointment_id = ? AND status = 'booked'`,
    [id]
  );
  revalidatePath(`/appointments/${id}`);
  revalidatePath("/dashboard");
}

export async function cancelAppointmentAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("appointment_id"));
  // Uses the stored procedure (updates status, deletes payments + bill).
  await pool.execute(`CALL cancel_appointment(?)`, [id]);
  revalidatePath(`/appointments/${id}`);
  revalidatePath("/dashboard");
}

/* ---------------- prescription ---------------- */

export async function savePrescriptionAction(formData: FormData): Promise<void> {
  const appointmentId = Number(formData.get("appointment_id"));
  const diagnosis = String(formData.get("diagnosis") ?? "");
  const notes = String(formData.get("notes") ?? "");
  const medIds = formData.getAll("medicine_id").map(Number);
  const dosages = formData.getAll("dosage").map(String);
  const dayss = formData.getAll("days").map(Number);

  const valid = medIds.some((id) => id > 0) && diagnosis.length >= 3;
  if (!valid) throw new Error("Diagnosis and at least one medicine are required");

  await withConn(async (conn) => {
    await conn.beginTransaction();
    try {
      const [pres]: any = await conn.execute(
        `INSERT INTO prescriptions (appointment_id, diagnosis, notes) VALUES (?, ?, NULLIF(?, ''))
           ON DUPLICATE KEY UPDATE diagnosis = VALUES(diagnosis), notes = VALUES(notes)`,
        [appointmentId, diagnosis, notes]
      );
      let presId: number = pres.insertId;
      if (!presId) {
        const [existingPres] = await conn.execute(
          `SELECT prescription_id FROM prescriptions WHERE appointment_id = ?`,
          [appointmentId]
        );
        presId = (existingPres as any[])[0]?.prescription_id;
      }
      if (!presId) throw new Error("Could not resolve prescription");

      // fetch existing item meds of this prescription to avoid()
      const [existing] = await conn.execute(
        `SELECT medicine_id FROM prescription_items WHERE prescription_id = ?`,
        [presId]
      );
      const existingSet = new Set((existing as any[]).map((r) => r.medicine_id));

      for (let i = 0; i < medIds.length; i++) {
        if (!medIds[i] || !dosages[i] || !dayss[i]) continue;
        if (existingSet.has(medIds[i])) continue; // skip already-added med
        // Check stock before inserting (trigger will decrement it)
        const [med] = await conn.execute(
          `SELECT stock FROM medicines WHERE medicine_id = ? FOR UPDATE`,
          [medIds[i]]
        );
        const stock = (med as any[])[0]?.stock ?? 0;
        if (stock <= 0)
          throw new Error(`${medIds[i]} is out of stock`);
        await conn.execute(
          `INSERT INTO prescription_items (prescription_id, medicine_id, dosage, days)
           VALUES (?, ?, ?, ?)`,
          [presId, medIds[i], dosages[i], dayss[i]]
        );
      }
      // Bill now includes medicine cost (falls in the procedure)
      await conn.execute(`CALL generate_bill(?)`, [appointmentId]);
      await conn.commit();
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  });
  revalidatePath(`/appointments/${appointmentId}`);
}

/* ---------------- billing & payments ---------------- */

export async function addPaymentAction(formData: FormData): Promise<void> {
  const parsed = paymentSchema.safeParse({
    bill_id: formData.get("bill_id"),
    amount: formData.get("amount"),
    method: formData.get("method"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const p = parsed.data as any;

  await withConn(async (conn) => {
    await conn.beginTransaction();
    try {
      const [bill] = await conn.execute(
        `SELECT total, consultation_fee, appointment_id FROM billing WHERE bill_id = ? FOR UPDATE`,
        [p.bill_id]
      );
      const row = (bill as any[])[0];
      if (!row) throw new Error("Bill not found");
      // Don't overpay beyond remaining balance
      const [soFar] = await conn.execute(
        `SELECT COALESCE(SUM(amount),0) AS paid FROM payments WHERE bill_id = ?`,
        [p.bill_id]
      );
      const remaining =
        Number(row.total) - Number((soFar as any[])[0]?.paid ?? 0);
      if (p.amount > remaining) throw new Error(`Amount exceeds balance (₹${remaining})`);
      await conn.execute(
        `INSERT INTO payments (bill_id, amount, method) VALUES (?, ?, ?)`,
        [p.bill_id, p.amount, p.method]
      );
      await conn.commit(); // trigger trg_payment_insert updates paid_status
    } catch (e) {
      await conn.rollback();
      throw e;
    }
  });
  const r = await pool.execute(
    `SELECT appointment_id FROM billing WHERE bill_id = ?`,
    [p.bill_id]
  );
  const apptId = ((r[0] as any[])[0] as any)?.appointment_id;
  revalidatePath(`/appointments/${apptId}`);
  revalidatePath("/dashboard");
}

export async function regenerateBillAction(formData: FormData): Promise<void> {
  const appointmentId = Number(formData.get("appointment_id"));
  await pool.execute(`CALL generate_bill(?)`, [appointmentId]);
  revalidatePath(`/appointments/${appointmentId}`);
}

/* ---------------- medicines ---------------- */

export async function addMedicineAction(formData: FormData): Promise<void> {
  const parsed = medicineSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
    stock: formData.get("stock"),
  });
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const m = parsed.data as any;
  await pool.execute(
    `INSERT INTO medicines (name, price, stock) VALUES (?, ?, ?)`,
    [m.name, m.price, m.stock]
  );
  revalidatePath("/medicines");
}

export async function restockMedicineAction(formData: FormData): Promise<void> {
  const id = Number(formData.get("medicine_id"));
  const qty = Number(formData.get("qty"));
  if (!qty || qty <= 0) throw new Error("Quantity must be positive");
  await pool.execute(
    `UPDATE medicines SET stock = stock + ? WHERE medicine_id = ?`,
    [qty, id]
  );
  revalidatePath("/medicines");
}
