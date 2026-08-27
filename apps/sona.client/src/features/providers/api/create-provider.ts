import { useMutation, useQueryClient } from '@tanstack/react-query'

import { providersApi } from '@sona/api-client'
import type { CreateProviderInput } from '@sona/shared'

export function useCreateProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateProviderInput) => providersApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}
