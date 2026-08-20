import { useMutation, useQueryClient } from '@tanstack/react-query'

import { patientsApi } from '@sona/api-client'

export function useDeletePatient() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => patientsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['patients'],
      })
    },
  })
}
