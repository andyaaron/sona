import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

import { createPatient, deletePatient, patientSeed } from './fixtures/data'
import { asOrgAdmin, asSystemAdmin } from './fixtures/roles'

const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first()

test.describe('patients', () => {
  const created: string[] = []

  // org_admin: patients are scoped to the caller's org (system_admin needs an org picker — Task 15)
  test.beforeEach(async ({ request }) => asOrgAdmin(request))
  test.afterEach(async ({ request }) => {
    for (const id of created.splice(0)) await deletePatient(request, id)
    await asSystemAdmin(request)
  })

  test('create → appears in the list → search → edit', { tag: '@smoke' }, async ({ page }) => {
    const seed = patientSeed()
    await page.goto('/patients/manage')

    await page.getByTestId('patients-manage-add-button').click()
    await page.getByTestId('patient-form-mrn').fill(seed.mrn)
    await page.getByTestId('patient-form-first-name').fill(seed.firstName)
    await page.getByTestId('patient-form-last-name').fill(seed.lastName)
    await page.getByTestId('patient-form-dob').fill(seed.dob)
    await page.getByTestId('patient-form-phone-number').fill(seed.phoneNumber)
    await page.getByTestId('patient-form-sms-consent').check()

    const createdResponse = page.waitForResponse((r) => r.url().endsWith('/api/patients') && r.request().method() === 'POST')
    await page.getByTestId('patient-form-submit').click()
    const response = await createdResponse
    expect(response.status()).toBe(201)
    const patient = await response.json()
    created.push(patient.id)
    await expect(toast(page, 'Patient added successfully')).toBeVisible()
    await expect(page.getByTestId(`patients-manage-table-row-${patient.id}`)).toBeVisible()

    await page.getByTestId('patients-manage-search-toggle').click()
    await page.getByTestId('patients-manage-search-input').fill(seed.mrn)
    await expect(page).toHaveURL(/search=/)
    await expect(page.getByTestId('patients-manage-table-row-count')).toContainText('Showing 1 of 1')

    await page.getByTestId(`patients-manage-edit-${patient.id}`).click()
    await expect(page.getByTestId('patient-form-title')).toHaveText('Edit patient')
    await page.getByTestId('patient-form-last-name').fill(`${seed.lastName} Edited`)
    await page.getByTestId('patient-form-submit').click()
    await expect(toast(page, 'Patient updated successfully')).toBeVisible()
    await expect(page.getByTestId(`patients-manage-table-row-${patient.id}`)).toContainText('Edited')
  })

  test('validation blocks an empty patient with the documented messages', async ({ page }) => {
    await page.goto('/patients/manage')
    await page.getByTestId('patients-manage-add-button').click()
    await page.getByTestId('patient-form-submit').click()

    await expect(page.getByTestId('patient-form-mrn-error')).toHaveText('MRN is required')
    await expect(page.getByTestId('patient-form-first-name-error')).toHaveText('First name is required')
    await expect(page.getByTestId('patient-form-last-name-error')).toHaveText('Last name is required')
    await expect(page.getByTestId('patient-form-phone-number-error')).toContainText('E.164')
  })

  test('notify with consent: audited as failed / sms-not-configured in Local', async ({ page, request }) => {
    const patient = await createPatient(request, { smsConsent: true })
    created.push(patient.id)

    await page.goto(`/patients?search=${patient.mrn}`)
    await page.getByTestId(`notify-button-${patient.id}`).click()
    await expect(page.getByTestId('confirm-dialog-title')).toContainText(`${patient.firstName} ${patient.lastName}`)

    const sent = page.waitForResponse((r) => r.url().endsWith('/api/notifications/ready'))
    await page.getByTestId('confirm-dialog-confirm').click()
    const response = await sent
    expect(response.status()).toBe(201)
    expect(await response.json()).toMatchObject({ patientId: patient.id, status: 'failed', failureReason: 'sms-not-configured' })
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0)

    await page.getByTestId(`patients-history-${patient.id}`).click()
    await expect(page.getByTestId(`notification-history-table-${patient.id}-row-0`)).toContainText('failed')
  })

  test('notify without consent is refused with 409 (TCPA)', async ({ page, request }) => {
    const patient = await createPatient(request, { smsConsent: false })
    created.push(patient.id)

    await page.goto(`/patients?search=${patient.mrn}`)
    await page.getByTestId(`notify-button-${patient.id}`).click()
    const sent = page.waitForResponse((r) => r.url().endsWith('/api/notifications/ready'))
    await page.getByTestId('confirm-dialog-confirm').click()
    expect((await sent).status()).toBe(409)
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0)
    await expect(page.getByTestId(`notify-button-${patient.id}`)).toBeEnabled()
    // The 409 message is not shown to the user yet — docs/tasks/16 adds the toast.
  })
})
