import { expect, test } from '@playwright/test'

import { createOrganization, createPatient, deletePatient } from './fixtures/data'
import { asOrgAdmin, asSystemAdmin } from './fixtures/roles'

test.describe('tenant scoping', () => {
  test.afterEach(async ({ request }) => asSystemAdmin(request))

  test("an org_admin cannot see or reach another org's patient, and has no Organizations nav", async ({ page, request }) => {
    await asSystemAdmin(request)
    const otherOrg = await createOrganization(request)
    const outsider = await createPatient(request, {}, { organizationId: otherOrg.id })

    await asOrgAdmin(request)
    await page.goto(`/patients?search=${outsider.mrn}`)
    await expect(page.getByTestId('patients-table-empty')).toHaveText('No patients found.')

    // Cross-org ids answer 404, not 403 — existence is not leaked
    expect((await request.get(`/api/patients/${outsider.id}`)).status()).toBe(404)
    expect((await request.get(`/api/patients/${outsider.id}/notifications`)).status()).toBe(404)

    await expect(page.getByTestId('header-nav-organizations')).toHaveCount(0)
    await page.goto('/organizations')
    await expect(page.getByTestId('organizations-forbidden')).toBeVisible()

    await asSystemAdmin(request)
    await deletePatient(request, outsider.id, { organizationId: otherOrg.id })
  })
})
