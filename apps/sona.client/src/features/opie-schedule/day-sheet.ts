import type { OpieAppointment, OpiePhoneNumber, OpieScheduledPatient } from '@sona/shared'
import { OPIE_PLACEHOLDER_PATIENT_ID } from '@sona/shared'

/**
 * One appointment on the day sheet. Opie's payload is patient → appointments[]; the
 * sheet is time-ordered, so a patient with two appointments becomes two rows.
 */
export interface DaySheetRow {
  /** `${opiePatientId}-${appointmentIndex}` — unique per row, stable across renders. */
  key: string
  patient: OpieScheduledPatient
  appointment: OpieAppointment
  /** Minutes from local midnight; null when the start time is missing or unparseable. */
  startMinutes: number | null
  endMinutes: number | null
}

export interface DaySheetHour {
  /** 0–23 */
  hour: number
  /** Rows starting in this hour, ordered by start time. Empty = nothing booked that hour. */
  rows: DaySheetRow[]
  /** When "now" falls in this hour: number of rows that started before now (marker goes after them). */
  nowMarkerIndex: number | null
}

export interface DaySheet {
  /** Consecutive hours from the first appointment's hour to the last one's end. */
  hours: DaySheetHour[]
  /** Rows with no usable start time — listed after the timed hours so nothing silently disappears. */
  unscheduled: DaySheetRow[]
  appointmentCount: number
  patientCount: number
}

/** Opie stores local wall-clock without an offset, so `Date` parses it as local time. */
export function toMinutesOfDay(iso: string | null): number | null {
  if (!iso) return null
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date.getHours() * 60 + date.getMinutes()
}

export function formatTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export function formatHour(hour: number): string {
  return new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: 'numeric' })
}

export function formatPatientName(p: OpieScheduledPatient): string {
  const given = [p.firstName, p.middleName].filter(Boolean).join(' ')
  return [p.lastName, given].filter(Boolean).join(', ') || '—'
}

function compareRows(a: DaySheetRow, b: DaySheetRow): number {
  return (
    (a.startMinutes ?? 0) - (b.startMinutes ?? 0) ||
    (a.patient.lastName ?? '').localeCompare(b.patient.lastName ?? '') ||
    a.key.localeCompare(b.key)
  )
}

/**
 * Flattens the schedule into hour buckets from the first start to the last end. Gaps are
 * derived only from what Opie returns — an empty hour means no appointment was booked,
 * not that a practitioner is free (practitioner is a patient field, not an appointment one).
 * `nowMinutes` (local minutes of day) places the "now" marker; pass null on other days.
 */
export function buildDaySheet(
  patients: OpieScheduledPatient[],
  nowMinutes: number | null = null,
): DaySheet {
  const rows: DaySheetRow[] = []
  for (const patient of patients) {
    if (patient.opiePatientId === OPIE_PLACEHOLDER_PATIENT_ID) continue
    const appointments =
      patient.appointments.length > 0 ? patient.appointments : [{ startTime: null, endTime: null }]
    appointments.forEach((appointment, index) => {
      rows.push({
        key: `${patient.opiePatientId}-${index}`,
        patient,
        appointment,
        startMinutes: toMinutesOfDay(appointment.startTime),
        endMinutes: toMinutesOfDay(appointment.endTime),
      })
    })
  }

  const timed = rows.filter((r) => r.startMinutes !== null).sort(compareRows)
  const unscheduled = rows.filter((r) => r.startMinutes === null).sort(compareRows)

  const hours: DaySheetHour[] = []
  if (timed.length > 0) {
    const firstHour = Math.floor(Math.min(...timed.map((r) => r.startMinutes!)) / 60)
    // The hour that contains the last minute of activity (an end of 15:00 belongs to the 14:00 hour).
    const lastHour = Math.max(
      ...timed.map((r) => {
        const end = r.endMinutes !== null && r.endMinutes > r.startMinutes! ? r.endMinutes - 1 : r.startMinutes!
        return Math.floor(end / 60)
      }),
    )
    const nowHour = nowMinutes === null ? null : Math.floor(nowMinutes / 60)
    for (let hour = firstHour; hour <= lastHour; hour++) {
      const hourRows = timed.filter((r) => Math.floor(r.startMinutes! / 60) === hour)
      hours.push({
        hour,
        rows: hourRows,
        nowMarkerIndex:
          nowHour === hour ? hourRows.filter((r) => r.startMinutes! <= nowMinutes!).length : null,
      })
    }
  }

  return {
    hours,
    unscheduled,
    appointmentCount: timed.length + unscheduled.length,
    patientCount: new Set(rows.map((r) => r.patient.opiePatientId)).size,
  }
}

/**
 * Best-effort E.164 from Opie's free-form phone rows (`555-0100`, `(555) 010-0100`, `+1…`).
 * Ten digits are assumed North American unless the country says otherwise. Null = don't dial.
 */
export function toE164(number: string | null, country: string | null): string | null {
  if (!number) return null
  const digits = number.replace(/\D/g, '')
  if (number.trim().startsWith('+')) {
    return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null
  }
  const nanp = country === null || /^(us|usa|ca|can|1)$/i.test(country.trim())
  if (digits.length === 10 && nanp) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1') && nanp) return `+${digits}`
  return null
}

export interface MobileNumberChoice {
  /** As stored in Opie, for display. */
  display: string
  /** What the API is asked to dial. */
  e164: string
}

/** First Opie phone row that normalises to E.164 — the number the notify button will use. */
export function pickMobileNumber(phones: OpiePhoneNumber[]): MobileNumberChoice | null {
  for (const phone of phones) {
    const e164 = toE164(phone.number, phone.country)
    if (e164) return { display: phone.number!, e164 }
  }
  return null
}
