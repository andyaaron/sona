import { HttpResponse, http } from 'msw'

import type { NotifyOpiePatientInput } from '@sona/shared'

import { makeMessageOut } from '../fixtures'

/** Default: Opie reachable, nothing scheduled; notify audited as failed/sms-not-configured (Local behaviour). */
export const opieHandlers = [
  http.get('/api/opie/schedule', () => HttpResponse.json([])),
  http.post<never, NotifyOpiePatientInput>('/api/opie/notify', async ({ request }) => {
    const input = await request.json()
    return HttpResponse.json(
      makeMessageOut({
        patientId: null,
        opiePatientId: input.opiePatientId,
        mobileNumber: input.mobileNumber,
        smsConsentAttested: true,
        departmentId: input.departmentId ?? null,
      }),
      { status: 201 },
    )
  }),
]

export const opieNotConfiguredHandler = http.get('/api/opie/schedule', () =>
  HttpResponse.json({ error: 'opie-not-configured' }, { status: 503 }),
)
