import { useState } from 'react'

import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { CreateProviderInput, Provider } from '@sona/shared'
import { ApiError } from '@sona/api-client'

import Button from '@/components/button'
import { SearchInput } from '@/components/search-input'
import { useCreateProvider } from '@/features/providers/api/create-provider'
import { useUpdateProvider } from '@/features/providers/api/update-provider'
import { providersQueryOptions } from '@/features/providers/api/get-providers'
import { ProviderForm } from '@/features/providers/components/provider-form'

export const Route = createFileRoute('/providers/manage')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(providersQueryOptions),
  component: ManageProvidersPage,
})

type FormState =
  | { mode: 'create' }
  | { mode: 'edit'; provider: Provider }
  | null

function getErrorMessage(error: Error): string {
  if (error instanceof ApiError) {
    const body = error.body as Record<string, unknown> | null
    if (body && typeof body.error === 'string') {
      return body.error
    }
    return `Request failed (${error.status})`
  }
  return error.message || 'An unexpected error occurred'
}

// @TODO: Lock behind user access level
function ManageProvidersPage() {
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

  return (
    <div>
      <div className="flex items-center gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Manage Providers</h1>
        <Button
          variant={isCreating ? 'secondary' : 'primary'}
          size="sm"
          onClick={() =>
            setFormState((s) => (s?.mode === 'create' ? null : { mode: 'create' }))
          }
        >
          {isCreating ? 'Cancel' : 'Add Provider'}
        </Button>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or NPI…" />
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

      <ul className="mt-4 divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {filteredProviders.map((provider) => (
          <li key={provider.id} className="flex items-center justify-between px-4 py-3">
            <div>
              <p className="font-medium text-gray-900">
                {provider.firstName} {provider.lastName}
                {provider.credentials ? `, ${provider.credentials}` : ''}
                {!provider.isActive && (
                  <span className="ml-2 text-xs text-red-500">(Inactive)</span>
                )}
              </p>
              <p className="text-sm text-gray-500">
                {provider.npi ? `NPI: ${provider.npi}` : 'No NPI'}
                {provider.specialty ? ` · ${provider.specialty}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setFormState({ mode: 'edit', provider })}
              >
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={updateProvider.isPending}
                onClick={() => handleToggleActive(provider)}
              >
                {provider.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
