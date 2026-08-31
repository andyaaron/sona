import Button from '@/components/button'

interface PaginationControlsProps {
  page: number
  pageSize: number
  totalCount: number
  onPageChange: (page: number) => void
}

export function PaginationControls({
  page,
  pageSize,
  totalCount,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  return (
    <div className="mt-4 flex items-center justify-between">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className="text-sm text-gray-600">
        Page {page} of {totalPages}
      </span>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  )
}
