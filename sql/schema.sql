-- ============================================================
-- Hospital Appointment System — MySQL 8 Schema
-- 3NF · Constraints · Triggers · Procedures · Views · Sample data
-- Run with: mysql -u root -p < schema.sql
-- (or paste into MySQL Workbench and execute)
-- ============================================================

DROP DATABASE IF EXISTS hospital_db;
CREATE DATABASE hospital_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE hospital_db;

-- ------------------------------------------------------------
-- TABLES (3NF)
-- ------------------------------------------------------------

-- Login users (admin / doctor / receptionist)
CREATE TABLE users (
  user_id       INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role          ENUM('admin','doctor','receptionist') NOT NULL,
  doctor_id     INT UNSIGNED NULL,                  -- links a doctor login to doctors table
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_doctor FOREIGN KEY (doctor_id)
    REFERENCES doctors(doctor_id) ON DELETE SET NULL
);

CREATE TABLE departments (
  dept_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name    VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE doctors (
  doctor_id        INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name             VARCHAR(150) NOT NULL,
  dept_id          INT UNSIGNED NOT NULL,
  specialization   VARCHAR(100) NOT NULL,
  phone            VARCHAR(20)  NOT NULL,
  consultation_fee DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_doc_dept FOREIGN KEY (dept_id) REFERENCES departments(dept_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_doc_fee CHECK (consultation_fee > 0)
);

CREATE TABLE patients (
  patient_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(150) NOT NULL,
  dob        DATE         NOT NULL,
  gender     ENUM('male','female','other') NOT NULL,
  phone      VARCHAR(20)  NOT NULL,
  email      VARCHAR(150) NULL,
  address    VARCHAR(255) NULL
);
-- NOTE: dob <= today is enforced by trigger trg_patient_dob (below), because
-- MySQL 8 CHECK constraints cannot call nondeterministic functions like CURDATE().

CREATE TABLE doctor_schedules (
  schedule_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  doctor_id   INT UNSIGNED NOT NULL,
  day_of_week TINYINT UNSIGNED NOT NULL,            -- 1 = Monday … 7 = Sunday
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  CONSTRAINT fk_sched_doc FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_sched_time CHECK (start_time < end_time)
);

CREATE TABLE appointments (
  appointment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT UNSIGNED NOT NULL,
  doctor_id      INT UNSIGNED NOT NULL,
  appt_date      DATE NOT NULL,
  appt_time      TIME NOT NULL,
  status         ENUM('booked','completed','cancelled') NOT NULL DEFAULT 'booked',
  reason         VARCHAR(255) NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_doctor_slot (doctor_id, appt_date, appt_time),   -- prevents double booking
  CONSTRAINT fk_appt_patient FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_appt_doctor FOREIGN KEY (doctor_id) REFERENCES doctors(doctor_id)
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE medicines (
  medicine_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(150) NOT NULL UNIQUE,
  price       DECIMAL(10,2) NOT NULL,
  stock       INT NOT NULL DEFAULT 0,
  CONSTRAINT chk_med_price CHECK (price >= 0),
  CONSTRAINT chk_med_stock  CHECK (stock >= 0)
);

CREATE TABLE prescriptions (
  prescription_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id  INT UNSIGNED NOT NULL UNIQUE,     -- 1:1 with appointments
  diagnosis       VARCHAR(255) NOT NULL,
  notes           VARCHAR(500) NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pres_appt FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE prescription_items (
  item_id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  prescription_id INT UNSIGNED NOT NULL,
  medicine_id     INT UNSIGNED NOT NULL,
  dosage          VARCHAR(100) NOT NULL,            -- e.g. "1 tab 2x daily"
  days            SMALLINT UNSIGNED NOT NULL,
  CONSTRAINT fk_item_pres FOREIGN KEY (prescription_id) REFERENCES prescriptions(prescription_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_item_med  FOREIGN KEY (medicine_id) REFERENCES medicines(medicine_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_item_days CHECK (days > 0)
);

CREATE TABLE billing (
  bill_id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  appointment_id   INT UNSIGNED NOT NULL UNIQUE,    -- 1:1 with appointments
  consultation_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  medicine_cost    DECIMAL(10,2) NOT NULL DEFAULT 0,
  total            DECIMAL(10,2) NOT NULL DEFAULT 0,
  paid_status      ENUM('unpaid','paid') NOT NULL DEFAULT 'unpaid',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_bill_appt FOREIGN KEY (appointment_id) REFERENCES appointments(appointment_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT chk_bill_total CHECK (total >= 0)
);

CREATE TABLE payments (
  payment_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bill_id    INT UNSIGNED NOT NULL,
  amount     DECIMAL(10,2) NOT NULL,
  method     ENUM('cash','card','upi','insurance') NOT NULL,
  paid_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pay_bill FOREIGN KEY (bill_id) REFERENCES billing(bill_id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT chk_pay_amount CHECK (amount > 0)
);

CREATE TABLE audit_log (
  log_id     INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  table_name VARCHAR(64)  NOT NULL,
  action     ENUM('UPDATE','DELETE','INSERT') NOT NULL,
  record_id  INT UNSIGNED NOT NULL,
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for the report (EXPLAIN before/after demo lives in report_queries.sql)
CREATE INDEX idx_appt_doctor_date ON appointments (doctor_id, appt_date);
CREATE INDEX idx_patients_phone   ON patients (phone);

-- ------------------------------------------------------------
-- TRIGGERS
-- ------------------------------------------------------------

DELIMITER $$

-- 0) Patients: reject future dates of birth (CHECK can't call CURDATE())
CREATE TRIGGER trg_patient_dob
BEFORE INSERT ON patients
FOR EACH ROW
BEGIN
  IF NEW.dob > CURDATE() THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Date of birth cannot be in the future';
  END IF;
END$$

-- 1) After inserting a prescription item: reduce medicine stock
CREATE TRIGGER trg_item_insert
AFTER INSERT ON prescription_items
FOR EACH ROW
BEGIN
  UPDATE medicines
     SET stock = stock - 1
   WHERE medicine_id = NEW.medicine_id
     AND stock > 0;
END$$

-- 2) After marking an appointment completed: auto-create the billing row
CREATE TRIGGER trg_appt_completed
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
  IF NEW.status = 'completed' AND OLD.status <> 'completed' THEN
    INSERT INTO billing (appointment_id, consultation_fee, medicine_cost, total)
    SELECT NEW.appointment_id, d.consultation_fee, 0, d.consultation_fee
      FROM doctors d
     WHERE d.doctor_id = NEW.doctor_id;
  END IF;
END$$

-- 3) After inserting a payment: update billing paid_status
CREATE TRIGGER trg_payment_insert
AFTER INSERT ON payments
FOR EACH ROW
BEGIN
  DECLARE paid_sum DECIMAL(10,2);
  SELECT COALESCE(SUM(amount), 0) INTO paid_sum
    FROM payments WHERE bill_id = NEW.bill_id;
  UPDATE billing
     SET paid_status = IF(paid_sum >= total, 'paid', 'unpaid')
   WHERE bill_id = NEW.bill_id;
END$$

-- 4) After appointment UPDATE or DELETE: write to audit_log
CREATE TRIGGER trg_appt_audit_update
AFTER UPDATE ON appointments
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, action, record_id)
  VALUES ('appointments', 'UPDATE', NEW.appointment_id);
END$$

CREATE TRIGGER trg_appt_audit_delete
AFTER DELETE ON appointments
FOR EACH ROW
BEGIN
  INSERT INTO audit_log (table_name, action, record_id)
  VALUES ('appointments', 'DELETE', OLD.appointment_id);
END$$

-- ------------------------------------------------------------
-- FUNCTION + STORED PROCEDURES
-- ------------------------------------------------------------

-- Age calculator (used in views & pages)
CREATE FUNCTION calculate_age(dob DATE)
RETURNS TINYINT UNSIGNED DETERMINISTIC
BEGIN
  RETURN TIMESTAMPDIFF(YEAR, dob, CURDATE());
END$$

-- Book an appointment: checks the doctor's schedule, inserts, handles errors
CREATE PROCEDURE book_appointment(
  IN p_patient INT UNSIGNED,
  IN p_doctor  INT UNSIGNED,
  IN p_date    DATE,
  IN p_time    TIME,
  IN p_reason  VARCHAR(255)
)
BEGIN
  DECLARE scheduled TINYINT;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  SELECT COUNT(*) INTO scheduled
    FROM doctor_schedules
   WHERE doctor_id = p_doctor
     AND day_of_week = WEEKDAY(p_date) + 1
     AND start_time <= p_time AND end_time > p_time;

  IF scheduled = 0 THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Slot is outside the doctor\u0027s schedule';
  END IF;

  START TRANSACTION;
    INSERT INTO appointments (patient_id, doctor_id, appt_date, appt_time, status, reason)
    VALUES (p_patient, p_doctor, p_date, p_time, 'booked', p_reason);
  COMMIT;
END$$

-- Cancel an appointment: updates status; refunds by deleting payments if paid
CREATE PROCEDURE cancel_appointment(
  IN p_appt INT UNSIGNED
)
BEGIN
  DECLARE v_status VARCHAR(20);
  SELECT status INTO v_status FROM appointments WHERE appointment_id = p_appt;

  IF v_status = 'cancelled' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Appointment already cancelled';
  END IF;

  START TRANSACTION;
    DELETE FROM payments
     WHERE bill_id = (
           SELECT bill_id FROM billing
            WHERE appointment_id = p_appt AND paid_status = 'paid'
           );
    DELETE FROM billing WHERE appointment_id = p_appt;
    UPDATE appointments SET status = 'cancelled' WHERE appointment_id = p_appt;
  COMMIT;
END$$

-- Generate a bill: sum consultation fee + prescription medicine cost (ACID)
CREATE PROCEDURE generate_bill(
  IN p_appt INT UNSIGNED
)
BEGIN
  DECLARE v_fee    DECIMAL(10,2);
  DECLARE v_med    DECIMAL(10,2);

  SELECT d.consultation_fee INTO v_fee
    FROM appointments a JOIN doctors d ON d.doctor_id = a.doctor_id
   WHERE a.appointment_id = p_appt;

  SELECT COALESCE(SUM(m.price), 0) INTO v_med
    FROM prescriptions p
    JOIN prescription_items it ON it.prescription_id = p.prescription_id
    JOIN medicines m ON m.medicine_id = it.medicine_id
   WHERE p.appointment_id = p_appt;

  START TRANSACTION;
    UPDATE billing
       SET medicine_cost = v_med,
           total = v_fee + v_med
     WHERE appointment_id = p_appt;
  COMMIT;
END$$

-- Free slots for a doctor on a date (returns booked slots list; app filters)
CREATE PROCEDURE get_available_slots(
  IN p_doctor INT UNSIGNED,
  IN p_date   DATE
)
BEGIN
  SELECT s.start_time, s.end_time,
         (SELECT COUNT(*)
            FROM appointments a
           WHERE a.doctor_id = p_doctor
             AND a.appt_date = p_date
             AND a.appt_time < s.end_time
             AND a.appt_time >= s.start_time
             AND a.status <> 'cancelled') AS booked_count
    FROM doctor_schedules s
   WHERE s.doctor_id = p_doctor
     AND s.day_of_week = WEEKDAY(p_date) + 1;
END$$

DELIMITER ;

-- ------------------------------------------------------------
-- VIEWS
-- ------------------------------------------------------------

CREATE VIEW todays_appointments AS
SELECT a.appointment_id,
       p.name AS patient_name,
       d.name AS doctor_name,
       dep.name AS department,
       DATE_FORMAT(a.appt_time, '%H:%i') AS appt_time,
       a.status
  FROM appointments a
  JOIN patients p ON p.patient_id = a.patient_id
  JOIN doctors  d ON d.doctor_id  = a.doctor_id
  JOIN departments dep ON dep.dept_id = d.dept_id
 WHERE a.appt_date = CURDATE();

CREATE VIEW doctor_workload AS
SELECT d.doctor_id,
       d.name AS doctor_name,
       dep.name AS department,
       COUNT(a.appointment_id) AS total_appointments
  FROM doctors d
  JOIN departments dep ON dep.dept_id = d.dept_id
  LEFT JOIN appointments a ON a.doctor_id = d.doctor_id
 GROUP BY d.doctor_id, d.name, dep.name;

CREATE VIEW pending_bills AS
SELECT b.bill_id,
       p.name AS patient_name,
       d.name AS doctor_name,
       b.consultation_fee,
       b.medicine_cost,
       b.total,
       b.paid_status,
       b.created_at
  FROM billing b
  JOIN appointments a ON a.appointment_id = b.appointment_id
  JOIN patients p ON p.patient_id = a.patient_id
  JOIN doctors  d ON d.doctor_id  = a.doctor_id
 WHERE b.paid_status = 'unpaid';

CREATE VIEW low_stock_medicines AS
SELECT medicine_id, name, price, stock
  FROM medicines
 WHERE stock < 10;

-- ------------------------------------------------------------
-- SAMPLE DATA
-- ------------------------------------------------------------

INSERT INTO departments (name) VALUES
('General Medicine'), ('Cardiology'), ('Orthopedics'),
('Pediatrics'), ('Dermatology');

INSERT INTO doctors (name, dept_id, specialization, phone, consultation_fee) VALUES
('Dr. Ananya Rao',    2, 'Interventional Cardiology', '9876500001', 800.00),
('Dr. Vikram Shetty', 1, 'General Physician',         '9876500002', 400.00),
('Dr. Meera Pillai',  3, 'Joint Replacement',         '9876500003', 700.00),
('Dr. Rohan Gupta',   4, 'Child Specialist',          '9876500004', 350.00),
('Dr. Sara Thomas',   5, 'Clinical Dermatology',      '9876500005', 500.00),
('Dr. Arjun Menon',   1, 'General Physician',         '9876500006', 450.00);

INSERT INTO doctor_schedules (doctor_id, day_of_week, start_time, end_time) VALUES
-- Note: WEEKDAY() + 1 → 1 = Monday … 7 = Sunday
(1, 1, '09:00:00', '13:00:00'), (1, 2, '09:00:00', '13:00:00'),
(1, 3, '14:00:00', '18:00:00'),
(2, 1, '10:00:00', '16:00:00'), (2, 4, '09:00:00', '13:00:00'),
(3, 3, '09:00:00', '12:00:00'), (3, 5, '09:00:00', '12:00:00'),
(4, 2, '11:00:00', '17:00:00'), (4, 5, '10:00:00', '14:00:00'),
(5, 6, '09:00:00', '13:00:00'),
(6, 1, '14:00:00', '19:00:00'), (6, 6, '10:00:00', '15:00:00');

INSERT INTO patients (name, dob, gender, phone, email, address) VALUES
('Ravi Kumar',    '1985-04-12', 'male',   '9911100001', 'ravi@mail.com',   'MG Road, Bangalore'),
('Sunita Devi',   '1972-09-30', 'female', '9911100002', 'sunita@mail.com', 'Indiranagar, Bangalore'),
('Arun Nair',     '1998-01-20', 'male',   '9911100003', NULL,              'Koramangala, Bangalore'),
('Priya Menon',   '2015-06-05', 'female', '9911100004', NULL,              'HSR Layout, Bangalore'),
('Kiran Das',     '1960-11-11', 'male',   '9911100005', 'kiran@mail.com',  'Whitefield, Bangalore'),
('Lata Sharma',   '1990-03-17', 'female', '9911100006', NULL,              'Jayanagar, Bangalore'),
('Imran Khan',    '2001-08-23', 'male',   '9911100007', NULL,              'Marathahalli, Bangalore');

INSERT INTO medicines (name, price, stock) VALUES
('Paracetamol 500mg', 15.00, 200),
('Amoxicillin 250mg', 42.00,  80),
('Atorvastatin 10mg', 55.00,   8),   -- low stock on purpose
('Cetirizine 10mg',   9.00,  150),
('Metformin 500mg',   28.00,  60),
('Pantoprazole 40mg', 33.00,    5);  -- low stock on purpose

INSERT INTO users (username, password_hash, role, doctor_id) VALUES
-- All demo passwords are "password123" (bcrypt hashes below)
('admin',        '$2a$10$YCrqUo.jLlbgxVOpy/0RvuSCqIGDK4vtXQnEVvOOW0zKCQecwKhuK', 'admin',        NULL),
('reception',    '$2a$10$YCrqUo.jLlbgxVOpy/0RvuSCqIGDK4vtXQnEVvOOW0zKCQecwKhuK', 'receptionist', NULL),
('dr.ananya',    '$2a$10$YCrqUo.jLlbgxVOpy/0RvuSCqIGDK4vtXQnEVvOOW0zKCQecwKhuK', 'doctor',       1),
('dr.vikram',    '$2a$10$YCrqUo.jLlbgxVOpy/0RvuSCqIGDK4vtXQnEVvOOW0zKCQecwKhuK', 'doctor',       2);

-- A few appointments across the past week so the report views have data
INSERT INTO appointments (patient_id, doctor_id, appt_date, appt_time, status, reason) VALUES
(1, 2, CURDATE() - INTERVAL 3 DAY, '10:30:00', 'completed', 'Recurring headaches'),
(2, 1, CURDATE() - INTERVAL 3 DAY, '09:30:00', 'completed', 'Chest discomfort'),
(3, 2, CURDATE() - INTERVAL 1 DAY, '11:00:00', 'completed', 'Seasonal fever'),
(4, 4, CURDATE(),                  '11:30:00', 'booked',    'Routine checkup'),
(5, 1, CURDATE(),                  '09:30:00', 'booked',    'Ongoing BP treatment'),
(6, 3, CURDATE() + INTERVAL 2 DAY, '09:30:00', 'booked',    'Knee pain'),
(7, 2, CURDATE() + INTERVAL 3 DAY, '12:00:00', 'booked',    'Fatigue and body ache');

INSERT INTO prescriptions (appointment_id, diagnosis, notes) VALUES
(1, 'Tension headache', 'Stay hydrated, monitor BP'),
(2, 'Coronary insufficiency - initial eval', 'ECG follow-up in a week'),
(3, 'Viral fever', 'Rest for 3 days');

INSERT INTO prescription_items (prescription_id, medicine_id, dosage, days) VALUES
(1, 1, '1 tablet after lunch', 5),
(1, 3, '1 tablet at night',    30),
(2, 2, '1 capsule 2x daily',   7),
(3, 4, '1 tablet at bedtime',  3),
(3, 6, '1 tablet twice daily', 5);

-- Bills for completed appointments (auto-created by trigger, medicine cost added here)
INSERT INTO billing (appointment_id, consultation_fee, medicine_cost, total, paid_status) VALUES
(1, 400.00, 15.00 + 55.00, 470.00, 'paid'),
(2, 800.00, 42.00,          842.00, 'unpaid'),
(3, 400.00,  9.00 + 33.00,  442.00, 'unpaid');

INSERT INTO payments (bill_id, amount, method) VALUES
(1, 470.00, 'cash');
