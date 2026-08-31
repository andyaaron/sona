import type { Table } from '@tanstack/react-table';

type PaginationProps<TData> = {
  table: Table<TData>;
};

function Pagination<TData>({ table }: PaginationProps<TData>) {
  return (
    <div className={'flex flex-row justify-between items-center'}>
      <div className={'flex flex-row flex-nowrap'}>
        Showing {table.getRowModel().rows.length.toLocaleString()} of{' '}
        {table.getRowCount().toLocaleString()} Rows
      </div>
      <div className=" flex flex-row justify-center text-table-color">
        <div className="bg-card border-1 rounded rounded-r-none">
          <button
            className="border-r-1 p-2 cursor-pointer hover:bg-gray-200/20 transition-all ease-in disabled:bg-btn-disabled disabled:cursor-default"
            onClick={() => table.firstPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {'First'}
          </button>
          <button
            className="p-2 cursor-pointer hover:bg-gray-200/20 transition-all ease-in disabled:bg-btn-disabled disabled:cursor-default"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            {'Prev'}
          </button>
        </div>
        <span className="flex items-center gap-1 border-t-1 border-b-1 px-1">
          <div>Page</div>
          <strong>
            {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount().toLocaleString()}
          </strong>
        </span>
        <div className="bg-card border rounded rounded-l-none">
          <button
            className="border-r p-2 cursor-pointer hover:bg-gray-200/20 transition-all ease-in disabled:bg-btn-disabled disabled:cursor-default"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            {'Next'}
          </button>
          <button
            className="p-2 cursor-pointer hover:bg-gray-200/20 transition-all ease-in disabled:bg-btn-disabled disabled:cursor-default"
            onClick={() => table.lastPage()}
            disabled={!table.getCanNextPage()}
          >
            {'Last'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Pagination;
