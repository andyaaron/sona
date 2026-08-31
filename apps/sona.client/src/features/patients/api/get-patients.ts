import { queryOptions } from '@tanstack/react-query'

import type { PatientListParams } from '@sona/api-client'
import { patientsApi } from '@sona/api-client'

export type { PatientListParams }

export const patientsQueryOptions = (params: PatientListParams = {}) =>
  queryOptions({
    queryKey: ['patients', params],
    queryFn: () => patientsApi.list(params),
  })
