import { useMutation, useQueryClient } from '@tanstack/react-query'

import { providersApi } from '@sona/api-client'
import type { UpdateProviderInput } from '@sona/shared'

export function useUpdateProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateProviderInput) => providersApi.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] })
    },
  })
}
