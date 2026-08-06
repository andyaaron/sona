import { useNotifyPatient } from '../api/notify-patient'

export function NotifyPatientButton({ patientId }: { patientId: string }) {
  const notify = useNotifyPatient()

  return (
    <button
      type="button"
      onClick={() => notify.mutate({ patientId })}
      disabled={notify.isPending}
      className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
    >
      {notify.isPending ? 'Notifying…' : 'Ready to be seen'}
    </button>
  )
}
