import { queryOptions } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'

/** org_admin: own org only; system_admin: every org. */
export const organizationsQueryOptions = queryOptions({
  queryKey: ['organizations'],
  queryFn: () => organizationsApi.list(),
})
