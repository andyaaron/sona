import type { ReactElement, ReactNode } from 'react'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createMemoryHistory, createRouter } from '@tanstack/react-router'
import { render } from '@testing-library/react'
import type { RenderOptions } from '@testing-library/react'
import { Toaster } from 'sonner'

import type { User } from '@sona/shared'

import { UserContext } from '@/hooks/useUser'
import { routeTree } from '@/routeTree.gen'

import { makeUser } from './fixtures'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: 0, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Signed-in user for `useUser()`; null renders without one (only for components that tolerate it). */
  user?: User | null
  queryClient?: QueryClient
}

/**
 * Renders a feature component with the providers it needs and no router:
 * a fresh QueryClient, the UserContext and a sonner Toaster so toasts are
 * assertable. Prefer this for feature components (features/<name>/components).
 */
export function renderWithProviders(
  ui: ReactElement,
  { user = makeUser(), queryClient = createTestQueryClient(), ...options }: ProviderOptions = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <UserContext value={user ?? undefined}>
          {children}
          <Toaster />
        </UserContext>
      </QueryClientProvider>
    )
  }
  return { queryClient, ...render(ui, { wrapper: Wrapper, ...options }) }
}

/**
 * Renders the real route tree at `path` on a memory history. The root route
 * fetches /api/user itself — override `currentUserHandler` first to pick the
 * viewer's role. Use only when the route composition is what is under test.
 */
export function renderRoute(path: string, { queryClient = createTestQueryClient() } = {}) {
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  })
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { router, queryClient, ...result }
}
