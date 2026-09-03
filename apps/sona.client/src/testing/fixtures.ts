import type {
  AppUserSummary,
  Department,
  MessageOut,
  OpieScheduledPatient,
  Organization,
  Patient,
  Provider,
  Site,
  User,
} from '@sona/shared'

/**
 * The ids the Task 08 migration seeds. They are deliberately NOT RFC 4122
 * (variant nibble 1/2/3) — they are what broke Task 11, so every org fixture
 * uses them and any id validation must keep accepting them.
 */
export const SEED = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  siteId: '22222222-2222-2222-2222-222222222222',
  departmentId: '33333333-3333-3333-3333-333333333333',
} as const

/** A Guid.CreateVersion7() id, as EntityBase mints for new rows. */
export const V7_ID = '019b0e6a-7c3e-7f1a-8f2b-3c4d5e6f7a8b'

const TIMESTAMP = '2026-09-01T00:00:00.0000000'

let sequence = 0
const nextId = () => ++sequence

export function makeUser(overrides: Partial<User> = {}): User {
  return {
    hca34Id: 'DEV001',
    displayName: 'Dev Admin',
    email: 'dev.admin@example.com',
    role: 'system_admin',
    organizationId: null,
    organizationName: null,
    departmentIds: [],
    departments: [],
    department: null,
    ...overrides,
  }
}

export function makeOrgAdminUser(overrides: Partial<User> = {}): User {
  return makeUser({
    role: 'org_admin',
    organizationId: SEED.organizationId,
    organizationName: 'Default Practice',
    ...overrides,
  })
}

export function makeStaffUser(overrides: Partial<User> = {}): User {
  return makeUser({
    role: 'staff',
    organizationId: SEED.organizationId,
    organizationName: 'Default Practice',
    departmentIds: [SEED.departmentId],
    departments: [{ id: SEED.departmentId, name: 'General' }],
    ...overrides,
  })
}

export function makeOrganization(overrides: Partial<Organization> = {}): Organization {
  return {
    id: SEED.organizationId,
    name: 'Default Practice',
    type: 'practice',
    isActive: true,
    createDate: TIMESTAMP,
    modDate: TIMESTAMP,
    ...overrides,
  }
}

export function makeSite(overrides: Partial<Site> = {}): Site {
  return {
    id: SEED.siteId,
    organizationId: SEED.organizationId,
    name: 'Main',
    isActive: true,
    createDate: TIMESTAMP,
    modDate: TIMESTAMP,
    ...overrides,
  }
}

export function makeDepartment(overrides: Partial<Department> = {}): Department {
  return {
    id: SEED.departmentId,
    siteId: SEED.siteId,
    name: 'General',
    isActive: true,
    createDate: TIMESTAMP,
    modDate: TIMESTAMP,
    ...overrides,
  }
}

export function makeAppUser(overrides: Partial<AppUserSummary> = {}): AppUserSummary {
  const id = overrides.id ?? nextId()
  return {
    id,
    hca34Id: `DEV${String(id).padStart(3, '0')}`,
    displayName: `User ${id}`,
    email: `user${id}@example.com`,
    role: 'staff',
    organizationId: SEED.organizationId,
    departmentIds: [SEED.departmentId],
    lastLogin: TIMESTAMP,
    ...overrides,
  }
}

export function makePatient(overrides: Partial<Patient> = {}): Patient {
  const id = overrides.id ?? String(nextId())
  return {
    id,
    mrn: `MRN-${id}`,
    firstName: 'Test',
    lastName: `Patient ${id}`,
    dob: '1990-01-01',
    phoneNumber: '+15555550100',
    smsConsent: true,
    smsConsentDate: TIMESTAMP,
    hasApp: false,
    inCerner: false,
    importSource: 'ui',
    isActive: true,
    primaryProviderId: null,
    primaryProviderName: null,
    ...overrides,
  }
}

export function makeProvider(overrides: Partial<Provider> = {}): Provider {
  return {
    id: V7_ID,
    firstName: 'Pat',
    lastName: 'Provider',
    credentials: 'MD',
    npi: '1234567890',
    specialty: null,
    appUserId: null,
    isActive: true,
    createDate: TIMESTAMP,
    modDate: TIMESTAMP,
    ...overrides,
  }
}

export function makeMessageOut(overrides: Partial<MessageOut> = {}): MessageOut {
  return {
    id: V7_ID,
    patientId: '1',
    opiePatientId: null,
    smsConsentAttested: false,
    sentByUserId: 1,
    channel: 'sms',
    messageTemplateId: null,
    departmentId: SEED.departmentId,
    body: null,
    mobileNumber: null,
    status: 'failed',
    providerMessageSid: null,
    failureReason: 'sms-not-configured',
    createdAt: TIMESTAMP,
    sentAt: null,
    deliveredAt: null,
    ...overrides,
  }
}

export function makeOpieScheduledPatient(
  overrides: Partial<OpieScheduledPatient> = {},
): OpieScheduledPatient {
  const id = overrides.opiePatientId ?? String(nextId())
  return {
    opiePatientId: id,
    lastName: `Opie ${id}`,
    firstName: 'Test',
    middleName: null,
    nickName: null,
    emailAddress: `opie${id}@example.com`,
    comment: null,
    primaryPractitioner: 'Dr. Example',
    languagePref: 'English',
    appointments: [{ startTime: '2026-09-03T09:00:00', endTime: '2026-09-03T09:30:00' }],
    phoneNumbers: [{ number: '555-0100', extension: null, country: 'US' }],
    ...overrides,
  }
}
