import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { useQuery } from '@tanstack/react-query'
import { userQueryOptions } from '@/features/user/api/getUser'
import { UserContext } from '@/hooks/useUser'
import type { MyRouterContext } from '@/main'

export const Route = createRootRouteWithContext<MyRouterContext>()({
    component: RootComponent,
})

function RootComponent() {
    const { callApi } = Route.useRouteContext()

    const {
        data: user,
        isPending,
        error,
    } = useQuery({
        ...userQueryOptions(callApi),
    })

    return (
        <UserContext value={user}>
            <div className="flex min-h-screen">
                <main className="flex-1 p-6 text-left">
                    {isPending ? (
                        <div className="flex min-h-[calc(100svh-3rem)] items-center justify-center">
                            Loading...
                        </div>
                    ) : error ? (
                        <div className="p-4 text-red-500">Error: {error.message}</div>
                    ) : (
                        <Outlet />
                    )}
                </main>
            </div>

            <TanStackRouterDevtools />
        </UserContext>
    )
}