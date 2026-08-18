import { useMutation, useQueryClient } from '@tanstack/react-query'

import { notificationsApi } from '@sona/api-client'
import type { NotifyPatientInput } from '@sona/shared'

export function useNotifyPatient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: NotifyPatientInput) =>
      notificationsApi.notifyReady(input),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({
        queryKey: ['notifications', input.patientId],
      })
    },
  })
}
