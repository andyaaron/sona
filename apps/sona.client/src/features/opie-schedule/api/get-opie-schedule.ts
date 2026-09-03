import { queryOptions } from '@tanstack/react-query'

import { opieApi } from '@sona/api-client'
import type { OpieScheduleQuery } from '@sona/shared'

export const opieScheduleQueryOptions = (params: OpieScheduleQuery = {}) =>
  queryOptions({
    queryKey: ['opie-schedule', params],
    queryFn: () => opieApi.schedule(params),
    // 503 (not configured) / 502 (Opie down) are stable for the session — retrying
    // would only delay the notice the dashboard shows instead of the table.
    retry: false,
  })
