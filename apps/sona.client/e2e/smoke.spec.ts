import { expect, test } from '@playwright/test'

import { asStaff, asSystemAdmin } from './fixtures/roles'

test.describe('smoke', { tag: '@smoke' }, () => {
  test.beforeEach(async ({ request }) => asSystemAdmin(request))
  test.afterEach(async ({ request }) => asSystemAdmin(request))

  test('loads, resolves the dev user and shows the system_admin nav', async ({ page, request }) => {
    const me = await (await request.get('/api/user')).json()

    await page.goto('/')

    await expect(page.getByTestId('dashboard')).toBeVisible()
    await expect(page.getByTestId('header-user-id')).toHaveText(me.hca34Id)
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
    await expect(page.getByTestId('header-nav-user-management')).toHaveCount(0)
    await expect(page.getByTestId('header-nav-organization')).toHaveCount(0)
    await expect(page.getByTestId('header-nav-organizations')).toHaveCount(0)
  })
})
