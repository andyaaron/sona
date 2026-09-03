import { expect } from '@playwright/test'
import type { APIRequestContext } from '@playwright/test'

/** Seeded by the Task 08 migration; assumed present in every Local database. */
export const SEED = {
  organizationId: '11111111-1111-1111-1111-111111111111',
  siteId: '22222222-2222-2222-2222-222222222222',
  departmentId: '33333333-3333-3333-3333-333333333333',
} as const

export type Role = 'system_admin' | 'org_admin' | 'staff' | 'unassigned'

/**
 * Switch the signed-in dev user's role. Goes through `PUT /api/local/me/role`
 * (LocalDevController — answers 404 outside ASPNETCORE_ENVIRONMENT=Local) because
 * the real user endpoints refuse to let a caller change their own role, so an
 * org_admin/staff dev user could never get back to system_admin. Roles are read
 * per request; reload the page afterwards.
 */
export async function setMyRole(
  request: APIRequestContext,
  role: Role,
  options: { organizationId?: string; departmentIds?: string[] } = {},
) {
  const needsOrg = role === 'org_admin' || role === 'staff'
  const response = await request.put('/api/local/me/role', {
    data: {
      role,
      organizationId: needsOrg ? (options.organizationId ?? SEED.organizationId) : null,
      departmentIds: role === 'staff' ? (options.departmentIds ?? [SEED.departmentId]) : [],
    },
  })
  expect(response.ok(), `set role ${role}: ${response.status()}`).toBeTruthy()
}

export const asSystemAdmin = (request: APIRequestContext) => setMyRole(request, 'system_admin')
export const asOrgAdmin = (request: APIRequestContext, organizationId?: string) =>
  setMyRole(request, 'org_admin', { organizationId })
export const asStaff = (request: APIRequestContext, departmentIds?: string[]) =>
  setMyRole(request, 'staff', { departmentIds })
