import { queryOptions } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'

export const sitesQueryOptions = (organizationId: string | null) =>
  queryOptions({
    queryKey: ['organizations', organizationId, 'sites'],
    queryFn: () => organizationsApi.listSites(organizationId!),
    enabled: organizationId !== null,
  })
