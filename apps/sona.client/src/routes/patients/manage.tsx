import { useEffect, useState } from 'react'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { CreatePatientInput, Patient, PatientSortField } from '@sona/shared'
import { ApiError } from '@sona/api-client'

import Button from '@/components/button'
import { PaginationControls } from '@/components/pagination-controls'
import { SearchInput } from '@/components/search-input'
import { SortableHeader } from '@/components/sortable-header'
import { useCreatePatient } from '@/features/patients/api/create-patient'
import { useDeletePatient } from '@/features/patients/api/delete-patient'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'
import { useUpdatePatient } from '@/features/patients/api/update-patient'
import { PatientForm } from '@/features/patients/components/patient-form'
import { validatePatientListSearch } from '@/features/patients/patient-list-search'
import { activeProvidersQueryOptions } from '@/features/providers/api/get-providers'

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

function getErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    const body = error.body as Record<string, unknown> | null
    if (body && typeof body.error === 'string') {
      return body.error
    }
    return `Request failed (${error.status})`
  }
  return error.message || 'An unexpected error occurred'
}

function ManagePatientsPage() {
  const searchParams = Route.useSearch()
  const { sortBy = 'lastName', sortDir = 'asc' } = searchParams
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(patientsQueryOptions(searchParams))
  const { data: providers } = useSuspenseQuery(activeProvidersQueryOptions)
  const [formState, setFormState] = useState<FormState>(null)
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

  function toggleSort(field: PatientSortField) {
    navigate({
      search: (prev) => ({
        ...prev,
        sortBy: field,
        sortDir: field === sortBy && sortDir === 'asc' ? 'desc' : 'asc',
        page: undefined,
      }),
    })
  }

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
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name or MRN…"
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

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <SortableHeader
                label="Name"
                field="lastName"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="MRN"
                field="mrn"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <SortableHeader
                label="DOB"
                field="dob"
                sortBy={sortBy}
                sortDir={sortDir}
                onSort={toggleSort}
              />
              <th scope="col" className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.items.map((patient) => (
              <tr key={patient.id}>
                <td className="px-4 py-3">
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
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{patient.mrn}</td>
                <td className="px-4 py-3 text-sm text-gray-700">{patient.dob}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
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
                </td>
              </tr>
            ))}
            {data.items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-sm text-gray-500">
                  No patients found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={data.page}
        pageSize={data.pageSize}
        totalCount={data.totalCount}
        onPageChange={(page) => navigate({ search: (prev) => ({ ...prev, page: page > 1 ? page : undefined }) })}
      />
    </div>
  )
}
