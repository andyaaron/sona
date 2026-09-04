import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import type { NotifyOpiePatientInput } from '@sona/shared'

import { makeMessageOut, makeOpieScheduledPatient, makeStaffUser, makeUser, SEED } from '@/testing/fixtures'
import { renderWithProviders } from '@/testing/render'
import { server } from '@/testing/server'

import { NotifyOpieButton } from './notify-opie-button'

function captureNotify(status = 201) {
  const bodies: NotifyOpiePatientInput[] = []
  server.use(
    http.post<never, NotifyOpiePatientInput>('/api/opie/notify', async ({ request }) => {
      const input = await request.json()
      bodies.push(input)
      if (status === 201) {
        return HttpResponse.json(
          makeMessageOut({ patientId: null, opiePatientId: input.opiePatientId, smsConsentAttested: true }),
          { status },
        )
      }
      return HttpResponse.json({ error: 'Confirm the patient has consented to SMS before notifying.' }, { status })
    }),
  )
  return bodies
}

const patient = makeOpieScheduledPatient({
  opiePatientId: '101',
  lastName: 'Sample',
  firstName: 'Alex',
  phoneNumbers: [{ number: '555-010-0100', extension: null, country: 'US' }],
})

describe('NotifyOpieButton', () => {
  it('is disabled when Opie has no dialable number', () => {
    renderWithProviders(
      <NotifyOpieButton patient={makeOpieScheduledPatient({ opiePatientId: '9', phoneNumbers: [] })} rowKey="9-0" />,
    )
    expect(screen.getByTestId('opie-notify-9-0')).toBeDisabled()
    expect(screen.getByTestId('opie-notify-9-0')).toHaveAttribute('title', 'No mobile number on file in Opie')
  })

  it('shows the number, keeps Confirm disabled until consent is attested, and cancels without a request', async () => {
    const bodies = captureNotify()
    const user = userEvent.setup()
    renderWithProviders(<NotifyOpieButton patient={patient} rowKey="101-0" />)

    await user.click(screen.getByTestId('opie-notify-101-0'))
    expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent(
      "Send 'ready to be seen' notification to Sample, Alex?",
    )
    expect(screen.getByTestId('opie-notify-number')).toHaveTextContent('555-010-0100')
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeDisabled()

    await user.click(screen.getByTestId('opie-notify-consent'))
    expect(screen.getByTestId('confirm-dialog-confirm')).toBeEnabled()

    await user.click(screen.getByTestId('confirm-dialog-cancel'))
    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(bodies).toHaveLength(0)

    // Attestation does not carry over to the next open
    await user.click(screen.getByTestId('opie-notify-101-0'))
    expect(screen.getByTestId('opie-notify-consent')).not.toBeChecked()
  })

  it('posts the Opie id, the E.164 number and the attestation (no department for a non-staff sender)', async () => {
    const bodies = captureNotify()
    const user = userEvent.setup()
    renderWithProviders(<NotifyOpieButton patient={patient} rowKey="101-0" />, { user: makeUser() })

    await user.click(screen.getByTestId('opie-notify-101-0'))
    await user.click(screen.getByTestId('opie-notify-consent'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() =>
      expect(bodies).toEqual([
        { opiePatientId: '101', mobileNumber: '+15550100100', departmentId: null, smsConsentAttested: true },
      ]),
    )
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument())
    // Fixture outcome is Local's audited failure — surfaced, not hidden behind "sent"
    expect(await screen.findByText('Notification failed: sms-not-configured')).toBeInTheDocument()
  })

  it("sends a single-department staff user's department", async () => {
    const bodies = captureNotify()
    const user = userEvent.setup()
    renderWithProviders(<NotifyOpieButton patient={patient} rowKey="101-0" />, { user: makeStaffUser() })

    await user.click(screen.getByTestId('opie-notify-101-0'))
    await user.click(screen.getByTestId('opie-notify-consent'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => expect(bodies[0]?.departmentId).toBe(SEED.departmentId))
  })

  it('surfaces a 409 as an error toast and re-enables the button', async () => {
    captureNotify(409)
    const user = userEvent.setup()
    renderWithProviders(<NotifyOpieButton patient={patient} rowKey="101-0" />)

    await user.click(screen.getByTestId('opie-notify-101-0'))
    await user.click(screen.getByTestId('opie-notify-consent'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    expect(await screen.findByText(/Confirm the patient has consented to SMS/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByTestId('opie-notify-101-0')).toBeEnabled())
  })
})
