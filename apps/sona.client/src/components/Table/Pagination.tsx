import type { ReactTable, RowData } from '@tanstack/react-table'

import Button from '@/components/button'
import type { AppTableFeatures } from '@/components/Table/Table'

interface PaginationProps<TData extends RowData> {
  table: ReactTable<AppTableFeatures, TData>
}

function Pagination<TData extends RowData>({ table }: PaginationProps<TData>) {
  const { pageIndex } = table.state.pagination
  const pageCount = Math.max(1, table.getPageCount())

  return (
    <div className="mt-4 flex items-center justify-between">
      <span className="text-sm text-gray-600">
        Showing {table.getRowModel().rows.length.toLocaleString()} of{' '}
        {table.getRowCount().toLocaleString()} rows
      </span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.firstPage()}
        >
          First
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!table.getCanPreviousPage()}
          onClick={() => table.previousPage()}
        >
          Previous
        </Button>
        <span className="text-sm text-gray-600">
          Page {pageIndex + 1} of {pageCount.toLocaleString()}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.nextPage()}
        >
          Next
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={!table.getCanNextPage()}
          onClick={() => table.lastPage()}
        >
          Last
        </Button>
      </div>
    </div>
  )
}

export default Pagination
