import { queryOptions } from '@tanstack/react-query'

import { organizationsApi } from '@sona/api-client'
import type { Department } from '@sona/shared'

/** org_admin: own org only; system_admin: every org (drives the org picker). */
export const organizationsQueryOptions = queryOptions({
  queryKey: ['organizations'],
  queryFn: () => organizationsApi.list(),
})

export interface OrgDepartment extends Department {
  siteName: string
}

/**
 * All active departments of an org, flattened across its sites, for the
 * department multi-select. Same query keys as the org-structure feature so
 * the cache is shared without a cross-feature import.
 */
export const orgDepartmentsQueryOptions = (organizationId: string | null) =>
  queryOptions({
    queryKey: ['organizations', organizationId, 'departments'],
    queryFn: async (): Promise<OrgDepartment[]> => {
      if (!organizationId) return []
      const sites = await organizationsApi.listSites(organizationId)
      const perSite = await Promise.all(
        sites
          .filter((site) => site.isActive)
          .map(async (site) => {
            const departments = await organizationsApi.listDepartments(site.id)
            return departments
              .filter((department) => department.isActive)
              .map((department) => ({ ...department, siteName: site.name }))
          }),
      )
      return perSite.flat()
    },
    enabled: organizationId !== null,
  })
