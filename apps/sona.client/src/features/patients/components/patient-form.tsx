import { type FormEvent, useEffect, useState } from 'react'

import type { CreatePatientInput } from '@sona/shared'
import { createPatientSchema } from '@sona/shared'

import Button from '@/components/button'

type PatientFormValues = CreatePatientInput
type PatientFormErrors = Partial<Record<keyof PatientFormValues, string>>

const defaultValues: PatientFormValues = {
  mrn: '',
  firstName: '',
  lastName: '',
  dob: '',
  phoneNumber: '',
  smsConsent: false,
}

interface PatientFormProps {
  initialValues?: PatientFormValues
  isSubmitting?: boolean
  submitLabel: string
  title: string
  onCancel: () => void
  onSubmit: (values: PatientFormValues) => void
}

export function PatientForm({
  initialValues,
  isSubmitting = false,
  submitLabel,
  title,
  onCancel,
  onSubmit,
}: PatientFormProps) {
  const [values, setValues] = useState<PatientFormValues>(initialValues ?? defaultValues)
  const [errors, setErrors] = useState<PatientFormErrors>({})

  useEffect(() => {
    setValues(initialValues ?? defaultValues)
    setErrors({})
  }, [initialValues])

  function updateField<K extends keyof PatientFormValues>(
    field: K,
    value: PatientFormValues[K],
  ) {
    setValues((currentValues) => ({
      ...currentValues,
      [field]: value,
    }))
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: undefined,
    }))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = createPatientSchema.safeParse(values)
    if (!result.success) {
      const nextErrors: PatientFormErrors = {}

      for (const issue of result.error.issues) {
        const field = issue.path[0]
        if (typeof field === 'string') {
          const typedField = field as keyof PatientFormValues
          if (nextErrors[typedField] === undefined) {
            nextErrors[typedField] = issue.message
          }
        }
      }

      setErrors(nextErrors)
      return
    }

    setErrors({})
    onSubmit(result.data)
  }

  return (
    <form
      className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      onSubmit={handleSubmit}
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
        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          MRN
          <input
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            value={values.mrn}
            onChange={(event) => updateField('mrn', event.target.value)}
          />
          {errors.mrn ? <span className="text-sm text-red-600">{errors.mrn}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Date of birth
          <input
            type="date"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            value={values.dob}
            onChange={(event) => updateField('dob', event.target.value)}
          />
          {errors.dob ? <span className="text-sm text-red-600">{errors.dob}</span> : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          First name
          <input
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            value={values.firstName}
            onChange={(event) => updateField('firstName', event.target.value)}
          />
          {errors.firstName ? (
            <span className="text-sm text-red-600">{errors.firstName}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
          Last name
          <input
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            value={values.lastName}
            onChange={(event) => updateField('lastName', event.target.value)}
          />
          {errors.lastName ? (
            <span className="text-sm text-red-600">{errors.lastName}</span>
          ) : null}
        </label>

        <label className="flex flex-col gap-1 text-sm font-medium text-gray-700 md:col-span-2">
          Phone number
          <input
            className="rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            placeholder="+15551234567"
            value={values.phoneNumber}
            onChange={(event) => updateField('phoneNumber', event.target.value)}
          />
          {errors.phoneNumber ? (
            <span className="text-sm text-red-600">{errors.phoneNumber}</span>
          ) : null}
        </label>

        <label className="flex items-center gap-3 text-sm font-medium text-gray-700 md:col-span-2">
          <input
            type="checkbox"
            checked={values.smsConsent}
            onChange={(event) => updateField('smsConsent', event.target.checked)}
          />
          SMS consent captured
        </label>
      </div>
    </form>
  )
}
