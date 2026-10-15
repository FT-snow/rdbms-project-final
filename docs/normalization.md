# Normalization Walkthrough — 1NF → 3NF

## Starting point: one flat "visit sheet"

Imagine the reception desk writes everything on a single form, one row per visit:

```
visit(patient_name, patient_dob, patient_phone, doctor_name, dept_name, fee,
      appt_date, appt_time, medicine1, dosage1, days1, medicine2, dosage2,
      days2, medicine3, dosage3, days3, total, paid_status, payment_method, amount)
```

## 1NF — atomic values, no repeating groups

**Violation:** `medicine1/2/3…` are repeating columns, and `address` in wall form
would hold a full address blob. Encoding multiple values in one column makes
queries and constraints fragile (how many medicines is "enough columns"?).

**Fix:** every cell holds exactly one atomic value; repeating groups move to a
separate row — effectively the `prescription_items` table, one row per
medicine per prescription.

```
visit(..., medicine, dosage, days)   -- one row per medicine
```

## 2NF — no partial dependencies on a composite key

After 1NF the natural key for the visit line is composite:
`(patient, doctor, appt_date, appt_time, medicine)`. Non-prime attributes
depend on **parts** of it:

- `fee` depends only on the *doctor* part
- `dob`, `phone` depend only on the *patient* part — same date/time rows
- `dosage`, `days` depend on the *medicine* part of the key

Partial dependencies breed anomalies: Dr. Rao's fee is stored on every single
appointment line; change it in one row and the data is inconsistent. Patient
details are copied into every visit row — a phone correction needs a sweep over
all visits.

**Fix:** split by key part:

- patients(patient_id, name, dob, gender, phone, email, address)
- doctors(doctor_id, name, dept_id, specialization, phone, consultation_fee)
- appointments(appointment_id, patient_id, doctor_id, appt_date, appt_time, status, reason)
- prescription_items(item, dosage, days) — keyed by prescription + medicine line

## 3NF — no transitive dependencies

Remaining chain: `appointment → doctor → department (name)`, and
`appointment → prescription → medicines`. Storing `department` or `fee` *inside*
appointments would make "change the department name" a multi-row update.
Also `billing.total` transitively depends on `consultation_fee + medicine_cost`.

**Fix (final 3NF schema):**

```
departments(dept_id, name)
doctors(doctor_id, name → dept_id, specialization, phone, consultation_fee)
patients(patient_id, name, dob, gender, phone, email, address)
doctor_schedules(schedule_id → doctor_id, day_of_week, start_time, end_time)
appointments(appointment_id → patient_id, → doctor_id, appt_date, appt_time, status, reason)
prescriptions(prescription_id → appointment_id [UNIQUE], diagnosis, notes)     -- 1:1
prescription_items(item_id → prescription_id, → medicine_id, dosage, days)     -- M:N bridge
medicines(medicine_id, name, price, stock)
billing(bill_id → appointment_id [UNIQUE], consultation_fee, medicine_cost, total, paid_status)
payments(payment_id → bill_id, amount, method, paid_at)
users(user_id, username, password_hash, role, doctor_id?)
audit_log(log_id, table_name, action, record_id, changed_at)
```

`total` is a kept *derived* value — denormalized deliberately because money
snapshots should not silently change when a medicine price is edited later
(this is a standard, defensible exception; the history must match what was
actually billed).

## Result

- **Update anomaly:** changing Dr. Rao's fee = updating one `doctors` row.
- **Insert anomaly:** a new department can exist before it has doctors.
- **Delete anomaly:** deleting a visit can't erase a patient or a medicine.
- **Consistency:** `status/status` and gender are `ENUM`s; stock can't go
  negative (`CHECK`); one slot can hold one appointment (`UNIQUE`), enforced
  physically rather than by convention.
