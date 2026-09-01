import { queryOptions } from '@tanstack/react-query'

import { usersApi } from '@sona/api-client'

/** HCA directory (MSGraph) lookup by 34 ID prefix for the invite-first flow. */
export const directorySearchQueryOptions = (q: string) =>
  queryOptions({
    queryKey: ['directory-search', q],
    queryFn: () => usersApi.directorySearch(q),
    enabled: q.trim().length >= 2,
    staleTime: 60_000,
  })
