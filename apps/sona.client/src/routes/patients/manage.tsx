import { useEffect, useState } from 'react'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { CreatePatientInput, Patient } from '@sona/shared'

import Button from '@/components/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { SearchInput } from '@/components/search-input'
import TableComponent from '@/components/Table/Table'
import type { AppColumnDef } from '@/components/Table/Table'
import { useCreatePatient } from '@/features/patients/api/create-patient'
import { useDeletePatient } from '@/features/patients/api/delete-patient'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'
import { useUpdatePatient } from '@/features/patients/api/update-patient'
import { PatientForm } from '@/features/patients/components/patient-form'
import {
  patientTableManualState,
  validatePatientListSearch,
} from '@/features/patients/patient-list-search'
import { activeProvidersQueryOptions } from '@/features/providers/api/get-providers'
import { getErrorMessage } from '@/lib/api-error'

export const Route = createFileRoute('/patients/manage')({
  validateSearch: validatePatientListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    Promise.all([
      queryClient.ensureQueryData(patientsQueryOptions(deps)),
      queryClient.ensureQueryData(activeProvidersQueryOptions),
    ]),
  component: ManagePatientsPage,
})

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; patient: Patient }
  | null

function ManagePatientsPage() {
  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(patientsQueryOptions(searchParams))
  const { data: providers } = useSuspenseQuery(activeProvidersQueryOptions)
  const [formState, setFormState] = useState<FormState>(null)
  const [pendingDelete, setPendingDelete] = useState<Patient | null>(null)
  const [searchInput, setSearchInput] = useState(searchParams.search ?? '')
  const createPatient = useCreatePatient()
  const updatePatient = useUpdatePatient()
  const deletePatient = useDeletePatient()

  // Keep the input in sync when the param changes via back/forward navigation.
  useEffect(() => {
    setSearchInput(searchParams.search ?? '')
  }, [searchParams.search])

  // Debounced server-side search — reset to page 1 on change.
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = searchInput.trim() || undefined
      if (next !== searchParams.search) {
        navigate({ search: (prev) => ({ ...prev, search: next, page: undefined }) })
      }
    }, 300)
    return () => clearTimeout(handle)
  }, [searchInput, searchParams.search, navigate])

  function handleCreate(values: CreatePatientInput) {
    const input = {
      ...values,
      primaryProviderId: values.primaryProviderId || null,
    }
    createPatient.mutate(input, {
      onSuccess: () => {
        setFormState(null)
        toast.success('Patient added successfully')
      },
      onError: (error) => {
        toast.error(getErrorMessage(error))
      },
    })
  }

  function handleUpdate(values: CreatePatientInput) {
    if (formState?.mode !== 'edit') {
      return
    }

    updatePatient.mutate(
      { id: formState.patient.id, ...values, primaryProviderId: values.primaryProviderId || null },
      {
        onSuccess: () => {
          setFormState(null)
          toast.success('Patient updated successfully')
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
        },
      },
    )
  }

  function confirmDelete() {
    if (!pendingDelete) return
    const patient = pendingDelete
    deletePatient.mutate(patient.id, {
      onSuccess: () => {
        toast.success('Patient deleted')
        if (formState?.mode === 'edit' && formState.patient.id === patient.id) {
          setFormState(null)
        }
      },
      onError: (error) => {
        toast.error(getErrorMessage(error))
      },
      onSettled: () => setPendingDelete(null),
    })
  }

  const isCreating = formState?.mode === 'create'
  const editingPatient = formState?.mode === 'edit' ? formState.patient : null

  const manual = patientTableManualState({
    searchParams,
    page: data.page,
    pageSize: data.pageSize,
    rowCount: data.totalCount,
    navigate,
  })

  // Defined per render (not module level) — the actions column closes over the
  // mutation handlers and delete-pending state.
  const columns: AppColumnDef<Patient>[] = [
    {
      accessorKey: 'lastName',
      header: 'Name',
      cell: ({ row }) => {
        const patient = row.original
        return (
          <>
            <p className="font-medium text-gray-900">
              {patient.firstName} {patient.lastName}
            </p>
            <p className="text-sm text-gray-500">
              {patient.phoneNumber}
              {' · '}
              <span className="text-gray-400">
                {patient.primaryProviderName ?? 'Unassigned'}
              </span>
            </p>
          </>
        )
      },
    },
    { accessorKey: 'mrn', header: 'MRN' },
    { accessorKey: 'dob', header: 'DOB' },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`patients-manage-edit-${row.original.id}`}
            onClick={() => setFormState({ mode: 'edit', patient: row.original })}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={deletePatient.isPending}
            data-testid={`patients-manage-delete-${row.original.id}`}
            onClick={() => setPendingDelete(row.original)}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div data-testid="patients-manage-page">
      <div data-testid="patients-manage-toolbar" className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Manage Patients</h1>
        <Button
          variant={isCreating ? 'secondary' : 'primary'}
          size="sm"
          data-testid="patients-manage-add-button"
          aria-expanded={isCreating}
          onClick={() =>
            setFormState((s) => (s?.mode === 'create' ? null : { mode: 'create' }))
          }
        >
          {isCreating ? 'Cancel' : 'Add Patient'}
        </Button>
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name or MRN…"
          testId="patients-manage-search"
        />
      </div>

      {formState ? (
        <PatientForm
          title={editingPatient ? 'Edit patient' : 'Add patient'}
          submitLabel={editingPatient ? 'Save changes' : 'Create patient'}
          providers={providers}
          initialValues={
            editingPatient
              ? {
                  mrn: editingPatient.mrn,
                  firstName: editingPatient.firstName,
                  lastName: editingPatient.lastName,
                  dob: editingPatient.dob,
                  phoneNumber: editingPatient.phoneNumber,
                  smsConsent: editingPatient.smsConsent,
                  primaryProviderId: editingPatient.primaryProviderId,
                }
              : undefined
          }
          isSubmitting={createPatient.isPending || updatePatient.isPending}
          onCancel={() => setFormState(null)}
          onSubmit={editingPatient ? handleUpdate : handleCreate}
        />
      ) : null}

      <TableComponent
        data={data.items}
        columns={columns}
        getRowId={(patient) => patient.id}
        emptyMessage="No patients found."
        manual={manual}
        testId="patients-manage-table"
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        title={`Delete ${pendingDelete?.firstName ?? ''} ${pendingDelete?.lastName ?? ''}?`}
        confirmLabel="Delete"
        confirmDisabled={deletePatient.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  )
}
