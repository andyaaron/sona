import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { ApiError } from '@sona/api-client'

import Button from '@/components/button'
import Spinner from '@/components/spinner'
import { getErrorMessage } from '@/lib/api-error'

import { opieScheduleQueryOptions } from '../api/get-opie-schedule'
import { buildDaySheet, countLabel } from '../day-sheet'
import { addDays, todayIsoDate } from '../today-iso-date'
import { OpieDaySheet } from './opie-day-sheet'

interface OpieScheduleProps {
  /** ISO date (YYYY-MM-DD) to list. */
  date: string
  onDateChange: (date: string) => void
}

function formatDateHeading(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
}

interface CountChipProps {
  id: string
  count: number
  /** Singular noun; pluralised with "s" unless `plural` is given. "internal" is invariant. */
  noun: string
  plural?: string
  tone?: 'neutral' | 'internal'
  onClick?: () => void
  pressed?: boolean
}

function CountChip({ id, count, noun, plural, tone = 'neutral', onClick, pressed }: CountChipProps) {
  const toneClass = tone === 'internal' ? 'bg-amber-100 text-amber-900' : 'bg-gray-100 text-gray-700'
  const interactiveClass = onClick ? 'cursor-pointer select-none hover:opacity-80' : ''
  return (
    <span
      data-testid={`opie-schedule-count-${id}`}
      className={`rounded-md px-2 py-0.5 tabular-nums ${toneClass} ${interactiveClass}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? pressed : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
    >
      {countLabel(count, noun, plural)}
    </span>
  )
}

/**
 * Day view of the external Opie schedule (GET /api/opie/schedule) as a time-ordered day
 * sheet. Read-only PHI apart from the per-row notify button (POST /api/opie/notify).
 * Degrades to a notice when the integration is not configured (503) or Opie is
 * unreachable (502) so the dashboard still renders; hidden entirely when the schedule
 * belongs to another organization (404).
 */
export function OpieSchedule({ date, onDateChange }: OpieScheduleProps) {
  const [hideInternalRows, setHideInternalRows] = useState(false)
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
        {/* The date leads: it is the first thing staff look for, so it takes the heading slot
            rather than trailing the controls as small grey text. */}
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 data-testid="opie-schedule-heading" className="text-xl font-semibold text-gray-900 tabular-nums">
            {formatDateHeading(date)}
          </h2>
          {date === today && (
            <span
              data-testid="opie-schedule-today-badge"
              className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-medium text-sky-800"
            >
              Today
            </span>
          )}
          {sheet && (
            <div data-testid="opie-schedule-summary" className="flex items-center gap-1.5 text-xs font-medium">
              <CountChip id="appointments" count={sheet.appointmentCount} noun="appointment" />
              <CountChip id="patients" count={sheet.patientCount} noun="patient" />
              {sheet.internalBlockCount > 0 && (
                <CountChip
                  id="internal"
                  count={sheet.internalBlockCount}
                  noun="internal"
                  plural="internal"
                  tone="internal"
                  onClick={() => setHideInternalRows((hidden) => !hidden)}
                  pressed={hideInternalRows}
                />
              )}
            </div>
          )}
        </div>
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
        <OpieDaySheet sheet={sheet} hideInternal={hideInternalRows} />
      )}
    </section>
  )
}
