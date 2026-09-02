import { HttpResponse, http } from 'msw'

import type { CreatePatientInput, PagedResult, Patient, UpdatePatientInput } from '@sona/shared'

import { makePatient } from '../fixtures'

export function patientsListHandler(items: Patient[]) {
  return http.get('/api/patients', () =>
    HttpResponse.json<PagedResult<Patient>>({
      items,
      page: 1,
      pageSize: 25,
      totalCount: items.length,
    }),
  )
}

export const patientHandlers = [
  patientsListHandler([]),
  http.get('/api/patients/:id/notifications', () => HttpResponse.json([])),
  http.get('/api/patients/:id', ({ params }) =>
    HttpResponse.json(makePatient({ id: String(params.id) })),
  ),
  http.post<never, CreatePatientInput>('/api/patients', async ({ request }) => {
    const input = await request.json()
    return HttpResponse.json(makePatient({ ...input, primaryProviderId: input.primaryProviderId ?? null }), {
      status: 201,
    })
  }),
  http.put<{ id: string }, UpdatePatientInput>('/api/patients/:id', async ({ params, request }) => {
    const input = await request.json()
    return HttpResponse.json(
      makePatient({ ...input, id: String(params.id), primaryProviderId: input.primaryProviderId ?? null }),
    )
  }),
  http.delete('/api/patients/:id', () => new HttpResponse(null, { status: 204 })),
]
