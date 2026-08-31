import { useEffect, useState } from 'react'

import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import type { Patient, PatientSortField } from '@sona/shared'

import Button from '@/components/button'
import { PaginationControls } from '@/components/pagination-controls'
import { SearchInput } from '@/components/search-input'
import { SortableHeader } from '@/components/sortable-header'
import { NotificationHistory } from '@/features/notifications/components/notification-history'
import { NotifyPatientButton } from '@/features/notifications/components/notify-patient-button'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'
import { validatePatientListSearch } from '@/features/patients/patient-list-search'
import { activeProvidersQueryOptions } from '@/features/providers/api/get-providers'

export const Route = createFileRoute('/patients/')({
  validateSearch: validatePatientListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(patientsQueryOptions(deps)),
  component: PatientsPage,
})

function PatientsPage() {
  const searchParams = Route.useSearch()
  const { sortBy = 'lastName', sortDir = 'asc' } = searchParams
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(patientsQueryOptions(searchParams))
  const { data: providers } = useQuery(activeProvidersQueryOptions)
  const [searchInput, setSearchInput] = useState(searchParams.search ?? '')
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null)

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

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
        <Link to="/patients/manage">
          <Button variant="secondary" size="sm">
            Manage Patients
          </Button>
        </Link>
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name or MRN…"
        />
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          value={searchParams.providerId ?? ''}
          onChange={(e) =>
            navigate({
              search: (prev) => ({
                ...prev,
                providerId: e.target.value || undefined,
                page: undefined,
              }),
            })
          }
        >
          <option value="">All Providers</option>
          {providers?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

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
              <PatientRow
                key={patient.id}
                patient={patient}
                showHistory={historyPatientId === patient.id}
                onToggleHistory={() =>
                  setHistoryPatientId(historyPatientId === patient.id ? null : patient.id)
                }
              />
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

function PatientRow({
  patient,
  showHistory,
  onToggleHistory,
}: {
  patient: Patient
  showHistory: boolean
  onToggleHistory: () => void
}) {
  return (
    <>
      <tr>
        <td className="px-4 py-3">
          <p className="font-medium text-gray-900">
            {patient.firstName} {patient.lastName}
          </p>
          <p className="text-sm text-gray-500">
            {patient.hasApp ? 'App user — will receive push' : 'No app — will receive SMS'}
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
            <Button variant="secondary" size="sm" onClick={onToggleHistory}>
              {showHistory ? 'Hide history' : 'History'}
            </Button>
            <NotifyPatientButton
              patientName={`${patient.firstName} ${patient.lastName}`}
              patientId={patient.id}
            />
          </div>
        </td>
      </tr>
      {showHistory && (
        <tr>
          <td colSpan={4} className="px-4 pb-3">
            <div className="rounded-md border border-gray-100 bg-gray-50">
              <NotificationHistory patientId={patient.id} />
            </div>
          </td>
        </tr>
      )}
    </>
  )
}
