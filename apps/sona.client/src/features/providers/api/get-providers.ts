import { queryOptions } from '@tanstack/react-query'

import { providersApi } from '@sona/api-client'

export const providersQueryOptions = queryOptions({
  queryKey: ['providers'],
  queryFn: () => providersApi.list(),
})

export const activeProvidersQueryOptions = queryOptions({
  queryKey: ['providers', { isActive: true }],
  queryFn: () => providersApi.list({ isActive: true }),
})
