import { queryOptions } from '@tanstack/react-query'

import { patientsApi } from '@sona/api-client'

export const patientsQueryOptions = () =>
  queryOptions({
    queryKey: ['patients'],
    queryFn: () => patientsApi.list(),
  })
