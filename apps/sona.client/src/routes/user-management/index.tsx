import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { AppUserSummary, UserRole } from '@sona/shared'
import { ApiError } from '@sona/api-client'

import Button from '@/components/button'
import { SearchInput } from '@/components/search-input'
import TableComponent from '@/components/Table/Table'
import type { AppColumnDef } from '@/components/Table/Table'
import { useUser } from '@/hooks/useUser'
import {
  orgDepartmentsQueryOptions,
  organizationsQueryOptions,
} from '@/features/user-management/api/get-org-structure'
import { usersQueryOptions } from '@/features/user-management/api/get-users'
import { useInviteUser } from '@/features/user-management/api/invite-user'
import { useUpdateUser } from '@/features/user-management/api/update-user'
import { UserAccessForm } from '@/features/user-management/components/user-access-form'
import type { UserAccessValues } from '@/features/user-management/components/user-access-form'

export const Route = createFileRoute('/user-management/')({
  component: UserManagementPage,
})

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin: 'System admin',
  org_admin: 'Org admin',
  staff: 'Staff',
  unassigned: 'Unassigned',
}

type FormState =
  | { mode: 'invite' }
  | { mode: 'assign'; user: AppUserSummary }
  | null

function getErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    const body = error.body as Record<string, unknown> | null
    if (body && typeof body.error === 'string') return body.error
    return `Request failed (${error.status})`
  }
  return error.message || 'An unexpected error occurred'
}

// Client-side gate is UX only — the server enforces the OrgAdmin policy.
function UserManagementPage() {
  const currentUser = useUser()
  const isSystemAdmin = currentUser.role === 'system_admin'
  const isAdmin = isSystemAdmin || currentUser.role === 'org_admin'

  if (!isAdmin) {
    return (
      <div data-testid="users-forbidden">
        <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
        <p className="mt-2 text-gray-600">Only organization administrators can manage users.</p>
      </div>
    )
  }

  return <UserManagementAdmin isSystemAdmin={isSystemAdmin} organizationId={currentUser.organizationId} />
}

function UserManagementAdmin({
  isSystemAdmin,
  organizationId,
}: {
  isSystemAdmin: boolean
  organizationId: string | null
}) {
  const { data: users = [], isPending, error } = useQuery(usersQueryOptions)
  const { data: organizations = [] } = useQuery(organizationsQueryOptions)
  // Department names for the list — only resolvable for a single-org view
  const { data: departments = [] } = useQuery(orgDepartmentsQueryOptions(organizationId))

  const [formState, setFormState] = useState<FormState>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('')
  const updateUser = useUpdateUser()
  const inviteUser = useInviteUser()

  const allowedRoles: UserRole[] = isSystemAdmin
    ? ['system_admin', 'org_admin', 'staff', 'unassigned']
    : ['org_admin', 'staff', 'unassigned']

  const departmentName = new Map(departments.map((d) => [d.id, d.name]))
  const orgName = new Map(organizations.map((o) => [o.id, o.name]))

  // Both handlers reject with the server's message so the form can show it
  // next to the fields, not only as a toast.
  async function handleAssign(values: UserAccessValues) {
    if (formState?.mode !== 'assign') return
    try {
      await updateUser.mutateAsync({
        id: formState.user.id,
        role: values.role,
        organizationId: values.organizationId,
        departmentIds: values.departmentIds,
      })
      setFormState(null)
      toast.success('User updated')
    } catch (err) {
      const message = getErrorMessage(err as Error)
      toast.error(message)
      throw new Error(message)
    }
  }

  async function handleInvite(values: UserAccessValues) {
    if (values.role === 'unassigned') return
    try {
      await inviteUser.mutateAsync({
        hca34Id: values.hca34Id,
        role: values.role,
        organizationId: values.organizationId,
        departmentIds: values.departmentIds,
      })
      setFormState(null)
      toast.success('User invited')
    } catch (err) {
      const message = getErrorMessage(err as Error)
      toast.error(message)
      throw new Error(message)
    }
  }

  const pending = users.filter((u) => u.role === 'unassigned')
  const provisioned = users
    .filter((u) => u.role !== 'unassigned')
    .filter((u) => (roleFilter ? u.role === roleFilter : true))
    .filter((u) => {
      if (!search) return true
      const q = search.toLowerCase()
      return (
        (u.displayName?.toLowerCase().includes(q) ?? false) ||
        (u.email?.toLowerCase().includes(q) ?? false) ||
        (u.hca34Id?.toLowerCase().includes(q) ?? false)
      )
    })

  const nameColumn: AppColumnDef<AppUserSummary> = {
    accessorKey: 'displayName',
    header: 'Name',
    cell: ({ row }) => (
      <>
        <p className="font-medium text-gray-900">{row.original.displayName ?? row.original.hca34Id}</p>
        <p className="text-sm text-gray-500">
          {row.original.hca34Id}
          {row.original.email ? ` · ${row.original.email}` : ''}
        </p>
      </>
    ),
  }

  // Defined per render — the actions column closes over the form-state setter.
  const columns: AppColumnDef<AppUserSummary>[] = [
    nameColumn,
    {
      accessorKey: 'role',
      header: 'Role',
      cell: ({ row }) => ROLE_LABELS[row.original.role],
    },
    ...(isSystemAdmin
      ? [
          {
            accessorKey: 'organizationId',
            header: 'Organization',
            cell: ({ row }) =>
              row.original.organizationId
                ? (orgName.get(row.original.organizationId) ?? row.original.organizationId)
                : <span className="text-gray-400">—</span>,
          } satisfies AppColumnDef<AppUserSummary>,
        ]
      : []),
    {
      id: 'departments',
      header: 'Departments',
      enableSorting: false,
      cell: ({ row }) => {
        const ids = row.original.departmentIds
        if (row.original.role !== 'staff') return <span className="text-gray-400">All</span>
        if (ids.length === 0) return <span className="text-gray-400">—</span>
        const names = ids.map((id) => departmentName.get(id))
        return names.every(Boolean) ? names.join(', ') : `${ids.length} department${ids.length === 1 ? '' : 's'}`
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`users-edit-${row.original.id}`}
            onClick={() => setFormState({ mode: 'assign', user: row.original })}
          >
            Edit
          </Button>
        </div>
      ),
    },
  ]

  const pendingColumns: AppColumnDef<AppUserSummary>[] = [
    nameColumn,
    {
      accessorKey: 'lastLogin',
      header: 'First sign-in',
      cell: ({ row }) =>
        row.original.lastLogin ? new Date(row.original.lastLogin).toLocaleString() : '—',
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="primary"
            size="sm"
            data-testid={`users-assign-${row.original.id}`}
            onClick={() => setFormState({ mode: 'assign', user: row.original })}
          >
            Assign
          </Button>
        </div>
      ),
    },
  ]

  const editing = formState?.mode === 'assign' ? formState.user : null
  const isInviting = formState?.mode === 'invite'

  return (
    <div data-testid="users-page">
      <div data-testid="users-toolbar" className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">User Management</h1>
        <Button
          variant={isInviting ? 'secondary' : 'primary'}
          size="sm"
          data-testid="users-invite-button"
          aria-expanded={isInviting}
          onClick={() => setFormState((s) => (s?.mode === 'invite' ? null : { mode: 'invite' }))}
        >
          {isInviting ? 'Cancel' : 'Invite user'}
        </Button>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name, email, 34 ID…"
          testId="users-search"
        />
        <label className="ml-auto text-sm text-gray-600">
          Role{' '}
          <select
            data-testid="users-role-filter"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}
          >
            <option value="">All</option>
            {allowedRoles
              .filter((r) => r !== 'unassigned')
              .map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
          </select>
        </label>
      </div>

      {error && (
        <p data-testid="users-error" className="mt-4 text-sm text-red-600">
          {getErrorMessage(error)}
        </p>
      )}

      {formState && (
        <UserAccessForm
          key={editing ? `assign-${editing.id}` : 'invite'}
          mode={formState.mode}
          title={
            editing
              ? `${editing.role === 'unassigned' ? 'Approve' : 'Edit'} ${editing.displayName ?? editing.hca34Id ?? 'user'}`
              : 'Invite a user'
          }
          submitLabel={editing ? 'Save access' : 'Invite'}
          initialValues={{
            hca34Id: '',
            role: editing ? (editing.role === 'unassigned' ? 'staff' : editing.role) : 'staff',
            organizationId: editing?.organizationId ?? organizationId,
            departmentIds: editing?.departmentIds ?? [],
          }}
          allowedRoles={editing ? allowedRoles : allowedRoles.filter((r) => r !== 'unassigned')}
          organizations={isSystemAdmin ? organizations : undefined}
          isSubmitting={updateUser.isPending || inviteUser.isPending}
          onCancel={() => setFormState(null)}
          onSubmit={editing ? handleAssign : handleInvite}
        />
      )}

      {pending.length > 0 && (
        <TableComponent
          title={`Pending approval (${pending.length})`}
          data={pending}
          columns={pendingColumns}
          getRowId={(u) => String(u.id)}
          enablePagination={false}
          isLoading={isPending}
          testId="users-pending-table"
        />
      )}

      <TableComponent
        title="Users"
        data={provisioned}
        columns={columns}
        getRowId={(u) => String(u.id)}
        emptyMessage="No users found."
        isLoading={isPending}
        testId="users-table"
      />
    </div>
  )
}
