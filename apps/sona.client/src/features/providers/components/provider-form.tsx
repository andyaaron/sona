import type { CreateProviderInput } from '@sona/shared'

import Button from '@/components/button'
import { useAppForm } from '@/hooks/form.tsx'
import { addProviderFormOpts } from '@/features/providers/components/provider-form-opts'

interface ProviderFormProps {
  initialValues?: CreateProviderInput
  isSubmitting?: boolean
  submitLabel: string
  title: string
  onCancel: () => void
  onSubmit: (values: CreateProviderInput) => void
}

export function ProviderForm({
  initialValues,
  isSubmitting = false,
  submitLabel,
  title,
  onCancel,
  onSubmit,
}: ProviderFormProps) {
  const defaults = initialValues
    ? {
        firstName: initialValues.firstName,
        lastName: initialValues.lastName,
        credentials: initialValues.credentials ?? ('' as string | null | undefined),
        npi: initialValues.npi ?? ('' as string | null | undefined),
        specialty: initialValues.specialty ?? ('' as string | null | undefined),
        appUserId: initialValues.appUserId ?? (null as number | null | undefined),
      }
    : addProviderFormOpts.defaultValues

  const form = useAppForm({
    ...addProviderFormOpts,
    defaultValues: defaults,
    onSubmit: ({ value }) => {
      onSubmit({
        firstName: value.firstName,
        lastName: value.lastName,
        credentials: value.credentials || null,
        npi: value.npi || null,
        specialty: value.specialty || null,
      })
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
        <form.AppField name="firstName">
          {(field) => <field.TextField label="First name" />}
        </form.AppField>

        <form.AppField name="lastName">
          {(field) => <field.TextField label="Last name" />}
        </form.AppField>

        <form.AppField name="credentials">
          {(field) => <field.TextField label="Credentials" placeholder="e.g. MD, DO, NP" />}
        </form.AppField>

        <form.AppField name="npi">
          {(field) => <field.TextField label="NPI" placeholder="10-digit NPI" />}
        </form.AppField>

        <div className="md:col-span-2">
          <form.AppField name="specialty">
            {(field) => <field.TextField label="Specialty" />}
          </form.AppField>
        </div>
      </div>
    </form>
  )
}
