import { expect, test } from '@playwright/test'

import { asOrgAdmin, asStaff, asSystemAdmin } from './fixtures/roles'

test.describe('smoke', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ request }) => asSystemAdmin(request))
  test.afterEach(async ({ request }) => asSystemAdmin(request))

  test('loads, resolves the dev user and shows the system_admin nav', async ({ page, request }) => {
    const me = await (await request.get('/api/user')).json()

    await page.goto('/')

    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('header-user-id')).toHaveText(me.hca34Id)
    // Opie schedule region: CI has no OpieConnection, a developer machine may — accept either outcome.
    await expect(page.getByTestId('opie-schedule-toolbar')).toBeVisible()
    await expect(
      page.getByTestId('opie-schedule-unconfigured').or(page.getByTestId('opie-schedule-sheet')).or(page.getByTestId('opie-schedule-empty')),
    ).toBeVisible()
    for (const item of ['dashboard', 'patients', 'providers', 'user-management', 'organization', 'organizations']) {
      await expect(page.getByTestId(`header-nav-${item}`)).toBeVisible()
    }
  })

  for (const [path, region] of [
    ['/patients', 'patients-toolbar'],
    ['/patients/manage', 'patients-manage-toolbar'],
    ['/providers/manage', 'providers-page'],
    ['/user-management', 'users-page'],
    ['/organization', 'organization-toolbar'],
    ['/organizations', 'organizations-toolbar'],
  ] as const) {
    test(`${path} renders its main region`, async ({ page }) => {
      await page.goto(path)
      await expect(page.getByTestId(region)).toBeVisible()
    })
  }

  test('staff see their org in the header and no admin nav', async ({ page, request }) => {
    await asStaff(request)

    await page.goto('/')

    await expect(page.getByTestId('header-org-name')).toContainText('Default Practice')
    await expect(page.getByTestId('header-nav-patients')).toBeVisible()
    await expect(page.getByTestId('header-nav-providers')).toHaveCount(0)
    await expect(page.getByTestId('header-nav-user-management')).toHaveCount(0)
    await expect(page.getByTestId('header-nav-organization')).toHaveCount(0)
    await expect(page.getByTestId('header-nav-organizations')).toHaveCount(0)
  })

  test('providers are admin-only: staff get the gate and a 403 on write, but can still read the list', async ({ page, request }) => {
    // An admin creates a provider so the read path has something to show
    await asOrgAdmin(request)
    const created = await request.post('/api/providers', {
      data: { firstName: 'E2E', lastName: `Provider ${Date.now().toString(36)}`, credentials: 'MD', npi: null, specialty: null },
    })
    expect(created.status(), await created.text()).toBe(201)
    const provider = await created.json()

    await asStaff(request)
    await page.goto('/providers/manage')
    await expect(page.getByTestId('providers-forbidden')).toHaveText(
      /Only organization administrators can manage providers\./,
    )
    await expect(page.getByTestId('providers-add-button')).toHaveCount(0)

    expect((await request.post('/api/providers', { data: { firstName: 'Nope', lastName: 'Staff' } })).status()).toBe(403)
    expect((await request.put(`/api/providers/${provider.id}`, { data: { isActive: false } })).status()).toBe(403)
    expect((await request.get('/api/providers?isActive=true')).status()).toBe(200)

    await page.goto('/patients/manage')
    await page.getByTestId('patients-manage-add-button').click()
    await expect(page.getByTestId('patient-form-primary-provider').locator('option', { hasText: provider.lastName })).toHaveCount(1)

    await asOrgAdmin(request)
    expect((await request.put(`/api/providers/${provider.id}`, { data: { isActive: false } })).status()).toBe(200)
  })
})
