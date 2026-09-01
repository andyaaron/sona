import type { OnChangeFn, PaginationState, SortingState } from '@tanstack/react-table'

import type { PatientSortField, SortDirection } from '@sona/shared'

const SORT_FIELDS: PatientSortField[] = ['lastName', 'firstName', 'mrn', 'dob']

/** Must match the server's default (`PatientsController`, clamped 1–100). */
export const DEFAULT_PAGE_SIZE = 25
const PAGE_SIZES = [10, 25, 50, 100]

/**
 * Page/sort/search state kept in the route's search params (survives reload).
 * All fields optional so plain links to the routes need no search object;
 * defaults (page 1, lastName asc, 25/page) are applied where consumed.
 */
export interface PatientListSearch {
  page?: number
  pageSize?: number
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
  const pageSize = Math.trunc(Number(search.pageSize))
  if (PAGE_SIZES.includes(pageSize) && pageSize !== DEFAULT_PAGE_SIZE) {
    result.pageSize = pageSize
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

type NavigateToSearch = (opts: {
  search: (prev: PatientListSearch) => PatientListSearch
}) => void

/**
 * Bridges TanStack Table's controlled `SortingState`/`PaginationState` to the
 * route search params so sorting/paging keep round-tripping through the API
 * (manual mode — the table never sorts or slices the server's page itself).
 */
export function patientTableManualState({
  searchParams,
  page,
  pageSize,
  rowCount,
  navigate,
}: {
  searchParams: PatientListSearch
  /** 1-based current page, from the server response. */
  page: number
  /** Effective page size, from the server response. */
  pageSize: number
  /** Total row count, from the server response. */
  rowCount: number
  navigate: NavigateToSearch
}) {
  const sorting: SortingState = [
    {
      id: searchParams.sortBy ?? 'lastName',
      desc: searchParams.sortDir === 'desc',
    },
  ]
  const pagination: PaginationState = { pageIndex: page - 1, pageSize }

  const onSortingChange: OnChangeFn<SortingState> = (updater) => {
    const next = typeof updater === 'function' ? updater(sorting) : updater
    const first = next[0]
    if (!first) return
    navigate({
      search: (prev) => ({
        ...prev,
        sortBy: first.id as PatientSortField,
        sortDir: first.desc ? 'desc' : 'asc',
        page: undefined,
      }),
    })
  }

  const onPaginationChange: OnChangeFn<PaginationState> = (updater) => {
    const next = typeof updater === 'function' ? updater(pagination) : updater
    // A page-size change restarts at page 1 (server clamps size at 100).
    const nextPage = next.pageSize !== pagination.pageSize ? 1 : next.pageIndex + 1
    navigate({
      search: (prev) => ({
        ...prev,
        page: nextPage > 1 ? nextPage : undefined,
        pageSize: next.pageSize !== DEFAULT_PAGE_SIZE ? next.pageSize : undefined,
      }),
    })
  }

  return { sorting, onSortingChange, pagination, onPaginationChange, rowCount }
}
