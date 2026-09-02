import type { QueryClient } from '@tanstack/react-query'

/** Router context every route receives (`createRootRouteWithContext<MyRouterContext>`). */
export interface MyRouterContext {
  queryClient: QueryClient
}
