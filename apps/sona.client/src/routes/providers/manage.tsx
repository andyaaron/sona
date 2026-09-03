import { useState } from 'react'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { CreateProviderInput, Provider } from '@sona/shared'

import Button from '@/components/button'
import { useUser } from '@/hooks/useUser'
import { SearchInput } from '@/components/search-input'
import TableComponent from '@/components/Table/Table'
import type { AppColumnDef } from '@/components/Table/Table'
import { useCreateProvider } from '@/features/providers/api/create-provider'
import { useUpdateProvider } from '@/features/providers/api/update-provider'
import { providersQueryOptions } from '@/features/providers/api/get-providers'
import { ProviderForm } from '@/features/providers/components/provider-form'
import { getErrorMessage } from '@/lib/api-error'

export const Route = createFileRoute('/providers/manage')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(providersQueryOptions),
  component: ManageProvidersPage,
})

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; provider: Provider }
  | null

// Client-side gate is UX only — the server's OrgAdmin policy on POST/PUT is what enforces it.
function ManageProvidersPage() {
  const currentUser = useUser()
  const isAdmin = currentUser.role === 'org_admin' || currentUser.role === 'system_admin'

  if (!isAdmin) {
    return (
      <div data-testid="providers-forbidden">
        <h1 className="text-2xl font-semibold text-gray-900">Manage Providers</h1>
        <p className="mt-2 text-gray-600">Only organization administrators can manage providers.</p>
      </div>
    )
  }

  return <ManageProvidersAdmin />
}

export function ManageProvidersAdmin() {
  const { data: providers } = useSuspenseQuery(providersQueryOptions)
  const [formState, setFormState] = useState<FormState>(null)
  const [search, setSearch] = useState('')
  const createProvider = useCreateProvider()
  const updateProvider = useUpdateProvider()

  function handleCreate(values: CreateProviderInput) {
    createProvider.mutate(values, {
      onSuccess: () => {
        setFormState(null)
        toast.success('Provider added successfully')
      },
      onError: (error) => {
        toast.error(getErrorMessage(error))
      },
    })
  }

  function handleUpdate(values: CreateProviderInput) {
    if (formState?.mode !== 'edit') return

    updateProvider.mutate(
      { id: formState.provider.id, ...values, isActive: formState.provider.isActive },
      {
        onSuccess: () => {
          setFormState(null)
          toast.success('Provider updated successfully')
        },
        onError: (error) => {
          toast.error(getErrorMessage(error))
        },
      },
    )
  }

  function handleToggleActive(provider: Provider) {
    updateProvider.mutate(
      { id: provider.id, isActive: !provider.isActive },
      {
        onSuccess: () => {
          toast.success(provider.isActive ? 'Provider deactivated' : 'Provider reactivated')
        },
      },
    )
  }

  const isCreating = formState?.mode === 'create'
  const editingProvider = formState?.mode === 'edit' ? formState.provider : null

  const filteredProviders = providers.filter((provider) => {
    if (!search) return true
    const query = search.toLowerCase()
    return (
      provider.firstName.toLowerCase().includes(query) ||
      provider.lastName.toLowerCase().includes(query) ||
      (provider.npi?.includes(query) ?? false)
    )
  })

  // Defined per render — the actions column closes over the mutation handlers
  // and update-pending state.
  const columns: AppColumnDef<Provider>[] = [
    {
      accessorKey: 'lastName',
      header: 'Name',
      cell: ({ row }) => {
        const provider = row.original
        return (
          <p className="font-medium text-gray-900">
            {provider.firstName} {provider.lastName}
            {provider.credentials ? `, ${provider.credentials}` : ''}
            {!provider.isActive && (
              <span className="ml-2 text-xs text-red-500">(Inactive)</span>
            )}
          </p>
        )
      },
    },
    {
      accessorKey: 'npi',
      header: 'NPI',
      cell: ({ row }) =>
        row.original.npi ?? <span className="text-gray-400">No NPI</span>,
    },
    {
      accessorKey: 'specialty',
      header: 'Specialty',
      cell: ({ row }) =>
        row.original.specialty ?? <span className="text-gray-400">—</span>,
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`providers-edit-${row.original.id}`}
            onClick={() => setFormState({ mode: 'edit', provider: row.original })}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={updateProvider.isPending}
            data-testid={`providers-toggle-active-${row.original.id}`}
            onClick={() => handleToggleActive(row.original)}
          >
            {row.original.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div data-testid="providers-page">
      <div data-testid="providers-toolbar" className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Manage Providers</h1>
        <Button
          variant={isCreating ? 'secondary' : 'primary'}
          size="sm"
          data-testid="providers-add-button"
          aria-expanded={isCreating}
          onClick={() =>
            setFormState((s) => (s?.mode === 'create' ? null : { mode: 'create' }))
          }
        >
          {isCreating ? 'Cancel' : 'Add Provider'}
        </Button>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or NPI…"
          testId="providers-search"
        />
      </div>

      {formState ? (
        <ProviderForm
          title={editingProvider ? 'Edit provider' : 'Add provider'}
          submitLabel={editingProvider ? 'Save changes' : 'Create provider'}
          initialValues={
            editingProvider
              ? {
                  firstName: editingProvider.firstName,
                  lastName: editingProvider.lastName,
                  credentials: editingProvider.credentials,
                  npi: editingProvider.npi,
                  specialty: editingProvider.specialty,
                }
              : undefined
          }
          isSubmitting={createProvider.isPending || updateProvider.isPending}
          onCancel={() => setFormState(null)}
          onSubmit={editingProvider ? handleUpdate : handleCreate}
        />
      ) : null}

      <TableComponent
        data={filteredProviders}
        columns={columns}
        getRowId={(provider) => provider.id}
        emptyMessage="No providers found."
        testId="providers-table"
      />
    </div>
  )
}
