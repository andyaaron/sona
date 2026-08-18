import { z } from "zod";

export const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone number must be E.164 format (+15551234567)");

export const createPatientSchema = z.object({
  mrn: z.string().min(1, "MRN is required").max(50),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  /** ISO date (YYYY-MM-DD) */
  dob: z.iso.date({ error: "Date of birth is required" }),
  phoneNumber: e164Phone,
  /**
   * Must be explicitly captured from the patient — no default. The server
   * stamps smsConsentDate when this is true; sends are blocked while false.
   */
  smsConsent: z.boolean({ error: "SMS consent is required" }),
});

export const updatePatientSchema = createPatientSchema.partial().extend({
  id: z.string().min(1),
});

export const notifyPatientSchema = z.object({
  patientId: z.string().uuid(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type NotifyPatientInput = z.infer<typeof notifyPatientSchema>;
