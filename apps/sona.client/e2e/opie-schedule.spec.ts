import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page } from '@playwright/test'

import { asSystemAdmin } from './fixtures/roles'

const toast = (page: Page, text: string) => page.locator('[data-sonner-toast]').filter({ hasText: text }).first()

interface OpiePatient {
  opiePatientId: string
  appointments: { startTime: string | null }[]
  phoneNumbers: { number: string | null; country: string | null }[]
}

/**
 * Needs an OpieConnection (CI has none → every test here skips). The fake local Opie_data
 * has appointments on 2026-09-03; any configured Opie works as long as that date has a
 * patient with a ten-digit phone number.
 */
async function scheduleFor(request: APIRequestContext, date: string): Promise<OpiePatient[] | null> {
  const response = await request.get(`/api/opie/schedule?date=${date}`)
  if (response.status() === 503) return null
  expect(response.status(), await response.text()).toBe(200)
  return (await response.json()) as OpiePatient[]
}

test.describe('opie schedule', () => {
  const date = '2026-09-03'

  test.beforeEach(async ({ request }) => asSystemAdmin(request))

  test('day sheet lists appointments in time order and notify writes an audited MessageOut', async ({ page, request }) => {
    const patients = await scheduleFor(request, date)
    test.skip(patients === null, 'OpieConnection not configured')
    const target = patients!.find((p) => p.phoneNumbers.some((ph) => (ph.number ?? '').replace(/\D/g, '').length === 10))
    test.skip(!target, `no patient with a dialable number on ${date}`)

    await page.goto(`/?date=${date}`)
    await expect(page.getByTestId('opie-schedule-sheet')).toBeVisible()
    await expect(page.getByTestId('opie-schedule-summary')).toContainText('appointments')

    // Hour headers ascend; every appointment row sits under a header
    const hourIds = await page.locator('[data-testid^="opie-schedule-hour-"]').evaluateAll((els) =>
      els.map((el) => el.getAttribute('data-testid')!),
    )
    expect(hourIds).toEqual([...hourIds].sort())

    const rowKey = `${target!.opiePatientId}-0`
    await page.getByTestId(`opie-notify-${rowKey}`).click()
    await expect(page.getByTestId('confirm-dialog-title')).toContainText("Send 'ready to be seen' notification to")
    await expect(page.getByTestId('confirm-dialog-confirm')).toBeDisabled()
    await page.getByTestId('opie-notify-consent').check()

    const sent = page.waitForResponse((r) => r.url().endsWith('/api/opie/notify'))
    await page.getByTestId('confirm-dialog-confirm').click()
    const response = await sent
    expect(response.status()).toBe(201)
    expect(await response.json()).toMatchObject({
      patientId: null,
      opiePatientId: target!.opiePatientId,
      smsConsentAttested: true,
      channel: 'sms',
      status: 'failed',
      failureReason: 'sms-not-configured',
    })
    await expect(page.getByTestId('confirm-dialog')).toHaveCount(0)
    await expect(toast(page, 'Notification failed: sms-not-configured')).toBeVisible()
    await expect(page.getByTestId(`opie-notify-${rowKey}`)).toBeEnabled()
  })

  test('API refuses unattested consent (409, audited) and the -9999 placeholder (400)', async ({ request }) => {
    test.skip((await scheduleFor(request, date)) === null, 'OpieConnection not configured')

    const unattested = await request.post('/api/opie/notify', {
      data: { opiePatientId: '101', mobileNumber: '+18285550101', smsConsentAttested: false },
    })
    expect(unattested.status()).toBe(409)

    const placeholder = await request.post('/api/opie/notify', {
      data: { opiePatientId: '-9999', mobileNumber: '+18285550101', smsConsentAttested: true },
    })
    expect(placeholder.status()).toBe(400)

    const badNumber = await request.post('/api/opie/notify', {
      data: { opiePatientId: '101', mobileNumber: '828-555-0101', smsConsentAttested: true },
    })
    expect(badNumber.status()).toBe(400)
  })
})
