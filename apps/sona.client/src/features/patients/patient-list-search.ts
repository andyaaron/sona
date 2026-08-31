import type { PatientSortField, SortDirection } from '@sona/shared'

const SORT_FIELDS: PatientSortField[] = ['lastName', 'firstName', 'mrn', 'dob']

/**
 * Page/sort/search state kept in the route's search params (survives reload).
 * All fields optional so plain links to the routes need no search object;
 * defaults (page 1, lastName asc) are applied where the params are consumed.
 */
export interface PatientListSearch {
  page?: number
  sortBy?: PatientSortField
  sortDir?: SortDirection
  search?: string
  providerId?: string
}

export function validatePatientListSearch(
  search: Record<string, unknown>,
): PatientListSearch {
  const result: PatientListSearch = {}
  const page = Math.trunc(Number(search.page))
  if (Number.isFinite(page) && page > 1) {
    result.page = page
  }
  if (SORT_FIELDS.includes(search.sortBy as PatientSortField)) {
    result.sortBy = search.sortBy as PatientSortField
  }
  if (search.sortDir === 'asc' || search.sortDir === 'desc') {
    result.sortDir = search.sortDir as SortDirection
  }
  if (typeof search.search === 'string' && search.search !== '') {
    result.search = search.search
  }
  if (typeof search.providerId === 'string' && search.providerId !== '') {
    result.providerId = search.providerId
  }
  return result
}
