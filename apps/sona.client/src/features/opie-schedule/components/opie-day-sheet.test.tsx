import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeOpieScheduledPatient } from '@/testing/fixtures'
import { renderWithProviders } from '@/testing/render'

import { buildDaySheet } from '../day-sheet'
import { OpieDaySheet } from './opie-day-sheet'

const appt = (start: string, end: string, details: string | null = null) => ({
  startTime: `2026-09-03T${start}:00`,
  endTime: `2026-09-03T${end}:00`,
  details,
})

describe('OpieDaySheet — internal blocks', () => {
  it('renders a -9999 block as a highlighted label row with no identity, contact or notify control', () => {
    const sheet = buildDaySheet([
      makeOpieScheduledPatient({ opiePatientId: '7', lastName: 'Real', appointments: [appt('11:30', '12:00')] }),
      makeOpieScheduledPatient({
        opiePatientId: '-9999',
        lastName: null,
        firstName: null,
        emailAddress: null,
        comment: null,
        phoneNumbers: [],
        appointments: [appt('12:00', '13:00', 'Lunch')],
      }),
    ])
    renderWithProviders(<OpieDaySheet sheet={sheet} />)

    const block = screen.getByTestId('opie-schedule-block--9999-0')
    expect(block).toHaveClass('bg-amber-50')
    expect(block).toHaveTextContent('Internal')
    expect(block).toHaveTextContent('Lunch')
    expect(block).toHaveTextContent('12:00 PM – 1:00 PM')
    expect(within(block).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('opie-notify--9999-0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('opie-schedule-row--9999-0')).not.toBeInTheDocument()

    // The real patient row is untouched
    const row = screen.getByTestId('opie-schedule-row-7-0')
    expect(row).not.toHaveClass('bg-amber-50')
    expect(within(row).getByTestId('opie-notify-7-0')).toBeInTheDocument()
  })

  it('hides internal block rows (but keeps real appointment rows) when hideInternal is set', () => {
    const sheet = buildDaySheet([
      makeOpieScheduledPatient({ opiePatientId: '7', lastName: 'Real', appointments: [appt('11:30', '12:00')] }),
      makeOpieScheduledPatient({
        opiePatientId: '-9999',
        lastName: null,
        firstName: null,
        emailAddress: null,
        comment: null,
        phoneNumbers: [],
        appointments: [appt('12:00', '13:00', 'Lunch')],
      }),
    ])
    renderWithProviders(<OpieDaySheet sheet={sheet} hideInternal />)

    expect(screen.queryByTestId('opie-schedule-block--9999-0')).not.toBeInTheDocument()
    expect(screen.getByTestId('opie-schedule-row-7-0')).toBeInTheDocument()
  })

  it('labels each block from its own schedule row, and falls back when details are empty', () => {
    const sheet = buildDaySheet([
      makeOpieScheduledPatient({
        opiePatientId: '-9999',
        comment: 'stale text on the shared row — must not be used',
        phoneNumbers: [],
        appointments: [appt('12:00', '13:00'), appt('15:00', '15:30', 'Staff meeting')],
      }),
    ])
    renderWithProviders(<OpieDaySheet sheet={sheet} />)
    expect(screen.getByTestId('opie-schedule-block--9999-0')).toHaveTextContent('Internal block')
    expect(screen.getByTestId('opie-schedule-block--9999-1')).toHaveTextContent('Staff meeting')
    expect(screen.queryByText(/stale text/)).not.toBeInTheDocument()
  })
})
