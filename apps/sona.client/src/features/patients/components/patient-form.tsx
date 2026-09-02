import type { CreatePatientInput, Provider } from '@sona/shared'

import Button from '@/components/button'
import { useAppForm } from '@/hooks/form.tsx'
import { addPatientFormOpts } from '@/components/Form/sharedForm.tsx'

interface PatientFormProps {
  initialValues?: CreatePatientInput
  isSubmitting?: boolean
  submitLabel: string
  title: string
  providers?: Provider[]
  onCancel: () => void
  onSubmit: (values: CreatePatientInput) => void
}

export function PatientForm({
  initialValues,
  isSubmitting = false,
  submitLabel,
  title,
  providers = [],
  onCancel,
  onSubmit,
}: PatientFormProps) {
  const form = useAppForm({
    ...addPatientFormOpts,
    defaultValues: initialValues
      ? {
          mrn: initialValues.mrn,
          firstName: initialValues.firstName,
          lastName: initialValues.lastName,
          dob: initialValues.dob,
          phoneNumber: initialValues.phoneNumber,
          smsConsent: initialValues.smsConsent,
          primaryProviderId: initialValues.primaryProviderId ?? '',
        }
      : addPatientFormOpts.defaultValues,
    onSubmit: ({ value }) => {
      onSubmit({
        ...value,
        primaryProviderId: value.primaryProviderId || null,
      })
    },
  })

  const providerOptions = providers
    .filter((p) => p.isActive)
    .map((p) => ({
      value: p.id,
      label: p.credentials
        ? `${p.firstName} ${p.lastName}, ${p.credentials}`
        : `${p.firstName} ${p.lastName}`,
    }))

  return (
    <form
      data-testid="patient-form"
      className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 data-testid="patient-form-title" className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="patient-form-cancel"
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" data-testid="patient-form-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form.AppField name="mrn">
          {(field) => <field.TextField label="MRN" testId="patient-form-mrn" />}
        </form.AppField>

        <form.AppField name="dob">
          {(field) => <field.TextField label="Date of birth" placeholder="YYYY-MM-DD" testId="patient-form-dob" />}
        </form.AppField>

        <form.AppField name="firstName">
          {(field) => <field.TextField label="First name" testId="patient-form-first-name" />}
        </form.AppField>

        <form.AppField name="lastName">
          {(field) => <field.TextField label="Last name" testId="patient-form-last-name" />}
        </form.AppField>

        <div className="md:col-span-2">
          <form.AppField name="phoneNumber">
            {(field) => <field.TextField label="Phone number" placeholder="+15551234567" testId="patient-form-phone-number" />}
          </form.AppField>
        </div>

        <form.AppField name="smsConsent">
          {(field) => (
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700 md:col-span-2">
              <input
                type="checkbox"
                data-testid="patient-form-sms-consent"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
                onBlur={field.handleBlur}
              />
              SMS consent captured
            </label>
          )}
        </form.AppField>

        <form.AppField name="primaryProviderId">
          {(field) => (
            <field.SelectField
              label="Primary Provider"
              testId="patient-form-primary-provider"
              options={providerOptions}
              emptyOptionLabel="Unassigned"
              emptyOptionValue=""
            />
          )}
        </form.AppField>
      </div>
    </form>
  )
}
