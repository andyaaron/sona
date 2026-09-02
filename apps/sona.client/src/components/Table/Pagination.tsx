import type { ReactTable, RowData } from '@tanstack/react-table'

import Button from '@/components/button'
import type { AppTableFeatures } from '@/components/Table/Table'

interface PaginationProps<TData extends RowData> {
  table: ReactTable<AppTableFeatures, TData>
  /** Parent table's testId; children derive `${testId}-page-*` / `-row-count`. */
  testId?: string
}

function Pagination<TData extends RowData>({ table, testId }: PaginationProps<TData>) {
  const tid = (suffix: string) => (testId ? `${testId}-${suffix}` : undefined)
  const { pageIndex } = table.state.pagination
  const pageCount = Math.max(1, table.getPageCount())

  return (
    <div className="mt-4 flex items-center justify-between">
      <span data-testid={tid('row-count')} className="text-sm text-gray-600">
        Showing {table.getRowModel().rows.length.toLocaleString()} of{' '}
        {table.getRowCount().toLocaleString()} rows
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          data-testid={tid('page-first')}
          onClick={() => table.firstPage()}
        >
          First
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          data-testid={tid('page-previous')}
          onClick={() => table.previousPage()}
        >
          Previous
        </Button>
        <span data-testid={tid('page-info')} className="text-sm text-gray-600">
          Page {pageIndex + 1} of {pageCount.toLocaleString()}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!table.getCanNextPage()}
          data-testid={tid('page-next')}
          onClick={() => table.nextPage()}
        >
          Next
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!table.getCanNextPage()}
          data-testid={tid('page-last')}
          onClick={() => table.lastPage()}
        >
          Last
        </Button>
      </div>
    </div>
  )
}

export default Pagination
