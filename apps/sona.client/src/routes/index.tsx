import { createFileRoute } from '@tanstack/react-router'

import { opieScheduleQuerySchema } from '@sona/shared'

import { OpieSchedule } from '@/features/opie-schedule/components/opie-schedule'
import { todayIsoDate } from '@/features/opie-schedule/today-iso-date'

export const Route = createFileRoute('/')({
    validateSearch: opieScheduleQuerySchema,
    component: Index,
})

function Index() {
    const { date } = Route.useSearch()
    const navigate = Route.useNavigate()

    return (
        <div data-testid="dashboard">
            <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>

            <OpieSchedule
                date={date ?? todayIsoDate()}
                onDateChange={(next) => navigate({ search: { date: next } })}
            />
        </div>
    )
}
