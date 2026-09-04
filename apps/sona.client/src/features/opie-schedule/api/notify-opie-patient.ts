import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { opieApi } from '@sona/api-client'
import type { NotifyOpiePatientInput } from '@sona/shared'

import { getErrorMessage } from '@/lib/api-error'

/** Same outcome handling as features/notifications' useNotifyPatient: a 201 is an audited attempt, not a delivery. */
export function useNotifyOpiePatient() {
  return useMutation({
    mutationFn: (input: NotifyOpiePatientInput) => opieApi.notify(input),
    onSuccess: (message) => {
      // failureReason is an opaque code (never PHI), safe to show.
      if (message.status === 'failed') {
        toast.error(`Notification failed: ${message.failureReason ?? 'unknown'}`)
      } else {
        toast.success('Notification sent')
      }
    },
    onError: (error) => {
      toast.error(getErrorMessage(error))
    },
  })
}
