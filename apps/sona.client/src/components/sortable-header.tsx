import type { SortDirection } from '@sona/shared'

interface SortableHeaderProps<Field extends string> {
  label: string
  field: Field
  sortBy: Field
  sortDir: SortDirection
  onSort: (field: Field) => void
}

/** Clickable `<th>` that toggles sort on its field and shows an asc/desc indicator. */
export function SortableHeader<Field extends string>({
  label,
  field,
  sortBy,
  sortDir,
  onSort,
}: SortableHeaderProps<Field>) {
  const isActive = sortBy === field
  return (
    <th
      scope="col"
      aria-sort={isActive ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
      className="px-4 py-2 text-left text-sm font-medium text-gray-700"
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className="inline-flex cursor-pointer items-center gap-1 hover:text-gray-900"
      >
        {label}
        <span aria-hidden="true" className="text-xs text-gray-400">
          {isActive ? (sortDir === 'asc' ? '▲' : '▼') : ''}
        </span>
      </button>
    </th>
  )
}
