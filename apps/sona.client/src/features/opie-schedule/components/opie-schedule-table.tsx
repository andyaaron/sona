import { useQuery } from '@tanstack/react-query'

import { ApiError } from '@sona/api-client'
import type { OpieScheduledPatient } from '@sona/shared'

import TableComponent from '@/components/Table/Table'
import type { AppColumnDef } from '@/components/Table/Table'
import { getErrorMessage } from '@/lib/api-error'

import { opieScheduleQueryOptions } from '../api/get-opie-schedule'

function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatName(p: OpieScheduledPatient): string {
  const given = [p.firstName, p.middleName].filter(Boolean).join(' ')
  return [p.lastName, given].filter(Boolean).join(', ') || '—'
}

const columns: AppColumnDef<OpieScheduledPatient>[] = [
  {
    accessorKey: 'lastName',
    header: 'Patient',
    cell: ({ row }) => (
      <>
        <p className="font-medium text-gray-900">{formatName(row.original)}</p>
        {row.original.nickName && (
          <p className="text-sm text-gray-500">"{row.original.nickName}"</p>
        )}
      </>
    ),
  },
  {
    id: 'appointments',
    header: 'Appointment',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.appointments.length === 0 ? (
        <span className="text-gray-400">—</span>
      ) : (
        <ul className="space-y-0.5">
          {row.original.appointments.map((a, i) => (
            <li key={i} className="whitespace-nowrap">
              {formatTime(a.startTime)} – {formatTime(a.endTime)}
            </li>
          ))}
        </ul>
      ),
  },
  {
    id: 'phoneNumbers',
    header: 'Phone',
    enableSorting: false,
    cell: ({ row }) =>
      row.original.phoneNumbers.length === 0 ? (
        <span className="text-gray-400">—</span>
      ) : (
        <ul className="space-y-0.5">
          {row.original.phoneNumbers.map((ph, i) => (
            <li key={i} className="whitespace-nowrap">
              {ph.number ?? '—'}
              {ph.extension && <span className="text-gray-500"> ext. {ph.extension}</span>}
              {ph.country && <span className="text-gray-400"> ({ph.country})</span>}
            </li>
          ))}
        </ul>
      ),
  },
  { accessorKey: 'emailAddress', header: 'Email', cell: ({ getValue }) => getValue() ?? '—' },
  {
    accessorKey: 'primaryPractitioner',
    header: 'Practitioner',
    cell: ({ getValue }) => getValue() ?? '—',
  },
  { accessorKey: 'languagePref', header: 'Language', cell: ({ getValue }) => getValue() ?? '—' },
  {
    accessorKey: 'comment',
    header: 'Comment',
    enableSorting: false,
    // Clinical free text: shown in full on hover only, truncated in the row.
    cell: ({ getValue }) => {
      const comment = getValue() as string | null
      return comment ? (
        <span className="block max-w-xs truncate" title={comment}>
          {comment}
        </span>
      ) : (
        <span className="text-gray-400">—</span>
      )
    },
  },
]

interface OpieScheduleTableProps {
  /** ISO date (YYYY-MM-DD) to list. */
  date: string
  onDateChange: (date: string) => void
}

/**
 * Day view of the external Opie schedule (GET /api/opie/schedule). Read-only PHI:
 * nothing here feeds a notification. Degrades to a notice when the integration is
 * not configured (503) or Opie is unreachable (502) so the dashboard still renders.
 */
export function OpieScheduleTable({ date, onDateChange }: OpieScheduleTableProps) {
  const { data, error, isPending } = useQuery(opieScheduleQueryOptions({ date }))
  const notConfigured = error instanceof ApiError && error.status === 503

  return (
    <section data-testid="opie-schedule" className="mt-8">
      <div data-testid="opie-schedule-toolbar" className="flex items-center gap-4">
        <h2 className="text-xl font-semibold text-gray-900">Opie Schedule</h2>
        <label className="flex items-center gap-2 text-sm text-gray-600">
          Date
          <input
            type="date"
            data-testid="opie-schedule-date"
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm shadow-sm"
            value={date}
            onChange={(e) => e.target.value && onDateChange(e.target.value)}
          />
        </label>
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
      ) : (
        <TableComponent
          data={data ?? []}
          columns={columns}
          isLoading={isPending}
          getRowId={(p) => p.opiePatientId}
          emptyMessage="No Opie appointments on this date."
          testId="opie-schedule-table"
        />
      )}
    </section>
  )
}
