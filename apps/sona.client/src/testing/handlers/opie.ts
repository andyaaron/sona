import { HttpResponse, http } from 'msw'

/** Default: Opie reachable, nothing scheduled. Tests override with rows or a 503. */
export const opieHandlers = [http.get('/api/opie/schedule', () => HttpResponse.json([]))]

export const opieNotConfiguredHandler = http.get('/api/opie/schedule', () =>
  HttpResponse.json({ error: 'opie-not-configured' }, { status: 503 }),
)
