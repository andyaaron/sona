import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it, vi } from 'vitest'

import { SEED, V7_ID, makeDepartment, makeOrganization } from '@/testing/fixtures'
import { renderWithProviders } from '@/testing/render'
import { server } from '@/testing/server'

import { UserAccessForm } from './user-access-form'
import type { UserAccessValues } from './user-access-form'

const organizations = [makeOrganization()]

function renderForm(overrides: Partial<Parameters<typeof UserAccessForm>[0]> = {}) {
  const onSubmit = vi.fn<(values: UserAccessValues) => Promise<void>>().mockResolvedValue(undefined)
  const onCancel = vi.fn()
  const utils = renderWithProviders(
    <UserAccessForm
      mode="assign"
      title="Approve Pending Person"
      submitLabel="Save access"
      initialValues={{ hca34Id: '', role: 'staff', organizationId: null, departmentIds: [] }}
      allowedRoles={['system_admin', 'org_admin', 'staff', 'unassigned']}
      organizations={organizations}
      onCancel={onCancel}
      onSubmit={onSubmit}
      {...overrides}
    />,
  )
  return { ...utils, onSubmit, onCancel, user: userEvent.setup() }
}

const orgSelect = () => screen.getByTestId('user-access-form-organization')
const roleSelect = () => screen.getByTestId('user-access-form-role')
const submit = () => screen.getByTestId('user-access-form-submit')

describe('UserAccessForm — organization (Task 11 bugs 1 and 2)', () => {
  it('blocks submit with a visible error when an org-scoped role has no organization', async () => {
    const { user, onSubmit } = renderForm()

    await user.click(await screen.findByTestId('user-access-form-submit'))

    expect(await screen.findByTestId('user-access-form-organization-error')).toHaveTextContent(
      'An organization is required for this role',
    )
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.queryByTestId('user-access-form-errors')).not.toBeInTheDocument()
  })

  it('accepts the seeded organization id and submits it (was "Invalid UUID")', async () => {
    const { user, onSubmit } = renderForm()

    await user.selectOptions(await screen.findByTestId('user-access-form-organization'), SEED.organizationId)
    await user.click(submit())

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        hca34Id: '',
        role: 'staff',
        organizationId: SEED.organizationId,
        departmentIds: [],
      }),
    )
    expect(screen.queryByTestId('user-access-form-organization-error')).not.toBeInTheDocument()
  })

  it('clears the organization error once an organization is picked', async () => {
    const { user } = renderForm()
    await user.click(await screen.findByTestId('user-access-form-submit'))
    await screen.findByTestId('user-access-form-organization-error')

    await user.selectOptions(orgSelect(), SEED.organizationId)

    await waitFor(() =>
      expect(screen.queryByTestId('user-access-form-organization-error')).not.toBeInTheDocument(),
    )
  })
})

describe('UserAccessForm — role switching (Task 11 bug 3)', () => {
  it('drops a previously picked organization when the role becomes system_admin and still submits', async () => {
    const { user, onSubmit } = renderForm()
    await user.selectOptions(await screen.findByTestId('user-access-form-organization'), SEED.organizationId)

    await user.selectOptions(roleSelect(), 'system_admin')

    expect(screen.queryByTestId('user-access-form-organization')).not.toBeInTheDocument()
    await user.click(submit())
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        hca34Id: '',
        role: 'system_admin',
        organizationId: null,
        departmentIds: [],
      }),
    )
    expect(screen.queryByTestId('user-access-form-errors')).not.toBeInTheDocument()
  })

  it('restores the initial organization when switching back to an org-scoped role', async () => {
    const { user } = renderForm({
      initialValues: { hca34Id: '', role: 'staff', organizationId: SEED.organizationId, departmentIds: [] },
    })
    expect(await screen.findByTestId('user-access-form-organization')).toHaveValue(SEED.organizationId)

    await user.selectOptions(roleSelect(), 'system_admin')
    await user.selectOptions(roleSelect(), 'org_admin')

    expect(await screen.findByTestId('user-access-form-organization')).toHaveValue(SEED.organizationId)
  })

  it('keeps the current organization when moving between org_admin and staff', async () => {
    const { user } = renderForm()
    await user.selectOptions(await screen.findByTestId('user-access-form-organization'), SEED.organizationId)

    await user.selectOptions(roleSelect(), 'org_admin')

    expect(orgSelect()).toHaveValue(SEED.organizationId)
  })

  it('surfaces an error on a hidden field in the summary block instead of failing silently', async () => {
    // org_admin callers never see the org select (their org is fixed); an
    // empty initial org must still produce a visible message, not a dead button.
    const { user, onSubmit } = renderForm({
      organizations: undefined,
      allowedRoles: ['org_admin', 'staff', 'unassigned'],
    })

    await user.click(await screen.findByTestId('user-access-form-submit'))

    expect(await screen.findByTestId('user-access-form-errors')).toHaveTextContent(
      'An organization is required for this role',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })
})

describe('UserAccessForm — departments', () => {
  const twoDepartments = [
    makeDepartment(),
    makeDepartment({ id: V7_ID, name: 'Urgent Care' }),
  ]

  it('hides the picker for a single-department org (server auto-scopes)', async () => {
    const { user } = renderForm()
    await user.selectOptions(await screen.findByTestId('user-access-form-organization'), SEED.organizationId)

    await waitFor(() => expect(screen.queryByTestId('user-access-form-departments')).not.toBeInTheDocument())
  })

  it('requires at least one department for staff in a multi-department org and submits the pick', async () => {
    server.use(http.get('/api/sites/:id/departments', () => HttpResponse.json(twoDepartments)))
    const { user, onSubmit } = renderForm()
    await user.selectOptions(await screen.findByTestId('user-access-form-organization'), SEED.organizationId)
    await screen.findByTestId('user-access-form-departments')

    await user.click(submit())
    expect(await screen.findByTestId('user-access-form-departments-error')).toHaveTextContent(
      'Pick at least one department for this staff member',
    )
    expect(onSubmit).not.toHaveBeenCalled()

    await user.click(screen.getByTestId(`user-access-form-department-${V7_ID}`))
    await user.click(submit())
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'staff', organizationId: SEED.organizationId, departmentIds: [V7_ID] }),
      ),
    )
  })

  it('never sends departments for non-staff roles', async () => {
    server.use(http.get('/api/sites/:id/departments', () => HttpResponse.json(twoDepartments)))
    const { user, onSubmit } = renderForm()
    await user.selectOptions(await screen.findByTestId('user-access-form-organization'), SEED.organizationId)
    await user.click(await screen.findByTestId(`user-access-form-department-${V7_ID}`))

    await user.selectOptions(roleSelect(), 'org_admin')
    expect(screen.queryByTestId('user-access-form-departments')).not.toBeInTheDocument()
    await user.click(submit())

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'org_admin', departmentIds: [] }),
      ),
    )
  })
})

describe('UserAccessForm — invite mode', () => {
  it('requires a directory pick and an organization before sending anything', async () => {
    const { user, onSubmit } = renderForm({
      mode: 'invite',
      title: 'Invite a user',
      submitLabel: 'Invite',
      allowedRoles: ['system_admin', 'org_admin', 'staff'],
    })

    await user.click(await screen.findByTestId('user-access-form-submit'))

    expect(await screen.findByTestId('user-access-form-directory-input-error')).toHaveTextContent('34 ID is required')
    expect(screen.getByTestId('user-access-form-organization-error')).toHaveTextContent(
      'An organization is required for this role',
    )
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('org_admin callers invite into their own org without an org field', async () => {
    const { user, onSubmit } = renderForm({
      mode: 'invite',
      title: 'Invite a user',
      submitLabel: 'Invite',
      initialValues: { hca34Id: 'abc123', role: 'staff', organizationId: SEED.organizationId, departmentIds: [] },
      allowedRoles: ['org_admin', 'staff'],
      organizations: undefined,
    })
    expect(screen.queryByTestId('user-access-form-organization')).not.toBeInTheDocument()

    await user.click(await screen.findByTestId('user-access-form-submit'))

    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        hca34Id: 'ABC123',
        role: 'staff',
        organizationId: SEED.organizationId,
        departmentIds: [],
      }),
    )
  })
})

describe('UserAccessForm — server rejection', () => {
  it('shows the rejection message on the form and allows a retry', async () => {
    const { user, onSubmit } = renderForm({
      initialValues: { hca34Id: '', role: 'staff', organizationId: SEED.organizationId, departmentIds: [] },
    })
    onSubmit.mockRejectedValue(new Error('You cannot change your own role.'))

    await user.click(await screen.findByTestId('user-access-form-submit'))
    expect(await screen.findByTestId('user-access-form-errors')).toHaveTextContent('You cannot change your own role.')

    await user.click(submit())
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
  })

  it('Cancel calls onCancel without submitting', async () => {
    const { user, onCancel, onSubmit } = renderForm()
    await user.click(await screen.findByTestId('user-access-form-cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
