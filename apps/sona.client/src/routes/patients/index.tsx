import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'

import { NotifyPatientButton } from '@/features/notifications/components/notify-patient-button'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'

export const Route = createFileRoute('/patients/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(patientsQueryOptions),
  component: PatientsPage,
})

function PatientsPage() {
  const { data: patients } = useSuspenseQuery(patientsQueryOptions)

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
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
            <NotifyPatientButton patientId={patient.id} />
          </li>
        ))}
      </ul>
    </div>
  )
}
