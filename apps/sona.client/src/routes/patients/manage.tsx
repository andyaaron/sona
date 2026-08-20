import { useState } from 'react'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { CreatePatientInput, Patient } from '@sona/shared'

import Button from '@/components/button'
import { useCreatePatient } from '@/features/patients/api/create-patient'
import { useDeletePatient } from '@/features/patients/api/delete-patient'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'
import { useUpdatePatient } from '@/features/patients/api/update-patient'
import { PatientForm } from '@/features/patients/components/patient-form'

export const Route = createFileRoute('/patients/manage')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(patientsQueryOptions),
  component: ManagePatientsPage,
})

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; patient: Patient }
  | null

function ManagePatientsPage() {
  const { data: patients } = useSuspenseQuery(patientsQueryOptions)
  const [formState, setFormState] = useState<FormState>(null)
  const createPatient = useCreatePatient()
  const updatePatient = useUpdatePatient()
  const deletePatient = useDeletePatient()

  function handleCreate(values: CreatePatientInput) {
    createPatient.mutate(values, {
      onSuccess: () => {
        setFormState(null)
        toast.success('Patient added successfully')
      },
    })
  }

  function handleUpdate(values: CreatePatientInput) {
    if (formState?.mode !== 'edit') {
      return
    }

    updatePatient.mutate(
      { id: formState.patient.id, ...values },
      {
        onSuccess: () => {
          setFormState(null)
          toast.success('Patient updated successfully')
        },
      },
    )
  }

  function handleDelete(patient: Patient) {
    if (!window.confirm(`Delete ${patient.firstName} ${patient.lastName}?`)) {
      return
    }

    deletePatient.mutate(patient.id, {
      onSuccess: () => {
        toast.success('Patient deleted')
        if (formState?.mode === 'edit' && formState.patient.id === patient.id) {
          setFormState(null)
        }
      },
    })
  }

  const isCreating = formState?.mode === 'create'
  const editingPatient = formState?.mode === 'edit' ? formState.patient : null

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Manage Patients</h1>
        <Button
          variant={isCreating ? 'secondary' : 'primary'}
          size="sm"
          onClick={() =>
            setFormState((s) => (s?.mode === 'create' ? null : { mode: 'create' }))
          }
        >
          {isCreating ? 'Cancel' : 'Add Patient'}
        </Button>
      </div>

      {formState ? (
        <PatientForm
          title={editingPatient ? 'Edit patient' : 'Add patient'}
          submitLabel={editingPatient ? 'Save changes' : 'Create patient'}
          initialValues={
            editingPatient
              ? {
                  mrn: editingPatient.mrn,
                  firstName: editingPatient.firstName,
                  lastName: editingPatient.lastName,
                  dob: editingPatient.dob,
                  phoneNumber: editingPatient.phoneNumber,
                  smsConsent: editingPatient.smsConsent,
                }
              : undefined
          }
          isSubmitting={createPatient.isPending || updatePatient.isPending}
          onCancel={() => setFormState(null)}
          onSubmit={editingPatient ? handleUpdate : handleCreate}
        />
      ) : null}

      <ul className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {patients.map((patient) => (
          <li key={patient.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-gray-900">
                {patient.firstName} {patient.lastName}
              </p>
              <p className="text-sm text-gray-500">
                MRN: {patient.mrn} · {patient.phoneNumber}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setFormState({ mode: 'edit', patient })}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={deletePatient.isPending}
                onClick={() => handleDelete(patient)}
              >
                Delete
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
