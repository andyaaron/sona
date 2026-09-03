import { screen, waitFor } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { makeOpieScheduledPatient } from '@/testing/fixtures'
import { opieNotConfiguredHandler } from '@/testing/handlers/opie'
import { renderRoute } from '@/testing/render'
import { server } from '@/testing/server'

describe('/ dashboard — Opie schedule table', () => {
  it('lists the scheduled patients for the date in the URL', async () => {
    let requestedDate: string | null = null
    server.use(
      http.get('/api/opie/schedule', ({ request }) => {
        requestedDate = new URL(request.url).searchParams.get('date')
        return HttpResponse.json([
          makeOpieScheduledPatient({
            opiePatientId: '4242',
            lastName: 'Rivera',
            firstName: 'Ana',
            middleName: 'M',
            nickName: 'Annie',
            comment: 'Bring prior orthotic',
            phoneNumbers: [{ number: '555-0199', extension: '12', country: 'US' }],
          }),
          makeOpieScheduledPatient({ opiePatientId: '4243', lastName: 'Zed', appointments: [], phoneNumbers: [] }),
        ])
      }),
    )
    renderRoute('/?date=2026-09-03')

    expect(await screen.findByTestId('opie-schedule-table')).toBeInTheDocument()
    expect(requestedDate).toBe('2026-09-03')
    expect(screen.getByTestId('opie-schedule-date')).toHaveValue('2026-09-03')

    const row = screen.getByTestId('opie-schedule-table-row-4242')
    expect(row).toHaveTextContent('Rivera, Ana M')
    expect(row).toHaveTextContent('"Annie"')
    expect(row).toHaveTextContent('555-0199')
    expect(row).toHaveTextContent('ext. 12')
    expect(row).toHaveTextContent('Bring prior orthotic')
    expect(screen.getByTestId('opie-schedule-table-row-4243')).toHaveTextContent('—')
    expect(screen.getByTestId('opie-schedule-table-row-count')).toHaveTextContent('Showing 2 of 2 rows')
  })

  it('defaults the date to today and shows the empty state when nothing is scheduled', async () => {
    renderRoute('/')

    expect(await screen.findByTestId('opie-schedule-table-empty')).toHaveTextContent(
      'No Opie appointments on this date.',
    )
    const today = new Date()
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    expect(screen.getByTestId('opie-schedule-date')).toHaveValue(expected)
  })

  it('shows the not-configured notice on 503 instead of an error (dashboard still renders)', async () => {
    server.use(opieNotConfiguredHandler)
    renderRoute('/')

    expect(await screen.findByTestId('opie-schedule-unconfigured')).toHaveTextContent(
      'Opie connection not configured',
    )
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('opie-schedule-table')).not.toBeInTheDocument()
  })

  it('shows the server error message on 502 (Opie unreachable)', async () => {
    server.use(
      http.get('/api/opie/schedule', () =>
        HttpResponse.json({ error: 'opie-unavailable' }, { status: 502 }),
      ),
    )
    renderRoute('/')

    await waitFor(() =>
      expect(screen.getByTestId('opie-schedule-error')).toHaveTextContent('opie-unavailable'),
    )
  })
})
