import { queryOptions } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'

export const departmentsQueryOptions = (siteId: string | null) =>
  queryOptions({
    queryKey: ['sites', siteId, 'departments'],
    queryFn: () => organizationsApi.listDepartments(siteId!),
    enabled: siteId !== null,
  })
