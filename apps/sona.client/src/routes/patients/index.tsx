import { useState } from 'react'

import { useSuspenseQuery, useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import Button from '@/components/button'
import { SearchInput } from '@/components/search-input'
import { useNotifyPatient } from '@/features/notifications/api/notify-patient'
import { NotificationHistory } from '@/features/notifications/components/notification-history'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'
import { activeProvidersQueryOptions } from '@/features/providers/api/get-providers'

export const Route = createFileRoute('/patients/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(patientsQueryOptions),
  component: PatientsPage,
})

function PatientsPage() {
  const { data: patients } = useSuspenseQuery(patientsQueryOptions)
  const { data: providers } = useQuery(activeProvidersQueryOptions)
  const notify = useNotifyPatient()
  const [search, setSearch] = useState('')
  const [providerFilter, setProviderFilter] = useState('')
  const [historyPatientId, setHistoryPatientId] = useState<string | null>(null)

  const filteredPatients = patients.filter((patient) => {
    if (providerFilter) {
      if (patient.primaryProviderId !== providerFilter) return false
    }
    if (!search) return true
    const query = search.toLowerCase()
    return (
      patient.firstName.toLowerCase().includes(query) ||
      patient.lastName.toLowerCase().includes(query) ||
      patient.mrn.toLowerCase().includes(query)
    )
  })

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
        <Link to="/patients/manage">
          <Button variant="secondary" size="sm">
            Manage Patients
          </Button>
        </Link>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or MRN…" />
        <select
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          value={providerFilter}
          onChange={(e) => setProviderFilter(e.target.value)}
        >
          <option value="">All Providers</option>
          {providers?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </option>
          ))}
        </select>
      </div>

      <ul className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {filteredPatients.map((patient) => (
          <li key={patient.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
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
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setHistoryPatientId(historyPatientId === patient.id ? null : patient.id)
                  }
                >
                  {historyPatientId === patient.id ? 'Hide history' : 'History'}
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
            </div>
            {historyPatientId === patient.id && (
              <div className="mt-3 rounded-md border border-gray-100 bg-gray-50">
                <NotificationHistory patientId={patient.id} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
