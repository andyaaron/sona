import { useState } from 'react'

import Button from '@/components/button'
import { ConfirmDialog } from '@/components/confirm-dialog'

import { useNotifyPatient } from '../api/notify-patient'

export function NotifyPatientButton({
  patientName,
  patientId,
}: {
  patientName: string
  patientId: string
}) {
  const notify = useNotifyPatient()
  const [confirming, setConfirming] = useState(false)

  return (
    <>
      <Button
        variant="primary"
        size="sm"
        disabled={notify.isPending}
        onClick={() => setConfirming(true)}
      >
        {notify.isPending ? 'Notifying…' : 'Ready to be seen'}
      </Button>
      <ConfirmDialog
        open={confirming}
        title={`Send 'ready to be seen' notification to ${patientName}?`}
        confirmLabel={notify.isPending ? 'Notifying…' : 'Confirm'}
        confirmDisabled={notify.isPending}
        onConfirm={() =>
          notify.mutate(
            { patientId },
            { onSettled: () => setConfirming(false) },
          )
        }
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}
