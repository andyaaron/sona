import { describe, expect, it } from 'vitest'

import { makeOpieScheduledPatient } from '@/testing/fixtures'

import { buildDaySheet, pickMobileNumber, toE164 } from './day-sheet'
import { addDays } from './today-iso-date'

const appt = (start: string, end: string | null = null) => ({
  startTime: `2026-09-03T${start}:00`,
  endTime: end && `2026-09-03T${end}:00`,
})

describe('buildDaySheet', () => {
  it('flattens patients into time-ordered rows under consecutive hour buckets, empty hours included', () => {
    const sheet = buildDaySheet([
      makeOpieScheduledPatient({ opiePatientId: '101', lastName: 'Sample', appointments: [appt('14:00', '14:45'), appt('09:00', '09:30')] }),
      makeOpieScheduledPatient({ opiePatientId: '102', lastName: 'Example', appointments: [appt('10:15', '10:45')] }),
    ])

    expect(sheet.hours.map((h) => h.hour)).toEqual([9, 10, 11, 12, 13, 14])
    expect(sheet.hours.map((h) => h.rows.map((r) => r.key))).toEqual([['101-1'], ['102-0'], [], [], [], ['101-0']])
    expect(sheet.appointmentCount).toBe(3)
    expect(sheet.patientCount).toBe(2)
    expect(sheet.unscheduled).toEqual([])
  })

  it('orders concurrent appointments by last name and extends to the hour containing the last end', () => {
    const sheet = buildDaySheet([
      makeOpieScheduledPatient({ opiePatientId: '2', lastName: 'Zed', appointments: [appt('08:00', '09:00')] }),
      makeOpieScheduledPatient({ opiePatientId: '1', lastName: 'Abel', appointments: [appt('08:00', '10:01')] }),
    ])
    expect(sheet.hours[0].rows.map((r) => r.patient.lastName)).toEqual(['Abel', 'Zed'])
    // 09:00 end stays in the 8 o'clock hour; 10:01 reaches into the 10 o'clock hour
    expect(sheet.hours.map((h) => h.hour)).toEqual([8, 9, 10])
  })

  it('keeps rows with no start time in an unscheduled bucket', () => {
    const sheet = buildDaySheet([
      makeOpieScheduledPatient({ opiePatientId: '5', appointments: [{ startTime: null, endTime: null }] }),
      makeOpieScheduledPatient({ opiePatientId: '6', appointments: [] }),
    ])
    expect(sheet.hours).toEqual([])
    expect(sheet.unscheduled.map((r) => r.key)).toEqual(['5-0', '6-0'])
    expect(sheet.patientCount).toBe(2)
  })

  it('keeps -9999 internal blocks as time-occupying rows, counted apart from patients', () => {
    const sheet = buildDaySheet([
      makeOpieScheduledPatient({ opiePatientId: '1', appointments: [appt('09:00', '09:30')] }),
      makeOpieScheduledPatient({
        opiePatientId: '-9999',
        lastName: null,
        firstName: null,
        comment: 'LUNCH',
        phoneNumbers: [],
        appointments: [appt('12:00', '13:00'), appt('09:00', '09:15')],
      }),
    ])
    // The block extends the sheet to 12 o'clock and sorts first inside 9 (null last name)
    expect(sheet.hours.map((h) => h.hour)).toEqual([9, 10, 11, 12])
    expect(sheet.hours[0].rows.map((r) => [r.key, r.isInternalBlock])).toEqual([
      ['-9999-1', true],
      ['1-0', false],
    ])
    expect(sheet.hours[3].rows[0]).toMatchObject({ key: '-9999-0', isInternalBlock: true })
    expect(sheet.hours[3].rows[0].patient.comment).toBe('LUNCH')
    expect(sheet.appointmentCount).toBe(1)
    expect(sheet.patientCount).toBe(1)
    expect(sheet.internalBlockCount).toBe(2)
  })

  it('places the now marker after the rows that have already started, only on the current hour', () => {
    const patients = [
      makeOpieScheduledPatient({ opiePatientId: '1', appointments: [appt('09:00', '09:30'), appt('09:40', '10:00')] }),
      makeOpieScheduledPatient({ opiePatientId: '2', appointments: [appt('11:00', '11:30')] }),
    ]
    expect(buildDaySheet(patients, 9 * 60 + 35).hours.map((h) => h.nowMarkerIndex)).toEqual([1, null, null])
    expect(buildDaySheet(patients, 10 * 60 + 5).hours.map((h) => h.nowMarkerIndex)).toEqual([null, 0, null])
    expect(buildDaySheet(patients, 7 * 60).hours.map((h) => h.nowMarkerIndex)).toEqual([null, null, null])
    expect(buildDaySheet(patients).hours.map((h) => h.nowMarkerIndex)).toEqual([null, null, null])
  })
})

describe('toE164 / pickMobileNumber', () => {
  it('normalises North American formats and passes through international numbers', () => {
    expect(toE164('555-010-0100', 'US')).toBe('+15550100100')
    expect(toE164('(555) 010-0100', null)).toBe('+15550100100')
    expect(toE164('1 555 010 0100', 'USA')).toBe('+15550100100')
    expect(toE164('+44 20 7946 0958', 'GB')).toBe('+442079460958')
  })

  it('refuses numbers it cannot dial safely', () => {
    expect(toE164('555-0100', 'US')).toBeNull()
    expect(toE164('0100 0100 00', 'GB')).toBeNull()
    expect(toE164(null, 'US')).toBeNull()
    expect(toE164('+0 123', null)).toBeNull()
  })

  it('picks the first usable phone row', () => {
    expect(
      pickMobileNumber([
        { number: '555-0100', extension: null, country: 'US' },
        { number: '555-010-0199', extension: '3', country: 'US' },
      ]),
    ).toEqual({ display: '555-010-0199', e164: '+15550100199' })
    expect(pickMobileNumber([])).toBeNull()
  })
})

describe('addDays', () => {
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-09-03', 1)).toBe('2026-09-04')
    expect(addDays('2026-09-01', -1)).toBe('2026-08-31')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })
})
