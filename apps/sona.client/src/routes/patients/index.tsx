import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { patientsQueryOptions } from '@/features/patients/api/get-patients'
import Button from "@/components/button.tsx";
import {useNotifyPatient} from "@/features/notifications/api/notify-patient.ts";

export const Route = createFileRoute('/patients/')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(patientsQueryOptions),
  component: PatientsPage,
})

function PatientsPage() {
  const { data: patients } = useSuspenseQuery(patientsQueryOptions)
  const notify = useNotifyPatient()

  return (
    <div>
      <div className={"flex flex-row gap-4"}>
        <h1 className="text-2xl font-semibold text-gray-900">Patients</h1>
        <Button variant={"primary"} size={"sm"}>Add Patient</Button>
      </div>
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
            <Button 
              variant="primary"
              size="sm"
              disabled={notify.isPending}
              onClick={() => notify.mutate({ patientId: patient.id })}
            >
              {notify.isPending ? 'Notifying…' : 'Ready to be seen'}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  )
}
