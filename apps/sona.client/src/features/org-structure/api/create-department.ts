import { useMutation, useQueryClient } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'
import type { CreateDepartmentInput } from '@sona/shared'

export function useCreateDepartment(organizationId: string, siteId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateDepartmentInput) => organizationsApi.createDepartment(siteId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'departments'] })
      // user-management's flattened department list keys off the org
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'departments'] })
    },
  })
}
