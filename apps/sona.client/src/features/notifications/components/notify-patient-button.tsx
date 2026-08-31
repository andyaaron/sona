import { useNotifyPatient } from '../api/notify-patient'
import Button from "@/components/button.tsx";

export function NotifyPatientButton({ patientName, patientId }: { patientName: string, patientId: string }) {
  const notify = useNotifyPatient()

  const confirmDialog = () => {
    alert(`Send notification to ${patientName}?`)
  }
  
  return (
    <Button
      variant="primary"
      size="sm"
      disabled={notify.isPending}
      onClick={confirmDialog}
    >
      {notify.isPending ? 'Notifying…' : 'Ready to be seen'}
    </Button>
  )
}
