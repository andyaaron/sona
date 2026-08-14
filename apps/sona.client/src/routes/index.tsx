import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { userQueryOptions } from '@/features/user/api/getUser'
import { UserContext } from '@/hooks/useUser'


export const Route = createFileRoute('/')({
    component: Index,
})
function Index() {
    const { callApi } = Route.useRouteContext()

    const {
        data: user,
        isPending,
        error,
    } = useQuery({
        ...userQueryOptions(callApi),
    })

    if (user) {
        console.log("user: ", user)
    }

    return (
        <UserContext value={user}>
            <div>
                <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
                <p className="mt-2 text-gray-600">
                    Provider dashboard — waiting room queue and notification history will live here.
                </p>
            </div>
        </UserContext>
    )
}