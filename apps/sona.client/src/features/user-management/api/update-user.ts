import { useMutation, useQueryClient } from '@tanstack/react-query'

import { usersApi } from '@sona/api-client'
import type { UpdateUserInput } from '@sona/shared'

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...input }: UpdateUserInput & { id: number }) =>
      usersApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
