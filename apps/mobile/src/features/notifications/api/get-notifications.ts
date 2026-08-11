import { queryOptions } from "@tanstack/react-query";

import { notificationsApi } from "@sona/api-client";

export const notificationsQueryOptions = (patientId: string) =>
  queryOptions({
    queryKey: ["notifications", patientId],
    queryFn: () => notificationsApi.listForPatient(patientId),
  });
