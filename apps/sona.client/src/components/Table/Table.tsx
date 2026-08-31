import { useState } from 'react';
import type { Row, SortingState } from '@tanstack/react-table';
import {
  type ColumnDef,
  type ColumnResizeDirection,
  type ColumnResizeMode,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import LoadingCat from '@/components/Loading/LoadingCat.tsx';
import Pagination from '@/components/Table/Pagination.tsx';
import { MoveDown, MoveUp } from 'lucide-react';
import type { ApplicationIntakeRequest } from '@/types/applicationIntakeRequests.ts';

type TableProps<TData, TValue = unknown> = {
  data: TData[];
  columns: ColumnDef<TData, TValue>[];
  subRowsKey?: keyof TData;
  isLoading?: boolean;
  renderSubComponent?: (props: { row: Row<TData> }) => React.ReactElement;
  getRowCanExpand?: (row: Row<TData>) => boolean;
  title?: string;
  onRowClick?: (request: ApplicationIntakeRequest) => void;
};

/**
 * Built with Tanstack Table: https://tanstack.com/table/latest/docs/introduction
 * @param data
 * @param columns
 * @param isLoading
 * @param enableExpandedRows
 * @constructor
 */

function TableComponent<TData>({
  data,
  columns,
  subRowsKey,
  isLoading = false,
  getRowCanExpand,
  title,
  onRowClick,
}: TableProps<TData>) {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  });
  const [sorting, setSorting] = useState<SortingState>([]);

  const columnResizeMode: ColumnResizeMode = 'onChange';
  const columnResizeDirection: ColumnResizeDirection = 'ltr';

  const table = useReactTable<TData>({
    data,
    columns,
    columnResizeMode,
    columnResizeDirection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getRowCanExpand,
    getSubRows: (row) => {
      return subRowsKey ? (row[subRowsKey] as unknown as TData[]) : undefined;
    },
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    enableColumnResizing: true,
    // columnResizeMode: 'onChange',
    // no need to pass pageCount or rowCount with client-side pagination as it is calculated automatically
    state: {
      pagination,
      sorting,
    },
    debugTable: true,
    debugHeaders: true,
    debugColumns: true,
    // autoresetPageIndex: false, // turn off page index reset when sorting or filtering
  });

  if (isLoading) return <LoadingCat />;
  if (data?.length === 0)
    return <div className={'p-4'}>No data to render.</div>;

  return (
    <div>
      <div className={'flex flex-row items-center justify-between p-2'}>
        <div>
          <h1 className={'font-semibold'}>{title}</h1>
        </div>

        <div className={'text-text-color'}>
          <span>Show &nbsp;</span>
          <select
            className={'border-1 border-border-color rounded px-2 py-1 bg-card shadow-sm'}
            value={table.getState().pagination.pageSize}
            onChange={(e) => {
              table.setPageSize(Number(e.target.value));
            }}
          >
            {[10, 25, 50, 100].map((pageSize) => (
              <option className={''} key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
          <span>&nbsp; entries</span>
        </div>
      </div>

      <table
        className={
          'w-full table-fixed text-md text-left border-collapse border'
        }
      >
        <thead
          className={
            'bg-neutral-secondary-soft border-b border-slate-400 align-top'
          }
        >
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    width: header.getSize(),
                  }}
                  className={
                    'text-left p-4 overflow-hidden white-space-nowrap '
                  }
                >
                  <div
                    {...{
                      onDoubleClick: () => header.column.resetSize(),
                      onMouseDown: header.getResizeHandler(),
                      onTouchStart: header.getResizeHandler(),
                      className: `resizer ${
                        table.options.columnResizeDirection
                      } ${header.column.getIsResizing() ? 'isResizing' : ''}`,
                      style: {
                        transform: header.column.getIsResizing()
                          ? `translateX(${
                              (table.options.columnResizeDirection === 'rtl'
                                ? -1
                                : 1) *
                              (table.getState().columnSizingInfo.deltaOffset ??
                                0)
                            }px)`
                          : '',
                      },
                    }}
                    className={
                      header.column.getCanSort()
                        ? 'cursor-pointer select-none flex flex-row items-center justify-between text-text-color'
                        : ''
                    }
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                    {{
                      asc: <MoveUp size={12} />,
                      desc: <MoveDown size={12} />,
                    }[header.column.getIsSorted() as string] ?? null}
                  </div>
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr
              key={row.id}
              onClick={() =>
                onRowClick
                  ? onRowClick(row.original as ApplicationIntakeRequest)
                  : null
              }
              className={'cursor-pointer hover:bg-row-hover  border '}
            >
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className={'p-3 text-text-color align-top'}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        <tfoot>
          {table.getFooterGroups().map((footerGroup) => (
            <tr key={footerGroup.id}>
              {footerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.footer,
                        header.getContext(),
                      )}
                </th>
              ))}
            </tr>
          ))}
        </tfoot>
      </table>

      <div className="h-2" />

      <Pagination table={table} />
      {/*<pre>{JSON.stringify(table.getState().pagination, null, 2)}</pre>*/}
    </div>
  );
}

export default TableComponent;
