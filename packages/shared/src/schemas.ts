import { z } from "zod";

export const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone number must be E.164 format (+15551234567)");

export const npiSchema = z.string().regex(/^\d{10}$/, "NPI must be exactly 10 digits");

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
  primaryProviderId: z.string().uuid().nullable().optional(),
});

export const updatePatientSchema = createPatientSchema.partial().extend({
  id: z.string().min(1),
});

export const createProviderSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  credentials: z.string().max(50).nullable().optional(),
  npi: npiSchema.nullable().optional(),
  specialty: z.string().max(200).nullable().optional(),
  appUserId: z.number().int().nullable().optional(),
});

export const updateProviderSchema = createProviderSchema.partial().extend({
  id: z.string().uuid(),
  isActive: z.boolean().optional(),
});

export const notifyPatientSchema = z.object({
  patientId: z.string().uuid(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type NotifyPatientInput = z.infer<typeof notifyPatientSchema>;
