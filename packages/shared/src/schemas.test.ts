import { describe, expect, it } from "vitest";

import {
  createPatientSchema,
  createProviderSchema,
  e164Phone,
  inviteUserSchema,
  notifyPatientSchema,
  npiSchema,
  opieScheduleQuerySchema,
  updateDepartmentSchema,
  updateProviderSchema,
  updateSiteSchema,
  updateUserSchema,
} from "./schemas";

/**
 * The Task 08 migration seeds these ids. They are NOT RFC 4122 (variant nibble
 * 1/2/3), which zod 4's `.uuid()` rejects — the root cause of Task 11. Every id
 * field must keep accepting them alongside real Guid v7 values.
 */
const SEED_ORG = "11111111-1111-1111-1111-111111111111";
const SEED_SITE = "22222222-2222-2222-2222-222222222222";
const SEED_DEPARTMENT = "33333333-3333-3333-3333-333333333333";
const V7_ID = "019b0e6a-7c3e-7f1a-8f2b-3c4d5e6f7a8b";

function issuesAt(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }, path: string) {
  if (result.success) return [];
  return result.error!.issues.filter((i) => i.path.join(".") === path).map((i) => i.message);
}

const validPatient = {
  mrn: "MRN-001",
  firstName: "Test",
  lastName: "Patient",
  dob: "1990-01-01",
  phoneNumber: "+15555550100",
  smsConsent: true,
};

describe("id fields accept SQL Server uniqueidentifier values (Task 11 regression)", () => {
  it.each([SEED_ORG, SEED_SITE, SEED_DEPARTMENT, V7_ID])("updateUserSchema.organizationId accepts %s", (id) => {
    expect(updateUserSchema.safeParse({ role: "staff", organizationId: id }).success).toBe(true);
  });

  it("updateUserSchema.departmentIds accepts the seeded department", () => {
    const result = updateUserSchema.safeParse({
      role: "staff",
      organizationId: SEED_ORG,
      departmentIds: [SEED_DEPARTMENT, V7_ID],
    });
    expect(result.success).toBe(true);
  });

  it("inviteUserSchema accepts the seeded org and department", () => {
    const result = inviteUserSchema.safeParse({
      hca34Id: "ABC123",
      role: "staff",
      organizationId: SEED_ORG,
      departmentIds: [SEED_DEPARTMENT],
    });
    expect(result.success).toBe(true);
  });

  it("notifyPatientSchema.departmentId accepts the seeded department", () => {
    expect(notifyPatientSchema.safeParse({ patientId: "1", departmentId: SEED_DEPARTMENT }).success).toBe(true);
  });

  it("updateSiteSchema / updateDepartmentSchema accept the seeded ids", () => {
    expect(updateSiteSchema.safeParse({ id: SEED_SITE, isActive: false }).success).toBe(true);
    expect(updateDepartmentSchema.safeParse({ id: SEED_DEPARTMENT, name: "Renamed" }).success).toBe(true);
  });

  it("createPatientSchema.primaryProviderId / updateProviderSchema.id accept a seed-shaped id", () => {
    expect(createPatientSchema.safeParse({ ...validPatient, primaryProviderId: SEED_ORG }).success).toBe(true);
    expect(updateProviderSchema.safeParse({ id: SEED_ORG, isActive: false }).success).toBe(true);
  });

  it.each(["not-a-guid", "11111111-1111-1111-1111-11111111111", "", "11111111111111111111111111111111"])(
    "still rejects a malformed id (%s)",
    (id) => {
      expect(updateUserSchema.safeParse({ role: "staff", organizationId: id }).success).toBe(false);
      expect(updateSiteSchema.safeParse({ id }).success).toBe(false);
    },
  );
});

describe("updateUserSchema refinements", () => {
  it("system_admin cannot belong to an organization", () => {
    const result = updateUserSchema.safeParse({ role: "system_admin", organizationId: SEED_ORG });
    expect(issuesAt(result, "organizationId")).toEqual(["A system admin cannot belong to an organization"]);
  });

  it("system_admin with no organization is valid and departmentIds defaults to []", () => {
    const result = updateUserSchema.safeParse({ role: "system_admin", organizationId: null });
    expect(result.success).toBe(true);
    expect(result.data?.departmentIds).toEqual([]);
  });

  it.each(["org_admin", "staff"] as const)("%s requires an organization", (role) => {
    const result = updateUserSchema.safeParse({ role, organizationId: null });
    expect(issuesAt(result, "organizationId")).toEqual(["An organization is required for this role"]);
  });

  it("unassigned may have no organization", () => {
    expect(updateUserSchema.safeParse({ role: "unassigned", organizationId: null }).success).toBe(true);
  });

  it("only staff are scoped to departments", () => {
    const result = updateUserSchema.safeParse({
      role: "org_admin",
      organizationId: SEED_ORG,
      departmentIds: [SEED_DEPARTMENT],
    });
    expect(issuesAt(result, "departmentIds")).toEqual(["Only staff are scoped to departments"]);
  });
});

describe("inviteUserSchema", () => {
  it("rejects the unassigned role", () => {
    expect(inviteUserSchema.safeParse({ hca34Id: "ABC123", role: "unassigned", organizationId: null }).success).toBe(false);
  });

  it("requires a 34 ID", () => {
    const result = inviteUserSchema.safeParse({ hca34Id: "", role: "staff", organizationId: SEED_ORG });
    expect(issuesAt(result, "hca34Id")).toEqual(["34 ID is required"]);
  });

  it.each(["org_admin", "staff"] as const)("%s requires an organization (Task 11 bug 2)", (role) => {
    const missing = inviteUserSchema.safeParse({ hca34Id: "ABC123", role });
    expect(issuesAt(missing, "organizationId")).toEqual(["An organization is required for this role"]);
    const nulled = inviteUserSchema.safeParse({ hca34Id: "ABC123", role, organizationId: null });
    expect(issuesAt(nulled, "organizationId")).toEqual(["An organization is required for this role"]);
  });

  it("system_admin invites carry no organization", () => {
    const result = inviteUserSchema.safeParse({ hca34Id: "ABC123", role: "system_admin", organizationId: null });
    expect(result.success).toBe(true);
    expect(result.data?.departmentIds).toEqual([]);
  });
});

describe("notifyPatientSchema", () => {
  it("accepts an int-string patient id with or without a department", () => {
    expect(notifyPatientSchema.safeParse({ patientId: "42" }).success).toBe(true);
    expect(notifyPatientSchema.safeParse({ patientId: "42", departmentId: null }).success).toBe(true);
  });

  it("rejects a non-numeric patient id (patients are int PKs, not uuids)", () => {
    const result = notifyPatientSchema.safeParse({ patientId: V7_ID });
    expect(issuesAt(result, "patientId")).toEqual(["Invalid patient id"]);
  });
});

describe("createPatientSchema", () => {
  it("accepts a complete patient", () => {
    expect(createPatientSchema.safeParse(validPatient).success).toBe(true);
  });

  it("requires MRN, names and a YYYY-MM-DD date of birth", () => {
    const result = createPatientSchema.safeParse({ ...validPatient, mrn: "", firstName: "", lastName: "", dob: "01/01/1990" });
    expect(issuesAt(result, "mrn")).toEqual(["MRN is required"]);
    expect(issuesAt(result, "firstName")).toEqual(["First name is required"]);
    expect(issuesAt(result, "lastName")).toEqual(["Last name is required"]);
    expect(issuesAt(result, "dob")).toHaveLength(1);
  });

  it("requires an E.164 phone number", () => {
    const result = createPatientSchema.safeParse({ ...validPatient, phoneNumber: "555-555-0100" });
    expect(issuesAt(result, "phoneNumber")).toEqual(["Phone number must be E.164 format (+15551234567)"]);
  });

  it("SMS consent must be captured explicitly — no default", () => {
    const { smsConsent: _omitted, ...withoutConsent } = validPatient;
    const result = createPatientSchema.safeParse(withoutConsent);
    expect(issuesAt(result, "smsConsent")).toEqual(["SMS consent is required"]);
    expect(createPatientSchema.safeParse({ ...validPatient, smsConsent: false }).success).toBe(true);
  });

  it("never accepts a caller-supplied smsConsentDate", () => {
    const result = createPatientSchema.safeParse({ ...validPatient, smsConsentDate: "2026-01-01T00:00:00Z" });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("smsConsentDate");
  });
});

describe("primitive schemas", () => {
  it.each(["+15551234567", "+442071234567"])("e164Phone accepts %s", (phone) => {
    expect(e164Phone.safeParse(phone).success).toBe(true);
  });

  it.each(["15551234567", "+0155512345", "+1 555 123 4567"])("e164Phone rejects %s", (phone) => {
    expect(e164Phone.safeParse(phone).success).toBe(false);
  });

  it("npiSchema requires exactly 10 digits", () => {
    expect(npiSchema.safeParse("1234567890").success).toBe(true);
    expect(npiSchema.safeParse("123456789").success).toBe(false);
    expect(createProviderSchema.safeParse({ firstName: "A", lastName: "B", npi: "12345" }).success).toBe(false);
    expect(createProviderSchema.safeParse({ firstName: "A", lastName: "B", npi: null }).success).toBe(true);
  });
});

describe("opieScheduleQuerySchema", () => {
  it("accepts an ISO date or nothing", () => {
    expect(opieScheduleQuerySchema.safeParse({ date: "2026-09-03" }).success).toBe(true);
    expect(opieScheduleQuerySchema.safeParse({}).success).toBe(true);
  });

  it("rejects non-ISO dates", () => {
    expect(opieScheduleQuerySchema.safeParse({ date: "09/03/2026" }).success).toBe(false);
    expect(opieScheduleQuerySchema.safeParse({ date: "2026-9-3" }).success).toBe(false);
  });
});
