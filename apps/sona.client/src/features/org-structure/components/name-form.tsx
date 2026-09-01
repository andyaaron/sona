import { createDepartmentSchema, createSiteSchema } from '@sona/shared'

import Button from '@/components/button'
import { useAppForm } from '@/hooks/form.tsx'

interface NameFormProps {
  kind: 'site' | 'department'
  title: string
  submitLabel: string
  initialName?: string
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: (values: { name: string }) => void
}

/** Add/rename a site or department — both are just a validated name. */
export function NameForm({
  kind,
  title,
  submitLabel,
  initialName = '',
  isSubmitting = false,
  onCancel,
  onSubmit,
}: NameFormProps) {
  const form = useAppForm({
    defaultValues: { name: initialName },
    validators: {
      onChangeAsync: kind === 'site' ? createSiteSchema : createDepartmentSchema,
    },
    onSubmit: ({ value }) => onSubmit({ name: value.name.trim() }),
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

      <div className="mt-4 max-w-md">
        <form.AppField name="name">
          {(field) => <field.TextField label={kind === 'site' ? 'Site name' : 'Department name'} />}
        </form.AppField>
      </div>
    </form>
  )
}
