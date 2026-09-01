import { useEffect, useState } from 'react'

import { useQuery } from '@tanstack/react-query'
import { useStore } from '@tanstack/react-store'

import { inviteUserSchema, updateUserSchema } from '@sona/shared'
import type { DirectoryUser, Organization, UserRole } from '@sona/shared'

import Button from '@/components/button'
import { useAppForm } from '@/hooks/form.tsx'
import { validateWithSchema } from '@/lib/schema-validation'

import { orgDepartmentsQueryOptions } from '../api/get-org-structure'
import { directorySearchQueryOptions } from '../api/search-directory'

const ROLE_LABELS: Record<UserRole, string> = {
  system_admin: 'System admin',
  org_admin: 'Organization admin',
  staff: 'Staff',
  unassigned: 'Unassigned (no access)',
}

export interface UserAccessValues {
  /** Only used in invite mode — picked from the directory search. */
  hca34Id: string
  role: UserRole
  organizationId: string | null
  departmentIds: string[]
}

interface UserAccessFormProps {
  mode: 'assign' | 'invite'
  title: string
  submitLabel: string
  initialValues: UserAccessValues
  /** Roles the caller may grant (org_admin never sees system_admin). */
  allowedRoles: UserRole[]
  /** Populated for system_admin (org picker); org_admin's org is fixed. */
  organizations?: Organization[]
  isSubmitting?: boolean
  onCancel: () => void
  onSubmit: (values: UserAccessValues) => void
}

/**
 * One form for both "assign role to an existing/pending user" and
 * "invite from the directory". Validation comes from the shared zod schemas
 * (rule 3.4); the only inline rule is the org-dependent one the schema
 * cannot know — staff need ≥1 department when the org has more than one.
 */
export function UserAccessForm({
  mode,
  title,
  submitLabel,
  initialValues,
  allowedRoles,
  organizations,
  isSubmitting = false,
  onCancel,
  onSubmit,
}: UserAccessFormProps) {
  const [departmentCount, setDepartmentCount] = useState(0)

  const form = useAppForm({
    defaultValues: initialValues,
    validators: {
      // The form value is a superset of both schemas' inputs, so run the shared
      // schema through the adapter instead of passing it directly.
      onChangeAsync: ({ value }) =>
        validateWithSchema(mode === 'invite' ? inviteUserSchema : updateUserSchema, value),
      onSubmit: ({ value }) => {
        if (value.role === 'staff' && departmentCount > 1 && value.departmentIds.length === 0) {
          return { fields: { departmentIds: 'Pick at least one department for this staff member' } }
        }
        return undefined
      },
    },
    onSubmit: ({ value }) => {
      onSubmit({
        hca34Id: value.hca34Id.trim().toUpperCase(),
        role: value.role,
        organizationId: value.role === 'system_admin' || value.role === 'unassigned' ? null : value.organizationId,
        departmentIds: value.role === 'staff' ? value.departmentIds : [],
      })
    },
  })

  const role = useStore(form.store, (state) => state.values.role)
  const organizationId = useStore(form.store, (state) => state.values.organizationId)

  const { data: departments = [] } = useQuery(orgDepartmentsQueryOptions(organizationId))
  useEffect(() => setDepartmentCount(departments.length), [departments.length])

  const roleOptions = allowedRoles.map((value) => ({ value, label: ROLE_LABELS[value] }))
  const needsOrg = role === 'org_admin' || role === 'staff'
  // Single-department orgs are auto-scoped server-side — hide the picker.
  const showDepartments = role === 'staff' && departments.length > 1

  return (
    <form
      className="mt-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        form.handleSubmit()
      }}
    >
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : submitLabel}
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {mode === 'invite' && (
          <div className="md:col-span-2">
            <form.AppField name="hca34Id">
              {(field) => (
                <DirectoryPicker
                  value={field.state.value}
                  onPick={(hit) => field.handleChange(hit.hca34Id)}
                  errors={field.state.meta.errors}
                />
              )}
            </form.AppField>
          </div>
        )}

        <form.AppField
          name="role"
          listeners={{
            // Departments only mean something for staff
            onChange: ({ value }) => {
              if (value !== 'staff') form.setFieldValue('departmentIds', [])
            },
          }}
        >
          {(field) => <field.SelectField label="Role" options={roleOptions} />}
        </form.AppField>

        {needsOrg && organizations && (
          <form.AppField
            name="organizationId"
            listeners={{
              onChange: () => form.setFieldValue('departmentIds', []),
            }}
          >
            {(field) => (
              <div className="mb-4">
                <label>
                  <div className="mb-1 text-sm font-semibold text-gray-500">Organization</div>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    value={field.state.value ?? ''}
                    onChange={(e) => field.handleChange(e.target.value || null)}
                    onBlur={field.handleBlur}
                  >
                    <option value="" disabled hidden>
                      Select an organization…
                    </option>
                    {organizations
                      .filter((org) => org.isActive)
                      .map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                  </select>
                </label>
                <FieldErrors errors={field.state.meta.errors} show={field.state.meta.isTouched} />
              </div>
            )}
          </form.AppField>
        )}

        {showDepartments && (
          <div className="md:col-span-2">
            <form.AppField name="departmentIds">
              {(field) => (
                <fieldset className="mb-4">
                  <legend className="mb-1 text-sm font-semibold text-gray-500">Departments</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {departments.map((department) => {
                      const checked = field.state.value.includes(department.id)
                      return (
                        <label
                          key={department.id}
                          className="flex items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              field.handleChange(
                                e.target.checked
                                  ? [...field.state.value, department.id]
                                  : field.state.value.filter((id) => id !== department.id),
                              )
                            }
                          />
                          <span>
                            {department.name}
                            <span className="ml-1 text-xs text-gray-400">({department.siteName})</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                  <FieldErrors errors={field.state.meta.errors} show />
                </fieldset>
              )}
            </form.AppField>
          </div>
        )}
      </div>
    </form>
  )
}

function FieldErrors({ errors, show }: { errors: unknown[]; show: boolean }) {
  if (!show || errors.length === 0) return null
  return (
    <div className="mt-1 text-sm text-red-600">
      {errors.map((error, i) => (
        <div key={i}>
          {typeof error === 'object' && error !== null && 'message' in error
            ? String((error as { message: unknown }).message)
            : String(error)}
        </div>
      ))}
    </div>
  )
}

/** Debounced HCA directory search; picking a hit fills the hidden hca34Id field. */
function DirectoryPicker({
  value,
  onPick,
  errors,
}: {
  value: string
  onPick: (hit: DirectoryUser) => void
  errors: unknown[]
}) {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [picked, setPicked] = useState<DirectoryUser | null>(null)

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(term), 300)
    return () => clearTimeout(handle)
  }, [term])

  const search = useQuery(directorySearchQueryOptions(debounced))

  return (
    <div className="mb-4">
      <label>
        <div className="mb-1 text-sm font-semibold text-gray-500">Find person (34 ID)</div>
        <input
          className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Start typing a 34 ID…"
          autoComplete="off"
        />
      </label>

      {picked ? (
        <p className="mt-2 text-sm text-gray-700">
          Selected: <span className="font-medium">{picked.displayName ?? picked.hca34Id}</span>
          <span className="ml-1 text-gray-400">
            {picked.hca34Id}
            {picked.email ? ` · ${picked.email}` : ''}
          </span>
        </p>
      ) : value ? (
        <p className="mt-2 text-sm text-gray-700">Selected: {value}</p>
      ) : null}

      {search.isFetching && <p className="mt-2 text-xs text-gray-400">Searching…</p>}
      {search.isError && (
        <p className="mt-2 text-xs text-red-600">Directory search is unavailable right now.</p>
      )}
      {search.data && search.data.length > 0 && (
        <ul className="mt-2 max-h-48 divide-y divide-gray-100 overflow-y-auto rounded-md border border-gray-200">
          {search.data.map((hit) => (
            <li key={hit.hca34Id}>
              <button
                type="button"
                className="flex w-full cursor-pointer items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-50"
                onClick={() => {
                  setPicked(hit)
                  setTerm('')
                  onPick(hit)
                }}
              >
                <span className="font-medium text-gray-900">{hit.displayName ?? hit.hca34Id}</span>
                <span className="text-xs text-gray-400">
                  {hit.hca34Id}
                  {hit.email ? ` · ${hit.email}` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {search.data && search.data.length === 0 && debounced.length >= 2 && (
        <p className="mt-2 text-xs text-gray-400">No matches.</p>
      )}
      <FieldErrors errors={errors} show={!value} />
    </div>
  )
}
