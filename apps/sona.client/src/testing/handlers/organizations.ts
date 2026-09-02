import { HttpResponse, http } from 'msw'

import { makeDepartment, makeOrganization, makeSite } from '../fixtures'

export const organizationHandlers = [
  http.get('/api/organizations', () => HttpResponse.json([makeOrganization()])),
  http.get('/api/organizations/:id/sites', () => HttpResponse.json([makeSite()])),
  http.get('/api/sites/:id/departments', () => HttpResponse.json([makeDepartment()])),
]
