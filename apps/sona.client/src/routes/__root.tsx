import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { Toaster } from 'sonner'
import { useQuery } from '@tanstack/react-query'
import { userQueryOptions } from '@/features/user/api/getUser'
import { UserContext } from '@/hooks/useUser'
import type { MyRouterContext } from '@/main'
import Header from '@/components/header'
import { PendingApproval } from '@/components/pending-approval'
import AnimatedLogo from '@/components/animated-logo'

export const Route = createRootRouteWithContext<MyRouterContext>()({
    component: RootComponent,
})

function RootComponent() {
    const {
        data: user,
        isPending,
        error,
    } = useQuery(userQueryOptions)

    // Unprovisioned users get a holding screen instead of the app shell.
    // UX only — the server's AssignedUser policy is what actually blocks them.
    if (user?.role === 'unassigned') {
        return (
            <>
                <PendingApproval displayName={user.displayName} />
                <Toaster position="top-right" richColors />
            </>
        )
    }

    return (
        <UserContext value={user}>
            <Header />
            <div className="flex min-h-screen">
                <main className="flex-1 p-6 text-left">
                    {isPending ? (
                        <div className="flex min-h-[calc(100svh-3rem)] items-center justify-center">
                            <AnimatedLogo className="h-16" />
                        </div>
                    ) : error ? (
                        <div className="p-4 text-red-500">Error: {error.message}</div>
                    ) : (
                        <Outlet />
                    )}
                </main>
            </div>

            <TanStackRouterDevtools />
            <Toaster position="top-right" richColors />
        </UserContext>
    )
}