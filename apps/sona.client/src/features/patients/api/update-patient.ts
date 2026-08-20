import { useMutation, useQueryClient } from '@tanstack/react-query'

import { patientsApi } from '@sona/api-client'
import type { UpdatePatientInput } from '@sona/shared'

export function useUpdatePatient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdatePatientInput) => patientsApi.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['patients'],
      })
    },
  })
}
