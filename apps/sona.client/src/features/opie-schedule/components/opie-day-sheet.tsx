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
          {ph.extension && <span className="text-gray-500"> ext. {ph.extension}</span>}
          {ph.country && <span className="text-gray-400"> ({ph.country})</span>}
        </li>
      ))}
      {patient.emailAddress && <li className="text-xs text-gray-500">{patient.emailAddress}</li>}
    </ul>
  )
}

function AppointmentRow({ row }: { row: DaySheetRow }) {
  const { patient, appointment } = row
  return (
    <tr data-testid={`opie-schedule-row-${row.key}`} className="border-b border-gray-100 align-top">
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-gray-700">
        {appointment.startTime ? (
          <>
            {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
          </>
        ) : (
          <Dash />
        )}
      </td>
      <td className="px-3 py-2">
        <PatientCell patient={patient} />
      </td>
      <td className="px-3 py-2">{patient.primaryPractitioner ?? <Dash />}</td>
      <td className="px-3 py-2">
        <ContactCell patient={patient} />
      </td>
      <td className="px-3 py-2">
        {/* Clinical free text: full text on hover only, truncated in the row. */}
        {patient.comment ? (
          <span className="block max-w-xs truncate" title={patient.comment}>
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
      <td colSpan={6} className="border-t-2 border-red-400 p-0" />
    </tr>
  )
}

function HourGroup({
  hour,
  rows,
  nowMarkerIndex,
}: {
  hour: number
  rows: DaySheetRow[]
  nowMarkerIndex: number | null
}) {
  return (
    <>
      <tr data-testid={`opie-schedule-hour-${hourId(hour)}`} className="bg-gray-50">
        <td colSpan={6} className="px-3 py-1.5 text-xs font-medium text-gray-600">
          {formatHour(hour)}
        </td>
      </tr>
      {rows.length === 0 ? (
        <>
          {nowMarkerIndex !== null && <NowMarker />}
          <tr data-testid={`opie-schedule-empty-hour-${hourId(hour)}`} className="border-b border-gray-100">
            <td colSpan={6} className="px-3 py-1.5 text-xs italic text-gray-400">
              No appointments
            </td>
          </tr>
        </>
      ) : (
        rows.map((row, index) => (
          <RowGroup key={row.key} row={row} before={nowMarkerIndex === index} after={nowMarkerIndex === index + 1} />
        ))
      )}
    </>
  )
}

function RowGroup({ row, before, after }: { row: DaySheetRow; before: boolean; after: boolean }) {
  return (
    <>
      {before && <NowMarker />}
      <AppointmentRow row={row} />
      {after && <NowMarker />}
    </>
  )
}

/**
 * Time-ordered day sheet: an hour header from the first appointment to the last, each
 * appointment under its start hour, empty hours shown as a single quiet row.
 */
export function OpieDaySheet({ sheet }: { sheet: DaySheet }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table data-testid="opie-schedule-sheet" className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">Time</th>
            <th className="px-3 py-2">Patient</th>
            {/* Opie only exposes the patient's primary practitioner, not who each appointment is with. */}
            <th
              className="px-3 py-2"
              title="Patient's primary practitioner (Opie has no per-appointment practitioner)"
            >
              Practitioner
            </th>
            <th className="px-3 py-2">Contact</th>
            <th className="px-3 py-2">Comment</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {sheet.hours.map(({ hour, rows, nowMarkerIndex }) => (
            <HourGroup key={hour} hour={hour} rows={rows} nowMarkerIndex={nowMarkerIndex} />
          ))}
          {sheet.unscheduled.length > 0 && (
            <>
              <tr data-testid="opie-schedule-unscheduled" className="bg-gray-50">
                <td colSpan={6} className="px-3 py-1.5 text-xs font-medium text-gray-600">
                  No start time
                </td>
              </tr>
              {sheet.unscheduled.map((row) => (
                <AppointmentRow key={row.key} row={row} />
              ))}
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}
