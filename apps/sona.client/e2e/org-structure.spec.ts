import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { uniqueSuffix } from './fixtures/data'
import { SEED, asSystemAdmin } from './fixtures/roles'

// Toasts stack; the newest is first
const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first()

test.describe('organization structure', () => {
  test.beforeEach(async ({ request }) => asSystemAdmin(request))

  test('add a site, add departments under it, deactivate one, then retire the site', async ({ page }) => {
    const suffix = uniqueSuffix()
    await page.goto('/organization')
    const sitesLoaded = page.waitForResponse((r) => r.url().includes('/sites') && r.request().method() === 'GET')
    await page.getByTestId('organization-org-select').selectOption(SEED.organizationId)
    await expect(page.getByTestId('organization-title')).toHaveText('Default Practice')
    await sitesLoaded

    // The sites level is collapsed while the org has a single site; earlier runs leave
    // retired sites behind, in which case the table is already shown.
    const single = page.getByTestId('org-sites-single')
    if (await single.isVisible()) {
      await expect(single).toContainText('Single site')
      await page.getByTestId('org-sites-show-button').click()
    }
    await expect(page.getByTestId('org-sites-table')).toBeVisible()

    await page.getByTestId('org-sites-add-button').click()
    await page.getByTestId('site-form-name').fill(`E2E Site ${suffix}`)
    const siteCreated = page.waitForResponse((r) => r.url().includes('/sites') && r.request().method() === 'POST')
    await page.getByTestId('site-form-submit').click()
    const site = await (await siteCreated).json()
    await expect(toast(page, 'Site added')).toBeVisible()
    await expect(page.getByTestId(`org-sites-table-row-${site.id}`)).toContainText(`E2E Site ${suffix}`)

    await page.getByTestId(`org-sites-select-${site.id}`).click()
    await expect(page.getByTestId('org-departments-title')).toContainText(`E2E Site ${suffix}`)

    const departmentIds: string[] = []
    for (const name of ['Lab', 'Imaging']) {
      await page.getByTestId('org-departments-add-button').click()
      await page.getByTestId('department-form-name').fill(`${name} ${suffix}`)
      const created = page.waitForResponse((r) => r.url().includes('/departments') && r.request().method() === 'POST')
      await page.getByTestId('department-form-submit').click()
      departmentIds.push((await (await created).json()).id)
      await expect(toast(page, 'Department added')).toBeVisible()
    }
    await expect(page.getByTestId(`org-departments-table-row-${departmentIds[1]}`)).toBeVisible()

    await page.getByTestId(`org-departments-toggle-active-${departmentIds[1]}`).click()
    await expect(toast(page, 'Department deactivated')).toBeVisible()
    await expect(page.getByTestId(`org-departments-table-row-${departmentIds[1]}`)).toContainText('(Inactive)')

    // The last active department of a site cannot be deactivated
    await page.getByTestId(`org-departments-toggle-active-${departmentIds[0]}`).click()
    await expect(toast(page, 'A site needs at least one active department.')).toBeVisible()

    await page.getByTestId(`org-sites-toggle-active-${site.id}`).click()
    await expect(toast(page, 'Site deactivated')).toBeVisible()
    await expect(page.getByTestId(`org-sites-table-row-${site.id}`)).toContainText('(Inactive)')
  })

  test('empty department name is rejected inline', async ({ page }) => {
    await page.goto('/organization')
    await page.getByTestId('organization-org-select').selectOption(SEED.organizationId)
    await page.getByTestId('org-departments-add-button').click()
    await page.getByTestId('department-form-submit').click()
    await expect(page.getByTestId('department-form-name-error')).toHaveText('Department name is required')
  })
})
