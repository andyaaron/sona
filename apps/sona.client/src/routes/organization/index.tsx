import { useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { toast } from 'sonner'

import type { Department, Site } from '@sona/shared'

import Button from '@/components/button'
import TableComponent from '@/components/Table/Table'
import type { AppColumnDef } from '@/components/Table/Table'
import { useUser } from '@/hooks/useUser'
import { useCreateDepartment } from '@/features/org-structure/api/create-department'
import { useCreateSite } from '@/features/org-structure/api/create-site'
import { departmentsQueryOptions } from '@/features/org-structure/api/get-departments'
import { organizationsQueryOptions } from '@/features/org-structure/api/get-organizations'
import { sitesQueryOptions } from '@/features/org-structure/api/get-sites'
import { useUpdateDepartment } from '@/features/org-structure/api/update-department'
import { useUpdateSite } from '@/features/org-structure/api/update-site'
import { NameForm } from '@/features/org-structure/components/name-form'
import { getErrorMessage } from '@/lib/api-error'

export const Route = createFileRoute('/organization/')({
  component: OrganizationPage,
})

// Client-side gate is UX only — the server enforces the OrgAdmin policy.
function OrganizationPage() {
  const user = useUser()
  const isSystemAdmin = user.role === 'system_admin'
  const isAdmin = isSystemAdmin || user.role === 'org_admin'
  const { data: organizations = [] } = useQuery({ ...organizationsQueryOptions, enabled: isAdmin })
  const [pickedOrgId, setPickedOrgId] = useState<string | null>(null)

  if (!isAdmin) {
    return (
      <div data-testid="organization-forbidden">
        <h1 className="text-2xl font-semibold text-gray-900">Organization</h1>
        <p className="mt-2 text-gray-600">Only organization administrators can manage sites and departments.</p>
      </div>
    )
  }

  // org_admin: their own org. system_admin: whichever they pick.
  const organizationId = isSystemAdmin ? pickedOrgId : user.organizationId
  const organization = organizations.find((o) => o.id === organizationId) ?? null

  return (
    <div data-testid="organization-page">
      <div data-testid="organization-toolbar" className="flex items-center gap-4">
        <h1 data-testid="organization-title" className="text-2xl font-semibold text-gray-900">
          {organization ? organization.name : 'Organization'}
        </h1>
        {isSystemAdmin && (
          <select
            data-testid="organization-org-select"
            aria-label="Organization"
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm"
            value={pickedOrgId ?? ''}
            onChange={(e) => setPickedOrgId(e.target.value || null)}
          >
            <option value="">Select an organization…</option>
            {organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {organizationId ? (
        <OrgStructure key={organizationId} organizationId={organizationId} />
      ) : (
        <p data-testid="organization-empty" className="mt-2 text-gray-600">
          {isSystemAdmin ? 'Pick an organization to manage its structure.' : 'No organization assigned.'}
        </p>
      )}
    </div>
  )
}

type SiteFormState = { mode: 'create' } | { mode: 'rename'; site: Site } | null

function OrgStructure({ organizationId }: { organizationId: string }) {
  const { data: sites = [], isPending } = useQuery(sitesQueryOptions(organizationId))
  const createSite = useCreateSite(organizationId)
  const updateSite = useUpdateSite(organizationId)
  const [siteForm, setSiteForm] = useState<SiteFormState>(null)
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null)
  const [showSites, setShowSites] = useState(false)

  const activeSites = sites.filter((s) => s.isActive)
  // The Sites level is hidden while the org has a single site (design decision 1)
  const sitesLevelVisible = showSites || activeSites.length > 1 || sites.length > activeSites.length
  const currentSiteId = selectedSiteId ?? activeSites[0]?.id ?? null
  const currentSite = sites.find((s) => s.id === currentSiteId) ?? null

  function handleCreateSite(values: { name: string }) {
    createSite.mutate(values, {
      onSuccess: () => {
        setSiteForm(null)
        toast.success('Site added')
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  function handleRenameSite(values: { name: string }) {
    if (siteForm?.mode !== 'rename') return
    updateSite.mutate(
      { id: siteForm.site.id, name: values.name },
      {
        onSuccess: () => {
          setSiteForm(null)
          toast.success('Site renamed')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    )
  }

  function handleToggleSite(site: Site) {
    if (site.isActive && activeSites.length <= 1) {
      toast.error('An organization needs at least one active site.')
      return
    }
    updateSite.mutate(
      { id: site.id, isActive: !site.isActive },
      {
        onSuccess: () => toast.success(site.isActive ? 'Site deactivated' : 'Site reactivated'),
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    )
  }

  const siteColumns: AppColumnDef<Site>[] = [
    {
      accessorKey: 'name',
      header: 'Site',
      cell: ({ row }) => (
        <p className="font-medium text-gray-900">
          {row.original.name}
          {!row.original.isActive && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
        </p>
      ),
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant={row.original.id === currentSiteId ? 'primary' : 'secondary'}
            size="sm"
            data-testid={`org-sites-select-${row.original.id}`}
            aria-pressed={row.original.id === currentSiteId}
            onClick={() => setSelectedSiteId(row.original.id)}
          >
            Departments
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid={`org-sites-rename-${row.original.id}`}
            onClick={() => setSiteForm({ mode: 'rename', site: row.original })}
          >
            Rename
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={updateSite.isPending}
            data-testid={`org-sites-toggle-active-${row.original.id}`}
            onClick={() => handleToggleSite(row.original)}
          >
            {row.original.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      {sitesLevelVisible ? (
        <>
          <div data-testid="org-sites-toolbar" className="mt-6 flex items-center gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Sites</h2>
            <Button
              variant={siteForm?.mode === 'create' ? 'secondary' : 'primary'}
              size="sm"
              data-testid="org-sites-add-button"
              aria-expanded={siteForm?.mode === 'create'}
              onClick={() => setSiteForm((s) => (s?.mode === 'create' ? null : { mode: 'create' }))}
            >
              {siteForm?.mode === 'create' ? 'Cancel' : 'Add site'}
            </Button>
          </div>
          {siteForm && (
            <NameForm
              key={siteForm.mode === 'rename' ? siteForm.site.id : 'create'}
              kind="site"
              title={siteForm.mode === 'rename' ? `Rename ${siteForm.site.name}` : 'Add site'}
              submitLabel={siteForm.mode === 'rename' ? 'Save' : 'Create site'}
              initialName={siteForm.mode === 'rename' ? siteForm.site.name : ''}
              isSubmitting={createSite.isPending || updateSite.isPending}
              onCancel={() => setSiteForm(null)}
              onSubmit={siteForm.mode === 'rename' ? handleRenameSite : handleCreateSite}
            />
          )}
          <TableComponent
            data={sites}
            columns={siteColumns}
            getRowId={(s) => s.id}
            enablePagination={false}
            isLoading={isPending}
            emptyMessage="No sites yet."
            testId="org-sites-table"
          />
        </>
      ) : (
        <p data-testid="org-sites-single" className="mt-2 text-sm text-gray-500">
          Single site ({currentSite?.name ?? '—'}).{' '}
          <button
            type="button"
            data-testid="org-sites-show-button"
            className="cursor-pointer text-emerald-600 hover:underline"
            onClick={() => setShowSites(true)}
          >
            Add another site
          </button>
        </p>
      )}

      {currentSite && (
        <DepartmentsPanel key={currentSite.id} organizationId={organizationId} site={currentSite} />
      )}
    </div>
  )
}

type DepartmentFormState = { mode: 'create' } | { mode: 'rename'; department: Department } | null

function DepartmentsPanel({ organizationId, site }: { organizationId: string; site: Site }) {
  const { data: departments = [], isPending } = useQuery(departmentsQueryOptions(site.id))
  const createDepartment = useCreateDepartment(organizationId, site.id)
  const updateDepartment = useUpdateDepartment(organizationId, site.id)
  const [form, setForm] = useState<DepartmentFormState>(null)

  const activeCount = departments.filter((d) => d.isActive).length

  function handleCreate(values: { name: string }) {
    createDepartment.mutate(values, {
      onSuccess: () => {
        setForm(null)
        toast.success('Department added')
      },
      onError: (err) => toast.error(getErrorMessage(err)),
    })
  }

  function handleRename(values: { name: string }) {
    if (form?.mode !== 'rename') return
    updateDepartment.mutate(
      { id: form.department.id, name: values.name },
      {
        onSuccess: () => {
          setForm(null)
          toast.success('Department renamed')
        },
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    )
  }

  function handleToggle(department: Department) {
    if (department.isActive && activeCount <= 1) {
      toast.error('A site needs at least one active department.')
      return
    }
    updateDepartment.mutate(
      { id: department.id, isActive: !department.isActive },
      {
        onSuccess: () =>
          toast.success(department.isActive ? 'Department deactivated' : 'Department reactivated'),
        onError: (err) => toast.error(getErrorMessage(err)),
      },
    )
  }

  const columns: AppColumnDef<Department>[] = [
    {
      accessorKey: 'name',
      header: 'Department',
      cell: ({ row }) => (
        <p className="font-medium text-gray-900">
          {row.original.name}
          {!row.original.isActive && <span className="ml-2 text-xs text-red-500">(Inactive)</span>}
        </p>
      ),
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
            data-testid={`org-departments-rename-${row.original.id}`}
            onClick={() => setForm({ mode: 'rename', department: row.original })}
          >
            Rename
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={updateDepartment.isPending}
            data-testid={`org-departments-toggle-active-${row.original.id}`}
            onClick={() => handleToggle(row.original)}
          >
            {row.original.isActive ? 'Deactivate' : 'Reactivate'}
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div data-testid="org-departments-toolbar" className="mt-6 flex items-center gap-4">
        <h2 data-testid="org-departments-title" className="text-lg font-semibold text-gray-900">
          Departments — {site.name}
        </h2>
        <Button
          variant={form?.mode === 'create' ? 'secondary' : 'primary'}
          size="sm"
          data-testid="org-departments-add-button"
          aria-expanded={form?.mode === 'create'}
          onClick={() => setForm((s) => (s?.mode === 'create' ? null : { mode: 'create' }))}
        >
          {form?.mode === 'create' ? 'Cancel' : 'Add department'}
        </Button>
      </div>

      {form && (
        <NameForm
          key={form.mode === 'rename' ? form.department.id : 'create'}
          kind="department"
          title={form.mode === 'rename' ? `Rename ${form.department.name}` : 'Add department'}
          submitLabel={form.mode === 'rename' ? 'Save' : 'Create department'}
          initialName={form.mode === 'rename' ? form.department.name : ''}
          isSubmitting={createDepartment.isPending || updateDepartment.isPending}
          onCancel={() => setForm(null)}
          onSubmit={form.mode === 'rename' ? handleRename : handleCreate}
        />
      )}

      <TableComponent
        data={departments}
        columns={columns}
        getRowId={(d) => d.id}
        enablePagination={false}
        isLoading={isPending}
        emptyMessage="No departments yet."
        testId="org-departments-table"
      />
    </div>
  )
}
