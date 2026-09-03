import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { makeOpieScheduledPatient } from '@/testing/fixtures'
import { opieNotConfiguredHandler } from '@/testing/handlers/opie'
import { renderRoute } from '@/testing/render'
import { server } from '@/testing/server'

const isoToday = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function serveSchedule(date: string) {
  const requested: string[] = []
  server.use(
    http.get('/api/opie/schedule', ({ request }) => {
      requested.push(new URL(request.url).searchParams.get('date') ?? '')
      return HttpResponse.json([
        makeOpieScheduledPatient({
          opiePatientId: '4242',
          lastName: 'Rivera',
          firstName: 'Ana',
          middleName: 'M',
          nickName: 'Annie',
          comment: 'Bring prior orthotic',
          phoneNumbers: [{ number: '555-019-9000', extension: '12', country: 'US' }],
          appointments: [
            { startTime: `${date}T14:00:00`, endTime: `${date}T14:45:00`, details: null },
            { startTime: `${date}T09:00:00`, endTime: `${date}T09:30:00`, details: null },
          ],
        }),
        makeOpieScheduledPatient({
          opiePatientId: '4243',
          lastName: 'Zed',
          appointments: [{ startTime: `${date}T10:15:00`, endTime: `${date}T10:45:00`, details: null }],
          phoneNumbers: [],
        }),
        makeOpieScheduledPatient({
          opiePatientId: '-9999',
          lastName: null,
          firstName: null,
          comment: null,
          phoneNumbers: [],
          appointments: [{ startTime: `${date}T12:00:00`, endTime: `${date}T13:00:00`, details: 'Lunch' }],
        }),
      ])
    }),
  )
  return requested
}

describe('/ dashboard — Opie day sheet', () => {
  it('renders the date from the URL as hour buckets with one row per appointment', async () => {
    // A fixed date that is never "today" (the now marker is covered separately)
    const requested = serveSchedule('2030-01-15')
    renderRoute('/?date=2030-01-15')

    const sheet = await screen.findByTestId('opie-schedule-sheet')
    expect(requested).toEqual(['2030-01-15'])
    expect(screen.getByTestId('opie-schedule-date')).toHaveValue('2030-01-15')
    expect(screen.getByTestId('opie-schedule-summary')).toHaveTextContent('3 appointments · 2 patients · 1 internal')

    // Hours 9 → 14, in order, with the empty ones present
    const rows = within(sheet).getAllByRole('row').map((r) => r.getAttribute('data-testid'))
    expect(rows.filter((id) => id?.startsWith('opie-schedule-hour-'))).toEqual(
      ['09', '10', '11', '12', '13', '14'].map((h) => `opie-schedule-hour-${h}`),
    )
    // 12 is occupied by the LUNCH block, so it is not an empty hour
    expect(rows.filter((id) => id?.startsWith('opie-schedule-empty-hour-'))).toEqual(
      ['11', '13'].map((h) => `opie-schedule-empty-hour-${h}`),
    )
    expect(screen.getByTestId('opie-schedule-block--9999-0')).toHaveTextContent('Lunch')
    expect(rows.filter((id) => id?.startsWith('opie-schedule-row-'))).toEqual([
      'opie-schedule-row-4242-1',
      'opie-schedule-row-4243-0',
      'opie-schedule-row-4242-0',
    ])

    const row = screen.getByTestId('opie-schedule-row-4242-1')
    expect(row).toHaveTextContent('Rivera, Ana M')
    expect(row).toHaveTextContent('"Annie"')
    expect(row).toHaveTextContent('555-019-9000')
    expect(row).not.toHaveTextContent('ext.')
    expect(row).toHaveTextContent('Bring prior orthotic')
    expect(within(row).getByTestId('opie-notify-4242-1')).toBeEnabled()
    // No dialable number → button present but disabled
    expect(within(screen.getByTestId('opie-schedule-row-4243-0')).getByTestId('opie-notify-4243-0')).toBeDisabled()
    // Not today → no "now" marker
    expect(screen.queryByTestId('opie-schedule-now')).not.toBeInTheDocument()
  })

  it('defaults to today, shows the now marker, and disables Today', async () => {
    serveSchedule(isoToday())
    renderRoute('/')

    await screen.findByTestId('opie-schedule-sheet')
    expect(screen.getByTestId('opie-schedule-date')).toHaveValue(isoToday())
    expect(screen.getByTestId('opie-schedule-today')).toBeDisabled()
    // The marker only appears while "now" falls inside the sheet's hours (09:00–14:59 local)
    const hour = new Date().getHours()
    if (hour >= 9 && hour < 15) {
      expect(screen.getByTestId('opie-schedule-now')).toBeInTheDocument()
    } else {
      expect(screen.queryByTestId('opie-schedule-now')).not.toBeInTheDocument()
    }
  })

  it('steps a day with the arrows and Today, updating the URL and refetching', async () => {
    const requested = serveSchedule('2026-09-03')
    const user = userEvent.setup()
    const { router } = renderRoute('/?date=2026-09-03')
    await screen.findByTestId('opie-schedule-sheet')

    await user.click(screen.getByTestId('opie-schedule-next-day'))
    await waitFor(() => expect(router.state.location.search).toEqual({ date: '2026-09-04' }))
    await waitFor(() => expect(requested).toContain('2026-09-04'))

    await user.click(screen.getByTestId('opie-schedule-prev-day'))
    await user.click(screen.getByTestId('opie-schedule-prev-day'))
    await waitFor(() => expect(router.state.location.search).toEqual({ date: '2026-09-02' }))

    await user.click(screen.getByTestId('opie-schedule-today'))
    await waitFor(() => expect(router.state.location.search).toEqual({ date: isoToday() }))
  })

  it('shows the empty state when nothing is scheduled', async () => {
    renderRoute('/?date=2026-09-03')

    expect(await screen.findByTestId('opie-schedule-empty')).toHaveTextContent('No Opie appointments on this date.')
    expect(screen.getByTestId('opie-schedule-summary')).toHaveTextContent('0 appointments · 0 patients')
  })

  it('shows the not-configured notice on 503 instead of an error (dashboard still renders)', async () => {
    server.use(opieNotConfiguredHandler)
    renderRoute('/')

    expect(await screen.findByTestId('opie-schedule-unconfigured')).toHaveTextContent(
      'Opie connection not configured',
    )
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    expect(screen.queryByTestId('opie-schedule-sheet')).not.toBeInTheDocument()
  })

  it("hides the whole section on 404 (the Opie clinic is another organization's)", async () => {
    server.use(
      http.get('/api/opie/schedule', () =>
        HttpResponse.json({ error: 'opie-not-available' }, { status: 404 }),
      ),
    )
    renderRoute('/')

    expect(await screen.findByTestId('dashboard')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByTestId('opie-schedule-loading')).not.toBeInTheDocument())
    expect(screen.queryByTestId('opie-schedule')).not.toBeInTheDocument()
    expect(screen.queryByTestId('opie-schedule-error')).not.toBeInTheDocument()
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
