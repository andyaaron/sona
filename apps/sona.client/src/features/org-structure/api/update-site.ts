import { useMutation, useQueryClient } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'
import type { UpdateSiteInput } from '@sona/shared'

export function useUpdateSite(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateSiteInput) => organizationsApi.updateSite(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId] })
    },
  })
}
