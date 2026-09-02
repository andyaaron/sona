import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { notificationsApi } from '@sona/api-client'
import type { NotifyPatientInput } from '@sona/shared'

import { getErrorMessage } from '@/lib/api-error'

export function useNotifyPatient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: NotifyPatientInput) =>
      notificationsApi.notifyReady(input),
    onSuccess: (message, input) => {
      queryClient.invalidateQueries({
        queryKey: ['notifications', input.patientId],
      })
      // A 201 is an audited attempt, not a delivery: the row says whether it went out.
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
