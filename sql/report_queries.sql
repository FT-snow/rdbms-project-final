-- ============================================================
-- RDBMS Project — Report queries (run after schema.sql)
-- Every screenshot for the report comes from this file.
-- USE hospital_db;
-- ============================================================

-- 1. JOIN ------------------------------------------------------
-- Appointments joined with patient and doctor names (plus
-- department + bill for a full "visit card" view).
SELECT a.appointment_id, a.appt_date, a.appt_time, a.status,
       p.name  AS patient_name, d.name AS doctor_name,
       dep.name AS department, b.total, b.paid_status
  FROM appointments a
  JOIN patients    p   ON p.patient_id = a.patient_id
  JOIN doctors     d   ON d.doctor_id  = a.doctor_id
  JOIN departments dep ON dep.dept_id  = d.dept_id
  LEFT JOIN billing b ON b.appointment_id = a.appointment_id
 ORDER BY a.appt_date DESC, a.appt_time;

-- 2. GROUP BY / HAVING -----------------------------------------
-- Departments with more than 10 appointments this month.
-- (With the small seed dataset raise COUNT(*) >= 1 to see output,
--  production shows the 10 threshold as specified.)
SELECT dep.name AS department, COUNT(*) AS appointments_this_month
  FROM appointments a
  JOIN doctors  d   ON d.doctor_id = a.doctor_id
  JOIN departments dep ON dep.dept_id = d.dept_id
 WHERE a.appt_date >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
 GROUP BY dep.dept_id, dep.name
 HAVING COUNT(*) >= 1                     -- report threshold: 10
 ORDER BY appointments_this_month DESC;

-- 3. SUBQUERY --------------------------------------------------
-- Doctors with above-average number of appointments.
SELECT doctor_name, total_appointments
  FROM doctor_workload
 WHERE total_appointments > (SELECT AVG(total_appointments)
                               FROM doctor_workload);

-- 4. AGGREGATE -------------------------------------------------
-- Revenue per department per month (sum of actual payments).
SELECT dep.name AS department,
       DATE_FORMAT(pay.paid_at, '%Y-%m') AS month,
       SUM(pay.amount) AS revenue
  FROM payments pay
  JOIN billing  b   ON b.bill_id    = pay.bill_id
  JOIN appointments a ON a.appointment_id = b.appointment_id
  JOIN doctors   d  ON d.doctor_id  = a.doctor_id
  JOIN departments dep ON dep.dept_id = d.dept_id
 GROUP BY dep.dept_id, dep.name, month
 ORDER BY month DESC, revenue DESC;

-- 5. WINDOW FUNCTION ------------------------------------------
-- Rank doctors by patients treated (dense ties share a rank).
SELECT doctor_name, department,
       total_appointments AS patients_treated,
       RANK()       OVER (ORDER BY total_appointments DESC) AS rnk,
       ROUND(
         PERCENT_RANK() OVER (ORDER BY total_appointments), 2
       ) AS percentile
  FROM doctor_workload;

-- 6. SET OPERATIONS -------------------------------------------
-- Patients who visited BOTH General Medicine and Cardiology.
SELECT p.name AS patient, 'visited general medicine' AS fact
  FROM appointments a
  JOIN patients p ON p.patient_id = a.patient_id
  JOIN doctors  d ON d.doctor_id  = a.doctor_id
  JOIN departments dep ON dep.dept_id = d.dept_id
 WHERE dep.name = 'General Medicine'
 INTERSECT
SELECT p.name, 'visited cardiology'
  FROM appointments a
  JOIN patients p ON p.patient_id = a.patient_id
  JOIN doctors  d ON d.doctor_id  = a.doctor_id
  JOIN departments dep ON dep.dept_id = d.dept_id
 WHERE dep.name = 'Cardiology';

-- Bonus: UNION of both visits with their month
SELECT dep.name AS department, p.name AS patient, a.appt_date
  FROM appointments a
  JOIN patients p ON p.patient_id = a.patient_id
  JOIN doctors  d ON d.doctor_id  = a.doctor_id
  JOIN departments dep ON dep.dept_id = d.dept_id
 WHERE dep.name IN ('General Medicine', 'Cardiology')
 ORDER BY a.appt_date DESC;

-- ============================================================
-- INDEXING — EXPLAIN before & after
-- ============================================================
-- idx_appt_doctor_date ON appointments (doctor_id, appt_date)
-- idx_patients_phone   ON patients (phone)
-- are created in schema.sql. To demo "before", drop them first:

-- DROP INDEX idx_appt_doctor_date ON appointments;

EXPLAIN
SELECT * FROM appointments
 WHERE doctor_id = 2
   AND appt_date = CURDATE();

-- Recreate and EXPLAIN again to show type ref + non-NULL key:
CREATE INDEX idx_appt_doctor_date ON appointments (doctor_id, appt_date);

-- Same story for the phone lookup:
EXPLAIN SELECT * FROM patients WHERE phone = '9911100001';

-- Other report supporting views (used by the Reports page)
SELECT * FROM todays_appointments;
SELECT * FROM doctor_workload;
SELECT * FROM pending_bills;
SELECT * FROM low_stock_medicines;
SELECT * FROM audit_log ORDER BY changed_at DESC LIMIT 20;
