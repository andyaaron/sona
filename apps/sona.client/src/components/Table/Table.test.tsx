import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { OnChangeFn, PaginationState, SortingState } from '@tanstack/react-table'

import { renderWithProviders } from '@/testing/render'

import TableComponent from './Table'
import type { AppColumnDef } from './Table'

interface Row {
  id: string
  name: string
  age: number
}

const rows: Row[] = Array.from({ length: 25 }, (_, i) => ({
  id: String(i + 1),
  name: `Person ${String(i + 1).padStart(2, '0')}`,
  age: 60 - i,
}))

const columns: AppColumnDef<Row>[] = [
  { accessorKey: 'name', header: 'Name' },
  { accessorKey: 'age', header: 'Age' },
  { id: 'actions', header: '', enableSorting: false, cell: () => 'edit' },
]

const renderedNames = () =>
  screen.getAllByTestId(/^people-row-\d+$/).map((tr) => within(tr).getAllByRole('cell')[0].textContent)

describe('TableComponent — client mode', () => {
  it('pages 10 rows at a time and navigates', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TableComponent data={rows} columns={columns} getRowId={(r) => r.id} testId="people" />)

    expect(screen.getAllByTestId(/^people-row-\d+$/)).toHaveLength(10)
    expect(screen.getByTestId('people-page-info')).toHaveTextContent('Page 1 of 3')
    expect(screen.getByTestId('people-row-count')).toHaveTextContent('Showing 10 of 25 rows')
    expect(screen.getByTestId('people-page-previous')).toBeDisabled()

    await user.click(screen.getByTestId('people-page-next'))
    expect(screen.getByTestId('people-page-info')).toHaveTextContent('Page 2 of 3')
    expect(renderedNames()[0]).toBe('Person 11')

    await user.click(screen.getByTestId('people-page-last'))
    expect(screen.getAllByTestId(/^people-row-\d+$/)).toHaveLength(5)
    expect(screen.getByTestId('people-page-next')).toBeDisabled()

    await user.selectOptions(screen.getByTestId('people-page-size'), '25')
    expect(screen.getAllByTestId(/^people-row-\d+$/)).toHaveLength(25)
  })

  it('sorts by clicking a header, toggling asc → desc, and leaves non-sortable columns plain', async () => {
    const user = userEvent.setup()
    renderWithProviders(<TableComponent data={rows} columns={columns} getRowId={(r) => r.id} testId="people" />)

    // Numeric columns sort descending first (TanStack default); text ascending first
    const ageHeader = screen.getByTestId('people-header-age')
    expect(ageHeader).not.toHaveAttribute('aria-sort')
    await user.click(within(ageHeader).getByRole('button'))
    expect(ageHeader).toHaveAttribute('aria-sort', 'descending')
    expect(renderedNames()[0]).toBe('Person 01')

    await user.click(within(ageHeader).getByRole('button'))
    expect(ageHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(renderedNames()[0]).toBe('Person 25')

    const nameHeader = screen.getByTestId('people-header-name')
    await user.click(within(nameHeader).getByRole('button'))
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending')
    expect(ageHeader).not.toHaveAttribute('aria-sort')
    expect(renderedNames()[0]).toBe('Person 01')

    expect(within(screen.getByTestId('people-header-actions')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('can switch sorting and pagination off', () => {
    renderWithProviders(
      <TableComponent
        data={rows}
        columns={columns}
        getRowId={(r) => r.id}
        enableSorting={false}
        enablePagination={false}
        testId="people"
      />,
    )
    expect(screen.getAllByTestId(/^people-row-\d+$/)).toHaveLength(25)
    expect(screen.queryByTestId('people-page-info')).not.toBeInTheDocument()
    expect(within(screen.getByTestId('people-header-name')).queryByRole('button')).not.toBeInTheDocument()
  })

  it('renders the empty and loading states', () => {
    const { rerender } = renderWithProviders(
      <TableComponent data={[]} columns={columns} emptyMessage="Nobody here." testId="people" />,
    )
    expect(screen.getByTestId('people-empty')).toHaveTextContent('Nobody here.')

    rerender(<TableComponent data={[]} columns={columns} isLoading testId="people" />)
    expect(screen.getByTestId('people-loading')).toHaveTextContent('Loading…')
    expect(screen.queryByTestId('people')).not.toBeInTheDocument()
  })
})

describe('TableComponent — manual (server-driven) mode', () => {
  function renderManual(sorting: SortingState = [], pagination: PaginationState = { pageIndex: 0, pageSize: 10 }) {
    const onSortingChange = vi.fn<OnChangeFn<SortingState>>()
    const onPaginationChange = vi.fn<OnChangeFn<PaginationState>>()
    renderWithProviders(
      <TableComponent
        data={rows.slice(0, 10)}
        columns={columns}
        getRowId={(r) => r.id}
        manual={{ sorting, onSortingChange, pagination, onPaginationChange, rowCount: 123 }}
        testId="people"
      />,
    )
    return { onSortingChange, onPaginationChange }
  }

  it('reports sorting changes instead of sorting the rows it was given', async () => {
    const user = userEvent.setup()
    const { onSortingChange } = renderManual()

    await user.click(within(screen.getByTestId('people-header-name')).getByRole('button'))

    expect(onSortingChange).toHaveBeenCalledTimes(1)
    const updater = onSortingChange.mock.calls[0][0]
    const next = typeof updater === 'function' ? updater([]) : updater
    expect(next).toEqual([{ id: 'name', desc: false }])
    // Rows stay in server order until the parent re-fetches
    expect(renderedNames()[0]).toBe('Person 01')
  })

  it('reports page changes and derives the page count from rowCount', async () => {
    const user = userEvent.setup()
    const { onPaginationChange } = renderManual()

    expect(screen.getByTestId('people-page-info')).toHaveTextContent('Page 1 of 13')
    expect(screen.getByTestId('people-row-count')).toHaveTextContent('Showing 10 of 123 rows')

    await user.click(screen.getByTestId('people-page-next'))
    expect(onPaginationChange).toHaveBeenCalledTimes(1)
    const updater = onPaginationChange.mock.calls[0][0]
    const next = typeof updater === 'function' ? updater({ pageIndex: 0, pageSize: 10 }) : updater
    expect(next).toEqual({ pageIndex: 1, pageSize: 10 })
  })

  it('reflects the controlled sorting state in the header', () => {
    renderManual([{ id: 'name', desc: true }])
    expect(screen.getByTestId('people-header-name')).toHaveAttribute('aria-sort', 'descending')
  })
})
