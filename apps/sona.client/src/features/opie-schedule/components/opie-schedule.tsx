import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { ApiError } from '@sona/api-client'

import Button from '@/components/button'
import Spinner from '@/components/spinner'
import { getErrorMessage } from '@/lib/api-error'

import { opieScheduleQueryOptions } from '../api/get-opie-schedule'
import { buildDaySheet } from '../day-sheet'
import { addDays, todayIsoDate } from '../today-iso-date'
import { OpieDaySheet } from './opie-day-sheet'

interface OpieScheduleProps {
  /** ISO date (YYYY-MM-DD) to list. */
  date: string
  onDateChange: (date: string) => void
}

function formatDateHeading(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

/**
 * Day view of the external Opie schedule (GET /api/opie/schedule) as a time-ordered day
 * sheet. Read-only PHI apart from the per-row notify button (POST /api/opie/notify).
 * Degrades to a notice when the integration is not configured (503) or Opie is
 * unreachable (502) so the dashboard still renders; hidden entirely when the schedule
 * belongs to another organization (404).
 */
export function OpieSchedule({ date, onDateChange }: OpieScheduleProps) {
  const { data, error, isPending } = useQuery(opieScheduleQueryOptions({ date }))
  const notConfigured = error instanceof ApiError && error.status === 503
  // 404 = the Opie clinic is bound to a different organization than the viewer's: the
  // section simply does not exist for them (no notice — other orgs must not learn of it).
  if (error instanceof ApiError && error.status === 404) return null
  const today = todayIsoDate()
  const now = new Date()
  const sheet = data
    ? buildDaySheet(data, date === today ? now.getHours() * 60 + now.getMinutes() : null)
    : null

  return (
    <section data-testid="opie-schedule" className="mt-8">
      <div data-testid="opie-schedule-toolbar" className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-semibold text-gray-900">Opie Schedule</h2>
        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            aria-label="Previous day"
            data-testid="opie-schedule-prev-day"
            onClick={() => onDateChange(addDays(date, -1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            data-testid="opie-schedule-today"
            disabled={date === today}
            onClick={() => onDateChange(today)}
          >
            Today
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Next day"
            data-testid="opie-schedule-next-day"
            onClick={() => onDateChange(addDays(date, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <input
          type="date"
          aria-label="Date"
          data-testid="opie-schedule-date"
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm"
          value={date}
          onChange={(e) => e.target.value && onDateChange(e.target.value)}
        />
        <p data-testid="opie-schedule-summary" className="text-sm text-gray-500">
          {formatDateHeading(date)}
          {sheet && ` · ${sheet.appointmentCount} appointments · ${sheet.patientCount} patients`}
        </p>
      </div>

      {notConfigured ? (
        <p
          data-testid="opie-schedule-unconfigured"
          className="mt-4 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600"
        >
          Opie connection not configured. Set <code>ConnectionStrings:OpieConnection</code> on the
          API to load the schedule.
        </p>
      ) : error ? (
        <p
          data-testid="opie-schedule-error"
          className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Could not load the Opie schedule: {getErrorMessage(error)}
        </p>
      ) : isPending || !sheet ? (
        <div data-testid="opie-schedule-loading" className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner size="sm" label="Loading schedule" />
          Loading schedule…
        </div>
      ) : sheet.appointmentCount === 0 ? (
        <p
          data-testid="opie-schedule-empty"
          className="mt-4 rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-sm text-gray-600"
        >
          No Opie appointments on this date.
        </p>
      ) : (
        <OpieDaySheet sheet={sheet} />
      )}
    </section>
  )
}
