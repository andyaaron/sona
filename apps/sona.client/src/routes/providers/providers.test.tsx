import { screen } from '@testing-library/react'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { makeOrgAdminUser, makeProvider, makeStaffUser, makeUser } from '@/testing/fixtures'
import { currentUserHandler } from '@/testing/handlers/users'
import { renderRoute } from '@/testing/render'
import { server } from '@/testing/server'

describe('/providers/manage route gate (Task 18: admin-only)', () => {
  it.each([
    ['system_admin', makeUser()],
    ['org_admin', makeOrgAdminUser()],
  ])('%s sees the Providers nav and the manage page', async (_role, user) => {
    server.use(currentUserHandler(user), http.get('/api/providers', () => HttpResponse.json([makeProvider()])))
    renderRoute('/providers/manage')

    expect(await screen.findByTestId('providers-page')).toBeInTheDocument()
    expect(screen.getByTestId('providers-add-button')).toBeInTheDocument()
    expect(screen.getByTestId('header-nav-providers')).toBeInTheDocument()
  })

  it('staff get the forbidden notice and no Providers nav (UX gate; the API enforces OrgAdmin)', async () => {
    server.use(currentUserHandler(makeStaffUser()))
    renderRoute('/providers/manage')

    expect(await screen.findByTestId('providers-forbidden')).toHaveTextContent(
      'Only organization administrators can manage providers.',
    )
    expect(screen.queryByTestId('providers-add-button')).not.toBeInTheDocument()
    expect(screen.queryByTestId('header-nav-providers')).not.toBeInTheDocument()
    expect(screen.getByTestId('header-nav-patients')).toBeInTheDocument()
  })
})
