import { pool } from "./db";

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */

export async function getDashboardData() {
  const [todayRows, statusCounts, revenue, pending, lowStock, workload] =
    await Promise.all([
      pool.execute(
        `SELECT a.appointment_id, p.name AS patient_name, d.name AS doctor_name,
                DATE_FORMAT(a.appt_time, '%H:%i') AS appt_time, a.status
           FROM appointments a
           JOIN patients p ON p.patient_id = a.patient_id
           JOIN doctors  d ON d.doctor_id  = a.doctor_id
          WHERE a.appt_date = CURDATE()
          ORDER BY a.appt_time`
      ),
      pool.execute(
        `SELECT status, COUNT(*) AS c FROM appointments
          WHERE appt_date = CURDATE() GROUP BY status`
      ),
      pool.execute(
        `SELECT DATE_FORMAT(b.created_at, '%Y-%m') AS month, SUM(p.amount) AS revenue
           FROM billing b JOIN payments p ON p.bill_id = b.bill_id
          GROUP BY month ORDER BY month DESC LIMIT 12`
      ),
      pool.execute(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS amount
           FROM billing WHERE paid_status = 'unpaid'`
      ),
      pool.execute(
        `SELECT name, stock FROM medicines WHERE stock < 10 ORDER BY stock ASC`
      ),
      pool.execute(
        `SELECT doctor_name, total_appointments
           FROM doctor_workload ORDER BY total_appointments DESC LIMIT 8`
      ),
    ]);

  const counts = Object.fromEntries(
    (statusCounts[0] as any[]).map((r) => [r.status, Number(r.c)])
  );
  return {
    todayRows: todayRows[0] as any[],
    todayCount: (todayRows[0] as any[]).length,
    bookingCount: counts["booked"] ?? 0,
    completedCount: counts["completed"] ?? 0,
    cancelledCount: counts["cancelled"] ?? 0,
    revenue: (revenue[0] as any[]).map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
    })),
    pendingBills: {
      count: Number((pending[0] as any[])[0]?.count ?? 0),
      amount: Number((pending[0] as any[])[0]?.amount ?? 0),
    },
    lowStock: (lowStock[0] as any[]).map((r) => ({
      name: r.name,
      stock: Number(r.stock),
    })),
    workload: (workload[0] as any[]).map((r) => ({
      doctor_name: r.doctor_name,
      total_appointments: Number(r.total_appointments),
    })),
  };
}

/* ------------------------------------------------------------------ *
 * Patients
 * ------------------------------------------------------------------ */

export async function searchPatients(q: string) {
  const like = `%${q}%`;
  const [rows] = await pool.execute(
    `SELECT patient_id, name, dob, gender, phone,
            TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age
       FROM patients
      WHERE name LIKE ? OR phone LIKE ?
      ORDER BY name LIMIT 50`,
    [like, like]
  );
  return rows as any[];
}

export async function getPatientHistory(patientId: number) {
  const [rows] = await pool.execute(
    `SELECT a.appointment_id, a.appt_date, DATE_FORMAT(a.appt_time, '%H:%i') AS appt_time,
            a.status, a.reason, d.name AS doctor_name, dep.name AS department,
            b.bill_id, b.total, b.paid_status
       FROM appointments a
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN departments dep ON dep.dept_id = d.dept_id
       LEFT JOIN billing b ON b.appointment_id = a.appointment_id
      WHERE a.patient_id = ?
      ORDER BY a.appt_date DESC, a.appt_time DESC`,
    [patientId]
  );
  return rows as any[];
}

export async function getPatient(id: number) {
  const [rows] = await pool.execute(
    `SELECT patient_id, name, DATE_FORMAT(dob, '%Y-%m-%d') AS dob, gender, phone,
            email, address, TIMESTAMPDIFF(YEAR, dob, CURDATE()) AS age
       FROM patients WHERE patient_id = ?`,
    [id]
  );
  return (rows as any[])[0] ?? null;
}

/* ------------------------------------------------------------------ *
 * Doctors & schedules
 * ------------------------------------------------------------------ */

export async function getDepartments() {
  const [rows] = await pool.execute(`SELECT dept_id, name FROM departments ORDER BY name`);
  return rows as any[];
}

export async function getDoctors(deptId?: number) {
  const sql = `SELECT d.doctor_id, d.name, d.specialization, d.phone,
                      d.consultation_fee, dep.name AS department,
                      dep.dept_id
                 FROM doctors d
                 JOIN departments dep ON dep.dept_id = d.dept_id
                ${deptId ? "WHERE d.dept_id = ?" : ""}
                ORDER BY d.name`;
  const [rows] = deptId
    ? await pool.execute(sql, [deptId])
    : await pool.execute(sql);
  return rows as any[];
}

export async function getSchedules() {
  const [rows] = await pool.execute(
    `SELECT s.schedule_id, s.doctor_id, d.name AS doctor_name,
            s.day_of_week, s.start_time, s.end_time
       FROM doctor_schedules s
       JOIN doctors d ON d.doctor_id = s.doctor_id
      ORDER BY d.name, s.day_of_week, s.start_time`
  );
  return rows as any[];
}

/* ------------------------------------------------------------------ *
 * Booking
 * ------------------------------------------------------------------ */

/** Free slots for a doctor on a date: 30-min grid within their schedule minus booked. */
export async function getAvailableSlots(doctorId: number, date: string) {
  const [conn] = await pool.execute(
    `SELECT TIME_FORMAT(s.start_time, '%H:%i') AS start_time,
            TIME_FORMAT(s.end_time, '%H:%i') AS end_time
       FROM doctor_schedules s
      WHERE s.doctor_id = ? AND s.day_of_week = WEEKDAY(?) + 1`,
    [doctorId, date]
  );
  const sched = conn as any[];
  if (sched.length === 0) return { scheduled: false, slots: [] as string[] };

  const [booked] = await pool.execute(
    `SELECT TIME_FORMAT(appt_time, '%H:%i') AS t FROM appointments
      WHERE doctor_id = ? AND appt_date = ? AND status <> 'cancelled'`,
    [doctorId, date]
  );
  const bookedSet = new Set((booked as any[]).map((r) => r.t));

  const slots: string[] = [];
  for (const s of sched) {
    const [sh, sm] = s.start_time.split(":").map(Number);
    const [eh, em] = s.end_time.split(":").map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    for (let t = start; t + 30 <= end; t += 30) {
      const hh = String(Math.floor(t / 60)).padStart(2, "0");
      const mm = String(t % 60).padStart(2, "0");
      const time = `${hh}:${mm}`;
      if (!bookedSet.has(time)) slots.push(time);
    }
  }
  return { scheduled: true, slots };
}

/* ------------------------------------------------------------------ *
 * Appointment detail
 * ------------------------------------------------------------------ */

export async function getAppointment(id: number) {
  const [rows] = await pool.execute(
    `SELECT a.appointment_id, a.appt_date, TIME_FORMAT(a.appt_time, '%H:%i') AS appt_time,
            a.status, a.reason, a.patient_id, p.name AS patient_name, p.phone AS patient_phone,
            d.doctor_id, d.name AS doctor_name, d.consultation_fee, dep.name AS department
       FROM appointments a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN departments dep ON dep.dept_id = d.dept_id
      WHERE a.appointment_id = ?`,
    [id]
  );
  const appt = (rows as any[])[0] ?? null;
  if (!appt) return null;
  const [pres] = await pool.execute(
    `SELECT p.prescription_id, p.diagnosis, p.notes
       FROM prescriptions p WHERE p.appointment_id = ?`,
    [id]
  );
  const presc = (pres as any[])[0] ?? null;
  let items: any[] = [];
  if (presc) {
    const [it] = await pool.execute(
      `SELECT it.item_id, it.dosage, it.days, m.medicine_id, m.name, m.price
         FROM prescription_items it
         JOIN medicines m ON m.medicine_id = it.medicine_id
        WHERE it.prescription_id = ?`,
      [presc.prescription_id]
    );
    items = it as any[];
  }
  const [bill] = await pool.execute(
    `SELECT b.bill_id, b.consultation_fee, b.medicine_cost, b.total, b.paid_status,
            COALESCE(SUM(pay.amount), 0) AS paid
       FROM billing b
       LEFT JOIN payments pay ON pay.bill_id = b.bill_id
      WHERE b.appointment_id = ?`,
    [id]
  );
  const billRow = (bill as any[])[0] ?? null;
  const [meds] = await pool.execute(
    `SELECT medicine_id, name, price, stock FROM medicines ORDER BY name`
  );
  return {
    appointment: appt,
    prescription: presc,
    items,
    bill: billRow
      ? { ...billRow, paid: Number(billRow.paid) }
      : null,
    medicines: meds as any[],
  };
}

/* ------------------------------------------------------------------ *
 * Medicines
 * ------------------------------------------------------------------ */

export async function getMedicines() {
  const [rows] = await pool.execute(
    `SELECT medicine_id, name, price, stock FROM medicines ORDER BY name`
  );
  return rows as any[];
}

/* ------------------------------------------------------------------ *
 * Reports
 * ------------------------------------------------------------------ */

export async function getReports() {
  const [busy] = await pool.execute(
    `SELECT dep.name AS department, COUNT(a.appointment_id) AS appts
       FROM departments dep
       JOIN doctors d ON d.dept_id = dep.dept_id
       LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
                                  AND a.appt_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
      GROUP BY dep.dept_id, dep.name
      HAVING appts >= 0
      ORDER BY appts DESC`
  );
  const [aboveAvg] = await pool.execute(
    `SELECT doctor_name, total_appointments
       FROM doctor_workload w
      WHERE total_appointments > (
            SELECT AVG(total_appointments) FROM doctor_workload
            )`
  );
  const [ranked] = await pool.execute(
    `SELECT doctor_name, department, total_appointments,
            RANK() OVER (ORDER BY total_appointments DESC) AS rnk
       FROM doctor_workload`
  );
  const [revDept] = await pool.execute(
    `SELECT dep.name AS department,
            DATE_FORMAT(pay.paid_at, '%Y-%m') AS month,
            SUM(pay.amount) AS revenue
       FROM payments pay
       JOIN billing b ON b.bill_id = pay.bill_id
       JOIN appointments a ON a.appointment_id = b.appointment_id
       JOIN doctors d ON d.doctor_id = a.doctor_id
       JOIN departments dep ON dep.dept_id = d.dept_id
      GROUP BY dep.dept_id, dep.name, month
      ORDER BY month DESC, revenue DESC`
  );
  const [audit] = await pool.execute(
    `SELECT table_name, action, record_id, changed_at
       FROM audit_log ORDER BY changed_at DESC LIMIT 10`
  );
  return {
    busy: busy as any[],
    aboveAvg: aboveAvg as any[],
    ranked: ranked as any[],
    revDept: revDept as any[],
    audit: audit as any[],
  };
}
export async function getAuditLog() {
  const [rows] = await pool.execute(
    `SELECT table_name, action, record_id, changed_at
       FROM audit_log ORDER BY changed_at DESC LIMIT 10`
  );
  return rows as any[];
}
