import { useQuery } from '@tanstack/react-query'

import type { MessageOut, NotificationStatus } from '@sona/shared'

import Spinner from '@/components/spinner'
import TableComponent from '@/components/Table/Table'
import type { AppColumnDef } from '@/components/Table/Table'

import { patientNotificationsQueryOptions } from '../api/get-patient-notifications'

const statusStyles: Record<NotificationStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  sent: 'bg-blue-100 text-blue-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString()
}

// Small, unsorted, unpaged dataset — client-side mode with both turned off.
const columns: AppColumnDef<MessageOut>[] = [
  {
    accessorKey: 'channel',
    header: 'Channel',
    cell: ({ row }) => <span className="uppercase">{row.original.channel}</span>,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[row.original.status]}`}
        title={row.original.failureReason ?? undefined}
      >
        {row.original.status}
      </span>
    ),
  },
  {
    accessorKey: 'createdAt',
    header: 'Created',
    cell: ({ row }) => formatDateTime(row.original.createdAt),
  },
  {
    accessorKey: 'sentAt',
    header: 'Sent',
    cell: ({ row }) => formatDateTime(row.original.sentAt),
  },
  {
    accessorKey: 'deliveredAt',
    header: 'Delivered',
    cell: ({ row }) => formatDateTime(row.original.deliveredAt),
  },
]

export function NotificationHistory({ patientId }: { patientId: string }) {
  const { data: notifications, isPending, isError } = useQuery(
    patientNotificationsQueryOptions(patientId),
  )

  const tid = (suffix: string) => `notification-history-${suffix}-${patientId}`

  if (isPending) {
    return (
      <div data-testid={tid('loading')} className="flex items-center gap-2 px-4 py-2">
        <Spinner size="sm" label="Loading history" />
        <p className="text-sm text-gray-500">Loading history…</p>
      </div>
    )
  }
  if (isError) {
    return (
      <p data-testid={tid('error')} className="px-4 py-2 text-sm text-red-600">
        Failed to load notification history.
      </p>
    )
  }
  if (notifications.length === 0) {
    return (
      <p data-testid={tid('empty')} className="px-4 py-2 text-sm text-gray-500">
        No notifications sent yet.
      </p>
    )
  }

  return (
    <TableComponent
      data={notifications}
      columns={columns}
      bordered={false}
      enableSorting={false}
      enablePagination={false}
      testId={tid('table')}
    />
  )
}
