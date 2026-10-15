import { z } from "zod";

export const loginSchema = z.object({
  username: z.string().min(3, "Username too short"),
  password: z.string().min(6, "Password too short"),
});

export const patientSchema = z.object({
  name: z.string().min(3, "Name is required"),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date"),
  gender: z.enum(["male", "female", "other"]),
  phone: z.string().regex(/^[0-9+\-\s]{6,20}$/, "Enter a valid phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  address: z.string().max(255).optional().or(z.literal("")),
});

export const doctorSchema = z.object({
  name: z.string().min(3),
  dept_id: z.coerce.number().int().positive(),
  specialization: z.string().min(3),
  phone: z.string().regex(/^[0-9+\-\s]{6,20}$/),
  consultation_fee: z.coerce.number().positive("Fee must be > 0"),
});

export const scheduleSchema = z
  .object({
    doctor_id: z.coerce.number().int().positive(),
    day_of_week: z.coerce.number().int().min(1).max(7),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  })
  .refine((s) => s.start_time < s.end_time, {
    message: "Start time must be before end time",
    path: ["end_time"],
  });

export const patientStrong = z.string().min(3);

export const medicineSchema = z.object({
  name: z.string().min(3),
  price: z.coerce.number().min(0),
  stock: z.coerce.number().int().min(0, "Stock must be >= 0"),
});

export const prescriptionSchema = z.object({
  diagnosis: z.string().min(3, "Diagnosis is required"),
  notes: z.string().max(500).optional().or(z.literal("")),
  items: z
    .array(
      z.object({
        medicine_id: z.coerce.number().int().positive(),
        dosage: z.string().min(3),
        days: z.coerce.number().int().positive(),
      })
    )
    .min(1, "Add at least one medicine"),
});

export const bookSchema = z.object({
  patient_id: z.coerce.number().int().positive(),
  doctor_id: z.coerce.number().int().positive(),
  appt_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  appt_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  reason: z.string().max(255).optional().or(z.literal("")),
});

export const paymentSchema = z.object({
  bill_id: z.coerce.number().int().positive(),
  amount: z.coerce.number().positive(),
  method: z.enum(["cash", "card", "upi", "insurance"]),
});
