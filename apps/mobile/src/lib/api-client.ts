import { configureApiClient } from "@sona/api-client";

import { env } from "@/config/env";

export function initApiClient() {
  configureApiClient({
    baseUrl: env.apiUrl,
    // TODO: wire up auth token retrieval (expo-secure-store) once auth exists
    getToken: () => null,
  });
}
