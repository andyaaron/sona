import { queryOptions } from '@tanstack/react-query'

import { usersApi } from '@sona/api-client'

/** org_admin sees own org + the unassigned pending queue; system_admin sees all. */
export const usersQueryOptions = queryOptions({
  queryKey: ['users'],
  queryFn: () => usersApi.list(),
})
