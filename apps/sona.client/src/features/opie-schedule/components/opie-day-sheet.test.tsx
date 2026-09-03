import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeOpieScheduledPatient } from '@/testing/fixtures'
import { renderWithProviders } from '@/testing/render'

import { buildDaySheet } from '../day-sheet'
import { OpieDaySheet } from './opie-day-sheet'

const appt = (start: string, end: string) => ({
  startTime: `2026-09-03T${start}:00`,
  endTime: `2026-09-03T${end}:00`,
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
        comment: 'LUNCH',
        phoneNumbers: [],
        appointments: [appt('12:00', '13:00')],
      }),
    ])
    renderWithProviders(<OpieDaySheet sheet={sheet} />)

    const block = screen.getByTestId('opie-schedule-block--9999-0')
    expect(block).toHaveClass('bg-amber-50')
    expect(block).toHaveTextContent('Internal')
    expect(block).toHaveTextContent('LUNCH')
    expect(block).toHaveTextContent('12:00 PM – 1:00 PM')
    expect(within(block).queryByRole('button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('opie-notify--9999-0')).not.toBeInTheDocument()
    expect(screen.queryByTestId('opie-schedule-row--9999-0')).not.toBeInTheDocument()

    // The real patient row is untouched
    const row = screen.getByTestId('opie-schedule-row-7-0')
    expect(row).not.toHaveClass('bg-amber-50')
    expect(within(row).getByTestId('opie-notify-7-0')).toBeInTheDocument()
  })

  it('falls back to a generic label when the block has no comment', () => {
    const sheet = buildDaySheet([
      makeOpieScheduledPatient({ opiePatientId: '-9999', comment: null, phoneNumbers: [], appointments: [appt('12:00', '13:00')] }),
    ])
    renderWithProviders(<OpieDaySheet sheet={sheet} />)
    expect(screen.getByTestId('opie-schedule-block--9999-0')).toHaveTextContent('Internal block')
  })
})
