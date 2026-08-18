import { useMutation, useQueryClient } from '@tanstack/react-query'

import { patientsApi } from '@sona/api-client'
import type { CreatePatientInput } from '@sona/shared'

export function useCreatePatient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePatientInput) => patientsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['patients'],
      })
    },
  })
}
