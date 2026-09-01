import { useMutation, useQueryClient } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'
import type { CreateSiteInput } from '@sona/shared'

export function useCreateSite(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateSiteInput) => organizationsApi.createSite(organizationId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] })
    },
  })
}
