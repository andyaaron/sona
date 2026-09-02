import { HttpResponse, http } from 'msw'

import type { NotifyPatientInput } from '@sona/shared'

import { makeMessageOut } from '../fixtures'

export const notificationHandlers = [
  http.post<never, NotifyPatientInput>('/api/notifications/ready', async ({ request }) => {
    const input = await request.json()
    return HttpResponse.json(
      makeMessageOut({ patientId: input.patientId, departmentId: input.departmentId ?? null }),
      { status: 201 },
    )
  }),
]
