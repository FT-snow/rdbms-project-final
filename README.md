# RDBMS Project — Hospital Appointment System (Final)

A complete clinic management stack: Next.js (App Router) + Bun frontend/backend on
MySQL 8 (mysql2), JWT auth with roles, Zod validation, Tailwind UI in a warm
monochrome editorial style, and an advanced draggable dashboard widget grid.

> Built by **Prakhar, Shaurya and Tanay** — RDBMS course project, final submission.

## Deliverables

| Deliverable | Where |
|---|---|
| ER diagram + relational schema | `docs/er-diagram.md` (Mermaid + dbdiagram.io source) |
| Normalization walkthrough (1NF → 3NF) | `docs/normalization.md` |
| Full SQL script (tables, triggers, procedures, views, sample data) | `sql/schema.sql` |
| Report queries (JOIN / GROUP BY-HAVING / subquery / aggregate / window / set ops + EXPLAIN) | `sql/report_queries.sql` |
| Detailed DBMS concepts report | `docs/rdbms-concepts.tex` (LaTeX source for the PDF) |
| Working app (this repository) | Next.js app — this README covers setup |
| Demo screenshots for the report | print the Reports page + MySQL Workbench output |

## Pages

1. **Login** — JWT session (12 h, HttpOnly cookie), roles: `admin`,
   `doctor`, `receptionist`; doctor accounts link to their `doctor_id`.
2. **Dashboard** — draggable widget board (today's appointments, revenue
   trend, pending bills, low stock, doctor workload). Rearrange by dragging,
   press-and-hold on touch, or `Alt` + arrows.
3. **Patients** — register, search by name/phone (indexed), full visit history
   with per-visit bill status.
4. **Doctors & schedules** — add doctors, define weekly shifts; a booking is
   rejected by a `BEFORE`-style schedule check if it lies outside a shift.
5. **Book appointment** — department → doctor → date → free-slot grid
   (30-minute slots derived from `doctor_schedules` minus booked ones).
6. **Appointment detail** — mark complete (auto-bill via trigger), write the
   prescription (dynamic medicine rows), record payments; overpay blocked.
7. **Medicines** — inventory with stock threshold badges and inline restock.
8. **Reports** — busiest departments, above-average doctors, RANK() board,
   revenue per department/month, live audit trail.

## DBMS concepts implemented

All commented inline in `sql/schema.sql`:

- **3NF schema** — `departments`, `doctors`, `patients`, `doctor_schedules`,
  `appointments`, `prescriptions`, `prescription_items` (M:N bridge),
  `medicines`, `billing`, `payments`, `users`, `audit_log`.
- **Constraints** — PK/FKs with `ON DELETE RESTRICT` / `CASCADE` / `SET NULL`,
  `UNIQUE (doctor_id, appt_date, appt_time)` double-booking guard,
  `CHECK consultation_fee > 0`, `CHECK stock >= 0`, `CHECK start_time < end_time`,
  `ENUM` for status/gender/method, `DEFAULT status = 'booked'`.
- **Triggers**
  - `trg_item_insert` — decrement medicine stock after prescription item insert
  - `trg_appt_completed` — auto-create billing row on completion
  - `trg_payment_insert` — flip `billing.paid_status` after payment insert
  - `trg_appt_audit_update` / `trg_appt_audit_delete` — audit trail
- **Procedures & function** — `book_appointment` (schedule check + error
  handling), `cancel_appointment` (status change + refund matching payments),
  `generate_bill` (fee + medicine cost), `get_available_slots`,
  `calculate_age(dob)`.
- **Views** — `todays_appointments`, `doctor_workload`, `pending_bills`,
  `low_stock_medicines`.
- **ACID transactions** — booking locks the doctor's date with
  `SELECT … FOR UPDATE` before insert; billing + payments run atomically with
  rollback; `Unique` + row-lock together make double booking impossible.
- **Indexing** — composite `appointments (doctor_id, appt_date)` +
  `patients (phone)`; `sql/report_queries.sql` includes EXPLAIN before/after.

## Getting started (local)

```bash
bun install
cp .env.example .env      # fill DB_USERNAME/DB_PASSWORD/JWT_SECRET
mysql -u root -p < sql/schema.sql
bun run dev               # http://localhost:3000
```

Demo logins (seeded in `schema.sql`): `admin`, `reception`, `dr.ananya` /
`dr.vikram` — password `password123`.

### MySQL Workbench / dbdiagram.io

- `sql/schema.sql` runs cleanly in MySQL Workbench (F5 lightning bolt).
- `docs/er-diagram.md` includes a ready-to-paste dbdiagram.io model.

## Deploying to Vercel

1. Push to GitHub → Vercel **Add New → Project** → import the repo.
2. Environment variables:
   `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `JWT_SECRET`.
   The DB must be cloud-reachable (PlanetScale / TiDB / RDS / tunnel);
   `localhost` will not work in production.
3. Run `sql/schema.sql` once against the remote DB.

## Team

- **Prakhar** — backend & DBMS design
- **Shaurya** — frontend & UI
- **Tanay** — reports, docs & LaTeX report
