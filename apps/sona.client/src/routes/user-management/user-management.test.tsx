import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { makeAppUser, makeOrgAdminUser, makeStaffUser, makeUser } from '@/testing/fixtures'
import { currentUserHandler, usersListHandler } from '@/testing/handlers/users'
import { renderRoute } from '@/testing/render'
import { server } from '@/testing/server'

describe('/user-management route', () => {
  it('lists pending (unassigned) users above the provisioned users for an admin', async () => {
    server.use(
      currentUserHandler(makeUser()),
      usersListHandler([
        makeAppUser({ id: 1, displayName: 'Admin Dev', role: 'system_admin', organizationId: null, departmentIds: [] }),
        makeAppUser({ id: 2, displayName: 'Pending Person', role: 'unassigned', organizationId: null, departmentIds: [] }),
        makeAppUser({ id: 3, displayName: 'Staff Member', role: 'staff' }),
      ]),
    )
    renderRoute('/user-management')

    expect(await screen.findByTestId('users-pending-table-title')).toHaveTextContent('Pending approval (1)')
    const pending = screen.getByTestId('users-pending-table')
    expect(within(pending).getByTestId('users-pending-table-row-2')).toHaveTextContent('Pending Person')
    expect(within(pending).getByTestId('users-assign-2')).toBeInTheDocument()

    const users = screen.getByTestId('users-table')
    expect(within(users).queryByTestId('users-table-row-2')).not.toBeInTheDocument()
    expect(within(users).getByTestId('users-table-row-3')).toHaveTextContent('Staff Member')
    // Organization column is a system_admin-only view
    expect(screen.getByTestId('users-table-header-organizationId')).toBeInTheDocument()
    expect(screen.getByTestId('header-nav-user-management')).toBeInTheDocument()
    expect(screen.getByTestId('header-nav-organizations')).toBeInTheDocument()
  })

  it('org_admin sees the page without the Organization column or the Organizations nav', async () => {
    server.use(currentUserHandler(makeOrgAdminUser()), usersListHandler([makeAppUser({ id: 3 })]))
    renderRoute('/user-management')

    expect(await screen.findByTestId('users-table-row-3')).toBeInTheDocument()
    expect(screen.queryByTestId('users-table-header-organizationId')).not.toBeInTheDocument()
    expect(screen.getByTestId('header-nav-user-management')).toBeInTheDocument()
    expect(screen.queryByTestId('header-nav-organizations')).not.toBeInTheDocument()
  })

  it('staff get the forbidden notice and no admin nav (UX gate only — the API enforces the policy)', async () => {
    server.use(currentUserHandler(makeStaffUser()))
    renderRoute('/user-management')

    expect(await screen.findByTestId('users-forbidden')).toHaveTextContent(
      'Only organization administrators can manage users.',
    )
    expect(screen.queryByTestId('header-nav-user-management')).not.toBeInTheDocument()
    expect(screen.queryByTestId('header-nav-organization')).not.toBeInTheDocument()
    expect(screen.getByTestId('header-nav-patients')).toBeInTheDocument()
  })

  it('an unassigned viewer sees the pending-approval screen instead of the app shell', async () => {
    server.use(currentUserHandler(makeUser({ role: 'unassigned', displayName: 'New Person' })))
    renderRoute('/user-management')

    expect(await screen.findByTestId('pending-approval')).toHaveTextContent('Access pending approval')
    expect(screen.getByTestId('pending-approval')).toHaveTextContent('Hi New Person')
    expect(screen.queryByTestId('header-nav-patients')).not.toBeInTheDocument()
  })
})
