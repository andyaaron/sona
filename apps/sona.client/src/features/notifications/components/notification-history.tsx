import { useQuery } from '@tanstack/react-query'

import type { NotificationStatus } from '@sona/shared'

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

export function NotificationHistory({ patientId }: { patientId: string }) {
  const { data: notifications, isPending, isError } = useQuery(
    patientNotificationsQueryOptions(patientId),
  )

  if (isPending) {
    return <p className="px-4 py-2 text-sm text-gray-500">Loading history…</p>
  }
  if (isError) {
    return <p className="px-4 py-2 text-sm text-red-600">Failed to load notification history.</p>
  }
  if (notifications.length === 0) {
    return <p className="px-4 py-2 text-sm text-gray-500">No notifications sent yet.</p>
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs uppercase text-gray-500">
          <th className="px-4 py-1.5 font-medium">Channel</th>
          <th className="px-4 py-1.5 font-medium">Status</th>
          <th className="px-4 py-1.5 font-medium">Created</th>
          <th className="px-4 py-1.5 font-medium">Sent</th>
          <th className="px-4 py-1.5 font-medium">Delivered</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">
        {notifications.map((n) => (
          <tr key={n.id}>
            <td className="px-4 py-1.5 uppercase text-gray-700">{n.channel}</td>
            <td className="px-4 py-1.5">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[n.status]}`}
                title={n.failureReason ?? undefined}
              >
                {n.status}
              </span>
            </td>
            <td className="px-4 py-1.5 text-gray-500">{formatDateTime(n.createdAt)}</td>
            <td className="px-4 py-1.5 text-gray-500">{formatDateTime(n.sentAt)}</td>
            <td className="px-4 py-1.5 text-gray-500">{formatDateTime(n.deliveredAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
