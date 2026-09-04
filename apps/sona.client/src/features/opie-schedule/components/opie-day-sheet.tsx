import type { OpieScheduledPatient } from '@sona/shared'

import type { DaySheet, DaySheetRow } from '../day-sheet'
import { formatHour, formatPatientName, formatTime } from '../day-sheet'
import { NotifyOpieButton } from './notify-opie-button'

const hourId = (hour: number) => String(hour).padStart(2, '0')

function Dash() {
  return <span className="text-gray-400">—</span>
}

function PatientCell({ patient }: { patient: OpieScheduledPatient }) {
  const meta = [patient.nickName && `"${patient.nickName}"`, patient.languagePref].filter(Boolean)
  return (
    <>
      <p className="font-medium text-gray-900">{formatPatientName(patient)}</p>
      {meta.length > 0 && <p className="text-xs text-gray-500">{meta.join(' · ')}</p>}
    </>
  )
}

function ContactCell({ patient }: { patient: OpieScheduledPatient }) {
  if (patient.phoneNumbers.length === 0 && !patient.emailAddress) return <Dash />
  return (
    <ul className="space-y-0.5">
      {patient.phoneNumbers.map((ph, i) => (
        <li key={i} className="whitespace-nowrap">
          {ph.number ?? '—'}
          {ph.country && <span className="text-gray-400"> ({ph.country})</span>}
        </li>
      ))}
      {patient.emailAddress && <li className="text-xs text-gray-500">{patient.emailAddress}</li>}
    </ul>
  )
}

function TimeCell({ row }: { row: DaySheetRow }) {
  const { appointment } = row
  return (
    <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-700">
      {appointment.startTime ? (
        <>
          {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
        </>
      ) : (
        <Dash />
      )}
    </td>
  )
}

/**
 * Staff time booked against Opie's shared placeholder (LUNCH, meeting…). Highlighted so it
 * reads as "booked, not a patient"; colour alone is not the cue — the label says so too.
 * No identity, no contact, no notify control: the server has already redacted the row and
 * refuses to notify -9999, this just never offers it.
 */
function InternalBlockRow({ row }: { row: DaySheetRow }) {
  // The label is per booking (fldPatientScheduleDetails) — the shared -9999 patient row carries nothing.
  const details = row.appointment.details?.trim()
  const label = details || 'Internal block'
  return (
    <tr
      data-testid={`opie-schedule-block-${row.key}`}
      className="border-b border-amber-100 bg-amber-50 align-top text-amber-900"
    >
      <TimeCell row={row} />
      <td className="px-3 py-2" colSpan={3}>
        <span className="mr-2 inline-block rounded-sm bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
          Internal
        </span>
        <span className="font-medium" title={details || undefined}>
          {label}
        </span>
      </td>
      <td className="px-3 py-2" />
    </tr>
  )
}

function AppointmentRow({ row }: { row: DaySheetRow }) {
  if (row.isInternalBlock) return <InternalBlockRow row={row} />
  const { patient } = row

  return (
    <tr data-testid={`opie-schedule-row-${row.key}`} className="border-b border-gray-100 align-top">
      <TimeCell row={row} />
      <td className="px-3 py-2">
        <PatientCell patient={patient} />
      </td>
      <td className="px-3 py-2">
        <ContactCell patient={patient} />
      </td>
      <td className="px-3 py-2">
        {/* Clinical free text: full text on hover only, truncated in the row. */}
        {patient.comment ? (
          <span className="block max-w-xs" title={patient.comment}>
            {patient.comment}
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <NotifyOpieButton patient={patient} rowKey={row.key} />
      </td>
    </tr>
  )
}

function NowMarker() {
  return (
    <tr data-testid="opie-schedule-now" aria-label="Current time">
      <td colSpan={5} className="p-0">
        {/* Flex layout (rather than absolute-positioned circles) keeps the whole marker within its own
            row box, so it isn't clipped by the sheet's horizontally-scrolling container. */}
        <div className="flex h-2 items-center">
          <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
          <div className="h-0.5 flex-1 bg-sky-400" />
          <span className="h-2 w-2 shrink-0 rounded-full bg-sky-400" />
        </div>
      </td>
    </tr>
  )
}

function HourGroup({
  hour,
  rows,
  nowMarkerIndex,
  hideInternal,
}: {
  hour: number
  rows: DaySheetRow[]
  nowMarkerIndex: number | null
  hideInternal: boolean
}) {
  return (
    <>
      <tr data-testid={`opie-schedule-hour-${hourId(hour)}`} className="bg-gray-50">
        <td colSpan={5} className="px-3 py-1.5 text-xs font-medium text-gray-600">
          {formatHour(hour)}
        </td>
      </tr>
      {rows.length === 0 ? (
        <>
          {nowMarkerIndex !== null && <NowMarker />}
          <tr data-testid={`opie-schedule-empty-hour-${hourId(hour)}`} className="border-b border-gray-100">
            <td colSpan={5} className="px-3 py-1.5 text-xs italic text-gray-400">
              No appointments
            </td>
          </tr>
        </>
      ) : (
        rows.map((row, index) => (
          <RowGroup
            key={row.key}
            row={row}
            before={nowMarkerIndex === index}
            after={nowMarkerIndex === index + 1}
            hideInternal={hideInternal}
          />
        ))
      )}
    </>
  )
}

function RowGroup({
  row,
  before,
  after,
  hideInternal,
}: {
  row: DaySheetRow
  before: boolean
  after: boolean
  hideInternal: boolean
}) {
  // Keep the now-marker index aligned with the underlying rows array — skip the row's own
  // content when hidden, but still render the marker so "now" doesn't silently drift.
  return (
    <>
      {before && <NowMarker />}
      {!(hideInternal && row.isInternalBlock) && <AppointmentRow row={row} />}
      {after && <NowMarker />}
    </>
  )
}

/**
 * Time-ordered day sheet: an hour header from the first appointment to the last, each
 * appointment under its start hour, empty hours shown as a single quiet row. Internal
 * (staff) blocks occupy time like appointments but render as highlighted label rows.
 */
export function OpieDaySheet({ sheet, hideInternal = false }: { sheet: DaySheet; hideInternal?: boolean }) {
  const unscheduled = hideInternal ? sheet.unscheduled.filter((row) => !row.isInternalBlock) : sheet.unscheduled
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table data-testid="opie-schedule-sheet" className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Patient</th>
            <th className="px-3 py-2">Contact</th>
            <th className="px-3 py-2">Comment</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sheet.hours.map(({ hour, rows, nowMarkerIndex }) => (
            <HourGroup key={hour} hour={hour} rows={rows} nowMarkerIndex={nowMarkerIndex} hideInternal={hideInternal} />
          ))}
          {unscheduled.length > 0 && (
            <>
              <tr data-testid="opie-schedule-unscheduled" className="bg-gray-50">
                <td colSpan={5} className="px-3 py-1.5 text-xs font-medium text-gray-600">
                  No start time
                </td>
              </tr>
              {unscheduled.map((row) => (
                <AppointmentRow key={row.key} row={row} />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
