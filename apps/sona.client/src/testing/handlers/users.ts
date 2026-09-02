import { HttpResponse, http } from 'msw'

import type { AppUserSummary, InviteUserInput, UpdateUserInput, User } from '@sona/shared'

import { SEED, makeAppUser, makeUser } from '../fixtures'

/** GET /api/user for the current test — call before rendering a route. */
export function currentUserHandler(user: User) {
  return http.get('/api/user', () => HttpResponse.json(user))
}

export function usersListHandler(users: AppUserSummary[]) {
  return http.get('/api/users', () => HttpResponse.json(users))
}

export const userHandlers = [
  currentUserHandler(makeUser()),
  usersListHandler([]),
  http.put<{ id: string }, UpdateUserInput>('/api/users/:id', async ({ params, request }) => {
    const input = await request.json()
    return HttpResponse.json(
      makeAppUser({
        id: Number(params.id),
        role: input.role,
        organizationId: input.organizationId,
        departmentIds: input.departmentIds ?? [],
      }),
    )
  }),
  http.post<never, InviteUserInput>('/api/users/invite', async ({ request }) => {
    const input = await request.json()
    return HttpResponse.json(
      makeAppUser({
        hca34Id: input.hca34Id,
        displayName: null,
        email: null,
        role: input.role,
        organizationId: input.organizationId ?? SEED.organizationId,
        departmentIds: input.departmentIds ?? [],
        lastLogin: null,
      }),
      { status: 201 },
    )
  }),
  http.get('/api/users/directory-search', () => HttpResponse.json([])),
]
