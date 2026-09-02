import { Fragment } from 'react'
import { useState } from 'react'
import type { ReactElement } from 'react'

import {
  createExpandedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  rowExpandingFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from '@tanstack/react-table'
import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
  Row,
  RowData,
  SortingState,
} from '@tanstack/react-table'
import { MoveDown, MoveUp } from 'lucide-react'

import Pagination from '@/components/Table/Pagination'

/**
 * Feature set shared by every table (TanStack Table v9 requires explicit
 * feature registration). Column defs are typed against it — use
 * `AppColumnDef<TData>` / `AppRow<TData>` in consumers.
 */
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  rowExpandingFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

export type AppTableFeatures = typeof features

// TValue is `any` so one array can mix columns of different value types —
// the same containment the library's own columnHelper.columns() uses.
export type AppColumnDef<TData extends RowData> = ColumnDef<AppTableFeatures, TData, any>

export type AppRow<TData extends RowData> = Row<AppTableFeatures, TData>

/**
 * Server-driven mode: the API sorts and pages; the table renders exactly the
 * rows it is given and reports state changes through the handlers (which the
 * routes map to search params).
 */
export interface ManualTableState {
  sorting: SortingState
  onSortingChange: OnChangeFn<SortingState>
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  /** Total row count across all pages, from the server. */
  rowCount: number
}

interface TableProps<TData extends RowData> {
  data: TData[]
  columns: AppColumnDef<TData>[]
  title?: string
  isLoading?: boolean
  emptyMessage?: string
  /** Stable row identity (keeps expansion tied to the row, not its index). */
  getRowId?: (row: TData, index: number) => string
  onRowClick?: (row: TData) => void
  /** Rendered in an extra full-width row under each expanded row. */
  renderSubComponent?: (props: { row: AppRow<TData> }) => ReactElement
  getRowCanExpand?: (row: AppRow<TData>) => boolean
  /** Rounded border + white background wrapper (off for embedded panels). */
  bordered?: boolean
  /** Client-side toggles; ignored when `manual` is set (both forced on). */
  enableSorting?: boolean
  enablePagination?: boolean
  /** Present = manual (server-driven) sorting + pagination. */
  manual?: ManualTableState
  /**
   * Root data-testid; children derive from it (see docs/admin-ui-guide.md):
   * `${testId}-title`, `-page-size`, `-header-<columnId>`, `-row-<rowId>`,
   * `-expanded-<rowId>`, `-empty`, `-loading`, `-row-count`, `-page-info`,
   * `-page-first|previous|next|last`.
   */
  testId?: string
}

/**
 * Shared table renderer built on TanStack Table v9:
 * https://tanstack.com/table/latest/docs/introduction
 *
 * Client-side mode owns its own sorting/pagination state; manual mode is
 * fully controlled via the `manual` prop for server-driven tables.
 */
function TableComponent<TData extends RowData>({
  data,
  columns,
  title,
  isLoading = false,
  emptyMessage = 'No data to render.',
  getRowId,
  onRowClick,
  renderSubComponent,
  getRowCanExpand,
  bordered = true,
  enableSorting = true,
  enablePagination = true,
  manual,
  testId,
}: TableProps<TData>) {
  const tid = (suffix: string) => (testId ? `${testId}-${suffix}` : undefined)
  const [clientPagination, setClientPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [clientSorting, setClientSorting] = useState<SortingState>([])

  const isManual = manual !== undefined
  const paginationEnabled = isManual || enablePagination

  const table = useTable({
    features,
    data,
    columns,
    getRowId,
    getRowCanExpand,
    enableSorting: isManual || enableSorting,
    // Keep single-column always-sorted semantics: clicks toggle asc/desc.
    enableSortingRemoval: false,
    enableMultiSort: false,
    manualSorting: isManual,
    // With pagination off, the data passes through as a single page.
    manualPagination: isManual || !enablePagination,
    // Page state lives in the URL in manual mode — never auto-reset it here.
    ...(isManual ? { rowCount: manual.rowCount, autoResetPageIndex: false } : {}),
    state: {
      sorting: isManual ? manual.sorting : clientSorting,
      pagination: isManual ? manual.pagination : clientPagination,
    },
    onSortingChange: isManual ? manual.onSortingChange : setClientSorting,
    onPaginationChange: isManual ? manual.onPaginationChange : setClientPagination,
  })

  if (isLoading) {
    return (
      <p data-testid={tid('loading')} className="px-4 py-6 text-center text-sm text-gray-500">
        Loading…
      </p>
    )
  }

  const rows = table.getRowModel().rows
  const columnCount = table.getAllLeafColumns().length

  return (
    <div>
      {(title || paginationEnabled) && (
        <div className="mt-4 flex items-center justify-between">
          <h2 data-testid={tid('title')} className="font-semibold text-gray-900">
            {title}
          </h2>
          {paginationEnabled && (
            <label className="text-sm text-gray-600">
              Show{' '}
              <select
                data-testid={tid('page-size')}
                className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm shadow-sm"
                value={table.state.pagination.pageSize}
                onChange={(e) => table.setPageSize(Number(e.target.value))}
              >
                {[10, 25, 50, 100].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>{' '}
              entries
            </label>
          )}
        </div>
      )}

      <div
        className={
          bordered
            ? 'mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white'
            : 'overflow-x-auto'
        }
      >
        <table data-testid={testId} className="w-full divide-y divide-gray-200">
          <thead className={bordered ? 'bg-gray-50' : undefined}>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      data-testid={tid(`header-${header.column.id}`)}
                      scope="col"
                      aria-sort={
                        sorted === 'asc'
                          ? 'ascending'
                          : sorted === 'desc'
                            ? 'descending'
                            : undefined
                      }
                      className="px-4 py-2 text-left text-sm font-medium text-gray-700"
                    >
                      {header.isPlaceholder ? null : header.column.getCanSort() ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-gray-900"
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          <span aria-hidden="true" className="text-gray-400">
                            {sorted === 'asc' ? (
                              <MoveUp size={12} />
                            ) : sorted === 'desc' ? (
                              <MoveDown size={12} />
                            ) : null}
                          </span>
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row) => (
              <Fragment key={row.id}>
                <tr
                  data-testid={tid(`row-${row.id}`)}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={onRowClick ? 'cursor-pointer hover:bg-gray-50' : undefined}
                >
                  {row.getAllCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-top text-sm text-gray-700">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                {row.getIsExpanded() && renderSubComponent && (
                  <tr data-testid={tid(`expanded-${row.id}`)}>
                    <td colSpan={columnCount} className="px-4 pb-3">
                      {renderSubComponent({ row })}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  data-testid={tid('empty')}
                  colSpan={columnCount}
                  className="px-4 py-6 text-center text-sm text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {paginationEnabled && <Pagination table={table} testId={testId} />}
    </div>
  )
}

export default TableComponent
