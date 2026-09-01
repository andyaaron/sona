import { useMutation, useQueryClient } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'
import type { UpdateDepartmentInput } from '@sona/shared'

export function useUpdateDepartment(organizationId: string, siteId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateDepartmentInput) => organizationsApi.updateDepartment(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites', siteId, 'departments'] })
      queryClient.invalidateQueries({ queryKey: ['organizations', organizationId, 'departments'] })
    },
  })
}
