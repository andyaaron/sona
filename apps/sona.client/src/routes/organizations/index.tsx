import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { CreateOrganizationInput, Organization } from '@sona/shared'
import { ApiError } from '@sona/api-client'

import Button from '@/components/button'
import TableComponent from '@/components/Table/Table'
import type { AppColumnDef } from '@/components/Table/Table'
import { useUser } from '@/hooks/useUser'
import { useCreateOrganization } from '@/features/org-structure/api/create-organization'
import { organizationsQueryOptions } from '@/features/org-structure/api/get-organizations'
import { OrganizationForm } from '@/features/org-structure/components/organization-form'

export const Route = createFileRoute('/organizations/')({
  component: OrganizationsPage,
})

function getErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    const body = error.body as Record<string, unknown> | null
    if (body && typeof body.error === 'string') return body.error
    return `Request failed (${error.status})`
  }
  return error.message || 'An unexpected error occurred'
}

const columns: AppColumnDef<Organization>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <p className="font-medium text-gray-900">
        {row.original.name}
        {!row.original.isActive && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
      </p>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (row.original.type === 'hospital' ? 'Hospital' : 'Practice'),
  },
  {
    accessorKey: 'createDate',
    header: 'Created',
    cell: ({ row }) => new Date(row.original.createDate).toLocaleDateString(),
  },
]

// System-admin surface. Client-side gate is UX only — the server enforces SystemAdmin on create.
function OrganizationsPage() {
  const user = useUser()
  const isSystemAdmin = user.role === 'system_admin'
  const { data: organizations = [], isPending } = useQuery({
    ...organizationsQueryOptions,
    enabled: isSystemAdmin,
  })
  const createOrganization = useCreateOrganization()
  const [creating, setCreating] = useState(false)

  if (!isSystemAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Organizations</h1>
        <p className="mt-2 text-gray-600">Only system administrators can manage organizations.</p>
      </div>
    )
  }

  function handleCreate(values: CreateOrganizationInput) {
    createOrganization.mutate(values, {
      onSuccess: () => {
        setCreating(false)
        toast.success('Organization created')
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Organizations</h1>
        <Button
          variant={creating ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => setCreating((c) => !c)}
        >
          {creating ? 'Cancel' : 'Add organization'}
        </Button>
      </div>

      {creating && (
        <OrganizationForm
          isSubmitting={createOrganization.isPending}
          onCancel={() => setCreating(false)}
          onSubmit={handleCreate}
        />
      )}

      <TableComponent
        data={organizations}
        columns={columns}
        getRowId={(o) => o.id}
        isLoading={isPending}
        emptyMessage="No organizations yet."
      />
    </div>
  )
}
