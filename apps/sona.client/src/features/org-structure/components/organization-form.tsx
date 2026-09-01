import { createOrganizationSchema } from '@sona/shared'
import type { CreateOrganizationFormValues, CreateOrganizationInput } from '@sona/shared'

import Button from '@/components/button'
import { useAppForm } from '@/hooks/form.tsx'

interface OrganizationFormProps {
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: (values: CreateOrganizationInput) => void
}

/** System-admin only: creating a practice/hospital (server auto-adds Main site + General department). */
export function OrganizationForm({ isSubmitting = false, onCancel, onSubmit }: OrganizationFormProps) {
  const form = useAppForm({
    defaultValues: { name: '', type: 'practice' } as CreateOrganizationFormValues,
    validators: {
      onChangeAsync: createOrganizationSchema,
    },
    onSubmit: ({ value }) => onSubmit({ name: value.name.trim(), type: value.type }),
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
        <h2 className="text-lg font-semibold text-gray-900">Add organization</h2>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Create organization'}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <form.AppField name="name">
          {(field) => <field.TextField label="Name" />}
        </form.AppField>

        <form.AppField name="type">
          {(field) => (
            <field.SelectField
              label="Type"
              options={[
                { value: 'practice', label: 'Practice' },
                { value: 'hospital', label: 'Hospital' },
              ]}
            />
          )}
        </form.AppField>
      </div>
      <p className="text-xs text-gray-500">
        A "Main" site and "General" department are created automatically.
      </p>
    </form>
  )
}
