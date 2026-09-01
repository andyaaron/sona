import { useMutation, useQueryClient } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'
import type { CreateOrganizationInput } from '@sona/shared'

export function useCreateOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateOrganizationInput) => organizationsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations'] })
    },
  })
}
