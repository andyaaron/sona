import { z } from "zod";

export const e164Phone = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Phone number must be E.164 format (+15551234567)");

export const createPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phoneNumber: e164Phone,
});

export const notifyPatientSchema = z.object({
  patientId: z.string().uuid(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type NotifyPatientInput = z.infer<typeof notifyPatientSchema>;
