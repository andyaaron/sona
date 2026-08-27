import { queryOptions } from '@tanstack/react-query'

import { notificationsApi } from '@sona/api-client'

// Keyed ['notifications', patientId] — useNotifyPatient invalidates exactly this key
export const patientNotificationsQueryOptions = (patientId: string) =>
  queryOptions({
    queryKey: ['notifications', patientId],
    queryFn: () => notificationsApi.listForPatient(patientId),
  })
