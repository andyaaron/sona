import { useEffect, useState } from 'react'

import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import type { Patient } from '@sona/shared'

import Button from '@/components/button'
import { SearchInput } from '@/components/search-input'
import TableComponent from '@/components/Table/Table'
import type { AppColumnDef } from '@/components/Table/Table'
import { NotificationHistory } from '@/features/notifications/components/notification-history'
import { NotifyPatientButton } from '@/features/notifications/components/notify-patient-button'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'
import {
  patientTableManualState,
  validatePatientListSearch,
} from '@/features/patients/patient-list-search'
import { activeProvidersQueryOptions } from '@/features/providers/api/get-providers'

export const Route = createFileRoute('/patients/')({
  validateSearch: validatePatientListSearch,
  loaderDeps: ({ search }) => search,
  loader: ({ context: { queryClient }, deps }) =>
    queryClient.ensureQueryData(patientsQueryOptions(deps)),
  component: PatientsPage,
})

// Column ids double as the server sort fields (`sortBy` search param).
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
            {patient.hasApp ? 'App user — will receive push' : 'No app — will receive SMS'}
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
          variant="secondary"
          size="sm"
          data-testid={`patients-history-${row.original.id}`}
          aria-expanded={row.getIsExpanded()}
          onClick={() => row.toggleExpanded()}
        >
          {row.getIsExpanded() ? 'Hide history' : 'History'}
        </Button>
        <NotifyPatientButton
          patientName={`${row.original.firstName} ${row.original.lastName}`}
          patientId={row.original.id}
        />
      </div>
    ),
  },
]

export function PatientsPage() {
  const searchParams = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data } = useSuspenseQuery(patientsQueryOptions(searchParams))
  const { data: providers } = useQuery(activeProvidersQueryOptions)
  const [searchInput, setSearchInput] = useState(searchParams.search ?? '')

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

  const manual = patientTableManualState({
    searchParams,
    page: data.page,
    pageSize: data.pageSize,
    rowCount: data.totalCount,
    navigate,
  })

  return (
    <div data-testid="patients-page">
      <div data-testid="patients-toolbar" className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
        <Link to="/patients/manage" data-testid="patients-manage-link">
          <Button variant="secondary" size="sm" tabIndex={-1}>
            Manage Patients
          </Button>
        </Link>
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search by name or MRN…"
          testId="patients-search"
        />
        <select
          data-testid="patients-provider-filter"
          aria-label="Filter by provider"
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

      <TableComponent
        data={data.items}
        columns={columns}
        getRowId={(patient) => patient.id}
        getRowCanExpand={() => true}
        renderSubComponent={({ row }) => (
          <div className="rounded-md border border-gray-100 bg-gray-50">
            <NotificationHistory patientId={row.original.id} />
          </div>
        )}
        emptyMessage="No patients found."
        manual={manual}
        testId="patients-table"
      />
    </div>
  )
}
