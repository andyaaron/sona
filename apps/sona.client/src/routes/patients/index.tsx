import { useState } from 'react'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import type { CreatePatientInput, Patient } from '@sona/shared'

import Button from '@/components/button'
import { useNotifyPatient } from '@/features/notifications/api/notify-patient'
import { useCreatePatient } from '@/features/patients/api/create-patient'
import { useDeletePatient } from '@/features/patients/api/delete-patient'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'
import { useUpdatePatient } from '@/features/patients/api/update-patient'
import { PatientForm } from '@/features/patients/components/patient-form'

export const Route = createFileRoute('/patients/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(patientsQueryOptions),
  component: PatientsPage,
})

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; patient: Patient }
  | null

function PatientsPage() {
  const { data: patients } = useSuspenseQuery(patientsQueryOptions)
  const [formState, setFormState] = useState<FormState>(null)
  const createPatient = useCreatePatient()
  const updatePatient = useUpdatePatient()
  const deletePatient = useDeletePatient()
  const notify = useNotifyPatient()

  function handleCreate(values: CreatePatientInput) {
    createPatient.mutate(values, {
      onSuccess: () => {
        setFormState(null)
      },
    })
  }

  function handleUpdate(values: CreatePatientInput) {
    if (formState?.mode !== 'edit') {
      return
    }

    updatePatient.mutate(
      {
        id: formState.patient.id,
        ...values,
      },
      {
        onSuccess: () => {
          setFormState(null)
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
      <div className="flex flex-row gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
        <Button
          variant={isCreating ? 'secondary' : 'primary'}
          size="sm"
          onClick={() =>
            setFormState((currentState) =>
              currentState?.mode === 'create' ? null : { mode: 'create' },
            )
          }
        >
          {isCreating ? 'Close' : 'Add Patient'}
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
                {patient.hasApp ? 'App user — will receive push' : 'No app — will receive SMS'}
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
              <Button
                variant="primary"
                size="sm"
                disabled={notify.isPending}
                onClick={() => notify.mutate({ patientId: patient.id })}
              >
                {notify.isPending ? 'Notifying…' : 'Ready to be seen'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
