import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { CreatePatientInput } from '@sona/shared'

import { V7_ID, makeProvider } from '@/testing/fixtures'
import { renderWithProviders } from '@/testing/render'

import { PatientForm } from './patient-form'

function renderForm(props: Partial<Parameters<typeof PatientForm>[0]> = {}) {
  const onSubmit = vi.fn<(values: CreatePatientInput) => void>()
  const utils = renderWithProviders(
    <PatientForm title="Add patient" submitLabel="Create patient" onCancel={vi.fn()} onSubmit={onSubmit} {...props} />,
  )
  return { ...utils, onSubmit, user: userEvent.setup() }
}

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByTestId('patient-form-mrn'), 'MRN-100')
  await user.type(screen.getByTestId('patient-form-first-name'), 'Test')
  await user.type(screen.getByTestId('patient-form-last-name'), 'Patient')
  await user.type(screen.getByTestId('patient-form-dob'), '1990-01-01')
  await user.type(screen.getByTestId('patient-form-phone-number'), '+15555550100')
}

describe('PatientForm', () => {
  it('shows the required-field messages and does not submit an empty form', async () => {
    const { user, onSubmit } = renderForm()

    await user.click(await screen.findByTestId('patient-form-submit'))

    expect(await screen.findByTestId('patient-form-mrn-error')).toHaveTextContent('MRN is required')
    expect(screen.getByTestId('patient-form-first-name-error')).toHaveTextContent('First name is required')
    expect(screen.getByTestId('patient-form-last-name-error')).toHaveTextContent('Last name is required')
    expect(screen.getByTestId('patient-form-phone-number-error')).toHaveTextContent(
      'Phone number must be E.164 format (+15551234567)',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('rejects a non-E.164 phone number', async () => {
    const { user, onSubmit } = renderForm()
    await fillValid(user)
    await user.clear(screen.getByTestId('patient-form-phone-number'))
    await user.type(screen.getByTestId('patient-form-phone-number'), '555-555-0100')

    await user.click(screen.getByTestId('patient-form-submit'))

    expect(await screen.findByTestId('patient-form-phone-number-error')).toHaveTextContent('E.164')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('submits a valid patient; consent is whatever was captured, never defaulted on', async () => {
    const { user, onSubmit } = renderForm()
    await fillValid(user)

    await user.click(screen.getByTestId('patient-form-submit'))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        mrn: 'MRN-100',
        firstName: 'Test',
        lastName: 'Patient',
        dob: '1990-01-01',
        phoneNumber: '+15555550100',
        smsConsent: false,
        primaryProviderId: null,
      }),
    )

    await user.click(screen.getByTestId('patient-form-sms-consent'))
    await user.click(screen.getByTestId('patient-form-submit'))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenLastCalledWith(expect.objectContaining({ smsConsent: true })),
    )
  })

  it('pre-fills edit mode and maps an empty provider back to null', async () => {
    const { user, onSubmit } = renderForm({
      initialValues: {
        mrn: 'MRN-7',
        firstName: 'Edit',
        lastName: 'Me',
        dob: '1985-05-05',
        phoneNumber: '+15555550101',
        smsConsent: true,
        primaryProviderId: V7_ID,
      },
      providers: [makeProvider(), makeProvider({ id: '019b0e6a-0000-7000-8000-000000000002', isActive: false })],
    })

    expect(await screen.findByTestId('patient-form-mrn')).toHaveValue('MRN-7')
    expect(screen.getByTestId('patient-form-sms-consent')).toBeChecked()
    const provider = await screen.findByTestId('patient-form-primary-provider')
    expect(provider).toHaveValue(V7_ID)
    // Inactive providers are not offered; the empty option maps to null
    expect(provider.querySelectorAll('option')).toHaveLength(2)

    await user.selectOptions(provider, '')
    await user.click(screen.getByTestId('patient-form-submit'))
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ mrn: 'MRN-7', primaryProviderId: null })),
    )
  })
})
