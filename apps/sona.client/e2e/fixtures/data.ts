import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

import { SEED } from './roles'

/**
 * Test data goes through the real API with unique identifiers so specs never
 * depend on each other's rows. Patients are soft-deleted in cleanup; users have
 * no delete endpoint, so invited test users keep the `E2E` prefix and stay.
 */
export const uniqueSuffix = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.toUpperCase()

export interface PatientSeed {
  mrn: string
  firstName: string
  lastName: string
  dob: string
  phoneNumber: string
  smsConsent: boolean
  primaryProviderId?: string | null
}

export function patientSeed(overrides: Partial<PatientSeed> = {}): PatientSeed {
  const suffix = uniqueSuffix()
  return {
    mrn: `E2E-${suffix}`,
    firstName: 'E2E',
    lastName: `Patient ${suffix}`,
    dob: '1990-01-01',
    phoneNumber: '+15555550100',
    smsConsent: true,
    ...overrides,
  }
}

/** system_admin callers must name the org in the body; org_admin/staff are scoped to their own. */
export async function createPatient(
  request: APIRequestContext,
  overrides: Partial<PatientSeed> = {},
  scope: { organizationId?: string } = {},
) {
  const response = await request.post('/api/patients', { data: { ...patientSeed(overrides), ...scope } })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()) as { id: string; mrn: string; firstName: string; lastName: string }
}

export async function deletePatient(request: APIRequestContext, id: string, scope: { organizationId?: string } = {}) {
  const qs = scope.organizationId ? `?organizationId=${scope.organizationId}` : ''
  const response = await request.delete(`/api/patients/${id}${qs}`)
  expect([204, 400, 404]).toContain(response.status())
}

export async function createOrganization(request: APIRequestContext) {
  const response = await request.post('/api/organizations', {
    data: { name: `E2E Org ${uniqueSuffix()}`, type: 'practice' },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()) as { id: string; name: string }
}

export async function inviteUser(
  request: APIRequestContext,
  input: { role: 'system_admin' | 'org_admin' | 'staff'; organizationId?: string | null; departmentIds?: string[] },
) {
  // 34 IDs are at most 10 chars; the random tail (not the timestamp head) keeps them unique within a run
  const hca34Id = `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`
  // Staff need a department once the org has more than one (earlier runs add some)
  const departmentIds = input.role === 'staff' ? [SEED.departmentId] : []
  const response = await request.post('/api/users/invite', {
    data: { hca34Id, departmentIds, organizationId: null, ...input },
  })
  expect(response.status(), await response.text()).toBe(201)
  return (await response.json()) as { id: number; hca34Id: string; role: string }
}
