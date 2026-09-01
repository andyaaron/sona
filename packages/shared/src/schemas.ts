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

export const userRoleSchema = z.enum(["system_admin", "org_admin", "staff", "unassigned"]);

export const organizationTypeSchema = z.enum(["practice", "hospital"]);

export const createOrganizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(200),
  type: organizationTypeSchema,
});

export const createSiteSchema = z.object({
  name: z.string().min(1, "Site name is required").max(200),
});

export const updateSiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Site name is required").max(200).optional(),
  isActive: z.boolean().optional(),
});

export const createDepartmentSchema = z.object({
  name: z.string().min(1, "Department name is required").max(200),
});

export const updateDepartmentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Department name is required").max(200).optional(),
  isActive: z.boolean().optional(),
});

/**
 * Assign/edit a user's org, role and department scoping.
 * Enforced here: system_admin never has an org; departments only apply to staff.
 * Enforced server-side only (needs the org's department count): staff must get
 * ≥1 department when the org has more than one.
 */
export const updateUserSchema = z
  .object({
    role: userRoleSchema,
    organizationId: z.string().uuid().nullable(),
    departmentIds: z.array(z.string().uuid()).default([]),
  })
  .refine((d) => d.role !== "system_admin" || d.organizationId === null, {
    message: "A system admin cannot belong to an organization",
    path: ["organizationId"],
  })
  .refine((d) => (d.role === "org_admin" || d.role === "staff" ? d.organizationId !== null : true), {
    message: "An organization is required for this role",
    path: ["organizationId"],
  })
  .refine((d) => d.role === "staff" || d.departmentIds.length === 0, {
    message: "Only staff are scoped to departments",
    path: ["departmentIds"],
  });

/** Invite-first onboarding: pre-provision a directory user with org + role + departments. */
export const inviteUserSchema = z.object({
  hca34Id: z.string().min(3, "34 ID is required").max(10),
  role: userRoleSchema.exclude(["unassigned"]),
  departmentIds: z.array(z.string().uuid()).default([]),
  /** Only honored for system_admin callers; org admins always invite into their own org. */
  organizationId: z.string().uuid().nullable().optional(),
});

export const notifyPatientSchema = z.object({
  /** Patient ids are int-strings ("1"), not uuids — matches PatientsController */
  patientId: z.string().regex(/^\d+$/, "Invalid patient id"),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
/** Pre-validation shape (z.input) — use for form defaultValues so TanStack Form's
 *  standard-schema validator types line up with the zod schema. */
export type CreatePatientFormValues = z.input<typeof createPatientSchema>;
export type CreateProviderFormValues = z.input<typeof createProviderSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type CreateProviderInput = z.infer<typeof createProviderSchema>;
export type UpdateProviderInput = z.infer<typeof updateProviderSchema>;
export type NotifyPatientInput = z.infer<typeof notifyPatientSchema>;
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type CreateSiteInput = z.infer<typeof createSiteSchema>;
export type UpdateSiteInput = z.infer<typeof updateSiteSchema>;
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentInput = z.infer<typeof updateDepartmentSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UpdateUserFormValues = z.input<typeof updateUserSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type InviteUserFormValues = z.input<typeof inviteUserSchema>;
export type CreateOrganizationFormValues = z.input<typeof createOrganizationSchema>;
