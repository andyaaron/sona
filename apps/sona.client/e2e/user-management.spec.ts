import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

import { inviteUser } from './fixtures/data'
import { SEED, asOrgAdmin, asSystemAdmin } from './fixtures/roles'

/** A user in the pending-approval queue: invited, then parked as `unassigned`. */
async function createPendingUser(request: APIRequestContext) {
  const user = await inviteUser(request, { role: 'staff', organizationId: SEED.organizationId })
  const parked = await request.put(`/api/users/${user.id}`, {
    data: { role: 'unassigned', organizationId: null, departmentIds: [] },
  })
  expect(parked.ok(), await parked.text()).toBeTruthy()
  return user
}

function countRequests(page: Page, method: string, pathPrefix: string) {
  let count = 0
  page.on('request', (req) => {
    if (req.method() === method && new URL(req.url()).pathname.startsWith(pathPrefix)) count += 1
  })
  return () => count
}

const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first()

test.describe('user management', () => {
  test.beforeEach(async ({ request }) => asSystemAdmin(request))
  test.afterEach(async ({ request }) => asSystemAdmin(request))

  test('pending queue lists an unassigned user; assigning moves them to the users table', { tag: '@smoke' }, async ({ page, request }) => {
    const pending = await createPendingUser(request)

    await page.goto('/user-management')
    await expect(page.getByTestId('users-pending-table-title')).toContainText('Pending approval')
    await expect(page.getByTestId(`users-pending-table-row-${pending.id}`)).toBeVisible()

    await page.getByTestId(`users-assign-${pending.id}`).click()
    await expect(page.getByTestId('user-access-form-title')).toContainText('Approve')
    await expect(page.getByTestId('user-access-form-role')).toHaveValue('staff')
    // Task 11 row 4: the seeded org is accepted, no "Invalid UUID"
    const departmentsLoaded = page.waitForResponse((r) => r.url().includes('/departments'))
    await page.getByTestId('user-access-form-organization').selectOption(SEED.organizationId)
    await departmentsLoaded
    await expect(page.getByTestId('user-access-form-organization-error')).toHaveCount(0)
    // The picker only appears once the org has more than one department (earlier runs add some)
    if (await page.getByTestId('user-access-form-departments').isVisible()) {
      await page.getByTestId(`user-access-form-department-${SEED.departmentId}`).check()
    }

    const saved = page.waitForResponse((r) => r.url().includes(`/api/users/${pending.id}`) && r.request().method() === 'PUT')
    await page.getByTestId('user-access-form-submit').click()
    expect((await saved).status()).toBe(200)

    await expect(toast(page, 'User updated')).toBeVisible()
    await expect(page.getByTestId(`users-table-row-${pending.id}`)).toBeVisible()
    await expect(page.getByTestId(`users-pending-table-row-${pending.id}`)).toHaveCount(0)
  })

  test('assign without an organization is blocked client-side (Task 11 row 2)', async ({ page, request }) => {
    const pending = await createPendingUser(request)
    await page.goto('/user-management')
    const puts = countRequests(page, 'PUT', '/api/users')

    await page.getByTestId(`users-assign-${pending.id}`).click()
    await page.getByTestId('user-access-form-submit').click()

    await expect(page.getByTestId('user-access-form-organization-error')).toHaveText(
      'An organization is required for this role',
    )
    expect(puts()).toBe(0)

    await page.getByTestId('user-access-form-organization').selectOption(SEED.organizationId)
    await expect(page.getByTestId('user-access-form-organization-error')).toHaveCount(0)
  })

  test('switching to system_admin clears the hidden organization and submits null (Task 11 row 3)', async ({ page, request }) => {
    const user = await inviteUser(request, { role: 'staff', organizationId: SEED.organizationId })
    await page.goto('/user-management')

    await page.getByTestId(`users-edit-${user.id}`).click()
    await expect(page.getByTestId('user-access-form-organization')).toHaveValue(SEED.organizationId)
    await page.getByTestId('user-access-form-role').selectOption('system_admin')
    await expect(page.getByTestId('user-access-form-organization')).toHaveCount(0)

    const saved = page.waitForResponse((r) => r.url().includes(`/api/users/${user.id}`) && r.request().method() === 'PUT')
    await page.getByTestId('user-access-form-submit').click()
    const response = await saved
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toMatchObject({ role: 'system_admin', organizationId: null, departmentIds: [] })
    await expect(toast(page, 'User updated')).toBeVisible()
  })

  test('a server rejection shows on the form as well as a toast', async ({ page, request }) => {
    await asOrgAdmin(request)
    const me = await (await request.get('/api/user')).json()
    const users: { id: number; hca34Id: string | null }[] = await (await request.get('/api/users')).json()
    const myRow = users.find((u) => u.hca34Id === me.hca34Id)
    expect(myRow).toBeDefined()

    await page.goto('/user-management')
    await page.getByTestId(`users-edit-${myRow!.id}`).click()
    // unassigned needs no org/departments, so nothing blocks client-side and the server answers
    await page.getByTestId('user-access-form-role').selectOption('unassigned')
    await page.getByTestId('user-access-form-submit').click()

    await expect(page.getByTestId('user-access-form-errors')).toHaveText('You cannot change your own role.')
    await expect(toast(page, 'You cannot change your own role.')).toBeVisible()
    await expect(page.getByTestId('user-access-form')).toBeVisible()
  })

  test('invite: directory search has no results in Local and validation blocks an empty invite', async ({ page }) => {
    await page.goto('/user-management')
    const posts = countRequests(page, 'POST', '/api/users/invite')

    await page.getByTestId('users-invite-button').click()
    await page.getByTestId('user-access-form-directory-input').fill('dev')
    await expect(page.getByTestId('user-access-form-directory-empty')).toHaveText('No matches.')

    await page.getByTestId('user-access-form-submit').click()
    await expect(page.getByTestId('user-access-form-directory-input-error')).toHaveText('34 ID is required')
    await expect(page.getByTestId('user-access-form-organization-error')).toHaveText(
      'An organization is required for this role',
    )
    expect(posts()).toBe(0)
  })
})
