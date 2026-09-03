import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import type { NotifyPatientInput } from '@sona/shared'

import { useDepartmentContextStore } from '@/stores/department-context'
import { SEED, V7_ID, makeMessageOut, makeStaffUser, makeUser } from '@/testing/fixtures'
import { renderWithProviders } from '@/testing/render'
import { server } from '@/testing/server'

import { NotifyPatientButton } from './notify-patient-button'

/** Replaces the notify handler and records what the component sent. */
function captureNotify(status = 201) {
  const bodies: NotifyPatientInput[] = []
  server.use(
    http.post<never, NotifyPatientInput>('/api/notifications/ready', async ({ request }) => {
      const input = await request.json()
      bodies.push(input)
      if (status === 201) return HttpResponse.json(makeMessageOut({ patientId: input.patientId }), { status })
      return HttpResponse.json({ error: 'Patient has not consented to SMS.' }, { status })
    }),
  )
  return bodies
}

describe('NotifyPatientButton', () => {
  it('asks for confirmation and cancels without a request', async () => {
    const bodies = captureNotify()
    const user = userEvent.setup()
    renderWithProviders(<NotifyPatientButton patientId="7" patientName="Test Patient" />)

    await user.click(screen.getByTestId('notify-button-7'))
    expect(screen.getByTestId('confirm-dialog-title')).toHaveTextContent(
      "Send 'ready to be seen' notification to Test Patient?",
    )
    await user.click(screen.getByTestId('confirm-dialog-cancel'))

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument()
    expect(bodies).toHaveLength(0)
  })

  it('posts the patient id with no department for a non-staff sender', async () => {
    const bodies = captureNotify()
    const user = userEvent.setup()
    renderWithProviders(<NotifyPatientButton patientId="7" patientName="Test Patient" />, { user: makeUser() })

    await user.click(screen.getByTestId('notify-button-7'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => expect(bodies).toEqual([{ patientId: '7', departmentId: null }]))
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument())
  })

  it("sends a single-department staff user's department (the seeded id)", async () => {
    const bodies = captureNotify()
    const user = userEvent.setup()
    renderWithProviders(<NotifyPatientButton patientId="7" patientName="Test Patient" />, { user: makeStaffUser() })

    await user.click(screen.getByTestId('notify-button-7'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => expect(bodies).toEqual([{ patientId: '7', departmentId: SEED.departmentId }]))
  })

  it('uses the persisted department pick for multi-department staff, ignoring a stale one', async () => {
    const bodies = captureNotify()
    const user = userEvent.setup()
    const staff = makeStaffUser({
      departmentIds: [SEED.departmentId, V7_ID],
      departments: [
        { id: SEED.departmentId, name: 'General' },
        { id: V7_ID, name: 'Urgent Care' },
      ],
    })
    useDepartmentContextStore.getState().setSelectedDepartmentId(V7_ID)
    renderWithProviders(<NotifyPatientButton patientId="7" patientName="Test Patient" />, { user: staff })

    await user.click(screen.getByTestId('notify-button-7'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))
    await waitFor(() => expect(bodies).toEqual([{ patientId: '7', departmentId: V7_ID }]))

    // A selection that is no longer one of the user's departments sends none
    useDepartmentContextStore.getState().setSelectedDepartmentId('not-mine')
    await user.click(screen.getByTestId('notify-button-7'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))
    await waitFor(() => expect(bodies).toHaveLength(2))
    expect(bodies[1]).toEqual({ patientId: '7', departmentId: null })
  })

  it('closes the dialog and re-enables the button after a TCPA 409', async () => {
    const bodies = captureNotify(409)
    const user = userEvent.setup()
    renderWithProviders(<NotifyPatientButton patientId="7" patientName="Test Patient" />)

    await user.click(screen.getByTestId('notify-button-7'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    await waitFor(() => expect(bodies).toHaveLength(1))
    await waitFor(() => expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('notify-button-7')).toBeEnabled()
  })

  it('toasts the audited failure reason when the 201 row is failed (Local: sms-not-configured)', async () => {
    captureNotify()
    const user = userEvent.setup()
    renderWithProviders(<NotifyPatientButton patientId="7" patientName="Test Patient" />)

    await user.click(screen.getByTestId('notify-button-7'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    // sonner renders the text twice (toast + aria-live announcement)
    expect(await screen.findAllByText('Notification failed: sms-not-configured')).not.toHaveLength(0)
  })

  it('toasts success when the row went out', async () => {
    server.use(
      http.post('/api/notifications/ready', () =>
        HttpResponse.json(makeMessageOut({ status: 'sent', failureReason: null }), { status: 201 }),
      ),
    )
    const user = userEvent.setup()
    renderWithProviders(<NotifyPatientButton patientId="7" patientName="Test Patient" />)

    await user.click(screen.getByTestId('notify-button-7'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    // sonner renders the text twice (toast + aria-live announcement)
    expect(await screen.findAllByText('Notification sent')).not.toHaveLength(0)
  })

  it('surfaces the 409 consent message as an error toast', async () => {
    captureNotify(409)
    const user = userEvent.setup()
    renderWithProviders(<NotifyPatientButton patientId="7" patientName="Test Patient" />)

    await user.click(screen.getByTestId('notify-button-7'))
    await user.click(screen.getByTestId('confirm-dialog-confirm'))

    // sonner renders the text twice (toast + aria-live announcement)
    expect(await screen.findAllByText('Patient has not consented to SMS.')).not.toHaveLength(0)
  })
})
