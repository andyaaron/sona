import { useMutation, useQueryClient } from '@tanstack/react-query'

import { usersApi } from '@sona/api-client'
import type { InviteUserInput } from '@sona/shared'

export function useInviteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: InviteUserInput) => usersApi.invite(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
