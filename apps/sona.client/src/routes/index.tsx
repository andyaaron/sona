import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    component: Index,
})

function Index() {
    return (
        <div data-testid="dashboard">
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-gray-600">
                Provider dashboard — waiting room queue and notification history will live here.
            </p>
        </div>
    )
}