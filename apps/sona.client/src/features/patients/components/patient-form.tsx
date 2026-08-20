import type { CreatePatientInput } from '@sona/shared'

import Button from '@/components/button'
import { useAppForm } from '@/hooks/form.tsx'
import { addPatientFormOpts } from '@/components/Form/sharedForm.tsx'

interface PatientFormProps {
  initialValues?: CreatePatientInput
  isSubmitting?: boolean
  submitLabel: string
  title: string
  onCancel: () => void
  onSubmit: (values: CreatePatientInput) => void
}

export function PatientForm({
  initialValues,
  isSubmitting = false,
  submitLabel,
  title,
  onCancel,
  onSubmit,
}: PatientFormProps) {
  const form = useAppForm({
    ...addPatientFormOpts,
    defaultValues: initialValues ?? addPatientFormOpts.defaultValues,
    onSubmit: ({ value }) => {
      onSubmit(value)
    },
  })

  return (
    <form
      className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form.AppField name="mrn">
          {(field) => <field.TextField label="MRN" />}
        </form.AppField>

        <form.AppField name="dob">
          {(field) => <field.TextField label="Date of birth" placeholder="YYYY-MM-DD" />}
        </form.AppField>

        <form.AppField name="firstName">
          {(field) => <field.TextField label="First name" />}
        </form.AppField>

        <form.AppField name="lastName">
          {(field) => <field.TextField label="Last name" />}
        </form.AppField>

        <div className="md:col-span-2">
          <form.AppField name="phoneNumber">
            {(field) => <field.TextField label="Phone number" placeholder="+15551234567" />}
          </form.AppField>
        </div>

        <form.AppField name="smsConsent">
          {(field) => (
            <label className="flex items-center gap-3 text-sm font-medium text-gray-700 md:col-span-2">
              <input
                type="checkbox"
                checked={field.state.value}
                onChange={(e) => field.handleChange(e.target.checked)}
                onBlur={field.handleBlur}
              />
              SMS consent captured
            </label>
          )}
        </form.AppField>
      </div>
    </form>
  )
}
